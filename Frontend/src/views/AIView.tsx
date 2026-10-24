import { AnimatePresence, motion } from 'motion/react'
import { Check, MessageSquareText, Send, ShieldAlert, ShieldCheck, Snowflake, Wand2 } from 'lucide-react'
import { Fragment, useState } from 'react'
import { BANNED, BRANDS, MEMBERS, type BrandId, type SugStatus } from '../data'
import { useStore } from '../store'
import { BrandTag, Bubble, Card, Pill, ease } from '../ui'

const STEPS = ['人員登記', 'AI 整合', '人員審核', 'LINE 推送', '會員預約', '回寫 App']
const STAGE: Record<SugStatus, number> = { pending: 2, approved: 3, sent: 4, booked: 6 }
const TABS: { k: SugStatus | 'all'; t: string }[] = [
  { k: 'pending', t: '待審核' },
  { k: 'approved', t: '已核可' },
  { k: 'sent', t: '已推送' },
  { k: 'booked', t: '已預約' },
]

export function findIssues(text: string, to: BrandId) {
  const hard = Object.keys(BANNED)
  const list = to === 'kang' ? ['保證', '根治', '治癒'] : hard
  return list.filter((w) => text.includes(w))
}

export default function AIView() {
  const { suggestions, setStatus, editDraft, toast, addAudit } = useStore()
  const [tab, setTab] = useState<SugStatus>('pending')
  const [selId, setSelId] = useState<string | null>(null)
  const list = suggestions.filter((s) => s.status === tab)
  const sel = suggestions.find((s) => s.id === selId) ?? list[0]
  const member = MEMBERS.find((m) => m.id === sel?.memberId)
  const issues = sel ? findIssues(sel.draft, sel.to) : []

  const highlight = (t: string, words: string[]) => {
    if (!words.length) return t
    const re = new RegExp(`(${words.join('|')})`, 'g')
    return t.split(re).map((p, i) => (words.includes(p) ? <mark key={i} className="rounded bg-[#fbd3dc] px-0.5 font-bold text-crimson">{p}</mark> : <Fragment key={i}>{p}</Fragment>))
  }

  return (
    <div className="mx-auto grid max-w-[1500px] gap-5 xl:grid-cols-[360px_1fr]">
      <div>
        <Card className="!p-3">
          <div className="relative grid grid-cols-4 gap-1">
            {TABS.map((t) => {
              const n = suggestions.filter((s) => s.status === t.k).length
              return (
                <button key={t.k} onClick={() => { setTab(t.k as SugStatus); setSelId(null) }} className="relative rounded-xl py-2.5 text-center text-xs font-bold">
                  {tab === t.k && <motion.span layoutId="aitab" className="absolute inset-0 rounded-xl bg-brand" />}
                  <span className={`relative ${tab === t.k ? 'text-white' : 'text-ink-soft'}`}>{t.t}<span className="num ml-1">{n}</span></span>
                </button>
              )
            })}
          </div>
        </Card>
        <div className="mt-4 space-y-3">
          <AnimatePresence mode="popLayout">
            {list.map((s, i) => {
              const m = MEMBERS.find((x) => x.id === s.memberId)!
              const bad = findIssues(s.draft, s.to).length > 0
              return (
                <motion.button key={s.id} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }} transition={{ delay: i * 0.05 }} whileHover={{ x: 4 }} onClick={() => setSelId(s.id)} className={`w-full rounded-2xl bg-white p-4 text-left ring-2 ${sel?.id === s.id ? 'ring-brand' : 'ring-transparent'}`}>
                  <div className="flex items-center justify-between"><b>{m.name}</b>{bad && <Pill tone="crimson">用語待改</Pill>}</div>
                  <div className="mt-1 text-sm">{s.title}</div>
                  <div className="mt-2 flex items-center gap-2"><BrandTag id={s.from} small /><span className="text-ink-soft">→</span><BrandTag id={s.to} small />{s.cold && <Snowflake className="ml-auto size-4 text-clinic" />}</div>
                </motion.button>
              )
            })}
          </AnimatePresence>
          {!list.length && <div className="rounded-2xl bg-white p-8 text-center text-sm text-ink-soft">這個分類目前沒有項目</div>}
        </div>
      </div>

      {sel && member ? (
        <motion.div key={sel.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ease }} className="grid gap-5 2xl:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">{sel.title}</h2>
                  <div className="mt-1 text-sm text-ink-soft">會員 {member.name} · 信心 <span className="num font-bold text-brand">{sel.conf}%</span>(示意) {sel.cold && <Pill tone="amber">冷啟動・群集推估(假設)</Pill>}</div>
                </div>
              </div>
              <div className="mt-6 flex items-center">
                {STEPS.map((s, i) => {
                  const st = STAGE[sel.status]
                  const on = i < st
                  const cur = i === st
                  return (
                    <Fragment key={s}>
                      <div className="flex flex-col items-center gap-1.5">
                        <motion.span animate={{ scale: cur ? 1.15 : 1, background: on ? 'var(--brand)' : cur ? '#fff' : '#e3ecef' }} className={`grid size-8 place-items-center rounded-full text-xs font-bold ${cur ? 'pulse-ring border-2 border-crimson text-crimson' : 'text-white'}`}>
                          {on ? <Check className="size-4" /> : i + 1}
                        </motion.span>
                        <span className={`whitespace-nowrap text-[10px] font-semibold ${on || cur ? 'text-ink' : 'text-ink-soft'}`}>{s}</span>
                      </div>
                      {i < STEPS.length - 1 && <div className="mx-1 mb-5 h-0.5 flex-1 overflow-hidden rounded bg-line"><motion.div initial={false} animate={{ width: i < st - 1 ? '100%' : 0 }} className="h-full bg-brand" /></div>}
                    </Fragment>
                  )
                })}
              </div>
            </Card>

            <Card delay={0.05}>
              <div className="mb-3 text-sm font-bold text-brand">為何推薦(資料依據)</div>
              <ul className="space-y-2">
                {sel.why.map((w, i) => (
                  <motion.li key={w} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.08 }} className="flex items-start gap-2 text-sm"><i className="mt-2 size-1.5 rounded-full bg-brand" />{w.includes('假設') ? <span>{w}</span> : w}</motion.li>
                ))}
              </ul>
            </Card>

            <Card delay={0.1}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-brand"><MessageSquareText className="size-4" />LINE 文案草稿(可編輯)</div>
                <Pill tone={sel.to === 'kang' ? 'blue' : 'teal'}>{BRANDS[sel.to].name}{sel.to !== 'kang' ? '・非醫療用語嚴格過濾' : ''}</Pill>
              </div>
              <textarea value={sel.draft} disabled={sel.status !== 'pending'} onChange={(e) => editDraft(sel.id, e.target.value)} rows={4} className="w-full resize-none rounded-xl bg-canvas p-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-brand disabled:opacity-70" />
              <AnimatePresence mode="wait">
                {issues.length ? (
                  <motion.div key="bad" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 rounded-xl border border-crimson/30 bg-[#fdeef2] p-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-crimson"><ShieldAlert className="size-4" />法規過濾:偵測到 {issues.length} 個敏感用語,不得發送</div>
                    <p className="mt-2 text-sm leading-relaxed">{highlight(sel.draft, issues)}</p>
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => { let t = sel.draft; issues.forEach((w) => (t = t.split(w).join(BANNED[w] ?? ''))); editDraft(sel.id, t); toast('已改寫為合規用語'); addAudit('套用法規改寫建議') }} className="mt-3 flex items-center gap-1.5 rounded-lg bg-crimson px-4 py-2 text-xs font-bold text-white"><Wand2 className="size-3.5" />一鍵合規改寫</motion.button>
                  </motion.div>
                ) : (
                  <motion.div key="ok" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 flex items-center gap-2 rounded-xl bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800"><ShieldCheck className="size-4" />未偵測到醫療效果宣稱用語</motion.div>
                )}
              </AnimatePresence>
            </Card>

            <div className="flex flex-wrap gap-3">
              {sel.status === 'pending' && (
                <motion.button whileTap={{ scale: 0.96 }} disabled={issues.length > 0} onClick={() => { setStatus(sel.id, 'approved'); addAudit(`核可 ${member.name} 建議`); toast('已核可,可推送至 LINE') ; setTab('approved'); setSelId(sel.id) }} className="flex h-14 items-center gap-2 rounded-xl bg-brand px-8 font-bold text-white disabled:opacity-40"><Check />人員核可</motion.button>
              )}
              {sel.status === 'approved' && (
                <motion.button whileTap={{ scale: 0.96 }} disabled={!member.consent} onClick={() => { setStatus(sel.id, 'sent'); addAudit(`推送 LINE 給 ${member.name}`); toast('已透過 LINE 推送'); setTab('sent') }} className="flex h-14 items-center gap-2 rounded-xl bg-[#06c755] px-8 font-bold text-white disabled:opacity-40"><Send />推送到 LINE</motion.button>
              )}
              {sel.status === 'approved' && !member.consent && <span className="self-center text-sm font-semibold text-crimson">會員未同意推播,無法發送</span>}
              {sel.status === 'sent' && (
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => { setStatus(sel.id, 'booked'); toast('會員已預約,資料回寫至 App'); setTab('booked') }} className="flex h-14 items-center gap-2 rounded-xl bg-clinic px-8 font-bold text-white">模擬:會員在 LINE 預約</motion.button>
              )}
              {sel.status === 'booked' && <div className="rounded-xl bg-teal-50 px-5 py-4 text-sm font-semibold text-teal-800">預約已回寫,可於工作台「今日預約」看到(示意)。</div>}
            </div>
          </div>
          <Card delay={0.15} className="h-fit 2xl:sticky 2xl:top-0">
            <div className="mb-3 text-sm font-bold text-brand">會員端 LINE 預覽</div>
            <Bubble text={sel.draft} from={BRANDS[sel.to].name} />
          </Card>
        </motion.div>
      ) : (
        <Card className="grid min-h-[300px] place-items-center text-ink-soft">請選擇左側建議</Card>
      )}
    </div>
  )
}
