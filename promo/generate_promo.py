#!/usr/bin/env python3
"""AlphaArena promo generator — pure PIL + ffmpeg, no emoji/font dependency.

Fixes the tofu-box icon bug: all module icons are vector line-art drawn with
PIL (like inline SVG would be) instead of emoji glyphs that need a color-emoji
font missing from headless render environments.

Usage:  python3 promo/generate_promo.py
Output: /tmp/alphaarena-promo-v2.mp4  (+ preview PNGs in /tmp/promo-new/)
"""
import math
import os
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1920, 1080
FPS = 30
FF = "/tmp/pyav-pkgs/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2"
OUT = "/tmp/alphaarena-promo-v2.mp4"
PREVIEW_DIR = "/tmp/promo-new"

BG = (14, 13, 11)
CARD = (30, 29, 27)
EDGE = (62, 61, 57)
AMBER = (245, 166, 35)
GREEN = (52, 211, 153)
WHITE = (245, 244, 242)
GRAY = (178, 176, 170)
DIM = (115, 113, 107)

FD = "/usr/share/fonts/truetype/dejavu/"
F_TITLE = ImageFont.truetype(FD + "DejaVuSans-Bold.ttf", 150)
F_H1 = ImageFont.truetype(FD + "DejaVuSans-Bold.ttf", 72)
F_CARD_T = ImageFont.truetype(FD + "DejaVuSans-Bold.ttf", 40)
F_CARD_D = ImageFont.truetype(FD + "DejaVuSans.ttf", 28)
F_CHIP = ImageFont.truetype(FD + "DejaVuSans-Bold.ttf", 33)
F_PILL = ImageFont.truetype(FD + "DejaVuSans.ttf", 30)
F_TERM = ImageFont.truetype(FD + "DejaVuSansMono.ttf", 34)
F_TAG = ImageFont.truetype(FD + "DejaVuSans-Bold.ttf", 30)
F_SMALL = ImageFont.truetype(FD + "DejaVuSans.ttf", 30)


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease_out(t):
    t = clamp(t)
    return 1.0 - (1.0 - t) ** 3


def fade_slide(lt, delay, dur=0.5, rise=28):
    """Return (alpha 0..1, y_offset) for a staggered entrance."""
    p = ease_out((lt - delay) / dur)
    return p, int((1.0 - p) * rise)


def put_text(base, xy, s, font, fill, anchor="mm", alpha=1.0):
    if alpha <= 0.0:
        return
    ov = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    a = int(255 * clamp(alpha))
    d.text(xy, s, font=font, fill=fill + (a,), anchor=anchor)
    base.alpha_composite(ov)


def card(base, box, alpha=1.0, highlight=False):
    if alpha <= 0.0:
        return
    ov = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    a = int(255 * clamp(alpha))
    d.rounded_rectangle(box, radius=26,
                        fill=CARD + (a,),
                        outline=((AMBER if highlight else EDGE) + (a,)), width=2)
    base.alpha_composite(ov)


