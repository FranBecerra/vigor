#!/usr/bin/env python3
"""
Generador del icono de la aplicación Vigor.

Los PNG de `assets/` son ARTEFACTOS DERIVADOS: no se editan a mano. Se regeneran
desde este script, que también emite `assets/icon.svg`.

Uso:
    python3 scripts/build_icon.py

Requiere Pillow. Si no está en el entorno:
    python3 -m venv .venv && .venv/bin/pip install Pillow
    .venv/bin/python scripts/build_icon.py

------------------------------------------------------------------ PROCEDENCIA
La FORMA no está inventada ni aproximada a ojo: es el **trazado del boceto a
mano del usuario**. Tres intentos previos de reconstruirla estimando coordenadas
desde la foto fallaron (rayo en el brazo equivocado, muescas de más, vértice
inferior incorrecto), así que se cambió de método:

  1. Umbralizado del boceto para aislar el trazo, con umbral RELATIVO al fondo
     para tolerar la sombra desigual de la foto.
  2. Dilatación para cerrar las discontinuidades del bolígrafo.
  3. Relleno por inundación desde el borde para separar el fondo exterior; lo
     que queda son las dos regiones CERRADAS por el dibujo.
  4. Etiquetado de componentes conexas → rayo y romboide.
  5. Dilatación de cada región hasta la línea central del trazo, de modo que
     ambas queden adyacentes igual que en el dibujo, donde la línea es la
     frontera entre las dos.
  6. Seguimiento de contorno de Moore y simplificación Ramer–Douglas–Peucker.

Para cambiar la FORMA hay que trazar un boceto nuevo. Lo que se ajusta aquí es
el ACABADO.

--------------------------------------------------------------------- DISEÑO
Una V en la que el brazo IZQUIERDO es un rayo de dos trazos (una sola muesca,
borde superior horizontal, barrido desde la izquierda) y el brazo DERECHO es un
ROMBOIDE en un tono más oscuro del mismo verde. Convergen en el vértice inferior.

-------------------------------------------------------------------- ACABADO
Aspecto moderno y con brillo, según la referencia aportada por el usuario:

  · DEGRADADO diagonal en cada forma, más claro arriba a la izquierda, que es de
    donde viene la luz.
  · BISEL: filo claro en el borde superior-izquierdo y filo oscuro en el
    inferior-derecho. Se obtiene restando la máscara desplazada a la máscara
    original, lo que da exactamente el reborde de un lado.
  · SOMBRA PROYECTADA de las formas sobre el fondo, desenfocada y desplazada
    hacia abajo-derecha, coherente con la misma dirección de luz.
  · GRANO sobre el fondo y sobre la marca, más marcado que en la versión plana.
  · VIÑETA sutil en el fondo, para que el centro respire.

Todo se calcula con sobremuestreo y se reduce con Lanczos, así que los filos del
bisel quedan limpios y no aliasados.
"""

import os
from PIL import Image, ImageChops, ImageDraw, ImageFilter

# --- Colores base: derivados de src/theme/tokens.ts ------------------------
BG_CENTRE = (0x24, 0x27, 0x2A)   # centro del fondo, algo más claro
BG_EDGE = (0x11, 0x13, 0x15)     # borde del fondo, más oscuro (viñeta)

# Rayo: verde lima de marca, brillante. El degradado rodea BRAND_LIME #9BE317.
BOLT_LIGHT = (0xD6, 0xFB, 0x55)
BOLT_DARK = (0xA1, 0xE3, 0x1C)
# Romboide: el mismo verde, claramente más oscuro pero sin apagarse a oliva.
RHOMB_LIGHT = (0x92, 0xCC, 0x2A)
RHOMB_DARK = (0x64, 0x99, 0x13)

GRAIN_MARK = 0.22        # grano sobre la marca (mezcla en modo superposición)
GRAIN_BG = 0.13          # grano sobre el fondo
BEVEL_PX = 4.0           # grosor del bisel, en unidades del lienzo de 512
BEVEL_LIGHT = 0.55       # intensidad del filo claro
BEVEL_DARK = 0.38        # intensidad del filo oscuro
SHADOW_OFFSET = 6.0      # desplazamiento de la sombra proyectada
SHADOW_BLUR = 8.0        # desenfoque de la sombra
SHADOW_ALPHA = 0.60      # opacidad de la sombra

SUPERSAMPLE = 4
CANVAS = 512.0

