// server.ts — Dashboard backend (Bun)
//
// Endpoints:
//   GET  /                  → public/index.html
//   GET  /static/<path>     → archivos estáticos
//   POST /upload            → guarda vídeo en input/, devuelve {path}
//   POST /run               → arranca el pipeline; devuelve {jobId}
//   GET  /events/:jobId     → SSE: stream JSONL de progreso
//   GET  /video/:name       → sirve un MP4 desde output/
//   GET  /verify/:i         → sirve un PNG de verificación

import { spawn } from "node:child_process";
import { readFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join, extname } from "node:path";

const PROJECT_ROOT = "/Users/juanpenv/Desktop/divisual-video-editor-kit 2";
const PUBLIC_DIR = join(import.meta.dir, "public");
const INPUT_DIR = join(PROJECT_ROOT, "input");
const OUTPUT_DIR = join(PROJECT_ROOT, "output");
const VERIFY_DIR = join(OUTPUT_DIR, "verify");

mkdirSync(INPUT_DIR, { recursive: true });
mkdirSync(OUTPUT_DIR, { recursive: true });

// ── Job registry ──────────────────────────────────────────────────────────────
type Job = {
  id: string;
  videoPath: string;
  events: string[]; // each is a JSON line
  closed: boolean;
  subscribers: Set<ReadableStreamDefaultController<Uint8Array>>;
  startedAt: number;
};
const jobs = new Map<string, Job>();

function broadcast(job: Job, eventLine: string) {
  job.events.push(eventLine);
  const encoder = new TextEncoder();
  const data = encoder.encode(`data: ${eventLine}\n\n`);
  for (const ctrl of job.subscribers) {
    try { ctrl.enqueue(data); } catch { /* dead subscriber */ }
  }
}

function startPipeline(videoPath: string): Job {
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const job: Job = {
    id,
    videoPath,
    events: [],
    closed: false,
    subscribers: new Set(),
    startedAt: Date.now(),
  };
  jobs.set(id, job);

  const proc = spawn("node", [join(import.meta.dir, "scripts/pipeline.cjs"), videoPath], {
    env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` },
  });

  let buf = "";
  proc.stdout?.on("data", (chunk: Buffer) => {
    buf += chunk.toString();
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      if (line.trim()) broadcast(job, line);
    }
  });
  proc.stderr?.on("data", (chunk: Buffer) => {
    const msg = chunk.toString().trim();
    if (msg) broadcast(job, JSON.stringify({ phase: "stderr", msg }));
  });
  proc.on("exit", (code) => {
    if (buf.trim()) broadcast(job, buf.trim());
    broadcast(job, JSON.stringify({ phase: "pipeline", status: code === 0 ? "ended" : "failed", exit_code: code }));
    job.closed = true;
    // Close all SSE connections
    for (const ctrl of job.subscribers) {
      try { ctrl.close(); } catch {}
    }
    job.subscribers.clear();
  });

  return job;
}

// ── HTTP handlers ─────────────────────────────────────────────────────────────
function mimeFor(p: string): string {
  const ext = extname(p).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".mp4": "video/mp4",
    ".webp": "image/webp",
    ".woff2": "font/woff2",
  }[ext] || "application/octet-stream";
}

function serveFile(filePath: string): Response {
  if (!existsSync(filePath)) return new Response("Not found", { status: 404 });
  const stat = statSync(filePath);
  return new Response(Bun.file(filePath), {
    headers: {
      "Content-Type": mimeFor(filePath),
      "Content-Length": String(stat.size),
      "Cache-Control": "no-store",
    },
  });
}

const server = Bun.serve({
  port: 5191,
  idleTimeout: 0,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // ── Static index ────────────────────────────────────────────────────────
    if (path === "/" || path === "/index.html") {
      return serveFile(join(PUBLIC_DIR, "index.html"));
    }
    if (path.startsWith("/static/")) {
      return serveFile(join(PUBLIC_DIR, path.replace("/static/", "")));
    }

    // ── Upload ──────────────────────────────────────────────────────────────
    if (path === "/upload" && req.method === "POST") {
      const form = await req.formData();
      const file = form.get("video") as File | null;
      if (!file) return Response.json({ error: "No file" }, { status: 400 });
      const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const dest = join(INPUT_DIR, filename);
      await writeFile(dest, new Uint8Array(await file.arrayBuffer()));
      return Response.json({ path: dest, name: filename, size: file.size });
    }

    // ── Run ─────────────────────────────────────────────────────────────────
    if (path === "/run" && req.method === "POST") {
      const body = await req.json();
      if (!body.path || !existsSync(body.path)) {
        return Response.json({ error: "Invalid path" }, { status: 400 });
      }
      const job = startPipeline(body.path);
      return Response.json({ job_id: job.id });
    }

    // ── SSE events ──────────────────────────────────────────────────────────
    if (path.startsWith("/events/")) {
      const id = path.replace("/events/", "");
      const job = jobs.get(id);
      if (!job) return new Response("Unknown job", { status: 404 });
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          // Replay any events the client missed
          for (const line of job.events) {
            controller.enqueue(encoder.encode(`data: ${line}\n\n`));
          }
          if (job.closed) {
            controller.close();
            return;
          }
          job.subscribers.add(controller);
        },
        cancel(reason) {
          // remove subscriber
          for (const j of jobs.values()) j.subscribers.forEach(c => { /* no-op */ });
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // ── Video / verify frames ───────────────────────────────────────────────
    if (path.startsWith("/video/")) {
      const name = decodeURIComponent(path.replace("/video/", ""));
      const file = join(OUTPUT_DIR, name);
      if (!existsSync(file)) return new Response("Not found", { status: 404 });
      const stat = statSync(file);
      const range = req.headers.get("range");
      if (range) {
        const m = range.match(/bytes=(\d+)-(\d*)/);
        if (m) {
          const start = parseInt(m[1]);
          const end = m[2] ? parseInt(m[2]) : stat.size - 1;
          const slice = Bun.file(file).slice(start, end + 1);
          return new Response(slice, {
            status: 206,
            headers: {
              "Content-Range": `bytes ${start}-${end}/${stat.size}`,
              "Accept-Ranges": "bytes",
              "Content-Length": String(end - start + 1),
              "Content-Type": "video/mp4",
            },
          });
        }
      }
      return new Response(Bun.file(file), {
        headers: {
          "Content-Type": "video/mp4",
          "Content-Length": String(stat.size),
          "Accept-Ranges": "bytes",
        },
      });
    }
    if (path.startsWith("/verify/")) {
      const name = path.replace("/verify/", "");
      return serveFile(join(VERIFY_DIR, name));
    }
    if (path === "/logo.png") {
      return serveFile(join(PROJECT_ROOT, "brand/logo/logo-white.png"));
    }
    if (path === "/reveal" && req.method === "POST") {
      const body = await req.json() as { path?: string };
      if (body.path && existsSync(body.path)) {
        spawn("open", ["-R", body.path]);
        return Response.json({ ok: true });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Divisual Dashboard → http://localhost:${server.port}`);
