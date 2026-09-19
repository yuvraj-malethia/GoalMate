import { useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { format } from 'date-fns';
import { ArrowRight, CalendarDays, Command, Download, Lock, Moon, NotebookPen, Plus, RotateCcw, Sparkles } from 'lucide-react';
import {
  AppFrame,
  AppPreview,
  MockCoach,
  MockDescribe,
  MockInsights,
  MockNotebook,
  MockReview,
  MockToday,
} from '@/components/landing/Mocks';
import { useLandingScroll, useReveal } from '@/components/landing/useLandingScroll';
import { Logo } from '@/components/Logo';
import { Button, buttonClass } from '@/components/ui/Button';
import { useMe } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { useStartDemo } from './Auth';

/**
 * The home page. Layout idea: a page from a planner. Content is anchored to the
 * left, and a thin margin rail runs down the page and fills as you read; each
 * section marks its place on the rail, and the matching tab in the header
 * lights up while you're in it. Blocks rise into place as they scroll in.
 */

/** Sections with a tab in the header, in page order. */
const SECTIONS = [
  ['how', 'How it works'],
  ['features', 'Features'],
  ['tech', 'Under the hood'],
  ['faq', 'FAQ'],
];
const SECTION_IDS = SECTIONS.map(([id]) => id);

const smooth = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

/** Scroll to a section (or the top) without a jump, and keep the URL in step. */
function goTo(event, id) {
  event?.preventDefault();
  if (id) document.getElementById(id)?.scrollIntoView({ behavior: smooth(), block: 'start' });
  else window.scrollTo({ top: 0, behavior: smooth() });
  history.replaceState(history.state, '', id ? `#${id}` : window.location.pathname);
}

export function Landing() {
  const { data: me } = useMe();
  const demo = useStartDemo();
  const location = useLocation();
  const rootRef = useRef(null);
  const railRef = useRef(null);
  const { active, scrolled } = useLandingScroll(SECTION_IDS, railRef);
  useReveal(rootRef);

  // Arriving with a #section in the URL (e.g. the footer link from another page).
  useLayoutEffect(() => {
    const id = location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }, [location.hash]);

  const passed = (id) => active !== null && SECTION_IDS.indexOf(active) >= SECTION_IDS.indexOf(id);

  // Signed in (or in a demo): lead back to the workspace instead of starting another demo.
  const workspaceLabel = me ? (me.isDemo ? 'Back to the demo' : 'Open GoalMate') : null;
  const primaryCta = me ? (
    <Link to="/app/today" className={buttonClass('primary', 'lg', 'h-11 px-5 text-[15px]')}>
      {workspaceLabel} <ArrowRight className="size-4" />
    </Link>
  ) : (
    <Button variant="primary" size="lg" className="h-11 px-5 text-[15px]" onClick={demo.start} loading={demo.loading}>
      Try the live demo {!demo.loading && <ArrowRight className="size-4" />}
    </Button>
  );
  const secondaryCta = (!me || me.isDemo) && (
    <Link to="/signup" className={buttonClass('secondary', 'lg', 'h-11 px-5 text-[15px]')}>
      Create an account
    </Link>
  );

  return (
    <div ref={rootRef} className="min-h-dvh overflow-x-clip bg-surface text-fg">
      {/* Header */}
      <header
        className={cn(
          'sticky top-0 z-40 border-b transition-[background-color,border-color] duration-300',
          scrolled ? 'border-line bg-surface/85 backdrop-blur-xl' : 'border-transparent bg-surface',
        )}
      >
        <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-8 px-5 sm:px-8">
          <a href="/" onClick={(e) => goTo(e, null)} className="rounded-md" aria-label="GoalMate, back to top">
            <Logo />
          </a>
          <SectionTabs active={active} />
          <div className="ml-auto flex items-center gap-2">
            {me ? (
              <Link to="/app/today" className={buttonClass('primary', 'sm')}>
                {me.isDemo ? 'Back to the demo' : 'Open app'}
              </Link>
            ) : (
              <>
                <Link to="/login" className="px-2 text-[13.5px] text-fg-2 transition-colors hover:text-fg">
                  Sign in
                </Link>
                <Button variant="primary" size="sm" onClick={demo.start} loading={demo.loading}>
                  Try the demo
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1240px] px-5 pt-14 sm:px-8 lg:pt-24 lg:pl-24">
        {/* The margin rail (desktop): fills with the accent colour as you read. */}
        <div ref={railRef} aria-hidden className="landing-rail hidden lg:block" />

        {/* Hero */}
        <section>
          <p className="relative animate-rise font-display text-[19px] text-fg-3 italic">
            <RailTick passed />
            {format(new Date(), 'EEEE, d MMMM')}
          </p>
          <h1 className="mt-5 max-w-[1000px] animate-rise text-[46px] leading-[0.98] font-semibold tracking-[-0.05em] [animation-delay:60ms] sm:text-[76px] lg:text-[92px]">
            Long goals, <br className="hidden sm:block" />
            planned <span className="font-display font-normal tracking-[-0.02em] italic">one day</span>{' '}
            <br className="hidden sm:block" />
            at a time.
          </h1>
          <div className="mt-10 grid animate-rise items-end gap-8 [animation-delay:140ms] lg:mt-14 lg:grid-cols-12">
            <p className="max-w-[500px] text-[17px] leading-relaxed text-fg-2 sm:text-[18.5px] lg:col-span-5">
              Describe what you want to achieve. GoalMate turns it into a dated plan, keeps a notebook next to every task, and
              tells you honestly whether you’re on track.
            </p>
            <div className="lg:col-span-5 lg:col-start-8">
              <div className="flex flex-wrap items-center gap-3">
                {primaryCta}
                {secondaryCta}
              </div>
              {!me && (
                <p className="mt-3 text-[12.5px] text-fg-3">
                  The demo is a private workspace with three months of sample data. No sign-up.
                </p>
              )}
            </div>
          </div>
          <div className="bleed-right relative mt-14 animate-rise [animation-delay:240ms] lg:mt-20 lg:ml-[8%]">
            <AppPreview className="lg:rounded-r-none lg:border-r-0" />
          </div>
        </section>

        {/* How it works */}
        <Section id="how">
          <div className="grid gap-14 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <div className="lg:sticky lg:top-28" data-reveal>
                <Kicker passed={passed('how')}>How it works</Kicker>
                <h2 className="mt-4 text-[34px] leading-[1.06] font-semibold tracking-[-0.04em] sm:text-[42px]">
                  From a sentence to a plan you can start tonight.
                </h2>
                <p className="mt-5 max-w-[360px] text-[16px] leading-relaxed text-fg-2">
                  Most goals fail between “I want to” and the first session. GoalMate removes that gap.
                </p>
              </div>
            </div>
            <ol className="space-y-20 lg:col-span-7 lg:col-start-6 lg:space-y-28">
              <Step
                n={1}
                title="Describe the goal"
                body="Say where you’re starting from, how many weeks you have and how many hours a week you can give it."
              >
                <MockDescribe />
              </Step>
              <Step
                n={2}
                indent
                title="Review the plan"
                body="Gemini drafts dated work sessions with checkpoints. Rename, remove or regenerate before anything is saved."
              >
                <MockReview />
              </Step>
              <Step
                n={3}
                title="Do today’s part"
                body="Each day shows only what’s due, across all your goals. Tick things off; the plan and your stats update as you go."
              >
                <MockToday />
              </Step>
            </ol>
          </div>
        </Section>

        {/* Features */}
        <Section id="features">
          <div className="grid items-end gap-6 lg:grid-cols-12" data-reveal>
            <div className="lg:col-span-7">
              <Kicker passed={passed('features')}>Features</Kicker>
              <h2 className="mt-4 text-[34px] leading-[1.06] font-semibold tracking-[-0.04em] sm:text-[48px]">
                The plan is only the start.
              </h2>
            </div>
            <p className="max-w-[380px] text-[16px] leading-relaxed text-fg-2 lg:col-span-4 lg:col-start-9">
              Every task gets a notebook and a coach, and every week gets an honest look back.
            </p>
          </div>

          <div className="mt-20 space-y-28 lg:mt-28 lg:space-y-40">
            <Feature
              label="Journal"
              title="A notebook behind every task."
              body="Open any task and start a page for it: notes, code, links, what you learned. Pages are full block documents with headings, checklists, toggles, tables and code blocks, and they live in your journal next to daily entries and weekly reviews."
              points={['Type “/” for blocks and AI writing help', 'Daily entries with a mood you can chart', 'Export any page as Markdown']}
              visual={<MockNotebook />}
            />
            <Feature
              flip
              label="Coach"
              title="A coach that already knows the context."
              body="Every task, page and goal has its own conversation. The coach sees the goal, the task, its steps and your notes, so you can ask “how do I start?” instead of explaining everything first. Answers stream in as they’re written and stay saved with the task."
              points={[
                'Break a task into steps with one click',
                '“Plan my day” picks what matters today',
                'Clear errors when the AI isn’t available, never fake answers',
              ]}
              visual={<MockCoach />}
            />
            <Feature
              label="Insights"
              title="Numbers that don’t flatter you."
              body="See what you finished, when you work best, and where each goal stands against its own plan. A weekly review written by Gemini reads your tasks and journal together and can be saved as a journal page."
              points={['A year of activity and your streaks', 'Planned versus done, week by week', 'Mood and output side by side']}
              visual={<MockInsights />}
            />
          </div>

          <Details />
        </Section>

        {/* Under the hood */}
        <Section id="tech">
          <div className="grid gap-14 lg:grid-cols-12">
            <div className="lg:col-span-5" data-reveal>
              <Kicker passed={passed('tech')}>Under the hood</Kicker>
              <h2 className="mt-4 text-[34px] leading-[1.06] font-semibold tracking-[-0.04em] sm:text-[42px]">
                Node.js and PostgreSQL underneath.
              </h2>
              <p className="mt-5 text-[16px] leading-relaxed text-fg-2">
                A JavaScript REST API on Express, backed by PostgreSQL with hand-written SQL, migrations and transactions. React
                on the front. The AI layer is a small Gemini client written for this project rather than a black-box SDK.
              </p>
              <dl className="mt-10 border-t border-line text-[14px]">
                {[
                  ['Server', 'Node.js 22, Express 5, Zod'],
                  ['Database', 'PostgreSQL, plain SQL, migrations'],
                  ['AI', 'Gemini REST API, own client'],
                  ['Interface', 'React 19, Vite, Tailwind CSS, TanStack Query, Radix UI, BlockNote, Recharts'],
                ].map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[104px_1fr] gap-4 border-b border-line py-3">
                    <dt className="text-fg-3">{k}</dt>
                    <dd className="text-fg-2">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="lg:col-span-6 lg:col-start-7 lg:pt-12">
              {[
                [
                  'Plain SQL, no ORM',
                  'Parameterised queries, a small migration runner and transactions for multi-step writes. Goal progress comes from one query with LATERAL joins and FILTER counts.',
                ],
                [
                  'Structured AI output',
                  'Plans, step suggestions and reviews request JSON that matches a schema, then get validated and cleaned on the server before the UI sees them.',
                ],
                [
                  'Model fallback',
                  'Requests walk a list of Gemini models, so a retired or rate-limited model degrades gracefully instead of breaking the feature.',
                ],
                [
                  'Streaming chat',
                  'Coach replies stream over Server-Sent Events and are stored per task, page or goal with the context they were asked in.',
                ],
                [
                  'Time-zone-correct stats',
                  'Streaks, heatmaps and “done today” are computed in SQL on your local calendar day, not the server’s UTC day.',
                ],
                ['Optimistic UI', 'Ticking a task updates every view instantly and rolls back if the server disagrees.'],
              ].map(([title, body]) => (
                <div key={title} data-reveal className="border-t border-line py-6 first:border-t-0 first:pt-0">
                  <h3 className="text-[16px] font-semibold tracking-tight">{title}</h3>
                  <p className="mt-1.5 max-w-[520px] text-[14.5px] leading-relaxed text-fg-3">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* FAQ */}
        <Section id="faq">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-4" data-reveal>
              <Kicker passed={passed('faq')}>FAQ</Kicker>
              <h2 className="mt-4 text-[34px] leading-[1.06] font-semibold tracking-[-0.04em] sm:text-[42px]">Questions.</h2>
            </div>
            <div className="faq border-t border-line lg:col-span-7 lg:col-start-6" data-reveal>
              {[
                ['Is it free?', 'Yes. GoalMate is a personal project. Run it yourself, or use the demo to look around.'],
                [
                  'Do I need an API key?',
                  'Only for the AI features. Everything else (goals, tasks, calendar, journal, insights) works without one. Add a free Gemini key from Google AI Studio to the server’s .env file to switch AI on.',
                ],
                [
                  'Where is my data stored?',
                  'In a PostgreSQL database on the server you run. Passwords are hashed with bcrypt, and sessions use httpOnly cookies.',
                ],
                [
                  'What happens to the demo workspace?',
                  'It is private to your browser session and deleted when you leave it or after 24 hours.',
                ],
                [
                  'Can I bring data from the first version of GoalMate?',
                  'Yes. Settings → Import accepts the JSON the original app exported, goals and journal entries included.',
                ],
              ].map(([q, a]) => (
                <details key={q} className="group border-b border-line [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer items-center justify-between gap-6 py-5 text-[16px] font-medium transition-colors hover:text-fg-2">
                    {q}
                    <Plus className="size-[18px] shrink-0 text-fg-3 transition-transform duration-300 group-open:rotate-45" />
                  </summary>
                  <p className="max-w-[60ch] pb-6 text-[15px] leading-relaxed text-fg-2">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </Section>
      </main>

      {/* Closing call to action */}
      <section className="mx-auto mt-28 max-w-[1240px] px-5 sm:px-8 lg:mt-40 lg:pl-24">
        <div className="grid items-end gap-10 border-t border-line pt-20 pb-24 lg:grid-cols-12 lg:pt-28 lg:pb-32" data-reveal>
          <div className="lg:col-span-7">
            <h2 className="text-[44px] leading-[0.98] font-semibold tracking-[-0.05em] sm:text-[64px] lg:text-[76px]">
              Start with <span className="font-display font-normal tracking-[-0.02em] italic">one</span> goal.
            </h2>
            <p className="mt-5 max-w-md text-[16px] leading-relaxed text-fg-2">
              It takes about a minute to go from an idea to a plan with dates on it.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:col-span-5 lg:col-start-8 lg:justify-end">
            {primaryCta}
            {secondaryCta}
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4 px-5 py-8 text-[13px] text-fg-3 sm:px-8 lg:pl-24">
          <div className="flex items-center gap-3">
            <Logo size={18} className="text-fg" />
            <span>Designed and built by Yuvraj Malethia</span>
          </div>
          <div className="flex gap-5">
            <Link to="/login" className="hover:text-fg">
              Sign in
            </Link>
            <Link to="/signup" className="hover:text-fg">
              Create account
            </Link>
            <a href="#faq" onClick={(e) => goTo(e, 'faq')} className="hover:text-fg">
              FAQ
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Header tabs. A soft highlight slides to the tab of the section being read. */
function SectionTabs({ active }) {
  const navRef = useRef(null);
  const [box, setBox] = useState(null);

  useLayoutEffect(() => {
    const measure = () => {
      const tab = navRef.current?.querySelector(`[data-tab="${active}"]`);
      setBox(tab ? { left: tab.offsetLeft, width: tab.offsetWidth } : null);
    };
    measure();
    document.fonts?.ready.then(measure); // tab widths change once the web font loads
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [active]);

  return (
    <nav ref={navRef} aria-label="Sections" className="relative hidden items-center md:flex">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 rounded-lg bg-surface-3 transition-[transform,width,opacity] duration-300 ease-out"
        style={{ width: box?.width ?? 0, transform: `translateX(${box?.left ?? 0}px)`, opacity: box ? 1 : 0 }}
      />
      {SECTIONS.map(([id, label]) => (
        <a
          key={id}
          data-tab={id}
          href={`#${id}`}
          onClick={(e) => goTo(e, id)}
          aria-current={active === id ? 'location' : undefined}
          className={cn(
            'relative rounded-lg px-3 py-1.5 text-[13.5px] transition-colors duration-300',
            active === id ? 'font-medium text-fg' : 'text-fg-2 hover:text-fg',
          )}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}

function Section({ id, children }) {
  return (
    <section id={id} className="scroll-mt-16 pt-28 lg:pt-40">
      {children}
    </section>
  );
}

/**
 * A short mark on the margin rail. It sits in the left gutter, level with the
 * text it belongs to, and turns to the accent colour once you've read that far.
 */
function RailTick({ passed }) {
  return (
    <span
      aria-hidden
      className={cn(
        'absolute top-1/2 -left-[62px] hidden h-[2px] w-[13px] -translate-y-1/2 rounded-full transition-colors duration-500 lg:block',
        passed ? 'bg-accent' : 'bg-line-strong',
      )}
    />
  );
}

function Kicker({ children, passed }) {
  return (
    <p className={cn('relative text-[13.5px] font-medium transition-colors duration-500', passed ? 'text-fg' : 'text-fg-3')}>
      <RailTick passed={passed} />
      {children}
    </p>
  );
}

function Step({ n, title, body, indent, children }) {
  return (
    <li data-reveal className={cn(indent && 'lg:pl-16')}>
      <div className="flex items-start gap-5">
        <span className="w-8 shrink-0 font-display text-[44px] leading-[0.9] text-fg-3 italic">{n}</span>
        <div>
          <h3 className="text-[20px] font-semibold tracking-[-0.02em]">{title}</h3>
          <p className="mt-1.5 max-w-[440px] text-[15px] leading-relaxed text-fg-3">{body}</p>
        </div>
      </div>
      <AppFrame className="mt-7 max-w-[520px] shadow-md sm:ml-[52px]">{children}</AppFrame>
    </li>
  );
}

/** A feature: the text column is narrow and top-aligned, the picture is wide. `flip` puts the picture first. */
function Feature({ label, title, body, points, visual, flip }) {
  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
      <div
        data-reveal
        className={cn('lg:row-start-1 lg:pt-10', flip ? 'lg:col-span-4 lg:col-start-9' : 'lg:col-span-4 lg:col-start-1')}
      >
        <p className="font-display text-[20px] text-fg-3 italic">{label}</p>
        <h3 className="mt-2 text-[30px] leading-[1.08] font-semibold tracking-[-0.035em] sm:text-[34px]">{title}</h3>
        <p className="mt-4 text-[15.5px] leading-relaxed text-fg-2">{body}</p>
        <ul className="mt-6 space-y-2.5">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-3 text-[14.5px]">
              <span aria-hidden className="mt-[11px] h-px w-3.5 shrink-0 bg-fg-3" />
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div
        data-reveal
        style={{ '--delay': '120ms' }}
        className={cn('lg:row-start-1', flip ? 'lg:col-span-7 lg:col-start-1' : 'lg:col-span-7 lg:col-start-6')}
      >
        {visual}
      </div>
    </div>
  );
}

/** The smaller details, as a two-column index instead of a grid of boxes. */
function Details() {
  const items = [
    [Command, 'Command palette', 'Search everything and jump anywhere with Ctrl K (⌘K on a Mac).'],
    [CalendarDays, 'Drag to reschedule', 'Month and week calendars. Drop a task on another day.'],
    [NotebookPen, 'Daily journal', 'One tap mood check-in from the Today page.'],
    [Sparkles, 'Weekly review', 'An honest summary of the week, saved to your journal.'],
    [Moon, 'Dark mode and accents', 'Follows your system theme. Pick one of six accent colours.'],
    [RotateCcw, 'Undo and Trash', 'Undo from any toast. Deleted items wait 30 days.'],
    [Download, 'Import and export', 'Your data as JSON, including files from the first GoalMate.'],
    [Lock, 'Private by default', 'Hashed passwords and httpOnly sessions. Your data stays on your server.'],
  ];
  return (
    <div className="mt-32 grid gap-10 lg:mt-44 lg:grid-cols-12">
      <div className="lg:col-span-4" data-reveal>
        <h3 className="text-[26px] leading-[1.1] font-semibold tracking-[-0.03em] sm:text-[30px]">Small things, done properly.</h3>
        <p className="mt-3 max-w-[300px] text-[15px] leading-relaxed text-fg-3">The parts you only notice when they’re missing.</p>
      </div>
      <dl className="grid gap-x-10 sm:grid-cols-2 lg:col-span-8">
        {items.map(([Icon, title, body], i) => {
          const I = Icon;
          return (
            <div
              key={title}
              data-reveal
              style={{ '--delay': `${(i % 2) * 80}ms` }}
              className="flex gap-4 border-t border-line py-5"
            >
              <I className="mt-0.5 size-[18px] shrink-0 text-fg-3" strokeWidth={1.75} aria-hidden />
              <div>
                <dt className="text-[15px] font-medium tracking-tight">{title}</dt>
                <dd className="mt-1 text-[14px] leading-relaxed text-fg-3">{body}</dd>
              </div>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
