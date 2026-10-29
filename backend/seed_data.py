"""從 Frontend/src/data.ts 轉錄的黑客松示範資料。"""

MEMBERS = [
    {"id": "m1", "name": "黃○雯", "band": "30–39", "brands": ["tai", "mei"], "tags": ["雙品牌", "高頻"], "last_visit": {"tai": "10/18", "mei": "09/30"}, "cycle_days": 14, "next_due": "11/01", "fatigue": [{"part": "肩頸", "lv": 3}, {"part": "上背", "lv": 2}], "pressure": "中", "skin": ["保濕保養 09/30", "光電諮詢 08/12"], "clinic": [], "signals": [82, 76, 64, 12], "cluster": "C1", "consent": True, "needs": ["體態雕塑諮詢"]},
    {"id": "m2", "name": "吳○豪", "band": "40–49", "brands": ["tai", "kang"], "tags": ["雙品牌", "久坐族"], "last_visit": {"tai": "10/20", "kang": "09/14"}, "cycle_days": 21, "next_due": "11/10", "fatigue": [{"part": "下背", "lv": 3}, {"part": "小腿", "lv": 1}], "pressure": "重", "skin": [], "clinic": [{"item": "功能醫學諮詢", "status": "方案進行中"}, {"item": "血液檢測報告", "status": "已建檔(受控)"}], "signals": [68, 70, 8, 74], "cluster": "C2", "consent": True, "needs": ["健康管理回診提醒"]},
    {"id": "m3", "name": "李○婷", "band": "25–34", "brands": ["mei"], "tags": ["單品牌", "冷啟動"], "last_visit": {"mei": "10/05"}, "cycle_days": 28, "next_due": "11/02", "fatigue": [], "pressure": None, "skin": ["雷射後保養 10/05", "膚質檢測 10/05"], "clinic": [], "signals": [40, 0, 85, 0], "cluster": "C3", "consent": True, "needs": []},
    {"id": "m4", "name": "周○成", "band": "50–59", "brands": ["kang"], "tags": ["單品牌", "冷啟動"], "last_visit": {"kang": "10/11"}, "cycle_days": 30, "next_due": "11/10", "fatigue": [], "pressure": None, "skin": [], "clinic": [{"item": "生理檢測", "status": "已完成"}, {"item": "追蹤回診", "status": "待預約"}], "signals": [35, 0, 0, 88], "cluster": "C4", "consent": True, "needs": ["舒壓體驗(群集推估)"]},
    {"id": "m5", "name": "蔡○妤", "band": "30–39", "brands": ["tai", "mei", "kang"], "tags": ["三品牌", "VIP"], "last_visit": {"tai": "10/22", "mei": "10/09", "kang": "10/01"}, "cycle_days": 10, "next_due": "11/01", "fatigue": [{"part": "肩頸", "lv": 2}], "pressure": "輕", "skin": ["保養療程 10/09"], "clinic": [{"item": "功能醫學諮詢", "status": "追蹤中"}], "signals": [92, 55, 78, 66], "cluster": "C1", "consent": True, "needs": []},
    {"id": "m6", "name": "鄭○軒", "band": "35–44", "brands": ["tai"], "tags": ["單品牌", "冷啟動"], "last_visit": {"tai": "10/16"}, "cycle_days": 30, "next_due": "11/15", "fatigue": [{"part": "腰臀", "lv": 2}], "pressure": "中", "skin": [], "clinic": [], "signals": [55, 48, 0, 0], "cluster": "C2", "consent": False, "needs": []},
]

SUGGESTIONS = [
    {"id": "s1", "member_id": "m1", "from_brand": "tai", "to_brand": "mei", "title": "體態雕塑諮詢邀請", "draft": "黃小姐您好,近期肩頸與上背常有緊繃感,這組體態雕塑課程能改善您的坐骨神經痛,歡迎預約免費體態評估。", "why": ["泰晶殿:肩頸 / 上背連續 3 次標記「明顯」", "美加:有體態雕塑諮詢紀錄(08/12)", "消費週期穩定,約 14 天一次"], "confidence": 78, "cold": False, "status": "pending"},
    {"id": "s2", "member_id": "m2", "from_brand": "kang", "to_brand": "tai", "title": "下背舒壓時段提醒", "draft": "吳先生您好,依您的健康管理節奏,本週六下午有放鬆時段,可預約泰晶殿下背舒壓,為您保留 60 分鐘。", "why": ["康博:功能醫學方案進行中(摘要,不含數值)", "泰晶殿:下背「明顯」標記 2 次", "力道偏好:重"], "confidence": 71, "cold": False, "status": "pending"},
    {"id": "s3", "member_id": "m4", "from_brand": "kang", "to_brand": "tai", "title": "舒壓體驗初次邀請(冷啟動)", "draft": "周先生您好,感謝您參與健康管理。本月推出初次舒壓體驗,歡迎預約,享輕鬆的肩頸放鬆時光。", "why": ["僅有康博單一品牌紀錄", "依群集 C4「健康追蹤族」推估(假設)", "無泰晶殿歷史資料,信心偏低"], "confidence": 42, "cold": True, "status": "pending"},
    {"id": "s4", "member_id": "m3", "from_brand": "mei", "to_brand": "tai", "title": "術後放鬆日常邀請", "draft": "李小姐您好,保養週期之間,也歡迎體驗泰晶殿的全身放鬆時光,預約即贈熱敷茶飲。", "why": ["僅有美加單一品牌紀錄", "依群集 C3「外觀保養族」推估(假設)"], "confidence": 48, "cold": True, "status": "sent"},
]

APPOINTMENTS = [
    {"time": "10:00", "member": "黃○雯", "brand": "tai", "service": "肩頸舒壓 60 分", "source": None, "note": "上次肩頸標記明顯"},
    {"time": "11:30", "member": "鄭○軒", "brand": "tai", "service": "全身放鬆 90 分", "source": "首次到訪", "note": None},
    {"time": "14:00", "member": "蔡○妤", "brand": "tai", "service": "香氛舒壓 60 分", "source": None, "note": "力道:輕"},
    {"time": "16:30", "member": "吳○豪", "brand": "tai", "service": "下背舒壓 60 分", "source": "LINE 預約(康博建議)", "note": None},
    {"time": "10:30", "member": "李○婷", "brand": "mei", "service": "保養療程諮詢", "source": None, "note": "冷啟動:資料少"},
    {"time": "13:00", "member": "黃○雯", "brand": "mei", "service": "體態評估", "source": "LINE 預約(泰晶殿建議)", "note": None},
    {"time": "15:30", "member": "蔡○妤", "brand": "mei", "service": "膚質檢測", "source": None, "note": None},
    {"time": "09:30", "member": "周○成", "brand": "kang", "service": "追蹤回診", "source": None, "note": "待預約轉正式"},
    {"time": "11:00", "member": "吳○豪", "brand": "kang", "service": "功能醫學回診", "source": None, "note": None},
    {"time": "14:30", "member": "蔡○妤", "brand": "kang", "service": "健康管理諮詢", "source": None, "note": None},
]
