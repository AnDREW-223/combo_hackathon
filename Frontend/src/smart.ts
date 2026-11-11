import { BOOKINGS, MEMBERS, POINTS, TITLE, type BrandId, type Member, type Suggestion } from './data'

/** 示意用「今天」,與 App 內其他假資料的日期一致 */
export const TODAY = '10/28'
const dt = (md: string) => {
  const [m, d] = md.split('/').map(Number)
  return new Date(2025, m - 1, d)
}
export const daysBetween = (a: string, b: string) => Math.round((dt(b).getTime() - dt(a).getTime()) / 86400000)
export const addDays = (md: string, n: number) => {
  const d = dt(md)
  d.setDate(d.getDate() + n)
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

/* ───── 1. 跨品牌自動標籤(每個標籤都附「依據」,可被檢視) ───── */
export function autoTags(m: Member): { tag: string; basis: string }[] {
  const out: { tag: string; basis: string }[] = []
  const bk = BOOKINGS[m.id] ?? []
  if (m.brands.length >= 2) out.push({ tag: '跨品牌體驗者', basis: `已使用 ${m.brands.length} 個品牌` })
  if (m.cycleDays && m.cycleDays <= 14) out.push({ tag: '規律回訪', basis: `約每 ${m.cycleDays} 天到訪` })
  if (m.fatigue.some((f) => f.lv === 3)) out.push({ tag: '需要多一點放鬆', basis: '有部位被觀察登記為「明顯」(非診斷)' })
  if (m.fatigue.some((f) => ['下背', '肩頸'].includes(f.part)) && m.cluster === 'C2') out.push({ tag: '久坐壓力族', basis: '疲勞部位集中下背/肩頸' })
  if (m.skin.some((s) => s.includes('雷射') || s.includes('光電'))) out.push({ tag: '保養期', basis: '近期有光電/雷射保養紀錄' })
  if (m.clinic.some((c) => c.status.includes('進行中') || c.status.includes('追蹤'))) out.push({ tag: '健康管理進行中', basis: '僅取「方案狀態」摘要,不含檢測數值' })
  if (bk.some((x) => x.status === '已取消' || x.status === '未到')) out.push({ tag: '時間較不固定', basis: '曾改期/未到,建議提供彈性時段' })
  if (bk.some((x) => x.src === 'LINE') && bk.filter((x) => x.src === 'LINE').length >= 2) out.push({ tag: '習慣 LINE 預約', basis: 'LINE 預約 2 次以上' })
  if ((POINTS[m.id] ?? 0) >= 300) out.push({ tag: '點數活躍', basis: `累積 ${POINTS[m.id]} 點` })
  if (!m.consent) out.push({ tag: '未同意推播', basis: '尚未同意 LINE 行銷訊息' })
  return out
}

/* ───── 2. 需求預測:下一個合適的品牌與機率 ───── */
export interface Prediction {
  from: BrandId
  to: BrandId
  title: string
  prob: number
  cold: boolean
  reasons: string[]
}
const TITLES: Record<BrandId, string> = { tai: '日常放鬆時光邀請', mei: '保養初體驗邀請', kang: '健康管理諮詢邀請' }

export function predict(m: Member): Prediction | null {
  if (m.brands.length >= 3) return null // 三品牌 VIP 不再交叉推薦,改走感謝關懷
  const missing = (['tai', 'mei', 'kang'] as BrandId[]).filter((b) => !m.brands.includes(b))
  const young = parseInt(m.band) <= 34
  let to: BrandId = missing[0]
  if (missing.includes('tai')) to = 'tai'
  else if (missing.includes('mei') && young) to = 'mei'
  else if (missing.includes('kang')) to = 'kang'
  const from = [...m.brands].sort((a, b) => (m.lastVisit[b] ?? '').localeCompare(m.lastVisit[a] ?? ''))[0]
  const bk = BOOKINGS[m.id] ?? []
  const done = bk.filter((x) => x.status === '已完成').length
  let prob = 38 + 12 * (m.brands.length - 1) + Math.min(done * 2, 10)
  if (m.cycleDays && m.cycleDays <= 21) prob += 8
  if (to === 'tai' && m.fatigue.some((f) => f.lv >= 2)) prob += 8
  prob = Math.min(prob, 86)
  const reasons = [
    `已使用:${m.brands.map((b) => ({ tai: '泰晶殿', mei: '美加', kang: '康博' })[b]).join('、')}`,
    m.cycleDays ? `到訪週期約 ${m.cycleDays} 天,下次預估 ${m.nextDue}` : '到訪週期資料不足',
    `近期完成預約 ${done} 次`,
  ]
  if (m.brands.length === 1) reasons.push(`依群集 ${m.cluster} 推估(假設),信心偏低`)
  return { from, to, title: TITLES[to], prob, cold: m.brands.length === 1, reasons }
}

/* ───── 3. 最佳時機 + 不打擾規則 ───── */
export interface Timing {
  label: string
  reason: string
  hold?: string
}
export const TIMING_OPTIONS = ['平日 12:10 午休時段', '平日 20:00 晚間放鬆時段', '平日 19:30 下班後', '下次預約前 3 天']

export function bestTiming(m: Member, sugs: Suggestion[]): Timing {
  const bk = (BOOKINGS[m.id] ?? []).filter((x) => x.status === '已完成')
  const hour = bk.length ? parseInt(bk[0].time) : 19
  const kv = m.lastVisit.kang
  if (kv && daysBetween(kv, TODAY) <= 3) {
    return { label: '平日 20:00 晚間放鬆時段', reason: '剛結束診所回診', hold: `回診後 3 日內先不打擾,建議 ${addDays(kv, 4)} 之後再排` }
  }
  if (sugs.some((s) => s.memberId === m.id && s.status === 'sent')) {
    return { label: '平日 12:10 午休時段', reason: '近期已推送過', hold: '14 天內最多一則,避免造成壓力' }
  }
  const label = hour >= 17 ? '平日 12:10 午休時段' : hour < 12 ? '平日 20:00 晚間放鬆時段' : '平日 19:30 下班後'
  const due = m.nextDue ? `,約在下次預約(${m.nextDue})前 3 天 ${addDays(m.nextDue, -3)}` : ''
  return { label, reason: `依常預約時段(${String(hour).padStart(2, '0')}:00 左右)避開忙碌時刻${due}` }
}

/* ───── 4. 溫暖度檢查(柔性提醒,不阻擋;法規用語仍由 findIssues 把關) ───── */
const PRESSURE: Record<string, string> = { 限時: '本月', 最後: '', 錯過: '', 立刻: '有空時', 趕快: '方便時', 馬上: '方便時', 只剩: '為您保留', 不然: '' }
export function toneCheck(text: string) {
  const pressure = Object.keys(PRESSURE).filter((w) => text.includes(w))
  const checks = [
    { ok: /小姐|先生|您好/.test(text), t: '有稱呼會員' },
    { ok: /感謝|辛苦|謝謝|用心/.test(text), t: '先表達感謝或關心' },
    { ok: /先不用|不需要|隨時|不用做任何決定|不急|有空/.test(text), t: '給對方沒有壓力的空間' },
    { ok: /先不用/.test(text), t: '附上「先不用」退出說明' },
    { ok: pressure.length === 0, t: '沒有催促/限時用語' },
  ]
  return { pressure, checks, score: checks.filter((c) => c.ok).length, total: checks.length }
}
export function warmRewrite(text: string) {
  let t = text
  Object.entries(PRESSURE).forEach(([k, v]) => (t = t.split(k).join(v)))
  if (!t.includes('先不用')) t = t.replace(/[。!]?$/, '。') + '若暫時不需要,回覆「先不用」,我們就不再提醒。'
  return t
}

/* ───── 5. 掃描產生建議(只處理已同意推播、無進行中建議、不在冷卻期者) ───── */
const DRAFTS: Record<BrandId, (n: string) => string> = {
  tai: (n) => `${n}您好,感謝您一直以來的信任。近期辛苦了,若想給自己一段安靜的放鬆時間,泰晶殿為您留了舒壓時段,不急,有空再看看就好。若暫時不需要,回覆「先不用」,我們就不再提醒。`,
  mei: (n) => `${n}您好,謝謝您的支持。若也想為自己留一點保養的時間,美加為您準備了初次膚質聊聊,不需要做任何決定,輕鬆來坐坐就好。若暫時不需要,回覆「先不用」,我們就不再提醒。`,
  kang: (n) => `${n}您好,感謝您的信任。想多了解自己的日常節奏時,康博提供輕鬆的健康管理諮詢,可以先聊聊,不需要馬上決定。若暫時不需要,回覆「先不用」,我們就不再提醒。`,
}
let gid = 1
export function scan(sugs: Suggestion[]) {
  const made: Suggestion[] = []
  const skipped: { name: string; why: string }[] = []
  for (const m of MEMBERS) {
    const p = predict(m)
    if (!p) { skipped.push({ name: m.name, why: '三品牌會員:不做交叉推薦,以感謝關懷為主' }); continue }
    if (!m.consent) { skipped.push({ name: m.name, why: '未同意推播' }); continue }
    if (sugs.some((s) => s.memberId === m.id && s.status !== 'booked')) continue
    const t = bestTiming(m, sugs)
    if (t.hold) { skipped.push({ name: m.name, why: t.hold }); continue }
    made.push({
      id: `g${gid++}`,
      memberId: m.id,
      from: p.from,
      to: p.to,
      title: p.title,
      draft: DRAFTS[p.to](m.name[0] + TITLE[m.id]),
      why: p.reasons,
      conf: p.prob,
      cold: p.cold,
      status: 'pending',
      sendAt: t.label,
      reward: { on: p.to !== 'kang' && (POINTS[m.id] ?? 0) >= 150, pts: 200 },
    })
  }
  return { made, skipped }
}
