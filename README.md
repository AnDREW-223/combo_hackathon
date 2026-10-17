# 康博跨品牌推薦 Agent

這是黑客松 AI Agent 的初始開發骨架，參考 `Legal Assistant` 的 Python + FastAPI 啟動方式，以及康博系統藍圖的資料流。此版本只使用虛構資料，提供推薦預覽和回傳事件格式範例；不會讀取企業資料庫、不會呼叫 LLM、不會傳送 LINE 訊息，也不會把回傳事件寫入後端。

## 目前資料流

```text
企業後端（尚待確認 API 契約）
        ↓ 去識別化資料
FastAPI Agent → allowlist 示範推薦 → LINE（目前 dry-run）
        ↑ 回傳事件預覽（尚未回寫）
```

## 本機啟動

需要具備 `pip` 與 `venv` 的 Python 3.11 或更新版本。於專案根目錄執行 PowerShell：

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python -m uvicorn backend.main:app --reload
```

若 `venv` 建立失敗，請改用包含 `pip`／`venv` 的 Python 安裝版本，再執行上述步驟。

開啟 <http://127.0.0.1:8000/docs> 查看互動式 API 文件；`GET /` 可確認服務啟動。

## 預覽推薦

在 Swagger 的 `POST /api/agent/preview` 貼上虛構資料：

```json
{
  "profile": {
    "customer_ref": "DEMO-0001",
    "tags": ["舒壓按摩", "會員點數"],
    "health_tags": [],
    "available_points": 500
  }
}
```

`health_tags` 有值時，系統會標記 `review_required: true`，不會依它產生推薦。推薦只從程式內的示範 allowlist 選擇，文案不宣稱療效。

`POST /api/feedback/preview` 可預覽 LINE 意願事件的交換格式；目前只回應、不儲存、不回寫。

## 接下來需要團隊確認

1. 後端 API 的 URL、認證方式、欄位定義、去識別化方式與回寫格式。
2. 康博核准的跨品牌產品目錄、推薦規則與文案審核流程。
3. LLM 供應商、模型、資料處理界線與健康資料合規要求。
4. LINE Messaging API 的測試頻道、推播授權、Webhook 簽章驗證及 LIFF 網頁規格。

確認前請不要放入真實客戶資料、健康資料或任何正式金鑰。`.env` 已列入 `.gitignore`。
