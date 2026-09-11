# Errores cometidos en la sesión — 2026-04-23

## 1. Detección tardía de incompatibilidad de arquitectura (Apple Silicon)
**Error:** Usé `/Users/juanpenv/bin/ffmpeg` y `/Users/juanpenv/bin/ffprobe` (binarios x86 instalados con Homebrew Intel). En Apple Silicon corren bajo Rosetta, pero el ffmpeg x86 no codifica `yuva420p` correctamente.
**Cuándo se detectó:** Tras varias rondas de captura, no al inicio.
**Corrección:** Cambiar explícitamente a `/opt/homebrew/bin/ffmpeg` (ARM nativo).
**Qué debería haber hecho:** Comprobar `uname -m` y verificar el path de ffmpeg en el setup inicial, antes de cualquier operación.

---

## 2. VP9 yuva420p no codifica alpha en este entorno
**Error:** Asumí que `-pix_fmt yuva420p` con libvpx-vp9 produciría un WebM con canal alfa real. Produje `yuv420p` (sin alfa) en todas las iteraciones con VP9.
**Cuándo se detectó:** Tarde, tras múltiples renders fallidos.
**Corrección:** Cambiar a ProRes 4444 (`prores_ks -profile:v 4`) que sí preserva alfa (`yuva444p12le`).
**Qué debería haber hecho:** Probar con un PNG de test antes de iniciar el pipeline completo. Un test de 1 segundo habría revelado el problema en 10 segundos.

---

## 3. `page.setBackgroundColor()` API eliminada en Puppeteer v24
**Error:** Usé una API que ya no existe en la versión instalada, causando excepciones en tiempo de ejecución.
**Corrección:** Inyectar transparencia vía `page.evaluate()` directamente en el DOM.
**Qué debería haber hecho:** Leer el changelog o la API de la versión específica instalada antes de escribir código.

---

## 4. ffprobe sobre PNG individual causaba excepción y abortaba el beat
**Error:** En `capture.js` añadí una verificación con ffprobe sobre el primer frame PNG. ffprobe no puede leer PNGs individuales de esa forma; la excepción abortaba la codificación del beat completo.
**Corrección:** Eliminar la verificación del PNG; solo verificar el archivo de salida final.
**Qué debería haber hecho:** Testear el comando ffprobe sobre un PNG antes de incluirlo en el script.

---

## 5. Screen blend mode causó tinte rosa
**Error:** Intenté usar `blend=all_mode=screen` en FFmpeg con overlays de fondo negro para simular transparencia. El artefacto de compresión en los "negros" del vídeo base causó un tinte rosa/magenta en todo el frame cuando aparecía la animación.
**Cuándo se detectó:** El usuario lo reportó: "ahora aparece rosa toda la imagen."
**Qué debería haber hecho:** No usar screen blend como sustituto de alfa real; es una técnica solo válida si los negros son 100% puros, lo cual no se garantiza con vídeo comprimido.

---

## 6. Chroma key causó fleje verde
**Error:** Intenté fondo verde en los HTMLs + colorkey en FFmpeg. Los elementos CSS con `rgba()` semi-transparentes (bordes, sombras) mezclaban verde con los colores, creando un fleje visible en los bordes de las cards.
**Cuándo se detectó:** El usuario lo reportó: "se ve un fondo verde ahora raro."
**Qué debería haber hecho:** El chroma key no es compatible con elementos semi-transparentes en CSS. Requiere fondos sólidos y sin anti-aliasing en los bordes — no apto para este tipo de animaciones.

---

## 7. HTML con `background: #0d0d0d` en el body — omitBackground no ayuda
**Error:** Los primeros HTMLs tenían el body con fondo oscuro explícito. `omitBackground: true` de Puppeteer solo elimina el fondo blanco predeterminado del navegador, no el `background` CSS propio del documento.
**Cuándo se detectó:** Las animaciones aparecían con fondo negro sólido.
**Qué debería haber hecho:** Siempre setear `body { background: transparent }` explícitamente en los HTMLs destinados a captura con alfa.

---

