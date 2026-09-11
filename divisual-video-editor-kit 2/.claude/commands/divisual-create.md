---
description: Genesis del Divisual Video Editor Kit (modo demo para podcast)
---

# /divisual-create — montar el editor de vídeos en directo

Este comando coreografía la "creación" del kit completo de edición de vídeos en
~3 minutos para una grabación en directo. Combina trabajo real (git clone,
bun install, escritura de archivos) con restauración del estado pre-preparado
(`scripts/prepare_demo.sh` debe haber corrido antes).

## Flujo

1. **Anuncia el plan con TodoWrite**: 8 items
   - Detectando entorno (ARM, ffmpeg, bun, node)
   - Creando estructura de directorios
   - Instalando skills: video-use + hyperframes
   - Configurando estilos por defecto y aspect ratios
   - Generando dashboard (Bun + Hono + UI)
   - Verificando ProRes 4444 con alfa
   - Arrancando dashboard en localhost:5191
   - Listo para onboarding de estilo

2. **Ejecuta** `bash scripts/genesis.sh` y deja que su output se vea en terminal
   (3-5 min según red). El script ya emite mensajes con colores y delays
   pequeños para que se vea natural. NO interrumpas su ejecución.

3. **Cuando termine** (sale exit 0 y abre el dashboard solo), marca todos los
   TodoWrite como done. Anuncia: "Kit montado. Para que se adapte a tu marca,
   te hago 6 preguntas rápidas — luego subes el vídeo en el dashboard."

4. **Onboarding** — sigue al pie de la letra la sección "ONBOARDING DE ESTILO"
   de CLAUDE.md (las 6 preguntas, una a una). Si ya existe `styles/client-style.md`
   (señal de que prepare_demo.sh preservó el estilo del cliente), salta el
   onboarding y di: "Tu estilo ya está configurado. Sube el vídeo en el
   dashboard cuando estés listo."

5. **Tras onboarding** o si ya estaba el estilo: di "Dashboard abierto en
   localhost:5191. Suelta el vídeo allí y déjate llevar."

## Notas

- Si NO existe `.demo_backup/`, este comando no debe ejecutarse — el genesis
  fallaría. Avísale al usuario que corra `bash scripts/prepare_demo.sh`
  primero (idealmente lo hace fuera de cámara).
- Tras el podcast: `bash scripts/restore_demo.sh` recupera el estado normal.
- El dashboard abre en QuickTime/navegador automáticamente; no hace falta
  invocar `open` manualmente.
