export type BrandId = 'tai' | 'mei' | 'kang'
export type Level = 1 | 2 | 3

export const BRANDS: Record<
  BrandId,
  { name: string; sub: string; color: string; soft: string; deep: string; focus: string[] }
> = {
  tai: {
    name: '泰晶殿',
    sub: '養生舒壓',
    color: '#2a7f86',
    soft: '#d9ebe9',
    deep: '#1d5d66',
    focus: ['疲勞部位', '力道偏好', '消費週期', '日常狀態'],
  },
  mei: {
    name: '美加醫美',
    sub: '顏值管理',
    color: '#a8294f',
    soft: '#f7dfe6',
    deep: '#7e1c3a',
    focus: ['保養歷程', '膚質需求', '療程週期', '體態雕塑'],
  },
  kang: {
    name: '康博診所',
    sub: '預防醫學',
    color: '#1f78c1',
    soft: '#dcebf7',
    deep: '#14568a',
    focus: ['功能醫學', '檢測報告', '健康管理方案', '追蹤回診'],
  },
}

export interface Persona {
  id: string
  name: string
  role: string
  brand: BrandId | 'hq'
  maxLevel: Level
  canApprove: boolean
  avatar: string
}

export const PERSONAS: Persona[] = [
  { id: 'p1', name: '林師傅', role: '按摩師', brand: 'tai', maxLevel: 2, canApprove: false, avatar: '林' },
  { id: 'p2', name: '陳顧問', role: '醫美顧問', brand: 'mei', maxLevel: 2, canApprove: false, avatar: '陳' },
  { id: 'p3', name: '王護理師', role: '診所人員', brand: 'kang', maxLevel: 3, canApprove: false, avatar: '王' },
  { id: 'p4', name: '張店長', role: '店長', brand: 'hq', maxLevel: 2, canApprove: true, avatar: '張' },
]

export interface Member {
  id: string
  name: string
  band: string
  brands: BrandId[]
  tags: string[]
  lastVisit: Partial<Record<BrandId, string>>
  cycleDays: number | null
  nextDue: string | null
  fatigue: { part: string; lv: 1 | 2 | 3 }[]
  pressure: '輕' | '中' | '重' | null
  skin: string[]
  clinic: { item: string; status: string }[]
  signals: [number, number, number, number]
  cluster: string
  consent: boolean
  needs: string[]
}