## 8. Viewport en 1080p para un vídeo 4K
**Error:** La primera versión de `capture.js` usaba `width: 1920, height: 1080`. El vídeo fuente es 3840×2160. Resultado: animaciones en baja resolución compuestas sobre 4K.
**Cuándo se detectó:** El usuario lo reportó: "sigue estando en 1080 cuando el vídeo es en 4K."
**Qué debería haber hecho:** Detectar la resolución del vídeo base con ffprobe antes de generar los HTMLs y configurar el viewport. El script de captura debería inferir W y H del vídeo de entrada, no tenerlos hardcodeados.

---

## 9. `-c copy` en el corte de segmentos produjo audio silencioso
**Error:** Al cortar los clips con `ffmpeg -ss X -to Y -c copy`, los paquetes AAC quedaron desincronizados. El resultado fue 26 segundos de silencio total en el vídeo editado (desde ~30s hasta el final).
**Cuándo se detectó:** El usuario lo reportó: "min 00:30 le cortas el audio wtf."
**Corrección:** Re-cortar los segmentos con `-c:a aac` (re-codificar el audio aunque se copie el vídeo).
**Qué debería haber hecho:** Verificar el audio de cada clip inmediatamente después de cortarlo con `silencedetect` antes de continuar. Un paso de validación habría detectado 26s de silencio en menos de 2 segundos.

---

## 10. No verificar clips individuales antes de concatenar
**Error:** Concatené los segmentos sin verificar que cada uno tuviera audio correcto. Si hubiera ejecutado `silencedetect` en cada clip antes del concat, habría detectado el problema en el paso 9 inmediatamente.
**Qué debería haber hecho:** Pipeline de validación obligatorio: cortar → verificar audio → concatenar.

---

## 11. Abrir el CRM Divisual en lugar de HyperFrames
**Error:** Al intentar abrir HyperFrames Studio, el servidor de Next.js del CRM ya estaba escuchando en el puerto 3000. Abrí esa app en el navegador sin verificar qué proceso ocupaba el puerto.
**Cuándo se detectó:** El usuario lo reportó: "me has abierto un CRM Divisual, no el hyperframes."
**Qué debería haber hecho:** Antes de `open http://localhost:PORT`, verificar con `lsof -i :PORT` qué proceso está corriendo.

---

## 12. HyperFrames con carga infinita — dependencia hono en Vite SSR
**Error:** El plugin `devProjectApi` de Vite llamaba `server.ssrLoadModule("@hyperframes/core/studio-api")` que internamente importa `hono`, que no puede resolverse en contexto SSR de Vite. Resultado: carga infinita en el navegador.
**Cuándo se detectó:** El usuario lo reportó: "no se abrió, carga infinita."
**Corrección:** Añadir `ssr: { external: ["hono"] }` en `vite.config.ts`.
**Qué debería haber hecho:** Probar que el servidor carga correctamente antes de decirle al usuario que lo abra.

---

## 13. Múltiples renders sin verificar el resultado intermedio
**Error:** Hice varias rondas de captura + composite sin verificar con ffprobe que los archivos intermedios (.webm, .mov) tuvieran el pixel format correcto antes de usarlos. Resultado: composites con alfa incorrecto que el usuario tuvo que reportar.
**Qué debería haber hecho:** Después de cada captura, verificar automáticamente el pix_fmt antes de pasar al composite.

---

## 14. Diseño de animaciones mediocre sin consultar preferencias
**Error:** Generé 10 beats con cards de texto básicas (fondo oscuro + texto) sin preguntar qué estilo visual quería el usuario. Fue necesaria una iteración completa fallida para llegar a la pregunta obvia.
**Cuándo se detectó:** El usuario lo reportó: "las animaciones son bastante mediocres."
**Qué debería haber hecho:** Durante la Fase 3 (planificación), presentar opciones visuales con descripciones antes de generar. El CLAUDE.md tiene el onboarding de estilo pero no incluye preferencias de estilo de motion graphics.

---

## 15. Fondo de cards negro sin advertir al usuario
**Error:** Diseñé todas las cards con `background: #0d0d0d` (negro casi puro) sin informar al usuario durante el setup que las animaciones tendrían un fondo de este color. El usuario lo descubrió al ver el resultado.
**Cuándo se detectó:** El usuario lo reportó: "las tarjetas de las animaciones siguen teniendo un fondo negro."
**Qué debería haber hecho:** El onboarding de estilo debería incluir una pregunta sobre el fondo de las animaciones (transparente / semi-transparente / color sólido).

---

