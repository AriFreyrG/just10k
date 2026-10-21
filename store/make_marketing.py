"""Render the App Store "Header and Search Results" assets:

    store/header/header-5244x2950.png, header-3840x1646.png
        Artwork only (Apple crops it per device), key art kept to the centre.
    store/search-results/search-results-1920x1280.png, -3840x2560.png
        Headline on the left, artwork on the right.

Brand from the just10k UI canvas: coral #F0642E, ink #121814, ground #F2F4F1,
Bricolage Grotesque + Figtree, the "nearly there" ring and the loop line from
the Pick a loop screen. Run from the repo root with Pillow installed:
    python store/make_marketing.py
"""

import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "node_modules/@expo-google-fonts"
DISPLAY = FONTS / "bricolage-grotesque/800ExtraBold/BricolageGrotesque_800ExtraBold.ttf"
BODY = FONTS / "figtree/500Medium/Figtree_500Medium.ttf"

CORAL = (0xF0, 0x64, 0x2E)
INK = (0x12, 0x18, 0x14)
GROUND = (0xF2, 0xF4, 0xF1)
WHITE = (255, 255, 255)
SS = 2  # supersampling for smooth edges

# A real walking loop around Tjörnin in Reykjavik (fetched once from the OSRM
# foot router the app uses), so the line reads as streets, not a doodle.
ROUTE = json.loads((Path(__file__).resolve().parent / "marketing-loop.json").read_text())["coords"]


def loop_points(cx, cy, size):
    """The route scaled so its larger side is `size`, centred on (cx, cy)."""
    k = math.cos(math.radians(sum(lat for lat, _ in ROUTE) / len(ROUTE)))
    pts = [(lon * k, -lat) for lat, lon in ROUTE]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    s = size / max(max(xs) - min(xs), max(ys) - min(ys))
    mx, my = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    return [(cx + (x - mx) * s, cy + (y - my) * s) for x, y in pts]


def polyline(d: ImageDraw.ImageDraw, pts, colour, width):
    d.line(pts, fill=colour, width=round(width), joint="curve")
    r = width / 2
    for x, y in (pts[0], pts[-1]):
        d.ellipse((x - r, y - r, x + r, y + r), fill=colour)


def ring(img: Image.Image, cx, cy, r, stroke, fg, text_rgb, track_alpha=0.3, closed=0.84, label=True):
    """The app icon's ring around "10k"."""
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    half = r + stroke / 2
    box = (cx - half, cy - half, cx + half, cy + half)
    d.ellipse(box, outline=(*fg, round(255 * track_alpha)), width=round(stroke))
    img.alpha_composite(layer)
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    start, end = -90, -90 + 360 * closed
    d.arc(box, start, end, fill=(*fg, 255), width=round(stroke))
    for a in (start, end):
        x, y = cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a))
        d.ellipse((x - stroke / 2, y - stroke / 2, x + stroke / 2, y + stroke / 2), fill=(*fg, 255))
    if label:
        font = ImageFont.truetype(str(DISPLAY), round(r * 0.72))
        d.text((cx, cy + r * 0.26), "10k", font=font, fill=(*text_rgb, 255), anchor="ms")
    img.alpha_composite(layer)


def street_grid(img: Image.Image, colour, alpha, spacing, width):
    """Faint, slightly skewed street lines, like the map behind a loop."""
    w, h = img.size
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    c = (*colour, round(255 * alpha))
    for i, x in enumerate(range(-h, w + h, spacing)):
        d.line([(x, -10), (x + h * 0.08, h + 10)], fill=c, width=round(width * (1.6 if i % 3 == 0 else 1)))
    for i, y in enumerate(range(-w // 8, h + w // 8, spacing)):
        d.line([(-10, y), (w + 10, y - w * 0.05)], fill=c, width=round(width * (1.6 if i % 4 == 1 else 1)))
    img.alpha_composite(layer)


def app_icon(img: Image.Image, x, y, size):
    """The app icon tile (coral, white ring around 10k) with a soft shadow."""
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    r = size * 0.225
    ImageDraw.Draw(shadow).rounded_rectangle((x, y + size * 0.04, x + size, y + size * 1.04), r, fill=(0, 0, 0, 50))
    from PIL import ImageFilter

    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(size * 0.05)))
    ImageDraw.Draw(img).rounded_rectangle((x, y, x + size, y + size), r, fill=(*CORAL, 255))
    ring(img, x + size / 2, y + size / 2, size * 0.29, size * 0.09, WHITE, WHITE, track_alpha=0.28)