export const MEMBERS: Member[] = [
  {
    id: 'm1',
    name: '黃○雯',
    band: '30–39',
    brands: ['tai', 'mei'],
    tags: ['雙品牌', '高頻'],
    lastVisit: { tai: '10/18', mei: '09/30' },
    cycleDays: 14,
    nextDue: '11/01',
    fatigue: [
      { part: '肩頸', lv: 3 },
      { part: '上背', lv: 2 },
    ],
    pressure: '中',
    skin: ['保濕保養 09/30', '光電諮詢 08/12'],
    clinic: [],
    signals: [82, 76, 64, 12],
    cluster: 'C1',
    consent: true,
    needs: ['體態雕塑諮詢'],
  },
  {
    id: 'm2',
    name: '吳○豪',
    band: '40–49',
    brands: ['tai', 'kang'],
    tags: ['雙品牌', '久坐族'],
    lastVisit: { tai: '10/20', kang: '09/14' },
    cycleDays: 21,
    nextDue: '11/10',
    fatigue: [
      { part: '下背', lv: 3 },
      { part: '小腿', lv: 1 },
    ],
    pressure: '重',
    skin: [],
    clinic: [
      { item: '功能醫學諮詢', status: '方案進行中' },
      { item: '血液檢測報告', status: '已建檔(受控)' },
    ],
    signals: [68, 70, 8, 74],
    cluster: 'C2',
    consent: true,
    needs: ['健康管理回診提醒'],
  },
  {
    id: 'm3',
    name: '李○婷',
    band: '25–34',
    brands: ['mei'],
    tags: ['單品牌', '冷啟動'],
    lastVisit: { mei: '10/05' },
    cycleDays: 28,
    nextDue: '11/02',
    fatigue: [],
    pressure: null,
    skin: ['雷射後保養 10/05', '膚質檢測 10/05'],
    clinic: [],
    signals: [40, 0, 85, 0],
    cluster: 'C3',
    consent: true,
    needs: [],
  },
  {
    id: 'm4',
    name: '周○成',
    band: '50–59',
    brands: ['kang'],
    tags: ['單品牌', '冷啟動'],
    lastVisit: { kang: '10/11' },
    cycleDays: 30,
    nextDue: '11/10',
    fatigue: [],
    pressure: null,
    skin: [],
    clinic: [
      { item: '生理檢測', status: '已完成' },
      { item: '追蹤回診', status: '待預約' },
    ],
    signals: [35, 0, 0, 88],
    cluster: 'C4',
    consent: true,
    needs: ['舒壓體驗(群集推估)'],
  },
  {
    id: 'm5',
    name: '蔡○妤',
    band: '30–39',
    brands: ['tai', 'mei', 'kang'],
    tags: ['三品牌', 'VIP'],
    lastVisit: { tai: '10/22', mei: '10/09', kang: '10/01' },
    cycleDays: 10,
    nextDue: '11/01',
    fatigue: [{ part: '肩頸', lv: 2 }],
    pressure: '輕',
    skin: ['保養療程 10/09'],
    clinic: [{ item: '功能醫學諮詢', status: '追蹤中' }],
    signals: [92, 55, 78, 66],
    cluster: 'C1',
    consent: true,
    needs: [],
  },
  {
    id: 'm6',
    name: '鄭○軒',
    band: '35–44',
    brands: ['tai'],
    tags: ['單品牌', '冷啟動'],
    lastVisit: { tai: '10/16' },
    cycleDays: 30,
    nextDue: '11/15',
    fatigue: [{ part: '腰臀', lv: 2 }],
    pressure: '中',
    skin: [],
    clinic: [],
    signals: [55, 48, 0, 0],
    cluster: 'C2',
    consent: false,
    needs: [],
  },
  {
    id: 'm7',
    name: '林○芬',
    band: '45–54',
    brands: ['tai'],
    tags: ['單品牌', '冷啟動'],
    lastVisit: { tai: '10/21' },
    cycleDays: 21,
    nextDue: '11/11',
    fatigue: [
      { part: '肩頸', lv: 2 },
      { part: '腰臀', lv: 1 },
    ],
    pressure: '輕',
    skin: [],
    clinic: [],
    signals: [58, 40, 0, 0],
    cluster: 'C2',
    consent: true,
    needs: [],
  },
  {
    id: 'm8',
    name: '許○睿',
    band: '28–37',
    brands: ['tai', 'mei'],
    tags: ['雙品牌', '高頻'],
    lastVisit: { tai: '10/24', mei: '10/12' },
    cycleDays: 14,
    nextDue: '11/07',
    fatigue: [{ part: '上背', lv: 1 }],
    pressure: '中',
    skin: ['光電保養 10/12'],
    clinic: [],
    signals: [72, 52, 70, 0],
    cluster: 'C1',
    consent: true,
    needs: [],
  },
  {
    id: 'm9',
    name: '陳○珊',
    band: '35–44',
    brands: ['mei', 'kang'],
    tags: ['雙品牌'],
    lastVisit: { mei: '10/14', kang: '10/08' },
    cycleDays: 21,
    nextDue: '11/04',
    fatigue: [],
    pressure: null,
    skin: ['保濕療程 10/14', '膚質檢測 09/02'],
    clinic: [{ item: '體重管理方案', status: '方案進行中' }],
    signals: [50, 0, 72, 64],
    cluster: 'C3',
    consent: true,
    needs: ['日常放鬆時間(群集推估)'],
  },
  {
    id: 'm10',
    name: '劉○賢',
    band: '55–64',
    brands: ['kang'],
    tags: ['單品牌', '冷啟動'],
    lastVisit: { kang: '10/15' },
    cycleDays: 30,
    nextDue: '11/14',
    fatigue: [],
    pressure: null,
    skin: [],
    clinic: [{ item: '追蹤回診', status: '已預約' }],
    signals: [30, 0, 0, 80],
    cluster: 'C4',
    consent: false,
    needs: [],
  },
  {
    id: 'm11',
    name: '楊○晴',
    band: '25–34',
    brands: ['tai'],
    tags: ['單品牌', '冷啟動', '高頻'],
    lastVisit: { tai: '10/25' },
    cycleDays: 14,
    nextDue: '11/08',
    fatigue: [
      { part: '肩頸', lv: 3 },
      { part: '小腿', lv: 2 },
    ],
    pressure: '中',
    skin: [],
    clinic: [],
    signals: [78, 60, 0, 0],
    cluster: 'C2',
    consent: true,
    needs: [],
  },
  {
    id: 'm12',
    name: '趙○倫',
    band: '40–49',
    brands: ['tai', 'kang'],
    tags: ['雙品牌'],
    lastVisit: { tai: '10/10', kang: '10/27' },
    cycleDays: 28,
    nextDue: '11/07',
    fatigue: [{ part: '下背', lv: 2 }],
    pressure: '重',
    skin: [],
    clinic: [{ item: '功能醫學諮詢', status: '追蹤中' }],
    signals: [52, 44, 0, 70],
    cluster: 'C2',
    consent: true,
    needs: [],
  },
]

