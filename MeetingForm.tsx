"use client";
/**
 * Saisie des informations de séance : en-tête du PV, ordre du jour, participants.
 */
import { CalendarDays, ListOrdered, MapPin, Plus, Trash2, Users } from "lucide-react";
import { MeetingInfo, Participant, uid } from "@/lib/types";

const TYPES_REUNION = [
  "Assemblée Générale",
  "Assemblée Générale Extraordinaire",
  "Conseil d'Administration",
  "Réunion du Bureau",
  "Commission",
  "Session de formation",
  "Rencontre provinciale",
  "Autre",
];

interface Props {
  meeting: MeetingInfo;
  onChange: (m: MeetingInfo) => void;
}

export default function MeetingForm({ meeting, onChange }: Props) {
  const set = <K extends keyof MeetingInfo>(k: K, v: MeetingInfo[K]) => onChange({ ...meeting, [k]: v });

  const setParticipant = (id: string, patch: Partial<Participant>) =>
    set(
      "participants",
      meeting.participants.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );

  /** Collage d'une liste « Nom ; Fonction » (une personne par ligne) depuis Excel/Word. */
  const importList = (text: string) => {
    const added: Participant[] = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        // Séparateurs acceptés : « ; », tabulation (copie Excel), « | » ou tiret entouré d'espaces
        const [nom, ...rest] = line.split(/\s*[;\t|]\s*|\s+[—–-]\s+/);
        const fonction = rest.join(" — ");
        return { id: uid(), nom: nom.trim(), fonction: fonction.trim(), statut: "present" as const };
      });
    set("participants", [...meeting.participants, ...added]);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Informations générales */}
      <section className="card space-y-3">
        <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-navy-700">
          <CalendarDays className="h-5 w-5" /> Informations de séance
        </h2>
        <div>
          <label className="label">Intitulé de la réunion</label>
          <input
            className="input"
            placeholder="Ex. 45e Assemblée Générale ordinaire"
            value={meeting.titre}
            onChange={(e) => set("titre", e.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Type de réunion</label>
            <select
              className="input"
              value={meeting.typeReunion}
              onChange={(e) => set("typeReunion", e.target.value)}
            >
              {TYPES_REUNION.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={meeting.date} onChange={(e) => set("date", e.target.value)} />
          </div>
          <div>
            <label className="label">Heure de début</label>
            <input
              type="time"
              className="input"
              value={meeting.heureDebut}
              onChange={(e) => set("heureDebut", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Heure de fin</label>
            <input
              type="time"
              className="input"
              value={meeting.heureFin}
              onChange={(e) => set("heureFin", e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label flex items-center gap-1">
            <MapPin className="h-3 w-3" /> Lieu
          </label>
          <input
            className="input"
            placeholder="Ex. Centre Nganda, Kinshasa"
            value={meeting.lieu}
            onChange={(e) => set("lieu", e.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Président(e) de séance</label>
            <input className="input" value={meeting.president} onChange={(e) => set("president", e.target.value)} />
          </div>
          <div>
            <label className="label">Secrétaire / Rapporteur</label>
            <input className="input" value={meeting.secretaire} onChange={(e) => set("secretaire", e.target.value)} />
          </div>
        </div>
      </section>

      {/* Ordre du jour */}
      <section className="card space-y-3">
        <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-navy-700">
          <ListOrdered className="h-5 w-5" /> Ordre du jour
        </h2>
        <p className="text-xs text-slate-500">
          Un point par ligne. Le PV sera structuré selon ces points (dans cet ordre).
        </p>
        <textarea
          className="input min-h-48 font-mono"
          placeholder={"Prière d'ouverture et mot d'accueil\nAdoption du PV de la dernière réunion\nRapport financier\n…\nDivers"}
          value={meeting.ordreDuJour.join("\n")}
          onChange={(e) => set("ordreDuJour", e.target.value.split("\n"))}
          onBlur={(e) =>
            set(
              "ordreDuJour",
              e.target.value
                .split("\n")
                .map((l) => l.replace(/^\s*\d+[.)-]\s*/, "").trim())
                .filter(Boolean),
            )
          }
        />
      </section>

      {/* Participants */}
      <section className="card space-y-3 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-navy-700">
            <Users className="h-5 w-5" /> Participants / intervenants ({meeting.participants.length})
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                const text = prompt(
                  "Collez la liste (une personne par ligne, format « Nom ; Fonction / Congrégation ») :",
                );
                if (text) importList(text);
              }}
            >
              Coller une liste
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() =>
                set("participants", [
                  ...meeting.participants,
                  { id: uid(), nom: "", fonction: "", statut: "present" },
                ])
              }
            >
              <Plus className="h-4 w-4" /> Ajouter
            </button>
          </div>
        </div>

        {meeting.participants.length === 0 && (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
            Aucun participant. Les noms saisis ici aident l&apos;IA à attribuer correctement les interventions.
          </p>
        )}

        <div className="space-y-2">
          {meeting.participants.map((p, i) => (
            <div key={p.id} className="grid grid-cols-12 items-center gap-2 rounded-lg border border-slate-100 p-2">
              <span className="col-span-1 text-center text-xs font-bold text-slate-400">{i + 1}</span>
              <input
                className="input col-span-11 sm:col-span-4"
                placeholder="Nom (ex. Sr Marie Kabila)"
                value={p.nom}
                onChange={(e) => setParticipant(p.id, { nom: e.target.value })}
              />
              <input
                className="input col-span-12 sm:col-span-4"
                placeholder="Fonction / Congrégation"
                value={p.fonction}
                onChange={(e) => setParticipant(p.id, { fonction: e.target.value })}
              />
              <select
                className="input col-span-10 sm:col-span-2"
                value={p.statut}
                onChange={(e) => setParticipant(p.id, { statut: e.target.value as Participant["statut"] })}
              >
                <option value="present">Présent(e)</option>
                <option value="excuse">Excusé(e)</option>
                <option value="absent">Absent(e)</option>
                <option value="invite">Invité(e)</option>
              </select>
              <button
                type="button"
                aria-label="Supprimer"
                className="col-span-2 flex justify-center text-slate-400 hover:text-red-600 sm:col-span-1"
                onClick={() => set("participants", meeting.participants.filter((x) => x.id !== p.id))}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
