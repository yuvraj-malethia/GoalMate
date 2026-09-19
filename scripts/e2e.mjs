/**
 * End-to-end smoke test: drives the real UI in headless Chrome as a brand-new
 * user and checks the results through the API.
 *
 *   npm run dev            (in one terminal)
 *   npm run test:e2e       (in another)
 *
 * Env: BASE (default http://localhost:5000), CHROME_PATH (auto-detected on
 * Windows, macOS and Linux if not set).
 */
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const base = process.env.BASE ?? 'http://localhost:5000';
const chrome =
  process.env.CHROME_PATH ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].find((p) => fs.existsSync(p));
if (!chrome) {
  console.error('No Chrome/Edge found. Set CHROME_PATH.');
  process.exit(1);
}

const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

const problems = [];
page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
page.on('response', (r) => r.status() >= 400 && problems.push(`HTTP ${r.status()} ${r.request().method()} ${r.url()}`));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};
const api = (path, opts = {}) => page.evaluate(async (path, opts) => (await fetch('/api' + path, opts)).json(), path, opts);
const type = async (sel, text) => {
  await page.waitForSelector(sel, { timeout: 10_000 });
  await page.type(sel, text);
};
const waitForText = (text) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 10_000 }, text);
const clickText = async (text) => {
  await waitForText(text);
  const found = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('button, a, [role="menuitem"], [role="radio"]')].find((e) => e.textContent.trim() === t);
    el?.click();
    return !!el;
  }, text);
  if (!found) fail(`button not found: ${text}`);
  await sleep(500);
};

try {
  console.log(`GoalMate e2e against ${base}`);

  await page.goto(`${base}/signup`, { waitUntil: 'networkidle0' });
  await type('input[autocomplete="name"]', 'E2E User');
  await type('input[type="email"]', `e2e-${Date.now()}@example.com`);
  await type('input[type="password"]', 'correct horse 42');
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => location.pathname === '/app/today', { timeout: 10_000 });
  await waitForText('A clear day');
  ok('sign up lands on an empty Today');

  await page.goto(`${base}/app/goals`, { waitUntil: 'networkidle0' });
  await clickText('New goal');
  await type('input[placeholder^="e.g. Finish"]', 'Finish capstone report');
  await page.click('form button[type="submit"]');
  await page.waitForFunction(() => /\/app\/goals\/.+/.test(location.pathname), { timeout: 10_000 });
  const goalId = page.url().split('/').pop();
  ok('create a goal');

  await type('input[aria-label^="Add a task to"]', 'Write the introduction');
  await page.keyboard.press('Enter');
  await sleep(800);
  let goal = await api(`/goals/${goalId}`);
  if (goal.tasks.length !== 1) fail('task was not created');
  ok('quick-add a task');

  const check = 'button[role="checkbox"][aria-label="Complete Write the introduction"]';
  await page.waitForSelector(check);
  await page.click(check);
  await sleep(800);
  goal = await api(`/goals/${goalId}`);
  if (!goal.tasks[0].completedAt) fail('task was not completed');
  ok('complete a task');

  await page.click('div[role="button"]');
  await type('input[aria-label="Add a step"]', 'Outline sections');
  await page.keyboard.press('Enter');
  await sleep(800);
  const task = await api(`/tasks/${goal.tasks[0].id}`);
  if (task.subtasks.length !== 1) fail('step was not added');
  if (task.completedAt !== null) fail('adding an open step should re-open the task');
  ok('add a step in the task sheet');
  await page.keyboard.press('Escape');
  await sleep(400);

  await page.goto(`${base}/app/journal`, { waitUntil: 'networkidle0' });
  await clickText('Write today’s entry');
  await page.waitForSelector('.bn-editor', { timeout: 15_000 });
  await page.click('textarea[aria-label="Page title"]');
  await page.keyboard.type('First entry');
  await page.click('.bn-editor');
  await page.keyboard.type('Planned the capstone report today.');
  await sleep(1800);
  const pageId = page.url().split('/').pop();
  const entry = await api(`/pages/${pageId}`);
  if (entry.title !== 'First entry') fail(`title not saved: ${entry.title}`);
  if (!entry.excerpt.includes('capstone report')) fail('content not saved');
  ok('journal entry autosaves');

  await clickText('Good');
  await sleep(600);
  if ((await api(`/pages/${pageId}`)).mood !== 4) fail('mood not saved');
  ok('set a mood');

  await page.goto(`${base}/app/goals/${goalId}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('button[aria-label="Goal actions"]');
  await page.click('button[aria-label="Goal actions"]');
  await sleep(300);
  await clickText('Move to Trash');
  await sleep(800);
  if ((await api('/trash')).goals.length !== 1) fail('goal not in trash');
  await page.goto(`${base}/app/trash`, { waitUntil: 'networkidle0' });
  await clickText('Restore');
  await sleep(800);
  if ((await api('/trash')).goals.length !== 0) fail('restore failed');
  ok('trash and restore');

  await page.goto(`${base}/app/insights`, { waitUntil: 'networkidle0' });
  await waitForText('Tasks done, last 30 days');
  ok('insights render');

  await api('/auth/me', { method: 'DELETE' });
  if ((await api('/auth/me')) !== null) fail('account was not deleted');
  ok('delete account');

  if (problems.length) fail(`errors in the browser:\n    ${problems.join('\n    ')}`);
  console.log('All checks passed.');
} catch (e) {
  console.error(`  ✗ ${e.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
