# Divisual Video Editor Kit

> Edita vídeos con Claude Code automáticamente. Recorta silencios, añade animaciones y motion graphics, sincroniza subtítulos y todo en los colores de tu marca. Sin tocar un editor de vídeo.

**Exclusivo para miembros de [La Tribu Divisual](https://divisualproject.com/la-tribu)** — la mejor comunidad en español sobre IA aplicada a negocios. Si estás leyendo esto es porque ya formas parte. Bienvenido.

---

## Qué hace este kit

Le metes un vídeo raw (tuyo grabándote, una entrevista, un pitch...) y te devuelve un vídeo editado profesional con:

- **Cortes automáticos** — quita silencios largos, retakes, "ehs" y filler words
- **Motion graphics** — cards animadas con datos, listas, citas, highlights, CTAs
- **Subtítulos sincronizados** palabra a palabra, con tu estilo
- **Detecta el formato** — funciona con horizontal (YouTube), vertical (Reels/Shorts) o cuadrado (Instagram)
- **Tu marca, tus colores** — la primera vez te pregunta tu paleta y la usa siempre

Todo a 4K, con alfa real (ProRes 4444), listo para subir a cualquier plataforma.

---

## Lo que necesitas antes de empezar

| Requisito | Para qué |
|---|---|
| **Mac con macOS** | El kit usa Homebrew y herramientas nativas |
| **Claude Code** instalado | El cerebro que orquesta todo. [Descargar aquí](https://claude.com/claude-code) |
| **Plan Claude Pro** ($20/mes) | Necesario para que Claude Code procese vídeos largos |
| **API key de ElevenLabs** | Para transcribir el audio. Tier gratis suficiente para empezar. [Conseguir aquí](https://elevenlabs.io/app/settings/api-keys) |

El resto (FFmpeg, Node, Python, Bun) lo instala el kit automáticamente.

---

## Cómo usarlo (3 pasos)

### 1. Instalación (solo la primera vez)

1. Descarga el ZIP desde el classroom de **La Tribu Divisual** en Skool
2. Descomprime el ZIP donde quieras (Documentos, Desktop, etc.)
3. Abre Terminal en esa carpeta y ejecuta:
   ```bash
   bash setup.sh
   ```

El `setup.sh` te dejará todo listo en 3-5 minutos. Solo te pedirá tu API key de ElevenLabs al final.

### 2. Configurar tu estilo de marca (solo la primera vez)

Abre la carpeta del kit en Claude Code. Te hará 6 preguntas rápidas:

- Color principal de tu marca
- Color secundario
- Estilo de edición (minimalista / dinámico / corporativo / educativo)
- Posición habitual del hablante en cámara
- Fondo de las animaciones (transparente / semitransparente / sólido)
- Estilo de motion graphics (suave / enérgico / corporativo)

También te preguntará si tienes logo. Si lo tienes, mételo en `/brand/logo/` antes de responder.

Tu estilo se guarda en `styles/client-style.md` y se aplica a todos los vídeos a partir de ahí.

### 3. Editar un vídeo

```
1. Mete tu vídeo en /input/
2. En Claude Code, escribe: "edita este vídeo"
3. Espera (5-15 minutos según duración)
4. HyperFrames se abre automáticamente — puedes ajustar lo que quieras
5. Cuando estés listo, dile "renderiza"
6. Tu vídeo final está en /output/[nombre]_final.mp4
```

---

## Iterar con Claude — todo en lenguaje natural

Cuando el primer render esté listo, puedes pedir cambios hablando normal:

- *"Añade un título 'Curso completo' en el segundo 5"*
- *"Pon un contador animado hasta 5000 cuando digo 'mis clientes'"*
- *"Cambia el color del beat 3 a rojo"*
- *"Mete subtítulos karaoke"*
- *"Quita el del minuto 1:30"*
- *"Pon mi logo al final"*

Claude entiende y modifica solo lo que pediste, sin re-renderizar todo.

---

## Catálogo de efectos disponibles

El kit incluye **38 efectos profesionales** en `styles/effects-catalog.md`:

| Categoría | Ejemplos |
|---|---|
| **Texto y títulos** | máquina-de-escribir, palabra-a-palabra, karaoke, glitch text, reveal escalonado |
| **Datos y stats** | número grande, contador animado, barra de progreso, círculo de progreso, gráfico de barras |
| **Listas** | bullet list, lista con checks, lista numerada, antes/después, pros/contras, tres pilares |
| **Iconografía** | flecha-apunta, círculo-highlight, badge, check-grande, estrellas-rating |
| **Citas** | quote-card, testimonial, lower-third (estilo TV) |
| **Urgencia** | countdown 3-2-1, timer-oferta, stamp 'URGENTE' |
| **YouTube/Social** | subscribe-button, like-burst, notification-pop |
| **Cinematográficos** | fade, zoom-cinemático, partículas-flotantes, glitch |
| **Branding** | logo-reveal, watermark-sutil |

---

## Estructura del proyecto

```
video-editor-kit/
├── CLAUDE.md              ← Instrucciones para Claude Code (no tocar)
├── README.md              ← Este archivo
├── setup.sh               ← Instalador automático
├── .env.example           ← Plantilla de API keys
│
├── input/                 ← Aquí pones los vídeos raw
├── output/                ← Aquí salen los vídeos editados
├── projects/              ← Histórico de ediciones (Claude aprende de aquí)
│
├── brand/
│   └── logo/              ← Tu logo (si lo tienes)
│
├── styles/                ← Sistema de animación (no tocar a menos que sepas)
│   ├── client-style.md         (se crea con tus preferencias)
│   ├── default-style.md
│   ├── motion-philosophy.md
│   ├── aspect-ratios.md
│   ├── triggers.md
│   ├── video-profiles.md
│   └── effects-catalog.md
│
├── templates/
│   └── capture.js         ← Plantilla de renderizado (no tocar)
│
└── skills/                ← Se instala con setup.sh
    ├── video-use/         ← Transcripción y recorte
    └── hyperframes/       ← Motion graphics y render
```

---

## Preguntas frecuentes

**¿Funciona en Windows?**
No, ahora mismo solo en macOS. El `setup.sh` usa Homebrew. Si hay demanda lo adaptaré a Linux/Windows.

**¿Cuánto cuesta cada vídeo?**
Aproximadamente $0.80 - $5 por vídeo en costes de API (transcripción + tokens), según duración. Detalle en `errores-sesion.md`.

**¿Qué duración máxima de vídeo soporta?**
Probado hasta 60 minutos. Vídeos más largos consumirán más tokens y tiempo, pero técnicamente no hay límite.

**¿Puedo usar mis propias fuentes de marca?**
Sí. Mételas en `brand/fonts/` y referéncialas en `styles/client-style.md`. Por defecto usa Google Fonts (Inter, Space Grotesk, JetBrains Mono).

**¿Puedo vender este servicio a mis clientes?**
Sí, esa es exactamente la idea. Móntales el kit con su estilo de marca y cobra por el setup + mantenimiento mensual. Si quieres aprender el modelo de negocio completo, eso lo cubrimos en La Tribu.

**¿Por qué necesito Claude Pro?**
Porque editar un vídeo de 5 minutos consume entre 100K y 250K tokens. Claude Pro permite contextos largos sin que se rompa la sesión.

**¿Qué hago si algo falla?**
Mira `errores-sesion.md` — documenta todos los errores conocidos y sus soluciones. Si encuentras uno nuevo, escríbelo en el canal del kit en Skool y lo añadimos en la siguiente actualización.

---

## Lo que ya tienes como miembro de La Tribu

- Este kit y **todas sus actualizaciones** mensuales
- **Mentorías directas** conmigo los domingos para resolver dudas en directo
- **Comunidad** de creadores y agencias que están escalando con esto — comparte tus resultados, aprende de los demás
- **Workflows N8N** complementarios para conectar el kit con Drive/WhatsApp y automatizar la entrega a clientes
- **Plantillas de estilo por industria** (coaches, inmobiliaria, infoproductores) en el classroom

Si conoces a alguien que se beneficiaría de esto, mándale el link de **[La Tribu](https://divisualproject.com/la-tribu)** — pero el kit es solo para miembros.

---

## Créditos y licencia

Construido por **Juan Pe Navarro** ([@juanpe.divisual](https://www.youtube.com/@juanpe.divisual)) — CEO de Divisual Project.

El kit usa estos proyectos open source:
- [VideoUse](https://github.com/browser-use/video-use) — transcripción y recorte automático
- [HyperFrames](https://github.com/heygen-com/hyperframes) — motion graphics HTML → MP4
- [FFmpeg](https://ffmpeg.org/) — procesamiento de vídeo
- [GSAP](https://gsap.com/) — animaciones

Licencia MIT. Úsalo como quieras.

Si te ayuda, comparte en redes y mencióname — me encanta ver lo que haces.
