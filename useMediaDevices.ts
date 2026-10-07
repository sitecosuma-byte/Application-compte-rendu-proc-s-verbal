"use client";
/**
 * Liste dynamiquement les microphones disponibles (interne, USB, Jack, Bluetooth…).
 *
 * - Les libellés des périphériques ne sont visibles qu'après autorisation du micro :
 *   `requestPermission()` ouvre brièvement un flux puis le referme.
 * - L'évènement `devicechange` met la liste à jour lorsqu'un micro est branché/débranché.
 */
import { useCallback, useEffect, useState } from "react";

export interface MicDevice {
  deviceId: string;
  label: string;
}

export type PermissionState = "unknown" | "granted" | "denied" | "unsupported";

export function useMediaDevices() {
  const [devices, setDevices] = useState<MicDevice[]>([]);
  const [permission, setPermission] = useState<PermissionState>("unknown");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setPermission("unsupported");
      return;
    }
    const list = await navigator.mediaDevices.enumerateDevices();
    const mics = list
      .filter((d) => d.kind === "audioinput")
      .map((d, i) => ({
        deviceId: d.deviceId,
        label: d.label || (d.deviceId === "default" ? "Micro par défaut" : `Microphone ${i + 1}`),
      }));
    setDevices(mics);
    if (mics.some((m) => m.label && !m.label.startsWith("Microphone "))) setPermission("granted");
  }, []);

  const requestPermission = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermission("unsupported");
      setError(
        "Ce navigateur ne permet pas l'accès au micro. Utilisez Chrome/Edge/Firefox récents, en HTTPS (ou localhost).",
      );
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setPermission("granted");
      await refresh();
      return true;
    } catch (e) {
      setPermission("denied");
      setError(
        e instanceof Error && e.name === "NotAllowedError"
          ? "Accès au micro refusé. Autorisez le micro dans les paramètres du site (icône cadenas)."
          : `Impossible d'accéder au micro : ${(e as Error).message}`,
      );
      return false;
    }
  }, [refresh]);

  useEffect(() => {
    refresh().catch(() => undefined);
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return;
    const onChange = () => refresh().catch(() => undefined);
    md.addEventListener("devicechange", onChange);
    return () => md.removeEventListener("devicechange", onChange);
  }, [refresh]);

  return { devices, permission, error, refresh, requestPermission };
}
