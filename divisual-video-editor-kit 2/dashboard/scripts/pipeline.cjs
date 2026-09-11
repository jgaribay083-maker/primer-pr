#!/usr/bin/env node
// pipeline.cjs — orquesta el pipeline completo de edición y emite eventos JSONL.
// Cada línea de stdout es un evento JSON que el server reenvía por SSE.
//
// Uso: node pipeline.cjs <video_path> [--project-name <name>]

const PROJECT_ROOT = '/Users/juanpenv/Desktop/divisual-video-editor-kit 2';
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const FFPROBE = '/opt/homebrew/bin/ffprobe';

// ── Argumentos ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const videoPath = args[0];
const projectIdx = args.indexOf('--project-name');
const PROJECT_NAME = projectIdx >= 0 ? args[projectIdx + 1] : 'divisual_skool_2026';

if (!videoPath || !fs.existsSync(videoPath)) {
  console.error(JSON.stringify({ phase: 'error', msg: `Video no encontrado: ${videoPath}` }));
  process.exit(1);
}

const videoStem = path.basename(videoPath).replace(/\.(mp4|mov|MOV|MP4)$/, '');
const TOTAL_PHASES = 7;

// ── Emisor de eventos ─────────────────────────────────────────────────────────
const startTimes = {};
function emit(event) {
  console.log(JSON.stringify({ ...event, t: Date.now() }));
}
function phaseStart(phase, label, opts = {}) {
  startTimes[phase] = Date.now();
  emit({ phase, status: 'start', label, ...opts });
}
function phaseProgress(phase, percent, extra = {}) {
  emit({ phase, status: 'progress', percent: Math.round(percent * 100) / 100, ...extra });
}
function phaseDone(phase, extra = {}) {
  const duration_s = ((Date.now() - (startTimes[phase] || Date.now())) / 1000).toFixed(1);
  emit({ phase, status: 'complete', duration_s: Number(duration_s), ...extra });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function probeVideo(p) {
  // Probe video stream + format + side data (rotation) en una sola llamada JSON
  const json = execSync(`"${FFPROBE}" -v error -print_format json -show_format -show_streams "${p}"`).toString();
  const data = JSON.parse(json);
  const vStream = data.streams.find(s => s.codec_type === 'video');
  const aStream = data.streams.find(s => s.codec_type === 'audio');
  if (!vStream) throw new Error('Vídeo sin stream de vídeo');

  let w = parseInt(vStream.width);
  let h = parseInt(vStream.height);

  // Detectar rotación (iPhone, móvil): metadata o side_data_list
  let rotation = 0;
  if (vStream.side_data_list) {
    for (const sd of vStream.side_data_list) {
      if (sd.side_data_type === 'Display Matrix' && sd.rotation != null) {
        rotation = sd.rotation;
      }
    }
  }
  if (vStream.tags?.rotate) rotation = parseInt(vStream.tags.rotate);
  // Si la rotación es ±90 o ±270, swap w/h para reflejar orientación final
  if (Math.abs(rotation) === 90 || Math.abs(rotation) === 270) {
    [w, h] = [h, w];
  }

  // FPS: r_frame_rate puede ser "60/1" o "30000/1001"
  const fpsStr = vStream.r_frame_rate || vStream.avg_frame_rate || '30/1';
  const [num, den] = fpsStr.split('/').map(Number);
  const fps = Math.round(num / (den || 1));

  const dur = parseFloat(data.format?.duration || vStream.duration || '0');

  return {
    w, h, fps,
    duration: dur,
    rotation,
    has_audio: !!aStream,
    audio_codec: aStream?.codec_name || null,
    video_codec: vStream.codec_name,
    pix_fmt: vStream.pix_fmt,
  };
}

function aspectFor(w, h) {
  const r = w / h;
  if (r >= 1.7) return '16:9';
  if (r >= 1.2) return '4:3';
  if (r >= 0.9) return '1:1';
  return '9:16';
}

// ── Fases del pipeline ────────────────────────────────────────────────────────

async function phase1_prepare() {
  phaseStart('prepare', 'Analizando vídeo y preparando entorno', { phase_idx: 1, total: TOTAL_PHASES });
  const meta = probeVideo(videoPath);
  meta.aspect = aspectFor(meta.w, meta.h);
  emit({ phase: 'prepare', status: 'progress', percent: 100, video: meta });
  // Limpiar outputs previos del mismo stem
  const cleanGlobs = [
    `output/${videoStem}_transcript.json`,
    `output/${videoStem}_transcript_clean.json`,
    `output/${videoStem}_edited.mp4`,
    `output/${videoStem}_final.mp4`,
    `output/segments`,
    `output/edit/transcripts/${videoStem}.json`,
  ];
  for (const g of cleanGlobs) {
    const fullP = path.join(PROJECT_ROOT, g);
    try { fs.rmSync(fullP, { recursive: true, force: true }); } catch {}
  }
  // También limpiar renders previos
  const rendersDir = path.join(PROJECT_ROOT, 'output/compositions', PROJECT_NAME, 'renders');
  if (fs.existsSync(rendersDir)) fs.rmSync(rendersDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(PROJECT_ROOT, 'output'), { recursive: true });
  fs.mkdirSync(path.join(PROJECT_ROOT, 'output/edit'), { recursive: true });
  fs.mkdirSync(path.join(PROJECT_ROOT, 'output/segments'), { recursive: true });
  phaseDone('prepare', { meta });
  return meta;
}

async function phase2_transcribe() {
  phaseStart('transcribe', 'Transcribiendo con ElevenLabs Scribe', { phase_idx: 2, total: TOTAL_PHASES });
  // Cargar API key
  const envPath = path.join(PROJECT_ROOT, '.env');
  const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const m = envContent.match(/^ELEVENLABS_API_KEY=(.+)$/m);
  if (!m) throw new Error('ELEVENLABS_API_KEY no configurada en .env');
  const apiKey = m[1].trim();
  // Ejecutar transcribe.py (cached)
  await new Promise((resolve, reject) => {
    const proc = spawn('python3', [
      path.join(PROJECT_ROOT, 'skills/video-use/helpers/transcribe.py'),
      videoPath,
      '--edit-dir', path.join(PROJECT_ROOT, 'output/edit'),
    ], {
      env: { ...process.env, ELEVENLABS_API_KEY: apiKey, PATH: `/opt/homebrew/bin:${process.env.PATH}` },
    });
    proc.stdout.on('data', d => {
      const s = d.toString();
      if (s.includes('extracting')) phaseProgress('transcribe', 15, { stage: 'audio_extract' });
      if (s.includes('uploading')) phaseProgress('transcribe', 40, { stage: 'upload' });
      if (s.includes('saved')) phaseProgress('transcribe', 95, { stage: 'received' });
    });
    proc.stderr.on('data', () => {});
    proc.on('exit', code => code === 0 ? resolve() : reject(new Error(`transcribe exited ${code}`)));
  });
  // Copiar transcript a la ubicación esperada
  const src = path.join(PROJECT_ROOT, 'output/edit/transcripts', videoStem + '.json');
  const dst = path.join(PROJECT_ROOT, 'output', videoStem + '_transcript.json');
  fs.copyFileSync(src, dst);
  const transcript = JSON.parse(fs.readFileSync(dst, 'utf8'));
  const wordCount = transcript.words.filter(w => w.type === 'word').length;
  // Validación: transcript no puede estar vacío
  if (!transcript.audio_duration_secs || transcript.audio_duration_secs < 0.5) {
    throw new Error(`Transcript inválido: duración ${transcript.audio_duration_secs}s`);
  }
  if (wordCount === 0) {
    throw new Error('Transcript sin palabras (audio vacío o no detectado)');
  }
  phaseDone('transcribe', { word_count: wordCount, duration: transcript.audio_duration_secs, language: transcript.language_code });
}

async function phase3_cut(meta) {
  phaseStart('cut', 'Detectando fillers y cortando segmentos', { phase_idx: 3, total: TOTAL_PHASES });
  // Cargar transcript existente o el reciente
  const tPath = path.join(PROJECT_ROOT, 'output', videoStem + '_transcript.json');
  const t = JSON.parse(fs.readFileSync(tPath, 'utf8'));
  const words = t.words.filter(w => w.type === 'word');

  // Detectar fillers (lista exhaustiva), start-fillers, silencios largos.
  const segments = [];
  let curStart = 0.05;
  let lastEnd = 0;

  function flushSegment(endT) {
    if (endT > curStart + 0.4) {
      segments.push({ start: curStart, end: endT });
    }
  }

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const txt = w.text.toLowerCase().replace(/[,.!?¡¿]/g, '').trim();
    const isFiller = CUT_FILLERS.includes(txt);
    const isStartFiller = i === 0 && START_FILLERS.includes(txt);

    // Detectar silencio largo ANTES de esta palabra (gap > 0.5s)
    // Recorte agresivo para mantener ritmo en formato corto.
    const gapBefore = i > 0 ? w.start - words[i - 1].end : 0;
    const longSilenceBefore = gapBefore > 0.5;

    if (isFiller || isStartFiller) {
      flushSegment(lastEnd + 0.05);
      // Empieza justo al final del filler (sin tragar la siguiente palabra)
      curStart = w.end + 0.02;
    } else if (longSilenceBefore && i > 0) {
      // Cortar el silencio: termina segmento anterior con la palabra previa,
      // empieza nuevo justo antes de la palabra actual
      flushSegment(words[i - 1].end + 0.08);
      curStart = Math.max(w.start - 0.08, words[i - 1].end + 0.05);
    }
    lastEnd = w.end;
  }
  flushSegment(t.audio_duration_secs - 0.05);

  // Si por alguna razón quedan 0 segments, fallback al vídeo entero
  if (segments.length === 0) {
    segments.push({ start: 0.05, end: t.audio_duration_secs - 0.05 });
    emit({ phase: 'cut', status: 'progress', percent: 25, label: 'sin fillers detectados, mantengo vídeo entero' });
  }

  emit({ phase: 'cut', status: 'progress', percent: 20, segments_count: segments.length, label: `Plan: ${segments.length} segmentos` });

  // Cortar cada segmento
  const segDir = path.join(PROJECT_ROOT, 'output/segments');
  fs.mkdirSync(segDir, { recursive: true });
  let outOffset = 0;
  const edl = [];
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const dur = s.end - s.start;
    const fadeOut = (dur - 0.03).toFixed(3);
    const segPath = path.join(segDir, `seg_${String(i).padStart(2, '0')}.mp4`);
    await new Promise((resolve, reject) => {
      const proc = spawn(FFMPEG, [
        '-ss', String(s.start), '-to', String(s.end),
        '-i', videoPath,
        '-c:v', 'h264_videotoolbox', '-b:v', '30M', '-tag:v', 'avc1',
        '-c:a', 'aac', '-b:a', '192k', '-ac', '2',
        '-af', `afade=t=in:st=0:d=0.03,afade=t=out:st=${fadeOut}:d=0.03`,
        '-movflags', '+faststart',
        segPath, '-y',
      ]);
      proc.on('exit', code => code === 0 ? resolve() : reject(new Error('ffmpeg cut failed')));
    });
    edl.push({ id: String.fromCharCode(65 + i), src_start: s.start, src_end: s.end, out_start: outOffset, out_end: outOffset + dur });
    outOffset += dur;
    phaseProgress('cut', 20 + ((i + 1) / segments.length) * 60, { current: `seg ${i + 1}/${segments.length}` });
  }

  // Concat
  phaseProgress('cut', 85, { stage: 'concat' });
  const concatList = path.join(segDir, 'concat.txt');
  fs.writeFileSync(concatList, segments.map((_, i) => `file 'seg_${String(i).padStart(2, '0')}.mp4'`).join('\n'));
  const editedPath = path.join(PROJECT_ROOT, 'output', videoStem + '_edited.mp4');
  await new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG, ['-f', 'concat', '-safe', '0', '-i', concatList, '-c', 'copy', editedPath, '-y']);
    proc.on('exit', code => code === 0 ? resolve() : reject(new Error('concat failed')));
  });

  // Build clean transcript with output timestamps
  const mapTime = (srcT) => {
    for (const r of edl) {
      if (r.src_start <= srcT && srcT < r.src_end) return srcT - r.src_start + r.out_start;
    }
    return null;
  };
  const cleanWords = [];
  for (const w of t.words) {
    const ns = mapTime(w.start);
    const ne = mapTime(w.end);
    if (ns === null || ne === null) continue;
    cleanWords.push({ ...w, start: Math.round(ns * 1000) / 1000, end: Math.round(ne * 1000) / 1000 });
  }
  const editedDuration = outOffset;
  const clean = {
    language_code: t.language_code,
    audio_duration_secs: editedDuration,
    text: cleanWords.map(w => w.text).join(''),
    words: cleanWords,
    edl: { segments: edl },
  };
  fs.writeFileSync(path.join(PROJECT_ROOT, 'output', videoStem + '_transcript_clean.json'), JSON.stringify(clean, null, 2));

  // Validación final
  if (!fs.existsSync(editedPath)) throw new Error('cut: edited.mp4 no se generó');
  if (editedDuration < 0.5) throw new Error(`cut: duración demasiado corta (${editedDuration.toFixed(2)}s)`);
  if (cleanWords.length === 0) throw new Error('cut: sin palabras tras corte');
  phaseDone('cut', { segments_kept: segments.length, edited_duration_s: Number(editedDuration.toFixed(2)), words_kept: cleanWords.length });
  return { editedPath, clean };
}

