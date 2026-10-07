# COSUMA-RDC — Application de procès-verbaux

Application de prise de notes audio/texte et de génération automatique de **procès-verbaux** et **comptes-rendus** au format Word (.docx), avec l'en-tête officiel et le logo de la COSUMA-RDC.

Elle fonctionne sur **ordinateur, tablette et smartphone** (Android et iPhone), directement dans le navigateur.

---

## Contenu du dossier

```
COSUMA-PV/
├── LISEZ-MOI.md          ← ce guide
├── index.html            ← L'APPLICATION PRÊTE À L'EMPLOI (un seul fichier)
├── logo-cosuma.png       ← logo officiel (déjà intégré dans index.html)
└── version-nextjs/       ← version « serveur » (Next.js), pour Vercel
    ├── README.md         ← guide détaillé de cette version
    ├── app/  components/  hooks/  lib/  public/
    └── package.json …
```

Deux versions au choix :

| | `index.html` (recommandée) | `version-nextjs/` |
|---|---|---|
| Installation | Aucune : un seul fichier | Node.js + `npm install` |
| Hébergement | GitHub Pages, Netlify, tout hébergement HTTPS | Vercel |
| Clés API | Saisies dans *Paramètres*, gardées dans le navigateur | Cachées côté serveur (plus sûr pour un usage public) |
| Design | Nouveau design adaptatif (PC / tablette / mobile) | Design d'origine |

---

## 1. Publier `index.html` sur GitHub Pages (le plus simple)

1. Sur GitHub, ouvrez votre dépôt (par ex. `Application-Compte-rendu-proc-s-verbaux`).
2. **Add file → Upload files** et déposez `index.html`. S'il en existe déjà un, il sera remplacé. Cliquez sur **Commit changes**.
3. Allez dans **Settings → Pages**. Sous *Source*, choisissez **Deploy from a branch**, puis la branche **main** et le dossier **/ (root)**, et cliquez sur **Save**.
4. Après 1 à 2 minutes, l'application est en ligne à une adresse comme :
   `https://adonaikanga8-a11y.github.io/Application-Compte-rendu-proc-s-verbaux/`

> **Important** : déposez le **fichier** `index.html` lui-même, pas le zip ni le dossier. Il doit se trouver à la racine du dépôt.

### Sur smartphone
- Ouvrez l'adresse dans **Chrome** (Android) ou **Safari** (iPhone).
- Menu ⋮ → **Ajouter à l'écran d'accueil** pour l'utiliser comme une application.
- Pour une longue réunion, gardez le téléphone branché ; l'écran reste allumé automatiquement.

---

## 2. Utilisation

1. **Séance** : intitulé, date, lieu, président(e), secrétaire, ordre du jour (un point par ligne), participants.
2. **Enregistrement** : choisissez le micro (interne, USB, Jack ou Bluetooth) puis appuyez sur le gros bouton rouge. Le texte apparaît au fur et à mesure et reste modifiable. Les boutons *Intervenant* indiquent qui parle.
3. **Procès-verbal** : choisissez *Compte-Rendu Synthétique* ou *Procès-Verbal Détaillé*, cliquez sur **Générer**, relisez et corrigez, puis **Télécharger en Word (.docx)**.

### Moteurs disponibles

| Usage | Sans clé (gratuit) | Avec clé API (meilleure qualité) |
|---|---|---|
| Transcription | Reconnaissance vocale du navigateur (Chrome / Edge) | **Groq Whisper** (recommandé) ou OpenAI Whisper |
| Rédaction du PV | Analyse locale (brouillon à compléter) | **Claude** (recommandé), OpenAI GPT ou Groq Llama |

Les clés se saisissent dans **Paramètres** (icône réglages) :
- Anthropic (Claude) : https://console.anthropic.com
- Groq : https://console.groq.com
- OpenAI : https://platform.openai.com

> Les clés saisies restent **dans le navigateur de l'appareil** et sont envoyées directement au fournisseur. Ne les saisissez pas sur un appareil partagé.

### Logo et en-tête
Le logo officiel est **déjà intégré**. Pour le changer, ou pour modifier le nom, le service, l'adresse ou la police du document Word, ouvrez **Paramètres → En-tête du document Word**.

### Où sont les données ?
Les séances, transcriptions, PV et enregistrements audio sont stockés **uniquement sur l'appareil**, dans le navigateur. Vider les données du site les efface : **exportez toujours vos PV en Word**.

---

## 3. Tester sur votre ordinateur (facultatif)

Le micro ne fonctionne pas si vous ouvrez le fichier par double-clic (adresse `file://`). Lancez plutôt un petit serveur local :

```bash
cd COSUMA-PV
python -m http.server 8000
```
puis ouvrez http://localhost:8000 dans Chrome.

---

## 4. Version Next.js (`version-nextjs/`)

À utiliser si vous voulez **cacher les clés API sur un serveur** (Vercel). Voir `version-nextjs/README.md`. En résumé :

```bash
cd version-nextjs
npm install
cp .env.example .env.local   # renseignez vos clés
npm run dev                  # http://localhost:3000
```

Pour Vercel, importez le dépôt, réglez **Root Directory** sur le dossier qui contient `package.json`, puis ajoutez vos clés dans *Environment Variables*.

> ⚠️ Conservez **l'arborescence des dossiers** (`app/`, `components/`, `hooks/`, `lib/`, `public/`) en déposant les fichiers sur GitHub. Si tous les fichiers se retrouvent à plat à la racine, la version Next.js ne peut pas fonctionner. Avec l'interface web de GitHub, glissez-déposez le **dossier** entier plutôt que les fichiers un par un.

---

## Dépannage

| Problème | Solution |
|---|---|
| « Accès au micro refusé » | Icône cadenas de la barre d'adresse → Micro → Autoriser. Le site doit être en **HTTPS**. |
| Le micro externe n'apparaît pas | Branchez-le, puis appuyez sur le bouton d'actualisation à côté de *Source audio*. |
| La reconnaissance vocale ne démarre pas (Android) | *Options avancées* → décochez « Archiver aussi l'audio », ou utilisez Groq Whisper. |
| « Clé API manquante » | Ajoutez la clé dans **Paramètres**. |
| L'ancienne version s'affiche encore | Rechargez la page en vidant le cache (Ctrl + Maj + R sur PC). |
| Export Word impossible | Vérifiez la connexion Internet : la bibliothèque Word est chargée en ligne. |
