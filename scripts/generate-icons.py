#!/usr/bin/env python3
"""Gera os ícones do Cuidar (gota d'água + cápsula) em assets/.

Uso: python3 scripts/generate-icons.py   (requer Pillow: pip install pillow)

Arquivos gerados:
  assets/icon.png                      1024×1024, ícone iOS/geral (fundo azul)
  assets/android-icon-foreground.png   1024×1024, camada frontal do adaptive icon
  assets/android-icon-background.png   1024×1024, fundo azul do adaptive icon
  assets/android-icon-monochrome.png   1024×1024, silhueta para ícone temático (Android 13+)
  assets/splash-icon.png               1024×1024, marca sobre fundo transparente (splash)
  assets/notification-icon.png         96×96, silhueta branca (barra de status Android)
  assets/favicon.png                   48×48
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / 'assets'

PRIMARY = (0x0B, 0x5F, 0xA5)       # theme.ts LIGHT.primary
PRIMARY_DARK = (0x08, 0x47, 0x80)
WHITE = (0xFF, 0xFF, 0xFF)
AMBER = (0xFF, 0xB3, 0x00)         # theme.ts LIGHT.focus (destaque do medicamento)

SS = 4  # supersampling


def teardrop(cx: float, cy: float, h: float) -> list[tuple[float, float]]:
    """Polígono de uma gota com altura total `h`, centrada horizontalmente em cx, topo em cy - h/2."""
    r = h * 0.36
    top = cy - h / 2
    ccy = cy + h / 2 - r
    d = ccy - top
    alpha = math.acos(r / d)
    pts = [(cx, top)]
    start = -math.pi / 2 + alpha
    end = -math.pi / 2 - alpha + 2 * math.pi
    steps = 240
    for i in range(steps + 1):
        a = start + (end - start) * i / steps
        pts.append((cx + r * math.cos(a), ccy + r * math.sin(a)))
    return pts


def capsule_layer(size: int, length: float, thick: float, colors, stroke, stroke_w: float, angle: float) -> Image.Image:
    """Cápsula (duas metades) desenhada reta e girada em `angle` graus."""
    layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx = cy = size / 2
    x0, x1 = cx - length / 2, cx + length / 2
    y0, y1 = cy - thick / 2, cy + thick / 2
    if stroke is not None:
        d.rounded_rectangle((x0 - stroke_w, y0 - stroke_w, x1 + stroke_w, y1 + stroke_w),
                            radius=thick / 2 + stroke_w, fill=stroke + (255,))
    # metade esquerda / direita
    d.rounded_rectangle((x0, y0, x1, y1), radius=thick / 2, fill=colors[0] + (255,))
    half = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    hd = ImageDraw.Draw(half)
    hd.rounded_rectangle((x0, y0, x1, y1), radius=thick / 2, fill=colors[1] + (255,))
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rectangle((cx, 0, size, size), fill=255)
    layer.paste(half, (0, 0), mask)
    if stroke is not None:
        # linha divisória entre as metades, na cor do contorno
        d.line((cx, y0, cx, y1), fill=stroke + (255,), width=max(1, int(stroke_w * 0.6)))
    return layer.rotate(angle, resample=Image.BICUBIC, center=(cx, cy))


def draw_mark(size: int, scale: float, drop_color, capsule_colors, stroke, bg=None) -> Image.Image:
    """Marca completa (gota + cápsula) ocupando `scale` da altura da imagem."""
    s = size * SS
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    if bg is not None:
        img = Image.new('RGBA', (s, s), bg + (255,))
    d = ImageDraw.Draw(img)
    h = s * scale
    cx = s / 2 - h * 0.08
    cy = s / 2 - h * 0.04
    d.polygon(teardrop(cx, cy, h), fill=drop_color + (255,))

    cap_len = h * 0.78
    cap_th = h * 0.30
    stroke_w = h * 0.055 if stroke is not None else 0
    cap = capsule_layer(s, cap_len, cap_th, capsule_colors, stroke, stroke_w, angle=35)
    # posiciona a cápsula cruzando a parte inferior direita da gota
    dx = int(h * 0.26)
    dy = int(h * 0.30)
    shifted = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    shifted.paste(cap, (dx, dy), cap)
    img.alpha_composite(shifted)
    return img.resize((size, size), Image.LANCZOS)


def silhouette(img: Image.Image, color) -> Image.Image:
    """Mesma forma, numa única cor opaca (alpha preservado)."""
    alpha = img.getchannel('A')
    out = Image.new('RGBA', img.size, color + (0,))
    out.putalpha(alpha)
    return out


def vertical_gradient(size: int, top, bottom) -> Image.Image:
    img = Image.new('RGBA', (size, size))
    px = img.load()
    for y in range(size):
        t = y / (size - 1)
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        for x in range(size):
            px[x, y] = c + (255,)
    return img


def main() -> None:
    ASSETS.mkdir(exist_ok=True)

    # Ícone principal (iOS aplica a máscara arredondada; sem transparência).
    bg = vertical_gradient(1024, PRIMARY, PRIMARY_DARK)
    mark = draw_mark(1024, 0.62, WHITE, (WHITE, AMBER), PRIMARY)
    bg.alpha_composite(mark)
    bg.convert('RGB').save(ASSETS / 'icon.png', optimize=True)

    # Adaptive icon (Android): a área segura é o círculo central de 66%.
    fg = draw_mark(1024, 0.46, WHITE, (WHITE, AMBER), PRIMARY)
    fg.save(ASSETS / 'android-icon-foreground.png', optimize=True)
    vertical_gradient(1024, PRIMARY, PRIMARY_DARK).save(ASSETS / 'android-icon-background.png', optimize=True)
    mono = silhouette(draw_mark(1024, 0.46, WHITE, (WHITE, WHITE), None), WHITE)
    mono.save(ASSETS / 'android-icon-monochrome.png', optimize=True)

    # Splash: marca sobre fundo transparente; a cor de fundo vem do app.config.ts.
    draw_mark(1024, 0.70, WHITE, (WHITE, AMBER), PRIMARY).save(ASSETS / 'splash-icon.png', optimize=True)

    # Ícone de notificação (Android): só alpha é usado, em branco.
    notif = silhouette(draw_mark(96, 0.84, WHITE, (WHITE, WHITE), None), WHITE)
    notif.save(ASSETS / 'notification-icon.png', optimize=True)

    # Favicon
    Image.open(ASSETS / 'icon.png').resize((48, 48), Image.LANCZOS).save(ASSETS / 'favicon.png', optimize=True)
    print('ícones gerados em', ASSETS)


if __name__ == '__main__':
    main()
