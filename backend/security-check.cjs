#!/usr/bin/env node
// security-check.js — Audit sécurité backend (Node.js, zéro dépendance)
// Usage : node security-check.js [--correction] [--ai-prompt]
//         (définir API_URL ci-dessous pour l'audit distant)
'use strict';

const fs   = require('fs');
const path = require('path');
const http  = require('http');
const https = require('https');

// ── Config ────────────────────────────────────────────────────────────────────

/** URL de l'API à auditer (laisser vide pour audit local uniquement) */
const API_URL = ''; // ex: 'https://api.getpato.com'

// ── ANSI colors ───────────────────────────────────────────────────────────────

const C = {
  reset  : '\x1b[0m',
  bold   : '\x1b[1m',
  red    : '\x1b[31m',
  yellow : '\x1b[33m',
  green  : '\x1b[32m',
  cyan   : '\x1b[36m',
  blue   : '\x1b[34m',
  gray   : '\x1b[90m',
  white  : '\x1b[97m',
};

/** @param {string} color @param {string} text */
const col = (color, text) => `${color}${text}${C.reset}`;

// ── Targets ───────────────────────────────────────────────────────────────────

const COMMON_DIR_CANDIDATES = [
  'admin', 'backend', 'mobile', 'landingpage', 'web', 'packages',
  'src', 'dist', 'build', 'public', 'assets', 'scripts',
  'api', 'app', 'server', 'client', 'frontend', 'docs',
];

const BRUTE_FILES = [
  { path: '.env',                   severity: 'CRITIQUE', desc: 'Variables env' },
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
  { path: 'error.log',              severity: 'MOYEN',    desc: 'Log d\'erreurs' },
];

