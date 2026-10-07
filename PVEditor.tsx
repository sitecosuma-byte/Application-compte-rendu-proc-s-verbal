"use client";
/**
 * Éditeur du PV généré : chaque partie est modifiable avant l'export Word.
 */
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { ActionItem, Decision, PVContent, PVSection } from "@/lib/types";

interface Props {
  pv: PVContent;
  onChange: (pv: PVContent) => void;
}

function move<T>(list: T[], i: number, delta: number): T[] {
  const j = i + delta;
  if (j < 0 || j >= list.length) return list;
  const copy = [...list];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

function AutoTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const rows = Math.min(20, Math.max(2, String(props.value ?? "").split("\n").length + 1));
  return <textarea rows={rows} {...props} className={`input resize-y ${props.className ?? ""}`} />;
}

function Block({ title, children, onAdd }: { title: string; children: React.ReactNode; onAdd?: () => void }) {
  return (
    <div className="space-y-2 border-t border-slate-100 pt-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif font-bold text-navy-700">{title}</h3>
        {onAdd && (
          <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={onAdd}>
            <Plus className="h-3 w-3" /> Ajouter
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function RowTools({ onUp, onDown, onDelete }: { onUp: () => void; onDown: () => void; onDelete: () => void }) {
  return (
    <div className="flex gap-1 text-slate-400">
      <button type="button" aria-label="Monter" onClick={onUp} className="rounded p-1 hover:bg-slate-100">
        <ArrowUp className="h-4 w-4" />
      </button>
      <button type="button" aria-label="Descendre" onClick={onDown} className="rounded p-1 hover:bg-slate-100">
        <ArrowDown className="h-4 w-4" />
      </button>
      <button type="button" aria-label="Supprimer" onClick={onDelete} className="rounded p-1 hover:bg-red-50 hover:text-red-600">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function PVEditor({ pv, onChange }: Props) {
  const set = <K extends keyof PVContent>(k: K, v: PVContent[K]) => onChange({ ...pv, [k]: v });

  const setSection = (i: number, patch: Partial<PVSection>) =>
    set("sections", pv.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const setDecision = (i: number, patch: Partial<Decision>) =>
    set("decisions", pv.decisions.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const setAction = (i: number, patch: Partial<ActionItem>) =>
    set("planAction", pv.planAction.map((a, j) => (j === i ? { ...a, ...patch } : a)));

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Titre du document</label>
        <input className="input font-serif font-bold" value={pv.titre} onChange={(e) => set("titre", e.target.value)} />
      </div>
      <div>
        <label className="label">Résumé général / introduction</label>
        <AutoTextarea value={pv.resumeGeneral} onChange={(e) => set("resumeGeneral", e.target.value)} />
      </div>

      <Block
        title={`Corps du document (${pv.sections.length} parties)`}
        onAdd={() => set("sections", [...pv.sections, { titre: "Nouveau point", contenu: "" }])}
      >
        {pv.sections.map((s, i) => (
          <div key={i} className="space-y-2 rounded-lg bg-slate-50 p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">{i + 1}.</span>
              <input className="input font-semibold" value={s.titre} onChange={(e) => setSection(i, { titre: e.target.value })} />
              <RowTools
                onUp={() => set("sections", move(pv.sections, i, -1))}
                onDown={() => set("sections", move(pv.sections, i, 1))}
                onDelete={() => set("sections", pv.sections.filter((_, j) => j !== i))}
              />
            </div>
            <AutoTextarea value={s.contenu} onChange={(e) => setSection(i, { contenu: e.target.value })} />
          </div>
        ))}
      </Block>

      <Block
        title={`Décisions et résolutions (${pv.decisions.length})`}
        onAdd={() => set("decisions", [...pv.decisions, { intitule: "", details: "", type: "decision" }])}
      >
        {pv.decisions.map((d, i) => (
          <div key={i} className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-12">
            <select
              className="input sm:col-span-3"
              value={d.type}
              onChange={(e) => setDecision(i, { type: e.target.value as Decision["type"] })}
            >
              <option value="decision">Décision</option>
              <option value="resolution">Résolution</option>
            </select>
            <input
              className="input sm:col-span-7"
              placeholder="Intitulé"
              value={d.intitule}
              onChange={(e) => setDecision(i, { intitule: e.target.value })}
            />
            <div className="flex justify-end sm:col-span-2">
              <RowTools
                onUp={() => set("decisions", move(pv.decisions, i, -1))}
                onDown={() => set("decisions", move(pv.decisions, i, 1))}
                onDelete={() => set("decisions", pv.decisions.filter((_, j) => j !== i))}
              />
            </div>
            <AutoTextarea
              className="sm:col-span-12"
              placeholder="Détails, modalités, mode d'adoption…"
              value={d.details}
              onChange={(e) => setDecision(i, { details: e.target.value })}
            />
          </div>
        ))}
      </Block>

      <Block title={`Recommandations (${pv.recommandations.length})`} onAdd={() => set("recommandations", [...pv.recommandations, ""])}>
        {pv.recommandations.map((r, i) => (
          <div key={i} className="flex items-start gap-2">
            <AutoTextarea
              value={r}
              onChange={(e) => set("recommandations", pv.recommandations.map((x, j) => (j === i ? e.target.value : x)))}
            />
            <RowTools
              onUp={() => set("recommandations", move(pv.recommandations, i, -1))}
              onDown={() => set("recommandations", move(pv.recommandations, i, 1))}
              onDelete={() => set("recommandations", pv.recommandations.filter((_, j) => j !== i))}
            />
          </div>
        ))}
      </Block>

      <Block
        title={`Plan d'action — qui fait quoi, pour quand (${pv.planAction.length})`}
        onAdd={() =>
          set("planAction", [...pv.planAction, { action: "", responsable: "", echeance: "", statut: "À faire" }])
        }
      >
        {pv.planAction.map((a, i) => (
          <div key={i} className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-12">
            <AutoTextarea
              className="sm:col-span-12"
              placeholder="Action"
              value={a.action}
              onChange={(e) => setAction(i, { action: e.target.value })}
            />
            <input
              className="input sm:col-span-4"
              placeholder="Responsable"
              value={a.responsable}
              onChange={(e) => setAction(i, { responsable: e.target.value })}
            />
            <input
              className="input sm:col-span-3"
              placeholder="Échéance"
              value={a.echeance}
              onChange={(e) => setAction(i, { echeance: e.target.value })}
            />
            <select
              className="input sm:col-span-3"
              value={a.statut}
              onChange={(e) => setAction(i, { statut: e.target.value })}
            >
              {Array.from(new Set(["À faire", "En cours", "Réalisé", "Reporté", a.statut])).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <div className="flex justify-end sm:col-span-2">
              <RowTools
                onUp={() => set("planAction", move(pv.planAction, i, -1))}
                onDown={() => set("planAction", move(pv.planAction, i, 1))}
                onDelete={() => set("planAction", pv.planAction.filter((_, j) => j !== i))}
              />
            </div>
          </div>
        ))}
      </Block>

      <Block title="Points divers">
        <AutoTextarea value={pv.pointsDivers} onChange={(e) => set("pointsDivers", e.target.value)} />
      </Block>
      <Block title="Prochaine réunion">
        <AutoTextarea value={pv.prochaineReunion} onChange={(e) => set("prochaineReunion", e.target.value)} />
      </Block>
      <Block title="Clôture">
        <AutoTextarea value={pv.cloture} onChange={(e) => set("cloture", e.target.value)} />
      </Block>
    </div>
  );
}
