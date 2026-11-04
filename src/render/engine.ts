// Motor de exportación: dibuja cada fotograma de forma determinista en un
// canvas, los guarda como JPEG en el FS en memoria de FFmpeg y los codifica a
// MP4 (H.264 + AAC) junto con el audio elegido. Todo corre en el navegador.
//
// No usa MediaRecorder: el render fotograma a fotograma no depende de la
// velocidad del dispositivo y permite mezclar audio con duración exacta.

import type { FFmpeg } from "@ffmpeg/ffmpeg";
import type { TemplateContent, TemplateDefinition } from "../templates/types";
import type { ResolvedAudio } from "../audio/library";
import { produceFrames } from "./frames";
import { frameSize } from "./frame";
import { CompiledMedia, mediaUrl } from "./mediaAccess";
import { hasVideoScenes } from "../templates/compiled";
import { HOLD_SECONDS, OUTRO_SECONDS } from "../templates/outro";
import { loadFonts } from "./assets";
import { loadTemplateAssets } from "../templates/assets";

export type Phase = "prepare" | "frames" | "audio" | "encode" | "finish";

export type Progress = {
  phase: Phase;
  /** progreso real 0..1 del conjunto; nunca llega a 1 antes de terminar */
  overall: number;
};

export class ExportError extends Error {
  constructor(
    message: string,
    readonly kind:
      | "unsupported"
      | "resources"
      | "audio"
      | "aborted"
      | "unknown" = "unknown",
  ) {
    super(message);
    this.name = "ExportError";
  }
}

// pesos de cada fase dentro del progreso total
const WEIGHTS: Record<Exclude<Phase, "finish">, [number, number]> = {
  prepare: [0, 0.08],
  frames: [0.08, 0.5],
  audio: [0.5, 0.54],
  encode: [0.54, 0.99],
};

let ffmpeg: FFmpeg | null = null;
let busy = false;

export function isExporting() {
  return busy;
}

export const MOBILE_NOTICE =
  "Estás en un celular. Te recomendamos crear el video desde una computadora: acá puede tardar bastante más (según tu equipo) y conviene dejar la pantalla encendida y esta pestaña abierta hasta que termine.";

export function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (window.matchMedia?.("(pointer: coarse)").matches &&
      window.innerWidth < 820)
  );
}

export function checkSupport():
  | { ok: true; warning?: string }
  | { ok: false; reason: string } {
  if (typeof WebAssembly === "undefined" || typeof Worker === "undefined") {
    return {
      ok: false,
      reason:
        "Tu navegador no soporta WebAssembly o Web Workers. Probá con una versión actualizada de Chrome, Edge, Firefox o Safari.",
    };
  }
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (mem !== undefined && mem < 2) {
    return {
      ok: true,
      warning:
        "Tu dispositivo tiene poca memoria. Cerrá otras pestañas y aplicaciones antes de crear el video; si falla, probá desde una computadora.",
    };
  }
  // aviso de celular desactivado por ahora (el tiempo en el celular ya es razonable); se conserva el de poca memoria
  // if (isMobileDevice()) return {ok: true, warning: MOBILE_NOTICE};
  return { ok: true };
}

async function loadFFmpeg() {
  if (ffmpeg) return ffmpeg;
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const instance = new FFmpeg();
  await instance.load({
    // Archivos locales copiados de @ffmpeg/core en `postinstall` (public/ffmpeg).
    // El núcleo es de un solo hilo, así que no exige COOP/COEP ni SharedArrayBuffer.
    coreURL: "/ffmpeg/ffmpeg-core.js",
    wasmURL: "/ffmpeg/ffmpeg-core.wasm",
  });
  ffmpeg = instance;
  return instance;
}

function releaseFFmpeg() {
  try {
    ffmpeg?.terminate(); // libera la memoria WebAssembly y el worker
  } catch {
    /* ya estaba terminado */
  }
  ffmpeg = null;
}

type EngineOptions = {
  template: TemplateDefinition;
  content: TemplateContent;
  audio: ResolvedAudio;
  /** solo lo establecen exportPreview (true) y exportFinal (false) */
  watermark: boolean;
  scale: number;
  /** fotogramas por segundo de salida (por defecto, los de la plantilla) */
  fps?: number;
  /** calidad JPEG de los fotogramas intermedios (por defecto 0,9) */
  quality?: number;
  crf: number;
  preset: string;
  signal?: AbortSignal;
  onProgress?: (p: Progress) => void;
};

