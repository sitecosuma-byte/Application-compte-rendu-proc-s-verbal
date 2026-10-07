/**
 * Résolution des clés API côté serveur.
 * Priorité : variable d'environnement (Vercel / .env.local) > clé envoyée par l'interface
 * (en-tête HTTP), sauf si ALLOW_CLIENT_KEYS=false.
 */
export type KeyProvider = "openai" | "groq" | "anthropic";

const ENV_NAMES: Record<KeyProvider, string> = {
  openai: "OPENAI_API_KEY",
  groq: "GROQ_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

export function resolveKey(provider: KeyProvider, req: Request): string | null {
  const envKey = process.env[ENV_NAMES[provider]];
  if (envKey) return envKey;
  if (process.env.ALLOW_CLIENT_KEYS === "false") return null;
  const headerKey = req.headers.get("x-provider-key")?.trim();
  return headerKey || null;
}

export function missingKeyMessage(provider: KeyProvider): string {
  return `Aucune clé API ${provider.toUpperCase()} configurée. Définissez ${ENV_NAMES[provider]} sur le serveur (.env.local ou Vercel) ou saisissez une clé dans « Paramètres ».`;
}
