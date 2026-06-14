# SecurityTestsProd

Outils d'audit de sécurité légers, sans dépendance, pour détecter les fichiers sensibles exposés ou mal protégés.

## Structure

- `backend/security-check.js` — Audit backend (Node.js, terminal)
- `web/index.html` + `web/security-audit.js` — Audit frontend (navigateur)

## Fonctionnalités

- **Scan local** : détecte la présence de fichiers sensibles (`.env`, clés, dumps SQL, etc.)
- **Scan distant** : teste l'accessibilité publique de ces fichiers via HTTP
- **Détection de secrets** : repère les patterns connus (AWS, Stripe, JWT, Firebase, etc.)
- **Vérification des permissions** : signale les fichiers world-readable (Unix)
- **Auto-correction** : corrige les permissions (`--correction`)
- **Export IA** : génère un prompt pour analyse par LLM (`--ai-prompt`)

## Utilisation backend

```bash
node backend/security-check.js
```

Avec audit distant :
```bash
node backend/security-check.js https://api.exemple.com
```

Options :
- `--correction` — corrige automatiquement les permissions
- `--ai-prompt` — exporte un rapport pour LLM

## Utilisation frontend

1. Servir `web/index.html` via un serveur web (pas `file://`)
2. Saisir le code PIN à 4 chiffres
3. Cliquer sur **Lancer l'audit**

> **Attention** : supprimer les fichiers web après usage. Ils ne doivent pas rester en production.

## Générer le hash PIN

Le frontend est protégé par un code PIN à 4 chiffres (hash SHA-256 itéré 100 000 fois). Pour définir votre propre PIN :

**Windows (PowerShell)** :
```powershell
.\scripts\generate-pin-hash.ps1 1234
```

**Linux / macOS (Bash)** :
```bash
./scripts/generate-pin-hash.sh 1234
```

**Cross-platform (Node.js)** :
```bash
node scripts/generate-pin-hash.js 1234
```

Copiez le hash généré dans `web/security-audit.js` et `web/index.html` (remplacez la valeur de `PIN_HASH`).

## Fichiers couverts

- Variables d'environnement (`.env`, `.env.local`, `.env.production`...)
- Clés et credentials (`secrets.json`, `credentials.json`, clés SSH, AWS...)
- Configurations build (`vite.config.js`, `webpack.config.js`, `next.config.js`)
- Bases de données (`dump.sql`, `backup.sql`, `db.json`)
- Infra (`docker-compose.yml`, `nginx.conf`, `.htaccess`)
- Logs (`app.log`, `error.log`)

## Avertissement

Ces outils sont destinés à l'audit de vos propres applications. Ne les utilisez pas sur des systèmes que vous ne contrôlez pas.