/** @type {{ path: string, severity: string, desc: string }[]} */
const BASE_TARGETS = [
  // ENV
  { path: '.env',                   severity: 'CRITIQUE', desc: 'Variables d\'environnement' },
  { path: '.env.local',             severity: 'CRITIQUE', desc: 'Variables locales' },
  { path: '.env.development',       severity: 'ÉLEVÉ',    desc: 'Variables dev' },
  { path: '.env.development.local', severity: 'CRITIQUE', desc: 'Variables dev locales' },
  { path: '.env.production',        severity: 'CRITIQUE', desc: 'Variables production' },
  { path: '.env.production.local',  severity: 'CRITIQUE', desc: 'Variables prod locales' },
  { path: '.env.staging',           severity: 'ÉLEVÉ',    desc: 'Variables staging' },
  { path: '.env.test',              severity: 'MOYEN',    desc: 'Variables test' },
  { path: '.env.bak',               severity: 'CRITIQUE', desc: 'Backup .env' },
  // SECRETS
  { path: 'secrets.json',           severity: 'CRITIQUE', desc: 'Fichier secrets JSON' },
  { path: 'credentials.json',       severity: 'CRITIQUE', desc: 'Credentials JSON' },
  { path: 'serviceAccountKey.json', severity: 'CRITIQUE', desc: 'Service account Firebase/GCP' },
  { path: 'firebase-adminsdk.json', severity: 'CRITIQUE', desc: 'Admin SDK Firebase' },
  { path: 'gcp-credentials.json',   severity: 'CRITIQUE', desc: 'Credentials GCP' },
  // CONFIG
  { path: 'config.json',            severity: 'MOYEN',    desc: 'Config JSON' },
  { path: 'config.js',              severity: 'MOYEN',    desc: 'Config JS' },
  { path: 'app.config.js',          severity: 'FAIBLE',   desc: 'Config applicative' },
  // PACKAGE
  { path: 'package.json',           severity: 'FAIBLE',   desc: 'Manifeste NPM' },
  { path: '.npmrc',                 severity: 'ÉLEVÉ',    desc: 'Config NPM (auth tokens)' },
  { path: '.yarnrc.yml',            severity: 'MOYEN',    desc: 'Config Yarn' },
  // GIT
  { path: '.git/config',            severity: 'ÉLEVÉ',    desc: 'Config git (expose remotes/credentials)' },
  { path: '.git/HEAD',              severity: 'MOYEN',    desc: 'HEAD git' },
  { path: '.gitignore',             severity: 'INFO',     desc: 'Révèle la structure du projet' },
  // BUILD
  { path: 'vite.config.js',         severity: 'MOYEN',    desc: 'Config Vite' },
  { path: 'vite.config.ts',         severity: 'MOYEN',    desc: 'Config Vite TS' },
  { path: 'webpack.config.js',      severity: 'MOYEN',    desc: 'Config Webpack' },
  { path: 'next.config.js',         severity: 'MOYEN',    desc: 'Config Next.js' },
  // DATABASE
  { path: 'database.json',          severity: 'CRITIQUE', desc: 'Config / données BDD' },
  { path: 'db.json',                severity: 'CRITIQUE', desc: 'Données BDD locale' },
  { path: 'dump.sql',               severity: 'CRITIQUE', desc: 'Dump SQL' },
  { path: 'backup.sql',             severity: 'CRITIQUE', desc: 'Backup SQL' },
  // CLOUD
  { path: '.aws/credentials',       severity: 'CRITIQUE', desc: 'Credentials AWS' },
  { path: '.aws/config',            severity: 'ÉLEVÉ',    desc: 'Config AWS' },
  // INFRA
  { path: 'docker-compose.yml',     severity: 'MOYEN',    desc: 'Docker Compose' },
  { path: 'docker-compose.yaml',    severity: 'MOYEN',    desc: 'Docker Compose' },
  { path: 'nginx.conf',             severity: 'ÉLEVÉ',    desc: 'Config Nginx (expose routing/ports)' },
  { path: '.htaccess',              severity: 'MOYEN',    desc: 'Config Apache' },
  // SSH
  { path: '.ssh/id_rsa',            severity: 'CRITIQUE', desc: 'Clé privée SSH RSA' },
  { path: '.ssh/id_ed25519',        severity: 'CRITIQUE', desc: 'Clé privée SSH Ed25519' },
  // LOGS
  { path: 'app.log',                severity: 'MOYEN',    desc: 'Log applicatif' },
  { path: 'error.log',              severity: 'MOYEN',    desc: 'Log d\'erreurs' },
  { path: 'access.log',             severity: 'FAIBLE',   desc: 'Log d\'accès' },
];

function generateBruteTargets(dirs) {
  const targets = [];
  for (const dir of dirs) {
    for (const file of BRUTE_FILES) {
      targets.push({ path: `${dir}/${file.path}`, severity: file.severity, desc: file.desc });
    }
  }
  return targets;
}

/** Deduplicate by path */
function makeUniqueTargets(list) {
  const seen = new Map();
  for (const t of list) {
    if (!seen.has(t.path)) seen.set(t.path, t);
  }
  return Array.from(seen.values());
}

function discoverLocalDirs() {
  const found = new Set();
  try {
    const entries = fs.readdirSync(process.cwd(), { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
        found.add(e.name);
      }
    }
  } catch (_) {}
  for (const dir of COMMON_DIR_CANDIDATES) {
    if (found.has(dir)) continue;
    try {
      const stat = fs.statSync(path.join(process.cwd(), dir));
      if (stat.isDirectory()) found.add(dir);
    } catch (_) {}
  }
  return Array.from(found);
}

