import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { BRANDS, type BrandId } from './data'

export const ease = [0.22, 1, 0.36, 1] as const

export function Card({
  children,
  className = '',
  delay = 0,
  hover = false,
}: {
  children: ReactNode
  className?: string
  delay?: number
  hover?: boolean
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease }}
      whileHover={hover ? { y: -3, boxShadow: '0 14px 30px -14px rgba(29,93,102,.35)' } : undefined}
      className={`rounded-2xl bg-white p-5 shadow-[0_1px_0_rgba(29,93,102,.05)] ${className}`}
    >
      {children}
    </motion.section>
  )
}

export function Title({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="title-bar text-[1.05rem] font-bold text-brand">{children}</h2>
      {right}
    </div>
  )
}

export function Pill({ children, tone = 'gray' }: { children: ReactNode; tone?: 'gray' | 'crimson' | 'blue' | 'teal' | 'amber' | 'violet' }) {
  const m = {
    gray: 'bg-[#e9eef0] text-ink-soft',
    crimson: 'bg-crimson text-white',
    blue: 'bg-clinic text-white',
    teal: 'bg-teal-700 text-white',
    amber: 'bg-[#f5e2b8] text-[#7a5a10]',
    violet: 'bg-lavender text-[#5e4686]',
  }[tone]
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${m}`}>{children}</span>
}

export function BrandTag({ id, small }: { id: BrandId; small?: boolean }) {
  const b = BRANDS[id]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${small ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'}`}
      style={{ background: b.soft, color: b.deep }}
    >
      <i className="size-1.5 rounded-full" style={{ background: b.color }} />
      {b.name}
    </span>
  )
}

export function Avatar({ text, size = 40, color }: { text: string; size?: number; color?: string }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4, background: color ?? 'var(--brand)' }}
    >
      {text}
    </span>
  )
}

export function CountUp({ to, className = '', suffix = '' }: { to: number; className?: string; suffix?: string }) {
  const mv = useMotionValue(0)
  const txt = useTransform(mv, (v) => Math.round(v).toString() + suffix)
  useEffect(() => {
    const c = animate(mv, to, { duration: 1.1, ease })
    return () => c.stop()
  }, [to, mv])
  return <motion.span className={className}>{txt}</motion.span>
}

export function Stat({ label, value, unit, tone, hint, delay = 0 }: { label: string; value: number; unit?: string; tone: string; hint?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.5, ease }}
      whileHover={{ y: -4 }}
      className="rounded-xl p-3.5"
      style={{ background: tone }}
    >
      <div className="text-xs font-medium text-ink-soft">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <CountUp to={value} className="num text-3xl font-semibold text-ink" />
        {unit && <span className="text-xs text-ink-soft">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-[10px] text-ink-soft/80">{hint}</div>}
    </motion.div>
  )
}

export function Radar({ values, dashed, color = 'var(--brand)' }: { values: number[]; dashed?: boolean[]; color?: string }) {
  const labels = ['消費週期', '疲勞部位', '保養歷程', '代謝風險']
  const c = 110
  const r = 74
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / 4 - Math.PI / 2
    return [c + Math.cos(a) * r * v, c + Math.sin(a) * r * v] as const
  }
  const poly = values.map((v, i) => pt(i, Math.max(v, 4) / 100).join(',')).join(' ')
  return (
    <svg viewBox="0 0 220 220" className="w-full max-w-[250px]">
      {[0.25, 0.5, 0.75, 1].map((s) => (
        <polygon key={s} points={[0, 1, 2, 3].map((i) => pt(i, s).join(',')).join(' ')} fill="none" stroke="#d5e0e4" />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1={c} y1={c} x2={pt(i, 1)[0]} y2={pt(i, 1)[1]} stroke="#d5e0e4" />
      ))}
      <motion.polygon
        key={poly}
        points={poly}
        fill={color}
        fillOpacity={0.2}
        stroke={color}
        strokeWidth={2.2}
        strokeLinejoin="round"
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ transformOrigin: '110px 110px' }}
        transition={{ duration: 0.8, ease }}
      />
      {values.map((v, i) => {
        const [x, y] = pt(i, Math.max(v, 4) / 100)
        return <circle key={i} cx={x} cy={y} r={4} fill="#fff" stroke={color} strokeWidth={2} strokeDasharray={dashed?.[i] ? '2 2' : undefined} />
      })}
      {labels.map((l, i) => {
        const [x, y] = pt(i, 1.28)
        return (
          <text key={l} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="10.5" fill="#5b7377" fontWeight={600}>
            {l}
          </text>
        )
      })}
    </svg>
  )
}

export function Bubble({ text, from }: { text: string; from: string }) {
  return (
    <div className="rounded-3xl bg-[#c9dde0] p-3">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-teal-900">
        <span className="grid size-5 place-items-center rounded-full bg-[#06c755] text-[9px] font-black text-white">L</span>
        康博集團
      </div>
      <motion.div
        key={text}
        initial={{ opacity: 0, y: 8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="rounded-2xl rounded-tl-sm bg-white p-3 text-[13px] leading-relaxed text-ink"
      >
        {text || '(尚無內容)'}
      </motion.div>
      <div className="mt-2 text-[10px] text-teal-900/70">回覆「退訂」即可隨時停止接收 · 預約請點下方按鈕</div>
    </div>
  )
}