function mapProgress(phase: Exclude<Phase, "finish">, frac: number) {
  const [a, b] = WEIGHTS[phase];
  return a + (b - a) * Math.min(1, Math.max(0, frac));
}

function describeFailure(e: unknown): ExportError {
  if (e instanceof ExportError) return e;
  const msg = e instanceof Error ? e.message : String(e);
  if (/memory|abort|RangeError|oom|alloc/i.test(msg)) {
    return new ExportError(
      "Tu dispositivo se quedó sin memoria al crear el video. Cerrá otras pestañas y aplicaciones e intentá de nuevo, o usá una computadora.",
      "resources",
    );
  }
  return new ExportError("No pudimos crear el video: " + msg, "unknown");
}

export async function runEngine(o: EngineOptions): Promise<Blob> {
  if (busy)
    throw new ExportError(
      "Ya hay un video creándose. Esperá a que termine.",
      "unknown",
    );
  const support = checkSupport();
  if (!support.ok) throw new ExportError(support.reason, "unsupported");
  busy = true;

  const { template, content, audio, signal } = o;
  const report = (phase: Phase, overall: number) =>
    o.onProgress?.({ phase, overall: Math.min(0.99, overall) });
  const written: string[] = [];
  const fps = o.fps ?? template.fps;
  const total = Math.round(template.duration * fps);
  const check = () => {
    if (signal?.aborted)
      throw new ExportError("La creación fue cancelada.", "aborted");
  };

  try {
    report("prepare", 0);
    await loadFonts([...template.fonts, "Montserrat"]);
    await loadTemplateAssets(template);
    check();
    const ff = await loadFFmpeg();
    report("prepare", mapProgress("prepare", 0.7));
    check();

    // ---- medios de los videos compilados ----
    const spec = template.spec;
    const overlay = !!spec && hasVideoScenes(spec); // fondos de video: FFmpeg superpone las capas
    const media = spec ? await CompiledMedia.load(spec, "none") : null;
    if (spec && overlay) {
      for (const sc of spec.scenes) {
        if (sc.bg.kind !== "video") continue;
        const fname = `v_${sc.bg.mediaId}.mp4`;
        if (written.includes(fname)) continue;
        const res = await fetch(mediaUrl(sc.bg.mediaId));
        if (!res.ok)
          throw new ExportError(
            "No pudimos cargar uno de los videos de esta plantilla.",
            "unknown",
          );
        await ff.writeFile(fname, new Uint8Array(await res.arrayBuffer()));
        written.push(fname);
        check();
      }
    }
    const ext = overlay ? "png" : "jpg";

    // ---- fotogramas (Worker con OffscreenCanvas; respaldo en el hilo principal) ----
    let done = 0;
    try {
      await produceFrames({
        template,
        content,
        watermark: o.watermark,
        scale: o.scale,
        total,
        fps,
        quality: o.quality ?? 0.9,
        signal,
        format: overlay ? "png" : "jpeg",
        overlayOnly: overlay,
        media,
        onFrame: async (i, bytes) => {
          check();
          const name = `f${String(i).padStart(4, "0")}.${ext}`;
          await ff.writeFile(name, bytes);
          written.push(name);
          done++;
          report("frames", mapProgress("frames", done / total));
        },
      });
    } finally {
      media?.dispose();
    }

    // ---- audio ----
    report("audio", mapProgress("audio", 0));
    let audioName: string | null = null;
    if (audio.kind !== "none") {
      try {
        const res = await fetch(audio.url);
        if (!res.ok) throw new Error("HTTP " + res.status);
        audioName = `audio.${audio.ext.replace(/[^a-z0-9]/gi, "") || "wav"}`;
        await ff.writeFile(audioName, new Uint8Array(await res.arrayBuffer()));
        written.push(audioName);
      } catch {
        throw new ExportError(
          "No pudimos leer el audio elegido. Probá con otro archivo o con un sonido de la biblioteca.",
          "audio",
        );
      }
    }
    check();

    // ---- codificación ----
    const dur = template.duration;
    const onProg = ({ time }: { progress: number; time: number }) => {
      // `time` es el tiempo de salida procesado, en microsegundos
      report("encode", mapProgress("encode", time / (dur * 1_000_000)));
    };
    const onLog = ({ message }: { message: string }) => {
      if (process.env.NODE_ENV !== "production")
        console.debug("[ffmpeg]", message);
    };
    ff.on("progress", onProg);
    ff.on("log", onLog);
    const abortHandler = () => releaseFFmpeg();
    signal?.addEventListener("abort", abortHandler);
    try {
      const audioInput = audioName
        ? ["-stream_loop", "-1", "-i", audioName]
        : ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"];
      let inputs: string[];
      let maps: string[];
      if (spec && overlay) {
        // un fondo por escena (video o negro) → se concatenan → se superponen las capas dibujadas
        const { width: Wd, height: Hd } = frameSize(o.scale);
        const ins: string[] = [];
        const chains: string[] = [];
        spec.scenes.forEach((sc, k) => {
          // la última escena se alarga lo que se sostiene su imagen final
          const len =
            sc.duration + (k === spec.scenes.length - 1 ? HOLD_SECONDS : 0);
          if (sc.bg.kind === "video")
            ins.push(
              "-stream_loop",
              "-1",
              "-t",
              String(len),
              "-i",
              `v_${sc.bg.mediaId}.mp4`,
            );
          else
            ins.push(
              "-f",
              "lavfi",
              "-t",
              String(len),
              "-i",
              `color=c=black:s=${Wd}x${Hd}:r=${fps}`,
            );
          chains.push(
            `[${k}:v]scale=${Wd}:${Hd}:force_original_aspect_ratio=increase,crop=${Wd}:${Hd},fps=${fps},setsar=1,format=yuv420p,setpts=PTS-STARTPTS[b${k}]`,
          );
        });
        // la pantalla final de AltaParty (negra) también necesita fondo debajo de sus capas
        const n = spec.scenes.length + 1;
        ins.push(
          "-f",
          "lavfi",
          "-t",
          String(OUTRO_SECONDS),
          "-i",
          `color=c=black:s=${Wd}x${Hd}:r=${fps}`,
        );
        chains.push(
          `[${n - 1}:v]fps=${fps},setsar=1,format=yuv420p,setpts=PTS-STARTPTS[b${n - 1}]`,
        );
        ins.push("-framerate", String(fps), "-i", "f%04d.png", ...audioInput);
        const graph = `${chains.join(";")};${chains.map((_, k) => `[b${k}]`).join("")}concat=n=${n}:v=1:a=0[bg];[bg][${n}:v]overlay=0:0:format=auto,format=yuv420p[out]`;
        inputs = [...ins, "-filter_complex", graph];
        maps = ["-map", "[out]", "-map", `${n + 1}:a:0`];
      } else {
        inputs = ["-framerate", String(fps), "-i", "f%04d.jpg", ...audioInput];
        maps = ["-map", "0:v:0", "-map", "1:a:0"];
      }
      const args = [
        ...inputs,
        ...maps,
        "-t",
        String(dur),
        "-c:v",
        "libx264",
        "-preset",
        o.preset,
        "-crf",
        String(o.crf),
        "-pix_fmt",
        "yuv420p",
        "-r",
        String(fps),
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-ar",
        "44100",
        "-ac",
        "2",
        ...(audioName
          ? [
              "-af",
              `afade=t=in:d=0.15,afade=t=out:st=${Math.max(0, (template.audioEnd ?? dur) - 1.2)}:d=1.2`,
            ]
          : []),
        "-movflags",
        "+faststart",
        "out.mp4",
      ];
      const code = await ff.exec(args);
      check();
      if (code !== 0) {
        throw new ExportError(
          audioName && audio.kind === "file"
            ? "FFmpeg no pudo procesar tu audio. Probá con un MP3 o WAV estándar."
            : "FFmpeg terminó con un error al codificar el video.",
          audioName && audio.kind === "file" ? "audio" : "unknown",
        );
      }
      written.push("out.mp4");
    } finally {
      ff.off("progress", onProg);
      ff.off("log", onLog);
      signal?.removeEventListener("abort", abortHandler);
    }

    report("finish", 0.99);
    const data = (await ff.readFile("out.mp4")) as Uint8Array;
    const out = new Blob([new Uint8Array(data)], { type: "video/mp4" });
    if (out.size < 1024)
      throw new ExportError("El video creado está vacío.", "unknown");
    return out;
  } catch (e) {
    throw describeFailure(e);
  } finally {
    // limpieza: archivos temporales y memoria WebAssembly
    releaseFFmpeg();
    written.length = 0;
    busy = false;
  }
}
