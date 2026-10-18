"""Render the app icon and splash image from the "Nearly there" design
(just10k UI canvas, boards Icon and Splash) into assets/.

Geometry is in the canvas's 100-unit viewBox and drawn at 4x, then scaled
down for smooth edges. Run from the repo root with Pillow installed:
    python store/make_icons.py
"""

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
FONT = ROOT / "node_modules/@expo-google-fonts/bricolage-grotesque/800ExtraBold/BricolageGrotesque_800ExtraBold.ttf"

CORAL = (0xF0, 0x64, 0x2E)
INK = (0x12, 0x18, 0x14)
WHITE = (255, 255, 255)
SS = 4  # supersampling


def ring_mark(
    size: int,
    bg,
    fg,
    track_alpha: float,
    text_rgb,
    r: float = 29,
    stroke: float = 9,
    font_size: float = 21,
    baseline: float = 57.5,
    tracking: float = -0.8,
    closed: float = 152 / 182.2,
    text: str = "10k",
) -> Image.Image:
    """The ring around "10k", on a square canvas `size` px wide (viewBox 100)."""
    px = size * SS
    u = px / 100  # one viewBox unit in pixels
    img = Image.new("RGBA", (px, px), (*bg, 255) if bg else (0, 0, 0, 0))

    def layer():
        return Image.new("RGBA", (px, px), (0, 0, 0, 0))

    c = 50 * u
    half = (r + stroke / 2) * u
    box = (c - half, c - half, c + half, c + half)
    w = round(stroke * u)

    # Faint full track.
    track = layer()
    ImageDraw.Draw(track).ellipse(box, outline=(*fg, round(255 * track_alpha)), width=w)
    img = Image.alpha_composite(img, track)

    # Progress arc from 12 o'clock, clockwise, with round caps.
    arc = layer()
    d = ImageDraw.Draw(arc)
    start, end = -90, -90 + 360 * closed
    d.arc(box, start, end, fill=(*fg, 255), width=w)
    for a in (start, end):
        x = c + r * u * math.cos(math.radians(a))
        y = c + r * u * math.sin(math.radians(a))
        rr = stroke * u / 2
        d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=(*fg, 255))
    img = Image.alpha_composite(img, arc)

    # "10k", centred, tightened like the canvas's letter-spacing.
    if text:
        font = ImageFont.truetype(str(FONT), round(font_size * u))
        advances = [font.getlength(ch) for ch in text]
        total = sum(advances) + tracking * u * (len(text) - 1)
        x = c - total / 2
        t = layer()
        td = ImageDraw.Draw(t)
        for ch, adv in zip(text, advances):
            td.text((x, baseline * u), ch, font=font, fill=(*text_rgb, 255), anchor="ls")
            x += adv + tracking * u
        img = Image.alpha_composite(img, t)

    return img.resize((size, size), Image.LANCZOS)


def save(img: Image.Image, name: str, opaque: bool = False) -> None:
    path = ASSETS / name
    (img.convert("RGB") if opaque else img).save(path, optimize=True)
    print("wrote", path.relative_to(ROOT), img.size)


def splash(width: int = 600) -> Image.Image:
    """Ring + "just10k" wordmark in white, on transparent (background colour comes from config)."""
    ring = ring_mark(width, None, WHITE, 0.28, WHITE, r=36, stroke=10, font_size=24, baseline=58.5, tracking=-0.9, closed=190 / 226.2)
    s = width / 150  # canvas splash: 150px ring, 20px gap, 26px wordmark
    font = ImageFont.truetype(str(FONT), round(26 * s * SS))
    word = "just10k"
    tw = font.getlength(word) + (-0.6 * s * SS) * (len(word) - 1)
    text_h = round(34 * s * SS)
    gap = round(20 * s)
    canvas = Image.new("RGBA", (width, width + gap + text_h // SS), (0, 0, 0, 0))
    canvas.alpha_composite(ring, (0, 0))
    t = Image.new("RGBA", (width * SS, text_h), (0, 0, 0, 0))
    d = ImageDraw.Draw(t)
    x = (width * SS - tw) / 2
    for ch in word:
        d.text((x, text_h * 0.8), ch, font=font, fill=(*WHITE, 255), anchor="ls")
        x += font.getlength(ch) - 0.6 * s * SS
    canvas.alpha_composite(t.resize((width, text_h // SS), Image.LANCZOS), (0, width + gap))
    return canvas


def main() -> None:
    # iOS: light (the chosen icon), dark and tinted. Square and opaque; iOS rounds the corners.
    save(ring_mark(1024, CORAL, WHITE, 0.28, WHITE), "icon.png", opaque=True)
    save(ring_mark(1024, INK, CORAL, 0.25, WHITE), "icon-dark.png", opaque=True)
    save(ring_mark(1024, (0x1C, 0x1F, 0x1D), (0xDC, 0xE0, 0xDC), 0.22, (0xDC, 0xE0, 0xDC)), "icon-tinted.png", opaque=True)

    # Android adaptive: smaller ring inside the safe zone, coral background from config.
    android = dict(r=25, stroke=8, font_size=18, baseline=56.5, tracking=-0.6, closed=131 / 157)
    save(ring_mark(1024, None, WHITE, 0.28, WHITE, **android), "android-icon-foreground.png")
    save(ring_mark(1024, None, WHITE, 0.25, WHITE, **android), "android-icon-monochrome.png")

    save(splash(), "splash-icon.png")
    save(ring_mark(48, CORAL, WHITE, 0.28, WHITE), "favicon.png", opaque=True)


if __name__ == "__main__":
    main()
