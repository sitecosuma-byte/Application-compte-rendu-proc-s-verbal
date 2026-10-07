# COSUMA-RDC — Générateur de Procès-Verbaux

Application web légère et responsive (ordinateur **et** smartphone Android, dans le navigateur) pour :

1. **enregistrer** une réunion avec le micro intégré ou un micro externe (USB, Jack, Bluetooth) ;
2. **transcrire** les échanges en continu (Web Speech API gratuite, ou Whisper via OpenAI / Groq) ;
3. **rédiger automatiquement** un *Compte-Rendu Synthétique* ou un *Procès-Verbal Détaillé/Fidèle* (Claude, GPT, Llama, ou analyse locale sans IA) ;
4. **exporter** un document **Word (.docx)** officiel, avec l'en-tête et le logo de la COSUMA-RDC.

Toutes les données (séances, transcriptions, PV, enregistrements audio) sont stockées **localement** sur l'appareil (IndexedDB) avant l'export.

---

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Structure du projet](#structure-du-projet)
- [Lancement en local](#lancement-en-local)
- [Configuration des moteurs IA](#configuration-des-moteurs-ia)
- [Intégrer le logo COSUMA-RDC dans le fichier Word](#intégrer-le-logo-cosuma-rdc-dans-le-fichier-word)
- [Déploiement sur GitHub et Vercel](#déploiement-sur-github-et-vercel)
- [Utilisation sur smartphone Android](#utilisation-sur-smartphone-android)
- [Dépannage](#dépannage)

---

## Fonctionnalités

| Module | Détails |
|---|---|
| **Séance** | Intitulé, type, date, horaires, lieu, président(e), secrétaire, ordre du jour (un point par ligne), participants avec fonction/congrégation et statut (présent, excusé, absent, invité). Import d'une liste copiée depuis Excel/Word. |
| **Source audio** | Sélecteur dynamique des micros (`enumerateDevices`), mis à jour automatiquement quand un micro est branché ou débranché. Vu-mètre en direct (Web Audio API). Option « micro de conférence » pour désactiver la suppression de bruit, d'écho et le gain automatique. |
| **Enregistrement** | Démarrer / Pause / Reprendre / Arrêter, chronomètre, maintien de l'écran allumé (Wake Lock). L'audio complet est archivé dans IndexedDB : vous pouvez l'écouter, le télécharger ou le retranscrire. |
| **Transcription** | **Web Speech** : gratuite, instantanée, sans clé. **Groq / OpenAI Whisper** : segments de 15 à 90 s envoyés au fur et à mesure, avec le micro sélectionné. L'ordre des segments est préservé et un segment en échec peut être réessayé. Import d'un fichier audio (mp3, m4a, wav, ogg…), découpé dans le navigateur en morceaux de 60 s. |
| **Édition** | Zone de texte éditable en temps réel. Les boutons « Intervenant » insèrent `Nom :` pour que l'IA attribue correctement les propos. Copie et export `.txt`. |
| **Générateur de PV** | Choix *Compte-Rendu Synthétique* ou *Procès-Verbal Détaillé/Fidèle*. Moteurs : Claude (recommandé), OpenAI, Groq, ou **analyse locale hors-ligne**. Sortie structurée : résumé, corps par point de l'ordre du jour, décisions et résolutions, recommandations, plan d'action (qui fait quoi, pour quand), points divers, prochaine réunion, clôture. Chaque partie reste éditable. |
| **Export Word** | A4, marges 2,5 cm, police institutionnelle (Cambria par défaut). En-tête officiel avec logo sur la 1re page, en-tête réduit ensuite, « Page X / Y ». Titres navigables, tableaux (informations, participants, décisions, plan d'action) avec en-têtes répétés d'une page à l'autre, bloc de signatures. |
| **Stockage** | IndexedDB (séances, audio, logo, en-tête) + localStorage (préférences). Sauvegarde automatique, demande de stockage persistant, plusieurs séances. |

---

## Structure du projet

```
cosuma-pv/
├── app/
│   ├── api/
│   │   ├── generate-pv/route.ts   # Rédaction du PV (Claude / OpenAI / Groq) → JSON structuré
│   │   └── transcribe/route.ts    # Transcription d'un segment audio (Whisper OpenAI / Groq)
│   ├── globals.css                # Tailwind CSS v4 + couleurs institutionnelles
│   ├── layout.tsx
│   └── page.tsx                   # Application : séances, onglets, sauvegarde automatique
├── components/
│   ├── AudioSourceSelector.tsx    # Choix du micro + vu-mètre
│   ├── MeetingForm.tsx            # Infos de séance, ordre du jour, participants
│   ├── PVEditor.tsx               # Édition fine du PV généré
│   ├── PVGenerator.tsx            # Type de document, moteur IA, génération, export .docx
│   ├── RecorderPanel.tsx          # Contrôles d'enregistrement, file de transcription, archives
│   ├── SettingsDialog.tsx         # En-tête institutionnel, logo, police, clés API
│   └── TranscriptEditor.tsx       # Transcription éditable en temps réel
├── hooks/
│   ├── useAudioRecorder.ts        # MediaRecorder (archive + segments) + AnalyserNode
│   ├── useMediaDevices.ts         # Liste dynamique des micros, permission
│   └── useSpeechRecognition.ts    # Web Speech API continue (relance automatique)
├── lib/
│   ├── api.ts                     # Appels client → routes API
│   ├── audioFile.ts               # Décodage/rééchantillonnage/découpage WAV d'un fichier importé
│   ├── docx/
│   │   ├── generatePV.ts          # Construction du document Word (bibliothèque `docx`)
│   │   └── logo.ts                # Chargement + conversion PNG du logo
│   ├── pv/
│   │   ├── localAnalyzer.ts       # Analyse hors-ligne par règles (sans IA)
│   │   └── prompt.ts              # Consignes de rédaction + schéma JSON du PV
│   ├── serverKeys.ts              # Résolution des clés API côté serveur
│   ├── storage.ts                 # IndexedDB + localStorage
│   └── types.ts                   # Types et valeurs par défaut (en-tête COSUMA-RDC)
├── public/
│   ├── logo-cosuma.png            # Logo officiel COSUMA R.D.Congo (en-tête Word + interface)
│   └── logo-cosuma.svg            # Logo de secours (utilisé seulement si le PNG est absent)
├── .env.example
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

## Lancement en local

**Prérequis** : [Node.js](https://nodejs.org) 20 ou plus récent (LTS recommandée).

```bash
cd cosuma-pv
npm install
cp .env.example .env.local     # puis renseignez au moins une clé (facultatif)
npm run dev
```

Ouvrez <http://localhost:3000>.

> **Le micro exige un contexte sécurisé.** `localhost` est accepté. Pour tester depuis un téléphone sur le même réseau Wi-Fi, il faut du HTTPS :
> `npx next dev --experimental-https -H 0.0.0.0`, puis ouvrez `https://<IP-de-l-ordinateur>:3000` sur le téléphone et acceptez le certificat.

Production locale :

```bash
npm run build
npm start
```

Vérification des types : `npm run lint`.

---

## Configuration des moteurs IA

Sans aucune clé, l'application fonctionne déjà : transcription **Web Speech** (Chrome/Edge) et **analyse locale** pour un premier brouillon de PV. Pour une rédaction de qualité, configurez au moins une clé.

| Variable | Rôle | Où l'obtenir |
|---|---|---|
| `ANTHROPIC_API_KEY` | Rédaction du PV par Claude (recommandé pour la fidélité et le français institutionnel) | <https://console.anthropic.com> |
| `GROQ_API_KEY` | Transcription `whisper-large-v3` (très rapide, économique) + rédaction Llama 3.3 | <https://console.groq.com> |
| `OPENAI_API_KEY` | Transcription `whisper-1` + rédaction GPT | <https://platform.openai.com> |

Variables facultatives : `ANTHROPIC_MODEL` (défaut `claude-opus-5-5`), `OPENAI_TRANSCRIBE_MODEL`, `OPENAI_CHAT_MODEL`, `GROQ_TRANSCRIBE_MODEL`, `GROQ_CHAT_MODEL`, `ALLOW_CLIENT_KEYS`.

**Sécurité** : les clés définies dans les variables d'environnement restent **côté serveur** et ne sont jamais envoyées au navigateur. Les clés saisies dans *Paramètres → Clés API* sont stockées dans le navigateur de l'utilisateur et ne servent que si le serveur n'a pas de clé. Si l'application est publique et que vous fournissez vos propres clés, mettez `ALLOW_CLIENT_KEYS=false`.

**Combinaison recommandée** : transcription **Groq** + rédaction **Claude**.

---

## Intégrer le logo COSUMA-RDC dans le fichier Word

Le générateur cherche le logo dans cet ordre :

1. **Logo importé dans l'application** : *Paramètres (⚙) → En-tête institutionnel → Importer un logo* (PNG, JPEG, SVG ou WebP, 2 Mo maximum). Il est stocké sur l'appareil et utilisé immédiatement, sans redéploiement. C'est la solution idéale pour tester.
2. **`public/logo-cosuma.png`** : le logo officiel déployé avec l'application, pour tous les utilisateurs.
3. **`public/logo-cosuma.jpg`**
4. **`public/logo-cosuma.svg`** : logo de secours, utilisé seulement si aucun des fichiers précédents n'existe.

Le **logo officiel COSUMA R.D.Congo est déjà installé** dans `public/logo-cosuma.png` : aucune action n'est nécessaire. Les étapes ci-dessous servent uniquement à le **remplacer** (nouvelle version, meilleure résolution).

### Remplacer le logo pour tous les utilisateurs

1. Préparez le logo en **PNG** (fond blanc ou transparent), idéalement en haute résolution (au moins **600 px** de haut ; le logo actuel fait 286 × 403 px).
2. Nommez-le exactement **`logo-cosuma.png`**.
3. Copiez-le dans **`cosuma-pv/public/`**. Remplacez le fichier existant.
4. Faites un commit et un push : Vercel redéploie automatiquement.

### Fonctionnement technique

- `lib/docx/logo.ts` charge l'image (data URL ou fichier `public/`), la redimensionne et la **convertit en PNG via un `<canvas>`**, ce qui garantit un affichage fiable dans Word, quel que soit le format d'origine.
- `lib/docx/generatePV.ts` (fonction `officialHeader`) l'insère avec `ImageRun` dans un tableau sans bordure : logo à gauche (dans une boîte de 80 × 112 px adaptée au format portrait, proportions respectées), texte institutionnel centré à droite, puis un double filet bleu.
- Pour changer la taille du logo, modifiez `fitBox(logo, 80, 112)` (largeur, hauteur maximales) dans `officialHeader`.
- Pour afficher l'en-tête complet sur **toutes** les pages, remplacez `default: compactHeader(...)` par `default: officialHeader(org, logo)` dans `buildPVDocument`.
- Nom, sigle, service, adresse, contact, devise et police se modifient dans *Paramètres*, sans toucher au code. Les valeurs par défaut sont dans `lib/types.ts` (`DEFAULT_ORG`).

---

## Déploiement sur GitHub et Vercel

### 1. Publier le code sur GitHub

Le projet se trouve dans le sous-dossier `cosuma-pv/` de ce dépôt.

```bash
git add cosuma-pv
git commit -m "Ajout de l'application COSUMA-RDC PV"
git push origin <votre-branche>
```

Pour en faire un **dépôt séparé** :

```bash
cd cosuma-pv
git init
git add .
git commit -m "COSUMA-RDC PV Generator"
git branch -M main
git remote add origin https://github.com/<votre-compte>/cosuma-pv.git
git push -u origin main
```

Le fichier `.gitignore` exclut déjà `node_modules`, `.next` et les fichiers `.env*` contenant vos clés. **Ne commitez jamais `.env.local`.**

### 2. Déployer sur Vercel

1. Connectez-vous sur <https://vercel.com> avec votre compte GitHub.
2. Cliquez sur **Add New… → Project** et importez le dépôt.
3. **Root Directory** : si l'application est dans le sous-dossier de ce dépôt, cliquez sur *Edit* et choisissez **`cosuma-pv`**. Vercel détecte Next.js automatiquement.
4. Dans **Environment Variables**, ajoutez vos clés (`ANTHROPIC_API_KEY`, `GROQ_API_KEY`, etc.).
5. Cliquez sur **Deploy**. L'application est servie en **HTTPS**, ce qui est indispensable pour le micro sur smartphone, à une adresse du type `https://cosuma-pv.vercel.app`.
6. Chaque `git push` sur la branche principale redéploie automatiquement. Les autres branches produisent des déploiements de prévisualisation.

Alternative en ligne de commande :

```bash
npm i -g vercel
cd cosuma-pv
vercel          # premier déploiement (prévisualisation)
vercel env add ANTHROPIC_API_KEY
vercel --prod   # mise en production
```

**Limites Vercel à connaître**

- **Taille des requêtes : 4,5 Mo maximum.** L'application en tient compte : segments audio courts, fichiers importés découpés en morceaux de 60 s.
- **Durée d'exécution** : la route `/api/generate-pv` déclare `maxDuration = 300` s pour les longs PV détaillés. Sur l'offre gratuite, laissez *Fluid Compute* activé (par défaut) pour bénéficier de cette durée.
- **Domaine personnalisé** (ex. `pv.cosuma-rdc.org`) : *Project → Settings → Domains*.

---

## Utilisation sur smartphone Android

1. Ouvrez l'adresse HTTPS dans **Chrome**.
2. Menu ⋮ → **Ajouter à l'écran d'accueil** pour lancer l'application comme une app.
3. **Micro externe** : branchez le micro (USB-C, Jack ou Bluetooth), puis appuyez sur ⟳ à côté de *Source audio*.
4. Pour une réunion longue, gardez l'écran allumé (l'application le demande automatiquement) et le téléphone branché sur secteur.
5. **Moteur conseillé sur Android : Groq ou OpenAI Whisper.** Il utilise le micro choisi et n'entre pas en conflit avec l'enregistreur. Avec Web Speech, si la reconnaissance ne démarre pas, décochez *Options avancées → Archiver aussi l'audio*.

---

## Dépannage

| Problème | Solution |
|---|---|
| « Accès au micro refusé » | Icône cadenas de la barre d'adresse → Autorisations → Micro → Autoriser. Le site doit être en HTTPS (ou localhost). |
| Les noms des micros ne s'affichent pas | Cliquez sur « Autoriser le micro pour afficher les périphériques ». |
| Web Speech n'utilise pas mon micro externe | C'est une limite des navigateurs : Web Speech prend le micro par défaut du système. Utilisez Groq/Whisper ou faites du micro externe le micro par défaut. |
| Web Speech indisponible | Firefox ne la prend pas en charge : utilisez Chrome/Edge, ou Groq/Whisper. Elle nécessite aussi une connexion Internet. |
| « Aucune clé API … configurée » | Ajoutez la variable d'environnement sur Vercel (puis redéployez) ou saisissez la clé dans Paramètres. |
| Réponse tronquée | Réunion très longue : choisissez le Compte-Rendu Synthétique, ou divisez la transcription. |
| Logo absent du Word | Vérifiez le nom exact `public/logo-cosuma.png` (sensible à la casse) ou importez le logo dans Paramètres. |
| Données perdues ? | Les données vivent dans le navigateur de l'appareil : vider les données du site les efface. **Exportez systématiquement le PV en Word** et téléchargez l'audio si besoin. |