async function discoverRootDirs(baseUrl) {
  const found = new Set();
  if (!baseUrl) return Array.from(found);

  try {
    const result = await httpGet(baseUrl.replace(/\/$/, '') + '/');
    if (result.status === 200 && result.body) {
      const regex = /<a[^>]+href=["']([^"']+\/?)["']/gi;
      let m;
      while ((m = regex.exec(result.body)) !== null) {
        const href = m[1].replace(/^\.\//, '').replace(/\/$/, '');
        if (href && !href.includes('/') && !href.startsWith('.') && !href.includes(':')) {
          found.add(href);
        }
      }
    }
  } catch (_) {}

  for (const dir of COMMON_DIR_CANDIDATES) {
    if (found.has(dir)) continue;
    try {
      const result = await httpGet(`${baseUrl.replace(/\/$/, '')}/${dir}/`);
      if (result.status === 200 || result.status === 403) {
        found.add(dir);
      }
    } catch (_) {}
  }

  return Array.from(found);
}

// ── Secret detection patterns ────────────────────────────────────────────────

const SECRET_PATTERNS = [
  { name: 'URL avec credentials',   re: /(?:mongodb|postgres|mysql|redis|amqp):\/\/[^:]+:[^@\s]{4,}@/i   },
  { name: 'Clé AWS',                re: /AKIA[0-9A-Z]{16}/                                                 },
  { name: 'Clé privée PEM',         re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/               },
  { name: 'Token GitHub',           re: /ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{59}/                },
  { name: 'Clé Stripe',             re: /(?:sk|pk|rk)_(?:test|live)_[a-zA-Z0-9]{20,}/                    },
  { name: 'JWT',                    re: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/ },
  { name: 'Token/Password .env',    re: /^(?:TOKEN|SECRET|PASSWORD|PASSWD|PRIVATE_KEY|API_KEY)\s*=\s*.{8,}/im },
  { name: 'Firebase API key',       re: /AIza[0-9A-Za-z_-]{35}/                                           },
  { name: 'Slack token',            re: /xox[bpors]-[0-9A-Za-z-]{10,}/                                    },
  { name: 'Twilio key',             re: /SK[0-9a-fA-F]{32}/                                               },
  { name: 'Clé OpenAI',             re: /sk-[a-zA-Z0-9_-]{20,}/                                            },
  { name: 'Clé SendGrid',           re: /SG\.[a-zA-Z0-9_-]{22,}/                                           },
  { name: 'Clé Mailgun',            re: /key-[a-zA-Z0-9]{32}/                                              },
  { name: 'Token HuggingFace',      re: /hf_[a-zA-Z0-9]{34,}/                                             },
  { name: 'Token GitLab',           re: /glpat-[a-zA-Z0-9_-]{20,}/                                        },
  { name: 'Clé Heroku',             re: /heroku_[a-zA-Z0-9]{20,}/                                         },
  { name: 'Client secret Google',   re: /[0-9a-zA-Z_-]{24}\.apps\.googleusercontent\.com/                 },
  { name: 'Token Bearer',           re: /Bearer\s+[a-zA-Z0-9_-]{20,}/                                      },
  { name: 'Clé Azure',              re: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/    },
];

// ── Local file checks ─────────────────────────────────────────────────────────

/**
 * Returns file mode as octal string + world/group read flags.
 * Returns null on error or if not on Unix.
 */
function getPermissions(fullPath) {
  if (process.platform === 'win32') return null;
  try {
    const stat   = fs.statSync(fullPath);
    const mode   = stat.mode;
    return {
      octal:      (mode & 0o777).toString(8).padStart(3, '0'),
      worldRead:  (mode & 0o004) !== 0,
      worldWrite: (mode & 0o002) !== 0,
      worldExec:  (mode & 0o001) !== 0,
      uid:        stat.uid,
      gid:        stat.gid,
      size:       stat.size,
    };
  } catch { return null; }
}

/** Reads up to maxBytes from file, returns string */
function readPartial(fullPath, maxBytes = 10240) {
  let fd;
  try {
    fd        = fs.openSync(fullPath, 'r');
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) return null;
    const len  = Math.min(stat.size, maxBytes);
    const buf  = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, 0);
    return buf.toString('utf8');
  } catch { return null; }
  finally { if (fd !== undefined) try { fs.closeSync(fd); } catch { /* noop */ } }
}

