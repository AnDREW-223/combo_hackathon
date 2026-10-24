import { AnimatePresence, motion } from 'motion/react'
import { Check, History, ShieldCheck, TriangleAlert, Zap } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BRANDS, MEMBERS, type BrandId } from '../data'
import { useStore } from '../store'
import { Avatar, Card, Pill, ease } from '../ui'

const PARTS: { k: string; x: number; y: number; w: number; h: number; r: number }[] = [
  { k: '肩頸', x: 52, y: 60, w: 96, h: 24, r: 12 },
  { k: '上背', x: 64, y: 88, w: 72, h: 50, r: 14 },
  { k: '下背', x: 68, y: 142, w: 64, h: 34, r: 12 },
  { k: '腰臀', x: 62, y: 180, w: 76, h: 36, r: 16 },
  { k: '手臂', x: 28, y: 66, w: 20, h: 110, r: 10 },
  { k: '手臂', x: 152, y: 66, w: 20, h: 110, r: 10 },
  { k: '大腿', x: 64, y: 220, w: 34, h: 70, r: 14 },
  { k: '大腿', x: 102, y: 220, w: 34, h: 70, r: 14 },
  { k: '小腿', x: 66, y: 294, w: 30, h: 46, r: 13 },
  { k: '小腿', x: 104, y: 294, w: 30, h: 46, r: 13 },
]
const LV_FILL = ['#e3ecef', '#a9d6d2', '#4aa09f', '#1d5d66']
const LV_TXT = ['未選', '輕微', '中度', '明顯']
const DIAG = ['診斷', '罹患', '得了', '疾病', '發炎', '症候', '病變']

const TAI_STATES = ['久坐', '久站', '睡眠淺', '運動後', '手機族', '搬重物']
const MEI_NEEDS = ['膚質保養', '雷射諮詢', '微整諮詢', '體態雕塑']
const MEI_SKIN = ['乾燥感', '泛紅感', '暗沉感', '毛孔粗']
const KANG_ITEMS = ['功能醫學諮詢', '血液檢測', '生理檢測', '追蹤回診']