# --- Geometría trazada del boceto (ver PROCEDENCIA) ------------------------
BOLT = [
    (84.3, 109.0), (229.4, 114.9), (340.3, 286.2), (331.2, 294.7),
    (259.0, 303.9), (251.7, 313.1), (332.5, 391.2), (344.3, 414.2),
    (245.2, 342.0), (129.0, 280.9), (197.3, 265.2), (207.1, 254.7),
    (38.4, 118.8),
]
RHOMBOID = [
    (465.7, 91.2), (473.6, 97.8), (406.6, 325.6), (369.2, 420.8),
    (281.9, 314.4), (359.4, 304.6), (317.4, 227.8), (346.9, 107.7),
]
SHAPES = [BOLT, RHOMBOID]
TONES = [(BOLT_LIGHT, BOLT_DARK), (RHOMB_LIGHT, RHOMB_DARK)]


def _diagonal_gradient(size, top, bottom):
    """
    Degradado diagonal (claro arriba-izquierda).

    Se construye a baja resolución y se amplía: un degradado suave escala sin
    pérdida visible, y evita iterar sobre millones de píxeles en Python.
    """
    n = 64
    small = Image.new("RGB", (n, n))
    pixels = small.load()
    for y in range(n):
        for x in range(n):
            t = (x + y) / (2 * (n - 1))
            pixels[x, y] = tuple(
                int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)
            )
    return small.resize((size, size), Image.BICUBIC)


def _radial_vignette(size, centre, edge):
    """Viñeta suave: centro más claro que los bordes."""
    n = 64
    small = Image.new("RGB", (n, n))
    pixels = small.load()
    half = (n - 1) / 2
    for y in range(n):
        for x in range(n):
            dx, dy = (x - half) / half, (y - half) / half
            t = min(1.0, (dx * dx + dy * dy) ** 0.5 / 1.25)
            pixels[x, y] = tuple(
                int(centre[i] + (edge[i] - centre[i]) * t) for i in range(3)
            )
    return small.resize((size, size), Image.BICUBIC)


def _grain(size):
    """
    Ruido grueso de media NEUTRA (≈128), desenfocado para que sobreviva al
    reescalado. Se devuelve sin escalar la intensidad: la fuerza se aplica al
    mezclarlo, no al generarlo.
    """
    return (Image.effect_noise((size, size), 24)
            .filter(ImageFilter.GaussianBlur(0.45))
            .convert("RGB"))


def _apply_grain(image, noise, amount):
    """
    Aplica textura en modo SUPERPOSICIÓN y la mezcla al `amount` indicado.

    Se usa superposición y no multiplicación porque multiplicar solo puede
    oscurecer: con un grano apreciable el verde lima perdía brillo y viraba a
    oliva. La superposición sobre un ruido de media neutra aclara y oscurece por
    igual, así que añade textura sin alterar la luminosidad media.
    """
    return Image.blend(image, ImageChops.overlay(image, noise), amount)


