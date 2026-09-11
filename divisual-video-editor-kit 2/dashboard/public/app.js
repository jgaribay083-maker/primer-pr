// app.js — Frontend logic for Divisual Dashboard
//
// State machine: idle → uploading → processing → success | error

const PHASES = [
  { id: "prepare",    label: "Análisis del vídeo",        icon: "1", weight: 0.5 },
  { id: "transcribe", label: "Transcribiendo audio",       icon: "2", weight: 1.5 },
  { id: "cut",        label: "Recortando fillers",         icon: "3", weight: 4 },
  { id: "plan",       label: "Diseñando motion graphics",  icon: "4", weight: 0.4 },
  { id: "capture",    label: "Renderizando overlays",      icon: "5", weight: 80 },
  { id: "composite",  label: "Compositing final",          icon: "6", weight: 12 },
  { id: "deliver",    label: "Entregando",                 icon: "7", weight: 1 },
];

const TOTAL_WEIGHT = PHASES.reduce((a, p) => a + p.weight, 0);

const els = {
  idle: document.getElementById("state-idle"),
  processing: document.getElementById("state-processing"),
  success: document.getElementById("state-success"),
  error: document.getElementById("state-error"),
  errorMsg: document.getElementById("error-msg"),
  errorRestart: document.getElementById("error-restart"),
  drop: document.getElementById("drop-zone"),
  fileInput: document.getElementById("file-input"),
  procTitle: document.getElementById("proc-title"),
  procMeta: document.getElementById("proc-meta"),
  countdown: document.getElementById("countdown"),
  countdownSub: document.getElementById("countdown-sub"),
  currentAction: document.getElementById("current-action"),
  currentDetail: document.getElementById("current-detail"),
  overallBar: document.getElementById("overall-bar"),
  overallPct: document.getElementById("overall-pct"),
  overallElapsed: document.getElementById("overall-elapsed"),
  phasesRoot: document.getElementById("phases"),
  log: document.getElementById("log"),
  statusPill: document.getElementById("status-pill"),
  statusPillText: document.getElementById("status-pill-text"),
  resultVideo: document.getElementById("result-video"),
  downloadBtn: document.getElementById("download-btn"),
  revealBtn: document.getElementById("reveal-btn"),
  restartBtn: document.getElementById("restart-btn"),
  resultDetails: document.getElementById("result-details"),
  verifyFrames: document.getElementById("verify-frames"),
};

function showState(name) {
  ["idle", "processing", "success", "error"].forEach(s => {
    els[s].classList.toggle("hidden", s !== name);
  });
  els.statusPill.classList.toggle("hidden", name !== "processing");
}

// ── Drop zone ─────────────────────────────────────────────────────────────────
function setupDropzone() {
  const dz = els.drop;
  dz.addEventListener("click", () => els.fileInput.click());
  dz.addEventListener("dragover", e => {
    e.preventDefault();
    dz.classList.add("drop-zone-active");
  });
  dz.addEventListener("dragleave", () => dz.classList.remove("drop-zone-active"));
  dz.addEventListener("drop", e => {
    e.preventDefault();
    dz.classList.remove("drop-zone-active");
    if (e.dataTransfer?.files?.[0]) handleFile(e.dataTransfer.files[0]);
  });
  els.fileInput.addEventListener("change", () => {
    if (els.fileInput.files?.[0]) handleFile(els.fileInput.files[0]);
  });
}

async function handleFile(file) {
  if (!file.type.startsWith("video/") && !file.name.match(/\.(mp4|mov)$/i)) {
    alert("Sube un MP4 o MOV.");
    return;
  }
  els.procTitle.textContent = file.name;
  els.procMeta.textContent = humanSize(file.size);
  showState("processing");
  renderPhases();
  appendLog("info", `Subiendo ${file.name} (${humanSize(file.size)})…`);

  const form = new FormData();
  form.append("video", file);
  let uploadResp;
  try {
    uploadResp = await fetch("/upload", { method: "POST", body: form }).then(r => r.json());
  } catch (e) {
    showError("No se pudo subir el archivo.");
    return;
  }
  if (uploadResp.error) return showError(uploadResp.error);
  appendLog("info", `Vídeo en input/. Arrancando pipeline…`);

  const runResp = await fetch("/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: uploadResp.path }),
  }).then(r => r.json());
  if (runResp.error) return showError(runResp.error);

  subscribeToJob(runResp.job_id);
}

