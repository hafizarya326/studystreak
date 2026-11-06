import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { chartColors, useIsDark } from '../../hooks/useIsDark'
import { formatDuration } from '../../lib/date'

interface TipPayload {
  name?: string
  value?: number
  payload?: Record<string, unknown>
  color?: string
}

function TooltipBox({
  active,
  payload,
  label,
  mode = 'duration',
  isDark,
}: {
  active?: boolean
  payload?: TipPayload[]
  label?: string
  mode?: 'duration' | 'sessions' | 'hours'
  isDark: boolean
}) {
  if (!active || !payload || payload.length === 0) return null
  const c = chartColors(isDark)
  const raw = payload[0]?.value ?? 0
  const value =
    mode === 'sessions' ? `${raw} session${raw === 1 ? '' : 's'}` : formatDuration(raw)
  return (
    <div
      className="rounded-xl border px-3 py-2 text-xs shadow-lift"
      style={{ background: c.tooltipBg, borderColor: c.tooltipBorder, color: c.text }}
    >
      {label ? <p className="mb-0.5 font-semibold">{label}</p> : null}
      <p style={{ color: c.sage }} className="font-medium">
        {value}
      </p>
    </div>
  )
}

export function WeeklyChart({ data }: { data: Array<{ label: string; sec: number; sessions: number }> }) {
  const isDark = useIsDark()
  const c = chartColors(isDark)
  const hasData = data.some((d) => d.sec > 0)

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -18 }} barCategoryGap="28%">
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: c.axis, fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fill: c.axis, fontSize: 11 }}
            tickFormatter={(v: number) => (v >= 3600 ? `${(v / 3600).toFixed(1)}h` : `${Math.round(v / 60)}m`)}
          />
          <Tooltip cursor={{ fill: c.sageSoft }} content={<TooltipBox isDark={isDark} />} />
          <Bar dataKey="sec" fill={c.sage} radius={[8, 8, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
      {!hasData ? (
        <p className="-mt-32 text-center text-xs text-muted">No study time logged yet this week.</p>
      ) : null}
    </div>
  )
}

export function TrendChart({ data }: { data: Array<{ label: string; sec: number }> }) {
  const isDark = useIsDark()
  const c = chartColors(isDark)
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.sage} stopOpacity={0.35} />
              <stop offset="100%" stopColor={c.sage} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tick={{ fill: c.axis, fontSize: 11 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fill: c.axis, fontSize: 11 }}
            tickFormatter={(v: number) => (v >= 3600 ? `${(v / 3600).toFixed(1)}h` : `${Math.round(v / 60)}m`)}
          />
          <Tooltip content={<TooltipBox isDark={isDark} />} />
          <Area
            type="monotone"
            dataKey="sec"
            stroke={c.sage}
            strokeWidth={2.5}
            fill="url(#trendFill)"
            dot={false}
            activeDot={{ r: 4, fill: c.sage, stroke: c.tooltipBg, strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MonthlyChart({ data }: { data: Array<{ label: string; hours: number }> }) {
  const isDark = useIsDark()
  const c = chartColors(isDark)
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -22 }} barCategoryGap="30%">
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: c.axis, fontSize: 12 }} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            tick={{ fill: c.axis, fontSize: 11 }}
            tickFormatter={(v: number) => `${v}h`}
          />
          <Tooltip cursor={{ fill: c.sageSoft }} content={<TooltipBox isDark={isDark} mode="hours" />} />
          <Bar dataKey="hours" fill={c.sage} radius={[8, 8, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

const PIE_COLORS_LIGHT = ['#8FA995', '#A9BFAE', '#C6D5C9', '#F2B08A', '#F28C5B']

export function SubjectChart({ data }: { data: Array<{ name: string; sec: number }> }) {
  const isDark = useIsDark()
  const colors = isDark ? ['#92AC98', '#A9BFAE', '#7E9A85', '#F4986A', '#E4A07C'] : PIE_COLORS_LIGHT
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="sec"
            nameKey="name"
            innerRadius="58%"
            outerRadius="88%"
            paddingAngle={3}
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={<TooltipBox isDark={isDark} />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
