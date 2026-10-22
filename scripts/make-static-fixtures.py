"""Archivos diminutos (sintéticos) para las pruebas unitarias de lectura de formatos.

Uso: python3 scripts/make-static-fixtures.py  (necesita Pillow)
Se guardan en tests/fixtures/static/ y sí se incluyen en el repositorio.
"""

from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "static"


def tile(mode: str, size=(16, 12)) -> Image.Image:
    img = Image.new(mode, size)
    px = img.load()
    for y in range(size[1]):
        for x in range(size[0]):
            r, g, b = (x * 16) % 256, (y * 20) % 256, 120
            if mode == "RGBA":
                px[x, y] = (r, g, b, 255 if x < size[0] // 2 else 90)
            else:
                px[x, y] = (r, g, b)
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    rgb = tile("RGB")
    rgba = tile("RGBA")
    rgb.save(OUT / "q50.jpg", quality=50)
    rgb.save(OUT / "q92.jpg", quality=92)
    rgb.save(OUT / "opaca.png")
    rgba.save(OUT / "alfa.png")
    rgb.save(OUT / "con-perdida.webp", quality=70)
    rgba.save(OUT / "con-perdida-alfa.webp", quality=70)
    rgba.save(OUT / "sin-perdida.webp", lossless=True)
    frames = [tile("RGBA"), tile("RGBA").transpose(Image.Transpose.FLIP_LEFT_RIGHT)]
    frames[0].save(OUT / "animada.webp", save_all=True, append_images=frames[1:], duration=100, loop=0)
    frames[0].save(OUT / "animada.png", save_all=True, append_images=frames[1:], duration=100, loop=0)
    for f in sorted(OUT.iterdir()):
        print(f"{f.name:24s} {f.stat().st_size:6d} B")


if __name__ == "__main__":
    main()
