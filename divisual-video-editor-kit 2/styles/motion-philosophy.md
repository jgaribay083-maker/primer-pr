# Motion Philosophy — Principios de Animación

Estas reglas definen cómo se comportan las animaciones para que el resultado se vea profesional y no amateur.

## El principio fundamental

**Las animaciones existen para reforzar lo que dice el hablante, no para decorar.**

Cada beat debe tener una razón de ser. Si no añade información o énfasis, no se añade.

## Reglas de timing

### Entrada y salida
- La card **entra 0.2s después** de que el hablante empiece a decir la frase clave (nunca antes)
- La card **sale 0.5s después** de que el hablante termine esa idea
- Nunca mantener una card más de 8 segundos — si la idea es larga, usa múltiples beats

### Sincronización con el habla
- Para karaoke: cada palabra aparece en el timestamp exacto del transcript
- Para stats: el número aparece cuando el hablante lo pronuncia
- Para listas: cada bullet aparece cuando el hablante menciona ese punto

### Duración de animaciones
```
Entrada:  0.35s - 0.5s  (rápido — no robar atención)
Salida:   0.25s - 0.35s (más rápido que la entrada)
Pausa:    nunca <0.5s   (el ojo necesita tiempo para leer)
```

## Reglas de composición visual

### Jerarquía
1. El hablante (face cam) — siempre el elemento principal
2. El elemento de motion graphics — soporte visual
3. Los subtítulos — siempre legibles, nunca encima de una card

### Zona de seguridad
Define la zona donde está la cara del hablante y nunca pongas nada ahí.
Si no sabes dónde está, asume que ocupa el tercio central de la pantalla.

```
┌──────────────────────────────────┐
│  ZONA LIBRE  │  ZONA HABLANTE   │
│  (cards aquí)│  (no tocar)      │
│              │                  │
└──────────────────────────────────┘
```

### Densidad
- **Máximo 2 elementos** activos al mismo tiempo en pantalla
- Si hay karaoke + card: la card va arriba, karaoke abajo
- Si hay 2 cards: nunca una encima de la otra, siempre lado a lado o con gap

## Reglas de color

### Por tipo de contenido
- Información neutra → azul (`#60a5fa`)
- Dato positivo / beneficio → verde (`#4ade80`)
- Dato de impacto / número grande → rojo o naranja (`#ff4444` / `#fb923c`)
- Cita textual → amarillo (`#fbbf24`)
- Elemento secundario → morado (`#a78bfa`)

### Fondo de composición
- Siempre `rgba(0,0,0,0)` — el fondo es el propio vídeo
- Nunca fondo sólido que tape el vídeo completo (excepto en el beat de cierre)
- Si se necesita fondo oscuro para contraste: `rgba(0,0,0,0.3)` máximo

## Lo que hace que una animación parezca amateur

Evitar siempre:
- **Animaciones que rebotan demasiado** — el elastic/bounce excesivo parece juguetón
- **Texto demasiado pequeño** — si no se lee en móvil, no sirve
- **Colores que no contrastan** — texto blanco sobre fondo claro, nunca
- **Cards demasiado grandes** — que ocupen más del 45% de la pantalla
- **Demasiados elementos a la vez** — más de 2 activos = caos
- **Animación sin propósito** — si no refuerza algo que dice el hablante, fuera

## Plantilla HTML mínima para un beat

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  body {
    width: 1920px;
    height: 1080px;
    background: transparent;
    font-family: 'Inter', sans-serif;
    overflow: hidden;
  }
  
  /* El contenedor principal siempre position: absolute; inset: 0 */
  .scene {
    position: absolute;
    inset: 0;
  }
  
  /* Cards con liquid glass */
  .card {
    position: absolute;
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 24px 32px;
    animation: fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
</style>
<!-- Fuentes -->
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
</head>
<body>
<div class="scene">
  <!-- Aquí van los elementos del beat -->
</div>
</body>
</html>
```

## Checklist antes de renderizar un beat

- [ ] ¿El HTML mide exactamente 1920x1080px?
- [ ] ¿El fondo es transparente (`background: transparent`)?
- [ ] ¿Las fuentes cargan desde Google Fonts?
- [ ] ¿La card no cubre la zona del hablante?
- [ ] ¿El texto tiene contraste suficiente con el fondo?
- [ ] ¿Las animaciones tienen `forwards` para que no vuelvan al estado inicial?
- [ ] ¿El timing de entrada está ajustado al timestamp del transcript?
