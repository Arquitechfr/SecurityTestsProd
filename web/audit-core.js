'use strict';

// ── PIN ─────────────────────────────────────────────────────────────────────────

export const ITERATIONS = 100000;
export const PIN_HASH = 'f35eb5b500b74ab9795eb36e339cb28c91cb1bab8b2485fd92e47b9e5d3d536b'; // default PIN: 0000

export async function sha256(input, iterations = 1) {
  let buf = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  for (let i = 0; i < iterations; i++) {
    buf = await crypto.subtle.digest('SHA-256', buf);
  }
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPin() {
  const inputs = document.querySelectorAll('.pin-digit');
  const code = Array.from(inputs).map(i => i.value).join('');
  if (code.length !== 4 || !/^\d{4}$/.test(code)) {
    document.getElementById('pin-error').textContent = 'Veuillez saisir 4 chiffres.';
    return false;
  }
  try {
    const hash = await sha256(code, ITERATIONS);
    if (hash === PIN_HASH) {
      document.getElementById('pin-overlay').style.display = 'none';
      document.getElementById('main-content').style.display = 'block';
      document.getElementById('lbl-date').textContent = new Date().toLocaleString('fr-FR');
      return true;
    } else {
      document.getElementById('pin-error').textContent = 'Code incorrect.';
      inputs.forEach(i => { i.value = ''; });
      inputs[0].focus();
      return false;
    }
  } catch (e) {
    document.getElementById('pin-error').textContent = 'Erreur de vérification (contexte non sécurisé ?)';
    return false;
  }
}

export function setupPinInputs() {
  const inputs = document.querySelectorAll('.pin-digit');
  inputs.forEach((input, idx) => {
    input.addEventListener('input', (e) => {
      const val = e.target.value.replace(/\D/g, '');
      e.target.value = val;
      if (val) {
        input.classList.add('filled');
        if (idx < inputs.length - 1) {
          inputs[idx + 1].focus();
        } else {
          verifyPin();
        }
      } else {
        input.classList.remove('filled');
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && idx > 0) {
        inputs[idx - 1].focus();
      }
      if (e.key === 'Enter') verifyPin();
    });
  });
  inputs[0].addEventListener('paste', (e) => {
    e.preventDefault();
    const paste = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 4);
    paste.split('').forEach((ch, i) => { if (inputs[i]) inputs[i].value = ch; });
    (inputs[paste.length - 1] || inputs[3]).focus();
    if (paste.length === 4) verifyPin();
  });
  inputs[0]?.focus();
}

// ── Config ────────────────────────────────────────────────────────────────────

export const TIMEOUT_MS   = 6000;
export const BODY_MAX     = 1024;
export const PREVIEW_MAX  = 180;

export const BRUTE_DIRS = [
  'admin', 'backend', 'mobile', 'landingpage', 'web', 'packages',
  'src', 'dist', 'build', 'public', 'assets', 'scripts',
  'api', 'app', 'server', 'client', 'frontend', 'docs',
];

export const BRUTE_FILES = [
  { path: '.env',                   severity: 'CRITIQUE', desc: "Variables d'environnement" },
  { path: '.env.local',             severity: 'CRITIQUE', desc: 'Variables locales' },
  { path: '.env.production',        severity: 'CRITIQUE', desc: 'Variables production' },
  { path: '.env.production.local',  severity: 'CRITIQUE', desc: 'Variables prod locales' },
  { path: '.env.development',       severity: 'ÉLEVÉ',    desc: 'Variables dev' },
  { path: '.env.development.local', severity: 'CRITIQUE', desc: 'Variables dev locales' },
  { path: '.env.staging',           severity: 'ÉLEVÉ',    desc: 'Variables staging' },
  { path: '.env.test',              severity: 'MOYEN',    desc: 'Variables test' },
  { path: '.env.test.local',        severity: 'MOYEN',    desc: 'Variables test locales' },
  { path: '.env.example',           severity: 'FAIBLE',   desc: 'Variables exemple' },
  { path: 'config.json',            severity: 'MOYEN',    desc: 'Config JSON' },
  { path: 'config.js',              severity: 'MOYEN',    desc: 'Config JS' },
  { path: 'secrets.json',           severity: 'CRITIQUE', desc: 'Secrets JSON' },
  { path: 'credentials.json',       severity: 'CRITIQUE', desc: 'Credentials JSON' },
  { path: 'package.json',           severity: 'FAIBLE',   desc: 'Manifeste NPM' },
  { path: 'tsconfig.json',          severity: 'FAIBLE',   desc: 'Config TypeScript' },
  { path: 'dump.sql',               severity: 'CRITIQUE', desc: 'Dump SQL' },
  { path: 'backup.sql',             severity: 'CRITIQUE', desc: 'Backup SQL' },
  { path: 'app.log',                severity: 'MOYEN',    desc: 'Log applicatif' },
  { path: 'error.log',              severity: 'MOYEN',    desc: "Log d'erreurs" },
];

