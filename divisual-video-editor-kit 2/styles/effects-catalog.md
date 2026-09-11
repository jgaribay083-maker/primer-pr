# Catálogo de Efectos y Animaciones

Lista completa de efectos disponibles. El cliente puede pedirlos por su nombre o describirlos en lenguaje natural a Claude. Todos usan **paleta neutra profesional** por defecto (blanco, gris, negro). Si el cliente tiene colores definidos en `client-style.md`, esos se aplican como acento.

---

## Paleta neutra por defecto

```css
--text-primary:   #f5f5f5;   /* texto principal — blanco roto */
--text-secondary: #999999;   /* labels, metadatos */
--text-muted:     #555555;   /* texto desactivado */
--bg-card:        rgba(0, 0, 0, 0.55);   /* fondo de cards */
--border-soft:    rgba(255, 255, 255, 0.08);
--border-strong:  rgba(255, 255, 255, 0.18);
--accent-default: #fbbf24;   /* dorado sutil — solo si no hay client-style */
--shadow:         0 8px 32px rgba(0, 0, 0, 0.5);
```

Cuando exista `styles/client-style.md`, el `--accent-default` se sustituye por el color de marca del cliente.

---

## TEXTO Y TÍTULOS

### `titulo-impacto`
Título grande tipográfico, sin card, con text-shadow profundo. Aparece con un slamIn (scale 1.1 → 1.0).
- **Cuándo:** intro de vídeo, frase de cierre, momento clave
- **Cómo lo pide:** "pon un título 'X' en el segundo Y"

### `maquina-de-escribir`
El texto se escribe carácter a carácter, con cursor parpadeante.
- **Cuándo:** revelar un secreto, una definición, una frase impactante
- **Cómo lo pide:** "escribe 'X' a máquina cuando digo Y"

### `palabra-a-palabra`
Cada palabra aparece secuencialmente con fadeUp escalonado.
- **Cuándo:** dar peso a una frase, hacer que el espectador la lea con énfasis
- **Cómo lo pide:** "haz que aparezca palabra a palabra"

### `karaoke`
Subtítulos sincronizados — la palabra activa se ilumina con el color acento.
- **Cuándo:** todo vídeo con habla — útil para retención en mute
- **Cómo lo pide:** "añade subtítulos karaoke" o "pon karaoke"

### `reveal-escalonado`
Múltiples líneas aparecen una a una con stagger de 0.15s.
- **Cuándo:** títulos de varias líneas, listas cortas
- **Cómo lo pide:** "haz que aparezcan las líneas una a una"

### `texto-deslizante`
Texto entra deslizándose desde un lateral.
- **Cuándo:** transiciones entre secciones, lower thirds
- **Cómo lo pide:** "mete el texto deslizándose"

### `texto-resaltado`
Aparece un highlight (subrayado animado) sobre palabras clave después de mostrarse.
- **Cuándo:** marcar palabras importantes en una frase
- **Cómo lo pide:** "resalta la palabra X"

---

## DATOS Y STATS

### `numero-grande`
Cifra muy grande + label debajo. Glow sutil con color acento.
- **Cuándo:** porcentajes, ingresos, métricas de impacto
- **Cómo lo pide:** "pon '5.000€' como número grande" / "stat card de 80%"

### `contador-animado`
El número va contando de 0 al valor objetivo durante 1.5s.
- **Cuándo:** datos que crecen ("+10,000 clientes"), revelaciones
- **Cómo lo pide:** "haz un contador hasta X"

### `barra-de-progreso`
Barra horizontal que se rellena con el porcentaje.
- **Cuándo:** mostrar progreso, comparar magnitudes
- **Cómo lo pide:** "barra de progreso al 75%"

### `circulo-progreso`
Anillo circular que se rellena con el porcentaje. Más elegante que la barra.
- **Cuándo:** datos premium, dashboards, KPIs
- **Cómo lo pide:** "círculo de progreso del X%"

### `comparativa-numerica`
Dos números lado a lado con un VS o flecha. Ej: "antes 100 → ahora 1.000".
- **Cuándo:** mostrar mejora, antes/después numérico
- **Cómo lo pide:** "compara X con Y"

### `grafico-barras`
2-4 barras verticales que crecen escalonadas.
- **Cuándo:** comparar 2-4 datos, evolución temporal corta
- **Cómo lo pide:** "gráfico de barras con X, Y, Z"

---

## LISTAS Y ESTRUCTURAS

### `bullet-list`
Lista con bullets (puntos) que aparecen secuencialmente.
- **Cuándo:** enumerar puntos, beneficios, características
- **Cómo lo pide:** "lista con tres puntos: X, Y, Z"

### `lista-checks`
Cada ítem aparece con un checkmark animado.
- **Cuándo:** beneficios, requisitos cumplidos, "lo que vas a aprender"
- **Cómo lo pide:** "lista con checks de X, Y, Z"

### `lista-numerada`
Números grandes (1, 2, 3) a la izquierda de cada ítem.
- **Cuándo:** pasos de un proceso, ranking, prioridades
- **Cómo lo pide:** "lista numerada del 1 al 3 con X, Y, Z"

### `antes-despues`
Dos columnas — izquierda "ANTES" en gris, derecha "DESPUÉS" en color acento.
- **Cuándo:** transformación, mejora, evolución
- **Cómo lo pide:** "antes/después: X vs Y"

### `pros-contras`
Dos columnas — izquierda checks verdes, derecha cruces rojas.
- **Cuándo:** comparativas honestas, decisión entre opciones
- **Cómo lo pide:** "pros y contras de X"

### `tres-pilares`
Tres columnas iguales con icono + título + descripción corta.
- **Cuándo:** estructurar una metodología, principios fundamentales
- **Cómo lo pide:** "tres pilares: X, Y, Z"