/** Scan content for known secret patterns */
function detectSecrets(content) {
  if (!content) return [];
  return SECRET_PATTERNS
    .map(p => {
      const m = p.re.exec(content);
      if (!m) return null;
      // Mask the matched value partially
      const raw = m[0].slice(0, 80);
      const masked = raw.length > 20
        ? raw.slice(0, 10) + '***[MASKED]'
        : raw.replace(/./g, '*');
      return { name: p.name, masked };
    })
    .filter(Boolean);
}

function checkLocalFile(target) {
  const fullPath = path.join(process.cwd(), target.path);
  if (!fs.existsSync(fullPath)) return null;

  const perms   = getPermissions(fullPath);
  const content = readPartial(fullPath);
  const secrets = detectSecrets(content);
  let needsFix = false;
  if (perms) {
    const mode = parseInt(perms.octal, 8);
    const targetMode = isSensitiveFile(target.path) ? 0o600 : 0o640;
    needsFix = mode !== targetMode;
  }

  return { path: target.path, severity: target.severity, desc: target.desc, perms, secrets, needsFix };
}

const SENSITIVE_PATHS_RE = /\.(env|env\.local|env\.production|env\.development|env\.staging|env\.test)(\.local)?$|secrets\.json|credentials\.json|serviceAccountKey\.json|firebase-adminsdk\.json|gcp-credentials\.json|id_rsa|id_ed25519|dump\.sql|backup\.sql|\.aws\/credentials/i;

function isSensitiveFile(filePath) {
  return SENSITIVE_PATHS_RE.test(filePath);
}

/** Correct file permissions: 600 for sensitive files, 640 for others */
function correctFilePermissions(fullPath, filePath) {
  if (process.platform === 'win32') return { error: 'Windows non supporté pour la correction de permissions' };
  try {
    const stat = fs.statSync(fullPath);
    const currentMode = stat.mode & 0o777;
    const sensitive = isSensitiveFile(filePath);
    const targetMode = sensitive ? 0o600 : 0o640;
    if (currentMode !== targetMode) {
      fs.chmodSync(fullPath, targetMode);
      return { from: currentMode, to: targetMode };
    }
    return null; // already OK
  } catch (e) {
    return { error: e.message };
  }
}

// ── Remote HTTP checks ────────────────────────────────────────────────────────

function httpGet(url, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let parsed;
    try { parsed = new URL(url); } catch { return resolve({ error: 'URL invalide' }); }

    const lib = parsed.protocol === 'https:' ? https : http;
    let body = '';
    let settled = false;

    const done = (result) => { if (!settled) { settled = true; resolve(result); } };

    const req = lib.get({
      hostname : parsed.hostname,
      port     : parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path     : parsed.pathname + parsed.search,
      headers  : { 'User-Agent': 'SecurityAudit/1.0', Accept: '*/*' },
      timeout  : timeoutMs,
      rejectUnauthorized: false, // allow self-signed certs on dev
    }, (res) => {
      res.setEncoding('utf8');
      res.on('data', chunk => {
        body += chunk;
        if (body.length > 2048) res.destroy();
      });
      res.on('end',   () => done({ status: res.statusCode, contentType: res.headers['content-type'] || '', body }));
      res.on('error', () => done({ error: 'Réponse interrompue' }));
    });

    req.on('error',   err => done({ error: err.message }));
    req.on('timeout', ()  => { req.destroy(); done({ error: 'Timeout' }); });
  });
}

function isSPAFallback(body, contentType) {
  if (!(contentType).toLowerCase().includes('text/html')) return false;
  const t = (body || '').trim().toLowerCase();
  return t.startsWith('<!doctype') || t.startsWith('<html');
}

