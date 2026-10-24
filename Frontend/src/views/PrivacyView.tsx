import { motion } from 'motion/react'
import { Ban, Check, Eye, FileLock2, MessageCircleOff, Minus } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '../store'
import { Card, Pill, Title } from '../ui'

const MATRIX = [
  ['L1 一般資料', '消費週期、偏好', [1, 1, 1, 1]],
  ['L2 服務觀察', '疲勞部位、保養歷程', [1, 1, 0, 1]],
  ['L3 特種個資', '血液指標、檢測報告', [0, 0, 1, 0]],
  ['跨品牌需求摘要', '僅標籤,無明細', [1, 1, 1, 1]],
] as const
const ROLES = ['按摩師', '醫美顧問', '診所人員', '店長']
const RULES = [
  ['按摩師只登記「觀察」', '偵測診斷用語即阻擋儲存'],
  ['非醫療品牌文案過濾', '含療效宣稱用語不得發送'],
  ['AI 建議須人員審核', '未核可不可推送 LINE'],
  ['會員同意與退訂', '未同意或已退訂即停用推送'],
]

export default function PrivacyView() {
  const { audit, persona } = useStore()
  const [lv, setLv] = useState<0 | 1 | 2 | 3>(0)
  const [on, setOn] = useState([true, true, true, true])
  const rows = audit.filter((a) => !lv || a.lv === lv)
  return (
    <div className="mx-auto grid max-w-[1500px] gap-5 xl:grid-cols-[1.2fr_1fr]">
      <div className="space-y-5">
        <Card>
          <Title>分級授權矩陣</Title>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead><tr className="text-left text-xs text-ink-soft"><th className="pb-3 font-semibold">資料等級</th>{ROLES.map((r) => <th key={r} className={`pb-3 text-center font-semibold ${r === persona.role ? 'text-brand' : ''}`}>{r}</th>)}</tr></thead>
              <tbody>
                {MATRIX.map(([a, b, v], i) => (
                  <motion.tr key={a} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="border-t border-line">
                    <td className="py-3.5"><b>{a}</b><div className="text-xs text-ink-soft">{b}</div></td>
                    {v.map((x, k) => (
                      <td key={k} className="text-center">{x ? <span className="inline-grid size-7 place-items-center rounded-full bg-teal-700 text-white"><Check className="size-4" /></span> : <span className="inline-grid size-7 place-items-center rounded-full bg-[#e9eef0] text-ink-soft"><Minus className="size-4" /></span>}</td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-ink-soft">矩陣為第一期設計假設,正式權限需經法務與資安確認。</p>
        </Card>
        <Card delay={0.1}>
          <Title>合規護欄(第一期)</Title>
          <div className="grid gap-3 md:grid-cols-2">
            {RULES.map(([t, d], i) => (
              <button key={t} onClick={() => setOn(on.map((x, k) => (k === i ? !x : x)))} className="flex items-center gap-3 rounded-xl bg-teal-50 p-4 text-left">
                <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${on[i] ? 'bg-brand' : 'bg-line'}`}><motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 30 }} className="absolute top-0.5 size-5 rounded-full bg-white" style={{ left: on[i] ? 22 : 2 }} /></span>
                <span><b className="block text-sm">{t}</b><span className="text-xs text-ink-soft">{d}</span></span>
              </button>
            ))}
          </div>
        </Card>
        <div className="grid gap-4 md:grid-cols-3">
          {[[Eye, '每次檢視皆留痕', 'L3 資料自動寫入稽核'], [MessageCircleOff, '一鍵退訂', '會員於 LINE 回覆即生效'], [FileLock2, '去識別化顯示', '姓名遮罩、最小必要']].map(([I, t, d], i) => {
            const Icon = I as typeof Eye
            return <Card key={t as string} delay={0.15 + i * 0.05} hover><Icon className="size-6 text-brand" /><div className="mt-2 font-bold">{t as string}</div><div className="text-xs text-ink-soft">{d as string}</div></Card>
          })}
        </div>
      </div>

      <Card delay={0.1} className="h-fit">
        <Title right={<Pill tone="teal">即時</Pill>}>稽核紀錄</Title>
        <div className="mb-4 flex gap-2">
          {([0, 1, 2, 3] as const).map((l) => (
            <button key={l} onClick={() => setLv(l)} className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${lv === l ? 'bg-brand text-white' : 'bg-canvas text-ink-soft'}`}>{l ? `L${l}` : '全部'}</button>
          ))}
        </div>
        <div className="relative space-y-1 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-line">
          {rows.map((a) => (
            <motion.div key={a.id} layout initial={{ opacity: 0, x: 20, background: '#d9ebe9' }} animate={{ opacity: 1, x: 0, background: '#ffffff00' }} transition={{ duration: 0.8 }} className="relative flex gap-4 rounded-lg py-2.5 pl-5 pr-2">
              <i className={`absolute left-0 top-4 size-[11px] rounded-full border-2 border-white ${a.lv === 3 ? 'bg-clinic' : a.lv === 2 ? 'bg-teal-700' : 'bg-teal-300'}`} />
              <div className="flex-1 text-sm"><span className="font-bold">{a.who}</span> {a.act}</div>
              <div className="shrink-0 text-right"><div className="num text-xs text-ink-soft">{a.t}</div>{a.lv === 3 && <Pill tone="blue">特種</Pill>}</div>
            </motion.div>
          ))}
          {!rows.length && <div className="py-8 text-center text-sm text-ink-soft"><Ban className="mx-auto mb-2 size-5" />無紀錄</div>}
        </div>
      </Card>
    </div>
  )
}
