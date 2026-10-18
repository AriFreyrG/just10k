"""Compose App Store screenshots (6.9-inch iPhone, 1320x2868) from raw
simulator captures in store/screenshots/raw/.

Run from the repo root with Pillow installed:
    python store/make_screenshots.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "store/screenshots/raw"
OUT = ROOT / "store/screenshots/iphone-6.9"
FONTS = ROOT / "node_modules/@expo-google-fonts"
DISPLAY = FONTS / "bricolage-grotesque/800ExtraBold/BricolageGrotesque_800ExtraBold.ttf"
BODY = FONTS / "figtree/500Medium/Figtree_500Medium.ttf"

W, H = 1320, 2868
INK, GROUND, ACCENT, WHITE = "#121814", "#F2F4F1", "#F0642E", "#FFFFFF"

SHOTS = [
    # raw file, headline lines, subline, background, text colour
    ("1-steps-left.png", ["Know exactly", "what's left"], "Your steps today, straight from your iPhone", GROUND, INK),
    ("2-pick.png", ["A fresh loop,", "sized to fit"], "Three loops from your door. Shuffle for more.", ACCENT, WHITE),
    ("3-walk.png", ["Turn by turn,", "step by step"], "Big directions and a buzz before every turn", INK, WHITE),
    ("4-done.png", ["See the shape", "of today's walk"], "Share it as GPX to Strava or Garmin", GROUND, INK),
]

# The "Google Maps · Share GPX · Simulate walk" row on the pick screen:
# "Simulate walk" only exists in development builds, so blank the row out.
BLANK = {"2-pick.png": (0, 2590, W, 2725)}
ISLAND = (472, 42, 848, 151)  # iPhone 17 Pro Max, in 1320x2868 screenshot pixels


def rounded(img: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *img.size), radius, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def compose(raw: str, lines: list[str], sub: str, bg: str, fg: str) -> Image.Image:
    shot = Image.open(RAW / raw).convert("RGB")
    if raw in BLANK:
        ImageDraw.Draw(shot).rectangle(BLANK[raw], fill=WHITE)
    # Some simulator captures leave out the Dynamic Island; draw it so every frame matches.
    ImageDraw.Draw(shot).rounded_rectangle(ISLAND, 54, fill="#000000")

    canvas = Image.new("RGB", (W, H), bg)
    draw = ImageDraw.Draw(canvas)

    head = ImageFont.truetype(str(DISPLAY), 128)
    body = ImageFont.truetype(str(BODY), 54)
    y = 190
    for line in lines:
        draw.text((W / 2, y), line, font=head, fill=fg, anchor="ma")
        y += 142
    draw.text((W / 2, y + 34), sub, font=body, fill=fg, anchor="ma")

    # Phone: the screenshot inside a thin ink bezel, bleeding off the bottom.
    scale = 0.80
    sw, sh = int(W * scale), int(H * scale)
    screen = rounded(shot.resize((sw, sh), Image.LANCZOS), 96)
    bezel = 22
    top = y + 170
    left = (W - sw) // 2

    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (left - bezel, top - bezel + 30, left + sw + bezel, top + sh + bezel + 30), 118, fill=(0, 0, 0, 70)
    )
    canvas.paste(shadow.filter(ImageFilter.GaussianBlur(40)), (0, 0), shadow.filter(ImageFilter.GaussianBlur(40)))
    frame_colour = "#2A312C" if bg == INK else INK
    ImageDraw.Draw(canvas).rounded_rectangle(
        (left - bezel, top - bezel, left + sw + bezel, top + sh + bezel), 118, fill=frame_colour
    )
    canvas.paste(screen, (left, top), screen)
    return canvas


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for i, (raw, lines, sub, bg, fg) in enumerate(SHOTS, 1):
        if not (RAW / raw).exists():
            print(f"skip {raw}: no raw capture")
            continue
        img = compose(raw, lines, sub, bg, fg)
        assert img.size == (W, H)
        path = OUT / f"{i:02d}-{raw.split('-', 1)[1]}"
        img.save(path, optimize=True)
        print("wrote", path.relative_to(ROOT))


if __name__ == "__main__":
    main()
