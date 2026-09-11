# Aspect Ratios — Reglas de Composición por Formato

El kit detecta automáticamente la resolución y el aspect ratio del vídeo de entrada
y adapta TODAS las reglas de composición, posicionamiento y tipografía.

---

## Detección automática (Fase 1 del pipeline)

```bash
VIDEO_W=$($FFPROBE_BIN -v quiet -select_streams v:0 \
  -show_entries stream=width -of csv=p=0 input/video.mp4)
VIDEO_H=$($FFPROBE_BIN -v quiet -select_streams v:0 \
  -show_entries stream=height -of csv=p=0 input/video.mp4)

RATIO=$(echo "scale=3; $VIDEO_W/$VIDEO_H" | bc)

# Clasificación
if (( $(echo "$RATIO >= 1.700" | bc -l) )); then
  ASPECT="16:9"
elif (( $(echo "$RATIO >= 1.200" | bc -l) )); then
  ASPECT="4:3"
elif (( $(echo "$RATIO >= 0.900" | bc -l) )); then
  ASPECT="1:1"
else
  ASPECT="9:16"
fi

echo "Vídeo: ${VIDEO_W}×${VIDEO_H} — Aspect ratio: $ASPECT"
```

Guarda `VIDEO_W`, `VIDEO_H` y `ASPECT` — se usan en todas las fases siguientes.

---

## Formato 16:9 — Landscape (YouTube, ponencias, cursos)

**Resoluciones típicas:** 3840×2160 (4K), 1920×1080 (FHD), 1280×720 (HD)

### Zona segura del hablante
El hablante suele estar en el centro o ligeramente desplazado.
Zona a no cubrir: franja central del 40% del ancho.

```
┌────────────────────────────────────────────┐
│  ZONA LIBRE  │   HABLANTE   │  ZONA LIBRE  │
│   (30%)      │    (40%)     │    (30%)     │
│              │              │              │
│  cards aquí  │   no tocar   │  cards aquí  │
└────────────────────────────────────────────┘
```

### Posicionamiento de cards

| Tipo de card | Posición | Ancho | Alto máx |
|---|---|---|---|
| Stat card | Esquina inf. izq. o der. | 28% del ancho | 35% del alto |
| Bullet list | Lateral izquierdo o derecho | 38% del ancho | 60% del alto |
| Highlight (texto) | Parte inferior centrada | 70% del ancho | 20% del alto |
| CTA card | Parte inferior central | 55% del ancho | 18% del alto |
| Urgency card | Parte inferior central | 50% del ancho | 16% del alto |
| Intro title | Superior izquierda | 45% del ancho | 40% del alto |
| Quote card | Lateral izquierdo | 40% del ancho | auto |
| Cierre | Inferior izquierda (face cam derecha) | 45% | 100% |

### Tipografía (escala base 1920×1080)

```css
/* Títulos de beats */
font-size: clamp(32px, 3.5vw, 72px);

/* Números en stat card */
font-size: clamp(64px, 8vw, 160px);

/* Texto de cards */
font-size: clamp(20px, 2vw, 42px);

/* Labels y subtexto */
font-size: clamp(14px, 1.2vw, 26px);

/* Subtítulos karaoke */
font-size: clamp(22px, 2.5vw, 48px);
```

Para 4K (3840×2160): multiplica todos los valores por 2.

### Beats disponibles en 16:9
Todos los tipos: stat card, bullet list, highlight, CTA, urgency, quote, intro, cierre.

---

## Formato 9:16 — Vertical (Shorts, TikTok, Reels)

**Resoluciones típicas:** 1080×1920, 720×1280

### Zona segura del hablante
En vertical, el hablante ocupa casi todo el ancho. Las cards SOLO van arriba o abajo.
Nunca a los lados — no hay espacio lateral.

```
┌──────────────┐
│  ZONA CARD   │  ← top 20% (intro, highlights breves)
│   (20%)      │
├──────────────┤
│              │
│  HABLANTE    │  ← 60% central — NO TOCAR
│  (60%)       │
│              │
├──────────────┤
│  ZONA CARD   │  ← bottom 20% (CTAs, stats, karaoke)
│   (20%)      │
└──────────────┘
```

### Posicionamiento de cards en 9:16

