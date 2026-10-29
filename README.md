# 康博跨品牌 AI Agent 中介服務

本專案是企業後端與 LINE 官方帳號之間的 AI Agent 節點，不是消費者使用的 App。
目前支援 Mock 顧客資料、Python 偏好特徵整理、免 LLM 的本機規則推薦、可選 Gemini 單階段生成、FastAPI API，以及 LINE Webhook 回覆。Gemini 只呼叫一次，輸出再由本機目錄與字詞規則檢查；企業正式資料庫和會員識別 API 尚未接入。

## 目錄

```text
app/
├── agents.py    # Gemini client、單階段 Generator 與文字安全檢查
├── config.py    # .env 設定載入
├── main.py      # FastAPI、health/recommend API、LINE callback
├── schemas.py   # Pydantic 資料契約
└── services.py  # 顧客資料介面、Mock、特徵整理、推薦協調
.vscode/         # Python interpreter 與 FastAPI 啟動設定
.env.example     # 環境變數範例，沒有真實金鑰
測試指南.md      # 本機、API、ngrok、LINE 實機測試與後端交接說明
requirements.txt
```

## 安裝與啟動

需要 Python 3.11 以上版本。在 PowerShell 專案根目錄執行：

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

預設 `AGENT_MODE=rule_based`，推薦時不呼叫 Gemini，也不需要 Gemini API Key。LINE 實機回覆仍需在 `.env` 設定 LINE 金鑰。只有要測試 Gemini 單階段流程時，才設定 Gemini API Key 並將本機 `.env` 的 `AGENT_MODE` 改成 `gemini`。VS Code 選取專案 `.venv` interpreter 後，可在 Run and Debug 選擇「FastAPI - 開發伺服器」；也可直接執行：

```powershell
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

完整的 API、LINE 實機測試與除錯步驟請看 [測試指南.md](./測試指南.md)。

## 企業後端資料接點

資料介面在 `app/services.py` 的 `CustomerRepository.get_history(user_id)`。目前 `create_customer_repository()` 回傳 `MockCustomerRepository`，因此 API 和 LINE demo 使用虛構資料。後端組員提供 API 規格後，會在 `BackendCustomerRepository.get_history()` 實作連線與資料轉換，再於 `create_customer_repository()` 切換資料來源。

LINE 身分對應的預留點在 `app/main.py` 的 `resolve_customer_id(event)`。目前固定回傳 `demo-001`；正式串接應以 LINE 的 `source.user_id` 呼叫企業會員綁定/識別 API，取得企業自己的 `customer_id`，不能直接把兩種 ID 當成相同值。

後端交接時請先確認：顧客查詢 endpoint、HTTP method、認證方式、逾時/錯誤格式、LINE ID 對應方式，以及是否允許 Agent 讀取消費/健康欄位。Agent 目前期待的資料形狀為 `CustomerHistory`：`user_id`、`available_points`、`purchases[]`；每筆消費包含 `brand`、`category`、`treatment`、`body_area`、`purchased_on`、`amount`。詳細交接與測試流程寫在 [測試指南.md](./測試指南.md)。

## 安全與推薦範圍

- `.env` 和 `agent_debug.log` 已列入 `.gitignore`，不要提交 API 金鑰或顧客資料。
- LINE Demo 目前固定把「推薦」請求對應到虛構使用者 `demo-001`；不論哪位 LINE 使用者發送，都會看到同一份假資料結果。正式串接前須以後端會員綁定 API 取代此示範對應。
- 目前特徵是從 Mock 消費紀錄整理的一般服務偏好，不是醫療診斷；正式接入健康資料前必須先確認同意、資料最小化及企業權限政策。
- Gemini 單次生成結果會經本機目錄與字詞檢查，仍要求人工審核；系統不應被視為醫療建議或正式法規審查。
- `SERVICE_CATALOG` 是原型候選清單，正式服務名稱、資格與文案需由品牌、醫療團隊和法遵確認。