// ── Phase 4 helpers ──────────────────────────────────────────────────────────

const DESIGN_W = 1080, DESIGN_H = 1920, DESIGN_FPS = 30;

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// ── Librería de iconos SVG inline (Material/Heroicons style) ──────────────
// Cada entrada: viewBox 0 0 24 24, paths con fill currentColor para herencia CSS.
// La IA puede pedir uno por su id en flash.icon o highlight.icon.
const ICONS = {
  trophy:    '<path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>',
  medal:     '<path d="M12 14a5 5 0 100-10 5 5 0 000 10zm0-2a3 3 0 110-6 3 3 0 010 6zm-4 4l-2 6 4-2 4 2-2-6h-4z"/>',
  heart:     '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>',
  fire:      '<path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/>',
  target:    '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18a8 8 0 110-16 8 8 0 010 16zm0-13a5 5 0 100 10 5 5 0 000-10zm0 8a3 3 0 110-6 3 3 0 010 6z"/>',
  star:      '<path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>',
  rocket:    '<path d="M9.19 6.35c-2.04 2.29-3.44 5.58-3.57 5.89L2 10.69l4.05-4.05c.47-.47 1.15-.68 1.81-.55l1.33.26zM11.17 17s3.74-1.55 5.89-3.7c5.4-5.4 4.5-9.62 4.21-10.57-.95-.3-5.17-1.19-10.57 4.21C8.55 9.09 7 12.83 7 12.83L11.17 17zm6.48-2.19c-2.29 2.04-5.58 3.44-5.89 3.57L13.31 22l4.05-4.05c.47-.47.68-1.15.55-1.81l-.26-1.33zM9 18c0 .83-.34 1.58-.88 2.12C6.94 21.3 2 22 2 22s.7-4.94 1.88-6.12C4.42 15.34 5.17 15 6 15a3 3 0 013 3zm6.5-9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>',
  lightbulb: '<path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C7.86 2 4.5 5.36 4.5 9.5c0 2.55 1.27 4.78 3.21 6.13.39.27.79.27 1.04 0L8.75 18h6.5l-.5-2.37c.25-.27.65-.27 1.04 0a7.5 7.5 0 00-3.79-13.63z"/>',
  chart:     '<path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/>',
  gift:      '<path d="M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 00-5.5-1.65l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4a2 2 0 00-2 2v11a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z"/>',
  money:     '<path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1H6.3c.13 2.19 1.77 3.42 3.7 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>',
  check:     '<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>',
  alert:     '<path d="M12 2L1 21h22L12 2zm0 4.5L19.5 19h-15L12 6.5zm-1 5.5h2v3h-2v-3zm0 4h2v2h-2v-2z"/>',
  handshake: '<path d="M12 12h.01M9 11l.01 0M15 11l.01 0M16.5 4.5L19 7v4l-3 1-3-2-1 1 2 3v3l-3 1H7l-3-1v-3l2-3-1-1-3 2-3-1V7l2.5-2.5L7 5l3-1 2 1 2-1 2.5.5z"/>',
  zap:       '<path d="M7 2v11h3v9l7-12h-4l4-8z"/>',
  eye:       '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8a3 3 0 100 6 3 3 0 000-6z"/>',
  clock:     '<path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm.01 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>',
  bolt:      '<path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z"/>',
  speech:    '<path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>',
  flag:      '<path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6z"/>',
  thumbsup:  '<path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-1z"/>',
};

