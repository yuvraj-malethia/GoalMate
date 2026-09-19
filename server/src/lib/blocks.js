/**
 * Helpers for BlockNote documents (the JSON the journal editor saves).
 *
 * The server needs plain text from pages for three things: search, the list
 * excerpt, and giving the AI context. It also builds simple documents for the
 * demo data and for importing entries from the original (v1) app.
 */

/** Text of a block's inline content (runs of text, links, or a table). */
function inlineText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) {
    // Tables: { type: 'tableContent', rows: [{ cells: [...] }] }
    const rows = content?.rows;
    if (Array.isArray(rows)) {
      return rows.map((r) => (r.cells || []).map((c) => inlineText(c?.content ?? c)).join(' | ')).join('\n');
    }
    return '';
  }
  return content.map((i) => (i.type === 'link' ? inlineText(i.content) : (i.text ?? ''))).join('');
}

/** Markdown-like plain text, keeping heading/list/checkbox markers so the AI understands the structure. */
export function blocksToText(blocks, depth = 0) {
  if (!Array.isArray(blocks)) return '';
  const lines = [];
  let n = 0;
  for (const b of blocks) {
    const text = inlineText(b.content).trim();
    const pad = '  '.repeat(depth);
    let prefix = '';
    switch (b.type) {
      case 'heading':
        prefix = '#'.repeat(Number(b.props?.level) || 1) + ' ';
        break;
      case 'bulletListItem':
      case 'toggleListItem':
        prefix = '- ';
        break;
      case 'numberedListItem':
        prefix = `${++n}. `;
        break;
      case 'checkListItem':
        prefix = b.props?.checked ? '[x] ' : '[ ] ';
        break;
      case 'quote':
        prefix = '> ';
        break;
      case 'divider':
        lines.push('---');
        break;
    }
    if (b.type !== 'numberedListItem') n = 0;
    if (text) lines.push(pad + prefix + text);
    if (b.children?.length) {
      const child = blocksToText(b.children, depth + 1);
      if (child) lines.push(child);
    }
  }
  return lines.join('\n');
}

export function wordCount(text) {
  const words = text.replace(/[#>\-[\]x|]/g, ' ').match(/\S+/g);
  return words ? words.length : 0;
}

export function excerpt(text, max = 160) {
  // Headings read badly when run into the body ("Summary A strong week…"), so skip them.
  const body = text
    .split('\n')
    .filter((l) => !/^\s*#+\s/.test(l))
    .join('\n');
  const flat = (body.trim() ? body : text)
    .replace(/^\s*#+\s|^\s*[-*>]\s|^\s*\[[ x]\]\s|^\s*\d+\.\s/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  return flat.length > max ? flat.slice(0, max - 1).trimEnd() + '…' : flat;
}

/* ---------- building documents ---------- */

const inline = (text) => (text ? [{ type: 'text', text, styles: {} }] : []);

/**
 * Tiny Markdown-subset → BlockNote converter used for demo data and imports.
 * Supports: # / ## / ###, "- ", "1. ", "[ ] ", "[x] ", "> ", "---" and paragraphs.
 */
export function markdownToBlocks(md) {
  const blocks = [];
  for (const raw of md.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    let m;
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      blocks.push({ type: 'heading', props: { level: m[1].length }, content: inline(m[2]) });
    } else if ((m = line.match(/^\[( |x)\]\s+(.*)$/i))) {
      blocks.push({ type: 'checkListItem', props: { checked: m[1].toLowerCase() === 'x' }, content: inline(m[2]) });
    } else if ((m = line.match(/^[-*]\s+(.*)$/))) {
      blocks.push({ type: 'bulletListItem', content: inline(m[1]) });
    } else if ((m = line.match(/^\d+[.)]\s+(.*)$/))) {
      blocks.push({ type: 'numberedListItem', content: inline(m[1]) });
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      blocks.push({ type: 'quote', content: inline(m[1]) });
    } else if (/^-{3,}$/.test(line.trim())) {
      blocks.push({ type: 'divider' });
    } else {
      blocks.push({ type: 'paragraph', content: inline(line) });
    }
  }
  return blocks;
}