---

## ICONOGRAFÍA Y DESTACADOS

### `flecha-apunta`
Flecha animada que aparece apuntando a un punto específico de la pantalla.
- **Cuándo:** señalar algo en pantalla compartida o face cam
- **Cómo lo pide:** "flecha apuntando a X"

### `circulo-highlight`
Círculo o elipse dibujado a mano que rodea un elemento.
- **Cuándo:** destacar elementos en una demo, capturas de pantalla
- **Cómo lo pide:** "redondea X en el segundo Y"

### `badge`
Etiqueta pequeña con texto corto. Estilo tag.
- **Cuándo:** marcar algo como "NUEVO", "GRATIS", "PRO"
- **Cómo lo pide:** "pon un badge 'NUEVO'"

### `check-grande`
Animación de checkmark grande que se dibuja en el centro.
- **Cuándo:** confirmación, finalización exitosa, validación
- **Cómo lo pide:** "check grande" / "tick de validación"

### `estrellas-rating`
5 estrellas que se rellenan secuencialmente.
- **Cuándo:** testimonios, ratings, evaluaciones
- **Cómo lo pide:** "rating de 5 estrellas" / "5 estrellas"

---

## CITAS Y TESTIMONIOS

### `quote-card`
Card con borde izquierdo color acento, texto en cursiva, comillas grandes.
- **Cuándo:** citar a alguien, reforzar una frase clave del propio hablante
- **Cómo lo pide:** "cita: '...'"

### `testimonial`
Avatar circular o emoji + nombre/profesión + frase del cliente.
- **Cuándo:** prueba social, casos reales
- **Cómo lo pide:** "testimonio de [nombre]: '...'"

### `lower-third`
Banda inferior estilo televisión con nombre y rol del que habla.
- **Cuándo:** introducir al hablante, entrevistas, podcast
- **Cómo lo pide:** "lower third con mi nombre y cargo"

---

## URGENCIA Y CUENTA ATRÁS

### `countdown-321`
Cuenta atrás "3... 2... 1..." con números grandes que aparecen y desaparecen.
- **Cuándo:** introducción dramática, antes de un reveal
- **Cómo lo pide:** "cuenta atrás de 3 a 1"

### `timer-oferta`
Reloj/cronómetro mostrando tiempo restante (estático o ticking).
- **Cuándo:** ofertas con fecha límite, plazas que se acaban
- **Cómo lo pide:** "timer de X días/horas"

### `stamp-urgente`
Sello impreso animado que aparece con efecto "stamp" — texto en MAYÚSCULAS.
- **Cuándo:** urgencia máxima, ofertas, alertas
- **Cómo lo pide:** "stamp 'URGENTE'" / "sello de 'OFERTA'"

---

## ESPECÍFICOS DE YOUTUBE / SOCIAL

### `subscribe-button`
Botón rojo de SUSCRÍBETE que aparece con pulse.
- **Cuándo:** CTA al final del vídeo, momentos clave
- **Cómo lo pide:** "botón de suscríbete"

### `like-burst`
Pulgar arriba o corazón que aparece con burst de partículas.
- **Cuándo:** pedir like, momentos emocionantes
- **Cómo lo pide:** "burst de like" / "corazón animado"

### `notification-pop`
Notificación estilo iOS/Android con texto corto.
- **Cuándo:** cuando el hablante menciona "te llega una notificación", "te avisamos"
- **Cómo lo pide:** "notificación que dice 'X'"

---

## TRANSICIONES Y EFECTOS CINEMATOGRÁFICOS

### `fade-transition`
Fundido entre dos beats — fade out del anterior, fade in del siguiente.
- **Cuándo:** transición entre secciones del vídeo
- **Cómo lo pide:** "fade entre el beat X y el Y"

### `zoom-cinematico`
Zoom in lento sobre el hablante o un elemento (Ken Burns effect).
- **Cuándo:** momentos íntimos, énfasis visual
- **Cómo lo pide:** "zoom lento al segundo X"

### `particulas-flotantes`
Partículas pequeñas flotando suavemente en el fondo.
- **Cuándo:** ambiente premium, momentos emocionales
- **Cómo lo pide:** "partículas flotantes" / "ambiente premium"

### `glitch`
Efecto de glitch sutil de 0.3s — útil con moderación.
- **Cuándo:** transición a un tema disruptivo, "espera, esto cambia todo"
- **Cómo lo pide:** "glitch antes de X"

---

## LOGO Y BRANDING

### `logo-reveal`
Animación del logo del cliente apareciendo con efecto.
- **Cuándo:** intro y/o cierre del vídeo
- **Cómo lo pide:** "logo reveal al inicio" / "logo grande al final"

### `watermark-sutil`
Logo en esquina inferior con baja opacidad durante todo el vídeo.
- **Cuándo:** todos los vídeos en 16:9 con logo definido
- **Cómo lo pide:** "marca de agua con mi logo"

---

## Cómo añade Claude un efecto a un vídeo ya editado

1. Cliente pide en lenguaje natural: "añade un contador animado hasta 5000 en el segundo 32"
2. Claude busca el efecto en este catálogo (`contador-animado`)
3. Genera el HTML del nuevo beat usando la paleta neutra (o el `client-style.md`)
4. Lo añade a `output/compositions/[nombre]/` y a la lista de BEATS de `capture.js`
5. Actualiza el `edl.json` con el nuevo overlay
6. Renderiza solo ese beat (no todos)
7. Re-composita el vídeo final

Si el cliente pide algo que no está en el catálogo, Claude:
- Sugiere el efecto más parecido del catálogo
- Si nada encaja, lo crea desde cero usando los principios de `motion-philosophy.md` y la paleta neutra
