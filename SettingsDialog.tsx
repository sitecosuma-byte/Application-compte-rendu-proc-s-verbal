"use client";
/**
 * Paramètres : en-tête institutionnel (logo, nom, service, adresse, police)
 * et clés API facultatives.
 */
import { Building2, ImageUp, KeyRound, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { AppSettings, DEFAULT_ORG, OrgSettings } from "@/lib/types";

interface Props {
  org: OrgSettings;
  settings: AppSettings;
  onSave: (org: OrgSettings, settings: AppSettings) => void;
  onClose: () => void;
}

const FONTS = ["Cambria", "Times New Roman", "Garamond", "Book Antiqua", "Calibri", "Arial"];

export default function SettingsDialog({ org: org0, settings: s0, onSave, onClose }: Props) {
  const [org, setOrg] = useState(org0);
  const [settings, setSettings] = useState(s0);
  const [logoError, setLogoError] = useState<string | null>(null);

  const setO = <K extends keyof OrgSettings>(k: K, v: OrgSettings[K]) => setOrg({ ...org, [k]: v });
  const setKey = (k: keyof AppSettings["keys"], v: string) =>
    setSettings({ ...settings, keys: { ...settings.keys, [k]: v.trim() } });

  const onLogo = (file: File) => {
    setLogoError(null);
    if (!/^image\/(png|jpe?g|svg\+xml|webp|gif)$/.test(file.type)) {
      setLogoError("Format non supporté : utilisez PNG, JPEG, SVG ou WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("Image trop lourde (2 Mo maximum).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setO("logoDataUrl", String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Paramètres"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl font-bold text-navy-700">Paramètres</h2>
          <button type="button" aria-label="Fermer" onClick={onClose} className="rounded p-1 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* En-tête institutionnel */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 font-semibold text-navy-700">
            <Building2 className="h-4 w-4" /> En-tête institutionnel du document Word
          </h3>

          <div className="flex items-center gap-4 rounded-xl border border-dashed border-slate-300 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={org.logoDataUrl ?? "/logo-cosuma.png"}
              onError={(e) => {
                const img = e.currentTarget;
                if (!img.src.endsWith(".svg")) img.src = "/logo-cosuma.svg";
              }}
              alt="Logo"
              className="h-20 w-20 rounded-lg object-contain"
            />
            <div className="flex-1 space-y-2 text-sm">
              <p className="text-slate-600">
                Logo affiché en haut de la première page. Par défaut : <code>public/logo-cosuma.png</code> (ou le logo
                provisoire <code>.svg</code>).
              </p>
              <div className="flex flex-wrap gap-2">
                <label className="btn-ghost cursor-pointer py-1">
                  <ImageUp className="h-4 w-4" /> Importer un logo
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && onLogo(e.target.files[0])}
                  />
                </label>
                {org.logoDataUrl && (
                  <button type="button" className="btn-ghost py-1" onClick={() => setO("logoDataUrl", null)}>
                    <RotateCcw className="h-4 w-4" /> Logo par défaut
                  </button>
                )}
              </div>
              {logoError && <p className="text-xs text-red-600">{logoError}</p>}
            </div>
          </div>

          <div>
            <label className="label">Nom de l&apos;organisation</label>
            <input className="input" value={org.nomLong} onChange={(e) => setO("nomLong", e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Sigle</label>
              <input className="input" value={org.sigle} onChange={(e) => setO("sigle", e.target.value)} />
            </div>
            <div>
              <label className="label">Service émetteur</label>
              <input className="input" value={org.service} onChange={(e) => setO("service", e.target.value)} />
            </div>
            <div>
              <label className="label">Adresse</label>
              <input className="input" value={org.adresse} onChange={(e) => setO("adresse", e.target.value)} />
            </div>
            <div>
              <label className="label">Contact (tél., e-mail)</label>
              <input className="input" value={org.contact} onChange={(e) => setO("contact", e.target.value)} />
            </div>
            <div>
              <label className="label">Devise (facultatif)</label>
              <input className="input" value={org.devise} onChange={(e) => setO("devise", e.target.value)} />
            </div>
            <div>
              <label className="label">Police du document</label>
              <select className="input" value={org.police} onChange={(e) => setO("police", e.target.value)}>
                {FONTS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>
          <button type="button" className="text-xs text-slate-500 underline" onClick={() => setOrg(DEFAULT_ORG)}>
            Rétablir les valeurs COSUMA-RDC par défaut
          </button>
        </section>

        {/* Clés API */}
        <section className="mt-6 space-y-3 border-t border-slate-100 pt-5">
          <h3 className="flex items-center gap-2 font-semibold text-navy-700">
            <KeyRound className="h-4 w-4" /> Clés API (facultatif)
          </h3>
          <p className="text-xs text-slate-500">
            Recommandé : configurez les clés côté serveur (variables d&apos;environnement Vercel). Les clés saisies ici
            restent dans ce navigateur et ne sont utilisées que si le serveur n&apos;en possède pas.
          </p>
          {(
            [
              ["anthropic", "Anthropic (Claude) — rédaction du PV", "sk-ant-…"],
              ["groq", "Groq — transcription Whisper + rédaction Llama", "gsk_…"],
              ["openai", "OpenAI — Whisper + GPT", "sk-…"],
            ] as const
          ).map(([k, label, ph]) => (
            <div key={k}>
              <label className="label">{label}</label>
              <input
                type="password"
                autoComplete="off"
                className="input font-mono"
                placeholder={ph}
                value={settings.keys[k]}
                onChange={(e) => setKey(k, e.target.value)}
              />
            </div>
          ))}
        </section>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn-primary" onClick={() => onSave(org, settings)}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
