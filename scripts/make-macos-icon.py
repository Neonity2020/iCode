#!/usr/bin/env python3

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


SIZES = [
    (16, False),
    (16, True),
    (32, False),
    (32, True),
    (128, False),
    (128, True),
    (256, False),
    (256, True),
    (512, False),
    (512, True),
]


def draw_icon(base_size: int = 2048) -> Image.Image:
    image = Image.new("RGBA", (base_size, base_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    bg = (245, 242, 235, 255)
    fg = (25, 25, 28, 255)

    padding = int(base_size * 0.08)
    radius = int(base_size * 0.22)
    draw.rounded_rectangle(
        (padding, padding, base_size - padding, base_size - padding),
        radius=radius,
        fill=bg,
    )

    mark_scale = base_size / 1024
    center_x = base_size / 2
    center_y = base_size / 2
    thickness = max(10, int(44 * mark_scale))
    arm = int(130 * mark_scale)
    height = int(260 * mark_scale)
    text_top = center_y - height * 0.45
    text_bottom = center_y + height * 0.45
    left_x = center_x - arm * 1.1
    right_x = center_x + arm * 1.1
    i_x = center_x + arm * 0.1

    # Left angle "<"
    draw.line(
        [(left_x + arm, text_top), (left_x, center_y), (left_x + arm, text_bottom)],
        fill=fg,
        width=thickness,
        joint="curve",
    )

    # Right angle ">"
    draw.line(
        [(right_x - arm, text_top), (right_x, center_y), (right_x - arm, text_bottom)],
        fill=fg,
        width=thickness,
        joint="curve",
    )

    # The "i" stem.
    stem_width = max(8, int(56 * mark_scale))
    stem_top = center_y - int(150 * mark_scale)
    stem_bottom = center_y + int(140 * mark_scale)
    draw.rounded_rectangle(
        (
            i_x - stem_width / 2,
            stem_top,
            i_x + stem_width / 2,
            stem_bottom,
        ),
        radius=stem_width / 2,
        fill=fg,
    )

    # The dot above the stem.
    dot_radius = int(32 * mark_scale)
    dot_center_y = stem_top - int(70 * mark_scale)
    draw.ellipse(
        (
            i_x - dot_radius,
            dot_center_y - dot_radius,
            i_x + dot_radius,
            dot_center_y + dot_radius,
        ),
        fill=fg,
    )

    # Subtle anti-aliasing pass makes the glyph edges cleaner after downscaling.
    return image.filter(ImageFilter.GaussianBlur(radius=0.25))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, help="Output iconset directory")
    args = parser.parse_args()

    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)

    master = draw_icon()
    for size, retina in SIZES:
        # Save the exact raster sizes expected by iconutil.
        scale = 2 if retina else 1
        target_size = size * scale
        filename = f"icon_{size}x{size}{'@2x' if retina else ''}.png"
        raster = master.resize((target_size, target_size), Image.Resampling.LANCZOS)
        raster.save(output / filename)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
