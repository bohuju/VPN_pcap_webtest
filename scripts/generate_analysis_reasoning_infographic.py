from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


WIDTH = 1800
HEIGHT = 2200
BG = "#f6f8fc"
TEXT = "#1f2937"
MUTED = "#5b6475"
LINE = "#d7ddea"
PANEL = "#ffffff"
BLUE = "#dbeafe"
BLUE_EDGE = "#60a5fa"
GREEN = "#dcfce7"
GREEN_EDGE = "#34d399"
AMBER = "#fef3c7"
AMBER_EDGE = "#f59e0b"
ROSE = "#ffe4e6"
ROSE_EDGE = "#fb7185"
VIOLET = "#ede9fe"
VIOLET_EDGE = "#8b5cf6"

COMMON = "#4caf50"
PROXY = "#ff9800"
VPN = "#f44336"

FONT_REG = "/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc"
FONT_BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"


def font(size: int, bold: bool = False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)


def wrap_text(draw: ImageDraw.ImageDraw, text: str, fnt, max_width: int):
    lines = []
    for para in text.split("\n"):
        if not para:
            lines.append("")
            continue
        current = ""
        for ch in para:
            test = current + ch
            if draw.textbbox((0, 0), test, font=fnt)[2] <= max_width:
                current = test
            else:
                if current:
                    lines.append(current)
                current = ch
        if current:
            lines.append(current)
    return lines


def draw_paragraph(draw, xy, text, fnt, fill, max_width, line_gap=10):
    x, y = xy
    lines = wrap_text(draw, text, fnt, max_width)
    line_h = draw.textbbox((0, 0), "测A", font=fnt)[3] + line_gap
    for line in lines:
        draw.text((x, y), line, font=fnt, fill=fill)
        y += line_h
    return y


def rounded_box(draw, box, fill, outline, radius=28, width=3):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def arrow(draw, start, end, color="#7c8799", width=5, head=16):
    draw.line([start, end], fill=color, width=width)
    x1, y1 = start
    x2, y2 = end
    dx, dy = x2 - x1, y2 - y1
    length = max((dx * dx + dy * dy) ** 0.5, 1)
    ux, uy = dx / length, dy / length
    px, py = -uy, ux
    p1 = (x2, y2)
    p2 = (x2 - ux * head - px * head * 0.6, y2 - uy * head - py * head * 0.6)
    p3 = (x2 - ux * head + px * head * 0.6, y2 - uy * head + py * head * 0.6)
    draw.polygon([p1, p2, p3], fill=color)


def section_title(draw, x, y, title, subtitle, accent):
    draw.rounded_rectangle((x, y, x + 18, y + 72), radius=8, fill=accent)
    draw.text((x + 34, y - 4), title, font=font(34, True), fill=TEXT)
    draw.text((x + 36, y + 40), subtitle, font=font(20), fill=MUTED)


def bullet_card(draw, box, title, bullets, fill, outline):
    rounded_box(draw, box, fill, outline)
    x1, y1, x2, y2 = box
    draw.text((x1 + 24, y1 + 18), title, font=font(24, True), fill=TEXT)
    y = y1 + 62
    for bullet in bullets:
        draw.ellipse((x1 + 28, y + 10, x1 + 40, y + 22), fill=outline)
        y = draw_paragraph(draw, (x1 + 52, y), bullet, font(20), TEXT, x2 - x1 - 80, line_gap=8) + 16


def tag(draw, x, y, text, bg, fg="#111827"):
    bbox = draw.textbbox((0, 0), text, font=font(18, True))
    w = bbox[2] - bbox[0] + 28
    h = bbox[3] - bbox[1] + 16
    draw.rounded_rectangle((x, y, x + w, y + h), radius=16, fill=bg)
    draw.text((x + 14, y + 7), text, font=font(18, True), fill=fg)
    return w