function generateBruteTargets() {
  const targets = [];
  for (const dir of BRUTE_DIRS) {
    for (const file of BRUTE_FILES) {
      targets.push({ path: `${dir}/${file.path}`, severity: file.severity, desc: file.desc });
    }
  }
  return targets;
}

const BRUTE_TARGETS = generateBruteTargets();

export const BASE_TARGETS = [
  { path: '.env',                   severity: 'CRITIQUE', desc: "Variables d'environnement" },
  { path: '.env.local',             severity: 'CRITIQUE', desc: 'Variables locales' },
  { path: '.env.development',       severity: 'ÉLEVÉ',    desc: 'Variables dev' },
  { path: '.env.development.local', severity: 'CRITIQUE', desc: 'Variables dev locales' },
  { path: '.env.production',        severity: 'CRITIQUE', desc: 'Variables production' },
  { path: '.env.production.local',  severity: 'CRITIQUE', desc: 'Variables prod locales' },
  { path: '.env.staging',           severity: 'ÉLEVÉ',    desc: 'Variables staging' },
  { path: '.env.test',              severity: 'MOYEN',    desc: 'Variables test' },
  { path: '.env.test.local',        severity: 'MOYEN',    desc: 'Variables test locales' },
  { path: '.env.example',           severity: 'FAIBLE',   desc: 'Variables exemple' },
  { path: '.env.bak',               severity: 'CRITIQUE', desc: 'Backup .env' },
  { path: 'secrets.json',           severity: 'CRITIQUE', desc: 'Fichier secrets JSON' },
  { path: 'credentials.json',       severity: 'CRITIQUE', desc: 'Credentials JSON' },
  { path: 'serviceAccountKey.json', severity: 'CRITIQUE', desc: 'Service account Firebase/GCP' },
  { path: 'firebase-adminsdk.json', severity: 'CRITIQUE', desc: 'Admin SDK Firebase' },
  { path: 'gcp-credentials.json',   severity: 'CRITIQUE', desc: 'Credentials GCP' },
  { path: 'config.json',            severity: 'MOYEN',    desc: 'Config JSON' },
  { path: 'config.js',              severity: 'MOYEN',    desc: 'Config JS' },
  { path: 'app.config.js',          severity: 'FAIBLE',   desc: 'Config applicative' },
  { path: 'package.json',           severity: 'FAIBLE',   desc: 'Manifeste NPM' },
  { path: '.npmrc',                 severity: 'ÉLEVÉ',    desc: 'Config NPM (auth tokens)' },
  { path: '.yarnrc.yml',            severity: 'MOYEN',    desc: 'Config Yarn' },
  { path: '.git/config',            severity: 'ÉLEVÉ',    desc: 'Config git (expose remotes/credentials)' },
  { path: '.git/HEAD',              severity: 'MOYEN',    desc: 'HEAD git' },
  { path: '.gitignore',             severity: 'INFO',     desc: 'Révèle la structure du projet' },
  { path: 'vite.config.js',         severity: 'MOYEN',    desc: 'Config Vite' },
  { path: 'vite.config.ts',         severity: 'MOYEN',    desc: 'Config Vite TS' },
  { path: 'webpack.config.js',      severity: 'MOYEN',    desc: 'Config Webpack' },
  { path: 'next.config.js',         severity: 'MOYEN',    desc: 'Config Next.js' },
  { path: 'tsconfig.json',          severity: 'FAIBLE',   desc: 'Config TypeScript' },
  { path: 'database.json',          severity: 'CRITIQUE', desc: 'Config / données BDD' },
  { path: 'db.json',                severity: 'CRITIQUE', desc: 'Données BDD locale' },
  { path: 'dump.sql',               severity: 'CRITIQUE', desc: 'Dump SQL' },
  { path: 'backup.sql',             severity: 'CRITIQUE', desc: 'Backup SQL' },
  { path: '.aws/credentials',       severity: 'CRITIQUE', desc: 'Credentials AWS' },
  { path: '.aws/config',            severity: 'ÉLEVÉ',    desc: 'Config AWS' },
  { path: 'docker-compose.yml',     severity: 'MOYEN',    desc: 'Docker Compose' },
  { path: 'docker-compose.yaml',    severity: 'MOYEN',    desc: 'Docker Compose' },
  { path: 'nginx.conf',             severity: 'ÉLEVÉ',    desc: 'Config Nginx (expose routing/ports)' },
  { path: '.htaccess',              severity: 'MOYEN',    desc: 'Config Apache' },
  { path: 'web.config',             severity: 'MOYEN',    desc: 'Config IIS' },
  { path: '.ssh/id_rsa',            severity: 'CRITIQUE', desc: 'Clé privée SSH RSA' },
  { path: '.ssh/id_ed25519',        severity: 'CRITIQUE', desc: 'Clé privée SSH Ed25519' },
  { path: 'app.log',                severity: 'MOYEN',    desc: 'Log applicatif' },
  { path: 'error.log',              severity: 'MOYEN',    desc: "Log d'erreurs" },
  { path: 'backend/.env',                    severity: 'CRITIQUE', desc: 'Backend env' },
  { path: 'backend/.env.local',              severity: 'CRITIQUE', desc: 'Backend env local' },
  { path: 'backend/.env.production',         severity: 'CRITIQUE', desc: 'Backend env production' },
  { path: 'backend/.env.production.local',   severity: 'CRITIQUE', desc: 'Backend env prod local' },
  { path: 'backend/.env.development',        severity: 'ÉLEVÉ',    desc: 'Backend env dev' },
  { path: 'backend/.env.development.local',  severity: 'CRITIQUE', desc: 'Backend env dev local' },
  { path: 'backend/ecosystem.config.cjs',    severity: 'ÉLEVÉ',    desc: 'Backend PM2 config' },
  { path: 'backend/src/helpers/config.ts',   severity: 'MOYEN',    desc: 'Backend config helper' },
  { path: 'backend/src/helpers/auth.ts',     severity: 'MOYEN',    desc: 'Backend auth helper' },
  { path: 'backend/scripts/detect_duplicates.ts', severity: 'FAIBLE', desc: 'Backend script' },
  { path: 'mobile/.env',                   severity: 'CRITIQUE', desc: 'Mobile env' },
  { path: 'mobile/.env.local',             severity: 'CRITIQUE', desc: 'Mobile env local' },
  { path: 'mobile/.env.production',          severity: 'CRITIQUE', desc: 'Mobile env production' },
  { path: 'mobile/app.json',               severity: 'FAIBLE',   desc: 'Mobile Expo config' },
  { path: 'mobile/eas.json',               severity: 'FAIBLE',   desc: 'Mobile EAS config' },
  { path: 'landingpage/.env',              severity: 'CRITIQUE', desc: 'Landing env' },
  { path: 'landingpage/.env.local',        severity: 'CRITIQUE', desc: 'Landing env local' },
  { path: 'landingpage/.env.production',   severity: 'CRITIQUE', desc: 'Landing env production' },
  { path: 'web/.env',                      severity: 'CRITIQUE', desc: 'Web env' },
  { path: 'web/.env.local',                severity: 'CRITIQUE', desc: 'Web env local' },
  { path: 'web/.env.production',           severity: 'CRITIQUE', desc: 'Web env production' },
  { path: 'packages/shared-types/.env',    severity: 'CRITIQUE', desc: 'Shared env' },
  { path: '.npmrc',                        severity: 'ÉLEVÉ',    desc: 'Config NPM (auth tokens)' },
  { path: 'pnpm-lock.yaml',                severity: 'INFO',     desc: 'Lock pnpm' },
  { path: 'pnpm-workspace.yaml',           severity: 'INFO',     desc: 'Workspace pnpm' },
];

