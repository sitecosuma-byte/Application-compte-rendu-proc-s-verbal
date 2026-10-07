"use client";
/**
 * Enregistreur audio basé sur MediaRecorder + Web Audio API.
 *
 * Deux enregistreurs tournent en parallèle sur le même flux micro :
 *  1. « Archive »  : un enregistrement continu de toute la séance (sauvegardé dans IndexedDB).
 *  2. « Segments » : (facultatif) des fichiers autonomes de N secondes envoyés au fur et à mesure
 *     à Whisper / Groq pour une transcription quasi temps réel. Chaque segment est un fichier
 *     complet (avec en-tête), donc décodable indépendamment.
 *
 * Un AnalyserNode (Web Audio API) fournit un vu-mètre pour vérifier que le micro choisi
 * (interne, USB, Jack, Bluetooth) capte bien le son.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus = "idle" | "starting" | "recording" | "paused" | "stopping";

export interface Recording {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

export interface RecorderOptions {
  deviceId?: string;
  /** Si défini, active la segmentation et appelle ce callback avec chaque segment. */
  onSegment?: (blob: Blob, mimeType: string) => void;
  segmentSeconds?: number;
  /** Traitements du navigateur (désactivez-les pour un micro de conférence de qualité). */
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

/** Choisit le meilleur format supporté (Chrome/Android : webm/opus ; Safari/iOS : mp4). */
export function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export function extensionFor(mimeType: string): string {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

export function useAudioRecorder(options: RecorderOptions) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const optsRef = useRef(options);
  optsRef.current = options;

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const archiveRef = useRef<MediaRecorder | null>(null);
  const archiveChunks = useRef<Blob[]>([]);
  const segmentRef = useRef<MediaRecorder | null>(null);
  const segmentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const segmentingActive = useRef(false);
  const mimeRef = useRef("");
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  // Chronomètre (exclut les pauses)
  const startedAt = useRef(0);
  const accumulated = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ---------------- Vu-mètre ---------------- */
  const startMeter = (stream: MediaStream) => {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    audioCtxRef.current = ctx;
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);
    const data = new Float32Array(analyser.fftSize);
    let last = 0;
    const loop = (t: number) => {
      analyser.getFloatTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / data.length);
      if (t - last > 60) {
        setLevel(Math.min(1, rms * 4));
        last = t;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const stopMeter = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    setLevel(0);
  };

  /* ---------------- Segments pour la transcription ---------------- */
  const startSegment = useCallback(() => {
    const stream = streamRef.current;
    const { onSegment, segmentSeconds = 30 } = optsRef.current;
    if (!stream || !onSegment || !segmentingActive.current) return;

    const mimeType = mimeRef.current;
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const parts: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size > 0 && parts.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(parts, { type: rec.mimeType || mimeType });
      // Ignore les fragments quasi vides (< 2 Ko)
      if (blob.size > 2048) optsRef.current.onSegment?.(blob, blob.type);
      if (segmentingActive.current) startSegment();
    };
    rec.start();
    segmentRef.current = rec;
    segmentTimer.current = setTimeout(() => {
      if (rec.state !== "inactive") rec.stop();
    }, segmentSeconds * 1000);
  }, []);

  const flushSegment = () => {
    if (segmentTimer.current) clearTimeout(segmentTimer.current);
    segmentTimer.current = null;
    const rec = segmentRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    segmentRef.current = null;
  };

  /* ---------------- Chronomètre ---------------- */
  const startClock = () => {
    startedAt.current = performance.now();
    tickRef.current = setInterval(
      () => setElapsedMs(accumulated.current + performance.now() - startedAt.current),
      250,
    );
  };
  const stopClock = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    accumulated.current += performance.now() - startedAt.current;
    setElapsedMs(accumulated.current);
  };

  /* ---------------- Verrou d'écran (smartphones) ---------------- */
  const acquireWakeLock = async () => {
    try {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
      };
      wakeLockRef.current = (await nav.wakeLock?.request("screen")) ?? null;
    } catch {
      /* non supporté : ignoré */
    }
  };
  const releaseWakeLock = () => {
    wakeLockRef.current?.release().catch(() => undefined);
    wakeLockRef.current = null;
  };

  /* ---------------- API publique ---------------- */
  const start = useCallback(async () => {
    setError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("L'enregistrement audio n'est pas supporté par ce navigateur.");
      return false;
    }
    setStatus("starting");
    const o = optsRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: o.deviceId && o.deviceId !== "default" ? { exact: o.deviceId } : undefined,
          echoCancellation: o.echoCancellation ?? true,
          noiseSuppression: o.noiseSuppression ?? true,
          autoGainControl: o.autoGainControl ?? true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;
      mimeRef.current = pickMimeType();

      // Si le micro est débranché pendant l'enregistrement
      stream.getAudioTracks()[0]?.addEventListener("ended", () => {
        setError("Le microphone a été déconnecté. Enregistrement interrompu — l'audio capté est conservé.");
      });

      startMeter(stream);

      archiveChunks.current = [];
      const archive = new MediaRecorder(
        stream,
        mimeRef.current ? { mimeType: mimeRef.current, audioBitsPerSecond: 64000 } : undefined,
      );
      archive.ondataavailable = (e) => e.data.size > 0 && archiveChunks.current.push(e.data);
      archive.start(1000);
      archiveRef.current = archive;

      segmentingActive.current = !!o.onSegment;
      startSegment();

      accumulated.current = 0;
      setElapsedMs(0);
      startClock();
      acquireWakeLock();
      setStatus("recording");
      return true;
    } catch (e) {
      setStatus("idle");
      const err = e as Error;
      setError(
        err.name === "NotAllowedError"
          ? "Accès au micro refusé."
          : err.name === "OverconstrainedError" || err.name === "NotFoundError"
            ? "Le microphone sélectionné est introuvable. Rebranchez-le ou choisissez-en un autre."
            : `Erreur micro : ${err.message}`,
      );
      return false;
    }
  }, [startSegment]);

  const pause = useCallback(() => {
    if (archiveRef.current?.state !== "recording") return;
    archiveRef.current.pause();
    segmentingActive.current = false;
    flushSegment(); // envoie immédiatement le segment en cours à la transcription
    stopClock();
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    if (archiveRef.current?.state !== "paused") return;
    archiveRef.current.resume();
    segmentingActive.current = !!optsRef.current.onSegment;
    startSegment();
    startClock();
    setStatus("recording");
  }, [startSegment]);

  const stop = useCallback(async (): Promise<Recording | null> => {
    const archive = archiveRef.current;
    if (!archive) return null;
    setStatus("stopping");
    segmentingActive.current = false;
    flushSegment();
    if (tickRef.current) stopClock();

    const recording = await new Promise<Recording>((resolve) => {
      archive.onstop = () => {
        const type = archive.mimeType || mimeRef.current || "audio/webm";
        resolve({
          blob: new Blob(archiveChunks.current, { type }),
          mimeType: type,
          durationMs: accumulated.current,
        });
      };
      if (archive.state !== "inactive") archive.stop();
      else archive.onstop?.(new Event("stop"));
    });

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    archiveRef.current = null;
    stopMeter();
    releaseWakeLock();
    setStatus("idle");
    return recording;
  }, []);

  // Nettoyage si le composant est démonté en cours d'enregistrement
  useEffect(
    () => () => {
      segmentingActive.current = false;
      if (segmentTimer.current) clearTimeout(segmentTimer.current);
      if (tickRef.current) clearInterval(tickRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      stopMeter();
      releaseWakeLock();
    },
    [],
  );

  return { status, elapsedMs, level, error, start, pause, resume, stop };
}