function iconSvg(id, fillColor) {
  const path = ICONS[id];
  if (!path) return '';
  const fill = fillColor || '#0D0D0D';
  // Reemplazar fill="currentColor" si lo hubiera; en nuestros paths no usamos currentColor
  // pero permitimos override de color via parent style.
  return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="fill: ${fill};">${path.replace(/fill="[^"]*"/g, `fill="${fill}"`).replace(/<path /g, `<path fill="${fill}" `)}</svg>`;
}

function renderTemplate(name, vars) {
  const tpath = path.join(PROJECT_ROOT, 'output/compositions', PROJECT_NAME, 'templates', name);
  let html = fs.readFileSync(tpath, 'utf8');
  for (const [k, v] of Object.entries(vars)) {
    html = html.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
  }
  // Replace any remaining {{VARS}} with empty (avoids broken html)
  html = html.replace(/\{\{[A-Z_]+\}\}/g, '');
  return html;
}

function emphasizeWord(text, emphasis) {
  if (!emphasis) return escHtml(text);
  const safeText = escHtml(text);
  const safeEm = escHtml(emphasis);
  // Match con word boundaries para evitar coger "ia" dentro de "Inteligencia"
  const reEsc = safeEm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|\\s|[¡¿«"'(])(${reEsc})(\\s|$|[.,;:!?»"')]+)`, 'i');
  const m = safeText.match(re);
  if (m) {
    return safeText.slice(0, m.index) +
      m[1] + `<span class="em">${m[2]}</span>` + m[3] +
      safeText.slice(m.index + m[0].length);
  }
  // Fallback: si no hay match con boundary, no envolver (mejor que emfatizar mal)
  return safeText;
}

function buildBeatHtml(beat, projectName) {
  const dur = beat.duration;
  const fadeOutAt = (dur - 0.40).toFixed(2);
  const c = beat.content || {};
  switch (beat.type) {
    case 'intro': {
      return renderTemplate('template_intro.html', {
        TITLE: escHtml(c.title || '').toUpperCase(),
        FADE_OUT_AT: fadeOutAt,
      });
    }
    case 'highlight': {
      // Solo la palabra/frase de énfasis (1-3 palabras max). Sin frase larga.
      const word = (c.emphasis || c.text || '').toUpperCase().split(/\s+/).filter(Boolean).slice(0, 3).join(' ');
      if (!word || word.trim().length < 2) return null; // skip si vacío
      const labelClean = c.pre && c.pre.length < 30 ? escHtml(c.pre).toUpperCase() : '';
      return renderTemplate('template_highlight.html', {
        WORD: escHtml(word),
        LABEL_HTML: labelClean ? `<div class="label">${labelClean}</div>` : '',
        FADE_OUT_AT: fadeOutAt,
      });
    }
    case 'list': {
      const items = (c.items || []).slice(0, 4);
      // Cada item: una row con node numerado + flecha → + texto.
      // Entre items: una arrow-down vertical que se "dibuja" (scaleY 0→1)
      const parts = [];
      items.forEach((it, i) => {
        parts.push(`<div class="row" id="row${i+1}">
          <div class="node">${i+1}</div>
          <svg class="arrow-h" id="ah${i+1}" viewBox="0 0 24 18" xmlns="http://www.w3.org/2000/svg"><path d="M2 9 L20 9 M14 3 L20 9 L14 15"/></svg>
          <div class="text">${emphasizeWord(it.text, it.emphasis)}</div>
        </div>`);
        if (i < items.length - 1) {
          parts.push(`<div class="arrow-down" id="ad${i+1}"></div>`);
        }
      });
      const itemsHtml = parts.join('\n        ');

      // Animación: cada row entra cuando el speaker dice el item (anchor_t).
      // Entre rows: arrow-down se dibuja (scaleY 0 → 1)
      const lines = [];
      const beatStart = beat.start_in_output;
      items.forEach((it, i) => {
        // Calcular reveal time relativo al inicio del beat
        let t;
        if (typeof it.anchor_t === 'number') {
          t = Math.max(0.10, it.anchor_t - beatStart - 0.10); // 100ms antes de la palabra
        } else {
          t = 0.25 + i * 0.45; // fallback al stagger
        }
        const tStr = t.toFixed(2);
        lines.push(`tl.fromTo('#row${i+1}', { opacity: 0, x: -50 }, { opacity: 1, x: 0, duration: 0.35, ease: 'back.out(2.0)' }, ${tStr});`);
        lines.push(`tl.fromTo('#row${i+1} .node', { scale: 0, rotate: -90 }, { scale: 1, rotate: 0, duration: 0.40, ease: 'back.out(2.6)' }, ${(t + 0.05).toFixed(2)});`);
        lines.push(`tl.fromTo('#ah${i+1}', { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.25, ease: 'power2.out' }, ${(t + 0.20).toFixed(2)});`);
        if (i < items.length - 1) {
          lines.push(`tl.fromTo('#ad${i+1}', { scaleY: 0 }, { scaleY: 1, duration: 0.30, ease: 'power2.out' }, ${(t + 0.30).toFixed(2)});`);
        }
        // Pulse continuo del node tras entrar
        lines.push(`tl.to('#row${i+1} .node', { scale: 1.08, duration: 0.7, ease: 'sine.inOut', yoyo: true, repeat: -1 }, ${(t + 0.5).toFixed(2)});`);
      });
      const itemsJs = lines.join('\n  ');

      return renderTemplate('template_list.html', {
        ITEMS_HTML: itemsHtml,
        ITEMS_JS: itemsJs,
        FADE_OUT_AT: fadeOutAt,
      });
    }
    case 'quote': {
      // Reuse highlight template — quote es básicamente highlight con label
      const words = (c.quote || '').split(/\s+/).slice(0, 3).join(' ').toUpperCase();
      return renderTemplate('template_highlight.html', {
        WORD: escHtml(words),
        LABEL_HTML: '',
        FADE_OUT_AT: fadeOutAt,
      });
    }
    case 'cta': {
      return renderTemplate('template_cta.html', {
        PRE: escHtml(c.pre || 'COMENTA').toUpperCase(),
        KEYWORD: escHtml(c.keyword || ''),
        FADE_OUT_AT: fadeOutAt,
      });
    }
    case 'cierre': {
      const stampJs = c.stamp ? `tl.fromTo('#stage .stamp', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.28, ease: 'back.out(2.0)' }, 0.85);` : '';
      return renderTemplate('template_cierre.html', {
        MAIN: escHtml(c.main || 'GRACIAS').toUpperCase(),
        STAMP_HTML: c.stamp ? `<div class="stamp">${escHtml(c.stamp)}</div>` : '',
        LATE_REVEAL_JS: stampJs,
        FADE_OUT_AT: fadeOutAt,
      });
    }
    case 'flash': {
      const word = (c.word || '').trim();
      if (!word || word.length < 2) return null;
      // Si la IA eligió un icono → BURST (animación rica centrada)
      // Si no → BADGE pequeño en esquina (ambient)
      if (c.icon && ICONS[c.icon]) {
        return renderTemplate('template_icon_burst.html', {
          WORD: escHtml(word).toUpperCase(),
          ICON_SVG: iconSvg(c.icon, '#0D0D0D'),
          FADE_OUT_AT: fadeOutAt,
        });
      }
      // Badge ambient (sin icono)
      const positions = [
        { style: 'top: 1320px; left: 50px;', rotate: 'rotate(-6deg)' },
        { style: 'top: 1320px; right: 50px;', rotate: 'rotate(6deg)' },
        { style: 'top: 1480px; left: 60px;', rotate: 'rotate(4deg)' },
        { style: 'top: 1480px; right: 60px;', rotate: 'rotate(-4deg)' },
      ];
      const idx = (beat.position_idx || 0) % positions.length;
      const pos = positions[idx];
      return renderTemplate('template_flash.html', {
        WORD: escHtml(word).toUpperCase(),
        ICON_HTML: '<span class="dot"></span>',
        POS_STYLE: pos.style,
        ROTATE: pos.rotate,
        FADE_OUT_AT: fadeOutAt,
      });
    }
    default:
      return null;
  }
}

function buildKaraokeHtml(clean) {
  const words = clean.words.filter(w => w.type === 'word');
  const totalDur = clean.audio_duration_secs;
  const chunks = [];
  let cur = [];
  const push = () => { if (cur.length) { chunks.push(cur); cur = []; } };
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    cur.push(w);
    const isEnd = /[.!?]$/.test(w.text);
    const isComma = /,$/.test(w.text) && cur.length >= 4;
    const nextGap = i + 1 < words.length ? words[i + 1].start - w.end : 999;
    const overLimit = cur.length >= 6;
    if (isEnd || isComma || nextGap > 0.35 || overLimit) push();
  }
  push();

  const chunksHtml = [];
  const tweensJs = [];
  chunks.forEach((ch, ci) => {
    const tStart = Math.max(0, ch[0].start - 0.10);
    const tEnd = Math.min(totalDur, ch[ch.length - 1].end + 0.18);
    const wordSpans = ch.map((w, wi) => {
      const cleanText = w.text.replace(/«/g, '&laquo;').replace(/»/g, '&raquo;').replace(/[,.!?]$/, '').replace(/"/g, '&quot;');
      return `<span class="kw" id="c${ci}_w${wi}">${cleanText}</span>`;
    });
    chunksHtml.push(`<div class="chunk" id="c${ci}">${wordSpans.join(' ')}</div>`);
    tweensJs.push(`tl.set('#c${ci}',{opacity:0,y:24},0);`);
    tweensJs.push(`tl.to('#c${ci}',{opacity:1,y:0,duration:0.18,ease:'power2.out'},${tStart.toFixed(3)});`);
    tweensJs.push(`tl.to('#c${ci}',{opacity:0,y:-12,duration:0.16,ease:'power2.in'},${tEnd.toFixed(3)});`);
    ch.forEach((w, wi) => {
      tweensJs.push(`tl.to('#c${ci}_w${wi}',{color:'#FAC51C',scale:1.06,textShadow:'0 0 24px rgba(250,197,28,0.65), 0 2px 8px rgba(0,0,0,0.95)',duration:0.06,ease:'power1.out'},${w.start.toFixed(3)});`);
      tweensJs.push(`tl.to('#c${ci}_w${wi}',{color:'#FFFFFF',scale:1,textShadow:'0 2px 8px rgba(0,0,0,0.95)',duration:0.06,ease:'power1.in'},${w.end.toFixed(3)});`);
    });
  });

  const html = renderTemplate('template_karaoke.html', {
    CHUNKS_HTML: chunksHtml.join('\n    '),
    TWEENS_JS: tweensJs.join('\n  '),
  });
  return { html, chunks: chunks.length, words: words.length };
}

// ── Plan rule-based (sin IA) ─────────────────────────────────────────────────

const STOPWORDS = new Set([
  // Artículos / determinantes
  'el','la','los','las','un','una','unos','unas','este','esta','estos','estas','eso','esa','esos','esas',
  // Conectores / preposiciones
  'y','o','de','del','en','a','al','que','con','por','para','sin','sobre','entre','desde','hasta','contra','según',
  // Posesivos / personales
  'su','sus','mi','mis','tu','tus','nuestro','nuestra','vuestro','vuestra',
  'lo','le','les','se','me','te','nos','os','yo','tú','él','ella','nosotros','vosotros','ellos','ellas',
  // Verbos copulativos / auxiliares
  'es','son','ser','está','están','estar','soy','somos','sois','eres','sea','sean','fue','fueron','era','eran',
  'he','ha','han','hay','había','habido','hemos','habéis','ahí',
  // Adverbios filler / temporales / cuantificadores
  'no','sí','si','muy','más','menos','también','tampoco','pero','aunque','porque','ya','aquí','allí','allá',
  'hoy','ayer','mañana','ahora','antes','después','luego','siempre','nunca','tan','tanto','solo','sólo','solamente','justo',
  // Spanish fillers (NUNCA quieres estas como keywords/destacados)
  'bueno','pues','eh','em','um','uh','este','o','sea','tipo','vale','venga','mira','digamos','obviamente',
  // English minimal (por si transcript multilingual)
  'the','a','an','and','or','of','in','on','at','to','for','with','from','by','is','are','was','were','be','been',
]);

const GREETINGS = ['familia','hola','buenas','chicos','chicas','gente','equipo','amigos','tribu','holi','hey','holaaa','qué','tal','bienvenidos','bienvenidas'];
// Detección de imperativos por STEM (raíz del verbo) para captar
// formas conjugadas variadas (comenta/comentad/comentando/comentar).
// Cada entrada: prefijo mínimo que identifica el imperativo de forma única.
const IMPERATIVE_STEMS = [
  'coment',     // comenta, comentad, comentando, comentar
  'suscrib',    // suscríbete, suscribíos, suscríbeme, etc.
  'compart',    // comparte, compartid, compartir
  'únet','unet','unirt','unirs',
  'sígue','sigue','seguid','seguir',
  'escríb','escrib',
  'mánd','mand','envía','envia','envío','envio',
  'apúntate','apuntate','apunta',
  'regístr','registr',
  'reserv',
  'aprovech','no te pierd','no te lo pierd','no os perdá',
  'fíja','fija',
  'cliquea','clica','clickea','haz click','haced click','toca aquí','tap',
  'sub','subs',  // english 'sub'/'subscribe' fragments
];
// Normaliza eliminando acentos (NFD) para comparaciones robustas
function noAccents(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}
// Helper: ¿es un imperativo?
function isImperative(text) {
  const raw = text.toLowerCase().replace(/[,.!?¡¿]/g, '').trim();
  if (raw.length < 4) return false;
  const t = noAccents(raw);
  for (const stem of IMPERATIVE_STEMS) {
    if (t.startsWith(noAccents(stem))) return true;
  }
  // Imperativos cortos especiales (sin acentos para comparar)
  if (['mira','mirad','escucha','escuchad','dale','dadle','like','share','follow','watch','join'].includes(t)) return true;
  return false;
}
const LIST_MARKERS_FIRST = ['primero','primera','primer punto','en primer lugar','uno','número uno','lo primero','para empezar','de primeras'];
const LIST_MARKERS_SECOND = ['segundo','segunda','segundo punto','en segundo lugar','dos','número dos','lo segundo','por otro lado','después','luego','y luego'];
const LIST_MARKERS_THIRD = ['tercero','tercera','tercer punto','en tercer lugar','tres','número tres','finalmente','por último','para terminar','para acabar','y por último','como tercer'];

// Fillers a recortar en Fase 3 (más exhaustivo)
const CUT_FILLERS = [
  'eh','em','um','uh','ehm','mmm','hmm',
];
const START_FILLERS = ['bueno','pues','vale','vamos','venga','bien','a','ver'];

// Divide la lista de palabras en frases (corta en . ! ? o pausa larga).
function splitIntoPhrases(words) {
  const phrases = [];
  let cur = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    cur.push(w);
    const isEnd = /[.!?]$/.test(w.text);
    const nextGap = i + 1 < words.length ? words[i + 1].start - w.end : 999;
    if (isEnd || nextGap > 0.55) {
      if (cur.length) phrases.push(cur);
      cur = [];
    }
  }
  if (cur.length) phrases.push(cur);
  return phrases;
}

function phraseText(phrase) {
  return phrase.map(w => w.text).join(' ').replace(/\s([,.!?])/g, '$1').trim();
}

function phraseScore(phrase) {
  // Mejor frase = larga (5-12 palabras) + muchas palabras de contenido (no stopwords)
  const len = phrase.length;
  if (len < 4 || len > 16) return 0;
  const content = phrase.filter(w => {
    const t = w.text.toLowerCase().replace(/[,.!?¡¿«»]/g, '').trim();
    return t.length > 2 && !STOPWORDS.has(t);
  }).length;
  return content * (len >= 5 && len <= 10 ? 1.2 : 1);
}

function detectLocation(words) {
  // Inspecciona los primeros ~25 palabras (o todo si es corto)
  const earlyText = words.slice(0, Math.min(25, words.length)).map(w => w.text).join(' ').toLowerCase();
  // Patrones de location (priorizar los más específicos)
  const patterns = [
    /(?:estoy|estamos)\s+(?:aquí\s+)?en\s+([^,.;]+?)(?:[,.;]|$)/i,
    /(?:aquí|aqui)\s+(?:estoy|estamos)\s+en\s+([^,.;]+?)(?:[,.;]|$)/i,
    /(?:hoy estoy|hoy estamos)\s+(?:aquí\s+)?en\s+([^,.;]+?)(?:[,.;]|$)/i,
    /grabando\s+(?:desde|en)\s+([^,.;]+?)(?:[,.;]|$)/i,
    /desde\s+([^,.;]+?)(?:[,.;]|$)/i,
    /vengo\s+de\s+([^,.;]+?)(?:[,.;]|$)/i,
    /(?:i'm|im|i am)\s+(?:here\s+)?(?:at|in)\s+([^,.;]+?)(?:[,.;]|$)/i,
  ];
  for (const re of patterns) {
    const m = earlyText.match(re);
    if (m && m[1]) {
      let raw = m[1].trim();
      // Cortar al primer verbo en gerundio/infinitivo
      const stopRe = /\s+\S+(?:ando|iendo|ado|ido|ar|er|ir)\b/;
      const stopMatch = raw.match(stopRe);
      if (stopMatch && stopMatch.index > 3) raw = raw.slice(0, stopMatch.index).trim();
      // Quitar relative pronouns
      raw = raw.replace(/\s+(que|donde|el cual|la cual|cuando|porque)\s.+$/, '');
      // Quitar artículo inicial
      raw = raw.replace(/^(el |la |los |las |un |una |unos |unas |mi |mis |tu |tus )+/, '').trim();
      // Limitar a 4 palabras max
      const w = raw.split(/\s+/).slice(0, 4);
      let loc = w.join(' ').replace(/\s+(de|del|que|y|en|para|con|por)\s*$/, '').trim();
      if (loc.length > 2) return loc.toUpperCase();
    }
  }
  return null;
}

// Detecta "soy [Nombre]" o "te habla [Nombre]" para intro alternativa
function detectName(words) {
  const earlyText = words.slice(0, Math.min(15, words.length)).map(w => w.text).join(' ').toLowerCase();
  const patterns = [
    /(?:soy|me llamo|te habla)\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)?)\b/i,
    /(?:my name is|i am|i'm)\s+([a-z]+(?:\s+[a-z]+)?)\b/i,
  ];
  for (const re of patterns) {
    const m = earlyText.match(re);
    if (m && m[1]) {
      const name = m[1].trim().split(/\s+/).slice(0, 2).join(' ');
      if (name.length > 1 && name.length < 25) return name.toUpperCase();
    }
  }
  return null;
}

function detectGreeting(words) {
  const first = words.slice(0, 4).map(w => w.text.toLowerCase().replace(/[,.!?]/g, '')).filter(Boolean);
  for (const g of GREETINGS) {
    if (first.includes(g)) return g.toUpperCase();
  }
  return null;
}

function buildIntroBeat(words, totalDur) {
  const location = detectLocation(words);
  const greeting = detectGreeting(words);
  const name = detectName(words);
  let title, subtitle = null;
  if (location) {
    title = location.length > 28 ? location.slice(0, 28) : location;
  } else if (name) {
    title = name;
  } else if (greeting) {
    title = greeting;
  } else {
    // Fallback inteligente: la primera frase de contenido (substantivo+adjetivo)
    // Busca primer substantivo de >4 letras + opcional adjetivo
    const contentFirst = words.slice(0, 12).filter(w => {
      const t = w.text.toLowerCase().replace(/[,.!?]/g, '').trim();
      return t.length > 3 && !STOPWORDS.has(t);
    }).slice(0, 2).map(w => w.text.replace(/[,.!?]/g, '')).join(' ');
    title = (contentFirst || 'GRABACIÓN').toUpperCase().slice(0, 28);
  }
  return {
    type: 'intro',
    start_in_output: 0.5,
    duration: Math.min(3.0, Math.max(2.0, totalDur * 0.25)),
    anchor_word_t: words[0]?.start || 0,
    content: { title, subtitle, emphasis: null },
  };
}

function buildHighlightBeat(phrases, fromT, toT) {
  // Coge la frase con mayor score dentro del rango temporal
  const candidates = phrases
    .filter(p => p[0].start >= fromT && p[p.length - 1].end <= toT)
    .map(p => ({ phrase: p, score: phraseScore(p) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!candidates.length) return null;
  const phrase = candidates[0].phrase;
  let text = phraseText(phrase).replace(/[.!?]$/, '').trim();
  if (text.length > 100) text = text.slice(0, 100);
  // Emphasis = palabra de contenido más larga
  const contentWords = phrase.filter(w => {
    const t = w.text.toLowerCase().replace(/[,.!?¡¿«»]/g, '').trim();
    return t.length > 4 && !STOPWORDS.has(t);
  });
  const emphasis = contentWords.sort((a, b) => b.text.length - a.text.length)[0]?.text.replace(/[,.!?]/g, '') || null;
  return {
    type: 'highlight',
    start_in_output: phrase[0].start,
    duration: 4.0,
    anchor_word_t: phrase[0].start,
    content: { pre: null, text: text.toUpperCase(), emphasis: emphasis ? emphasis.toUpperCase() : null, footer: null },
  };
}

function detectList(words) {
  // 1. PRIMERO intenta marcadores explícitos primero/segundo/tercero
  const fromMarkers = detectListFromMarkers(words);
  if (fromMarkers) return fromMarkers;
  // 2. FALLBACK: lista separada por comas "X, Y, Z" o "X, Y y Z"
  return detectListFromCommas(words);
}

function detectListFromMarkers(words) {
  const lower = words.map(w => w.text.toLowerCase().replace(/[,.!?]/g, '').trim());
  const markers = [LIST_MARKERS_FIRST, LIST_MARKERS_SECOND, LIST_MARKERS_THIRD];
  const positions = [];
  for (const markerSet of markers) {
    let found = -1;
    for (let i = 0; i < lower.length; i++) {
      if (markerSet.some(m => lower.slice(i, i + m.split(' ').length).join(' ') === m)) {
        found = i;
        break;
      }
    }
    if (found === -1) return null;
    positions.push(found);
  }
  if (positions[0] >= positions[1] || positions[1] >= positions[2]) return null;
  const items = positions.map((pos, i) => {
    const end = i < 2 ? Math.min(positions[i + 1], pos + 8) : Math.min(words.length, pos + 8);
    const itemWords = words.slice(pos + 1, end).filter(w => {
      const t = w.text.toLowerCase().replace(/[,.!?]/g, '').trim();
      return t.length > 2 && !STOPWORDS.has(t);
    }).slice(0, 4);
    return {
      text: itemWords.map(w => w.text.replace(/[,.!?]/g, '')).join(' ') || `Punto ${i + 1}`,
      emphasis: null,
      anchor_t: words[pos].start,
    };
  });
  return {
    type: 'list',
    start_in_output: Math.max(0, words[positions[0]].start - 0.4),
    duration: Math.min(7.0, words[positions[2]].end - words[positions[0]].start + 1.5),
    anchor_word_t: words[positions[0]].start,
    content: { label: 'PUNTOS CLAVE', items },
  };
}

// Detecta enumeraciones por comas: "X, Y, Z" o "X, Y y Z" (también "e" / "o")
function detectListFromCommas(words) {
  // Construye un mapa de comas (palabras que terminan en ",") y conjunciones finales ("y","e","o")
  // Para cada palabra busca: una secuencia [items_1+], "," , [items_2+], "," , [items_3+]
  // donde cada item es 1-3 content words consecutivas.
  const N = words.length;
  // Necesitamos al menos 3 items (3 palabras mín + 2 separadores), ~5 palabras min.
  for (let i = 0; i < N - 3; i++) {
    // Probar empezando desde palabra i
    const itemA = collectNounPhrase(words, i);
    if (!itemA) continue;
    if (!itemA.endsWithComma) continue;

    let j = itemA.endIdx + 1;
    if (j >= N) continue;
    const itemB = collectNounPhrase(words, j);
    if (!itemB) continue;

    // Caso 1: "A, B, C" (3 items con comas) o "A, B, C y D" (4 items)
    // Caso 2: "A, B y C" (2 commas + 1 conjunction)
    let items = [itemA, itemB];

    // ¿La siguiente palabra después de itemB es conjunción ("y","e","o")?
    let k = itemB.endIdx + 1;
    if (k < N) {
      const nextW = words[k].text.toLowerCase().replace(/[,.!?]/g, '').trim();
      if (['y', 'e', 'o'].includes(nextW)) {
        // Sólo 2 items + 1 después de conjunción (necesito 3+ items en total)
        if (!itemB.endsWithComma) {
          // Falta un item final tras conjunción
          const itemC = collectNounPhrase(words, k + 1);
          if (itemC && items.length === 2) {
            items.push(itemC);
            if (items.length >= 3) {
              return buildListResult(items);
            }
          }
        }
      } else if (itemB.endsWithComma) {
        // Hay un tercer item potencial
        const itemC = collectNounPhrase(words, k);
        if (itemC) {
          items.push(itemC);
          // ¿Conjunción "y/e/o" + cuarto item?
          let m = itemC.endIdx + 1;
          if (m < N) {
            const conjW = words[m].text.toLowerCase().replace(/[,.!?]/g, '').trim();
            if (['y', 'e', 'o'].includes(conjW) && !itemC.endsWithComma) {
              const itemD = collectNounPhrase(words, m + 1);
              if (itemD) items.push(itemD);
            }
          }
          if (items.length >= 3) return buildListResult(items);
        }
      }
    }
  }
  return null;
}

// Recoge una "noun phrase" de 1-3 content words consecutivas.
// Devuelve null si no hay phrase válida en el index.
// Detecta si la última palabra termina en ","
function collectNounPhrase(words, startIdx) {
  if (startIdx >= words.length) return null;
  const result = [];
  let i = startIdx;
  let endsWithComma = false;
  while (i < words.length && result.length < 3) {
    const w = words[i];
    const txt = w.text.toLowerCase().replace(/[,.!?¡¿«»]/g, '').trim();
    // Si es stopword/conjunción y ya tenemos algo, parar
    if (result.length > 0 && (STOPWORDS.has(txt) || ['y','e','o'].includes(txt))) break;
    if (txt.length < 2) break;
    // Si es stopword/conjunción al inicio, no empezar con ella
    if (result.length === 0 && (STOPWORDS.has(txt) || ['y','e','o'].includes(txt))) return null;
    result.push(w);
    if (w.text.endsWith(',')) {
      endsWithComma = true;
      break;
    }
    i++;
    // Si el SIGUIENTE es conjunción/punto, parar aquí
    if (i < words.length) {
      const next = words[i].text.toLowerCase().replace(/[,.!?]/g, '').trim();
      if (['y','e','o'].includes(next) || /[.!?]$/.test(words[i-1].text)) break;
    }
  }
  if (result.length === 0 || result.length > 3) return null;
  return {
    words: result,
    text: result.map(w => w.text.replace(/,$/, '')).join(' '),
    startIdx,
    endIdx: result[result.length - 1] === words[i] ? i : i - 1,
    anchor_t: result[0].start,
    endsWithComma,
  };
}

function buildListResult(items) {
  // Cada item.text — capitalize Title Case
  const cleanItems = items.map(it => ({
    text: it.text.replace(/\b\w/g, c => c.toUpperCase()),
    emphasis: null,
    anchor_t: it.anchor_t,
  }));
  const startT = items[0].words[0].start;
  const endT = items[items.length - 1].words[items[items.length - 1].words.length - 1].end;
  return {
    type: 'list',
    start_in_output: Math.max(0, startT - 0.4),
    duration: Math.min(7.5, endT - startT + 1.5),
    anchor_word_t: startT,
    content: { label: 'PUNTOS CLAVE', items: cleanItems },
  };
}

function detectCTA(words, totalDur) {
  // Imperativo en último 50% del vídeo. Adverbios filler que NO son keywords.
  const fillerAdverbs = new Set(['ahora','ya','abajo','aquí','allí','rápido','pronto','también','siempre','nunca','luego']);
  const lateThreshold = totalDur * 0.5;
  // Texto plano para detectar patrones multi-palabra
  const plainText = words.map(w => w.text.toLowerCase().replace(/[,.!?¡¿«»]/g, '').trim()).join(' ');

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w.start < lateThreshold) continue;
    if (!isImperative(w.text)) continue;
    const t = w.text.toLowerCase().replace(/[,.!?¡¿]/g, '').trim();

    // Patrones especiales: "comenta(ndo) la palabra X" → keyword X
    // Buscar en las siguientes 8 palabras
    const window = words.slice(i, Math.min(i + 12, words.length));
    const winText = window.map(x => x.text.toLowerCase().replace(/[,.!?]/g, '').trim()).join(' ');
    let keyword = null;
    let pre = null;

    // "(comenta|comentando|escribe) la palabra X"
    const palabraMatch = winText.match(/\b(?:comenta|comentando|comentad|escribe|escribid|pon|poned|deja|dejad)\s+(?:la\s+)?palabra\s+([^\s]+)/i);
    if (palabraMatch) {
      keyword = palabraMatch[1].replace(/[«»]/g, '');
      pre = 'COMENTA LA PALABRA';
    }
    // "suscríbete a X" / "únete a X" / "sígueme en X"
    if (!keyword) {
      const aMatch = winText.match(/\b(?:suscríbete|únete|unete|sígueme|sigueme|sigue|seguidme)\s+(?:a|al|en)\s+([^\s]+)/i);
      if (aMatch) {
        keyword = aMatch[1];
        pre = t.includes('susc') ? 'SUSCRÍBETE A' :
              t.includes('úne') || t.includes('une') ? 'ÚNETE A' :
              t.includes('sig') ? 'SÍGUEME EN' : 'IR A';
      }
    }
    // "comparte X" / "comenta X" (sin "la palabra")
    if (!keyword) {
      const next = window.slice(1).find(x => {
        const xt = x.text.toLowerCase().replace(/[,.!?«»]/g, '').trim();
        return xt.length > 2 && !STOPWORDS.has(xt) && !fillerAdverbs.has(xt) && !isImperative(xt);
      });
      if (next) {
        keyword = next.text.replace(/[,.!?«»]/g, '');
        pre = t.toUpperCase().includes('COMENT') ? 'COMENTA' :
              t.toUpperCase().includes('SUSC') ? 'SUSCRÍBETE' :
              t.toUpperCase().includes('COMP') ? 'COMPARTE' :
              t.toUpperCase().includes('SIG') ? 'SIGUE' : t.toUpperCase();
      }
    }

    if (!keyword) continue;
    return {
      type: 'cta',
      start_in_output: w.start,
      duration: 4.0,
      anchor_word_t: w.start,
      content: { pre, keyword: keyword.toLowerCase(), footer: null },
    };
  }
  return null;
}

// Genera "flash" beats: badges pequeños con palabras clave del speaker,
// distribuidos cada ~3-4s en los huecos entre beats principales.
function generateFlashBeats(words, totalDur, occupiedRanges) {
  const flashes = [];
  const SPACING = 3.5;     // gap entre flashes (un poco más para que respiren)
  const FLASH_DUR = 2.2;   // duración: suficiente para icon-burst + un beat ambient
  let positionIdx = 0;
  let lastFlashEnd = 0;

  // Para evitar repetir la misma palabra
  const usedWords = new Set();

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w.start - 0.15 < 0) continue;
    if (w.start - 0.15 < lastFlashEnd + 0.3) continue;
    if (w.start + FLASH_DUR > totalDur - 1) break;

    // No solapar con beats principales
    const flashStart = w.start - 0.15;
    const flashEnd = flashStart + FLASH_DUR;
    const conflicts = occupiedRanges.some(r => flashStart < r.end + 0.3 && flashEnd > r.start - 0.3);
    if (conflicts) continue;

    // Spaciado mínimo desde el último flash
    if (lastFlashEnd > 0 && flashStart - lastFlashEnd < SPACING) continue;

    // Filtrar: palabra de contenido, longitud>4, no stopword, no usada
    const txt = w.text.toLowerCase().replace(/[,.!?¡¿«»]/g, '').trim();
    if (txt.length < 5) continue;
    if (STOPWORDS.has(txt)) continue;
    if (usedWords.has(txt)) continue;
    if (isImperative(w.text)) continue;
    // Penalizar gerundios/participios y verbos conjugados débiles
    if (/(?:ando|iendo|ado|ido|aron|ieron|amos|emos|imos|aban|ían)$/.test(txt)) continue;
    // Solo coger palabras "punzantes" (sustantivos, adjetivos, terminaciones nominales)
    // Lista de buenos sufijos nominales/adjetivales en español
    const goodSuffix = /(?:dad|ión|ial|ible|able|ico|ica|ismo|ista|encia|anza|tura|miento|izar)$/.test(txt);
    // O palabras de >7 letras (probablemente sustantivos largos)
    const isLongContent = txt.length >= 7;
    // O palabras de 5-6 letras que suelen ser sustantivos comunes (premio, tribu, mundo, etc.)
    const isShortContent = txt.length >= 5 && txt.length <= 6 && !/^(?:hacer|tener|estar|haber|poder|querer|saber|decir|venir|salir|seguir|sentir|poner|llevar|deber)$/.test(txt);
    if (!(goodSuffix || isLongContent || isShortContent)) continue;

    usedWords.add(txt);
    flashes.push({
      type: 'flash',
      start_in_output: flashStart,
      duration: FLASH_DUR,
      anchor_word_t: w.start,
      position_idx: positionIdx++,
      content: { word: w.text.replace(/[,.!?¡¿«»]/g, '') },
    });
    lastFlashEnd = flashEnd;
  }
  return flashes;
}

