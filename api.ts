/**
 * Appels du navigateur vers les routes API de l'application.
 */
import { extensionFor } from "@/hooks/useAudioRecorder";
import { AIProvider, AppSettings, DocType, MeetingInfo, PVContent } from "./types";

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || `Erreur ${res.status}`;
  } catch {
    return `Erreur ${res.status}`;
  }
}

/** Transcrit un fichier/segment audio via Whisper (OpenAI) ou Groq. */
export async function transcribeBlob(blob: Blob, settings: AppSettings): Promise<string> {
  const engine = settings.transcriptionEngine === "groq" ? "groq" : "openai";
  const form = new FormData();
  form.append("file", blob, `segment.${extensionFor(blob.type)}`);
  form.append("engine", engine);
  form.append("language", settings.language.slice(0, 2));

  const key = settings.keys[engine];
  const res = await fetch("/api/transcribe", {
    method: "POST",
    body: form,
    headers: key ? { "x-provider-key": key } : undefined,
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { text: string };
  return data.text;
}

/** Demande à l'IA de rédiger le PV structuré. */
export async function generatePVRemote(
  provider: Exclude<AIProvider, "local">,
  docType: DocType,
  meeting: MeetingInfo,
  transcript: string,
  settings: AppSettings,
  signal?: AbortSignal,
): Promise<{ pv: PVContent; model: string }> {
  const key = settings.keys[provider];
  const res = await fetch("/api/generate-pv", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(key ? { "x-provider-key": key } : {}),
    },
    body: JSON.stringify({ provider, docType, meeting, transcript }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as { pv: PVContent; model: string };
}
