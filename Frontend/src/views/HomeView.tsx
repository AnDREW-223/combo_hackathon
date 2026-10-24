import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpRight, ChevronLeft, ChevronRight, Link2, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BRANDS, MEMBERS } from '../data'
import { useStore } from '../store'
import { BrandTag, Card, Pill, Stat, Title, ease } from '../ui'

const DAYS = ['一', '二', '三', '四', '五', '六', '日']
const TONES = ['#e6f0f8', '#eaf1f2', '#fdf0e6', '#eeeeee', '#fdf6e3', '#f1ecf5', '#eeeeee']

export default function HomeView() {
  const { persona, appts, go, setOpenMember, suggestions, logs, toast, addAudit } = useStore()
  const [day, setDay] = useState(2)
  const [now, setNow] = useState(new Date())
  const [onDuty, setOnDuty] = useState<Date | null>(null)
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const pending = suggestions.filter((s) => s.status === 'pending').length
  const booked = suggestions.filter((s) => s.status === 'booked').length
  const sent = suggestions.filter((s) => s.status === 'sent' || s.status === 'booked').length
  const hq = persona.brand === 'hq'
  const list = day === 2 ? appts : appts.slice(0, Math.max(1, (day + 1) % 4))
  const next = appts[0]
  const dur = onDuty ? Math.floor((now.getTime() - onDuty.getTime()) / 1000) : 0
  const fmt = (s: number) => [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':')

  return (
    <div className="mx-auto grid max-w-[1500px] gap-5 xl:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="bg-aqua relative overflow-hidden rounded-3xl p-6 text-white md:p-8"
        >
          <div className="pointer-events-none absolute -right-16 -top-16 size-72 rounded-full bg-white/10 float-slow" />
          <div className="pointer-events-none absolute -bottom-24 right-40 size-60 rounded-full bg-white/10 float-slow [animation-delay:2s]" />
          <div className="relative grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-end">
            <div>
              <div className="text-sm text-teal-100">午安,{persona.name}</div>
              <h1 className="mt-1 text-3xl font-black leading-tight md:text-4xl">
                {persona.brand === 'tai' && '今天，記下顧客的身體訊號'}
                {persona.brand === 'mei' && '今天，看見顧客的保養節奏'}
                {persona.brand === 'kang' && '今天，陪顧客走完健康管理'}
                {hq && '今天，集團服務脈絡一覽'}
              </h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-teal-50">
                {persona.brand === 'tai' ? '只登記「觀察」,不做診斷;現場 30 秒內完成。' : persona.brand === 'kang' ? '特種個資分級授權,每次檢視皆留下稽核紀錄。' : '跨品牌需求摘要已整合,AI 建議須審核後才會推送。'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(persona.brand === 'hq' ? ['全品牌', '審核權限', '成效追蹤', '合規稽核'] : BRANDS[persona.brand].focus).map((f) => (
                  <span key={f} className="glass rounded-full px-3 py-1 text-xs font-semibold">{f}</span>
                ))}
              </div>
              <div className="mt-5 flex gap-3">
                <motion.button whileTap={{ scale: 0.95 }} whileHover={{ y: -2 }} onClick={() => go('log')} className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-teal-900 shadow-lg">
                  開始快速登記
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} whileHover={{ y: -2 }} onClick={() => go('ai')} className="glass rounded-xl px-5 py-3 text-sm font-bold">
                  審核 AI 建議 · {pending}
                </motion.button>
              </div>
            </div>
            {next && (
              <div className="relative">
                <div className="absolute inset-x-5 -top-3 h-full rounded-2xl bg-white/40" />
                <div className="absolute inset-x-2.5 -top-1.5 h-full rounded-2xl bg-white/60" />
                <div className="relative rounded-2xl bg-white p-4 text-ink shadow-xl">
                  <div className="text-[11px] font-semibold text-ink-soft">下一位 · {next.time}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="text-lg font-bold">{next.member}</div>
                    <button onClick={() => { const m = MEMBERS.find((m) => m.name === next.member); if (m) { go('members'); setTimeout(() => setOpenMember(m.id), 50) } }} className="grid size-8 place-items-center rounded-full bg-teal-50 text-brand">
                      <ArrowUpRight className="size-4" />
                    </button>
                  </div>
                  <div className="mt-1 text-sm text-ink-soft">{next.svc}</div>
                  {next.note && <div className="mt-2 rounded-lg bg-brand-soft px-3 py-1.5 text-xs font-medium text-brand">{next.note}</div>}
                </div>
              </div>
            )}
          </div>
        </motion.section>

        <Card delay={0.1}>
          <div className="flex items-center gap-2">
            <button onClick={() => setDay(Math.max(0, day - 1))} className="grid size-9 place-items-center rounded-full text-teal-800 hover:bg-teal-50"><ChevronLeft /></button>
            <div className="grid flex-1 grid-cols-7 gap-2">
              {DAYS.map((d, i) => (
                <motion.button key={d} whileTap={{ scale: 0.94 }} onClick={() => setDay(i)} className="relative rounded-xl py-2.5 text-center" style={{ background: day === i ? 'var(--brand)' : TONES[i] }}>
                  <div className={`num text-sm font-semibold ${day === i ? 'text-white' : 'text-ink'}`}>10/{22 + i - 2}</div>
                  <div className={`text-xs ${day === i ? 'text-white/80' : 'text-ink-soft'}`}>{d}</div>
                </motion.button>
              ))}
            </div>
            <button onClick={() => setDay(Math.min(6, day + 1))} className="grid size-9 place-items-center rounded-full text-teal-800 hover:bg-teal-50"><ChevronRight /></button>
          </div>
          <div className="mt-5">
            <Title right={<Pill tone="teal">{list.length} 筆</Pill>}>今日預約與服務</Title>
            <AnimatePresence mode="popLayout">
              {list.map((a, i) => (
                <motion.button
                  key={day + a.time + a.member + a.svc}
                  layout
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => { const m = MEMBERS.find((m) => m.name === a.member); if (m) { go('members'); setTimeout(() => setOpenMember(m.id), 50) } }}
                  className="flex w-full items-center gap-4 border-t border-line px-1 py-3.5 text-left first:border-0 hover:bg-teal-50/60"
                >
                  <span className="num w-14 text-lg font-semibold text-brand">{a.time}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{a.member}</span>
                    <span className="block truncate text-sm text-ink-soft">{a.svc}{a.note ? ` · ${a.note}` : ''}</span>
                  </span>
                  {a.src && <span className="hidden items-center gap-1 text-[11px] font-semibold text-crimson md:flex"><Link2 className="size-3" />{a.src}</span>}
                  <BrandTag id={a.brand} small />
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </Card>

        <Card delay={0.2}>
          <Title>加班 / 本月服務統計</Title>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="本月登記" value={logs.length + 128} unit="筆" tone="#e6f0f8" hint="示意數據(假設)" />
            <Stat label="待審建議" value={pending} unit="則" tone="#fdf0e6" delay={0.05} />
            <Stat label="已推送 LINE" value={sent} unit="則" tone="#fdf6e3" delay={0.1} />
            <Stat label="預約回寫" value={booked} unit="筆" tone="#f1ecf5" delay={0.15} />
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card delay={0.15} className="text-center">
          <div className="text-sm text-ink-soft">{now.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long' })}</div>
          <div className="num my-1 text-4xl font-semibold tracking-wide text-teal-800">{now.toLocaleTimeString('zh-TW', { hour12: false })}</div>
          {onDuty && <div className="num text-xs text-ink-soft">已上班 {fmt(dur)}</div>}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <motion.button whileTap={{ scale: 0.95 }} disabled={!!onDuty} onClick={() => { setOnDuty(new Date()); toast('已打卡上班'); addAudit('上班打卡') }} className="rounded-lg bg-teal-800 py-3.5 font-semibold text-white disabled:opacity-40">上班</motion.button>
            <motion.button whileTap={{ scale: 0.95 }} disabled={!onDuty} onClick={() => { setOnDuty(null); toast('已打卡下班') }} className="rounded-lg bg-clinic py-3.5 font-semibold text-white disabled:opacity-40">下班</motion.button>
          </div>
        </Card>

        <Card delay={0.25}>
          <div className="mb-3 flex items-center gap-2"><span className="h-6 w-1.5 rounded bg-crimson" /><h2 className="text-lg font-bold text-crimson">提醒事項</h2></div>
          <ul className="space-y-2.5 text-[13px]">
            {[
              [<>有 <b className="text-crimson">{pending}</b> 則 AI 建議待審核</>, 'ai'],
              [<>有 <b className="text-crimson">1</b> 位會員未同意 LINE 推播</>, 'members'],
              [<><b className="text-crimson">2</b> 則草稿含法規敏感用語待改寫</>, 'ai'],
              [<>特種個資授權 <b className="text-crimson">2026-11-30</b> 到期</>, 'privacy'],
              [<>本週登記平均 <b className="text-crimson">24</b> 秒(假設)</>, 'log'],
            ].map(([t, v], i) => (
              <motion.li key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.07 }}>
                <button onClick={() => go(v as never)} className="flex w-full items-start gap-2 text-left hover:text-brand">
                  <i className="mt-1.5 size-1.5 shrink-0 rounded-full bg-crimson/60" />{t}
                </button>
              </motion.li>
            ))}
          </ul>
        </Card>

        <Card delay={0.35}>
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-brand"><Sparkles className="size-4" />跨品牌需求摘要</div>
          <div className="space-y-2">
            {MEMBERS.filter((m) => m.needs.length).map((m) => (
              <button key={m.id} onClick={() => { go('members'); setTimeout(() => setOpenMember(m.id), 50) }} className="flex w-full items-center justify-between rounded-xl bg-teal-50 px-3 py-2.5 text-left text-sm transition hover:bg-brand-soft">
                <span><b>{m.name}</b><span className="ml-2 text-ink-soft">{m.needs[0]}</span></span>
                <ChevronRight className="size-4 text-brand" />
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-ink-soft">僅顯示需求摘要,不含他品牌明細。</p>
        </Card>
      </div>
    </div>
  )
}
