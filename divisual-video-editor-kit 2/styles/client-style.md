# Estilo Visual del Cliente

Configurado en el onboarding del 2026-04-29.

> **Concepto general:** mix dinámico + educativo, muy visual. Cards con datos animados y listas que aparecen punto a punto. Hablante centrado, cards nunca tapan la cara — siempre arriba o abajo. Motion enérgico con popIn en números y entradas rápidas.

---

## Paleta de colores

| Nombre | Hex | Uso |
|---|---|---|
| **Acento principal** | `#FAC51C` | Highlights, números (popIn), bullets activos, palabra karaoke activa, bordes de cita, glow de stats |
| **Secundario / fondo** | `#0D0D0D` | Fondo de cards (con 60% opacidad), fondo de cierre, base oscura |
| Texto principal | `#FFFFFF` | Cuerpo y títulos |
| Texto suave | `#B0B0B0` | Labels, subtexto, descripciones secundarias |
| Texto deshabilitado | `#666666` | Items de lista que aún no han aparecido |
| Fondo de pantalla completa | `#050508` | Solo si el beat lo requiere (cierre, transición) |

**Regla de uso:** el amarillo `#FAC51C` es el héroe — úsalo con moderación para que destaque. Como mucho 1-2 elementos amarillos por card. El resto es blanco sobre oscuro.

---

## Tipografía

```css
/* Títulos, números grandes y stats */
font-family: 'Space Grotesk', sans-serif;
font-weight: 700;

/* Texto de cuerpo, listas y descripciones */
font-family: 'Inter', sans-serif;
font-weight: 500;

/* Datos numéricos, código, timestamps */
font-family: 'JetBrains Mono', monospace;
font-weight: 600;
```

Cargar siempre desde Google Fonts en el `<head>`:

```html
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
```

---

## Estilo de cards — semitransparente oscuro al 60%

```css
background: rgba(13, 13, 13, 0.6);              /* #0D0D0D al 60% */
backdrop-filter: blur(12px);
-webkit-backdrop-filter: blur(12px);
border: 1px solid rgba(250, 197, 28, 0.18);     /* hint amarillo en el borde */
border-radius: 18px;
box-shadow:
  0 12px 40px rgba(0, 0, 0, 0.6),
  0 0 0 1px rgba(250, 197, 28, 0.05) inset;
padding: clamp(20px, 2.5vw, 36px);
```

**El blur cambia según el aspect ratio** (de `aspect-ratios.md`):
- 16:9 → `blur(20px)`
- 9:16 → `blur(8px)`
- 1:1  → `blur(12px)`

---

## Animaciones — estilo ENÉRGICO

Los timings son cortos (0.25–0.35s) y las curvas tienen overshoot para sensación de impacto.

```css
/* fadeUp rápido — cards y texto general */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(28px); }
  to   { opacity: 1; transform: translateY(0); }
}
.fade-up { animation: fadeUp 0.28s cubic-bezier(0.22, 1, 0.36, 1) forwards; }

/* popIn con overshoot — números, stats, badges */
@keyframes popIn {
  0%   { opacity: 0; transform: scale(0.7); }
  60%  { opacity: 1; transform: scale(1.08); }
  100% { opacity: 1; transform: scale(1); }
}
.pop-in { animation: popIn 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }

/* slideInUp para items de lista — uno detrás de otro */
@keyframes slideInUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
.list-item { animation: slideInUp 0.22s cubic-bezier(0.22, 1, 0.36, 1) forwards; opacity: 0; }
.list-item:nth-child(1) { animation-delay: 0.00s; }
.list-item:nth-child(2) { animation-delay: 0.18s; }
.list-item:nth-child(3) { animation-delay: 0.36s; }
.list-item:nth-child(4) { animation-delay: 0.54s; }
.list-item:nth-child(5) { animation-delay: 0.72s; }

/* highlightPulse — para resaltar la palabra/dato clave */
@keyframes highlightPulse {
  0%, 100% { color: #FFFFFF; text-shadow: none; }
  50%      { color: #FAC51C; text-shadow: 0 0 18px rgba(250, 197, 28, 0.6); }
}

/* fadeOut — salida limpia */
@keyframes fadeOut {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(-8px); }
}
.fade-out { animation: fadeOut 0.22s ease forwards; }
```

**Reglas de motion enérgico:**
- Entrada de card: 0.28s (no más)
- Números: SIEMPRE `popIn` con overshoot
- Listas: items con `stagger` de 180ms entre cada uno
- Salida: 0.22s, sin overshoot
- Toda animación con `forwards` (no rebota al estado inicial)

