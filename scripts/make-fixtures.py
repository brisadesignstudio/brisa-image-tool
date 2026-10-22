"""Genera imágenes de prueba sintéticas en tests/fixtures/generated/.

Uso: python3 scripts/make-fixtures.py
Necesita Pillow. Las imágenes son inventadas (degradados y formas): no hay
fotos ni logos de clientes en el repositorio.
"""

from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "generated"
VINO = (99, 16, 40)
CORAL = (229, 112, 86)
CREMA = (246, 240, 232)
OLIVA = (166, 159, 77)
ORQUIDEA = (226, 138, 192)
ROSA = (242, 206, 221)


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def photo(width: int, height: int, seed: int) -> Image.Image:
    """Algo parecido a una foto: degradado suave, formas, detalle fino y grano."""
    small = Image.new("RGB", (64, 64))
    px = small.load()
    for y in range(64):
        for x in range(64):
            t = (x + y) / 126
            base = lerp(ROSA, CORAL, t) if t < 0.5 else lerp(CORAL, VINO, (t - 0.5) * 2)
            glow = max(0.0, 1 - math.hypot(x - 48, y - 18) / 30)
            px[x, y] = lerp(base, OLIVA, glow * 0.6)
    img = small.resize((width, height), Image.Resampling.BICUBIC)
    draw = ImageDraw.Draw(img)
    rnd = random.Random(seed)
    for _ in range(14):
        r = rnd.randint(min(width, height) // 30, min(width, height) // 7)
        cx, cy = rnd.randint(0, width), rnd.randint(0, height)
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=rnd.choice([CREMA, ORQUIDEA, OLIVA, ROSA]))
    # Líneas finas para que la compresión tenga detalle que conservar.
    for i in range(0, width, max(4, width // 300)):
        draw.line((i, int(height * 0.82), i + width // 40, height), fill=CREMA, width=1)
    img = img.filter(ImageFilter.GaussianBlur(radius=max(1, width // 1500)))
    noise = Image.effect_noise((width, height), 18).convert("RGB")
    return Image.blend(img, noise, 0.06)


def logo(width: int, height: int) -> Image.Image:
    """Logo con bordes suaves, una sombra semitransparente y fondo transparente."""
    scale = 4
    big = Image.new("RGBA", (width * scale, height * scale), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    w, h = big.size
    d.ellipse((w * 0.05, h * 0.15, w * 0.35, h * 0.85), fill=VINO + (255,))
    d.rounded_rectangle((w * 0.42, h * 0.3, w * 0.95, h * 0.7), radius=h * 0.12, fill=CORAL + (255,))
    d.polygon([(w * 0.2, h * 0.3), (w * 0.28, h * 0.5), (w * 0.2, h * 0.7), (w * 0.12, h * 0.5)], fill=ROSA + (255,))
    img = big.resize((width, height), Image.Resampling.LANCZOS)
    shadow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.ellipse((width * 0.1, height * 0.82, width * 0.9, height * 0.97), fill=(59, 11, 25, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=height * 0.03))
    return Image.alpha_composite(shadow, img)


def alpha_ramp(width: int, height: int) -> Image.Image:
    img = Image.new("RGBA", (width, height))
    px = img.load()
    for y in range(height):
        for x in range(width):
            a = int(round(255 * x / (width - 1)))
            px[x, y] = lerp(ORQUIDEA, VINO, y / (height - 1)) + (a,)
    return img


def arrow_portrait() -> Image.Image:
    """Retrato con una flecha hacia arriba, guardado tumbado con orientación EXIF 6."""
    portrait = photo(1512, 2016, seed=7)
    d = ImageDraw.Draw(portrait)
    d.polygon([(756, 200), (1156, 800), (356, 800)], fill=CREMA)
    d.rectangle((606, 800, 906, 1700), fill=CREMA)
    stored = portrait.transpose(Image.Transpose.ROTATE_90)  # se guarda tumbada
    return stored


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    photo(6000, 4000, seed=1).save(OUT / "foto-grande-6000x4000.jpg", quality=92)
    photo(640, 480, seed=2).save(OUT / "foto-pequena-640x480.jpg", quality=75)
    photo(1600, 2000, seed=4).save(OUT / "retrato-4x5-1600x2000.jpg", quality=88)
    exif = Image.Exif()
    exif[0x0112] = 6  # Orientation: girar 90° a la derecha al mostrar
    arrow_portrait().save(OUT / "retrato-exif-rotado.jpg", quality=90, exif=exif.tobytes())
    logo(1600, 800).save(OUT / "logo-transparente-1600x800.png", optimize=True)
    logo(64, 64).save(OUT / "icono-64x64.png")
    alpha_ramp(1024, 512).save(OUT / "degradado-alfa-1024x512.png")
    logo(1500, 1500).save(OUT / "ilustracion-sin-perdida.webp", lossless=True)
    photo(2400, 1600, seed=3).save(OUT / "foto-web-2400x1600.webp", quality=80)
    (OUT / "no-soy-una-imagen.jpg").write_text("Esto es texto, no una imagen.\n", encoding="utf-8")
    for f in sorted(OUT.iterdir()):
        print(f"{f.name:34s} {f.stat().st_size / 1000:10.1f} KB")


if __name__ == "__main__":
    main()
