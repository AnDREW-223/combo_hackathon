"""將 SQLite 管理後台中的前端假資料匯出成可交付 PDF。"""

import json
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from backend.database import connect, initialize_database, member_payload, suggestion_payload

OUTPUT_PATH = Path(__file__).resolve().parents[1] / "output" / "pdf" / "康博管理後台_前端假資料總表.pdf"
FONT_PATH = Path(r"C:\Windows\Fonts\NotoSansTC-VF.ttf")
FONT_NAME = "NotoSansTC"


def paragraph(text: object, style: ParagraphStyle) -> Paragraph:
    # 前端假資料裡的 <br/> 是展示用換行標記；PDF 中改為真正換行。
    raw = str(text).replace("<br/>", "\n")
    safe = raw.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return Paragraph(safe.replace("\n", "<br/>"), style)


def compact_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ": "))


def footer(canvas, document) -> None:
    canvas.saveState()
    canvas.setFont(FONT_NAME, 8)
    canvas.setFillColor(colors.HexColor("#607580"))
    canvas.drawRightString(A4[0] - 18 * mm, 12 * mm, f"第 {document.page} 頁")
    canvas.restoreState()


def build_pdf() -> Path:
    initialize_database()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    # 使用 Windows 內建的繁體中文字型，避免 PDF 閱讀器缺少 CMap 而出現亂碼。
    pdfmetrics.registerFont(TTFont(FONT_NAME, str(FONT_PATH)))
    styles = getSampleStyleSheet()
    title = ParagraphStyle("TitleTw", parent=styles["Title"], fontName=FONT_NAME, fontSize=20, leading=28, textColor=colors.HexColor("#1D5D66"), alignment=TA_CENTER)
    heading = ParagraphStyle("HeadingTw", parent=styles["Heading2"], fontName=FONT_NAME, fontSize=14, leading=20, textColor=colors.HexColor("#1D5D66"), spaceBefore=10, spaceAfter=6)
    body = ParagraphStyle("BodyTw", parent=styles["BodyText"], fontName=FONT_NAME, fontSize=8.6, leading=13, alignment=TA_LEFT)
    small = ParagraphStyle("SmallTw", parent=body, fontSize=7.4, leading=10)
    header = ParagraphStyle("HeaderTw", parent=body, fontSize=8, leading=11, textColor=colors.white, alignment=TA_CENTER)

    with connect() as connection:
        members = [member_payload(row) for row in connection.execute("SELECT * FROM members ORDER BY id")]
        suggestions = [suggestion_payload(row) for row in connection.execute("SELECT * FROM suggestions ORDER BY created_at, id")]
        appointments = [dict(row) for row in connection.execute("SELECT * FROM appointments ORDER BY id")]

    story = [
        Spacer(1, 20 * mm),
        paragraph("康博管理後台 - 前端假資料總表", title),
        Spacer(1, 6 * mm),
        paragraph("資料來源：Frontend/src/data.ts。此文件僅供黑客松 Demo 與系統串接測試，不代表真實客戶資料或醫療建議。", body),
        Spacer(1, 8 * mm),
    ]
    overview = [[paragraph("資料類型", header), paragraph("筆數", header), paragraph("說明", header)],
                [paragraph("會員", body), paragraph(str(len(members)), body), paragraph("前端 MEMBERS 假資料", body)],
                [paragraph("推薦", body), paragraph(str(len(suggestions)), body), paragraph("前端 SUGGESTIONS 與 Agent 待審推薦", body)],
                [paragraph("預約", body), paragraph(str(len(appointments)), body), paragraph("前端 APPTS 假資料與 LINE 預約回寫", body)]]
    table = Table(overview, colWidths=[35 * mm, 25 * mm, 110 * mm])
    table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1D5D66")), ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#B9CED0")), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F3F8F8")]), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    story.extend([table, PageBreak(), paragraph("會員假資料", heading)])

    member_headers = ["ID", "會員", "年齡帶", "品牌 / 標籤", "最近到訪 / 週期", "觀察與需求", "同意推播"]
    member_rows = [[paragraph(item, header) for item in member_headers]]
    for member in members:
        observations = f"疲勞：{compact_json(member['fatigue'])}<br/>膚況：{', '.join(member['skin']) or '無'}<br/>診所：{compact_json(member['clinic'])}<br/>需求：{', '.join(member['needs']) or '無'}"
        member_rows.append([
            paragraph(member["id"], small), paragraph(member["name"], small), paragraph(member["band"], small),
            paragraph(f"{', '.join(member['brands'])}<br/>{', '.join(member['tags'])}", small),
            paragraph(f"{compact_json(member['last_visit'])}<br/>週期：{member['cycle_days'] or '未設定'} 天<br/>下次：{member['next_due'] or '未設定'}", small),
            paragraph(observations, small), paragraph("是" if member["consent"] else "否", small),
        ])
    member_table = Table(member_rows, colWidths=[12 * mm, 18 * mm, 16 * mm, 28 * mm, 30 * mm, 64 * mm, 14 * mm], repeatRows=1)
    member_table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1D5D66")), ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#B9CED0")), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7FBFB")]), ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
    story.extend([member_table, PageBreak(), paragraph("推薦假資料與審核狀態", heading)])

    suggestion_rows = [[paragraph(item, header) for item in ["ID", "會員", "來源 → 目標", "標題 / 信心", "文案草稿", "推薦依據", "狀態"]]]
    for item in suggestions:
        suggestion_rows.append([
            paragraph(item["id"], small), paragraph(item["memberId"], small),
            paragraph(f"{item['from']} → {item['to']}", small),
            paragraph(f"{item['title']}<br/>信心：{item['conf']}%", small),
            paragraph(item["draft"], small), paragraph("<br/>".join(item["why"]), small), paragraph(item["status"], small),
        ])
    suggestion_table = Table(suggestion_rows, colWidths=[20 * mm, 16 * mm, 22 * mm, 30 * mm, 50 * mm, 47 * mm, 18 * mm], repeatRows=1)
    suggestion_table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1D5D66")), ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#B9CED0")), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7FBFB")]), ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
    story.extend([suggestion_table, PageBreak(), paragraph("預約假資料", heading)])

    appointment_rows = [[paragraph(item, header) for item in ["時間", "會員", "品牌", "服務", "來源", "備註", "狀態"]]]
    for item in appointments:
        appointment_rows.append([paragraph(item.get("appointment_time") or "未指定", body), paragraph(item["member_name"], body), paragraph(item["brand"], body), paragraph(item["service"], body), paragraph(item.get("source") or "-", body), paragraph(item.get("note") or "-", body), paragraph(item["status"], body)])
    appointment_table = Table(appointment_rows, colWidths=[18 * mm, 24 * mm, 16 * mm, 43 * mm, 35 * mm, 40 * mm, 18 * mm], repeatRows=1)
    appointment_table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1D5D66")), ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#B9CED0")), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7FBFB")]), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
    story.append(appointment_table)

    document = SimpleDocTemplate(str(OUTPUT_PATH), pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=16 * mm, bottomMargin=20 * mm)
    document.build(story, onFirstPage=footer, onLaterPages=footer)
    return OUTPUT_PATH


if __name__ == "__main__":
    print(build_pdf())