function buildCierreBeat(phrases, words, totalDur) {
  // Coge la última frase si es "limpia" (>=3 palabras y no termina en mid-thought)
  const lastPhrase = phrases[phrases.length - 1];
  let main = 'GRACIAS';
  let sub = null;
  if (lastPhrase && lastPhrase.length >= 3 && lastPhrase.length <= 8) {
    let text = phraseText(lastPhrase).replace(/[.!?]$/, '').trim();
    // Detecta mid-thought por terminaciones tipo "y", "que", "porque"
    const lastWord = lastPhrase[lastPhrase.length - 1].text.toLowerCase().replace(/[,.!?]/g, '');
    if (!['y','que','porque','para','de','en','a','con','o','pues'].includes(lastWord)) {
      main = text.toUpperCase().slice(0, 28);
      // Sub: última palabra(s) de contenido como apoyo
      const lastContent = lastPhrase.filter(w => {
        const t = w.text.toLowerCase().replace(/[,.!?]/g, '').trim();
        return t.length > 3 && !STOPWORDS.has(t);
      }).slice(-3);
      if (lastContent.length) sub = lastContent.map(w => w.text.replace(/[,.!?]/g, '')).join(' ');
    }
  }
  return {
    type: 'cierre',
    start_in_output: Math.max(0, totalDur - 4.0),
    duration: 4.0,
    anchor_word_t: totalDur - 2,
    content: { main, sub, stamp: 'tribu divisual' },
  };
}

