"use client";
/**
 * Module « Générateur de Procès-Verbal / Compte-Rendu » :
 * choix du type de document et du moteur, génération, édition, export Word.
 */
import { AlertTriangle, Bot, FileDown, FilePlus2, Loader2, ScrollText, Sparkles, X } from "lucide-react";
import { useRef, useState } from "react";
import PVEditor from "./PVEditor";
import { generatePVRemote } from "@/lib/api";
import { downloadPVDocx } from "@/lib/docx/generatePV";
import { analyzeLocally } from "@/lib/pv/localAnalyzer";
import {
  AIProvider,
  AppSettings,
  DOC_TYPE_LABELS,
  DocType,
  MeetingInfo,
  OrgSettings,
  PVContent,
  emptyPV,
} from "@/lib/types";

interface Props {
  meeting: MeetingInfo;
  transcript: string;
  docType: DocType;
  onDocTypeChange: (t: DocType) => void;
  pv: PVContent | null;
  onPVChange: (pv: PVContent | null) => void;
  org: OrgSettings;
  settings: AppSettings;
  onSettingsChange: (s: AppSettings) => void;
  recording: boolean;
}

const PROVIDERS: Record<AIProvider, string> = {
  anthropic: "Claude (Anthropic) — recommandé",
  openai: "OpenAI GPT",
  groq: "Groq (Llama 3.3 70B)",
  local: "Analyse locale sans IA (hors-ligne, brouillon)",
};

const DOC_TYPE_HELP: Record<DocType, string> = {
  synthetique: "L'essentiel des échanges, décisions et actions. Idéal pour diffusion rapide.",
  detaille: "Restitution fidèle et chronologique des interventions. Pour archives officielles.",
};

export default function PVGenerator(p: Props) {
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cleanMeeting: MeetingInfo = {
    ...p.meeting,
    ordreDuJour: p.meeting.ordreDuJour.map((s) => s.trim()).filter(Boolean),
    participants: p.meeting.participants.filter((x) => x.nom.trim()),
  };

  const generate = async () => {
    if (p.pv && !confirm("Remplacer le document actuel (vos modifications seront perdues) ?")) return;
    setError(null);
    setInfo(null);
    const provider = p.settings.aiProvider;

    if (provider === "local") {
      p.onPVChange(analyzeLocally(p.docType, cleanMeeting, p.transcript));
      setInfo("Brouillon généré localement. Relisez et complétez chaque partie avant l'export.");
      return;
    }

    setBusy(true);
    abortRef.current = new AbortController();
    try {
      const { pv, model } = await generatePVRemote(
        provider,
        p.docType,
        cleanMeeting,
        p.transcript,
        p.settings,
        abortRef.current.signal,
      );
      p.onPVChange(pv);
      setInfo(`Document rédigé par ${model}. Relisez-le avant diffusion.`);
    } catch (e) {
      if ((e as Error).name === "AbortError") setInfo("Génération annulée.");
      else setError((e as Error).message);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const exportDocx = async () => {
    if (!p.pv) return;
    setExporting(true);
    setError(null);
    try {
      await downloadPVDocx({ pv: p.pv, meeting: cleanMeeting, org: p.org, docType: p.docType });
    } catch (e) {
      setError(`Export Word impossible : ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  const tooShort = p.transcript.trim().length < 20;

  return (
    <section className="card space-y-5">
      <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-navy-700">
        <ScrollText className="h-5 w-5" /> Générateur de Procès-Verbal / Compte-Rendu
      </h2>

      {/* Type de document */}
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(DOC_TYPE_LABELS) as DocType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => p.onDocTypeChange(t)}
            className={`rounded-xl border-2 p-4 text-left transition ${
              p.docType === t ? "border-navy-700 bg-navy-50" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="font-serif font-bold text-navy-700">{DOC_TYPE_LABELS[t]}</div>
            <div className="mt-1 text-xs text-slate-500">{DOC_TYPE_HELP[t]}</div>
          </button>
        ))}
      </div>

      {/* Moteur */}
      <div>
        <label className="label flex items-center gap-1">
          <Bot className="h-3 w-3" /> Moteur de rédaction
        </label>
        <select
          className="input"
          value={p.settings.aiProvider}
          disabled={busy}
          onChange={(e) => p.onSettingsChange({ ...p.settings, aiProvider: e.target.value as AIProvider })}
        >
          {(Object.keys(PROVIDERS) as AIProvider[]).map((k) => (
            <option key={k} value={k}>
              {PROVIDERS[k]}
            </option>
          ))}
        </select>
      </div>

      {p.recording && (
        <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" /> Enregistrement en cours : arrêtez-le pour inclure toute la
          réunion dans le PV.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary flex-1 py-3" disabled={busy || tooShort} onClick={generate}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? "Rédaction en cours (jusqu'à quelques minutes)…" : `Générer le ${p.docType === "synthetique" ? "compte-rendu" : "procès-verbal"}`}
        </button>
        {busy && (
          <button type="button" className="btn-ghost" onClick={() => abortRef.current?.abort()}>
            <X className="h-4 w-4" /> Annuler
          </button>
        )}
        {!p.pv && !busy && (
          <button
            type="button"
            className="btn-ghost"
            title="Créer un document vide à remplir à la main"
            onClick={() =>
              p.onPVChange({
                ...emptyPV(),
                titre: `${p.docType === "synthetique" ? "COMPTE-RENDU" : "PROCÈS-VERBAL"} DE LA RÉUNION`,
                sections: cleanMeeting.ordreDuJour.map((titre) => ({ titre, contenu: "" })),
              })
            }
          >
            <FilePlus2 className="h-4 w-4" /> Rédiger manuellement
          </button>
        )}
      </div>
      {tooShort && <p className="text-xs text-slate-500">Enregistrez ou saisissez d&apos;abord la transcription.</p>}

      {error && (
        <div className="flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" /> <span>{error}</span>
        </div>
      )}
      {info && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{info}</p>}

      {p.pv && (
        <>
          <PVEditor pv={p.pv} onChange={p.onPVChange} />
          <div className="sticky bottom-3 z-10">
            <button type="button" className="btn-gold w-full py-4 text-base shadow-lg" onClick={exportDocx} disabled={exporting}>
              {exporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileDown className="h-5 w-5" />}
              Télécharger au format Word (.docx)
            </button>
          </div>
        </>
      )}
    </section>
  );
}
