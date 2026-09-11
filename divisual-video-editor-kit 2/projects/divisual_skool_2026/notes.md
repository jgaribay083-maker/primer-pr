# divisual_skool_2026 — 2026-04-29

## Vídeo
- Source: `input/IMG_0564.MOV` — 2160×3840 9:16, 60fps, 62.3s
- Final: `output/IMG_0564_final.mp4` — 2160×3840 9:16, 60fps, 54.6s

## Estilo aplicado
- Acento `#FAC51C` (amarillo dorado), secundario `#0D0D0D` (negro carbón)
- Estilo híbrido dinámico + educativo, motion enérgico, hablante centrado
- Logo: isotipo blanco Divisual

## Decisiones de corte
- Eliminado "Bueno," inicial (0–0.65s)
- Eliminado "eh," tras "subirlo" (20.95–21.60s)
- Eliminado el aside del coche que rompía el cierre (43.74–50.22s) → recupera 6.5s de pacing
- Duración: 62.3s → 54.6s

## Beats generados (8 total)
1. Intro location 0.5–3.5s — logo + "OFICINAS DE SKOOL · LOS ÁNGELES"
2. Stat 3.4–8.4s — "MEJOR COMUNIDAD DEL MUNDO" + 2025+2026 (popIn synced a "segunda" / "consecutiva")
3. Categorías 8.5–14.0s — IA, Marketing, Negocios (slideInUp synced a cada palabra)
4. Tribu Divisual 22.5–26.5s — badge con 🏆 (añadido en iteración del cliente)
5. Valores 35.2–41.7s — Crear sinergias / Crecer juntos / Disfrutar (slideInUp synced)
6. CTA 46.3–50.5s — «tribu» gigante popIn synced a la palabra exacta
7. Cierre 50.6–54.6s — logo + ÚNETE AHORA + tagline
+ Karaoke continuo (27 chunks, 141 palabras destacadas en amarillo)

## Iteración del cliente
- Beat 02 y 06: cards estaban demasiado bajas → subidas a top:80px y reducido tamaño de fuentes
- Beat 04: añadido emoji 🏆 entre logo y "TRIBU DIVISUAL"
- Resto: aprobado a la primera

## Lo que funcionó bien
- El autobús escolar amarillo del segmento C combina perfectamente con el acento `#FAC51C` — coincidencia útil para el cierre
- El popIn con overshoot en los años (back.out(2.4)) sincronizado con "segunda" / "consecutiva" da el "punch" emocional del logro
- El cut del aside del coche permite que el cierre fluya: "...disfrutar de la vida" → CTA directo

## Tiempos de render
- Capture (8 compositions, 5208 frames @4K@60): ~8 min
- ProRes encoding (incluye karaoke 1.1GB): ~3 min
- Compositing final h264_videotoolbox: ~30s