def main():
    out = Path("generated_images/ai_reasoning_from_preprocessed_data.png")
    img = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(img)

    draw.rounded_rectangle((40, 40, WIDTH - 40, HEIGHT - 40), radius=40, fill="#f9fbff", outline=LINE, width=2)

    draw.text((90, 90), "网页中的预处理分析结果，AI 是如何一步步得出结论的？", font=font(46, True), fill=TEXT)
    draw.text((92, 156), "这张图解释的不是“模型黑盒预测”，而是 AI 如何阅读网页上的统计结果、组织证据、输出可解释结论。", font=font(24), fill=MUTED)

    tag(draw, 92, 208, "数据来源：/api/stats /api/analysis/*", BLUE, "#1d4ed8")
    tag(draw, 430, 208, "网页页面：概览 / 协议 / 包大小 / 流分析 / 时间序列", GREEN, "#047857")

    section_title(draw, 92, 286, "1. 网页展示了什么", "AI 的输入不是原始抓包，而是已经预处理好的统计结果。", "#3b82f6")

    left_x = 92
    right_x = 930
    top = 390
    card_w = 770
    card_h = 235
    gap = 24

    bullet_card(
        draw,
        (left_x, top, left_x + card_w, top + card_h),
        "统计卡片 / 全局规模",
        [
            "文件数、总包数、总字节数、平均包长，用来先判断三类流量的总体规模差异。",
            "AI 会先看“量级差别”是否明显，再决定后面应该重点解释结构差异还是总量差异。 ",
        ],
        BLUE,
        BLUE_EDGE,
    )

    bullet_card(
        draw,
        (right_x, top, right_x + card_w, top + card_h),
        "协议分布图",
        [
            "比较 TCP / UDP 在 Common、Proxy、VPN 中的占比。",
            "这是判断“普通应用流量、代理转发、VPN 隧道封装”最直接的一层证据。 ",
        ],
        GREEN,
        GREEN_EDGE,
    )

    top2 = top + card_h + gap
    bullet_card(
        draw,
        (left_x, top2, left_x + card_w, top2 + card_h),
        "包大小分布图 + 统计量表",
        [
            "看均值、最小值、最大值、标准差，以及分布是否集中在 MTU 附近。",
            "AI 用它判断流量是否存在固定封装帧、控制小包、或自然应用流量的多峰混合特征。 ",
        ],
        AMBER,
        AMBER_EDGE,
    )

    bullet_card(
        draw,
        (right_x, top2, right_x + card_w, top2 + card_h),
        "流/会话分析图",
        [
            "看每流包数、持续时间、上下行比例、流数量等会话层特征。",
            "AI 借此区分“少量长流”“大量中等流”“持续隧道型流量”等行为模式。 ",
        ],
        ROSE,
        ROSE_EDGE,
    )

    top3 = top2 + card_h + gap
    bullet_card(
        draw,
        (left_x, top3, left_x + card_w, top3 + card_h),
        "时间序列 / IAT 分析",
        [
            "比较包到达间隔中位数、CDF 曲线、突发与空闲期。",
            "AI 会据此判断交互驱动流量、长连接保活流量、持续隧道流量之间的节奏差异。 ",
        ],
        VIOLET,
        VIOLET_EDGE,
    )

    bullet_card(
        draw,
        (right_x, top3, right_x + card_w, top3 + card_h),
        "页面自带 Insight 文本",
        [
            "这些文字其实是“已总结好的人工解释”，AI 可以把它们当成候选假设。",
            "但真正可靠的结论仍然要回到图表和统计量，检查文本是否被数据支持。 ",
        ],
        "#ecfeff",
        "#22c55e",
    )

    section_title(draw, 92, 1165, "2. AI 怎么思考", "不是直接看某一张图下结论，而是按“比较 - 解释 - 交叉验证”的链条推理。", "#10b981")

    flow_y = 1275
    step_w = 290
    step_h = 160
    step_gap = 40
    step_xs = [92, 92 + step_w + step_gap, 92 + 2 * (step_w + step_gap), 92 + 3 * (step_w + step_gap), 92 + 4 * (step_w + step_gap)]
    step_titles = [
        "先看差异",
        "提取模式",
        "寻找物理意义",
        "交叉验证",
        "形成结论",
    ]
    step_texts = [
        "比较三类流量在协议、包长、IAT、流结构上谁高谁低、谁更集中。",
        "把“UDP占比高”“IAT极短”“包长更集中”组合成稳定模式。",
        "把模式翻译成网络行为：隧道封装、长连接保活、请求-响应交互。",
        "检查不同图表是否互相支持，避免只凭单一指标误判。",
        "输出网页里的解释文字：每类流量像什么、为什么容易混淆。 ",
    ]
    step_fills = [BLUE, GREEN, AMBER, ROSE, VIOLET]
    step_edges = [BLUE_EDGE, GREEN_EDGE, AMBER_EDGE, ROSE_EDGE, VIOLET_EDGE]
    for i, x in enumerate(step_xs):
        rounded_box(draw, (x, flow_y, x + step_w, flow_y + step_h), step_fills[i], step_edges[i])
        draw.text((x + 22, flow_y + 18), step_titles[i], font=font(26, True), fill=TEXT)
        draw_paragraph(draw, (x + 22, flow_y + 60), step_texts[i], font(19), TEXT, step_w - 44, line_gap=8)
        if i < len(step_xs) - 1:
            arrow(draw, (x + step_w, flow_y + step_h / 2), (step_xs[i + 1] - 10, flow_y + step_h / 2))

    section_title(draw, 92, 1500, "3. AI 如何把网页结果翻译成解释", "下面是网页中最典型的 3 类结论，以及它们分别依赖了哪些证据。", "#f59e0b")

    box_y = 1610
    big_w = 520
    big_h = 420
    x_positions = [92, 640, 1188]
    labels = ["Common", "Proxy", "VPN"]
    colors = [COMMON, PROXY, VPN]
    evidence = [
        [
            "协议：以 TCP 为主，符合常规 Web / App 流量。",
            "时间：IAT 更长、更分散，存在明显空闲期和突发期。",
            "包长：大小更混杂，既有 ACK 小包，也有大载荷数据包。",
            "结论：更像真实用户交互驱动的普通业务流。 ",
        ],
        [
            "协议：仍以 TCP 为主，但比普通流量更偏持续连接。",
            "时间：IAT 较短且更均匀，符合心跳和 keep-alive 行为。",
            "包长：熵更高、分布更均匀，像经过代理封装后的加密流。",
            "结论：更像代理转发流量，而不是自然应用请求响应。 ",
        ],
        [
            "协议：UDP 占比最高，是典型隧道封装信号。",
            "时间：IAT 极短，持续有包，说明隧道长期保持活跃。",
            "包长：标准差较小，集中在固定封装帧附近。",
            "结论：更像 VPN 隧道承载的持续加密通道。 ",
        ],
    ]
    for x, label, color, bullets in zip(x_positions, labels, colors, evidence):
        rounded_box(draw, (x, box_y, x + big_w, box_y + big_h), PANEL, color, radius=32, width=4)
        draw.rounded_rectangle((x + 20, box_y + 18, x + 160, box_y + 60), radius=18, fill=color)
        draw.text((x + 44, box_y + 25), label, font=font(24, True), fill="#ffffff")
        y = box_y + 88
        for bullet in bullets:
            draw.ellipse((x + 28, y + 10, x + 40, y + 22), fill=color)
            y = draw_paragraph(draw, (x + 52, y), bullet, font(20), TEXT, big_w - 80, line_gap=8) + 14

    footer_y = 2070
    draw.rounded_rectangle((92, footer_y, WIDTH - 92, footer_y + 78), radius=22, fill="#eaf2ff", outline="#93c5fd", width=2)
    draw.text((120, footer_y + 18), "一句话总结：AI 不是“看见标签就解释”，而是先读网页里的预处理统计结果，再把多张图表里的差异组织成一致的行为证据链。", font=font(23, True), fill="#1e3a8a")

    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out)
    print(out)


if __name__ == "__main__":
    main()
