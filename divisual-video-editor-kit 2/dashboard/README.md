# Divisual Dashboard

Web app local que envuelve el pipeline de edición. Drop-zone para vídeo,
progreso en vivo por SSE, vídeo final con descarga al escritorio.

```
dashboard/
  server.ts           # Bun server (puerto 5191) — /upload, /run, /events/:id, /video/:name
  scripts/
    pipeline.cjs      # Orquestador: emite JSONL a stdout
  public/
    index.html        # UI principal (estados: idle → processing → success | error)
    app.js            # State machine + consumer SSE
    style.css         # Custom CSS sobre Tailwind CDN
```

## Arrancar

```bash
cd dashboard
bun run server.ts
# http://localhost:5191
```

## Pipeline

Cuando entra un vídeo el orquestador ejecuta 7 fases y emite un evento JSONL
por cada cambio de estado. La frontend dibuja la timeline, calcula el
countdown a partir de la velocidad real de captura, y muestra el log en vivo.

| # | Fase       | Lo que hace                             | ~tiempo (60s 4K) |
|---|------------|------------------------------------------|------------------|
| 1 | prepare    | ffprobe, limpia outputs previos          | 1s               |
| 2 | transcribe | ElevenLabs Scribe                        | 5–8s             |
| 3 | cut        | Detecta fillers, corta y concatena       | 30–60s           |
| 4 | plan       | Regenera HTML de karaoke con timestamps  | 1s               |
| 5 | capture    | Render Puppeteer → ProRes 4444 (8 comps) | 6–10 min         |
| 6 | composite  | ffmpeg overlay de los 8 sobre el editado | 1 min            |
| 7 | deliver    | Copia a Desktop, frames de verificación  | 5s               |

## Demo en directo

1. **Antes** del podcast (fuera de cámara): `bash scripts/prepare_demo.sh`
2. **En directo**: el usuario abre Claude Code y escribe `/divisual-create`
3. Claude ejecuta `bash scripts/genesis.sh` — 3-5 min de "creación" creíble
4. El dashboard se abre solo, viene el onboarding de estilo (6 preguntas)
5. El usuario sube el vídeo → el dashboard hace su trabajo
6. **Después**: `bash scripts/restore_demo.sh` deja todo como estaba