export default function LogView() {
  const { persona, addLog, addSuggestion, toast, addAudit, go } = useStore()
  const [brand, setBrand] = useState<BrandId>(persona.brand === 'hq' ? 'tai' : persona.brand)
  const [mid, setMid] = useState<string | null>(null)
  const [parts, setParts] = useState<Record<string, number>>({})
  const [pressure, setPressure] = useState('')
  const [states, setStates] = useState<string[]>([])
  const [needs, setNeeds] = useState<string[]>([])
  const [skin, setSkin] = useState<string[]>([])
  const [cycle, setCycle] = useState('')
  const [items, setItems] = useState<string[]>([])
  const [plan, setPlan] = useState('')
  const [consent, setConsent] = useState(false)
  const [note, setNote] = useState('')
  const [t0, setT0] = useState<number | null>(null)
  const [secs, setSecs] = useState(0)
  const [phase, setPhase] = useState<'form' | 'ai'>('form')
  const [done, setDone] = useState<number>(0)
  const tick = useRef<ReturnType<typeof setInterval>>(undefined)

  const start = () => {
    if (t0 === null) setT0(Date.now())
  }
  useEffect(() => {
    if (t0 === null || phase !== 'form') return
    tick.current = setInterval(() => setSecs(Math.floor((Date.now() - t0) / 1000)), 250)
    return () => clearInterval(tick.current)
  }, [t0, phase])

  const toggle = (arr: string[], set: (a: string[]) => void, v: string) => {
    start()
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
  }
  const member = MEMBERS.find((m) => m.id === mid)
  const guard = brand === 'tai' ? DIAG.find((d) => note.includes(d)) : undefined
  const filled = brand === 'tai' ? Object.values(parts).some(Boolean) || states.length > 0 : brand === 'mei' ? needs.length + skin.length > 0 : items.length > 0
  const blocked = !mid || !filled || !!guard || (brand === 'kang' && !consent)
  const why = !mid ? '請先選擇會員' : !filled ? '請至少點選一項' : guard ? `「${guard}」屬診斷用語,請改為觀察描述` : brand === 'kang' && !consent ? '需先確認會員同意(特種個資)' : ''

  const summary = useMemo(() => {
    if (brand === 'tai') return [...Object.entries(parts).filter(([, v]) => v).map(([k, v]) => `${k}${LV_TXT[v]}`), ...(pressure ? [`力道${pressure}`] : []), ...states].join('、')
    if (brand === 'mei') return [...needs, ...skin, cycle && `週期${cycle}`].filter(Boolean).join('、')
    return [...items, plan].filter(Boolean).join('、')
  }, [brand, parts, pressure, states, needs, skin, cycle, items, plan])

  const reset = () => {
    setParts({}); setPressure(''); setStates([]); setNeeds([]); setSkin([]); setCycle(''); setItems([]); setPlan(''); setConsent(false); setNote(''); setT0(null); setSecs(0); setMid(null); setPhase('form'); setDone(0)
  }

  const save = () => {
    if (blocked || !member) return
    const used = secs
    clearInterval(tick.current)
    addLog({ memberId: member.id, brand, summary, secs: used })
    addAudit(`登記 ${member.name} ${brand === 'tai' ? '疲勞部位觀察' : brand === 'mei' ? '保養需求' : '診療追蹤(特種個資)'}`, brand === 'kang' ? 3 : 2)
    setPhase('ai')
    ;[900, 1900, 2900].forEach((d, i) => setTimeout(() => setDone(i + 1), d))
    setTimeout(() => {
      const to: BrandId = brand === 'tai' ? 'mei' : 'tai'
      const draft = brand === 'tai'
        ? `${member.name[0]}先生/小姐您好,留意到您近期肩頸與背部常有緊繃感,歡迎預約體態評估,由顧問為您說明保養選項。`
        : brand === 'mei'
          ? `${member.name[0]}先生/小姐您好,保養之餘也歡迎預約泰晶殿全身放鬆時光,為您保留舒適時段。`
          : `${member.name[0]}先生/小姐您好,健康管理之餘,歡迎預約泰晶殿放鬆時光,我們為您保留 60 分鐘。`
      addSuggestion({
        id: 's' + Date.now(), memberId: member.id, from: brand, to,
        title: `${BRANDS[to].name} 新建議(依本次登記)`, draft,
        why: [`${BRANDS[brand].name}:${summary || '本次登記'}`, member.brands.length === 1 ? `僅有單一品牌紀錄,依群集 ${member.cluster} 推估(假設)` : '具備跨品牌紀錄'],
        conf: member.brands.length === 1 ? 45 : 68, cold: member.brands.length === 1, status: 'pending',
      })
      toast('AI 已產生建議,待人員審核')
    }, 3300)
  }

  const over = secs > 30
  const C = 2 * Math.PI * 52

  if (phase === 'ai')
    return (
      <div className="mx-auto grid max-w-xl place-items-center py-10 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }} className="grid size-28 place-items-center rounded-full bg-brand text-white">
          <motion.svg viewBox="0 0 24 24" className="size-14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><motion.path d="M5 12l5 5 9-10" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.2, duration: 0.5 }} /></motion.svg>
        </motion.div>
        <h2 className="mt-6 text-2xl font-black">登記完成</h2>
        <p className="mt-1 text-ink-soft">本次耗時 <b className="num text-brand">{secs}</b> 秒 {secs <= 30 ? '・達標' : '・略超過 30 秒'}</p>
        <div className="mt-8 w-full space-y-3 text-left">
          {['整合跨品牌資料(含群集補足)', '法規用語過濾', '排入人員審核佇列'].map((t, i) => (
            <motion.div key={t} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.25 }} className="flex items-center gap-3 rounded-xl bg-white p-4">
              <span className={`grid size-7 place-items-center rounded-full text-white ${done > i ? 'bg-brand' : 'bg-line'}`}>
                {done > i ? <Check className="size-4" /> : <span className="size-3 animate-spin rounded-full border-2 border-white border-t-transparent" />}
              </span>
              <span className="font-semibold">{t}</span>
            </motion.div>
          ))}
        </div>
        <div className="mt-8 flex gap-3">
          <button onClick={reset} className="rounded-xl bg-brand px-6 py-3.5 font-bold text-white">登記下一位</button>
          <button onClick={() => go('ai')} disabled={done < 3} className="rounded-xl bg-white px-6 py-3.5 font-bold text-brand disabled:opacity-40">前往審核</button>
        </div>
      </div>
    )

  return (
    <div className="mx-auto grid max-w-[1300px] gap-5 ">
      <div className="space-y-5 pb-24">
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="title-bar text-lg font-bold text-brand">1・選擇會員</h2>
            {persona.brand === 'hq' && (
              <div className="flex gap-1 rounded-xl bg-canvas p-1">
                {(['tai', 'mei', 'kang'] as const).map((b) => (
                  <button key={b} onClick={() => setBrand(b)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${brand === b ? 'bg-white text-brand shadow' : 'text-ink-soft'}`}>{BRANDS[b].name}</button>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {MEMBERS.map((m) => (
              <motion.button key={m.id} whileTap={{ scale: 0.94 }} onClick={() => { setMid(m.id); start() }} className={`flex h-[72px] min-w-[150px] items-center gap-3 rounded-2xl px-4 text-left ring-2 transition ${mid === m.id ? 'bg-brand-soft ring-brand' : 'bg-canvas ring-transparent'}`}>
                <Avatar text={m.name[0]} size={38} />
                <span className="leading-tight"><b className="block">{m.name}</b><span className="text-[11px] text-ink-soft">{m.lastVisit[brand] ? `上次 ${m.lastVisit[brand]}` : '首次'}</span></span>
              </motion.button>
            ))}
          </div>
        </Card>

        <Card delay={0.05}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="title-bar text-lg font-bold text-brand">2・{brand === 'tai' ? '疲勞部位「觀察」' : brand === 'mei' ? '保養與需求' : '服務與追蹤項目'}</h2>
            <button onClick={() => { if (!member) return toast('請先選擇會員', 'warn'); start(); if (brand === 'tai') { const p: Record<string, number> = {}; member.fatigue.forEach((f) => (p[f.part] = f.lv)); setParts(p); setPressure(member.pressure ?? '') } else if (brand === 'mei') setNeeds(['膚質保養']); else setItems(['追蹤回診']); toast('已沿用上次紀錄') }} className="flex items-center gap-1.5 rounded-full bg-teal-50 px-4 py-2 text-xs font-bold text-brand"><History className="size-3.5" />沿用上次</button>
          </div>

          {brand === 'tai' && (
            <div className="grid gap-6 md:grid-cols-[200px_1fr]">
              <div className="mx-auto w-[190px]">
                <svg viewBox="0 0 200 362" className="w-full">
                  <circle cx="100" cy="32" r="22" fill="#e3ecef" />
                  {PARTS.map((p, i) => (
                    <motion.rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.r} animate={{ fill: LV_FILL[parts[p.k] ?? 0] }} whileTap={{ scale: 0.94 }} style={{ transformBox: 'fill-box', transformOrigin: 'center', cursor: 'pointer' }}
                      onClick={() => { start(); setParts((s) => ({ ...s, [p.k]: ((s[p.k] ?? 0) + 1) % 4 })) }} />
                  ))}
                </svg>
                <div className="mt-1 text-center text-[11px] text-ink-soft">點一下循環 輕→中→明顯→清除</div>
              </div>
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(parts).filter(([, v]) => v).map(([k, v]) => (
                    <motion.span layout initial={{ scale: 0 }} animate={{ scale: 1 }} key={k} className="rounded-full px-3 py-1.5 text-sm font-bold text-white" style={{ background: LV_FILL[v] === '#a9d6d2' ? '#3d9a98' : LV_FILL[v] }}>{k}・{LV_TXT[v]}</motion.span>
                  ))}
                  {!Object.values(parts).some(Boolean) && <span className="text-sm text-ink-soft">尚未標記部位</span>}
                </div>
                <div>
                  <div className="mb-2 text-sm font-bold">力道偏好</div>
                  <Seg opts={['輕', '中', '重']} v={pressure} on={(v) => { start(); setPressure(v) }} />
                </div>
                <div>
                  <div className="mb-2 text-sm font-bold">日常狀態(顧客自述)</div>
                  <Chips opts={TAI_STATES} v={states} on={(x) => toggle(states, setStates, x)} />
                </div>
              </div>
            </div>
          )}
          {brand === 'mei' && (
            <div className="space-y-5">
              <div><div className="mb-2 text-sm font-bold">顧客需求</div><Chips opts={MEI_NEEDS} v={needs} on={(x) => toggle(needs, setNeeds, x)} /></div>
              <div><div className="mb-2 text-sm font-bold">膚況描述(顧客自述)</div><Chips opts={MEI_SKIN} v={skin} on={(x) => toggle(skin, setSkin, x)} /></div>
              <div><div className="mb-2 text-sm font-bold">預期保養週期</div><Seg opts={['2 週', '4 週', '8 週']} v={cycle} on={(v) => { start(); setCycle(v) }} /></div>
            </div>
          )}
          {brand === 'kang' && (
            <div className="space-y-5">
              <div><div className="mb-2 text-sm font-bold">本次項目</div><Chips opts={KANG_ITEMS} v={items} on={(x) => toggle(items, setItems, x)} /></div>
              <div><div className="mb-2 text-sm font-bold">方案狀態</div><Seg opts={['進行中', '待追蹤', '已完成']} v={plan} on={(v) => { start(); setPlan(v) }} /></div>
              <button onClick={() => { start(); setConsent(!consent) }} className={`flex w-full items-center gap-3 rounded-2xl p-4 text-left ring-2 transition ${consent ? 'bg-sky ring-clinic' : 'bg-canvas ring-transparent'}`}>
                <span className={`grid size-7 place-items-center rounded-lg ${consent ? 'bg-clinic text-white' : 'bg-white'}`}>{consent && <Check className="size-4" />}</span>
                <span><b className="block">已向會員說明並取得書面同意</b><span className="text-xs text-ink-soft">醫療資料屬特種個資,僅限授權人員檢視</span></span>
                <ShieldCheck className="ml-auto size-6 text-clinic" />
              </button>
            </div>
          )}
        </Card>

        <Card delay={0.1}>
          <h2 className="title-bar mb-3 text-lg font-bold text-brand">3・備註(選填)</h2>
          <textarea value={note} onChange={(e) => { start(); setNote(e.target.value) }} rows={2} placeholder={brand === 'tai' ? '以「觀察」描述,例如:顧客表示肩膀感覺緊' : '簡短備註'} className="w-full resize-none rounded-xl bg-canvas p-3 text-sm outline-none focus:ring-2 focus:ring-brand" />
          <AnimatePresence>
            {guard && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 flex items-center gap-2 overflow-hidden rounded-xl bg-[#fbe5ea] px-3 py-2 text-xs font-semibold text-crimson">
                <TriangleAlert className="size-4 shrink-0" />「{guard}」屬診斷/醫療用語。按摩師僅登記觀察,請改寫(例:「顧客自覺…緊繃」)。
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>

      {/* <div className="space-y-5 xl:sticky xl:top-0 xl:self-start">
        <Card className="text-center">
          <div className="relative mx-auto size-36">
            <svg viewBox="0 0 120 120" className="-rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#e3ecef" strokeWidth="9" />
              <motion.circle cx="60" cy="60" r="52" fill="none" strokeWidth="9" strokeLinecap="round" strokeDasharray={C} animate={{ strokeDashoffset: C * (1 - Math.min(secs, 30) / 30), stroke: over ? '#d98a1c' : 'var(--brand)' }} transition={{ duration: 0.3 }} />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div><div className="num text-4xl font-semibold">{t0 === null ? 30 : Math.max(30 - secs, 0)}</div><div className="text-[11px] text-ink-soft">{t0 === null ? '點選即開始計時' : over ? '已超過 30 秒' : '秒內完成'}</div></div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-ink-soft"><Zap className="size-3.5 text-brand" />單手操作・大型觸控區</div>
        </Card>
        <Card delay={0.1}>
          <div className="mb-2 text-sm font-bold text-brand">即時摘要</div>
          <div className="min-h-[56px] text-sm leading-relaxed">{member ? <b>{member.name}</b> : <span className="text-ink-soft">未選擇會員</span>}{summary && <span className="text-ink-soft"> · {summary}</span>}</div>
          <div className="mt-3 flex flex-wrap gap-1.5"><Pill tone="teal">僅觀察</Pill><Pill tone="violet">審核後才推送</Pill></div>
        </Card>
      </div> */}

      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center p-4 pointer-events-none">
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => (blocked ? toast(why, 'warn') : save())} className={`pointer-events-auto flex h-16 w-full max-w-md items-center justify-center gap-2 rounded-2xl text-lg font-black text-white shadow-2xl transition ${blocked ? 'bg-ink-soft/70' : 'bg-brand'}`}>
          <Check className="size-6" />{blocked ? why || '儲存登記' : `儲存登記 · ${secs} 秒`}
        </motion.button>
      </div>
    </div>
  )
}

function Chips({ opts, v, on }: { opts: string[]; v: string[]; on: (x: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {opts.map((o) => {
        const a = v.includes(o)
        return (
          <motion.button key={o} whileTap={{ scale: 0.92 }} animate={{ background: a ? 'var(--brand)' : '#eaf1f2', color: a ? '#fff' : '#1c3a3f' }} onClick={() => on(o)} className="h-12 rounded-xl px-5 text-sm font-bold">
            {o}
          </motion.button>
        )
      })}
    </div>
  )
}
function Seg({ opts, v, on }: { opts: string[]; v: string; on: (x: string) => void }) {
  return (
    <div className="flex gap-2 rounded-2xl bg-canvas p-1.5">
      {opts.map((o) => (
        <button key={o} onClick={() => on(o)} className="relative h-12 flex-1 rounded-xl text-sm font-bold">
          {v === o && <motion.span layoutId={'seg' + opts.join()} transition={{ ease }} className="absolute inset-0 rounded-xl bg-brand" />}
          <span className={`relative ${v === o ? 'text-white' : 'text-ink-soft'}`}>{o}</span>
        </button>
      ))}
    </div>
  )
}
