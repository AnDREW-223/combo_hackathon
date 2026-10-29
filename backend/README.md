# 康博管理後台 Backend

此服務以 SQLite 保存 `Frontend/src/data.ts` 的黑客松假資料，並保存 AI 推薦的審核狀態、LINE 傳送紀錄與預約意願。

啟動：

```powershell
..\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8100
```

主要 API：

- `GET /api/members`：管理後台會員資料
- `GET /api/suggestions`：待審、已核可、已推送與預約推薦
- `POST /api/suggestions/{id}/approve`：人員核可
- `POST /api/suggestions/{id}/mark-sent`：記錄已核可的 LINE 推送
- `POST /api/agent/recommendations`：AI Agent 將推薦送入待審佇列
- `GET /api/agent/customers/demo-001`：AI Agent 讀取前端 m1 假資料的轉換版本
- `POST /api/appointments`：LINE 預約意願回寫
