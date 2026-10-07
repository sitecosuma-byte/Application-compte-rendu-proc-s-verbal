"use client";
/**
 * Page principale : gestion des séances, onglets Séance / Enregistrement / Procès-verbal.
 *
 * Les trois onglets restent montés (simplement masqués) pour que l'enregistrement
 * continue lorsque l'utilisateur navigue entre eux.
 */
import { CalendarDays, FileText, Loader2, Mic, Plus, ScrollText, Settings, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import MeetingForm from "@/components/MeetingForm";
import PVGenerator from "@/components/PVGenerator";
import RecorderPanel from "@/components/RecorderPanel";
import SettingsDialog from "@/components/SettingsDialog";
import TranscriptEditor from "@/components/TranscriptEditor";
import {
  deleteSession,
  listSessions,
  loadAppSettings,
  loadOrgSettings,
  requestPersistentStorage,
  saveAppSettings,
  saveOrgSettings,
  saveSession,
} from "@/lib/storage";
import {
  AppSettings,
  DEFAULT_ORG,
  DEFAULT_SETTINGS,
  MeetingSession,
  OrgSettings,
  newSession,
} from "@/lib/types";

type Tab = "seance" | "enregistrement" | "pv";

const TABS: { id: Tab; label: string; icon: typeof Mic }[] = [
  { id: "seance", label: "Séance", icon: CalendarDays },
  { id: "enregistrement", label: "Enregistrement", icon: Mic },
  { id: "pv", label: "Procès-verbal", icon: ScrollText },
];

function sessionLabel(s: MeetingSession) {
  const date = s.meeting.date
    ? new Date(s.meeting.date + "T12:00:00").toLocaleDateString("fr-FR")
    : new Date(s.createdAt).toLocaleDateString("fr-FR");
  return `${date} — ${s.meeting.titre || s.meeting.typeReunion || "Réunion sans titre"}`;
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [sessions, setSessions] = useState<MeetingSession[]>([]);
  const [session, setSession] = useState<MeetingSession | null>(null);
  const [org, setOrg] = useState<OrgSettings>(DEFAULT_ORG);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [tab, setTab] = useState<Tab>("seance");
  const [recording, setRecording] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");

  /* ---------- Chargement initial ---------- */
  useEffect(() => {
    (async () => {
      setSettings(loadAppSettings());
      setOrg(await loadOrgSettings());
      requestPersistentStorage();
      try {
        const list = await listSessions();
        if (list.length) {
          setSessions(list);
          setSession(list[0]);
        } else {
          const s = newSession();
          setSessions([s]);
          setSession(s);
        }
      } catch {
        // IndexedDB indisponible (navigation privée stricte) : on travaille en mémoire
        const s = newSession();
        setSessions([s]);
        setSession(s);
        setSaveState("error");
      }
      setReady(true);
    })();
  }, []);

  /* ---------- Sauvegarde automatique (anti-rebond 600 ms) ---------- */
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!session || !ready) return;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveSession(session);
        setSaveState("saved");
        setSessions((list) => {
          const others = list.filter((s) => s.id !== session.id);
          return [session, ...others].sort((a, b) => b.updatedAt - a.updatedAt);
        });
      } catch {
        setSaveState("error");
      }
    }, 600);
  }, [session, ready]);

  /* ---------- Avertissement avant fermeture pendant l'enregistrement ---------- */
  useEffect(() => {
    if (!recording) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [recording]);

  const update = useCallback((patch: Partial<MeetingSession> | ((s: MeetingSession) => Partial<MeetingSession>)) => {
    setSession((s) => {
      if (!s) return s;
      const p = typeof patch === "function" ? patch(s) : patch;
      return { ...s, ...p, updatedAt: Date.now() };
    });
  }, []);

  /** Ajoute du texte transcrit à la fin (thread-safe grâce à la mise à jour fonctionnelle). */
  const appendTranscript = useCallback(
    (text: string, newParagraph = false) =>
      update((s) => {
        const prev = s.transcript;
        const trimmed = text.trim();
        if (!trimmed) {
          // Demande de saut de paragraphe uniquement
          if (!prev.trim() || prev.endsWith("\n\n") || /:\s*$/.test(prev)) return {};
          return { transcript: prev.trimEnd() + "\n\n" };
        }
        let sep = "";
        if (prev.trim()) {
          if (/:\s*$/.test(prev)) sep = prev.endsWith(" ") ? "" : " "; // après « Nom : »
          else if (newParagraph && !prev.endsWith("\n\n")) sep = prev.endsWith("\n") ? "\n" : "\n\n";
          else if (!/\s$/.test(prev)) sep = " ";
        }
        return { transcript: prev + sep + trimmed };
      }),
    [update],
  );

  const updateSettings = (s: AppSettings) => {
    setSettings(s);
    saveAppSettings(s);
  };

  const createSession = () => {
    const s = newSession();
    setSessions((list) => [s, ...list]);
    setSession(s);
    setTab("seance");
  };

  const removeSession = async () => {
    if (!session) return;
    if (!confirm("Supprimer définitivement cette séance (transcription, PV et enregistrements) ?")) return;
    await deleteSession(session.id).catch(() => undefined);
    const rest = sessions.filter((s) => s.id !== session.id);
    if (rest.length) {
      setSessions(rest);
      setSession(rest[0]);
    } else {
      const s = newSession();
      setSessions([s]);
      setSession(s);
    }
  };

  if (!ready || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-navy-700">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col">
      {/* Barre supérieure */}
      <header className="sticky top-0 z-30 border-b border-navy-800 bg-navy-700 text-white shadow">
        <div className="flex items-center gap-3 px-3 py-2 sm:px-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={org.logoDataUrl ?? "/logo-cosuma.png"}
            onError={(e) => {
              const img = e.currentTarget;
              if (!img.src.endsWith(".svg")) img.src = "/logo-cosuma.svg";
            }}
            alt=""
            className="h-10 w-10 rounded-full bg-white object-contain p-0.5"
          />
          <div className="min-w-0 flex-1">
            <div className="font-serif text-base font-bold leading-tight sm:text-lg">{org.sigle}</div>
            <div className="truncate text-[11px] text-navy-100 sm:text-xs">Procès-verbaux &amp; comptes-rendus</div>
          </div>
          <span
            className={`hidden text-[11px] sm:inline ${saveState === "error" ? "text-red-200" : "text-navy-100"}`}
          >
            {saveState === "saving" ? "Sauvegarde…" : saveState === "saved" ? "✓ Sauvegardé localement" : "⚠ Non sauvegardé"}
          </span>
          <button
            type="button"
            aria-label="Paramètres"
            className="rounded-lg p-2 hover:bg-navy-800"
            onClick={() => setShowSettings(true)}
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>

        {/* Sélecteur de séance */}
        <div className="flex items-center gap-2 bg-navy-800 px-3 py-2 sm:px-5">
          <FileText className="h-4 w-4 shrink-0 text-gold-400" />
          <select
            className="min-w-0 flex-1 rounded-md bg-navy-700 px-2 py-1 text-sm text-white outline-none"
            value={session.id}
            disabled={recording}
            onChange={(e) => {
              const s = sessions.find((x) => x.id === e.target.value);
              if (s) setSession(s);
            }}
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {sessionLabel(s)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="flex items-center gap-1 rounded-md bg-gold-500 px-2 py-1 text-xs font-semibold hover:bg-gold-400 disabled:opacity-50"
            onClick={createSession}
            disabled={recording}
          >
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nouvelle séance</span>
          </button>
          <button
            type="button"
            aria-label="Supprimer la séance"
            className="rounded-md p-1 text-navy-100 hover:bg-red-700 disabled:opacity-50"
            onClick={removeSession}
            disabled={recording}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Onglets */}
        <nav className="flex bg-white text-slate-600">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-xs font-semibold sm:text-sm ${
                tab === id ? "border-gold-500 text-navy-700" : "border-transparent hover:text-navy-700"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {id === "enregistrement" && recording && <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" />}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 p-3 sm:p-5">
        <div className={tab === "seance" ? "" : "hidden"}>
          <MeetingForm meeting={session.meeting} onChange={(meeting) => update({ meeting })} />
          <div className="mt-4 flex justify-end">
            <button type="button" className="btn-primary" onClick={() => setTab("enregistrement")}>
              <Mic className="h-4 w-4" /> Passer à l&apos;enregistrement
            </button>
          </div>
        </div>

        <div className={tab === "enregistrement" ? "grid gap-4 lg:grid-cols-[380px_1fr]" : "hidden"}>
          <RecorderPanel
            key={session.id}
            sessionId={session.id}
            settings={settings}
            onSettingsChange={updateSettings}
            onAppend={appendTranscript}
            onActiveChange={setRecording}
          />
          <div className="flex flex-col gap-4">
            <TranscriptEditor
              value={session.transcript}
              onChange={(transcript) => update({ transcript })}
              participants={session.meeting.participants}
              president={session.meeting.president}
              live={recording}
            />
            <div className="flex justify-end">
              <button type="button" className="btn-primary" onClick={() => setTab("pv")}>
                <ScrollText className="h-4 w-4" /> Générer le procès-verbal
              </button>
            </div>
          </div>
        </div>

        <div className={tab === "pv" ? "mx-auto max-w-4xl" : "hidden"}>
          <PVGenerator
            meeting={session.meeting}
            transcript={session.transcript}
            docType={session.docType}
            onDocTypeChange={(docType) => update({ docType })}
            pv={session.pv}
            onPVChange={(pv) => update({ pv })}
            org={org}
            settings={settings}
            onSettingsChange={updateSettings}
            recording={recording}
          />
        </div>
      </main>

      <footer className="px-5 pb-6 text-center text-[11px] text-slate-400">
        Données stockées uniquement sur cet appareil (IndexedDB). Exportez vos PV en Word pour les archiver.
      </footer>

      {showSettings && (
        <SettingsDialog
          org={org}
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSave={(o, s) => {
            setOrg(o);
            saveOrgSettings(o).catch(() => undefined);
            updateSettings(s);
            setShowSettings(false);
          }}
        />
      )}
    </div>
  );
}
