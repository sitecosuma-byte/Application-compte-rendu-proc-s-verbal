/**
 * Types partagés de l'application COSUMA-RDC « PV Generator ».
 */

/** Type de document à produire. */
export type DocType = "synthetique" | "detaille";

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  synthetique: "Compte-Rendu Synthétique",
  detaille: "Procès-Verbal Détaillé / Fidèle",
};

/** Moteur de rédaction du PV. */
export type AIProvider = "anthropic" | "openai" | "groq" | "local";

/** Moteur de transcription. */
export type TranscriptionEngine = "webspeech" | "openai" | "groq";

export interface Participant {
  id: string;
  nom: string;
  fonction: string; // fonction, congrégation / institut
  statut: "present" | "excuse" | "absent" | "invite";
}

/** Informations générales de la réunion (saisies par le secrétaire). */
export interface MeetingInfo {
  titre: string;
  typeReunion: string;
  date: string; // AAAA-MM-JJ
  heureDebut: string;
  heureFin: string;
  lieu: string;
  president: string;
  secretaire: string;
  ordreDuJour: string[];
  participants: Participant[];
}

export interface PVSection {
  titre: string;
  contenu: string; // paragraphes séparés par une ligne vide
}

export interface Decision {
  intitule: string;
  details: string;
  type: "decision" | "resolution";
}

export interface ActionItem {
  action: string;
  responsable: string;
  echeance: string;
  statut: string;
}

/** Contenu structuré du PV, produit par l'IA (ou l'analyse locale) puis éditable. */
export interface PVContent {
  titre: string;
  resumeGeneral: string;
  sections: PVSection[];
  decisions: Decision[];
  recommandations: string[];
  planAction: ActionItem[];
  pointsDivers: string;
  prochaineReunion: string;
  cloture: string;
}

/** Une séance (réunion) sauvegardée localement dans IndexedDB. */
export interface MeetingSession {
  id: string;
  createdAt: number;
  updatedAt: number;
  meeting: MeetingInfo;
  transcript: string;
  docType: DocType;
  pv: PVContent | null;
  /** Identifiants des enregistrements audio archivés (store « audio »). */
  audioIds: string[];
}

/** En-tête institutionnel (paramétrable). */
export interface OrgSettings {
  nomLong: string;
  sigle: string;
  service: string;
  adresse: string;
  contact: string;
  devise: string;
  /** Logo personnalisé (data URL PNG/JPEG/SVG). Null = /logo-cosuma.png ou .svg du dossier public. */
  logoDataUrl: string | null;
  police: string;
}

/** Préférences IA / transcription (localStorage). */
export interface AppSettings {
  transcriptionEngine: TranscriptionEngine;
  aiProvider: AIProvider;
  language: string; // ex. fr-FR
  /** Clés facultatives saisies par l'utilisateur (utilisées seulement si le serveur n'en a pas). */
  keys: { openai: string; groq: string; anthropic: string };
  /** Durée d'un segment envoyé à Whisper/Groq (secondes). */
  segmentSeconds: number;
}

export const DEFAULT_ORG: OrgSettings = {
  nomLong: "Conférence des Supérieurs Majeurs de la République Démocratique du Congo",
  sigle: "COSUMA-RDC",
  service: "Secrétariat Général",
  adresse: "Kinshasa — République Démocratique du Congo",
  contact: "",
  devise: "",
  logoDataUrl: null,
  police: "Cambria",
};

export const DEFAULT_SETTINGS: AppSettings = {
  transcriptionEngine: "webspeech",
  aiProvider: "anthropic",
  language: "fr-FR",
  keys: { openai: "", groq: "", anthropic: "" },
  segmentSeconds: 30,
};

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function emptyMeeting(): MeetingInfo {
  return {
    titre: "",
    typeReunion: "Assemblée Générale",
    date: new Date().toISOString().slice(0, 10),
    heureDebut: "",
    heureFin: "",
    lieu: "",
    president: "",
    secretaire: "",
    ordreDuJour: [],
    participants: [],
  };
}

export function emptyPV(): PVContent {
  return {
    titre: "",
    resumeGeneral: "",
    sections: [],
    decisions: [],
    recommandations: [],
    planAction: [],
    pointsDivers: "",
    prochaineReunion: "",
    cloture: "",
  };
}

export function newSession(): MeetingSession {
  const now = Date.now();
  return {
    id: uid(),
    createdAt: now,
    updatedAt: now,
    meeting: emptyMeeting(),
    transcript: "",
    docType: "detaille",
    pv: null,
    audioIds: [],
  };
}