export const CLUSTERS: Record<string, { name: string; desc: string; color: string; x: number; y: number }> = {
  C1: { name: '全方位自我管理', desc: '跨品牌、週期短', color: '#2a7f86', x: 74, y: 70 },
  C2: { name: '久坐壓力族', desc: '疲勞部位集中下背/肩頸', color: '#1f78c1', x: 36, y: 66 },
  C3: { name: '外觀保養族', desc: '以保養週期為主', color: '#a8294f', x: 66, y: 26 },
  C4: { name: '健康追蹤族', desc: '以檢測與回診為主', color: '#8a6bb0', x: 24, y: 24 },
}

export const BANNED: Record<string, string> = {
  治療: '照護',
  療效: '舒壓體驗',
  改善: '放鬆',
  神經痛: '緊繃感',
  診斷: '觀察',
  治癒: '舒緩',
  根治: '調理',
  消炎: '放鬆',
  降血糖: '日常管理',
  保證: '期待',
}

export type SugStatus = 'pending' | 'approved' | 'sent' | 'booked'

export interface Suggestion {
  id: string
  memberId: string
  from: BrandId
  to: BrandId
  title: string
  draft: string
  why: string[]
  conf: number
  cold: boolean
  status: SugStatus
  /** 排定推播時機(人員可調整) */
  sendAt?: string
  /** 企業點數轉介回饋(僅非醫療品牌) */
  reward?: { on: boolean; pts: number }
}

export const SUGGESTIONS: Suggestion[] = [
  {
    id: 's1',
    memberId: 'm1',
    from: 'tai',
    to: 'mei',
    title: '體態雕塑諮詢邀請',
    draft: '黃小姐您好,近期肩頸與上背常有緊繃感,這組體態雕塑課程能改善您的坐骨神經痛,歡迎預約免費體態評估。',
    why: ['泰晶殿:肩頸 / 上背連續 3 次標記「明顯」', '美加:有體態雕塑諮詢紀錄(08/12)', '消費週期穩定,約 14 天一次'],
    conf: 78,
    cold: false,
    status: 'pending',
  },
  {
    id: 's2',
    memberId: 'm2',
    from: 'kang',
    to: 'tai',
    title: '下背舒壓時段提醒',
    draft: '吳先生您好,依您的健康管理節奏,本週六下午有放鬆時段,可預約泰晶殿下背舒壓,為您保留 60 分鐘。',
    why: ['康博:功能醫學方案進行中(摘要,不含數值)', '泰晶殿:下背「明顯」標記 2 次', '力道偏好:重'],
    conf: 71,
    cold: false,
    status: 'pending',
  },
  {
    id: 's3',
    memberId: 'm4',
    from: 'kang',
    to: 'tai',
    title: '舒壓體驗初次邀請(冷啟動)',
    draft: '周先生您好,感謝您參與健康管理。本月推出初次舒壓體驗,歡迎預約,享輕鬆的肩頸放鬆時光。',
    why: ['僅有康博單一品牌紀錄', '依群集 C4「健康追蹤族」推估(假設)', '無泰晶殿歷史資料,信心偏低'],
    conf: 42,
    cold: true,
    status: 'pending',
  },
  {
    id: 's4',
    memberId: 'm3',
    from: 'mei',
    to: 'tai',
    title: '術後放鬆日常邀請',
    draft: '李小姐您好,保養週期之間,也歡迎體驗泰晶殿的全身放鬆時光,預約即贈熱敷茶飲。',
    why: ['僅有美加單一品牌紀錄', '依群集 C3「外觀保養族」推估(假設)'],
    conf: 48,
    cold: true,
    status: 'sent',
  },
  {
    id: 's5',
    memberId: 'm11',
    from: 'tai',
    to: 'mei',
    title: '保養初體驗邀請',
    draft: '楊小姐您好,謝謝您常來泰晶殿。工作辛苦了,若也想為自己留一點保養的時間,美加為您準備了初次膚質聊聊,不用做任何決定,輕鬆來坐坐就好。若暫時不需要,回覆「先不用」,我們就不再提醒。',
    why: ['僅有泰晶殿單一品牌紀錄', '到訪週期穩定,約 14 天一次', '依群集 C2 推估(假設),信心偏低'],
    conf: 56,
    cold: true,
    status: 'pending',
    sendAt: '平日 20:00 晚間放鬆時段',
    reward: { on: true, pts: 200 },
  },
  {
    id: 's6',
    memberId: 'm9',
    from: 'mei',
    to: 'tai',
    title: '日常放鬆時光邀請',
    draft: '陳小姐您好,感謝您一直以來的信任。保養與健康管理都很用心,也別忘了留點時間照顧自己的心情。泰晶殿有安靜的放鬆時段,有空再看看就好。回覆「先不用」即可停止提醒。',
    why: ['美加 + 康博 雙品牌,皆規律到訪', '尚無泰晶殿紀錄,依群集 C3 推估(假設)', '僅使用「有進行中方案」摘要,未使用任何檢測數值'],
    conf: 61,
    cold: false,
    status: 'pending',
    sendAt: '平日 12:10 午休時段',
    reward: { on: false, pts: 200 },
  },
]

