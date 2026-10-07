"use client";
/**
 * Sélecteur dynamique de la source audio (micro interne, USB, Jack, Bluetooth…)
 * avec vu-mètre en direct.
 */
import { Mic, RefreshCw, ShieldCheck } from "lucide-react";
import { useMediaDevices } from "@/hooks/useMediaDevices";

interface Props {
  deviceId: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  level: number;
  active: boolean;
}

export default function AudioSourceSelector({ deviceId, onChange, disabled, level, active }: Props) {
  const { devices, permission, error, refresh, requestPermission } = useMediaDevices();

  return (
    <div className="space-y-2">
      <label className="label flex items-center gap-1">
        <Mic className="h-3 w-3" /> Source audio
      </label>
      <div className="flex gap-2">
        <select
          className="input"
          value={deviceId}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Micro par défaut du système</option>
          {devices
            .filter((d) => d.deviceId && d.deviceId !== "default")
            .map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
        </select>
        <button
          type="button"
          className="btn-ghost px-3"
          title="Actualiser la liste (après avoir branché un micro)"
          onClick={() => refresh()}
          disabled={disabled}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {permission !== "granted" && (
        <button type="button" className="btn-ghost w-full" onClick={requestPermission}>
          <ShieldCheck className="h-4 w-4" /> Autoriser le micro pour afficher les périphériques
        </button>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Vu-mètre */}
      <div className="flex items-center gap-2" aria-label="Niveau sonore">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full transition-[width] duration-75 ${
              level > 0.85 ? "bg-red-500" : level > 0.5 ? "bg-amber-400" : "bg-emerald-500"
            }`}
            style={{ width: `${Math.round(level * 100)}%` }}
          />
        </div>
        <span className="w-16 text-right text-[10px] uppercase text-slate-400">
          {active ? (level < 0.02 ? "silence" : "signal") : "inactif"}
        </span>
      </div>
    </div>
  );
}
