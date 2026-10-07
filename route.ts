/**
 * POST /api/transcribe
 * Reçoit un segment audio (multipart/form-data) et le transcrit via
 * OpenAI Whisper ou Groq (whisper-large-v3). La clé API reste côté serveur.
 *
 * Champs : file (Blob), engine ("openai" | "groq"), language (ex. "fr"), prompt (facultatif)
 */
import { NextResponse } from "next/server";
import { missingKeyMessage, resolveKey } from "@/lib/serverKeys";

export const runtime = "nodejs";
export const maxDuration = 60;

const ENDPOINTS = {
  openai: {
    url: "https://api.openai.com/v1/audio/transcriptions",
    model: () => process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1",
  },
  groq: {
    url: "https://api.groq.com/openai/v1/audio/transcriptions",
    model: () => process.env.GROQ_TRANSCRIBE_MODEL || "whisper-large-v3",
  },
} as const;

/** Vocabulaire fréquent : améliore la reconnaissance des sigles et termes propres. */
const DEFAULT_PROMPT =
  "Réunion de la COSUMA-RDC, Conférence des Supérieurs Majeurs de la République Démocratique du Congo. " +
  "Supérieurs majeurs, congrégations, instituts de vie consacrée, Révérend Père, Révérende Sœur, Frère, " +
  "Assemblée générale, ordre du jour, procès-verbal, résolution, Kinshasa.";

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Requête invalide (multipart attendu)." }, { status: 400 });
  }

  const file = form.get("file");
  const engine = form.get("engine") === "groq" ? "groq" : "openai";
  const language = String(form.get("language") || "fr").slice(0, 2);
  const prompt = String(form.get("prompt") || DEFAULT_PROMPT).slice(0, 800);

  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Fichier audio manquant." }, { status: 400 });
  }

  const key = resolveKey(engine, req);
  if (!key) return NextResponse.json({ error: missingKeyMessage(engine) }, { status: 401 });

  const filename = file instanceof File && file.name ? file.name : "segment.webm";
  const upstream = new FormData();
  upstream.append("file", file, filename);
  upstream.append("model", ENDPOINTS[engine].model());
  upstream.append("language", language);
  upstream.append("prompt", prompt);
  upstream.append("response_format", "json");
  upstream.append("temperature", "0");

  try {
    const res = await fetch(ENDPOINTS[engine].url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: upstream,
    });
    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json(
        { error: `Erreur ${engine} (${res.status}) : ${detail.slice(0, 400)}` },
        { status: 502 },
      );
    }
    const data = (await res.json()) as { text?: string };
    return NextResponse.json({ text: (data.text ?? "").trim() });
  } catch (e) {
    return NextResponse.json(
      { error: `Service de transcription injoignable : ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