export interface Appt {
  time: string
  member: string
  brand: BrandId
  svc: string
  src?: string
  note?: string
}

export const APPTS: Record<BrandId | 'hq', Appt[]> = {
  tai: [
    { time: '10:00', member: '黃○雯', brand: 'tai', svc: '肩頸舒壓 60 分', note: '上次肩頸標記明顯' },
    { time: '11:30', member: '鄭○軒', brand: 'tai', svc: '全身放鬆 90 分', src: '首次到訪' },
    { time: '14:00', member: '蔡○妤', brand: 'tai', svc: '香氛舒壓 60 分', note: '力道:輕' },
    { time: '16:30', member: '吳○豪', brand: 'tai', svc: '下背舒壓 60 分', src: 'LINE 預約(康博建議)' },
  ],
  mei: [
    { time: '10:30', member: '李○婷', brand: 'mei', svc: '保養療程諮詢', note: '冷啟動:資料少' },
    { time: '13:00', member: '黃○雯', brand: 'mei', svc: '體態評估', src: 'LINE 預約(泰晶殿建議)' },
    { time: '15:30', member: '蔡○妤', brand: 'mei', svc: '膚質檢測' },
  ],
  kang: [
    { time: '09:30', member: '周○成', brand: 'kang', svc: '追蹤回診', note: '待預約轉正式' },
    { time: '11:00', member: '吳○豪', brand: 'kang', svc: '功能醫學回診' },
    { time: '14:30', member: '蔡○妤', brand: 'kang', svc: '健康管理諮詢' },
  ],
  hq: [
    { time: '10:00', member: '黃○雯', brand: 'tai', svc: '肩頸舒壓 60 分' },
    { time: '11:00', member: '吳○豪', brand: 'kang', svc: '功能醫學回診' },
    { time: '13:00', member: '黃○雯', brand: 'mei', svc: '體態評估', src: 'LINE 預約' },
    { time: '14:00', member: '蔡○妤', brand: 'tai', svc: '香氛舒壓 60 分' },
  ],
}

// ───────── 以下為「預約紀錄 / 點數 / 稱謂」資料 ─────────
export type BookingStatus = '已完成' | '已預約' | '已取消' | '未到'
export interface Booking {
  date: string // MM/DD
  time: string // HH:MM
  brand: BrandId
  svc: string
  status: BookingStatus
  src: 'LINE' | '現場' | '電話' | 'AI 建議'
}

export const TITLE: Record<string, '小姐' | '先生'> = {
  m1: '小姐', m2: '先生', m3: '小姐', m4: '先生', m5: '小姐', m6: '先生',
  m7: '小姐', m8: '先生', m9: '小姐', m10: '先生', m11: '小姐', m12: '先生',
}

/** 企業點數(HCLife 集團通用,可跨品牌折抵非醫療服務) */
export const POINTS: Record<string, number> = {
  m1: 420, m2: 180, m3: 90, m4: 60, m5: 1260, m6: 0,
  m7: 150, m8: 380, m9: 310, m10: 40, m11: 220, m12: 130,
}