---

## Posicionamiento de cards — hablante CENTRADO

Como el hablante está en el centro, las cards van arriba o abajo. **Nunca cubrir la cara.**

| Beat | Posición | Tamaño |
|---|---|---|
| Card de dato/stat | `bottom: 8%`, centrada | `width: 70%`, `max-width: 1400px` |
| Lista de puntos | `bottom: 6%`, centrada | `width: 64%` |
| Título grande | `top: 10%`, centrada | `width: 76%` |
| Cita destacada | `bottom: 12%`, centrada | `width: 60%` |
| Stat pequeño / badge | esquina superior derecha (`top: 6%, right: 4%`) | `max-width: 22%` |

Margen mínimo del borde: **3%** en todos los casos.

**Para 9:16 (vertical):** las cards van solo arriba o abajo, nunca laterales. En 1:1 cuadrado, lo mismo pero con anchos reducidos al ~80% de los valores de 16:9.

---

## Tipos de beat (catálogo del cliente)

### 1. Intro con isotipo
Logo `logo-white.png` arriba centrado (8% ancho), título grande con la frase clave del primer hook subrayada en amarillo. Karaoke debajo.

### 2. Stat card
Número GIGANTE en `Space Grotesk 700` con `popIn` y color amarillo `#FAC51C`. Label debajo en blanco. Sombra/glow amarillo suave alrededor del número.

### 3. Lista educativa (3-5 puntos)
Bullet points que aparecen con stagger de 180ms. Bullet activo en amarillo `#FAC51C`, los anteriores en blanco, los que aún no llegan en gris `#666`.

### 4. Cita destacada
Borde izquierdo amarillo de 4px, texto en `Inter 500 italic`, sin fondo sólido — solo el borde y el texto sobre el vídeo.

### 5. Highlight inline
Sin card. Aparece una palabra/número grande (`Space Grotesk 700`) con `popIn` y shadow amarillo, encima o debajo del hablante, durante 1.5s.

### 6. Cierre
Logo grande centrado (`logo-white.png`, 25% ancho en 16:9), tagline opcional debajo en `Inter 600` blanco, fondo `#0D0D0D` al 70%.

### 7. Watermark continuo (solo 16:9)
`logo-icon.png` esquina inferior derecha, 4% de ancho, `opacity: 0.5`. Solo en 16:9 — en 9:16/1:1 no hay sitio.

---

## Subtítulos karaoke

```css
/* Contenedor */
position: absolute;
bottom: 6%;
left: 50%;
transform: translateX(-50%);
text-align: center;
font-family: 'Inter', sans-serif;
font-size: clamp(20px, 2.6vw, 32px);
font-weight: 600;
color: #FFFFFF;
text-shadow: 0 2px 12px rgba(0, 0, 0, 0.85);
max-width: 82%;
letter-spacing: 0.2px;

/* Palabra activa (la que se está diciendo) */
.karaoke-word.active {
  color: #FAC51C;
  text-shadow: 0 0 16px rgba(250, 197, 28, 0.5), 0 2px 12px rgba(0, 0, 0, 0.9);
  transform: scale(1.04);
  display: inline-block;
  transition: color 0.08s ease, transform 0.08s ease;
}

/* Palabras ya dichas */
.karaoke-word.past {
  color: #FFFFFF;
  opacity: 0.85;
}

/* Palabras aún no dichas */
.karaoke-word.future {
  color: rgba(255, 255, 255, 0.55);
}
```

---

## Logo de marca disponibles

- `brand/logo/logo-white.png` — isotipo blanco, 2560×2560, fondo transparente. **Versión por defecto** para todos los beats con fondo oscuro/medio.
- `brand/logo/logo-icon.png` — mismo isotipo, copia para watermark.
- ⚠️ **No hay versión oscura.** Si un beat necesitase fondo claro, forzar fondo oscuro `#0D0D0D` o pedir al cliente la versión negra.

Embebido siempre con `object-fit: contain` y nunca distorsionar.

---

## Resumen de decisiones de marca

| Decisión | Valor |
|---|---|
| Acento | `#FAC51C` amarillo dorado |
| Secundario | `#0D0D0D` negro carbón |
| Estilo edición | Híbrido dinámico + educativo |
| Posición hablante | Centro |
| Fondo de cards | Semitransparente oscuro 60% |
| Motion | Enérgico (popIn, stagger, overshoot) |
| Logo | Isotipo blanco (sin versión oscura) |