function ruleBasedPlan(clean, meta) {
  const totalDur = clean.audio_duration_secs;
  const words = clean.words.filter(w => w.type === 'word');
  if (!words.length) return [];

  const phrases = splitIntoPhrases(words);
  const beats = [];

  // 1. INTRO siempre
  const intro = buildIntroBeat(words, totalDur);
  beats.push(intro);
  const introEnd = intro.start_in_output + intro.duration;

  // 2. CIERRE siempre
  const cierre = buildCierreBeat(phrases, words, totalDur);
  const cierreStart = cierre.start_in_output;

  // 3. Beats intermedios entre introEnd y cierreStart
  const middleStart = introEnd + 0.5;
  const middleEnd = cierreStart - 0.5;

  if (middleEnd > middleStart + 1.0) {
    // Detectar list (si hay una enumeración)
    const list = detectList(words);
    let listEnd = middleStart;
    if (list && list.start_in_output >= middleStart && list.start_in_output + list.duration <= middleEnd) {
      beats.push(list);
      listEnd = list.start_in_output + list.duration + 0.5;
    }

    // Highlights — pueden coexistir con la list, ocupando los huecos antes/después
    const splitT = (Math.max(listEnd, middleStart) + middleEnd) / 2;
    // Highlight ANTES de la list (si hay hueco)
    if (list && list.start_in_output > middleStart + 1.5) {
      const h0 = buildHighlightBeat(phrases, middleStart, list.start_in_output - 0.5);
      if (h0 && (h0.start_in_output + h0.duration) <= list.start_in_output - 0.3) {
        h0.duration = Math.min(h0.duration, list.start_in_output - 0.3 - h0.start_in_output);
        if (h0.duration >= 1.5) beats.push(h0);
      }
    } else if (!list) {
      // Sin list: añade un highlight en la primera mitad del medio
      const h1 = buildHighlightBeat(phrases, middleStart, splitT + 1);
      if (h1) {
        h1.duration = Math.min(h1.duration, splitT - h1.start_in_output - 0.3);
        if (h1.duration >= 1.5) beats.push(h1);
      }
    }
    // Highlight DESPUÉS de la list (o segundo highlight)
    const h2start = Math.max(listEnd, splitT + 0.5);
    const h2 = buildHighlightBeat(phrases, h2start, middleEnd);
    if (h2) {
      // No solapar con beats anteriores
      const lastBeat = beats[beats.length - 1];
      const lastEnd = lastBeat ? lastBeat.start_in_output + lastBeat.duration : 0;
      if (h2.start_in_output > lastEnd + 0.5) {
        h2.duration = Math.min(h2.duration, middleEnd - h2.start_in_output);
        if (h2.duration >= 1.5) beats.push(h2);
      }
    }

    // CTA (solo si hay imperativo)
    const cta = detectCTA(words, totalDur);
    if (cta && cta.start_in_output >= middleStart && cta.start_in_output + cta.duration <= cierreStart - 0.3) {
      // Eliminar highlights que se solapen con CTA
      for (let i = beats.length - 1; i >= 0; i--) {
        const b = beats[i];
        if (b.type === 'intro' || b.type === 'cierre') continue;
        const bEnd = b.start_in_output + b.duration;
        if (bEnd > cta.start_in_output - 0.3) {
          // Recortar
          b.duration = Math.max(0, cta.start_in_output - 0.3 - b.start_in_output);
          if (b.duration < 1.5) beats.splice(i, 1);
        }
      }
      beats.push(cta);
    }
  }

  beats.push(cierre);

  // Ordenar y limpiar solapamientos finales (entre main beats — no flashes aún)
  beats.sort((a, b) => a.start_in_output - b.start_in_output);
  for (let i = 1; i < beats.length; i++) {
    const prev = beats[i - 1];
    const cur = beats[i];
    const prevEnd = prev.start_in_output + prev.duration;
    if (cur.start_in_output < prevEnd) {
      prev.duration = Math.max(0, cur.start_in_output - 0.2 - prev.start_in_output);
    }
  }
  let mainBeats = beats.filter(b => b.duration >= 1.0 || b.type === 'intro' || b.type === 'cierre');

  // ── Generar FLASH beats en los huecos para densificar el vídeo ────────────
  // Los flash beats son badges pequeños en esquinas (no compiten con beats principales)
  const occupied = mainBeats.map(b => ({ start: b.start_in_output, end: b.start_in_output + b.duration }));
  const flashes = generateFlashBeats(words, totalDur, occupied);
  // Mezclar y ordenar (flash beats ocurren al mismo tiempo que main beats sin conflicto
  // porque se renderizan en posiciones diferentes; no hay overlay collision)
  const allBeats = [...mainBeats, ...flashes].sort((a, b) => a.start_in_output - b.start_in_output);
  return allBeats;
}