// ── Phases UI ────────────────────────────────────────────────────────────────
function renderPhases() {
  els.phasesRoot.innerHTML = PHASES.map(p => `
    <div class="phase-row" data-id="${p.id}">
      <div class="phase-icon">${p.icon}</div>
      <div class="flex-grow min-w-0">
        <div class="font-display font-semibold text-[15px] truncate">${p.label}</div>
        <div class="phase-bar mt-1.5"><div></div></div>
      </div>
      <div class="phase-meta">○</div>
    </div>
  `).join("");
}

function setPhaseStatus(phase, status, percent, meta) {
  const row = els.phasesRoot.querySelector(`[data-id="${phase}"]`);
  if (!row) return;
  row.classList.remove("active", "done", "error");
  if (status === "active") row.classList.add("active");
  if (status === "done") row.classList.add("done");
  if (status === "error") row.classList.add("error");
  const icon = row.querySelector(".phase-icon");
  if (status === "done") {
    icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  }
  if (status === "active") {
    const def = PHASES.find(p => p.id === phase);
    icon.textContent = def?.icon || "·";
  }
  const bar = row.querySelector(".phase-bar > div");
  if (typeof percent === "number") bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  if (status === "done") bar.style.width = "100%";
  const metaEl = row.querySelector(".phase-meta");
  if (status === "done" && meta?.duration_s != null) metaEl.textContent = `${meta.duration_s}s`;
  else if (status === "active" && typeof percent === "number") metaEl.textContent = `${percent.toFixed(0)}%`;
  else if (status === "pending") metaEl.textContent = "○";
}

// ── Estimation ───────────────────────────────────────────────────────────────
const phaseTimes = {}; // phase → {start, end}
const captureRate = { framesPerSec: null }; // updated live

function updateOverall() {
  let totalProgress = 0;
  for (const p of PHASES) {
    const t = phaseTimes[p.id];
    let pct = 0;
    if (t?.end) pct = 1;
    else if (t?.percent != null) pct = t.percent / 100;
    totalProgress += (pct * p.weight) / TOTAL_WEIGHT;
  }
  totalProgress = Math.max(0, Math.min(1, totalProgress));
  const pctNum = totalProgress * 100;
  els.overallBar.style.width = `${pctNum}%`;
  els.overallPct.textContent = `${pctNum.toFixed(0)}%`;

  // Elapsed
  const elapsedMs = Date.now() - (phaseTimes._jobStart || Date.now());
  const elapsedSec = Math.floor(elapsedMs / 1000);
  els.overallElapsed.textContent = `${formatDuration(elapsedSec)} transcurridos`;

  // ETA: based on observed rate during capture, else weighted estimate
  let etaSec;
  if (captureRate.framesPerSec && phaseTimes.capture && !phaseTimes.capture.end) {
    const remCapFrames = (phaseTimes.capture.framesTotal || 0) - (phaseTimes.capture.framesDone || 0);
    const remCapSec = remCapFrames / captureRate.framesPerSec;
    // Add weighted estimate for remaining post-capture phases
    const postWeight = PHASES.filter(p => ["composite", "deliver"].includes(p.id)).reduce((a, p) => a + p.weight, 0);
    const captureWeight = PHASES.find(p => p.id === "capture").weight;
    const postSec = (remCapSec / captureWeight) * postWeight;
    etaSec = remCapSec + postSec;
  } else if (totalProgress > 0.01) {
    const totalEstMs = elapsedMs / totalProgress;
    etaSec = Math.max(0, (totalEstMs - elapsedMs) / 1000);
  }
  if (etaSec != null && isFinite(etaSec)) {
    els.countdown.textContent = formatDuration(Math.ceil(etaSec));
    els.countdownSub.textContent = etaSec > 60 ? "estimación viva, se ajusta sola" : "casi listo";
  }
}