async function checkRemoteFile(baseUrl, target) {
  const url    = `${baseUrl.replace(/\/$/, '')}/${target.path}`;
  const result = await httpGet(url);

  if (result.error)     return { kind: 'error',     error: result.error };
  const { status, contentType, body } = result;
  if (status === 401 || status === 403) return { kind: 'protected', status };
  if (status === 404 || status === 410) return { kind: 'safe',      status };
  if (status === 200) {
    if (isSPAFallback(body, contentType)) return { kind: 'safe', status, note: 'SPA fallback' };
    return { kind: 'exposed', status, contentType, preview: body.slice(0, 100).replace(/\n/g, ' ') };
  }
  return { kind: 'unknown', status };
}

// ── Terminal output ───────────────────────────────────────────────────────────

function formatBytes(n) {
  if (n < 1024) return `${n}B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1048576).toFixed(1)}MB`;
}

function sevColor(sev) {
  switch (sev) {
    case 'CRITIQUE': return C.red;
    case 'ÉLEVÉ':    return C.yellow;
    case 'MOYEN':    return C.cyan;
    case 'FAIBLE':   return C.green;
    default:         return C.gray;
  }
}

function hr(char = '─', len = 60) { return char.repeat(len); }

function printSection(title) {
  console.log('');
  console.log(col(C.bold + C.white, `▶ ${title}`));
  console.log(col(C.gray, hr()));
}

function printLocalResult(found) {
  const p = found.path.padEnd(36);
  const s = col(sevColor(found.severity), `[${found.severity}]`);
  const hasRisk = (found.perms?.worldRead) || found.secrets.length > 0;
  const icon = hasRisk ? col(C.red, '⚠') : col(C.gray, '•');
  console.log(`  ${icon}  ${col(C.white, p)} ${s}`);
  console.log(col(C.gray, `     ${found.desc}`));

  if (found.perms) {
    const permStr = `chmod ${found.perms.octal} · ${formatBytes(found.perms.size)}`;
    console.log(col(C.gray, `     Permissions : ${permStr}`));
    if (found.perms.worldRead) {
      const recommended = isSensitiveFile(found.path) ? '600' : '640';
      console.log(col(C.red, `     ⚠  World-readable ! (chmod ${recommended} recommandé)`));
    }
  }

  for (const secret of found.secrets) {
    console.log(col(C.red + C.bold, `     ⚠  Secret détecté : ${secret.name}`));
    console.log(col(C.gray, `        → ${secret.masked}`));
  }
}

// ── AI Prompt export ──────────────────────────────────────────────────────────

function generateAIPrompt(localFound, remoteResults, remoteUrl) {
  const exposed = remoteResults.filter(r => r.result.kind === 'exposed');
  const warnings = remoteResults.filter(r => r.result.kind === 'warning');

  const lines = [
    'Tu es un expert en sécurité web backend. Voici les problèmes détectés lors d\'un audit de fichiers sensibles.',
    '',
    '--- Résumé ---',
    `- Fichiers sensibles présents localement : ${localFound.length}`,
    `- Fichiers exposés publiquement (${remoteUrl || 'N/A'}) : ${exposed.length}`,
    `- Fichiers suspects : ${warnings.length}`,
    '',
    '--- Fichiers locaux détectés ---',
  ];

  for (const f of localFound) {
    lines.push(`Fichier : ${f.path}`);
    lines.push(`Sévérité : ${f.severity}`);
    lines.push(`Description : ${f.desc}`);
    if (f.perms) lines.push(`Permissions : ${f.perms.octal} · ${formatBytes(f.perms.size)}${f.perms.worldRead ? ' (world-readable!)' : ''}`);
    for (const s of f.secrets) lines.push(`Secret détecté : ${s.name} → ${s.masked}`);
    lines.push('');
  }

  if (exposed.length || warnings.length) {
    lines.push('--- Problèmes distants ---');
    for (const { target, result } of [...exposed, ...warnings]) {
      lines.push(`Fichier : ${target.path}`);
      lines.push(`Sévérité : ${target.severity}`);
      lines.push(`Statut HTTP : ${result.status || 'N/A'}`);
      if (result.preview) lines.push(`Aperçu : ${result.preview.slice(0, 200)}`);
      if (result.note) lines.push(`Note : ${result.note}`);
      lines.push('');
    }
  }

  lines.push('--- Actions recommandées ---');
  lines.push('1. Bloquer l\'accès aux fichiers exposés via la configuration du serveur web (nginx, Apache, etc.).');
  lines.push('2. Supprimer ou déplacer les fichiers sensibles hors du répertoire servi publiquement.');
  lines.push('3. chmod 600 sur tous les fichiers .env et clés privées.');
  lines.push('4. Ajouter *.env*, secrets.json, credentials.json dans .gitignore et .dockerignore.');
  lines.push('5. Réviser le pipeline CI/CD pour s\'assurer qu\'aucun secret n\'est poussé par erreur.');
  lines.push('');
  lines.push('Propose un plan de correction minimal et priorisé, puis des snippets de configuration (nginx, Apache, ou Cloudflare) pour sécuriser ces fichiers.');

  return lines.join('\n');
}

