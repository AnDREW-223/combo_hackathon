import { AnimatePresence, motion } from 'motion/react'
import { BellOff, CalendarClock, Lock, MessageCircleHeart, Search, ShieldAlert, Snowflake, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BRANDS, CLUSTERS, MEMBERS, type BrandId, type Member } from '../data'
import { useStore } from '../store'
import { Avatar, BrandTag, Card, Pill, Radar, ease } from '../ui'

const FILTERS = ['全部', '三品牌', '雙品牌', '冷啟動', '未同意推播'] as const

export default function MembersView() {
  const { openMember, setOpenMember } = useStore()
  const [q, setQ] = useState('')
  const [f, setF] = useState<(typeof FILTERS)[number]>('全部')
  const list = MEMBERS.filter((m) => m.name.includes(q) || m.tags.some((t) => t.includes(q))).filter((m) => {
    if (f === '全部') return true
    if (f === '三品牌') return m.brands.length === 3
    if (f === '雙品牌') return m.brands.length === 2
    if (f === '冷啟動') return m.brands.length === 1
    return !m.consent
  })
  const sel = MEMBERS.find((m) => m.id === openMember)

  return (
    <div className={`mx-auto grid max-w-[1500px] gap-5 ${sel ? 'xl:grid-cols-[1fr_480px]' : ''}`}>
      <div>
        <Card className="mb-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-12 min-w-[220px] flex-1 items-center gap-3 rounded-xl bg-canvas px-4">
              <Search className="size-4 text-ink-soft" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="輸入姓氏或標籤(姓名已去識別化顯示)" className="w-full bg-transparent text-sm outline-none" />
            </div>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((x) => (
                <button key={x} onClick={() => setF(x)} className="relative rounded-full px-4 py-2 text-sm font-semibold">
                  {f === x && <motion.span layoutId="fchip" className="absolute inset-0 rounded-full bg-brand" />}
                  <span className={`relative ${f === x ? 'text-white' : 'text-ink-soft'}`}>{x}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>
        <div className={`grid gap-4 ${sel ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
          <AnimatePresence mode="popLayout">
            {list.map((m, i) => (
              <motion.button
                key={m.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: i * 0.05, ease }}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setOpenMember(m.id)}
                className={`rounded-2xl bg-white p-5 text-left shadow-sm ring-2 transition-shadow hover:shadow-xl ${openMember === m.id ? 'ring-brand' : 'ring-transparent'}`}
              >
                <div className="flex items-center gap-3">
                  <Avatar text={m.name[0]} size={46} color={BRANDS[m.brands[0]].color} />
                  <div className="flex-1">
                    <div className="font-bold">{m.name}</div>
                    <div className="text-xs text-ink-soft">{m.band} 歲</div>
                  </div>
                  {!m.consent && <BellOff className="size-4 text-crimson" />}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">{m.brands.map((b) => <BrandTag key={b} id={b} small />)}</div>
                <div className="mt-3 flex items-center justify-between text-xs text-ink-soft">
                  <span className="flex items-center gap-1"><CalendarClock className="size-3.5" />{m.nextDue ? `下次約 ${m.nextDue}` : '週期未定'}</span>
                  {m.brands.length === 1 && <span className="flex items-center gap-1 text-clinic"><Snowflake className="size-3.5" />冷啟動</span>}
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
        {!list.length && <div className="p-10 text-center text-ink-soft">找不到符合的會員</div>}
      </div>
      <AnimatePresence>{sel && <Detail key={sel.id} m={sel} />}</AnimatePresence>
    </div>
  )
}

function Lock3({ brand, mid }: { brand: BrandId; mid: string }) {
  const { grant, addAudit, toast, persona } = useStore()
  const clinic = brand === 'kang'
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-line p-5 text-center">
      <div className="pointer-events-none absolute inset-0 select-none p-5 text-left text-sm text-ink/70 blur-sm">
        ██ ████ ██ ███<br />███ ██ ████ ██<br />████ ███ ██ ██
      </div>
      <div className="relative">
        <Lock className="mx-auto size-7 text-brand" />
        <div className="mt-2 font-bold">{clinic ? '特種個資・L3 受控' : '他品牌明細受控'}</div>
        <p className="mx-auto mt-1 max-w-xs text-xs text-ink-soft">
          {clinic ? '診所醫療資料僅限診所人員與書面授權者檢視。其他品牌僅看到需求摘要。' : '依最小必要原則,跨品牌僅顯示需求摘要。申請後留存稽核紀錄。'}
        </p>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            if (clinic) {
              addAudit(`申請特種個資授權(${BRANDS[brand].name})`, 3)
              toast(`${persona.name} 的申請已送出,需會員書面同意與主管核准`, 'warn')
            } else {
              grant(mid + brand)
              addAudit(`申請檢視 ${BRANDS[brand].name} 明細(L2)`, 2)
              toast('已授權檢視,並留下稽核紀錄')
            }
          }}
          className="mt-3 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white"
        >
          {clinic ? '申請授權' : '申請檢視明細'}
        </motion.button>
      </div>
    </div>
  )
}

function Detail({ m }: { m: Member }) {
  const { setOpenMember, persona, grants, suggestions, addAudit, go } = useStore()
  const [tab, setTab] = useState<'all' | BrandId>('all')
  const can = (b: BrandId) => {
    if (b === 'kang') return persona.maxLevel === 3
    return b === persona.brand || persona.brand === 'hq' || grants.includes(m.id + b)
  }
  useEffect(() => {
    if (tab === 'kang' && can('kang') && m.brands.includes('kang')) addAudit(`檢視 ${m.name} 診所資料(特種個資)`, 3)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, m.id])
  const cold = m.brands.length === 1
  const cl = CLUSTERS[m.cluster]
  const sigs = m.signals.map((v, i) => (i === 3 && !can('kang') ? Math.min(v, 100) : v))
  const mySug = suggestions.filter((s) => s.memberId === m.id)

  return (
    <motion.aside
      initial={{ x: 60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 60, opacity: 0 }}
      transition={{ duration: 0.4, ease }}
      className="fixed right-0 top-0 z-40 h-full w-[min(500px,100vw)] overflow-y-auto bg-white p-6 shadow-2xl xl:sticky xl:top-0 xl:z-0 xl:h-[calc(100vh-130px)] xl:w-auto xl:rounded-2xl xl:shadow-sm"
    >
      <div className="flex items-start gap-4">
        <Avatar text={m.name[0]} size={60} color={BRANDS[m.brands[0]].color} />
        <div className="flex-1">
          <h2 className="text-xl font-black">{m.name}</h2>
          <div className="text-sm text-ink-soft">{m.band} 歲 · 編號 {m.id.toUpperCase()}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">{m.brands.map((b) => <BrandTag key={b} id={b} small />)}</div>
        </div>
        <button onClick={() => setOpenMember(null)} className="grid size-9 place-items-center rounded-full bg-canvas"><X className="size-4" /></button>
      </div>

      <div className={`mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${m.consent ? 'bg-teal-50 text-teal-800' : 'bg-[#fbe5ea] text-crimson'}`}>
        {m.consent ? <MessageCircleHeart className="size-4" /> : <ShieldAlert className="size-4" />}
        {m.consent ? 'LINE 推播已同意 · 可隨時退訂' : '尚未同意 LINE 推播,AI 建議不可發送'}
      </div>

      <div className="mt-5 grid grid-cols-[auto_1fr] items-center gap-4">
        <Radar values={sigs} dashed={sigs.map((v) => v === 0)} />
        <div className="space-y-2 text-xs">
          <div className="font-bold text-brand">四大資料主軸・訊號強度</div>
          <p className="text-ink-soft">依登記次數與資料完整度估算,為示意模型(假設)。虛線點代表尚無資料。</p>
          {cold && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl p-3" style={{ background: '#e6f0f8' }}>
              <div className="flex items-center gap-1 font-bold text-clinic"><Snowflake className="size-3.5" />冷啟動</div>
              <div className="mt-1 text-ink-soft">單一品牌資料,以群集「{cl.name}」({m.cluster})推估偏好 <Pill tone="amber">假設</Pill></div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="relative mt-6 flex gap-1 rounded-xl bg-canvas p-1">
        {(['all', 'tai', 'mei', 'kang'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className="relative flex-1 rounded-lg py-2 text-xs font-bold">
            {tab === t && <motion.span layoutId="dtab" className="absolute inset-0 rounded-lg bg-white shadow" />}
            <span className={`relative ${tab === t ? 'text-brand' : 'text-ink-soft'}`}>{t === 'all' ? '摘要' : BRANDS[t].name}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 space-y-3">
          {tab === 'all' && (
            <>
              <Row label="消費週期" value={m.cycleDays ? `約每 ${m.cycleDays} 天 · 下次預估 ${m.nextDue}` : '資料不足'} />
              <Row label="疲勞部位(觀察)" value={m.fatigue.length ? m.fatigue.map((f) => `${f.part}${['', '輕', '中', '明顯'][f.lv]}`).join('、') : '尚無登記'} />
              <Row label="外觀保養歷程" value={m.skin[0] ?? '尚無登記'} />
              <Row label="代謝風險指標" value={m.brands.includes('kang') ? (can('kang') ? '已建檔 · 於康博分頁檢視' : '受控 · 僅顯示「有建檔」') : '尚無資料'} locked={!can('kang')} />
              <Row label="需求摘要" value={m.needs.join('、') || '目前無'} />
            </>
          )}
          {tab !== 'all' && !m.brands.includes(tab) && <div className="rounded-xl bg-canvas p-5 text-center text-sm text-ink-soft">此會員尚無 {BRANDS[tab].name} 紀錄。<br />可由 AI 建議邀請。</div>}
          {tab !== 'all' && m.brands.includes(tab) && !can(tab) && <Lock3 brand={tab} mid={m.id} />}
          {tab === 'tai' && m.brands.includes('tai') && can('tai') && (
            <>
              <Row label="最近到訪" value={m.lastVisit.tai ?? '-'} />
              <div className="rounded-xl bg-teal-50 p-4">
                <div className="mb-2 text-xs font-bold text-teal-800">疲勞部位觀察</div>
                {m.fatigue.map((f) => (
                  <div key={f.part} className="mb-2 flex items-center gap-3 text-sm">
                    <span className="w-12">{f.part}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white"><motion.div initial={{ width: 0 }} animate={{ width: `${f.lv * 33.3}%` }} transition={{ duration: 0.8, ease }} className="h-full rounded-full bg-teal-700" /></div>
                    <span className="w-10 text-xs text-ink-soft">{['', '輕', '中', '明顯'][f.lv]}</span>
                  </div>
                ))}
              </div>
              <Row label="力道偏好" value={m.pressure ?? '未登記'} />
              <p className="text-[11px] text-ink-soft">以上為按摩師「觀察」登記,非診斷或醫療建議。</p>
            </>
          )}
          {tab === 'mei' && m.brands.includes('mei') && can('mei') && (
            <>
              <Row label="最近到訪" value={m.lastVisit.mei ?? '-'} />
              {m.skin.map((s) => <Row key={s} label="保養歷程" value={s} />)}
              <Row label="療程週期" value={m.cycleDays ? `約 ${m.cycleDays} 天` : '-'} />
            </>
          )}
          {tab === 'kang' && m.brands.includes('kang') && can('kang') && (
            <>
              <div className="flex items-center gap-2 rounded-xl bg-sky px-3 py-2 text-xs font-semibold text-clinic"><ShieldAlert className="size-4" />特種個資・本次檢視已寫入稽核紀錄</div>
              {m.clinic.map((c) => <Row key={c.item} label={c.item} value={c.status} />)}
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-6">
        <div className="mb-2 text-sm font-bold text-brand">相關 AI 建議</div>
        {mySug.length ? mySug.map((s) => (
          <button key={s.id} onClick={() => go('ai')} className="mb-2 flex w-full items-center justify-between rounded-xl bg-teal-50 px-3 py-2.5 text-left text-sm hover:bg-brand-soft">
            <span>{s.title}</span>
            <Pill tone={s.status === 'pending' ? 'amber' : s.status === 'booked' ? 'teal' : 'violet'}>{{ pending: '待審', approved: '已核可', sent: '已推送', booked: '已預約' }[s.status]}</Pill>
          </button>
        )) : <div className="text-xs text-ink-soft">目前沒有建議</div>}
      </div>
    </motion.aside>
  )
}

function Row({ label, value, locked }: { label: string; value: string; locked?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line/70 pb-3 text-sm last:border-0">
      <span className="shrink-0 text-ink-soft">{label}</span>
      <span className="flex items-center gap-1.5 text-right font-semibold">{locked && <Lock className="size-3.5 text-brand" />}{value}</span>
    </div>
  )
}
