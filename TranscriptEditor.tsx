"use client";
/**
 * Zone d'édition de la transcription, mise à jour en temps réel pendant l'enregistrement.
 * Les boutons « intervenant » insèrent « Nom : » pour aider l'IA à attribuer les propos.
 */
import { ClipboardCopy, Eraser, FileDown, FileText, UserRound } from "lucide-react";
import { useEffect, useRef } from "react";
import { Participant } from "@/lib/types";

interface Props {
  value: string;
  onChange: (v: string) => void;
  participants: Participant[];
  president: string;
  live: boolean;
}

export default function TranscriptEditor({ value, onChange, participants, president, live }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;

  const speakers = Array.from(
    new Set([president, ...participants.filter((p) => p.statut !== "absent").map((p) => p.nom)].filter(Boolean)),
  );

  /** Insère « Nom : » à la position du curseur (ou en fin de texte pendant l'enregistrement). */
  const insertSpeaker = (name: string) => {
    const ta = ref.current;
    const tag = `${name} : `;
    if (!ta || live || document.activeElement !== ta) {
      onChange(value.trimEnd() + (value.trim() ? "\n\n" : "") + tag);
      return;
    }
    const { selectionStart: a, selectionEnd: b } = ta;
    const before = value.slice(0, a);
    const prefix = before && !before.endsWith("\n") ? "\n\n" : "";
    const next = before + prefix + tag + value.slice(b);
    onChange(next);
    requestAnimationFrame(() => {
      const pos = a + prefix.length + tag.length;
      ta.setSelectionRange(pos, pos);
      ta.focus();
    });
  };

  const download = () => {
    const blob = new Blob([value], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcription-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Défilement automatique en bas pendant l'enregistrement (sauf si l'utilisateur édite)
  useEffect(() => {
    const ta = ref.current;
    if (live && ta && document.activeElement !== ta) ta.scrollTop = ta.scrollHeight;
  }, [value, live]);

  return (
    <section className="card flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-navy-700">
          <FileText className="h-5 w-5" /> Transcription
          {live && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">EN DIRECT</span>}
        </h2>
        <div className="flex gap-1">
          <button type="button" className="btn-ghost px-2 py-1" title="Copier" onClick={() => navigator.clipboard.writeText(value)}>
            <ClipboardCopy className="h-4 w-4" />
          </button>
          <button type="button" className="btn-ghost px-2 py-1" title="Télécharger (.txt)" onClick={download} disabled={!value}>
            <FileDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="btn-ghost px-2 py-1"
            title="Effacer"
            disabled={!value || live}
            onClick={() => confirm("Effacer toute la transcription ?") && onChange("")}
          >
            <Eraser className="h-4 w-4" />
          </button>
        </div>
      </div>

      {speakers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="mr-1 flex items-center gap-1 text-xs text-slate-500">
            <UserRound className="h-3 w-3" /> Intervenant :
          </span>
          {speakers.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()} // garde le curseur dans la zone de texte
              onClick={() => insertSpeaker(s)}
              className="rounded-full border border-navy-100 bg-navy-50 px-2 py-0.5 text-xs text-navy-700 hover:bg-navy-100"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <textarea
        ref={ref}
        className="input min-h-[45vh] flex-1 resize-y font-serif text-[15px] leading-relaxed"
        placeholder="La transcription apparaîtra ici pendant l'enregistrement. Vous pouvez aussi saisir ou coller vos notes directement."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-right text-xs text-slate-400">
        {words.toLocaleString("fr-FR")} mots — sauvegarde automatique sur cet appareil
      </p>
    </section>
  );
}
