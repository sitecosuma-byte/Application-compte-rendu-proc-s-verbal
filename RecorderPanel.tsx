"use client";
/**
 * Panneau d'enregistrement : choix du micro, du moteur de transcription,
 * contrôles Démarrer / Pause / Reprendre / Arrêter, import de fichier audio,
 * et liste des enregistrements archivés localement.
 */
import {
  AlertTriangle,
  Download,
  FileAudio,
  Loader2,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Square,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import AudioSourceSelector from "./AudioSourceSelector";
import { extensionFor, useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { transcribeBlob } from "@/lib/api";
import { splitAudioFile } from "@/lib/audioFile";
import { AudioRecord, deleteAudio, listAudio, saveAudio } from "@/lib/storage";
import { AppSettings, TranscriptionEngine, uid } from "@/lib/types";

interface Props {
  sessionId: string;
  settings: AppSettings;
  onSettingsChange: (s: AppSettings) => void;
  /** Ajoute du texte à la fin de la transcription. `newParagraph` = commence un nouveau paragraphe. */
  onAppend: (text: string, newParagraph?: boolean) => void;
  onActiveChange?: (active: boolean) => void;
}

const ENGINE_LABELS: Record<TranscriptionEngine, string> = {
  webspeech: "Navigateur (Web Speech) — gratuit, instantané",
  groq: "Groq Whisper large-v3 — rapide, très précis",
  openai: "OpenAI Whisper — précis",
};

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function RecorderPanel({ sessionId, settings, onSettingsChange, onAppend, onActiveChange }: Props) {
  const [deviceId, setDeviceId] = useState("");
  const [archiveAudio, setArchiveAudio] = useState(true);
  const [highQualityMic, setHighQualityMic] = useState(false);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState<Blob[]>([]);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [records, setRecords] = useState<AudioRecord[]>([]);
  const [importProgress, setImportProgress] = useState<string | null>(null);
  const [speechOnlyActive, setSpeechOnlyActive] = useState(false);
  const [speechOnlyPaused, setSpeechOnlyPaused] = useState(false);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const onAppendRef = useRef(onAppend);
  onAppendRef.current = onAppend;

  const engine = settings.transcriptionEngine;
  const useServerEngine = engine !== "webspeech";

  /* ---------- File d'attente des segments (ordre préservé) ---------- */
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const enqueue = useCallback((blob: Blob) => {
    setPending((n) => n + 1);
    queueRef.current = queueRef.current.then(async () => {
      try {
        const text = await transcribeBlob(blob, settingsRef.current);
        if (text) onAppendRef.current(text, true);
      } catch (e) {
        setFailed((f) => [...f, blob]);
        setPanelError((e as Error).message);
      } finally {
        setPending((n) => n - 1);
      }
    });
  }, []);

  /* ---------- Enregistreur + reconnaissance vocale ---------- */
  const recorder = useAudioRecorder({
    deviceId,
    onSegment: useServerEngine ? (blob) => enqueue(blob) : undefined,
    segmentSeconds: settings.segmentSeconds,
    echoCancellation: !highQualityMic,
    noiseSuppression: !highQualityMic,
    autoGainControl: !highQualityMic,
  });

  const speech = useSpeechRecognition(settings.language, (text) => onAppendRef.current(text));

  const active = recorder.status !== "idle" || speechOnlyActive;
  const paused = recorder.status === "paused" || speechOnlyPaused;

  useEffect(() => onActiveChange?.(active), [active, onActiveChange]);

  // Chronomètre du mode « reconnaissance seule » (sans enregistreur audio)
  const [speechElapsed, setSpeechElapsed] = useState(0);
  useEffect(() => {
    if (!speechOnlyActive || speechOnlyPaused) return;
    const t = setInterval(() => setSpeechElapsed((ms) => ms + 1000), 1000);
    return () => clearInterval(t);
  }, [speechOnlyActive, speechOnlyPaused]);
  const elapsed = speechOnlyActive ? speechElapsed : recorder.elapsedMs;

  /* ---------- Archives audio de la séance ---------- */
  const reloadRecords = useCallback(async () => {
    try {
      setRecords(await listAudio(sessionId));
    } catch {
      setRecords([]);
    }
  }, [sessionId]);
  useEffect(() => {
    reloadRecords();
  }, [reloadRecords]);

  /* ---------- Contrôles ---------- */
  const start = async () => {
    setPanelError(null);
    onAppendRef.current("", true); // nouveau paragraphe pour cette prise
    if (engine === "webspeech") {
      if (archiveAudio) {
        const ok = await recorder.start();
        if (!ok) return;
      } else {
        setSpeechElapsed(0);
        setSpeechOnlyActive(true);
      }
      speech.start();
    } else {
      await recorder.start();
    }
  };

  const pause = () => {
    if (engine === "webspeech") speech.stop();
    if (recorder.status === "recording") recorder.pause();
    if (speechOnlyActive) setSpeechOnlyPaused(true);
  };

  const resume = () => {
    onAppendRef.current("", true);
    if (recorder.status === "paused") recorder.resume();
    if (engine === "webspeech") speech.start();
    setSpeechOnlyPaused(false);
  };

  const stop = async () => {
    if (engine === "webspeech") speech.stop();
    setSpeechOnlyActive(false);
    setSpeechOnlyPaused(false);
    const rec = await recorder.stop();
    if (rec && rec.blob.size > 0) {
      await saveAudio({
        id: uid(),
        sessionId,
        createdAt: Date.now(),
        mimeType: rec.mimeType,
        durationMs: rec.durationMs,
        blob: rec.blob,
      });
      reloadRecords();
    }
  };

  /* ---------- Transcription d'un fichier (import ou archive) ---------- */
  const transcribeFile = async (file: Blob, label: string) => {
    if (!useServerEngine) {
      setPanelError("Choisissez le moteur Groq ou OpenAI Whisper pour transcrire un fichier audio.");
      return;
    }
    setPanelError(null);
    try {
      setImportProgress(`Préparation de « ${label} »…`);
      const asFile = file instanceof File ? file : new File([file], `audio.${extensionFor(file.type)}`, { type: file.type });
      const chunks = await splitAudioFile(asFile, 60);
      for (let i = 0; i < chunks.length; i++) {
        setImportProgress(`Transcription ${i + 1} / ${chunks.length}…`);
        const text = await transcribeBlob(chunks[i], settingsRef.current);
        if (text) onAppendRef.current(text, true);
      }
    } catch (e) {
      setPanelError(`Échec de la transcription du fichier : ${(e as Error).message}`);
    } finally {
      setImportProgress(null);
    }
  };

  const retryFailed = () => {
    const list = failed;
    setFailed([]);
    setPanelError(null);
    list.forEach(enqueue);
  };

  const errors = [panelError, recorder.error, speech.error].filter(Boolean) as string[];

  return (
    <section className="card space-y-4">
      <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-navy-700">
        <Mic className="h-5 w-5" /> Enregistrement
      </h2>

      <AudioSourceSelector
        deviceId={deviceId}
        onChange={setDeviceId}
        disabled={active}
        level={recorder.level}
        active={recorder.status === "recording"}
      />

      <div>
        <label className="label">Moteur de transcription</label>
        <select
          className="input"
          value={engine}
          disabled={active}
          onChange={(e) =>
            onSettingsChange({ ...settings, transcriptionEngine: e.target.value as TranscriptionEngine })
          }
        >
          {(Object.keys(ENGINE_LABELS) as TranscriptionEngine[]).map((k) => (
            <option key={k} value={k}>
              {ENGINE_LABELS[k]}
            </option>
          ))}
        </select>
        {engine === "webspeech" && (
          <p className="mt-1 text-xs text-slate-500">
            Utilise le micro <strong>par défaut</strong> du système. Pour un micro externe précis, sélectionnez
            Groq / Whisper (ou définissez-le comme micro par défaut).
          </p>
        )}
        {useServerEngine && (
          <p className="mt-1 text-xs text-slate-500">
            Le texte arrive par blocs d&apos;environ {settings.segmentSeconds} s, avec le micro sélectionné ci-dessus.
          </p>
        )}
      </div>

      <details className="rounded-lg bg-slate-50 p-3 text-sm">
        <summary className="cursor-pointer font-semibold text-slate-600">Options avancées</summary>
        <div className="mt-3 space-y-2">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={highQualityMic}
              disabled={active}
              onChange={(e) => setHighQualityMic(e.target.checked)}
            />
            <span>
              Micro de conférence de qualité (désactive la suppression de bruit / d&apos;écho / le gain automatique)
            </span>
          </label>
          {engine === "webspeech" && (
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={archiveAudio}
                disabled={active}
                onChange={(e) => setArchiveAudio(e.target.checked)}
              />
              <span>
                Archiver aussi l&apos;audio. <em>Sur certains Android, la reconnaissance vocale ne fonctionne pas si
                le micro est déjà utilisé : décochez alors cette case.</em>
              </span>
            </label>
          )}
          {useServerEngine && (
            <label className="flex items-center gap-2">
              Durée des segments
              <select
                className="input w-28"
                value={settings.segmentSeconds}
                disabled={active}
                onChange={(e) => onSettingsChange({ ...settings, segmentSeconds: Number(e.target.value) })}
              >
                {[15, 30, 45, 60, 90].map((s) => (
                  <option key={s} value={s}>
                    {s} s
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex items-center gap-2">
            Langue
            <select
              className="input w-40"
              value={settings.language}
              disabled={active}
              onChange={(e) => onSettingsChange({ ...settings, language: e.target.value })}
            >
              <option value="fr-FR">Français</option>
              <option value="fr-CD">Français (RDC)</option>
              <option value="en-US">Anglais</option>
              <option value="sw-CD">Swahili</option>
              <option value="ln-CD">Lingala</option>
            </select>
          </label>
        </div>
      </details>

      {/* Contrôles */}
      <div className="flex flex-col items-center gap-3 rounded-xl bg-navy-50 p-4">
        <div className="font-mono text-3xl font-bold tabular-nums text-navy-700">{fmt(elapsed)}</div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase">
          {active && !paused && (
            <>
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" /> Enregistrement en cours
            </>
          )}
          {paused && <span className="text-amber-600">En pause</span>}
          {!active && <span className="text-slate-400">Prêt</span>}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {!active && (
            <button type="button" className="btn-danger px-6 py-3 text-base" onClick={start}>
              <Mic className="h-5 w-5" /> Démarrer
            </button>
          )}
          {active && !paused && (
            <button type="button" className="btn-ghost px-5 py-3" onClick={pause}>
              <Pause className="h-5 w-5" /> Pause
            </button>
          )}
          {active && paused && (
            <button type="button" className="btn-primary px-5 py-3" onClick={resume}>
              <Play className="h-5 w-5" /> Reprendre
            </button>
          )}
          {active && (
            <button
              type="button"
              className="btn-ghost px-5 py-3"
              onClick={stop}
              disabled={recorder.status === "stopping"}
            >
              <Square className="h-5 w-5 fill-current" /> Arrêter
            </button>
          )}
        </div>
        {speech.interim && (
          <p className="w-full rounded-lg bg-white p-2 text-sm italic text-slate-500">… {speech.interim}</p>
        )}
        {pending > 0 && (
          <p className="flex items-center gap-2 text-xs text-navy-700">
            <Loader2 className="h-3 w-3 animate-spin" /> Transcription de {pending} segment(s) en cours…
          </p>
        )}
      </div>

      {errors.map((err, i) => (
        <div key={i} className="flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" /> <span>{err}</span>
        </div>
      ))}
      {failed.length > 0 && (
        <button type="button" className="btn-ghost w-full" onClick={retryFailed}>
          <RotateCcw className="h-4 w-4" /> Réessayer {failed.length} segment(s) non transcrit(s)
        </button>
      )}

      {/* Import de fichier */}
      <label className={`btn-ghost w-full cursor-pointer ${active || importProgress ? "pointer-events-none opacity-50" : ""}`}>
        <Upload className="h-4 w-4" />
        {importProgress ?? "Importer un fichier audio (mp3, m4a, wav, ogg…)"}
        <input
          type="file"
          accept="audio/*,video/mp4"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) transcribeFile(f, f.name);
          }}
        />
      </label>

      {/* Archives */}
      {records.length > 0 && (
        <div className="space-y-2">
          <h3 className="label flex items-center gap-1">
            <FileAudio className="h-3 w-3" /> Enregistrements de la séance (stockés sur cet appareil)
          </h3>
          {records.map((r) => (
            <RecordItem
              key={r.id}
              record={r}
              onTranscribe={() => transcribeFile(r.blob, "enregistrement")}
              canTranscribe={useServerEngine && !active && !importProgress}
              onDelete={async () => {
                if (!confirm("Supprimer définitivement cet enregistrement ?")) return;
                await deleteAudio(r.id);
                reloadRecords();
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function RecordItem({
  record,
  onDelete,
  onTranscribe,
  canTranscribe,
}: {
  record: AudioRecord;
  onDelete: () => void;
  onTranscribe: () => void;
  canTranscribe: boolean;
}) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    const u = URL.createObjectURL(record.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [record.blob]);

  const date = new Date(record.createdAt).toLocaleString("fr-FR");
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-2">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          {date} — {fmt(record.durationMs)}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            title="Retranscrire avec Whisper/Groq"
            className="rounded p-1 hover:bg-slate-100 disabled:opacity-30"
            disabled={!canTranscribe}
            onClick={onTranscribe}
          >
            <Wand2 className="h-4 w-4" />
          </button>
          <a
            title="Télécharger"
            className="rounded p-1 hover:bg-slate-100"
            href={url}
            download={`reunion-${record.createdAt}.${extensionFor(record.mimeType)}`}
          >
            <Download className="h-4 w-4" />
          </a>
          <button type="button" title="Supprimer" className="rounded p-1 hover:bg-red-50 hover:text-red-600" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {url && <audio controls preload="none" src={url} className="h-9 w-full" />}
    </div>
  );
}