// ── Enhancement con IA (Opus 4.7) — capa opcional sobre el rule-based ──
// Toma el plan determinista + transcript y devuelve un plan refinado.
// Si la IA falla o devuelve algo inválido, se conserva el plan original.
function enhancePlanWithAI(plan, clean, model = 'claude-opus-4-7') {
  return new Promise((resolve) => {
    const transcriptCompact = clean.words.filter(w => w.type === 'word')
      .map(w => `${w.start.toFixed(2)}|${w.text}`).join(' ');
    const totalDur = clean.audio_duration_secs.toFixed(2);

    const prompt = `Eres un EDITOR PROFESIONAL de vídeos cortos verticales (Reels/TikTok, 30-60s, español).
Tu tarea: REFINAR un plan de motion graphics y AÑADIR ICONOS CREATIVOS basándote en lo que dice el speaker, como haría un editor experto.

DURACIÓN del vídeo: ${totalDur}s

TRANSCRIPT (formato "tiempo_seg|palabra"):
${transcriptCompact}

PLAN ACTUAL (rule-based):
${JSON.stringify(plan, null, 2)}

═══ ICONOS DISPONIBLES (úsalos cuando encajen contextualmente con el discurso) ═══
- "trophy"    → premios, logros, victorias, ganar ("logro", "premio", "ganamos", "campeón")
- "medal"     → reconocimiento, honor ("medalla", "primer puesto")
- "heart"     → amor, ilusión, cariño, comunidad ("ilusión", "amor", "cariño", "familia")
- "fire"      → potencia, energía, viral ("fuego", "increíble", "potente", "explota")
- "target"    → meta, objetivo, foco ("meta", "objetivo", "diana", "apuntar")
- "star"      → destacado, estrellato ("destacar", "brillar", "estrella")
- "rocket"    → crecimiento rápido, lanzamiento ("crecimiento", "despegar", "lanzar", "subir")
- "lightbulb" → ideas, descubrimiento ("idea", "se me ocurrió", "descubrir")
- "chart"     → estadísticas, números, crecimiento ("crecimiento", "datos", "stats")
- "gift"      → regalos, sorpresas, gratis ("regalo", "sorpresa", "gratis", "te doy")
- "money"     → dinero, ganancias, finanzas ("dinero", "ganancias", "facturación", "euros", "ventas")
- "check"     → confirmación, hecho ("listo", "ya está", "perfecto", "hecho")
- "alert"     → atención, importante ("importante", "atención", "ojo", "cuidado")
- "handshake" → acuerdos, sinergia, colaboración ("sinergia", "juntos", "acuerdo", "colaborar")
- "zap"       → rapidez, instantáneo ("rápido", "ya", "al instante")
- "eye"       → mirar, descubrir, observar ("mira", "fíjate", "ver")
- "clock"     → tiempo, deadline ("tiempo", "rápido", "ahora", "hoy")
- "bolt"      → energía, potente
- "speech"    → conversación, comentarios ("comenta", "comentario")
- "flag"      → posicionamiento, bandera, país, lugar ("bandera", "país", "ciudad")
- "thumbsup"  → aprobación, like ("perfecto", "genial", "like")

═══ REGLAS DE EDICIÓN ═══
1. ESTRUCTURA: NO cambies "type" ni "start_in_output" ni "duration" salvo emergencia.
2. CONTENIDO de cada beat:
   - intro.title: si es genérico, refínalo (ej: "GRABACIÓN" → "EN EL GIMNASIO" si dice "estoy en el gimnasio")
   - highlight.text/emphasis: la "emphasis" = palabra/frase de máximo impacto emocional del speaker
   - flash.word: la VERDADERA keyword punzante del momento (sustantivo/adjetivo, no verbos como "tienen"/"hace")
   - flash.icon: AÑADE icon (id de la lista de arriba) si el discurso encaja con un concepto. Esto es lo más importante: piensa como editor visual.
   - list.items[].text: limpia las frases (ej "Pasos Respira" → "Respira")
   - cta.keyword: refina si el rule eligió mal
   - cierre.main: si es genérico ("GRACIAS"), usa una frase punzante del cierre real del speaker
3. EJEMPLO de uso de iconos:
   - Speaker dice "otro logro más" → flash con icon: "trophy"
   - "crear sinergias" → flash con icon: "handshake"
   - "es un sueño" → flash con icon: "star"
   - "ilusión" → flash con icon: "heart"
   - "dinero ganado" → flash con icon: "money"
4. INVENTA o NO: las palabras flash.word DEBEN venir del transcript real dentro del rango temporal (anchor_word_t ± 1s). Pero los iconos PUEDES y DEBES proponerlos creativamente.
5. PUEDES añadir 1-2 flash beats nuevos en gaps > 5s si encuentras un momento con icono claro.
6. Mayúsculas en headlines como ya vienen.

OUTPUT: SOLO el JSON array (mismo formato que el input). Sin markdown, sin comentarios. Empieza por '[' y termina por ']'.

Tu mejor trabajo será cuando el icono mate visualmente lo que el speaker está diciendo en ese momento.`;

    const proc = spawn('claude', ['-p', prompt, '--model', model, '--output-format', 'text'], {
      env: { ...process.env },
    });
    let stdout = '', stderr = '';
    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());
    const TIMEOUT_MS = 90000;
    const timer = setTimeout(() => { proc.kill('SIGTERM'); }, TIMEOUT_MS);

    proc.on('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        emit({ phase: 'plan', status: 'progress', percent: 50, stage: `IA exit ${code}, usando rule-based`, ai_error: stderr.slice(0, 120) });
        return resolve(plan);
      }
      // Extraer JSON
      let jsonStr = stdout.trim();
      const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fence) jsonStr = fence[1].trim();
      const bracketIdx = jsonStr.indexOf('[');
      const lastBracket = jsonStr.lastIndexOf(']');
      if (bracketIdx >= 0 && lastBracket > bracketIdx) {
        jsonStr = jsonStr.slice(bracketIdx, lastBracket + 1);
      }
      let enhanced;
      try {
        enhanced = JSON.parse(jsonStr);
      } catch (e) {
        emit({ phase: 'plan', status: 'progress', percent: 50, stage: 'IA respuesta no parseable, usando rule-based' });
        return resolve(plan);
      }
      // Validación: estructura mínima
      if (!Array.isArray(enhanced) || enhanced.length === 0) return resolve(plan);
      const hasIntro = enhanced.some(b => b && b.type === 'intro');
      const hasCierre = enhanced.some(b => b && b.type === 'cierre');
      if (!hasIntro || !hasCierre) {
        emit({ phase: 'plan', status: 'progress', percent: 50, stage: 'IA rompió estructura, usando rule-based' });
        return resolve(plan);
      }
      // Validación: todos los beats tienen los campos requeridos
      const valid = enhanced.every(b => b && typeof b.type === 'string' &&
                                          typeof b.start_in_output === 'number' &&
                                          typeof b.duration === 'number' &&
                                          b.content);
      if (!valid) {
        emit({ phase: 'plan', status: 'progress', percent: 50, stage: 'IA plan inválido, usando rule-based' });
        return resolve(plan);
      }
      emit({ phase: 'plan', status: 'progress', percent: 55, stage: `IA refinó ${enhanced.length} beats` });
      resolve(enhanced);
    });
  });
}

