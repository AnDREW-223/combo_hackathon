# 康博跨品牌 AI Agent 中介服務

這個專案是企業後端與 LINE 官方帳號之間的 AI Agent 中介服務，不是給消費者使用的獨立 App。`app/` 只是 Python 程式套件目錄名稱。服務以 Python + FastAPI 提供 API 節點；目前完成「Mock 顧客資料 → Python 特徵整理 → Gemini Generator → Gemini Validator → 結構化 JSON」，尚未串接真實後端或 LINE Messaging API。

```text
企業後端 ──顧客資料／請求──> AI Agent 中介服務 ──推薦結果──> LINE 官方帳號
企業後端 <──事件／互動結果── AI Agent <──使用者互動── LINE 官方帳號
```

目前程式只實作 AI Agent 中介服務的推薦 API 與 Mock 資料流程。後端資料介面、LINE 推播與互動 Webhook 會在取得 API 契約與 LINE 設定後再接上。

## 極簡目錄

```text
app/
├── __init__.py # app package
├── agents.py    # Gemini 用戶端、生成器、驗證器、提示詞、安全字詞檢查
├── config.py    # .env 與環境設定
├── main.py      # FastAPI app、/health 與 /recommend/{user_id}
├── schemas.py   # 所有 Pydantic 模型與資料結構
└── services.py  # Mock repository、特徵整理、服務清單、推薦流程
.env.example    # API Key 設定範本
.vscode/        # VS Code Python 與啟動設定
requirements.txt
```

## 從舊結構搬移的合併對照

| 舊檔案 | 新檔案／處理方式 |
| --- | --- |
| `app/agents/generator.py`、`app/agents/validator.py` | 合併到 `app/agents.py`；各自成為 `GeneratorAgent`、`ValidatorAgent` 類別 |
| `app/core/prompts.py` | 提示詞直接放在 `app/agents.py` 對應的 `generate()`、`validate()` 方法內 |
| `app/core/guardrails.py`、`app/services/gemini_client.py` | 合併到 `app/agents.py` |
| `app/models/customer.py`、`app/models/recommendation.py` | 合併到 `app/schemas.py` |
| `app/api/routes.py` | 合併到 `app/main.py`，路由直接定義在 FastAPI app |
| `app/core/config.py` | 移到扁平的 `app/config.py` |
| `app/services/customer_repository.py`、`feature_extractor.py`、`service_catalog.py`、`recommendation_service.py` | 合併到 `app/services.py` |
| 舊 `__init__.py` 與空子資料夾 | 刪除；Python 可直接以 `app.*` 匯入扁平模組 |

## 建置與啟動

需要 Python 3.11 或更新版本。在 PowerShell 專案根目錄執行：

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

將 `.env` 中的 `GEMINI_API_KEY=` 填入 Google AI Studio API Key，然後啟動：

```powershell
python -m uvicorn app.main:app --reload --port 8002
```

開啟 <http://127.0.0.1:8002/docs> 使用 Swagger。此工作區使用 8002 埠，因為本機 8000 與 8001 埠目前無法繫結。VS Code 可使用「FastAPI - 開發伺服器」啟動設定。

## API 範例

```http
GET  http://127.0.0.1:8002/health
POST http://127.0.0.1:8002/recommend/demo-001
```

示範帳號為 `demo-001` 與 `demo-002`；其他 ID 會回傳 404。未設定 Gemini Key 時，伺服器仍可啟動，推薦端點會回傳 503 設定提示。

## 安全與範圍

- `services.py` 使用虛構紀錄；Generator 只可選示範目錄中的服務。
- `SERVICE_CATALOG` 是依命題需求建立的候選項目，不代表官方療程名稱已核實或文案已獲准刊播。帶有醫療／醫美性質的項目須由提供服務的醫療機構、醫師與法遵人員審核；單加「評估」或「健康管理」字樣不等於合規。
- 消費紀錄先由 Python 彙整成一般偏好特徵；這些特徵會送到 Google Gemini API，原始紀錄不會送出。接入真實資料前，需確認同意、資料最小化與企業資料政策。
- Generator 與 Validator 各呼叫 Gemini 一次，並另有程式字詞檢查。輸出一律要求人工審核，不會直接推播。
- `health_tags` 是一般服務偏好標籤，不代表病歷或健康狀況。
- API Key 僅放在 `.env`，不要貼到聊天、前端程式或 GitHub。可由 [Google AI Studio](https://aistudio.google.com/apikey) 建立。
- LINE Messaging API、真實資料庫、身分驗證、點數核銷與正式法規審查尚未實作。