function formatDuration(sec) {
  if (sec < 0) sec = 0;
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function humanSize(bytes) {
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (bytes >= 1024 && i < u.length - 1) { bytes /= 1024; i++; }
  return `${bytes.toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

// ── SSE consumer ─────────────────────────────────────────────────────────────
function subscribeToJob(jobId) {
  phaseTimes._jobStart = Date.now();
  const overallTick = setInterval(updateOverall, 1000);

  const es = new EventSource(`/events/${jobId}`);
  es.onmessage = (e) => {
    let evt;
    try { evt = JSON.parse(e.data); } catch { return; }
    handleEvent(evt);
  };
  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED) clearInterval(overallTick);
  };
}

function handleEvent(evt) {
  const { phase, status } = evt;

  // Pipeline-level events
  if (phase === "pipeline") {
    if (status === "start") appendLog("phase", `▶ Pipeline iniciado`);
    if (status === "ended") {
      appendLog("done", `✔ Pipeline terminado`);
    }
    if (status === "failed") {
      appendLog("err", `✕ Pipeline falló (exit ${evt.exit_code})`);
      showError("El pipeline falló. Mira el log.");
    }
    if (status === "error") {
      appendLog("err", `✕ ${evt.msg}`);
      showError(evt.msg);
    }
    if (status === "done") {
      onPipelineDone(evt);
    }
    return;
  }

  if (phase === "stderr") {
    appendLog("info", evt.msg.slice(0, 200));
    return;
  }

  // Phase-level events
  const def = PHASES.find(p => p.id === phase);
  if (!def) return;

  if (status === "start") {
    phaseTimes[phase] = { start: Date.now(), percent: 0 };
    setPhaseStatus(phase, "active", 0);
    els.currentAction.textContent = evt.label || def.label;
    els.statusPillText.textContent = def.label;
    els.currentDetail.textContent = "";
    appendLog("phase", `→ ${evt.label || def.label}`);

    // Mark previous phases as done if not already
    let i = PHASES.findIndex(p => p.id === phase);
    for (let k = 0; k < i; k++) {
      const prev = PHASES[k];
      if (!phaseTimes[prev.id]?.end) {
        phaseTimes[prev.id] = { ...(phaseTimes[prev.id] || {}), end: Date.now(), percent: 100 };
        setPhaseStatus(prev.id, "done", 100, { duration_s: phaseTimes[prev.id]?.duration_s });
      }
    }

    // Resolution badge from prepare
    if (evt.video) {
      els.procMeta.textContent = `${evt.video.w}×${evt.video.h} · ${evt.video.aspect} · ${evt.video.fps}fps`;
    }
  }

  if (status === "progress") {
    if (!phaseTimes[phase]) phaseTimes[phase] = { start: Date.now() };
    if (typeof evt.percent === "number") {
      phaseTimes[phase].percent = evt.percent;
      setPhaseStatus(phase, "active", evt.percent);
    }
    // Detail line
    const detail = formatDetail(phase, evt);
    if (detail) els.currentDetail.textContent = detail;

    // Capture rate tracking for ETA
    if (phase === "capture" && evt.frames_done && evt.frames_total) {
      phaseTimes.capture.framesDone = evt.frames_done;
      phaseTimes.capture.framesTotal = evt.frames_total;
      const elapsed = (Date.now() - phaseTimes.capture.start) / 1000;
      if (elapsed > 5) {
        captureRate.framesPerSec = evt.frames_done / elapsed;
      }
    }
  }

  if (status === "complete") {
    if (!phaseTimes[phase]) phaseTimes[phase] = {};
    phaseTimes[phase].end = Date.now();
    phaseTimes[phase].duration_s = evt.duration_s;
    phaseTimes[phase].percent = 100;
    setPhaseStatus(phase, "done", 100, evt);
    appendLog("done", `✔ ${def.label} (${evt.duration_s}s)`);

    // Detail line for prepare phase: meta info
    if (phase === "prepare" && evt.meta) {
      els.procMeta.textContent = `${evt.meta.w}×${evt.meta.h} · ${evt.meta.aspect} · ${evt.meta.fps}fps`;
    }
  }

  updateOverall();
}

function formatDetail(phase, evt) {
  if (phase === "transcribe") {
    if (evt.stage === "audio_extract") return "Extrayendo audio…";
    if (evt.stage === "upload") return "Subiendo a ElevenLabs Scribe…";
    if (evt.stage === "received") return "Procesando palabras…";
  }
  if (phase === "cut") {
    if (evt.stage === "concat") return "Concatenando segmentos validados";
    if (evt.current) return evt.current;
    if (evt.label) return evt.label;
  }
  if (phase === "capture") {
    return `${evt.current || "—"} · ${evt.frames_done || 0}/${evt.frames_total || 0} frames · beat ${(evt.done_beats || 0)+1}/${evt.total_beats || 8}`;
  }
  if (phase === "composite") {
    return evt.time_processed != null ? `procesado ${evt.time_processed.toFixed(1)}s del vídeo` : "";
  }
  return "";
}

// ── Pipeline done ────────────────────────────────────────────────────────────
function onPipelineDone(evt) {
  // Mark all phases done just in case
  for (const p of PHASES) {
    if (!phaseTimes[p.id]?.end) {
      phaseTimes[p.id] = { ...(phaseTimes[p.id] || {}), end: Date.now(), percent: 100 };
      setPhaseStatus(p.id, "done", 100);
    }
  }
  els.overallBar.style.width = "100%";
  els.overallPct.textContent = "100%";

  const finalPath = evt.final_path;
  const fileName = finalPath.split("/").pop();
  const videoUrl = `/video/${encodeURIComponent(fileName)}`;
  els.resultVideo.src = videoUrl;
  els.downloadBtn.href = videoUrl;
  els.downloadBtn.download = fileName;

  // Details
  const elapsedMs = Date.now() - (phaseTimes._jobStart || Date.now());
  els.resultDetails.innerHTML = `
    <div class="flex justify-between"><dt class="text-brand-text-soft">Archivo</dt><dd class="font-mono text-brand-yellow text-xs truncate ml-2">${fileName}</dd></div>
    <div class="flex justify-between"><dt class="text-brand-text-soft">Tiempo total</dt><dd class="font-mono">${formatDuration(Math.floor(elapsedMs/1000))}</dd></div>
    <div class="flex justify-between"><dt class="text-brand-text-soft">Guardado en</dt><dd class="font-mono text-xs">~/Desktop</dd></div>
  `;

  els.revealBtn.onclick = () => {
    fetch("/reveal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: finalPath }) }).catch(() => {});
  };

  // Verify frames
  els.verifyFrames.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    const url = `/verify/check_${i}.png?ts=${Date.now()}`;
    const wrap = document.createElement("div");
    wrap.className = "verify-thumb";
    wrap.innerHTML = `<img src="${url}" alt="frame ${i}" loading="lazy">`;
    els.verifyFrames.appendChild(wrap);
  }

  showState("success");
}

// ── Log ──────────────────────────────────────────────────────────────────────
function appendLog(kind, msg) {
  const div = document.createElement("div");
  div.className = `log-line ${kind}`;
  const t = new Date();
  const ts = `${t.getHours().toString().padStart(2,"0")}:${t.getMinutes().toString().padStart(2,"0")}:${t.getSeconds().toString().padStart(2,"0")}`;
  div.innerHTML = `<span class="log-time">${ts}</span>${msg.replace(/[<>]/g, c => ({"<":"&lt;",">":"&gt;"}[c]))}`;
  els.log.appendChild(div);
  els.log.scrollTop = els.log.scrollHeight;
  // Keep last 200 lines
  while (els.log.children.length > 200) els.log.removeChild(els.log.firstChild);
}

// ── Error handling ───────────────────────────────────────────────────────────
function showError(msg) {
  els.errorMsg.textContent = msg;
  showState("error");
}

els.errorRestart.addEventListener("click", () => location.reload());
els.restartBtn?.addEventListener("click", () => location.reload());

setupDropzone();
showState("idle");
renderPhases();