async function phase4_plan(meta, clean) {
  phaseStart('plan', 'Detectando estructura del discurso', { phase_idx: 4, total: TOTAL_PHASES });

  const compDir = path.join(PROJECT_ROOT, 'output/compositions', PROJECT_NAME);
  const beatsDir = path.join(compDir, 'beats');
  // Limpiar beats previos
  if (fs.existsSync(beatsDir)) fs.rmSync(beatsDir, { recursive: true });
  fs.mkdirSync(beatsDir, { recursive: true });

  // Plan determinista basado en reglas (sin IA)
  phaseProgress('plan', 25, { stage: 'analizando transcript' });
  let plan = ruleBasedPlan(clean, meta);
  // Validación: el plan SIEMPRE debe tener al menos intro + cierre
  const hasIntro = plan.some(b => b.type === 'intro');
  const hasCierre = plan.some(b => b.type === 'cierre');
  if (!hasIntro || !hasCierre) {
    throw new Error(`plan inválido: intro=${hasIntro}, cierre=${hasCierre}`);
  }
  phaseProgress('plan', 40, { stage: `rule-based: ${plan.length} beats`, beat_types: plan.map(b => b.type) });

  // ── Enhancement con IA (Opus 4.7) — opcional, fallback robusto ──
  const useAI = process.env.AI_ENHANCE !== '0'; // default ON
  if (useAI) {
    phaseProgress('plan', 45, { stage: 'IA refinando contenido (Opus 4.7)…' });
    try {
      plan = await enhancePlanWithAI(plan, clean, process.env.AI_MODEL || 'claude-opus-4-7');
    } catch (e) {
      emit({ phase: 'plan', status: 'progress', percent: 50, stage: `IA error, usando rule-based`, error: e.message.slice(0, 100) });
    }
  }
  phaseProgress('plan', 60, { stage: `plan final: ${plan.length} beats`, beat_types: plan.map(b => b.type) });

  // Forzar que el cierre llegue hasta totalDur (por si quedó corto)
  const totalDur = clean.audio_duration_secs;
  const cierreIdx = plan.findIndex(b => b.type === 'cierre');
  if (cierreIdx >= 0) {
    plan[cierreIdx].duration = totalDur - plan[cierreIdx].start_in_output;
  }

  // 2. Renderizar beats desde templates
  phaseProgress('plan', 70, { stage: 'rellenando templates' });
  const beatsList = [];
  plan.forEach((b, i) => {
    const html = buildBeatHtml(b);
    if (!html) return;
    const safeName = `beat_${String(i + 1).padStart(2, '0')}_${b.type}`;
    const filePath = path.join(beatsDir, `${safeName}.html`);
    fs.writeFileSync(filePath, html);
    beatsList.push({
      name: safeName,
      file: `beats/${safeName}.html`,
      duration: b.duration,
      start_in_output: b.start_in_output,
      type: b.type,
    });
  });

  // 3. Generar karaoke HTML
  phaseProgress('plan', 85, { stage: 'generando karaoke' });
  const kar = buildKaraokeHtml(clean);
  fs.writeFileSync(path.join(beatsDir, 'karaoke.html'), kar.html);
  beatsList.push({
    name: 'karaoke',
    file: 'beats/karaoke.html',
    duration: clean.audio_duration_secs,
    start_in_output: 0,
    type: 'karaoke',
  });

  // 4. Escribir beats.json para capture/composite
  const beatsJson = {
    version: 2,
    project: PROJECT_NAME,
    design_w: DESIGN_W,
    design_h: DESIGN_H,
    design_fps: DESIGN_FPS,
    total_duration_s: clean.audio_duration_secs,
    beats: beatsList,
  };
  fs.writeFileSync(path.join(compDir, 'beats.json'), JSON.stringify(beatsJson, null, 2));

  phaseDone('plan', {
    beats_count: plan.length,
    beat_types: plan.map(b => b.type),
    karaoke_chunks: kar.chunks,
    karaoke_words: kar.words,
  });
}