def render(size: int, background=True, grain: bool = True, scale: float = 1.0,
           mono=None, finish: bool = True) -> Image.Image:
    """
    Dibuja el icono.

    background=False → fondo transparente (foreground de Android, splash).
    mono             → color plano único (variante monocroma de Android).
    finish=False     → sin bisel, degradado ni sombra (útil a tamaños diminutos,
                       donde el relieve solo ensucia).
    """
    S = int(size * SUPERSAMPLE)
    k = S / CANVAS
    centre = CANVAS / 2
    bevel = max(1, int(BEVEL_PX * k))
    shadow_off = int(SHADOW_OFFSET * k)

    def place(poly):
        return [
            ((((x - centre) * scale) + centre) * k,
             (((y - centre) * scale) + centre) * k)
            for x, y in poly
        ]

    def mask_of(poly):
        m = Image.new("L", (S, S), 0)
        ImageDraw.Draw(m).polygon(place(poly), fill=255)
        return m

    masks = [mask_of(p) for p in SHAPES]
    union = masks[0]
    for m in masks[1:]:
        union = ImageChops.lighter(union, m)

    # ---------------------------------------------------------------- fondo
    if background:
        base = _radial_vignette(S, BG_CENTRE, BG_EDGE) if finish else Image.new(
            "RGB", (S, S), BG_EDGE)
        canvas = base.convert("RGBA")
        # Sombra proyectada de la marca sobre el fondo.
        if finish:
            shadow = union.filter(ImageFilter.GaussianBlur(SHADOW_BLUR * k))
            shadow = ImageChops.offset(shadow, shadow_off, shadow_off)
            shadow = shadow.point(lambda v: int(v * SHADOW_ALPHA))
            canvas = Image.composite(Image.new("RGBA", (S, S), (0, 0, 0, 255)),
                                     canvas, shadow)
    else:
        canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    # ------------------------------------------------------- formas y bisel
    for poly, mask, (light, dark) in zip(SHAPES, masks, TONES):
        if mono:
            fill = Image.new("RGB", (S, S), mono)
        elif finish:
            fill = _diagonal_gradient(S, light, dark)
        else:
            fill = Image.new("RGB", (S, S), dark)
        canvas.paste(fill.convert("RGBA"), (0, 0), mask)

        if not finish or mono:
            continue

        # Filo CLARO arriba-izquierda: la máscara menos ella misma desplazada
        # hacia abajo-derecha deja exactamente ese reborde.
        rim_light = ImageChops.subtract(mask, ImageChops.offset(mask, bevel, bevel))
        rim_light = rim_light.filter(ImageFilter.GaussianBlur(bevel * 0.35))
        canvas.paste(Image.new("RGBA", (S, S), (255, 255, 255, 255)),
                     (0, 0), rim_light.point(lambda v: int(v * BEVEL_LIGHT)))

        # Filo OSCURO abajo-derecha: el desplazamiento contrario.
        rim_dark = ImageChops.subtract(mask, ImageChops.offset(mask, -bevel, -bevel))
        rim_dark = rim_dark.filter(ImageFilter.GaussianBlur(bevel * 0.35))
        canvas.paste(Image.new("RGBA", (S, S), (0, 0, 0, 255)),
                     (0, 0), rim_dark.point(lambda v: int(v * BEVEL_DARK)))

    out = canvas.resize((size, size), Image.LANCZOS)

    # ---------------------------------------------------------------- grano
    if not grain:
        return out

    mark_mask = union.resize((size, size), Image.LANCZOS)
    rgb = out.convert("RGB")
    noise = _grain(size)
    if background:
        rgb = _apply_grain(rgb, noise, GRAIN_BG)
    textured = _apply_grain(rgb, noise, GRAIN_MARK)
    rgb = Image.composite(textured, rgb, mark_mask)

    result = rgb.convert("RGBA")
    result.putalpha(out.split()[3])
    return result


def _write_svg(path: str) -> None:
    """
    Emite el SVG con la geometría trazada, en color PLANO.

    El acabado (degradado, bisel, sombra, grano) vive solo en los PNG: es un
    efecto de rasterizado y reproducirlo en SVG lo haría divergir del pipeline
    real, que es el que genera los assets que usa la app.
    """
    def points(poly):
        return " ".join(f"{x},{y}" for x, y in poly)

    svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<!--
  GENERADO por scripts/build_icon.py — no editar a mano.

  Icono de Vigor: una V cuyo brazo IZQUIERDO es un rayo de dos trazos (una sola
  muesca, borde superior horizontal) y cuyo brazo DERECHO es un ROMBOIDE en un
  tono más oscuro del mismo verde. Convergen en el vértice inferior.

  La forma es el TRAZADO del boceto a mano del usuario: ver la nota de
  procedencia en scripts/build_icon.py.

  Este SVG lleva color PLANO. El acabado con degradado, bisel, sombra y grano de
  los PNG es un efecto de rasterizado y no se reproduce aquí.

  Sin esquinas redondeadas: iOS aplica su propia máscara.
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#16191C"/>
  <!-- Brazo izquierdo: el rayo -->
  <polygon points="{points(BOLT)}" fill="#9BE317"/>
  <!-- Brazo derecho: el romboide, tono más oscuro -->
  <polygon points="{points(RHOMBOID)}" fill="#6FA310"/>
</svg>
"""
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(svg)


def main() -> None:
    assets = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")

    # iOS: cuadrado completo; iOS aplica su máscara de esquinas.
    render(1024).convert("RGB").save(os.path.join(assets, "icon.png"))

    # Android adaptativo: la marca al 62 % para respetar la zona segura circular.
    render(1024, background=False, scale=0.62).save(
        os.path.join(assets, "android-icon-foreground.png"))
    render(1024, background=False, scale=0.62, grain=False,
           mono=(255, 255, 255), finish=False).save(
        os.path.join(assets, "android-icon-monochrome.png"))
    Image.new("RGB", (1024, 1024), BG_EDGE).save(
        os.path.join(assets, "android-icon-background.png"))

    # Splash: más holgura alrededor de la marca.
    render(1024, background=False, scale=0.55).save(
        os.path.join(assets, "splash-icon.png"))

    # Favicon: sin relieve ni grano; a 48 px solo ensuciarían.
    render(48, grain=False, finish=False).convert("RGB").save(
        os.path.join(assets, "favicon.png"))

    _write_svg(os.path.join(assets, "icon.svg"))
    print("Icono regenerado en assets/ (PNG + SVG)")


if __name__ == "__main__":
    main()
