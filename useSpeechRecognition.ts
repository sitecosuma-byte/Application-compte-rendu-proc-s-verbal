"use client";
/**
 * Transcription continue via la Web Speech API (Chrome, Edge, Chrome Android, Safari).
 *
 * - Gratuit, sans clé API, résultat instantané (texte « provisoire » puis « définitif »).
 * - Le navigateur arrête la reconnaissance après un silence : on la relance automatiquement
 *   tant que l'enregistrement est actif.
 * - Limite : la Web Speech API utilise le micro PAR DÉFAUT du système, pas forcément celui
 *   choisi dans le sélecteur. Pour un micro externe précis, choisissez-le comme micro par
 *   défaut du système, ou utilisez le moteur Whisper / Groq (qui utilise le micro sélectionné).
 */
import { useCallback, useEffect, useRef, useState } from "react";

/* Typage minimal (l'API n'est pas encore dans lib.dom.d.ts) */
interface SRAlternative {
  transcript: string;
}
interface SRResult {
  isFinal: boolean;
  0: SRAlternative;
}
interface SREvent {
  resultIndex: number;
  results: ArrayLike<SRResult>;
}
interface SRErrorEvent {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SRConstructor = new () => SpeechRecognitionLike;

function getSR(): SRConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SRConstructor;
    webkitSpeechRecognition?: SRConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechRecognition(lang: string, onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const activeRef = useRef(false);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => setSupported(!!getSR()), []);

  const create = useCallback(() => {
    const SR = getSR();
    if (!SR) return null;
    const rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0].transcript.trim();
        if (!text) continue;
        if (r.isFinal) onFinalRef.current(text);
        else interimText += text + " ";
      }
      setInterim(interimText.trim());
    };

    rec.onerror = (e) => {
      // « no-speech » et « aborted » sont normaux (silence, relance) : on les ignore.
      if (e.error === "no-speech" || e.error === "aborted") return;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        activeRef.current = false;
        setError("Reconnaissance vocale refusée. Autorisez le micro pour ce site.");
      } else if (e.error === "audio-capture") {
        setError(
          "Le micro est indisponible pour la reconnaissance vocale (déjà utilisé ? sur certains Android, choisissez le moteur Whisper/Groq).",
        );
      } else if (e.error === "network") {
        setError("La reconnaissance vocale du navigateur nécessite une connexion Internet.");
      } else {
        setError(`Reconnaissance vocale : ${e.error}`);
      }
    };

    rec.onend = () => {
      setInterim("");
      if (activeRef.current) {
        // Relance automatique après un silence ou une coupure
        setTimeout(() => {
          if (!activeRef.current) return;
          try {
            rec.start();
          } catch {
            /* déjà démarrée */
          }
        }, 250);
      } else {
        setListening(false);
      }
    };
    return rec;
  }, [lang]);

  const start = useCallback(() => {
    setError(null);
    const rec = create();
    if (!rec) {
      setError("La Web Speech API n'est pas disponible sur ce navigateur (utilisez Chrome ou Edge).");
      return false;
    }
    recRef.current = rec;
    activeRef.current = true;
    try {
      rec.start();
      setListening(true);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }, [create]);

  const stop = useCallback(() => {
    activeRef.current = false;
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
    setInterim("");
  }, []);

  useEffect(
    () => () => {
      activeRef.current = false;
      recRef.current?.abort();
    },
    [],
  );

  return { supported, listening, interim, error, start, stop };
}
