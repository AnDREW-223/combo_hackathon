import { motion } from 'motion/react'
import { useState } from 'react'
import { BRANDS, CLUSTERS, MEMBERS } from '../data'
import { useStore } from '../store'
import { Card, Pill, Stat, Title, ease } from '../ui'

export default function ManagerView() {
  const { suggestions, logs } = useStore()
  const [cl, setCl] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const f = [
    ['AI 建議產生', suggestions.length],
    ['人員核可', suggestions.filter((s) => s.status !== 'pending').length],
    ['LINE 推送', suggestions.filter((s) => s.status === 'sent' || s.status === 'booked').length],
    ['會員預約', suggestions.filter((s) => s.status === 'booked').length],
  ] as const
  const max = Math.max(...f.map((x) => x[1]), 1)
  const overlap = [
    ['泰晶殿 ∩ 美加', 2, '#a8294f'],
    ['泰晶殿 ∩ 康博', 2, '#1f78c1'],
    ['三品牌', 1, '#2a7f86'],
    ['單一品牌', 3, '#8aa3a8'],
  ] as const
  const staff = [['林師傅', 'tai', 22], ['陳顧問', 'mei', 27], ['王護理師', 'kang', 31]] as const

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="flex items-center gap-2 rounded-xl bg-[#fdf6e3] px-4 py-2.5 text-xs font-semibold text-[#7a5a10]"><Pill tone="amber">假設</Pill>以下圖表皆為示意數據,串接真實資料前請勿作為決策依據。</div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="今日登記" value={logs.length + 37} unit="筆" tone="#e6f0f8" hint="示意" />
        <Stat label="待審建議" value={suggestions.filter((s) => s.status === 'pending').length} unit="則" tone="#fdf0e6" delay={0.05} />
        <Stat label="跨品牌重疊率" value={33} unit="%" tone="#fdf6e3" delay={0.1} hint="6 位會員中 3 位(假設)" />
        <Stat label="平均登記秒數" value={Math.round(logs.length ? logs.reduce((a, l) => a + l.secs, 0) / logs.length : 26)} unit="秒" tone="#f1ecf5" delay={0.15} hint="目標 ≤ 30 秒" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card delay={0.1}>
          <Title>推薦漏斗:審核 → 推送 → 預約</Title>
          <div className="space-y-3">
            {f.map(([l, v], i) => (
              <div key={l} className="flex items-center gap-3">
                <span className="w-24 text-sm text-ink-soft">{l}</span>
                <div className="h-9 flex-1 rounded-lg bg-canvas">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max((v / max) * 100, 6)}%` }} transition={{ delay: 0.2 + i * 0.12, duration: 0.9, ease }} className="flex h-full items-center justify-end rounded-lg bg-brand pr-3" style={{ opacity: 1 - i * 0.18 }}>
                    <span className="num text-sm font-bold text-white">{v}</span>
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card delay={0.15}>
          <Title>各品牌重疊顧客</Title>
          <div className="space-y-3">
            {overlap.map(([l, v, c], i) => (
              <div key={l} className="flex items-center gap-3">
                <span className="w-28 text-sm text-ink-soft">{l}</span>
                <div className="flex flex-1 gap-1">
                  {Array.from({ length: v }).map((_, k) => (
                    <motion.span key={k} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 + i * 0.1 + k * 0.08, type: 'spring' }} className="grid size-9 place-items-center rounded-full text-xs font-bold text-white" style={{ background: c }}>人</motion.span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-ink-soft">資料孤島:單一品牌顧客占多數,需靠群集補足冷啟動推薦。</p>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card delay={0.2}>
          <Title right={cl && <button onClick={() => setCl(null)} className="text-xs font-bold text-brand">清除篩選</button>}>會員群集(冷啟動補足)</Title>
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-teal-50">
            <svg viewBox="0 0 100 56" className="absolute inset-0 size-full">
              {[20, 40, 60, 80].map((x) => <line key={x} x1={x} y1="0" x2={x} y2="56" stroke="#d5e0e4" strokeWidth="0.2" />)}
              {[14, 28, 42].map((y) => <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#d5e0e4" strokeWidth="0.2" />)}
              {Object.entries(CLUSTERS).map(([k, c]) => (
                <g key={k} onClick={() => setCl(cl === k ? null : k)} className="cursor-pointer" opacity={cl && cl !== k ? 0.25 : 1}>
                  <motion.circle cx={c.x} cy={c.y * 0.56} r="9" fill={c.color} fillOpacity="0.14" stroke={c.color} strokeWidth="0.3" className="dash-flow" initial={{ r: 0 }} animate={{ r: 9 }} transition={{ duration: 0.8, ease }} />
                  <text x={c.x} y={c.y * 0.56 - 11} textAnchor="middle" fontSize="2.6" fontWeight="700" fill={c.color}>{k}・{c.name}</text>
                  {MEMBERS.filter((m) => m.cluster === k).map((m, i) => (
                    <motion.circle key={m.id} cx={c.x + (i % 2 ? 3.5 : -3.5)} cy={c.y * 0.56 + (i < 2 ? -1 : 3)} r={hover === m.id ? 2.4 : 1.7} fill={c.color} onMouseEnter={() => setHover(m.id)} onMouseLeave={() => setHover(null)} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5 + i * 0.1 }} />
                  ))}
                </g>
              ))}
            </svg>
            <div className="absolute bottom-2 left-3 text-[10px] text-ink-soft">橫軸:跨品牌深度 → · 縱軸:週期活躍度 ↑(示意)</div>
            {hover && <div className="absolute right-3 top-3 rounded-lg bg-white px-3 py-1.5 text-xs font-bold shadow">{MEMBERS.find((m) => m.id === hover)?.name}</div>}
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {Object.entries(CLUSTERS).map(([k, c]) => (
              <button key={k} onClick={() => setCl(cl === k ? null : k)} className={`rounded-xl p-3 text-left text-sm ring-2 transition ${cl === k ? 'ring-brand' : 'ring-transparent'}`} style={{ background: c.color + '14' }}>
                <b style={{ color: c.color }}>{k}・{c.name}</b>
                <div className="text-xs text-ink-soft">{c.desc} · {MEMBERS.filter((m) => m.cluster === k).length} 位</div>
              </button>
            ))}
          </div>
        </Card>

        <Card delay={0.25}>
          <Title>人員登記效率</Title>
          {staff.map(([n, b, s], i) => (
            <div key={n} className="mb-4">
              <div className="mb-1 flex justify-between text-sm"><span className="font-bold">{n} <span className="text-xs font-normal text-ink-soft">{BRANDS[b].name}</span></span><span className="num font-semibold">{s} 秒</span></div>
              <div className="h-2.5 overflow-hidden rounded-full bg-canvas"><motion.div initial={{ width: 0 }} animate={{ width: `${(s / 40) * 100}%` }} transition={{ delay: 0.3 + i * 0.1, duration: 0.9, ease }} className="h-full rounded-full" style={{ background: s > 30 ? '#d98a1c' : BRANDS[b].color }} /></div>
            </div>
          ))}
          <div className="relative -mt-1 text-right text-[11px] text-ink-soft">目標線 30 秒 · 數值為示意(假設)</div>
          <div className="mt-5 rounded-xl bg-teal-50 p-4 text-sm"><b className="text-brand">店長提醒</b><p className="mt-1 text-ink-soft">店長可檢視跨品牌需求摘要,但診所特種個資需另行授權。</p></div>
        </Card>
      </div>
    </div>
  )
}