## 16. Afirmar que el vídeo estaba listo sin haberlo abierto y comprobado
**Error:** En varios momentos declaré "listo" o "abierto" sin haber verificado que el vídeo se reproducía correctamente (audio, resolución, overlays visibles). El usuario era quien descubría los problemas al abrirlo.
**Qué debería haber hecho:** Extraer y verificar frames clave del vídeo final con ffprobe/PIL antes de reportar como completado. Ejecutar `silencedetect` en el output siempre.

---

---

# Sesión 2 — 2026-04-29

## 17. iPhone .MOV con `-ss` después de `-i` corrompe el audio
**Error:** Al cortar segmentos del Reel del iPhone con `ffmpeg -i input.MOV -ss X -to Y`, el segundo segmento perdió el audio a partir de los 10.86 segundos. silencedetect detectó 13.46s de silencio justo en mitad del corte.
**Cuándo se detectó:** El usuario lo reportó: "00:23 se corta el audio."
**Corrección:** Mover `-ss` ANTES de `-i` (`ffmpeg -ss X -to Y -i input.MOV`). El seek a nivel de input es más fiable con .MOV de iPhone que tienen múltiples streams de audio (AAC estéreo + spatial audio de 4 canales).
**Qué debería haber hecho:** Validar el audio de cada segmento con silencedetect inmediatamente después de cortarlo, antes de concatenar. Es la regla #4 de Fase 2 del CLAUDE.md y no la apliqué.

---

## 18. FFmpeg de Homebrew no incluye libass — sin filtro `subtitles` ni `ass`
**Error:** Intenté quemar subtítulos con el filtro `subtitles=archivo.srt` de FFmpeg. Falló con "No such filter: 'ass'" / "No option name". El binario de Homebrew (`/opt/homebrew/bin/ffmpeg`) viene compilado sin libass ni libfreetype para subtítulos.
**Cuándo se detectó:** Al intentar quemar el SRT durante la fase de compositing.
**Corrección:** Renderizar los subtítulos como un overlay HTML capturado a 60fps con Puppeteer (igual que cualquier otro beat). El HTML usa CSS para el estilo (font-weight 900, white text, text-stroke negro, text-shadow para profundidad) y GSAP para mostrar/ocultar cada chunk en su timestamp. El resultado .mov ProRes 4444 con alfa se composita con FFmpeg como cualquier otro overlay.
**Qué debería haber hecho:** Verificar `ffmpeg -filters | grep -E "subtitles|ass"` durante la Fase 0 del setup. El test de ProRes 4444 ya está, pero falta el de subtítulos.
**Patrón reutilizable:** Para cualquier elemento de texto sincronizado (subtítulos, lower thirds, watermarks dinámicos), tratar como overlay HTML — da control total del estilo sin depender de filtros específicos de FFmpeg.

---

## 19. En 9:16 los subtítulos y las cards inferiores se solapan
**Error:** Subtítulos posicionados a `bottom: 18%` y cards de stat/CTA a `bottom: 11-13%`. Las cards extienden hacia arriba según su altura, llegando a la zona de los subtítulos. Resultado: texto encima de texto, ilegible.
**Cuándo se detectó:** El usuario lo reportó: "las animaciones se pisan con los subtítulos."
**Corrección:** Separar verticalmente las dos zonas:
- Subtítulos: `bottom: 32%` (subir muy arriba, encima del cuerpo del hablante)
- Cards inferiores: `bottom: 3-4%` (bajar al borde inferior)
- Gap mínimo entre zonas: ~25% del alto del frame
**Qué debería haber hecho:** El `aspect-ratios.md` define la zona de cards (bottom 20%) pero no especifica DÓNDE dentro de esa zona va cada elemento. Hay que añadir reglas concretas: subtítulos en la mitad superior de la zona de cards (~25-35% from bottom), cards de info en la mitad inferior (~2-8% from bottom).

---

## Resumen de causas raíz

| Causa | Errores relacionados |
|---|---|
| No testear antes de usar en pipeline completo | 2, 3, 4, 11, 12, 18 |
| No validar outputs intermedios | 1, 9, 10, 13, 16, 17 |
| Asumir compatibilidad de entorno sin verificar | 1, 2, 7, 8, 18 |
| Diseño sin consultar preferencias del usuario | 14, 15, 19 |
| Elegir técnica equivocada para el problema | 5, 6 |
| Reglas de composición no suficientemente específicas | 19 |
