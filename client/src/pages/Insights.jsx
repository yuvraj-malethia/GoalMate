/**
 * Insights: honest numbers about how work actually gets done.
 *
 * Chart rules followed here: one y-axis per chart (mood and output are two
 * aligned charts, never a dual axis), fixed colour-blind-safe series colours
 * (--viz-1 / --viz-2) independent of the UI accent, a single-hue ramp for the
 * heatmap, legends for two-series charts, and a table view for every chart.
 */
import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, BookmarkPlus, ChartNoAxesColumn, Flame, Sparkles, Table2 } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/AppShell';
import { AiSetupNotice } from '@/components/Chat';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/Controls';
import { EmptyState, GoalDot, Skeleton } from '@/components/ui/misc';
import { api, ApiError, errorMessage } from '@/lib/api';
import { addDays, format, fromKey, relativeTime, shortDate, todayKey, tzOffset, weekStart } from '@/lib/dates';
import { invalidatePages, useInsights } from '@/lib/queries';
import { cn, goalColor, MOODS, plural } from '@/lib/utils';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const axisTick = { fill: 'var(--fg-3)', fontSize: 11 };

export default function InsightsPage() {
  const { data, isLoading } = useInsights();

  return (
    <>
      <PageHeader title="Insights" subtitle="How your work is actually going" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1180px] space-y-5 px-4 pt-6 pb-24 sm:px-8">
          {isLoading || !data ? (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-[104px] rounded-xl" />
                ))}
              </div>
              <Skeleton className="h-[190px] rounded-xl" />
              <Skeleton className="h-[280px] rounded-xl" />
            </>
          ) : (
            <Dashboard data={data} />
          )}
        </div>
      </div>
    </>
  );
}