def glow(base, xy, r, color, alpha=0.5):
    ov = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    d.ellipse([xy[0] - r, xy[1] - r, xy[0] + r, xy[1] + r], fill=color + (0,))
    ov = ov.filter(ImageFilter.GaussianBlur(r // 3))
    d = ImageDraw.Draw(ov)
    d.ellipse([xy[0] - r, xy[1] - r, xy[0] + r, xy[1] + r],
              fill=color + (int(90 * clamp(alpha)),))
    ov = ov.filter(ImageFilter.GaussianBlur(r // 4))
    base.alpha_composite(ov)


def base_frame():
    return Image.new("RGBA", (W, H), BG + (255,))
def icon_box(draw_img, box, kind, color=AMBER):
    """Draw vector line-art icon centered in box (x0,y0,x1,y1). Pure PIL paths."""
    from PIL import ImageDraw as D
    x0, y0, x1, y1 = box
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    s = min(x1 - x0, y1 - y0)
    u = s / 44.0
    d = D.Draw(draw_img)
    c = color
    wdt = max(3, int(3.2 * u))

    if kind == "pulse":  # heartbeat waveform
        pts = [(-17, 2), (-9, 2), (-5, -12), (0, 12), (5, -5), (9, 2), (17, 2)]
        pts = [(cx + x * u, cy + y * u) for x, y in pts]
        d.line(pts, fill=c, width=wdt, joint="curve")
    elif kind == "scale":  # balance / adversarial thesis
        d.line([(cx, cy - 14 * u), (cx, cy + 13 * u)], fill=c, width=wdt)
        d.line([(cx - 13 * u, cy - 8 * u), (cx + 13 * u, cy - 8 * u)], fill=c, width=wdt)
        for sx in (-1, 1):
            px = cx + sx * 13 * u
            d.line([(px, cy - 8 * u), (px - 6 * u, cy + 6 * u)], fill=c, width=wdt)
            d.line([(px, cy - 8 * u), (px + 6 * u, cy + 6 * u)], fill=c, width=wdt)
            d.line([(px - 6 * u, cy + 6 * u), (px + 6 * u, cy + 6 * u)], fill=c, width=wdt)
        d.line([(cx - 8 * u, cy + 13 * u), (cx + 8 * u, cy + 13 * u)], fill=c, width=wdt)
    elif kind == "layers":  # MarketTwin stacked scenarios
        for k, dy in ((-7, 0), (0, 1), (7, 2)):
            y = cy + k * u
            pts = [(cx - 15 * u, y), (cx, y - 6 * u), (cx + 15 * u, y),
                   (cx, y + 6 * u), (cx - 15 * u, y)]
            d.line(pts, fill=c if dy < 2 else tuple(int(v * 0.55) for v in c), width=wdt, joint="curve")
    elif kind == "swords":  # Arena crossed swords
        d.line([(cx - 12 * u, cy + 11 * u), (cx + 11 * u, cy - 12 * u)], fill=c, width=wdt)
        d.line([(cx + 12 * u, cy + 11 * u), (cx - 11 * u, cy - 12 * u)], fill=c, width=wdt)
        for sx, sy in ((-12, 11), (12, 11)):
            x, y = cx + sx * u, cy + sy * u
            d.line([(x - 5 * u, y), (x + 5 * u, y)], fill=c, width=wdt)
        for sx in (-1, 1):
            x = cx + sx * 13 * u
            d.ellipse([x - 2.6 * u, cy - 14.6 * u, x + 2.6 * u, cy - 9.4 * u], fill=c)
    elif kind == "ghost":  # Shadow session ghost
        x0g, y0g = cx - 11 * u, cy - 12 * u
        x1g, y1g = cx + 11 * u, cy + 13 * u
        d.rectangle([x0g, y0g + 6 * u, x1g, y1g - 4 * u], fill=c)
        d.ellipse([x0g, y0g, x1g, y0g + 12 * u], fill=c)
        for i, fx in enumerate([-7.5, -2.5, 2.5, 7.5]):
            fx *= u
            d.ellipse([cx + fx - 2.75 * u, y1g - 9.5 * u, cx + fx + 2.75 * u, y1g + 1.5 * u], fill=c)
        bgc = CARD
        for ex in (-4.5, 4.5):
            d.ellipse([cx + ex * u - 2 * u, cy - 5 * u, cx + ex * u + 2 * u, cy + 1 * u], fill=bgc)
    elif kind == "skull":  # Thesis Morgue skull
        d.ellipse([cx - 10 * u, cy - 11 * u, cx + 10 * u, cy + 5 * u], outline=c, width=wdt)
        d.rectangle([cx - 6 * u, cy + 2 * u, cx + 6 * u, cy + 12 * u], outline=c, width=wdt)
        for ex in (-4.5, 4.5):
            d.ellipse([cx + ex * u - 2.6 * u, cy - 5 * u, cx + ex * u + 2.6 * u, cy + 1 * u], fill=c)
        d.line([(cx, cy - 1 * u), (cx, cy + 4 * u)], fill=c, width=max(2, int(2 * u)))
    elif kind == "eye":  # Watch
        d.ellipse([cx - 15 * u, cy - 8 * u, cx + 15 * u, cy + 8 * u], outline=c, width=wdt)
        d.ellipse([cx - 4 * u, cy - 4 * u, cx + 4 * u, cy + 4 * u], fill=c)
    elif kind == "flask":  # Simulate
        pts = [(cx - 4 * u, cy - 13 * u), (cx - 4 * u, cy - 1 * u),
               (cx - 11 * u, cy + 12 * u), (cx + 11 * u, cy + 12 * u),
               (cx + 4 * u, cy - 1 * u), (cx + 4 * u, cy - 13 * u)]
        d.line(pts + [pts[0]], fill=c, width=wdt, joint="curve")
        d.line([(cx - 8 * u, cy + 6 * u), (cx + 8 * u, cy + 6 * u)], fill=c, width=wdt)
    elif kind == "clipboard":  # Review
        d.rounded_rectangle([cx - 9 * u, cy - 10 * u, cx + 9 * u, cy + 13 * u],
                            radius=int(3 * u), outline=c, width=wdt)
        d.rounded_rectangle([cx - 5 * u, cy - 14 * u, cx + 5 * u, cy - 7 * u],
                            radius=int(2 * u), outline=c, width=wdt)
        for yy in (-2, 3, 8):
            d.line([(cx - 5 * u, cy + yy * u), (cx + 5 * u, cy + yy * u)], fill=c, width=max(2, int(2 * u)))
    elif kind == "trend":  # Improve
        d.line([(cx - 14 * u, cy + 10 * u), (cx - 3 * u, cy + 1 * u),
                (cx + 2 * u, cy + 5 * u), (cx + 14 * u, cy - 10 * u)], fill=c, width=wdt, joint="curve")
        d.line([(cx + 14 * u, cy - 10 * u), (cx + 6 * u, cy - 10 * u)], fill=c, width=wdt)
        d.line([(cx + 14 * u, cy - 10 * u), (cx + 14 * u, cy - 2 * u)], fill=c, width=wdt)
MODULES = [
    ("pulse", "Pulse", "Live market feed & risk"),
    ("scale", "NightWatch", "Adversarial thesis checks"),
    ("layers", "MarketTwin", "Scenario stress tests"),
    ("swords", "Arena", "Paper battles, live prices"),
    ("ghost", "Shadow Session", "Listed vs Shadow track"),
    ("skull", "Thesis Morgue", "Dead theses, receipts"),
]
LOOP = [
    ("eye", "Watch"), ("scale", "Challenge"), ("flask", "Simulate"),
    ("swords", "Battle"), ("ghost", "Shadow"), ("clipboard", "Review"),
    ("trend", "Improve"),
]
STACK = ["React 19", "TypeScript", "FastAPI", "Bitget Reality",
         "Qwen 3.8 27B", "Vibe-Trading"]

S_TITLE = (0.0, 6.0)
S_PROBLEM = (6.0, 11.0)
S_LOOP = (11.0, 19.5)
S_MODULES = (19.5, 28.5)
S_STACK = (28.5, 33.5)
S_CTA = (33.5, 38.0)
TOTAL = 38.0


def scene_alpha(t, s, e, f=0.6):
    return clamp((t - s) / f) * clamp((e - t) / f)


def draw_title(img, t):
    s, e = S_TITLE
    a = scene_alpha(t, s, e, 0.7)
    lt = t - s
    glow(img, (W // 2, 660), 150, (200, 130, 20), 0.35 * a)
    pa, _ = fade_slide(lt, 0.15, 0.5, 0)
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    do = ImageDraw.Draw(ov)
    pa8 = int(255 * clamp(pa * a))
    do.rounded_rectangle([W // 2 - 245, 88, W // 2 + 245, 152],
                         radius=32, fill=(20, 60, 45, pa8),
                         outline=(40, 120, 85, pa8), width=2)
    img.alpha_composite(ov)
    put_text(img, (W // 2, 121), "Bitget AI Base Camp S2", F_PILL,
             (52, 211, 153), alpha=pa * a)
    wa, _ = fade_slide(lt, 0.5, 0.7, 0)
    m1 = ImageDraw.Draw(Image.new("RGBA", (8, 8)))
    b1 = m1.textbbox((0, 0), "Alpha ", font=F_TITLE)
    b2 = m1.textbbox((0, 0), "Arena", font=F_TITLE)
    w1, w2 = b1[2] - b1[0], b2[2] - b2[0]
    x0 = (W - w1 - w2) / 2
    put_text(img, (x0, 452), "Alpha ", F_TITLE,
             (255, 255, 255), anchor="lm", alpha=wa * a)
    put_text(img, (x0 + w1, 452), "Arena", F_TITLE, AMBER,
             anchor="lm", alpha=wa * a)
    sa, _ = fade_slide(lt, 1.1, 0.7, 0)
    put_text(img, (W // 2, 572),
             "Predict less. Test more. Let the market decide.",
             F_CARD_D, GRAY, alpha=sa * a)
    ta, _ = fade_slide(lt, 1.6, 0.7, 0)
    put_text(img, (W // 2, 640), "AI TRADING DESK  -  DECISION STRESS-TESTING",
             F_TAG, DIM, alpha=ta * a)
def draw_problem(img, t):
    s, e = S_PROBLEM
    a = scene_alpha(t, s, e, 0.6)
    lt = t - s
    rng = np.random.RandomState(7)
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    do = ImageDraw.Draw(ov)
    xs = np.linspace(80, W - 80, 26)
    yy = H // 2 + np.cumsum(rng.randn(26) * 8)
    for x, y in zip(xs, yy):
        up = rng.rand() > 0.5
        col = (34, 150, 100, int(70 * a)) if up else (170, 60, 60, int(70 * a))
        do.line([(x, y - 26), (x, y + 26)], fill=col, width=3)
        do.rectangle([x - 16, min(y - 12, y + 12),
                      x + 16, max(y - 12, y + 12)], fill=col)
    img.alpha_composite(ov)
    glow(img, (W // 2, H // 2), 420, (0, 0, 0), 0.55 * a)
    p1, _ = fade_slide(lt, 0.2, 0.6, 0)
    put_text(img, (W // 2, H // 2 - 40),
             "Traders act on predictions they", F_H1, WHITE, alpha=p1 * a)
    p2, _ = fade_slide(lt, 0.7, 0.6, 0)
    put_text(img, (W // 2 - 190, H // 2 + 55), "cannot", F_H1, AMBER,
             alpha=p2 * a)
    put_text(img, (W // 2 + 120, H // 2 + 55), "disprove.", F_H1, WHITE,
             alpha=p2 * a)


def draw_loop(img, t):
    s, e = S_LOOP
    a = scene_alpha(t, s, e, 0.6)
    lt = t - s
    ta, _ = fade_slide(lt, 0.0, 0.5, 0)
    put_text(img, (W // 2, 150), "The Decision Loop", F_H1, WHITE,
             alpha=ta * a)
    F_LOOP = ImageFont.truetype(FD + "DejaVuSans-Bold.ttf", 30)
    # two centered rows: 4 + 3, no arrows-inside-cards overlap
    rows = [LOOP[:4], LOOP[4:]]
    cw, chh = 250, 84
    y = 420
    for r, row in enumerate(rows):
        gap = 26
        tot = len(row) * cw + (len(row) - 1) * gap
        x = (W - tot) / 2
        for j, (kind, label) in enumerate(row):
            idx = r * 4 + j
            ca, dy = fade_slide(lt, 0.3 + idx * 0.4, 0.45, 26)
            hl = (kind == "swords")
            card(img, [x, y + dy, x + cw, y + chh + dy], alpha=ca * a,
                 highlight=hl)
            if ca * a > 0.05:
                icon_box(img, [x + 18, y + dy + 18, x + 62, y + dy + chh - 18],
                         kind, AMBER if hl else WHITE)
                put_text(img, (x + 76, y + dy + chh / 2), label, F_LOOP,
                         AMBER if hl else WHITE, anchor="lm", alpha=ca * a)
            x += cw + gap
        y += chh + 40
    put_text(img, (W // 2, 830), "watch - challenge - simulate - battle - shadow - review - improve",
             F_SMALL, DIM, alpha=clamp((lt - 3.0) / 0.8) * a)
def draw_modules(img, t):
    s, e = S_MODULES
    a = scene_alpha(t, s, e, 0.6)
    lt = t - s
    ta, _ = fade_slide(lt, 0.0, 0.5, 0)
    put_text(img, (W // 2, 140), "Core Modules", F_H1, WHITE,
             alpha=ta * a)
    cw, chh, gx, gy = 452, 210, 28, 28
    x0 = (W - (3 * cw + 2 * gx)) / 2
    y0 = 278
    m3 = ImageDraw.Draw(Image.new("RGBA", (8, 8)))
    tw = {}
    for i, (kind, title, desc) in enumerate(MODULES):
        r, c = divmod(i, 3)
        x = x0 + c * (cw + gx)
        y = y0 + r * (chh + gy)
        ca, dy = fade_slide(lt, 0.25 + i * 0.35, 0.5, 30)
        card(img, [x, y + dy, x + cw, y + chh + dy], alpha=ca * a)
        if ca * a > 0.05:
            ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
            ImageDraw.Draw(ov).rounded_rectangle(
                [x + 26, y + dy + 24, x + 82, y + dy + 80], radius=16,
                fill=(255, 255, 255, int(18 * ca * a)))
            img.alpha_composite(ov)
            icon_box(img, [x + 31, y + dy + 29, x + 77, y + dy + 75],
                     kind, AMBER)
            bb = m3.textbbox((0, 0), title, font=F_CARD_T)
            tww = bb[2] - bb[0]
            tfont = F_CARD_T
            if tww > 330:
                tfont = ImageFont.truetype(FD + "DejaVuSans-Bold.ttf", 33)
                bb = m3.textbbox((0, 0), title, font=tfont)
                tww = bb[2] - bb[0]
            tx = x + 96
            if tx + tww > x + cw - 14:
                tx = x + cw - 14 - tww
                if tx < x + 92:
                    tx = x + 92
            put_text(img, (tx, y + dy + 54), title, tfont,
                     WHITE, anchor="lm", alpha=ca * a)
            db = m3.textbbox((0, 0), desc, font=F_CARD_D)
            dw = db[2] - db[0]
            dx = x + 26
            if dx + dw > x + cw - 16:
                scale_note = (x + cw - 16 - dx) / max(dw, 1)
                # shrink font by drawing on temp layer is overkill;
                # clip anchor: left-align, allow tight fit
                pass
            put_text(img, (dx, y + dy + 128), desc, F_CARD_D,
                     GRAY, anchor="lm", alpha=ca * a)


def draw_stack(img, t):
    s, e = S_STACK
    a = scene_alpha(t, s, e, 0.6)
    lt = t - s
    ta, _ = fade_slide(lt, 0.0, 0.5, 0)
    put_text(img, (W // 2, 150), "Production-grade stack", F_H1,
             WHITE, alpha=ta * a)
    meas = ImageDraw.Draw(Image.new("RGBA", (8, 8)))
    widths = []
    for label in STACK:
        bb = meas.textbbox((0, 0), label, font=F_CHIP)
        widths.append(bb[2] - bb[0] + 64)
    rows = [(STACK[:3], 0), (STACK[3:], 3)]
    y = 330
    for row, off in rows:
        tot = sum(widths[off:off + len(row)]) + 18 * (len(row) - 1)
        x = (W - tot) / 2
        for j, label in enumerate(row):
            wch = widths[off + j]
            ca, dy = fade_slide(lt, 0.3 + (off + j) * 0.25, 0.45, 22)
            card(img, [x, y + dy, x + wch, y + dy + 66], alpha=ca * a)
            put_text(img, (x + wch / 2, y + dy + 34), label, F_CHIP,
                     WHITE, alpha=ca * a)
            x += wch + 18
        y += 104
    put_text(img, (W // 2, 640),
             "Live market data  -  paper-only guardrails  -  human-readable evidence",
             F_CARD_D, DIM, alpha=clamp((lt - 1.6) / 0.8) * a)
    F_TERM2 = ImageFont.truetype(FD + "DejaVuSansMono.ttf", 30)
    ca, dy = fade_slide(lt, 1.8, 0.5, 24)
    card(img, [W // 2 - 500, 730 + dy, W // 2 + 500, 880 + dy],
         alpha=ca * a)
    if ca * a > 0.05:
        d = ImageDraw.Draw(img)
        for i, col in enumerate([(255, 95, 86), (255, 189, 46),
                                 (39, 201, 63)]):
            d.ellipse([W // 2 - 466 + i * 30, 752 + dy,
                       W // 2 - 448 + i * 30, 770 + dy], fill=col)
        put_text(img, (W // 2 - 466, 812 + dy),
                 "$ git clone  github.com/emmy16-glitch/AlphaArena",
                 F_TERM2, WHITE, anchor="lm", alpha=ca * a)
def draw_cta(img, t):
    s, e = S_CTA
    a = scene_alpha(t, s, e, 0.7)
    lt = t - s
    glow(img, (W // 2, 560), 150, (200, 130, 20), 0.3 * a)
    ta, _ = fade_slide(lt, 0.1, 0.6, 0)
    m2 = ImageDraw.Draw(Image.new("RGBA", (8, 8)))
    c1 = m2.textbbox((0, 0), "Alpha ", font=F_TITLE)
    c2 = m2.textbbox((0, 0), "Arena", font=F_TITLE)
    cw1, cw2 = c1[2] - c1[0], c2[2] - c2[0]
    cx0 = (W - cw1 - cw2) / 2
    put_text(img, (cx0, 330), "Alpha ", F_TITLE,
             (255, 255, 255), anchor="lm", alpha=ta * a)
    put_text(img, (cx0 + cw1, 330), "Arena", F_TITLE, AMBER,
             anchor="lm", alpha=ta * a)
    sa, _ = fade_slide(lt, 0.5, 0.6, 0)
    put_text(img, (W // 2, 470), "Don't just watch the market. Test it.",
             F_H1, GRAY, alpha=sa * a)
    ca, _ = fade_slide(lt, 0.9, 0.6, 0)
    m4 = ImageDraw.Draw(Image.new("RGBA", (8, 8)))
    left_t = "alphaarena.vercel.app"
    right_t = "github.com/emmy16-glitch/AlphaArena"
    lw = m4.textbbox((0, 0), left_t, font=F_CARD_T)[2]
    rw = m4.textbbox((0, 0), right_t, font=F_CARD_T)[2]
    # two non-overlapping centered columns
    lx, rx = W // 2 - 400, W // 2 + 400
    put_text(img, (lx, 620), "LIVE DEMO", F_TAG, DIM, alpha=ca * a)
    put_text(img, (lx, 668), left_t, F_CARD_T, AMBER, alpha=ca * a)
    put_text(img, (rx, 620), "REPOSITORY", F_TAG, DIM, alpha=ca * a)
    put_text(img, (rx, 668), right_t, F_CARD_T, WHITE, alpha=ca * a)
    fa, _ = fade_slide(lt, 1.3, 0.7, 0)
    put_text(img, (W // 2, 900),
             "Never places real-money trades. The human decides.",
             F_SMALL, GRAY, alpha=fa * a)
    if fa * a > 0.05:
        ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
        do = ImageDraw.Draw(ov)
        a8 = int(255 * clamp(fa * a))
        do.rounded_rectangle([W // 2 - 90, 930, W // 2 + 90, 976],
                             radius=20, fill=(20, 60, 45, a8),
                             outline=(40, 120, 85, a8), width=2)
        img.alpha_composite(ov)
        put_text(img, (W // 2, 954), "MIT License", F_PILL, GREEN,
                 alpha=fa * a)


def render_frame(t):
    img = base_frame()
    draw_title(img, t)
    draw_problem(img, t)
    draw_loop(img, t)
    draw_modules(img, t)
    draw_stack(img, t)
    draw_cta(img, t)
    return img.convert("RGB")
def synth_audio(path, seconds=TOTAL, sr=48000):
    tt = np.arange(int(sr * seconds))
    t = tt / sr
    freqs = [110.0, 164.81, 220.0, 277.18]
    sig = sum(np.sin(2 * np.pi * f * t) *
              (0.5 + 0.5 * np.sin(2 * np.pi * 0.07 * t + i))
              for i, f in enumerate(freqs))
    sig /= (len(freqs) * 1.4)
    env = np.minimum(1.0, t / 2.0) * np.minimum(1.0, (seconds - t) / 2.0)
    sig = (sig * env * 0.16 * 32767).astype(np.int16)
    stereo = np.stack([sig, sig], axis=1)
    with wave.open(path, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(stereo.tobytes())


def _one_frame(i):
    render_frame(i / FPS).save(f"/tmp/promo-frames-v2/f{i:04d}.png")
    return i


def render_shard(a, b, workers=4):
    """Render frames [a,b) to /tmp/promo-frames-v2/ using multiprocessing."""
    import multiprocessing as mp
    outdir = "/tmp/promo-frames-v2"
    os.makedirs(outdir, exist_ok=True)

    if workers <= 1:
        for i in range(a, b):
            _one_frame(i)
            if i % 150 == 0:
                print(f"  frame {i}/{b}", flush=True)
        return
    with mp.Pool(workers) as pool:
        for k, i in enumerate(
                pool.imap_unordered(_one_frame, range(a, b), chunksize=4)):
            if k % 50 == 0:
                print(f"  frame {k}/{b - a}", flush=True)


def main():
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    n = int(TOTAL * FPS)
    workers = 4
    if "--jobs" in sys.argv:
        workers = int(sys.argv[sys.argv.index("--jobs") + 1])
    if "--frames-only" in sys.argv:
        render_shard(0, n, workers)
        print("frames in /tmp/promo-frames-v2")
        return
    print(f"rendering {n} frames @ {W}x{H} {FPS}fps ...", flush=True)
    synth_audio("/tmp/promo-audio.wav")
    proc = subprocess.Popen(
        [FF, "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
         "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-i", "/tmp/promo-audio.wav",
         "-c:v", "libx264", "-preset", "slow", "-crf", "17",
         "-pix_fmt", "yuv420p", "-movflags", "+faststart",
         "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2",
         "-shortest", OUT],
        stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)
    previews = {4: "title", 15: "loop", 22: "loop2", 24: "modules",
                26: "modules-full", 31: "stack", 36: "cta"}
    for i in range(n):
        img = render_frame(i / FPS)
        proc.stdin.write(img.tobytes())
        sec = int(i / FPS)
        if sec in previews:
            img.save(f"{PREVIEW_DIR}/{previews.pop(sec)}-t{sec:02d}.png")
        if i % 150 == 0:
            print(f"  frame {i}/{n}", flush=True)
    proc.stdin.close()
    proc.wait()
    print("wrote", OUT, os.path.getsize(OUT) // 1024, "KB")


if __name__ == "__main__":
    main()