// ── JSON export ───────────────────────────────────────────────────────────────

function exportJSON(localFound, remoteResults, remoteUrl, outPath, totalTargets) {
  const report = {
    date: new Date().toISOString(),
    directory: process.cwd(),
    remoteUrl: remoteUrl || null,
    summary: {
      totalTargets: totalTargets || 0,
      localFound: localFound.length,
      critical: localFound.filter(f => f.severity === 'CRITIQUE').length,
      withSecrets: localFound.filter(f => f.secrets.length > 0).length,
      needsFix: localFound.filter(f => f.needsFix).length,
      remoteExposed: remoteResults.filter(r => r.result.kind === 'exposed').length,
      remoteProtected: remoteResults.filter(r => r.result.kind === 'protected').length,
    },
    local: localFound.map(f => ({
      path: f.path,
      severity: f.severity,
      description: f.desc,
      permissions: f.perms ? {
        octal: f.perms.octal,
        worldRead: f.perms.worldRead,
        worldWrite: f.perms.worldWrite,
        size: f.perms.size,
      } : null,
      secrets: f.secrets,
    })),
    remote: remoteResults.map(({ target, result }) => ({
      path: target.path,
      severity: target.severity,
      kind: result.kind,
      status: result.status || null,
      preview: result.preview || null,
      note: result.note || null,
      error: result.error || null,
    })),
  };
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args       = process.argv.slice(2);
  const argUrl     = args.find(a => /^https?:\/\//.test(a));
  const remoteUrl  = argUrl || API_URL || null;
  const aiPrompt   = args.includes('--ai-prompt');
  const jsonExport = args.includes('--json');
  const cwd        = process.cwd();
  let remoteResults = [];
  const localDirs = discoverLocalDirs();
  const localTargets = makeUniqueTargets([...BASE_TARGETS, ...generateBruteTargets(localDirs)]);

  // Header
  console.log('');
  console.log(col(C.bold + C.white, '═'.repeat(60)));
  console.log(col(C.bold + C.white, '  🔒  SECURITY AUDIT — Backend'));
  console.log(col(C.bold + C.white, '═'.repeat(60)));
  console.log(col(C.gray, `  Répertoire : ${cwd}`));
  if (remoteUrl) console.log(col(C.gray, `  URL distante: ${remoteUrl}`));
  console.log(col(C.gray, `  Date       : ${new Date().toLocaleString('fr-FR')}`));
  console.log(col(C.gray, `  Fichiers   : ${localTargets.length} à vérifier`));

  // ── 1. LOCAL SCAN ───────────────────────────────────────────────────────────

  printSection('AUDIT LOCAL — Présence de fichiers sensibles');

  const localFound = [];
  for (const target of localTargets) {
    const found = checkLocalFile(target);
    if (found) localFound.push(found);
  }

  const absent = localTargets.length - localFound.length;

  if (localFound.length === 0) {
    console.log(col(C.green, '  ✅  Aucun fichier sensible trouvé dans ce répertoire.'));
  } else {
    for (const found of localFound) {
      printLocalResult(found);
      console.log('');
    }
  }

  console.log(col(C.gray, `  Résultat : ${col(C.green, String(absent))} absents · ${col(localFound.length > 0 ? C.red : C.green, String(localFound.length))} trouvés`));

  // ── 2. REMOTE SCAN (optional) ───────────────────────────────────────────────

  if (remoteUrl) {
    printSection(`AUDIT DISTANT — ${remoteUrl}`);

    // Calibration SPA
    process.stdout.write(col(C.gray, '  Calibration (SPA detection)... '));
    const calResult = await httpGet(`${remoteUrl.replace(/\/$/, '')}/__audit_cal_${Date.now()}__`);
    const spaMode   = !calResult.error &&
      calResult.status === 200 &&
      isSPAFallback(calResult.body || '', calResult.contentType || '');
    console.log(spaMode
      ? col(C.yellow, 'SPA mode détecté (routes inconnues → index.html)')
      : col(C.green,  'Mode standard'));
    console.log('');

    const remoteDirs = await discoverRootDirs(remoteUrl);
    const remoteTargets = makeUniqueTargets([...BASE_TARGETS, ...generateBruteTargets(remoteDirs)]);

    let remoteExposed = 0;
    let remoteProtected = 0;
    let remoteErrors = 0;

    for (const target of remoteTargets) {
      const p = target.path.padEnd(36);
      process.stdout.write(`  ${col(C.gray, '→')} ${p} `);

      const result = await checkRemoteFile(remoteUrl, target);

      remoteResults.push({ target, result });

      switch (result.kind) {
        case 'exposed':
          remoteExposed++;
          console.log(col(C.red + C.bold, `⚠️  EXPOSÉ [HTTP ${result.status}] ${result.contentType}`));
          if (result.preview) console.log(col(C.yellow, `     ${result.preview.slice(0, 100)}`));
          break;
        case 'protected':
          remoteProtected++;
          console.log(col(C.blue, `🔒 PROTÉGÉ [${result.status}]`));
          break;
        case 'safe':
          console.log(col(C.green, `✅ SÛR [${result.status}]${result.note ? ` · ${result.note}` : ''}`));
          break;
        case 'error':
          remoteErrors++;
          console.log(col(C.gray, `✗  ERREUR — ${result.error}`));
          break;
        default:
          console.log(col(C.gray, `?  HTTP ${result.status}`));
      }
    }

    console.log('');
    if (remoteExposed > 0) {
      console.log(col(C.red + C.bold, `  ⚠️  ${remoteExposed} fichier(s) accessible(s) publiquement !`));
    } else {
      console.log(col(C.green, `  ✅ Aucun fichier sensible accessible publiquement.`));
    }
    if (remoteProtected > 0) console.log(col(C.blue, `  🔒 ${remoteProtected} fichier(s) protégé(s) par le serveur.`));
    if (remoteErrors   > 0) console.log(col(C.gray,  `  ✗  ${remoteErrors} erreur(s) réseau — vérifier la connectivité.`));
  }

  // ── 3. SUMMARY ──────────────────────────────────────────────────────────────

  printSection('RÉSUMÉ & RECOMMANDATIONS');

  const criticals = localFound.filter(f => f.severity === 'CRITIQUE');
  const withSecrets = localFound.filter(f => f.secrets.length > 0);

  const needsFixCount = localFound.filter(f => f.needsFix).length;
  console.log(`  Fichiers testés       : ${localTargets.length}`);
  console.log(`  Présents localement   : ${col(localFound.length > 0 ? C.yellow : C.green, String(localFound.length))}`);
  console.log(`  Critiques             : ${col(criticals.length   > 0 ? C.red    : C.green, String(criticals.length))}`);
  console.log(`  Secrets détectés dans : ${col(withSecrets.length > 0 ? C.red    : C.green, String(withSecrets.length))} fichier(s)`);
  console.log(`  Permissions à corriger: ${col(needsFixCount > 0 ? C.red : C.green, String(needsFixCount))}`);

  if (localFound.length > 0) {
    console.log('');
    console.log(col(C.bold + C.yellow, '  Fichiers trouvés :'));
    for (const f of localFound) {
      const extras = f.secrets.length > 0
        ? col(C.red, ` + ${f.secrets.length} secret(s)`)
        : '';
      const perm = (f.perms?.worldRead) ? col(C.red, ' (world-readable!)') : '';
      console.log(`    ${col(sevColor(f.severity), '•')} ${f.path}${extras}${perm}`);
    }
  }

  console.log('');
  console.log(col(C.bold + C.cyan, '  Recommandations :'));
  console.log(col(C.gray, '    • Ajouter *.env*, secrets.json, credentials.json dans .gitignore'));
  console.log(col(C.gray, '    • chmod 600 sur tous les fichiers .env et clés privées'));
  console.log(col(C.gray, '    • Ne jamais commiter de vraies valeurs de secrets dans git'));
  console.log(col(C.gray, '    • Utiliser un gestionnaire de secrets (HashiCorp Vault, AWS SSM, Doppler)'));
  console.log(col(C.gray, '    • Vérifier que votre .dockerignore/.gitignore couvre ces fichiers'));

  if (aiPrompt) {
    const prompt = generateAIPrompt(localFound, remoteResults || [], remoteUrl);
    const outFile = path.join(cwd, 'security-audit-prompt.txt');
    fs.writeFileSync(outFile, prompt, 'utf8');
    console.log('');
    console.log(col(C.cyan, `  📝 Prompt IA écrit dans : ${outFile}`));
  }

  if (jsonExport) {
    const outFile = path.join(cwd, 'security-audit-report.json');
    exportJSON(localFound, remoteResults || [], remoteUrl, outFile, localTargets.length);
    console.log('');
    console.log(col(C.cyan, `  📊 Rapport JSON écrit dans : ${outFile}`));
  }

  // ── 4. AUTO-CORRECTION (optional) ───────────────────────────────────────────

  if (args.includes('--correction')) {
    printSection('CORRECTIONS AUTOMATIQUES — Permissions');

    if (process.platform === 'win32') {
      console.log(col(C.yellow, '  ⚠️  La correction des permissions est ignorée sur Windows.'));
    } else {
      const toFix = localFound.filter(f => f.needsFix);
      if (toFix.length === 0) {
        console.log(col(C.green, '  ✅ Aucune correction nécessaire.'));
      } else {
        for (const found of toFix) {
          const fullPath = path.join(cwd, found.path);
          const result = correctFilePermissions(fullPath, found.path);
          if (result?.error) {
            console.log(col(C.red, `  ✗ ${found.path} — ${result.error}`));
          } else if (result) {
            const fromOct = result.from.toString(8).padStart(3, '0');
            const toOct   = result.to.toString(8).padStart(3, '0');
            const owner   = found.perms ? `owner=${found.perms.uid}, group=${found.perms.gid}` : '';
            console.log(col(C.green, `  ✓ ${found.path} — ${fromOct} → ${toOct} ${col(C.gray, owner)}`));
          } else {
            console.log(col(C.gray, `  ○ ${found.path} — déjà correct`));
          }
        }
      }
    }
  }

  if (!remoteUrl) {
    console.log('');
    console.log(col(C.gray, `  💡 Pour activer l'audit distant, éditer API_URL en haut du fichier :`));
    console.log(col(C.gray, `     const API_URL = 'https://api.exemple.com';`));
    console.log(col(C.gray, `     node security-check.js [--correction] [--ai-prompt] [--json]`));
  }

  console.log('');
}

main().catch(err => {
  console.error(col(C.red, `\nErreur fatale : ${err.message}`));
  process.exit(1);
});