function Dashboard({ data }) {
  const t = data.totals;
  const delta = t.donePrev30 ? (t.done30 - t.donePrev30) / t.donePrev30 : null;
  const hasAnything = data.heatmap.length > 0 || t.journal30 > 0 || t.openTasks > 0;

  if (!hasAnything) {
    return (
      <EmptyState
        icon={ChartNoAxesColumn}
        title="Nothing to measure yet"
        description="Finish a few tasks and write a journal entry or two. Insights fill in as you go."
      />
    );
  }

  return (
    <>
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Tasks done, last 30 days"
          value={String(t.done30)}
          foot={
            delta === null ? (
              'No earlier data to compare'
            ) : (
              <span className="inline-flex items-center gap-1">
                {delta >= 0 ? (
                  <ArrowUpRight className="size-3.5 text-success" />
                ) : (
                  <ArrowDownRight className="size-3.5 text-danger" />
                )}
                {Math.abs(Math.round(delta * 100))}% vs previous 30 days
              </span>
            )
          }
        />
        <StatTile
          label="Current streak"
          value={plural(data.streak.current, 'day')}
          icon={<Flame className="size-4 text-fg-3" />}
          foot={`Best: ${plural(data.streak.best, 'day')} in a row`}
        />
        <StatTile
          label="Finished on time"
          value={t.onTimeRate === null ? '—' : `${Math.round(t.onTimeRate * 100)}%`}
          foot={t.overdueTasks ? `${plural(t.overdueTasks, 'task')} overdue right now` : 'Nothing overdue right now'}
        />
        <StatTile
          label="Journal entries, 30 days"
          value={String(t.journal30)}
          foot={t.avgMood30 ? `Average mood: ${MOODS[Math.round(t.avgMood30) - 1].label.toLowerCase()}` : 'No moods recorded'}
        />
      </div>

      <HeatmapCard data={data} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <WeeklyCard data={data} />
        <MoodCard data={data} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <WhenCard data={data} />
        <GoalsCard data={data} />
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <ReviewCard />
        <RecentCard data={data} />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* building blocks                                                     */
/* ------------------------------------------------------------------ */

function StatTile({ label, value, foot, icon }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-fg-3">{label}</p>
        {icon}
      </div>
      <p className="mt-1.5 text-[28px] leading-none font-semibold tracking-[-0.03em]">{value}</p>
      <p className="mt-2.5 text-[12px] text-fg-3">{foot}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, legend, table, children, className }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className={cn('card p-5', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[12.5px] text-fg-3">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {legend && !asTable && (
            <div className="flex items-center gap-3 text-[12px] text-fg-2">
              {legend.map((l) => (
                <span key={l.label} className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[3px]" style={{ background: l.color }} /> {l.label}
                </span>
              ))}
            </div>
          )}
          {table && (
            <button
              onClick={() => setAsTable((v) => !v)}
              aria-pressed={asTable}
              title={asTable ? 'Show chart' : 'Show as table'}
              className={cn(
                'grid size-7 place-items-center rounded-md text-fg-3 hover:bg-surface-3 hover:text-fg',
                asTable && 'bg-surface-3 text-fg',
              )}
            >
              {asTable ? <ChartNoAxesColumn className="size-4" /> : <Table2 className="size-4" />}
            </button>
          )}
        </div>
      </div>
      {asTable && table ? (
        <div className="max-h-[260px] overflow-auto rounded-lg border border-line">
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0 bg-surface-2 text-fg-3">
              <tr>
                {table.head.map((h) => (
                  <th key={h} className="px-3 py-1.5 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {table.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j} className="px-3 py-1.5">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function TooltipBox({ title, rows }) {
  return (
    <div className="floating rounded-lg border border-line px-3 py-2 text-[12px] shadow-md">
      <p className="mb-1 font-medium">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2 text-fg-2">
          {r.color && <span className="size-2 rounded-[2px]" style={{ background: r.color }} />}
          <span className="flex-1">{r.label}</span>
          <span className="font-medium text-fg tabular-nums">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* heatmap                                                             */
/* ------------------------------------------------------------------ */

function HeatmapCard({ data }) {
  const today = todayKey();
  const [hover, setHover] = useState(null);
  // Fit as many weeks as the card is wide (GitHub-style), between 12 and 53.
  const [width, setWidth] = useState(0);
  const measure = useCallback((el) => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
  }, []);
  const WEEKS = Math.max(12, Math.min(53, Math.floor((width - 30) / 16) || 26));
  const counts = useMemo(() => new Map(data.heatmap.map((d) => [d.date, d.count])), [data.heatmap]);
  const start = addDays(weekStart(today), -7 * (WEEKS - 1));
  const max = Math.max(1, ...data.heatmap.map((d) => d.count));
  const level = (n) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
  // Grow the cells a little when there's spare width, so the grid fills the card.
  const gap = 3;
  const cell = Math.max(10, Math.min(17, Math.floor((width - 30) / WEEKS) - gap || 13));
  const total = data.heatmap.filter((d) => d.date >= start).reduce((s, d) => s + d.count, 0);

  const weeks = Array.from({ length: WEEKS }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
  const monthLabels = weeks
    .map((w, i) => ({ i, label: format(fromKey(w[0]), 'MMM'), first: fromKey(w[0]).getDate() <= 7 }))
    .filter((m) => m.first);

  return (
    <ChartCard
      title="Activity"
      subtitle={`${plural(total, 'task')} completed in the last ${WEEKS >= 52 ? 'year' : `${Math.round(WEEKS / 4.35)} months`}`}
      table={{
        head: ['Week of', 'Tasks completed'],
        rows: weeks.map((w) => [shortDate(w[0]), w.reduce((s, d) => s + (counts.get(d) ?? 0), 0)]),
      }}
    >
      <div ref={measure} className="overflow-x-auto pb-1">
        <svg
          width={WEEKS * (cell + gap) + 30}
          height={7 * (cell + gap) + 22}
          role="img"
          aria-label="Tasks completed per day over the last six months"
          className="block"
        >
          {monthLabels.map((m) => (
            <text key={m.i} x={30 + m.i * (cell + gap)} y={10} fontSize={10.5} fill="var(--fg-3)">
              {m.label}
            </text>
          ))}
          {['Mon', 'Wed', 'Fri'].map((d, i) => (
            <text key={d} x={0} y={22 + i * 2 * (cell + gap) + cell - 2} fontSize={10} fill="var(--fg-3)">
              {d}
            </text>
          ))}
          {weeks.map((w, wi) =>
            w.map((date, di) => {
              if (date > today) return null;
              const n = counts.get(date) ?? 0;
              return (
                <rect
                  key={date}
                  x={30 + wi * (cell + gap)}
                  y={18 + di * (cell + gap)}
                  width={cell}
                  height={cell}
                  rx={3}
                  fill={`var(--viz-seq-${level(n)})`}
                  stroke={date === today ? 'var(--fg-2)' : 'none'}
                  strokeWidth={date === today ? 1.5 : 0}
                  onMouseEnter={() => setHover({ date, count: n })}
                  onMouseLeave={() => setHover(null)}
                >
                  <title>{`${plural(n, 'task')} · ${format(fromKey(date), 'EEE d MMM')}`}</title>
                </rect>
              );
            }),
          )}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-fg-3">
        <span className="tabular-nums">
          {hover ? `${plural(hover.count, 'task')} on ${format(fromKey(hover.date), 'EEEE d MMMM')}` : 'Hover a day for details'}
        </span>
        <span className="flex items-center gap-1">
          Less
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className="size-[11px] rounded-[3px]" style={{ background: `var(--viz-seq-${l})` }} />
          ))}
          More
        </span>
      </div>
    </ChartCard>
  );
}

/* ------------------------------------------------------------------ */
/* weekly throughput                                                   */
/* ------------------------------------------------------------------ */

function WeeklyCard({ data }) {
  const rows = data.weekly.map((w) => ({ ...w, label: format(fromKey(w.weekStart), 'd MMM') }));
  const thisWeek = data.weekly[data.weekly.length - 1];
  return (
    <ChartCard
      title="Planned vs done, by week"
      subtitle={`This week: ${thisWeek.done} of ${thisWeek.planned} planned tasks done so far`}
      legend={[
        { label: 'Planned', color: 'var(--viz-2)' },
        { label: 'Done', color: 'var(--viz-1)' },
      ]}
      table={{ head: ['Week of', 'Planned', 'Done'], rows: rows.map((r) => [r.label, r.planned, r.done]) }}
    >
      <div className="h-[230px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
            <XAxis
              dataKey="label"
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: 'var(--viz-grid)' }}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={40} />
            <Tooltip
              cursor={{ fill: 'var(--surface-3)', opacity: 0.6 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={`Week of ${label}`}
                    rows={[
                      { label: 'Planned', value: String(payload[0]?.payload.planned), color: 'var(--viz-2)' },
                      { label: 'Done', value: String(payload[0]?.payload.done), color: 'var(--viz-1)' },
                    ]}
                  />
                ) : null
              }
            />
            <Bar dataKey="planned" fill="var(--viz-2)" radius={[4, 4, 0, 0]} maxBarSize={12} isAnimationActive={false} />
            <Bar dataKey="done" fill="var(--viz-1)" radius={[4, 4, 0, 0]} maxBarSize={12} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

/* ------------------------------------------------------------------ */
/* mood and output (two aligned charts, one axis each)                 */
/* ------------------------------------------------------------------ */

function MoodCard({ data }) {
  const rows = data.mood.map((d) => ({ ...d, label: format(fromKey(d.date), 'd MMM') }));
  const logged = rows.filter((r) => r.mood !== null);
  const good = logged.filter((r) => (r.mood ?? 0) >= 4);
  const low = logged.filter((r) => (r.mood ?? 0) <= 2);
  const avg = (list) => (list.length ? list.reduce((s, r) => s + r.done, 0) / list.length : null);
  const aGood = avg(good);
  const aLow = avg(low);
  const insight =
    aGood !== null && aLow !== null
      ? `On good days you finished ${aGood.toFixed(1)} tasks on average; on low days, ${aLow.toFixed(1)}.`
      : logged.length
        ? `${plural(logged.length, 'day')} with a mood logged in the last 30 days.`
        : 'Log a mood in your journal to see how it relates to your output.';

  const tooltip = ({ active, payload }) => {
    const r = payload?.[0]?.payload;
    if (!active || !r) return null;
    return (
      <TooltipBox
        title={format(fromKey(r.date), 'EEE d MMM')}
        rows={[
          { label: 'Mood', value: r.mood ? MOODS[Math.round(r.mood) - 1].label : '—', color: 'var(--viz-2)' },
          { label: 'Tasks done', value: String(r.done), color: 'var(--viz-1)' },
        ]}
      />
    );
  };

  return (
    <ChartCard
      title="Mood and output"
      subtitle={insight}
      table={{
        head: ['Date', 'Mood', 'Tasks done'],
        rows: rows.map((r) => [r.label, r.mood ? MOODS[Math.round(r.mood) - 1].label : '—', r.done]),
      }}
    >
      <p className="mb-1 text-[11.5px] font-medium text-fg-3">Mood (from journal)</p>
      <div className="h-[116px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} syncId="mood" margin={{ top: 8, right: 8, bottom: 8, left: -18 }}>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
            <XAxis dataKey="label" hide />
            <YAxis
              domain={[1, 5]}
              ticks={[1, 3, 5]}
              interval={0}
              tickFormatter={(v) => MOODS[v - 1]?.label ?? ''}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={58}
            />
            <Tooltip content={tooltip} cursor={{ stroke: 'var(--line-strong)' }} />
            <Line
              dataKey="mood"
              stroke="var(--viz-2)"
              strokeWidth={2}
              connectNulls
              dot={{ r: 4, fill: 'var(--viz-2)', stroke: 'var(--surface)', strokeWidth: 2 }}
              activeDot={{ r: 5, fill: 'var(--viz-2)', stroke: 'var(--surface)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 mb-1 text-[11.5px] font-medium text-fg-3">Tasks done</p>
      <div className="h-[104px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} syncId="mood" margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--viz-grid)' }} interval={6} />
            <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={58} />
            <Tooltip content={tooltip} cursor={{ fill: 'var(--surface-3)', opacity: 0.6 }} />
            <Bar dataKey="done" fill="var(--viz-1)" radius={[3, 3, 0, 0]} maxBarSize={8} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

/* ------------------------------------------------------------------ */
/* when work gets done                                                 */
/* ------------------------------------------------------------------ */

function WhenCard({ data }) {
  const weekdayRows = WEEKDAYS.map((d, i) => ({ label: d, n: data.weekdays[i] }));
  const bestDay = weekdayRows.reduce((a, b) => (b.n > a.n ? b : a), weekdayRows[0]);
  const hourRows = data.hours.map((n, h) => ({ label: `${h}`, n }));
  // Best 3-hour window
  let bestStart = 0;
  let bestSum = -1;
  for (let h = 0; h < 24; h++) {
    const s = data.hours[h] + data.hours[(h + 1) % 24] + data.hours[(h + 2) % 24];
    if (s > bestSum) {
      bestSum = s;
      bestStart = h;
    }
  }
  const total = data.hours.reduce((a, b) => a + b, 0);
  const hourName = (h) => format(new Date(2000, 0, 1, h % 24), 'h a');
  const summary = total
    ? `Most done on ${format(new Date(2024, 0, 1 + WEEKDAYS.indexOf(bestDay.label)), 'EEEE')}s, and between ${hourName(bestStart)} and ${hourName(bestStart + 3)}.`
    : 'Complete a few tasks to see your patterns.';

  const tip = (unit) =>
    function T({ active, payload }) {
      const r = payload?.[0]?.payload;
      if (!active || !r) return null;
      return <TooltipBox title={unit(r.label)} rows={[{ label: 'Tasks done', value: String(r.n), color: 'var(--viz-1)' }]} />;
    };

  return (
    <ChartCard
      title="When you get things done"
      subtitle={`${summary} Last 90 days.`}
      table={{
        head: ['When', 'Tasks done'],
        rows: [...weekdayRows.map((r) => [r.label, r.n]), ...hourRows.map((r) => [hourName(Number(r.label)), r.n])],
      }}
    >
      <p className="mb-1 text-[11.5px] font-medium text-fg-3">By day of week</p>
      <div className="h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weekdayRows} margin={{ top: 14, right: 4, bottom: 0, left: -18 }}>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--viz-grid)' }} />
            <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={40} />
            <Tooltip content={tip((l) => l)} cursor={{ fill: 'var(--surface-3)', opacity: 0.6 }} />
            <Bar
              dataKey="n"
              fill="var(--viz-1)"
              radius={[4, 4, 0, 0]}
              maxBarSize={22}
              isAnimationActive={false}
              label={({ x, y, width, value, index }) =>
                index !== undefined && weekdayRows[index].label === bestDay.label && total ? (
                  <text x={Number(x) + Number(width) / 2} y={Number(y) - 4} textAnchor="middle" fontSize={11} fill="var(--fg-2)">
                    {String(value)}
                  </text>
                ) : (
                  <g />
                )
              }
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 mb-1 text-[11.5px] font-medium text-fg-3">By hour of day</p>
      <div className="h-[110px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={hourRows} barCategoryGap={2} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
            <XAxis
              dataKey="label"
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: 'var(--viz-grid)' }}
              ticks={['0', '6', '12', '18', '23']}
              tickFormatter={(v) => hourName(Number(v))}
            />
            <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={40} />
            <Tooltip
              content={tip((l) => `${hourName(Number(l))} – ${hourName(Number(l) + 1)}`)}
              cursor={{ fill: 'var(--surface-3)', opacity: 0.6 }}
            />
            <Bar dataKey="n" fill="var(--viz-1)" radius={[3, 3, 0, 0]} maxBarSize={10} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

/* ------------------------------------------------------------------ */
/* goals vs plan                                                       */
/* ------------------------------------------------------------------ */

function GoalsCard({ data }) {
  return (
    <ChartCard
      title="Goals against their plan"
      subtitle="The tick marks where the plan says you should be today."
      table={{
        head: ['Goal', 'Done', 'Total', 'Due by today'],
        rows: data.goals.map((g) => [g.title, g.done, g.total, g.expected ?? '—']),
      }}
    >
      {data.goals.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-fg-3">No active goals.</p>
      ) : (
        <div className="space-y-4">
          {data.goals.map((g) => {
            const behind = g.expected !== null ? g.expected - g.done : 0;
            return (
              <Link key={g.id} to={`/app/goals/${g.id}`} className="block rounded-lg p-1 -m-1 hover:bg-surface-2">
                <div className="mb-1.5 flex items-center gap-2 text-[13px]">
                  <GoalDot color={g.color} size={8} />
                  <span className="min-w-0 flex-1 truncate font-medium">{g.title}</span>
                  <span className="text-[12px] text-fg-3 tabular-nums">
                    {g.done}/{g.total}
                  </span>
                </div>
                <ProgressBar
                  value={g.total ? g.done / g.total : 0}
                  color={goalColor(g.color)}
                  marker={g.expected !== null && g.total ? g.expected / g.total : null}
                  className="h-2"
                />
                <p className="mt-1 text-[11.5px] text-fg-3">
                  {g.expected === null
                    ? 'No dated tasks'
                    : behind > 0
                      ? `${plural(behind, 'task')} behind plan`
                      : behind < 0
                        ? `${plural(-behind, 'task')} ahead of plan`
                        : 'Exactly on plan'}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </ChartCard>
  );
}

/* ------------------------------------------------------------------ */
/* AI weekly review                                                    */
/* ------------------------------------------------------------------ */

function ReviewCard() {
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      setReview(await api.post('/ai/weekly-review', { today: todayKey(), tzOffset: tzOffset() }));
    } catch (e) {
      setError({ setup: e instanceof ApiError && e.isAiSetup, message: errorMessage(e) });
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!review) return;
    setSaving(true);
    const t = (text) => [{ type: 'text', text, styles: {} }];
    const section = (heading, items) =>
      items.length
        ? [
            { type: 'heading', props: { level: 3 }, content: t(heading) },
            ...items.map((i) => ({ type: 'bulletListItem', content: t(i) })),
          ]
        : [];
    const content = [
      { type: 'paragraph', content: t(review.summary) },
      ...section('Wins', review.wins),
      ...section('What got in the way', review.blockers),
      ...section('Patterns', review.patterns),
      ...section('Next week', review.nextWeek),
    ];
    try {
      const today = todayKey();
      const page = await api.post('/pages', {
        kind: 'review',
        title: `Weekly review · ${shortDate(addDays(today, -6))} – ${shortDate(today)}`,
        icon: 'sparkles',
        entryDate: today,
        tags: ['review'],
        content,
      });
      invalidatePages(qc);
      toast.success('Saved to your journal', { action: { label: 'Open', onClick: () => navigate(`/app/journal/${page.id}`) } });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[14px] font-semibold tracking-tight">
            <Sparkles className="size-4 text-accent" /> Weekly review
          </h2>
          <p className="mt-0.5 text-[12.5px] text-fg-3">
            Gemini reads the last 7 days of tasks and journal entries and writes an honest review.
          </p>
        </div>
        <div className="flex gap-2">
          {review && (
            <Button size="sm" onClick={save} loading={saving}>
              <BookmarkPlus className="size-3.5" /> Save to journal
            </Button>
          )}
          <Button size="sm" variant={review ? 'ghost' : 'primary'} onClick={generate} loading={loading}>
            {review ? 'Regenerate' : 'Review my week'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          {error.setup ? <AiSetupNotice message={error.message} /> : <p className="text-[13px] text-danger">{error.message}</p>}
        </div>
      )}

      {loading && !review && (
        <div className="mt-5 space-y-2.5">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      )}

      {review && (
        <div className={cn('mt-5 animate-fade-in', loading && 'opacity-50')}>
          <p className="text-[17px] font-semibold tracking-[-0.015em]">{review.headline}</p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-2">{review.summary}</p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <ReviewList title="Wins" items={review.wins} />
            <ReviewList title="What got in the way" items={review.blockers} />
            <ReviewList title="Patterns" items={review.patterns} />
            <ReviewList title="Next week" items={review.nextWeek} />
          </div>
        </div>
      )}
    </section>
  );
}

function ReviewList({ title, items }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="mb-1.5 text-[12px] font-semibold tracking-wide text-fg-3 uppercase">{title}</h3>
      <ul className="space-y-1.5 text-[13px]">
        {items.map((i, k) => (
          <li key={k} className="flex gap-2">
            <span className="mt-[7px] size-1 shrink-0 rounded-full bg-fg-3" />
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecentCard({ data }) {
  return (
    <section className="card p-5">
      <h2 className="mb-3 text-[14px] font-semibold tracking-tight">Recent activity</h2>
      {data.recent.length === 0 ? (
        <p className="text-[13px] text-fg-3">Nothing yet.</p>
      ) : (
        <ol className="space-y-3">
          {data.recent.map((a) => (
            <li key={a.id} className="flex gap-2.5 text-[13px]">
              <span
                className={cn(
                  'mt-[7px] size-1.5 shrink-0 rounded-full',
                  a.type === 'task.completed' ? 'bg-success' : a.type === 'goal.completed' ? 'bg-accent' : 'bg-fg-3',
                )}
              />
              <span className="min-w-0">
                <span className="block leading-snug">{a.label}</span>
                <span className="block text-[11.5px] text-fg-3">{relativeTime(a.createdAt)}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
