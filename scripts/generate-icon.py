from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops, ImageOps


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
SOURCE = ASSETS / "icon-source.png"


def load_source() -> Image.Image:
    if not SOURCE.exists():
        raise FileNotFoundError(f"Missing source icon: {SOURCE}")
    return Image.open(SOURCE).convert("RGBA")


def crop_to_artwork(image: Image.Image) -> Image.Image:
    # The source is line art on a white background. Trim only the empty outer
    # whitespace, then add a little breathing room back for app icon use.
    background = Image.new("RGBA", image.size, (255, 255, 255, 255))
    diff = ImageChops.difference(image, background).convert("L")
    mask = diff.point(lambda value: 255 if value > 18 else 0)
    bbox = mask.getbbox()
    if not bbox:
        return image

    left, top, right, bottom = bbox
    width = right - left
    height = bottom - top
    padding = int(max(width, height) * 0.06)
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(image.width, right + padding)
    bottom = min(image.height, bottom + padding)
    return image.crop((left, top, right, bottom))


def make_icon(size: int) -> Image.Image:
    artwork = crop_to_artwork(load_source())
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 255))

    fitted = ImageOps.contain(artwork, (int(size * 0.92), int(size * 0.92)), Image.Resampling.LANCZOS)
    x = (size - fitted.width) // 2
    y = (size - fitted.height) // 2
    canvas.alpha_composite(fitted, (x, y))
    return canvas


def main() -> None:
    ASSETS.mkdir(exist_ok=True)
    make_icon(512).save(ASSETS / "icon.png")
    make_icon(256).save(ASSETS / "icon-256.png")

    sizes = [16, 24, 32, 48, 64, 128, 256]
    icon = make_icon(256)
    icon.save(ASSETS / "icon.ico", sizes=[(size, size) for size in sizes])


if __name__ == "__main__":
    main()
