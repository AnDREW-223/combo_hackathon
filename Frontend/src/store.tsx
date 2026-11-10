import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  APPTS,
  BRANDS,
  MEMBERS,
  PERSONAS,
  SUGGESTIONS,
  type Appt,
  type BrandId,
  type Persona,
  type Suggestion,
  type SugStatus,
} from './data'

export type View = 'home' | 'members' | 'log' | 'ai' | 'manager' | 'privacy'

export interface Audit {
  id: number
  t: string
  who: string
  act: string
  lv: 1 | 2 | 3
}
export interface Toast {
  id: number
  msg: string
  kind: 'ok' | 'warn'
}
export interface LogEntry {
  id: number
  memberId: string
  brand: BrandId
  summary: string
  secs: number
}

interface Store {
  persona: Persona
  setPersona: (id: string) => void
  view: View
  go: (v: View) => void
  openMember: string | null
  setOpenMember: (id: string | null) => void
  suggestions: Suggestion[]
  setStatus: (id: string, s: SugStatus) => Promise<boolean>
  editDraft: (id: string, d: string) => void
  addSuggestion: (s: Suggestion) => void
  audit: Audit[]
  addAudit: (act: string, lv?: 1 | 2 | 3) => void
  toast: (msg: string, kind?: 'ok' | 'warn') => void
  toasts: Toast[]
  logs: LogEntry[]
  addLog: (l: Omit<LogEntry, 'id'>) => void
  appts: Appt[]
  grants: string[]
  grant: (k: string) => void
  brandColor: string
  palette: boolean
  setPalette: (b: boolean) => void
}

const Ctx = createContext<Store>(null as unknown as Store)
export const useStore = () => useContext(Ctx)

const now = () => new Date().toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
let uid = 100
const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8100'

export function StoreProvider({ children }: { children: ReactNode }) {
  const [personaId, setPersonaId] = useState('p1')
  const [view, setView] = useState<View>('home')
  const [openMember, setOpenMember] = useState<string | null>(null)
  const [suggestions, setSugs] = useState<Suggestion[]>(SUGGESTIONS)
  const [audit, setAudit] = useState<Audit[]>([
    { id: 1, t: '08:12:40', who: '王護理師', act: '檢視 吳○豪 血液檢測摘要(特種個資)', lv: 3 },
    { id: 2, t: '08:40:05', who: '陳顧問', act: '送出 李○婷 的 LINE 建議(經審核)', lv: 1 },
    { id: 3, t: '09:02:18', who: '林師傅', act: '登記 黃○雯 疲勞部位觀察', lv: 2 },
  ])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [extra, setExtra] = useState<Appt[]>([])
  const [grants, setGrants] = useState<string[]>([])
  const [palette, setPalette] = useState(false)

  const persona = PERSONAS.find((p) => p.id === personaId)!

  const addAudit = useCallback(
    (act: string, lv: 1 | 2 | 3 = 1) => setAudit((a) => [{ id: uid++, t: now(), who: persona.name, act, lv }, ...a]),
    [persona.name],
  )
  const toast = useCallback((msg: string, kind: 'ok' | 'warn' = 'ok') => {
    const id = uid++
    setToasts((t) => [...t, { id, msg, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])

  useEffect(() => {
    fetch(`${backendUrl}/api/suggestions`)
      .then((response) => {
        if (!response.ok) throw new Error('後端未回應建議資料')
        return response.json() as Promise<Suggestion[]>
      })
      .then((items) => setSugs(items))
      .catch(() => {
        // 保留原本的前端假資料，讓後端暫時離線時畫面仍可展示。
      })
  }, [])

  const setStatus = useCallback(
    async (id: string, s: SugStatus) => {
      const original = suggestions.find((x) => x.id === id)
      const endpoint = s === 'approved'
        ? `/api/suggestions/${id}/approve`
        : s === 'sent'
          ? `/api/suggestions/${id}/mark-sent`
          : null
      if (endpoint) {
        try {
          const response = await fetch(`${backendUrl}${endpoint}`, { method: 'POST' })
          if (!response.ok) {
            const error = await response.json().catch(() => null)
            toast(typeof error?.detail === 'string' ? error.detail : `操作失敗（HTTP ${response.status}）`, 'warn')
            return false
          }
          const saved: Suggestion = await response.json()
          setSugs((list) => list.map((item) => (item.id === id ? saved : item)))
          return true
        } catch {
          toast('無法連線或讀取後端回應，請重新整理後再試', 'warn')
          return false
        }
      }
      setSugs((list) => list.map((x) => (x.id === id ? { ...x, status: s } : x)))
      if (s === 'booked') {
        const sug = original
        const m = MEMBERS.find((m) => m.id === sug?.memberId)
        if (sug && m)
          setExtra((e) => [
            { time: '17:30', member: m.name, brand: sug.to, svc: sug.title.replace('邀請', ''), src: `LINE 預約(${BRANDS[sug.from].name}建議)` },
            ...e,
          ])
      }
      return true
    },
    [suggestions, toast],
  )

  const appts = useMemo(() => {
    const base = APPTS[persona.brand]
    const mine = persona.brand === 'hq' ? extra : extra.filter((a) => a.brand === persona.brand)
    return [...base, ...mine]
  }, [persona.brand, extra])

  const value: Store = {
    persona,
    setPersona: (id) => {
      setPersonaId(id)
      const p = PERSONAS.find((x) => x.id === id)!
      const c = p.brand === 'hq' ? '#2a7f86' : BRANDS[p.brand].color
      const soft = p.brand === 'hq' ? '#d9ebe9' : BRANDS[p.brand].soft
      const deep = p.brand === 'hq' ? '#1d5d66' : BRANDS[p.brand].deep
      const r = document.documentElement.style
      r.setProperty('--brand', c)
      r.setProperty('--brand-soft', soft)
      r.setProperty('--brand-deep', deep)
      if (view === 'manager' && !p.canApprove) setView('home')
      toast(`已切換為 ${p.name}・${p.role}`)
    },
    view,
    go: (v) => {
      setView(v)
      setOpenMember(null)
    },
    openMember,
    setOpenMember,
    suggestions,
    setStatus,
    editDraft: (id, d) => setSugs((l) => l.map((x) => (x.id === id ? { ...x, draft: d } : x))),
    addSuggestion: (s) => setSugs((l) => [s, ...l]),
    audit,
    addAudit,
    toast,
    toasts,
    logs,
    addLog: (l) => setLogs((x) => [{ ...l, id: uid++ }, ...x]),
    appts,
    grants,
    grant: (k) => setGrants((g) => [...g, k]),
    brandColor: persona.brand === 'hq' ? '#2a7f86' : BRANDS[persona.brand].color,
    palette,
    setPalette,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
