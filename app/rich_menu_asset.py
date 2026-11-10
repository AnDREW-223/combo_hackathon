"""產生 LINE 的 2×2 圖文選單。"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def main() -> None:
    canvas = Image.new("RGB", (2500, 1686), "#FFFFFF")
    font_path = Path(r"C:\Windows\Fonts\msjh.ttc")
    title = ImageFont.truetype(str(font_path), 86)
    items = [
        ("專屬推薦", "#E4F3EE"),
        ("我的預約", "#EBF6F3"),
        ("查看點數", "#E5F3F3"),
        ("使用說明", "#EDF5EF"),
    ]
    ink = "#207D80"
    for index, (label, color) in enumerate(items):
        tile = Image.new("RGB", (1250, 843), "#FFFFFF")
        draw = ImageDraw.Draw(tile)
        center = 625
        draw.rounded_rectangle((24, 24, 1226, 819), 64, fill=color)
        draw.arc((center - 159, 145, center + 159, 463), 205, 353, fill="#8DC7B7", width=15)
        draw.arc((center - 159, 145, center + 159, 463), 25, 173, fill="#55AAA9", width=15)
        if index == 0:
            draw.polygon([(center, 207), (center + 30, 271), (center + 95, 303), (center + 30, 333), (center, 397), (center - 30, 333), (center - 95, 303), (center - 30, 271)], outline=ink, width=13)
        elif index == 1:
            draw.rounded_rectangle((center - 95, 230, center + 95, 387), 22, outline=ink, width=13)
            draw.line((center - 93, 275, center + 93, 275), fill=ink, width=12)
            for offset in (-48, 48):
                draw.line((center + offset, 208, center + offset, 249), fill=ink, width=14)
            draw.line([(center - 39, 328), (center - 10, 353), (center + 43, 306)], fill=ink, width=13, joint="curve")
        elif index == 2:
            draw.ellipse((center - 92, 212, center + 92, 396), outline=ink, width=13)
            draw.polygon([(center, 251), (center + 48, 304), (center, 357), (center - 48, 304)], outline=ink, width=12)
        else:
            draw.text((center, 304), "?", font=ImageFont.truetype(str(font_path), 190), anchor="mm", fill=ink)
        draw.text((center, 591), label, font=title, anchor="mm", fill="#555B5B")
        canvas.paste(tile, (index % 2 * 1250, index // 2 * 843))
    path = Path(__file__).resolve().parents[1] / "output" / "line-rich-menu.png"
    path.parent.mkdir(exist_ok=True)
    canvas.save(path, optimize=True)
    print(path)


if __name__ == "__main__":
    main()