async function phase5_capture(meta, clean) {
  phaseStart('capture', 'Renderizando overlays HTML a ProRes 4444', { phase_idx: 5, total: TOTAL_PHASES });
  const compDir = path.join(PROJECT_ROOT, 'output/compositions', PROJECT_NAME);
  const config = JSON.parse(fs.readFileSync(path.join(compDir, 'beats.json'), 'utf8'));
  const fps = config.design_fps;

  const beatNames = config.beats.map(b => b.name);
  const beatTargetFrames = Object.fromEntries(config.beats.map(b => [b.name, Math.ceil(b.duration * fps)]));
  const totalTargetFrames = Object.values(beatTargetFrames).reduce((a, b) => a + b, 0);
  emit({ phase: 'capture', status: 'progress', percent: 0, total_frames: totalTargetFrames });

  const tempBase = require('os').tmpdir();
  let currentBeat = beatNames[0];
  let monitorActive = true;

  const monitor = setInterval(() => {
    if (!monitorActive) return;
    let framesByBeat = {};
    try {
      const dirs = fs.readdirSync(tempBase).filter(d => d.startsWith('hf_'));
      for (const d of dirs) {
        const m = d.match(/^hf_(.+?)_\d+$/);
        if (!m) continue;
        const beatName = m[1];
        try {
          const cnt = fs.readdirSync(path.join(tempBase, d)).length;
          framesByBeat[beatName] = Math.max(framesByBeat[beatName] || 0, cnt);
        } catch {}
      }
    } catch {}

    const renderDir = path.join(compDir, 'renders');
    let doneBeats = [];
    if (fs.existsSync(renderDir)) {
      doneBeats = fs.readdirSync(renderDir).filter(f => f.endsWith('.mov')).map(f => f.replace('.mov', ''));
    }
    let done = 0;
    for (const bn of beatNames) {
      if (doneBeats.includes(bn)) {
        done += beatTargetFrames[bn] || 0;
      } else {
        const inProg = framesByBeat[bn] || 0;
        if (inProg > 0) {
          currentBeat = bn;
          done += Math.min(inProg, beatTargetFrames[bn] || 0);
        }
      }
    }
    const pct = Math.min(99, (done / totalTargetFrames) * 100);
    emit({
      phase: 'capture', status: 'progress', percent: pct,
      frames_done: done, frames_total: totalTargetFrames,
      current: currentBeat,
      done_beats: doneBeats.length, total_beats: beatNames.length,
    });
  }, 1500);

  await new Promise((resolve, reject) => {
    const proc = spawn('node', [path.join(compDir, 'capture.cjs')], { env: process.env });
    proc.stderr.on('data', () => {});
    proc.stdout.on('data', () => {});
    proc.on('exit', code => {
      monitorActive = false;
      clearInterval(monitor);
      code === 0 ? resolve() : reject(new Error(`capture exited ${code}`));
    });
  });
  // Validación: al menos karaoke debe estar (es lo único crítico — los beats son extras)
  const renderDir = path.join(compDir, 'renders');
  const renders = fs.existsSync(renderDir) ? fs.readdirSync(renderDir).filter(f => f.endsWith('.mov')) : [];
  if (!renders.includes('karaoke.mov')) {
    throw new Error(`capture: karaoke.mov no se generó (${renders.length}/${beatNames.length} beats renderizados)`);
  }
  phaseDone('capture', { frames_total: totalTargetFrames, beats_rendered: renders.length, beats_expected: beatNames.length });
}

async function phase6_composite(meta, clean) {
  phaseStart('composite', 'Compositing final con todos los overlays', { phase_idx: 6, total: TOTAL_PHASES });
  const editedPath = path.join(PROJECT_ROOT, 'output', videoStem + '_edited.mp4');
  const finalPath = path.join(PROJECT_ROOT, 'output', videoStem + '_final.mp4');
  const compDir = path.join(PROJECT_ROOT, 'output/compositions', PROJECT_NAME);
  const R = path.join(compDir, 'renders');
  const config = JSON.parse(fs.readFileSync(path.join(compDir, 'beats.json'), 'utf8'));
  const totalDur = clean.audio_duration_secs;
  const designW = config.design_w, designH = config.design_h;

  // Separar karaoke del resto de beats (karaoke debe ir SIEMPRE el último — Hard Rule de subs)
  const karaokeBeat = config.beats.find(b => b.name === 'karaoke');
  const otherBeats = config.beats.filter(b => b.name !== 'karaoke')
    .map(b => ({ ...b, start: b.start_in_output, end: Math.min(b.start_in_output + b.duration, totalDur) }))
    .filter(b => b.start < totalDur - 0.1);

  emit({ phase: 'composite', status: 'progress', percent: 0, beats_count: otherBeats.length });

  // [0:v] se escala/padea al diseño (e.g., 1080×1920) para encajar con los overlays.
  const scaleFilter = `[0:v]scale=${designW}:${designH}:force_original_aspect_ratio=decrease,pad=${designW}:${designH}:(ow-iw)/2:(oh-ih)/2:color=black[base]`;

  const inputs = ['-i', editedPath];
  const ovParts = [scaleFilter];
  let lastLabel = 'base';
  otherBeats.forEach((b, i) => {
    const movPath = path.join(R, `${b.name}.mov`);
    if (!fs.existsSync(movPath)) return;
    inputs.push('-i', movPath);
    const inIdx = inputs.length / 2 - 1; // 0 is base, then sequence
    const ovLabel = `ov${i + 1}`;
    const next = `v${i + 1}`;
    ovParts.push(`[${inIdx}:v]setpts=PTS-STARTPTS+${b.start}/TB[${ovLabel}]`);
    ovParts.push(`[${lastLabel}][${ovLabel}]overlay=0:0:enable='between(t,${b.start},${b.end})'[${next}]`);
    lastLabel = next;
  });
  // Karaoke siempre activo (último en el chain — subs LAST)
  if (karaokeBeat && fs.existsSync(path.join(R, 'karaoke.mov'))) {
    inputs.push('-i', path.join(R, 'karaoke.mov'));
    const karIdx = inputs.length / 2 - 1;
    ovParts.push(`[${karIdx}:v]setpts=PTS-STARTPTS[kar]`);
    ovParts.push(`[${lastLabel}][kar]overlay=0:0:enable='between(t,0,${totalDur})'[vout]`);
  } else {
    ovParts.push(`[${lastLabel}]copy[vout]`);
  }
  const filterComplex = ovParts.join(';');

  await new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG, [
      ...inputs,
      '-filter_complex', filterComplex,
      '-map', '[vout]', '-map', '0:a',
      '-t', String(totalDur),
      '-r', '30',                                          // forzar 30fps en el output (compatibilidad navegadores + tamaño)
      '-c:v', 'h264_videotoolbox', '-b:v', '8M', '-tag:v', 'avc1',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
      '-movflags', '+faststart', '-pix_fmt', 'yuv420p',
      '-profile:v', 'main', '-level', '4.0',               // baseline-friendly
      finalPath, '-y',
    ]);
    let buf = '';
    proc.stderr.on('data', d => {
      buf += d.toString();
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        const m = line.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d+)/);
        if (m) {
          const seconds = (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]);
          const pct = Math.min(99, (seconds / totalDur) * 100);
          phaseProgress('composite', pct, { time_processed: seconds });
        }
      }
    });
    proc.on('exit', code => code === 0 ? resolve() : reject(new Error(`composite exited ${code}`)));
  });
  // Validación del output
  if (!fs.existsSync(finalPath)) throw new Error('composite: final.mp4 no se generó');
  const finalSize = fs.statSync(finalPath).size;
  if (finalSize < 100000) throw new Error(`composite: final.mp4 demasiado pequeño (${finalSize} bytes)`);
  phaseDone('composite', { output: finalPath, size_mb: (finalSize / 1024 / 1024).toFixed(1) });
  return finalPath;
}

async function phase7_deliver(finalPath) {
  phaseStart('deliver', 'Guardando en escritorio', { phase_idx: 7, total: TOTAL_PHASES });
  const desktopName = `divisual_${Date.now()}.mp4`;
  const desktopPath = path.join(require('os').homedir(), 'Desktop', desktopName);
  fs.copyFileSync(finalPath, desktopPath);
  phaseProgress('deliver', 60, { stage: 'desktop_copy' });
  // Frames de verificación
  const verifyDir = path.join(PROJECT_ROOT, 'output/verify');
  fs.mkdirSync(verifyDir, { recursive: true });
  const checkpoints = [2, 12, 24, 38, 50];
  for (let i = 0; i < checkpoints.length; i++) {
    try {
      execSync(`"${FFMPEG}" -ss ${checkpoints[i]} -i "${finalPath}" -vframes 1 -vf scale=720:-1 "${verifyDir}/check_${i}.png" -y -loglevel quiet`);
    } catch {}
  }
  phaseDone('deliver', {
    final_path: finalPath,
    desktop_path: desktopPath,
    verify_frames: checkpoints.map((_, i) => `output/verify/check_${i}.png`),
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  try {
    emit({ phase: 'pipeline', status: 'start', video: videoPath });
    const meta = await phase1_prepare();
    await phase2_transcribe();
    const tPath = path.join(PROJECT_ROOT, 'output', videoStem + '_transcript.json');
    let cleanData = null;
    {
      const cut = await phase3_cut(meta);
      cleanData = cut.clean;
    }
    await phase4_plan(meta, cleanData);
    await phase5_capture(meta, cleanData);
    const finalPath = await phase6_composite(meta, cleanData);
    await phase7_deliver(finalPath);
    emit({ phase: 'pipeline', status: 'done', final_path: finalPath });
    process.exit(0);
  } catch (err) {
    emit({ phase: 'pipeline', status: 'error', msg: err.message });
    process.exit(1);
  }
})();