def route(img: Image.Image, pts, unit):
    d = ImageDraw.Draw(img)
    polyline(d, pts, WHITE, unit * 0.034)
    polyline(d, pts, INK, unit * 0.018)
    sx, sy = pts[0]
    d.ellipse((sx - unit * 0.032, sy - unit * 0.032, sx + unit * 0.032, sy + unit * 0.032), fill=WHITE)
    d.ellipse((sx - unit * 0.02, sy - unit * 0.02, sx + unit * 0.02, sy + unit * 0.02), fill=INK)


def header(w: int, h: int) -> Image.Image:
    W, H = w * SS, h * SS
    img = Image.new("RGBA", (W, H), (*CORAL, 255))
    unit = min(W, H)
    street_grid(img, WHITE, 0.07, round(unit * 0.16), unit * 0.004)
    # Ring and loop side by side, both inside the centre so Apple's crops keep them.
    cx, cy = W / 2, H / 2
    ring(img, cx - unit * 0.36, cy, unit * 0.21, unit * 0.065, WHITE, WHITE)
    route(img, loop_points(cx + unit * 0.38, cy + unit * 0.02, unit * 0.62), unit)
    return img.convert("RGB").resize((w, h), Image.LANCZOS)


def search(w: int, h: int) -> Image.Image:
    W, H = w * SS, h * SS
    img = Image.new("RGBA", (W, H), (*GROUND, 255))
    d = ImageDraw.Draw(img)
    for fx, fy, fr in ((0.04, 0.08, 0.11), (0.5, 0.9, 0.028), (0.95, 0.07, 0.024)):
        x, y, rr = W * fx, H * fy, H * fr
        d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=(0xF8, 0xC9, 0xB4))

    # Artwork, right: a little coral map with today's loop, and the app icon on its corner.
    disc_r = H * 0.38
    dcx, dcy = W * 0.74, H * 0.47
    box = (dcx - disc_r, dcy - disc_r, dcx + disc_r, dcy + disc_r)
    disc = Image.new("RGBA", (W, H), (*CORAL, 255))
    street_grid(disc, WHITE, 0.16, round(H * 0.08), H * 0.004)
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).ellipse(box, fill=255)
    img.paste(disc, (0, 0), mask)
    route(img, loop_points(dcx + H * 0.02, dcy, disc_r * 1.15), H)
    icon = H * 0.3
    app_icon(img, dcx - disc_r * 1.05, dcy + disc_r * 0.42, icon)

    # Headline, left.
    d = ImageDraw.Draw(img)
    head = ImageFont.truetype(str(DISPLAY), round(H * 0.1))
    body = ImageFont.truetype(str(BODY), round(H * 0.04))
    x, y = W * 0.07, H * 0.36
    for line in ("Your 10k,", "one fresh", "loop away"):
        d.text((x, y), line, font=head, fill=INK, anchor="ls")
        y += H * 0.115
    for line in ("A walk from your door, sized to", "the steps you have left today."):
        d.text((x, y + H * 0.01), line, font=body, fill=(0x3A, 0x42, 0x3D), anchor="ls")
        y += H * 0.058
    return img.convert("RGB").resize((w, h), Image.LANCZOS)


def main() -> None:
    out = ROOT / "store"
    for w, h in ((5244, 2950), (3840, 1646)):
        p = out / "header" / f"header-{w}x{h}.png"
        p.parent.mkdir(parents=True, exist_ok=True)
        header(w, h).save(p, optimize=True)
        print("wrote", p.relative_to(ROOT))
    for w, h in ((1920, 1280), (3840, 2560)):
        p = out / "search-results" / f"search-results-{w}x{h}.png"
        p.parent.mkdir(parents=True, exist_ok=True)
        search(w, h).save(p, optimize=True)
        print("wrote", p.relative_to(ROOT))


if __name__ == "__main__":
    main()