const b = (date: string, time: string, brand: BrandId, svc: string, status: BookingStatus, src: Booking['src']): Booking => ({ date, time, brand, svc, status, src })

export const BOOKINGS: Record<string, Booking[]> = {
  m1: [b('11/01', '10:00', 'tai', '肩頸舒壓 60 分', '已預約', 'LINE'), b('10/18', '10:00', 'tai', '肩頸舒壓 60 分', '已完成', 'LINE'), b('10/04', '10:30', 'tai', '肩頸舒壓 60 分', '已完成', '現場'), b('09/30', '14:00', 'mei', '保濕保養', '已完成', '電話'), b('08/12', '14:00', 'mei', '光電諮詢', '已完成', '現場')],
  m2: [b('11/10', '16:30', 'tai', '下背舒壓 60 分', '已預約', 'AI 建議'), b('10/20', '18:00', 'tai', '下背舒壓 60 分', '已完成', 'LINE'), b('09/29', '18:30', 'tai', '下背舒壓 60 分', '已取消', 'LINE'), b('09/14', '11:00', 'kang', '功能醫學回診', '已完成', '現場')],
  m3: [b('11/02', '10:30', 'mei', '保養療程諮詢', '已預約', 'LINE'), b('10/05', '10:30', 'mei', '雷射後保養', '已完成', '現場'), b('09/07', '10:30', 'mei', '膚質檢測', '已完成', '現場')],
  m4: [b('11/10', '09:30', 'kang', '追蹤回診', '已預約', '電話'), b('10/11', '09:30', 'kang', '生理檢測', '已完成', '現場')],
  m5: [b('11/01', '14:00', 'tai', '香氛舒壓 60 分', '已預約', 'LINE'), b('10/22', '14:00', 'tai', '香氛舒壓 60 分', '已完成', 'LINE'), b('10/09', '15:30', 'mei', '保養療程', '已完成', 'LINE'), b('10/01', '14:30', 'kang', '健康管理諮詢', '已完成', '現場'), b('09/20', '14:00', 'tai', '香氛舒壓 60 分', '已完成', 'LINE')],
  m6: [b('11/15', '11:30', 'tai', '全身放鬆 90 分', '已預約', '電話'), b('10/16', '11:30', 'tai', '全身放鬆 90 分', '已完成', '現場')],
  m7: [b('11/11', '15:00', 'tai', '肩頸舒壓 60 分', '已預約', '現場'), b('10/21', '15:00', 'tai', '肩頸舒壓 60 分', '已完成', '現場'), b('09/30', '15:00', 'tai', '全身放鬆 60 分', '已完成', '現場')],
  m8: [b('11/07', '19:00', 'tai', '上背舒壓 60 分', '已預約', 'LINE'), b('10/24', '19:00', 'tai', '上背舒壓 60 分', '已完成', 'LINE'), b('10/12', '12:30', 'mei', '光電保養', '已完成', 'LINE'), b('10/10', '19:00', 'tai', '上背舒壓 60 分', '未到', 'LINE')],
  m9: [b('11/04', '13:00', 'mei', '保濕療程', '已預約', 'LINE'), b('10/14', '13:00', 'mei', '保濕療程', '已完成', 'LINE'), b('10/08', '10:00', 'kang', '體重管理回診', '已完成', '現場'), b('09/02', '13:00', 'mei', '膚質檢測', '已完成', '現場')],
  m10: [b('11/14', '09:00', 'kang', '追蹤回診', '已預約', '電話'), b('10/15', '09:00', 'kang', '追蹤回診', '已完成', '現場')],
  m11: [b('11/08', '19:30', 'tai', '肩頸舒壓 60 分', '已預約', 'LINE'), b('10/25', '19:30', 'tai', '肩頸舒壓 60 分', '已完成', 'LINE'), b('10/11', '19:30', 'tai', '肩頸舒壓 60 分', '已完成', 'LINE'), b('09/27', '19:30', 'tai', '小腿放鬆 45 分', '已完成', 'LINE')],
  m12: [b('11/07', '10:30', 'kang', '功能醫學回診', '已預約', '電話'), b('10/27', '10:30', 'kang', '功能醫學回診', '已完成', '現場'), b('10/10', '17:30', 'tai', '下背舒壓 60 分', '已完成', 'LINE')],
}
