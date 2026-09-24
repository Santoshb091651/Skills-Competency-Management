'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/**
 * Chart components. These are the only client components in the app — every
 * page is otherwise server-rendered, and the data arrives here already
 * aggregated by src/lib/services/trends.ts.
 */

const SERIES_COLOURS = [
  '#1f4e8c',
  '#00968b',
  '#d97a0b',
  '#b32d3f',
  '#6b4fa0',
  '#2f7d32',
  '#0b7285',
  '#a6761d',
];

// Level 0 reads as absence, so it is grey; the rest warm as proficiency rises.
const LEVEL_COLOURS = ['#c3cbd6', '#9db8d6', '#6fa3cf', '#3f8f86', '#2f7d4f', '#d99a2b'];

const AXIS = { stroke: '#8b97a8', fontSize: 11 };
const GRID = '#e4ecf6';

function TooltipBox({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-[var(--color-line)] bg-white px-3 py-2 text-xs shadow-sm">
      <div className="mb-1 font-semibold text-[var(--color-primary-dark)]">{label}</div>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: entry.color }}
            aria-hidden
          />
          <span className="text-[var(--color-muted)]">{entry.name}</span>
          <span className="ml-auto font-semibold">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export function AverageRatingTrend({
  data,
}: {
  data: Array<{ period: string; avgRating: number; skillsHeld: number }>;
}) {
  if (data.length === 0) return <NoData />;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="avgFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1f4e8c" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#1f4e8c" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="period" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        {/* Fixed 0-5 domain: an auto-scaled axis makes a 0.1 drift look like a collapse. */}
        <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={AXIS} tickLine={false} axisLine={false} />
        <Tooltip content={<TooltipBox />} />
        <Area
          type="monotone"
          dataKey="avgRating"
          name="Average rating"
          stroke="#1f4e8c"
          strokeWidth={2}
          fill="url(#avgFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SkillsHeldTrend({
  data,
}: {
  data: Array<{ period: string; skillsHeld: number; employees: number }>;
}) {
  if (data.length === 0) return <NoData />;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="period" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip content={<TooltipBox />} />
        <Bar dataKey="skillsHeld" name="Skills held" fill="#00968b" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CategoryTrend({
  data,
  categories,
}: {
  data: Array<Record<string, string | number>>;
  categories: string[];
}) {
  if (data.length === 0) return <NoData />;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="period" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={AXIS} tickLine={false} axisLine={false} />
        <Tooltip content={<TooltipBox />} />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        {categories.map((category, index) => (
          <Line
            key={category}
            type="monotone"
            dataKey={category}
            stroke={SERIES_COLOURS[index % SERIES_COLOURS.length]}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DistributionTrend({
  data,
  levelLabels,
}: {
  data: Array<Record<string, string | number>>;
  levelLabels: Record<number, string>;
}) {
  if (data.length === 0) return <NoData />;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="period" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip content={<TooltipBox />} />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        {[0, 1, 2, 3, 4, 5].map((level) => (
          <Bar
            key={level}
            dataKey={`level${level}`}
            // The numeral is in the name, so the series is identifiable without
            // relying on colour (NFR-09).
            name={`${level} — ${levelLabels[level] ?? ''}`}
            stackId="levels"
            fill={LEVEL_COLOURS[level]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SkillStepTrend({
  data,
  skills,
}: {
  data: Array<Record<string, string | number>>;
  skills: string[];
}) {
  if (data.length === 0 || skills.length === 0) return <NoData />;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="period" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={AXIS} tickLine={false} axisLine={false} />
        <Tooltip content={<TooltipBox />} />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        {skills.map((skill, index) => (
          <Line
            key={skill}
            // A step, not a curve: the rating held this value until the next
            // assessment. Interpolating would imply measurements never taken.
            type="stepAfter"
            dataKey={skill}
            stroke={SERIES_COLOURS[index % SERIES_COLOURS.length]}
            strokeWidth={2}
            dot={{ r: 2 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function NoData() {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-[var(--color-muted)]">
      Not enough history to plot yet.
    </div>
  );
}