export const TARGETS = [...BASE_TARGETS, ...BRUTE_TARGETS];

// ── Helpers ────────────────────────────────────────────────────────────────────

export function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function maskEnvContent(text) {
  return text.replace(
    /^([A-Z_][A-Z0-9_]*)\s*=\s*(.+)$/gm,
    (_, k, v) => v.trim().length > 4
      ? `${k}=${'*'.repeat(Math.min(v.trim().length, 10))}[MASKED]`
      : `${k}=${v}`
  );
}

const SECRET_PATTERNS = [
  { name: 'URL avec credentials',   re: /(?:mongodb|postgres|mysql|redis|amqp):\/\/[^:]+:[^@\s]{4,}@/i },
  { name: 'Clé AWS',              re: /AKIA[0-9A-Z]{16}/ },
  { name: 'Clé privée PEM',       re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'Token GitHub',         re: /ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{59}/ },
  { name: 'Clé Stripe',           re: /(?:sk|pk|rk)_(?:test|live)_[a-zA-Z0-9]{20,}/ },
  { name: 'JWT',                  re: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/ },
  { name: 'Token/Password .env',  re: /^(?:TOKEN|SECRET|PASSWORD|PASSWD|PRIVATE_KEY|API_KEY)\s*=\s*.{8,}/im },
  { name: 'Firebase API key',     re: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'Slack token',          re: /xox[bpors]-[0-9A-Za-z-]{10,}/ },
  { name: 'Twilio key',           re: /SK[0-9a-fA-F]{32}/ },
  { name: 'Clé OpenAI',           re: /sk-[a-zA-Z0-9_-]{20,}/ },
  { name: 'Clé SendGrid',         re: /SG\.[a-zA-Z0-9_-]{22,}/ },
  { name: 'Clé Mailgun',          re: /key-[a-zA-Z0-9]{32}/ },
  { name: 'Token HuggingFace',    re: /hf_[a-zA-Z0-9]{34,}/ },
  { name: 'Token GitLab',         re: /glpat-[a-zA-Z0-9_-]{20,}/ },
  { name: 'Clé Heroku',           re: /heroku_[a-zA-Z0-9]{20,}/ },
  { name: 'Client secret Google', re: /[0-9a-zA-Z_-]{24}\.apps\.googleusercontent\.com/ },
  { name: 'Token Bearer',         re: /Bearer\s+[a-zA-Z0-9_-]{20,}/ },
  { name: 'Clé Azure',            re: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/ },
];