| Tipo de card | Posición | Ancho | Alto máx |
|---|---|---|---|
| Stat card | Inferior central | 85% del ancho | 18% del alto |
| Bullet list | Inferior, stack vertical | 90% del ancho | 25% del alto |
| Highlight (texto) | Inferior central | 90% del ancho | 15% del alto |
| CTA card | Inferior central | 90% del ancho | 14% del alto |
| Urgency card | Inferior central | 88% del ancho | 12% del alto |
| Intro title | Superior central | 88% del ancho | 22% del alto |
| Quote card | Inferior central | 85% del ancho | auto |
| Cierre | Inferior central | 90% del ancho | 20% del alto |

**Regla crítica en 9:16:** Las cards NO tienen `backdrop-filter: blur()` fuerte — en pantalla pequeña el blur pesado es distractor. Usar `blur(8px)` máximo.

### Tipografía en 9:16 (se lee en móvil, tamaño mínimo mayor)

```css
/* Títulos de beats */
font-size: clamp(28px, 6vw, 52px);

/* Números en stat card */
font-size: clamp(56px, 14vw, 110px);

/* Texto de cards */
font-size: clamp(18px, 4vw, 36px);

/* Labels y subtexto */
font-size: clamp(13px, 2.5vw, 22px);

/* Subtítulos karaoke */
font-size: clamp(20px, 5vw, 40px);
font-weight: 700;  /* más grueso — legible en móvil */
```

### Adaptaciones específicas para 9:16
- **Bullet list**: máximo 3 bullets visibles a la vez (pantalla pequeña)
- **Stat card**: el número va arriba, el label debajo — nunca lado a lado
- **Intro title**: una sola línea o dos líneas máximo
- **Sin beat de cierre con face cam desplazada** — no hay espacio en vertical
- **Karaoke**: más grande y bold que en landscape — es lo más importante

### Beats NO disponibles en 9:16
- Beat de cierre con face cam desplazada (requiere espacio lateral)
- Bullet list de más de 3 items simultáneos
- Cards laterales de ningún tipo

---

## Formato 1:1 — Cuadrado (Instagram feed)

**Resoluciones típicas:** 1080×1080

### Zona segura del hablante
Similar al 9:16 pero con más espacio lateral disponible.

```
┌──────────────────┐
│  ZONA CARD top   │  ← 15%
├──────────────────┤
│                  │
│    HABLANTE      │  ← 70% central
│    (centrado)    │
│                  │
├──────────────────┤
│  ZONA CARD bot   │  ← 15%
└──────────────────┘
```

### Posicionamiento en 1:1

| Tipo de card | Posición | Ancho |
|---|---|---|
| Stat card | Inferior central | 75% |
| Bullet list | Inferior | 80% |
| Highlight | Inferior central | 80% |
| CTA card | Inferior central | 78% |
| Intro title | Superior central | 80% |

### Tipografía en 1:1
Igual que 9:16 — se visualiza en móvil principalmente.

---

## Formato 4:3 — (cámaras antiguas, algunos podcasts)

**Resoluciones típicas:** 1440×1080, 1024×768

Tratar como 16:9 con márgenes laterales más reducidos:
- Ancho de cards: reducir un 15% respecto a 16:9
- El hablante ocupa más % del ancho — zona libre lateral más pequeña

---

## Cómo afecta el aspect ratio al viewport del HTML

El HTML de cada beat debe tener exactamente las dimensiones del vídeo:

```html
<!-- Para 1920×1080 -->
<body style="width: 1920px; height: 1080px;">

<!-- Para 3840×2160 (4K) -->
<body style="width: 3840px; height: 2160px;">

<!-- Para 1080×1920 (vertical) -->
<body style="width: 1080px; height: 1920px;">
```

Y el capture.js debe usar esas mismas dimensiones en el viewport:
```js
await page.setViewport({ width: VIDEO_W, height: VIDEO_H, deviceScaleFactor: 1 });
```

**Nunca hardcodear 1920×1080.** Siempre usar las variables `VIDEO_W` y `VIDEO_H`
detectadas en la Fase 1 del pipeline.

---

## Resumen rápido de decisiones por formato

| Aspecto | Cards laterales | Cards inferiores | Karaoke | Blur en cards |
|---|---|---|---|---|
| 16:9 | ✅ Sí | ✅ Sí | Normal | blur(20px) |
| 9:16 | ❌ No | ✅ Principal zona | Grande y bold | blur(8px) máx |
| 1:1 | ⚠️ Solo pequeñas | ✅ Sí | Grande | blur(12px) |
| 4:3 | ✅ Reducidas | ✅ Sí | Normal | blur(16px) |
