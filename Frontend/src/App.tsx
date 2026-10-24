import { AnimatePresence, motion } from 'motion/react'
import { BarChart3, Bell, CheckCircle2, ChevronDown, Home, Menu, PencilLine, Search, ShieldCheck, Sparkles, TriangleAlert, Users, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { BRANDS, MEMBERS, PERSONAS } from './data'
import { StoreProvider, useStore, type View } from './store'
import { Avatar, ease } from './ui'
import HomeView from './views/HomeView'
import MembersView from './views/MembersView'
import LogView from './views/LogView'
import AIView from './views/AIView'
import ManagerView from './views/ManagerView'
import PrivacyView from './views/PrivacyView'

const NAV: { id: View; label: string; icon: typeof Home; managerOnly?: boolean }[] = [
  { id: 'home', label: '工作台', icon: Home },
  { id: 'members', label: '會員檢索', icon: Users },
  { id: 'log', label: '快速登記', icon: PencilLine },
  { id: 'ai', label: 'AI 建議審核', icon: Sparkles },
  { id: 'manager', label: '店長總覽', icon: BarChart3, managerOnly: true },
  { id: 'privacy', label: '隱私與稽核', icon: ShieldCheck },
]

function Shell() {
  const { view, go, persona, setPersona, toasts, suggestions, palette, setPalette, setOpenMember } = useStore()
  const [wide, setWide] = useState(false)
  const [menu, setMenu] = useState(false)
  const [bell, setBell] = useState(false)
  const pending = suggestions.filter((s) => s.status === 'pending').length
  const nav = NAV.filter((n) => !n.managerOnly || persona.canApprove)

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette(true)
      }
      if (e.key === 'Escape') {
        setPalette(false)
        setMenu(false)
        setBell(false)
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [setPalette])

  const Page = { home: HomeView, members: MembersView, log: LogView, ai: AIView, manager: ManagerView, privacy: PrivacyView }[view]

  return (
    <div className="flex h-full">
      <motion.aside
        animate={{ width: wide ? 224 : 84 }}
        transition={{ duration: 0.35, ease }}
        className="relative z-30 flex shrink-0 flex-col bg-teal-800 py-5 text-white"
      >
        <div className="flex items-center gap-3 px-5">
          <svg viewBox="0 0 48 48" className="size-11 shrink-0">
            <circle cx="24" cy="24" r="22" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="30 8" className="origin-center" />
            <path d="M14 26c4-10 16-12 20-4-6-2-12 0-14 8-2-1-4-2-6-4z" fill="#fff" />
            <circle cx="30" cy="30" r="4" fill="#8cc7c3" />
          </svg>
          {wide && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="leading-tight">
              <div className="text-lg font-black tracking-wide">CalmPort</div>
              <div className="text-[11px] text-teal-100">康博・後臺管理</div>
            </motion.div>
          )}
        </div>
        <nav className="mt-10 flex flex-1 flex-col gap-2 px-3.5">
          {nav.map((n) => {
            const on = view === n.id
            return (
              <button
                key={n.id}
                onClick={() => go(n.id)}
                title={n.label}
                className="relative flex h-[52px] items-center gap-3 rounded-xl px-[15px] text-left text-sm font-semibold transition-colors hover:bg-white/10"
              >
                {on && <motion.span layoutId="navbg" className="absolute inset-0 rounded-xl bg-white/20" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                <n.icon className="relative size-[22px] shrink-0" strokeWidth={on ? 2.4 : 1.8} />
                {wide && <span className="relative whitespace-nowrap">{n.label}</span>}
                {n.id === 'ai' && pending > 0 && (
                  <span className="pulse-ring absolute right-2 top-2 grid size-[18px] place-items-center rounded-full bg-crimson text-[10px] font-bold">{pending}</span>
                )}
              </button>
            )
          })}
        </nav>
        {/* <div className="px-3.5 text-[10px] leading-snug text-teal-100/80">
          {wide ? '示意資料皆為虛構;不確定項目標示「假設」。' : <span className="block text-center">假設</span>}
        </div> */}
      </motion.aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-20 flex h-[76px] shrink-0 items-center gap-4 bg-white px-6">
          <button onClick={() => setWide(!wide)} aria-label="展開選單" className="grid size-10 place-items-center rounded-lg text-teal-800 hover:bg-teal-50">
            <Menu />
          </button>
          <button
            onClick={() => setPalette(true)}
            className="hidden h-11 w-full max-w-md items-center gap-3 rounded-xl bg-canvas px-4 text-sm text-ink-soft transition hover:ring-2 hover:ring-brand md:flex"
          >
            <Search className="size-4" />
            搜尋會員、功能…
            <kbd className="num ml-auto rounded bg-white px-1.5 py-0.5 text-[11px]">⌘K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand lg:flex">
              <span className="pulse-ring size-2 rounded-full bg-crimson" />
              {persona.brand === 'hq' ? '集團總覽' : BRANDS[persona.brand].name}
            </div>
            <div className="relative">
              <button onClick={() => { setBell(!bell); setMenu(false) }} className="relative grid size-11 place-items-center rounded-xl bg-teal-50 text-teal-900">
                <Bell className="size-5" />
                <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-crimson" />
              </button>
              <AnimatePresence>
                {bell && (
                  <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} className="absolute right-0 top-14 w-80 rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-line">
                    <div className="mb-2 text-sm font-bold text-brand">通知</div>
                    {[
                      [`${pending} 則 AI 建議待審核`, 'ai'],
                      ['黃○雯 已透過 LINE 預約體態評估', 'home'],
                      ['鄭○軒 尚未同意 LINE 推播', 'members'],
                    ].map(([t, v]) => (
                      <button key={t} onClick={() => { go(v as View); setBell(false) }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2.5 text-left text-sm hover:bg-teal-50">
                        <span className="size-1.5 rounded-full bg-crimson" />
                        {t}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="relative">
              <button onClick={() => { setMenu(!menu); setBell(false) }} className="flex items-center gap-3 rounded-xl py-1 pl-1 pr-3 hover:bg-teal-50">
                <Avatar text={persona.avatar} size={44} />
                <div className="hidden text-left leading-tight sm:block">
                  <div className="text-sm font-bold">{persona.name}</div>
                  <div className="text-xs text-ink-soft">{persona.role}</div>
                </div>
                <ChevronDown className="size-4 text-ink-soft" />
              </button>
              <AnimatePresence>
                {menu && (
                  <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} className="absolute right-0 top-16 w-72 rounded-2xl bg-white p-3 shadow-2xl ring-1 ring-line">
                    <div className="px-2 pb-2 text-[11px] font-semibold text-ink-soft">切換身分(示範用)</div>
                    {PERSONAS.map((p) => (
                      <button key={p.id} onClick={() => { setPersona(p.id); setMenu(false) }} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-teal-50">
                        <Avatar text={p.avatar} size={36} color={p.brand === 'hq' ? '#2a7f86' : BRANDS[p.brand].color} />
                        <div className="flex-1 leading-tight">
                          <div className="text-sm font-bold">{p.name}</div>
                          <div className="text-xs text-ink-soft">
                            {p.role}・資料等級 L{p.maxLevel}
                          </div>
                        </div>
                        {p.id === persona.id && <CheckCircle2 className="size-5 text-brand" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <main className="relative min-h-0 flex-1 overflow-y-auto" onClick={() => { setMenu(false); setBell(false) }}>
          <AnimatePresence mode="wait">
            <motion.div key={view + persona.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.28, ease }} className="p-5 lg:p-6">
              <Page />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <Palette open={palette} close={() => setPalette(false)} go={go} openMember={(id) => { go('members'); setTimeout(() => setOpenMember(id), 50) }} />

      <div className="pointer-events-none fixed bottom-6 left-1/2 z-[80] flex -translate-x-1/2 flex-col items-center gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id} layout initial={{ opacity: 0, y: 30, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }} className={`flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-xl ${t.kind === 'ok' ? 'bg-teal-900' : 'bg-crimson'}`}>
              {t.kind === 'ok' ? <CheckCircle2 className="size-4" /> : <TriangleAlert className="size-4" />}
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

function Palette({ open, close, go, openMember }: { open: boolean; close: () => void; go: (v: View) => void; openMember: (id: string) => void }) {
  const [q, setQ] = useState('')
  const items = useMemo(() => {
    const all = [
      ...NAV.map((n) => ({ k: n.id, label: `前往・${n.label}`, run: () => go(n.id) })),
      ...MEMBERS.map((m) => ({ k: m.id, label: `會員・${m.name}(${m.band})`, run: () => openMember(m.id) })),
    ]
    return all.filter((i) => i.label.includes(q))
  }, [q, go, openMember])
  useEffect(() => {
    if (open) setQ('')
  }, [open])
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] grid place-items-start justify-center bg-teal-950/50 pt-[14vh] backdrop-blur-sm" onClick={close}>
          <motion.div initial={{ y: -20, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={{ y: -20, scale: 0.96 }} onClick={(e) => e.stopPropagation()} className="w-[min(560px,92vw)] overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-line px-5">
              <Search className="size-5 text-brand" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && items[0]) {
                    items[0].run()
                    close()
                  }
                }}
                placeholder="輸入姓氏、功能名稱…"
                className="h-14 flex-1 bg-transparent text-base outline-none"
              />
              <button onClick={close}>
                <X className="size-5 text-ink-soft" />
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto p-2">
              {items.map((i, idx) => (
                <motion.button key={i.k} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.02 }} onClick={() => { i.run(); close() }} className="flex w-full items-center rounded-xl px-4 py-3 text-left text-sm hover:bg-teal-50">
                  {i.label}
                </motion.button>
              ))}
              {!items.length && <div className="p-6 text-center text-sm text-ink-soft">沒有符合的結果</div>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
