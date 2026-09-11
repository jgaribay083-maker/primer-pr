#!/usr/bin/env node
// Template de captura — copia esto a output/compositions/[nombre]/capture.js
// y parametriza BEATS con los beats del vídeo.
//
// USO: node capture.js
// REQUIERE: VIDEO_W, VIDEO_H como env vars (o edita los defaults abajo)

const puppeteer = require('../../skills/hyperframes/node_modules/.bun/puppeteer-core@24.40.0/node_modules/puppeteer-core');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ── Configuración ─────────────────────────────────────────────────────────────
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FFMPEG  = process.env.FFMPEG_BIN  || '/opt/homebrew/bin/ffmpeg';
const FFPROBE = process.env.FFPROBE_BIN || '/opt/homebrew/bin/ffprobe';

// FPS: lee del entorno (debe coincidir con el FPS del vídeo source para evitar stutter)
const FPS = parseInt(process.env.VIDEO_FPS || '30', 10);

// Resolución: lee del entorno o usa 1920x1080 como fallback
const W = parseInt(process.env.VIDEO_W || '1920', 10);
const H = parseInt(process.env.VIDEO_H || '1080', 10);

const COMP_DIR = __dirname;
const OUT_DIR  = path.join(COMP_DIR, 'renders');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Lista de beats ─────────────────────────────────────────────────────────────
// Claude rellena esto según el vídeo. Formato: { file, duration (segundos) }
const BEATS = [
  // { file: 'beat_01_intro.html', duration: 5.2 },
  // { file: 'beat_02_dato.html',  duration: 4.0 },
];

// ── Captura ───────────────────────────────────────────────────────────────────
async function captureBeat(browser, beat) {
  const name     = beat.file.replace('.html', '');
  const framesDir = path.join(os.tmpdir(), `hf_${name}_${Date.now()}`);
  fs.mkdirSync(framesDir, { recursive: true });

  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

  const filePath = path.join(COMP_DIR, beat.file);
  await page.goto(`file://${filePath}`, { waitUntil: 'networkidle0', timeout: 30000 });

  // Forzar fondo transparente — nunca confiar en que el HTML lo haga solo
  await page.evaluate(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    if (window.gsap) window.gsap.globalTimeline.pause(0);
  });

  const totalFrames = Math.ceil(beat.duration * FPS);
  process.stdout.write(`  ${name} (${W}×${H}): `);

  for (let f = 0; f < totalFrames; f++) {
    const t = f / FPS;
    await page.evaluate((time) => {
      if (window.gsap) window.gsap.globalTimeline.seek(time, false);
    }, t);

    const framePath = path.join(framesDir, `f${String(f).padStart(5, '0')}.png`);
    await page.screenshot({ path: framePath, type: 'png', omitBackground: true });
    if (f % 30 === 0) process.stdout.write('.');
  }

  await page.close();
  console.log(` ${totalFrames} frames`);

  // Codificar a ProRes 4444 con alfa real — nunca VP9/WebM
  const outPath = path.join(OUT_DIR, `${name}.mov`);
  execSync(
    `"${FFMPEG}" -y -framerate ${FPS} -i "${framesDir}/f%05d.png" ` +
    `-c:v prores_ks -profile:v 4 -pix_fmt yuva444p10le -an "${outPath}"`,
    { stdio: 'inherit' }
  );

  fs.rmSync(framesDir, { recursive: true, force: true });

  // Verificar alfa — si no es yuva444p, el compositing fallará
  const pix = execSync(
    `"${FFPROBE}" -v quiet -select_streams v:0 -show_entries stream=pix_fmt -of csv=p=0 "${outPath}"`
  ).toString().trim();
  console.log(`  → ${path.basename(outPath)} [${pix}]`);

  if (!pix.startsWith('yuva')) {
    throw new Error(`Alfa incorrecto en ${name}: ${pix}. Verifica que ffmpeg es ARM nativo.`);
  }

  return outPath;
}

(async () => {
  if (BEATS.length === 0) {
    console.error('ERROR: La lista BEATS está vacía. Claude debe rellenarla antes de ejecutar.');
    process.exit(1);
  }

  console.log(`Capturando ${BEATS.length} beats a ${W}×${H} con ProRes 4444...`);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
           `--window-size=${W},${H}`],
  });

  let ok = 0;
  for (const beat of BEATS) {
    try {
      await captureBeat(browser, beat);
      ok++;
    } catch (err) {
      console.error(`  ERROR en ${beat.file}:`, err.message);
    }
  }

  await browser.close();
  console.log(`\nDone: ${ok}/${BEATS.length} beats renderizados en ${OUT_DIR}`);
})();