export function detectSecrets(text) {
  if (!text) return [];
  return SECRET_PATTERNS
    .map(p => {
      const m = p.re.exec(text);
      if (!m) return null;
      const raw = m[0].slice(0, 80);
      const masked = raw.length > 20 ? raw.slice(0, 10) + '***[MASKED]' : raw.replace(/./g, '*');
      return { name: p.name, masked };
    })
    .filter(Boolean);
}

export async function readBody(response) {
  if (!response.body) return '';
  const reader  = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let text = '';
  let total = 0;
  try {
    while (total < BODY_MAX) {
      const { done, value } = await reader.read();
      if (done) break;
      text  += decoder.decode(value, { stream: true });
      total += value.length;
    }
    text += decoder.decode();
    reader.cancel().catch(() => {});
  } catch (_) { /* body closed early, fine */ }
  return text;
}

export function isSPAFallback(text, contentType) {
  if (!(contentType || '').toLowerCase().includes('text/html')) return false;
  const t = text.trim().toLowerCase();
  return t.startsWith('<!doctype') || t.startsWith('<html');
}

export async function checkTarget(target, signal) {
  const url = `${window.location.origin}/${target.path}`;
  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      cache:  'no-store',
      signal,
      headers: { Accept: '*/*' },
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    return { kind: 'error', message: err.message };
  }

  const { status }      = response;
  const contentType     = response.headers.get('content-type') || '';

  if (status === 401 || status === 403) return { kind: 'protected', status };
  if (status === 404 || status === 410) return { kind: 'safe',      status };

  if (status === 200) {
    const text = await readBody(response);
    if (isSPAFallback(text, contentType)) return { kind: 'safe', status, note: 'SPA fallback (index.html retourné)' };
    const isDangerous = target.severity === 'CRITIQUE' || target.severity === 'ÉLEVÉ';
    const preview = maskEnvContent(text).slice(0, PREVIEW_MAX).trim();
    const secrets = detectSecrets(text);
    return { kind: isDangerous ? 'exposed' : 'warning', status, contentType, preview, secrets };
  }

  return { kind: 'warning', status, note: `HTTP ${status}` };
}
