# Estilo Visual por Defecto

Usa este estilo cuando no hay un archivo de estilo específico para el cliente.

## Paleta de colores

| Nombre | Hex | Uso |
|---|---|---|
| Fondo | `#050508` | Background de composiciones |
| Azul | `#60a5fa` | Acento principal, títulos |
| Verde | `#4ade80` | Datos positivos, logros |
| Rojo | `#ff4444` | Alertas, énfasis fuerte |
| Amarillo | `#fbbf24` | Citas, highlights |
| Morado | `#a78bfa` | Secundario, transiciones |
| Naranja | `#fb923c` | Llamadas a la acción |
| Texto | `#e0e0e0` | Texto principal |
| Texto suave | `#888888` | Labels, subtexto |

## Tipografía

```css
/* Títulos y números grandes */
font-family: 'Space Grotesk', sans-serif;
font-weight: 700;

/* Texto de cuerpo y descripciones */
font-family: 'Inter', sans-serif;
font-weight: 400;

/* Datos numéricos, código, timestamps */
font-family: 'JetBrains Mono', monospace;
```

Cargar siempre desde Google Fonts en el `<head>` del HTML:
```html
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
```

## Estilo de cards (liquid glass)

```css
background: rgba(255, 255, 255, 0.04);
backdrop-filter: blur(20px);
-webkit-backdrop-filter: blur(20px);
border: 1px solid rgba(255, 255, 255, 0.08);
border-radius: 16px;
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
```

## Animaciones de entrada

```css
/* fadeUp — para cards y texto */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
animation: fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;

/* popIn — para números y stats */
@keyframes popIn {
  from { opacity: 0; transform: scale(0.85); }
  to   { opacity: 1; transform: scale(1); }
}
animation: popIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;

/* fadeOut — para salida de cards */
@keyframes fadeOut {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(-10px); }
}
```

## Posicionamiento de cards

- Si el hablante está a la **derecha** → card en **mitad izquierda** (left: 2%, width: 46%)
- Si el hablante está a la **izquierda** → card en **mitad derecha** (right: 2%, width: 46%)
- Si el hablante está **centrado** → card pequeña abajo (bottom: 15%, centrada, width: 60%)
- **Nunca** cubrir la cara del hablante
- Margen mínimo del borde de pantalla: 2%

## Tipos de beat disponibles

### 1. Título introductorio
Card grande en mitad de pantalla con el tema del vídeo. Karaoke subtítulos debajo.

### 2. Stat card
Número grande + label. Fondo con glow del color del acento. Animación popIn.

### 3. Lista de puntos
Card con bullet points que aparecen uno a uno sincronizados con el hablante.

### 4. Cita destacada
Borde izquierdo amarillo, texto en cursiva, sin fondo sólido.

### 5. Cierre
Face cam se reduce al 50% derecho con esquinas redondeadas. Texto "Gracias por ver" en la mitad izquierda.

## Subtítulos karaoke

```css
/* Contenedor */
position: absolute;
bottom: 8%;
left: 50%;
transform: translateX(-50%);
text-align: center;
font-family: 'Inter', sans-serif;
font-size: clamp(18px, 2.5vw, 28px);
font-weight: 600;
color: #ffffff;
text-shadow: 0 2px 8px rgba(0,0,0,0.8);
max-width: 80%;

/* Palabra activa (la que se está diciendo) */
color: #fbbf24; /* amarillo */
```
