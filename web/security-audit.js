'use strict';

// ── PIN lock ──────────────────────────────────────────────────────────────────

const ITERATIONS = 100000;
const PIN_HASH = 'f35eb5b500b74ab9795eb36e339cb28c91cb1bab8b2485fd92e47b9e5d3d536b'; // default PIN: 0000

async function sha256(input, iterations = 1) {
  let buf = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  for (let i = 0; i < iterations; i++) {
    buf = await crypto.subtle.digest('SHA-256', buf);
  }
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPin() {
  const inputs = document.querySelectorAll('.pin-digit');
  const code = Array.from(inputs).map(i => i.value).join('');
  if (code.length !== 4 || !/^\d{4}$/.test(code)) {
    document.getElementById('pin-error').textContent = 'Veuillez saisir 4 chiffres.';
    return;
  }
  try {
    const hash = await sha256(code, ITERATIONS);
    if (hash === PIN_HASH) {
      document.getElementById('pin-overlay').style.display = 'none';
      document.getElementById('main-content').style.display = 'block';
      document.getElementById('lbl-date').textContent = new Date().toLocaleString('fr-FR');
    } else {
      document.getElementById('pin-error').textContent = 'Code incorrect.';
      inputs.forEach(i => { i.value = ''; });
      inputs[0].focus();
    }
  } catch (e) {
    document.getElementById('pin-error').textContent = 'Erreur de vérification (contexte non sécurisé ?)';
  }
}

(function setupPinInputs() {
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
})();

// ── Init ─────────────────────────────────────────────────────────────────────

document.getElementById('lbl-origin').textContent = window.location.origin;

// ── Config ───────────────────────────────────────────────────────────────────

const TIMEOUT_MS   = 6000;
const BODY_MAX     = 1024; // bytes to read per response
const PREVIEW_MAX  = 180;  // chars shown in UI

const BRUTE_DIRS = [
  'admin', 'backend', 'mobile', 'landingpage', 'web', 'packages',
  'src', 'dist', 'build', 'public', 'assets', 'scripts',
  'api', 'app', 'server', 'client', 'frontend', 'docs',
];

const BRUTE_FILES = [
  { path: '.env',                   severity: 'critical' },
  { path: '.env.local',             severity: 'critical' },
  { path: '.env.production',        severity: 'critical' },
  { path: '.env.production.local',  severity: 'critical' },
  { path: '.env.development',       severity: 'high'     },
  { path: '.env.development.local', severity: 'critical' },
  { path: '.env.staging',           severity: 'high'     },
  { path: '.env.test',              severity: 'medium'   },
  { path: '.env.test.local',        severity: 'medium'   },
  { path: '.env.example',           severity: 'low'      },
  { path: 'config.json',            severity: 'medium'   },
  { path: 'config.js',              severity: 'medium'   },
  { path: 'secrets.json',           severity: 'critical' },
  { path: 'credentials.json',       severity: 'critical' },
  { path: 'package.json',           severity: 'low'      },
  { path: 'tsconfig.json',          severity: 'low'      },
  { path: 'dump.sql',               severity: 'critical' },
  { path: 'backup.sql',             severity: 'critical' },
  { path: 'app.log',                severity: 'medium'   },
  { path: 'error.log',              severity: 'medium'   },
];

/** @type {{ path: string, severity: 'critical'|'high'|'medium'|'low'|'info' }[]} */
const BASE_TARGETS = [
  // ENV
  { path: '.env',                   severity: 'critical' },
  { path: '.env.local',             severity: 'critical' },
  { path: '.env.development',       severity: 'high'     },
  { path: '.env.development.local', severity: 'critical' },
  { path: '.env.production',        severity: 'critical' },
  { path: '.env.production.local',  severity: 'critical' },
  { path: '.env.staging',           severity: 'high'     },
  { path: '.env.test',              severity: 'medium'   },
  { path: '.env.test.local',        severity: 'medium'   },
  { path: '.env.example',           severity: 'low'      },
  { path: '.env.bak',               severity: 'critical' },
  // SECRETS
  { path: 'secrets.json',           severity: 'critical' },
  { path: 'credentials.json',       severity: 'critical' },
  { path: 'serviceAccountKey.json', severity: 'critical' },
  { path: 'firebase-adminsdk.json', severity: 'critical' },
  { path: 'gcp-credentials.json',   severity: 'critical' },
  // CONFIG
  { path: 'config.json',            severity: 'medium'   },
  { path: 'config.js',              severity: 'medium'   },
  { path: 'app.config.js',          severity: 'low'      },
  // PACKAGE
  { path: 'package.json',           severity: 'low'      },
  { path: '.npmrc',                 severity: 'high'     },
  { path: '.yarnrc.yml',            severity: 'medium'   },
  // GIT
  { path: '.git/config',            severity: 'high'     },
  { path: '.git/HEAD',              severity: 'medium'   },
  { path: '.gitignore',             severity: 'info'     },
  // BUILD
  { path: 'vite.config.js',         severity: 'medium'   },
  { path: 'vite.config.ts',         severity: 'medium'   },
  { path: 'webpack.config.js',      severity: 'medium'   },
  { path: 'next.config.js',         severity: 'medium'   },
  { path: 'tsconfig.json',          severity: 'low'      },
  // DATABASE
  { path: 'database.json',          severity: 'critical' },
  { path: 'db.json',                severity: 'critical' },
  { path: 'dump.sql',               severity: 'critical' },
  { path: 'backup.sql',             severity: 'critical' },
  // CLOUD
  { path: '.aws/credentials',       severity: 'critical' },
  { path: '.aws/config',            severity: 'high'     },
  // INFRA
  { path: 'docker-compose.yml',     severity: 'medium'   },
  { path: 'docker-compose.yaml',    severity: 'medium'   },
  { path: 'nginx.conf',             severity: 'high'     },
  { path: '.htaccess',              severity: 'medium'   },
  { path: 'web.config',             severity: 'medium'   },
  // SSH
  { path: '.ssh/id_rsa',            severity: 'critical' },
  { path: '.ssh/id_ed25519',        severity: 'critical' },
  // LOGS
  { path: 'app.log',                severity: 'medium'   },
  { path: 'error.log',              severity: 'medium'   },

  // ── Pato specific ──
  { path: 'backend/.env',                    severity: 'critical' },
  { path: 'backend/.env.local',              severity: 'critical' },
  { path: 'backend/.env.production',         severity: 'critical' },
  { path: 'backend/.env.production.local',   severity: 'critical' },
  { path: 'backend/.env.development',        severity: 'high'     },
  { path: 'backend/.env.development.local',  severity: 'critical' },
  { path: 'backend/ecosystem.config.cjs',    severity: 'high'     },
  { path: 'backend/src/helpers/config.ts',   severity: 'medium'   },
  { path: 'backend/src/helpers/auth.ts',     severity: 'medium'   },
  { path: 'backend/scripts/detect_duplicates.ts', severity: 'low' },

  { path: 'mobile/.env',                   severity: 'critical' },
  { path: 'mobile/.env.local',             severity: 'critical' },
  { path: 'mobile/.env.production',          severity: 'critical' },
  { path: 'mobile/app.json',               severity: 'low'      },
  { path: 'mobile/eas.json',               severity: 'low'      },

  { path: 'landingpage/.env',              severity: 'critical' },
  { path: 'landingpage/.env.local',        severity: 'critical' },
  { path: 'landingpage/.env.production',   severity: 'critical' },

  { path: 'web/.env',                      severity: 'critical' },
  { path: 'web/.env.local',                severity: 'critical' },
  { path: 'web/.env.production',           severity: 'critical' },

  { path: 'packages/shared-types/.env',    severity: 'critical' },
  { path: '.npmrc',                        severity: 'high'     },
  { path: 'pnpm-lock.yaml',                severity: 'info'     },
  { path: 'pnpm-workspace.yaml',           severity: 'info'     },
];

function generateBruteTargets() {
  const targets = [];
  for (const dir of BRUTE_DIRS) {
    for (const file of BRUTE_FILES) {
      targets.push({ path: `${dir}/${file.path}`, severity: file.severity });
    }
  }
  return targets;
}

const BRUTE_TARGETS = generateBruteTargets();
const TARGETS = [...BASE_TARGETS, ...BRUTE_TARGETS];

document.getElementById('lbl-count').textContent = TARGETS.length;

// ── State ────────────────────────────────────────────────────────────────────

let mainAbort    = null;
let isRunning    = false;
let auditResults = [];
const counts     = { exposed: 0, warning: 0, protected: 0, safe: 0 };

// ── Helpers ──────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Mask KEY=VALUE lines to hide secret values */
function maskEnvContent(text) {
  return text.replace(
    /^([A-Z_][A-Z0-9_]*)\s*=\s*(.+)$/gm,
    (_, k, v) => v.trim().length > 4
      ? `${k}=${'*'.repeat(Math.min(v.trim().length, 10))}[MASKED]`
      : `${k}=${v}`
  );
}

/** Read limited bytes from a fetch Response body */
async function readBody(response) {
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
    text += decoder.decode(); // flush
    reader.cancel().catch(() => {});
  } catch (_) { /* body closed early, fine */ }
  return text;
}

/** Returns true if response looks like an SPA fallback (index.html) */
function isSPAFallback(text, contentType) {
  if (!(contentType || '').toLowerCase().includes('text/html')) return false;
  const t = text.trim().toLowerCase();
  return t.startsWith('<!doctype') || t.startsWith('<html');
}

// ── Core check ───────────────────────────────────────────────────────────────

async function checkTarget(target, signal) {
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
    const isDangerous = target.severity === 'critical' || target.severity === 'high';
    const preview = maskEnvContent(text).slice(0, PREVIEW_MAX).trim();
    return { kind: isDangerous ? 'exposed' : 'warning', status, contentType, preview };
  }

  return { kind: 'warning', status, note: `HTTP ${status}` };
}

// ── UI helpers ───────────────────────────────────────────────────────────────

const SEV_META = {
  critical: { label: 'CRITIQUE', dot: 'd-critical' },
  high:     { label: 'ÉLEVÉ',    dot: 'd-high'     },
  medium:   { label: 'MOYEN',    dot: 'd-medium'   },
  low:      { label: 'FAIBLE',   dot: 'd-low'      },
  info:     { label: 'INFO',     dot: 'd-info'      },
};

const KIND_META = {
  exposed:   { label: '🔴 EXPOSÉ',  cls: 'b-exposed'   },
  warning:   { label: '🟡 SUSPECT', cls: 'b-warning'   },
  protected: { label: '🔵 PROTÉGÉ', cls: 'b-protected' },
  safe:      { label: '🟢 SÛR',     cls: 'b-safe'      },
  error:     { label: '⚫ ERREUR',  cls: 'b-error'     },
  pending:   { label: '◌ EN COURS', cls: 'b-pending'   },
};

function rowId(target) {
  return 'r-' + target.path.replace(/[^a-z0-9]/gi, '-');
}

function sevBadgeHtml(severity) {
  const m = SEV_META[severity] || SEV_META.info;
  return `<span class="badge sev-badge"><span class="sev-dot ${m.dot}"></span>${m.label}</span>`;
}

function statusBadgeHtml(kind) {
  const m = KIND_META[kind] || KIND_META.error;
  return `<span class="badge ${m.cls}">${m.label}</span>`;
}

function pathCellHtml(target) {
  const parts = target.path.split('/');
  const name  = parts.pop();
  const dir   = parts.length ? parts.join('/') + '/' : '';
  return `<td class="path">
    <span class="path-name">${esc(name)}</span>
    ${dir ? `<span class="path-sub">${esc(dir)}</span>` : ''}
  </td>`;
}

function appendRow(target) {
  const tr   = document.createElement('tr');
  tr.className = 'row';
  tr.id = rowId(target);
  tr.innerHTML = `
    ${pathCellHtml(target)}
    <td>${sevBadgeHtml(target.severity)}</td>
    <td>${statusBadgeHtml('pending')}</td>
    <td class="http-code">—</td>
    <td class="note-text">...</td>
  `;
  document.getElementById('tbody').appendChild(tr);
}

function updateRow(target, result) {
  const tr = document.getElementById(rowId(target));
  if (!tr) return;

  let rowClass = 'row';
  if (result.kind === 'exposed')  rowClass += ' r-exposed';
  if (result.kind === 'warning')  rowClass += ' r-warning';
  tr.className = rowClass;

  const httpHtml = result.status
    ? `<span class="http-code ${result.status === 200 ? 'ok' : 'nok'}">${result.status}</span>`
    : '<span class="http-code">—</span>';

  let detailHtml = '<span class="note-text">—</span>';
  if (result.preview) {
    detailHtml = `<div class="preview-box">${esc(result.preview)}</div>`;
  } else if (result.note) {
    detailHtml = `<span class="note-text">${esc(result.note)}</span>`;
  } else if (result.message) {
    detailHtml = `<span class="note-text">${esc(result.message)}</span>`;
  }

  tr.children[1].innerHTML = sevBadgeHtml(target.severity);
  tr.children[2].innerHTML = statusBadgeHtml(result.kind);
  tr.children[3].innerHTML = httpHtml;
  tr.children[4].innerHTML = detailHtml;
}

function updateStats() {
  document.getElementById('n-exposed').textContent   = counts.exposed;
  document.getElementById('n-warning').textContent   = counts.warning;
  document.getElementById('n-protected').textContent = counts.protected;
  document.getElementById('n-safe').textContent      = counts.safe;
}

function setProgress(done, total, label) {
  const pct = Math.round((done / total) * 100);
  document.getElementById('progress-fill').style.width  = `${pct}%`;
  document.getElementById('progress-pct').textContent   = `${pct}%`;
  document.getElementById('progress-label').textContent = label;
}

// ── Audit orchestration ───────────────────────────────────────────────────────

async function startAudit() {
  if (isRunning) return;
  if (window.location.protocol === 'file:') {
    alert('⚠️ Ce fichier doit être servi par un serveur web (pas ouvert via file://).');
    return;
  }
  isRunning = true;

  // Reset
  Object.assign(counts, { exposed: 0, warning: 0, protected: 0, safe: 0 });
  auditResults = [];
  document.getElementById('tbody').innerHTML = '';
  document.getElementById('status-text').textContent = 'Audit en cours...';
  document.getElementById('btn-start').disabled  = true;
  document.getElementById('btn-stop').disabled   = false;
  document.getElementById('btn-export').disabled = true;
  document.getElementById('btn-prompt').disabled = true;
  document.getElementById('progress-wrap').style.display = 'block';
  document.getElementById('stats').style.display = 'grid';
  document.getElementById('results-table').style.display = 'table';
  updateStats();

  mainAbort = new AbortController();
  const mainSignal = mainAbort.signal;

  // Pre-create all rows (deduplicate by path)
  const seen = new Set();
  const uniqueTargets = [];
  for (const t of TARGETS) {
    if (!seen.has(t.path)) {
      seen.add(t.path);
      uniqueTargets.push(t);
      appendRow(t);
    }
  }

  // Calibration: detect SPA mode
  setProgress(0, uniqueTargets.length, 'Calibration SPA...');
  let spaCalibrated = false;
  try {
    const calUrl = `${window.location.origin}/__audit_cal_${Date.now()}__`;
    const r = await fetch(calUrl, { cache: 'no-store', signal: mainSignal, headers: { Accept: '*/*' } });
    if (r.status === 200) {
      const body = await readBody(r);
      const ct   = r.headers.get('content-type') || '';
      spaCalibrated = isSPAFallback(body, ct);
    }
  } catch (_) { /* network error or aborted */ }

  if (mainSignal.aborted) { finishAudit(true); return; }

  const total = uniqueTargets.length;
  let done = 0;

  for (const target of uniqueTargets) {
    if (mainSignal.aborted) break;

    setProgress(done, total, `${target.path}`);

    const itemAbort = new AbortController();
    const timer = setTimeout(() => itemAbort.abort(), TIMEOUT_MS);
    const onMain = () => itemAbort.abort();
    mainSignal.addEventListener('abort', onMain, { once: true });

    let result;
    try {
      result = await checkTarget(target, itemAbort.signal);
      // Re-check: if SPA is calibrated and we got a 200 HTML (shouldn't happen but just in case)
      if (spaCalibrated && result.kind === 'exposed' && result.contentType?.includes('text/html')) {
        result = { kind: 'safe', status: result.status, note: 'SPA fallback probable' };
      }
    } catch (err) {
      if (mainSignal.aborted) { clearTimeout(timer); mainSignal.removeEventListener('abort', onMain); break; }
      result = { kind: 'error', message: 'Timeout ou réseau indisponible' };
    } finally {
      clearTimeout(timer);
      mainSignal.removeEventListener('abort', onMain);
    }

    if (result.kind === 'exposed')   counts.exposed++;
    else if (result.kind === 'warning')   counts.warning++;
    else if (result.kind === 'protected') counts.protected++;
    else if (result.kind === 'safe')      counts.safe++;

    updateRow(target, result);
    updateStats();
    auditResults.push({ target, result });

    done++;
    // Yield to render loop
    await new Promise(r => setTimeout(r, 0));
  }

  finishAudit(mainSignal.aborted);
}

function finishAudit(aborted) {
  isRunning = false;
  mainAbort = null;
  document.getElementById('btn-start').disabled  = false;
  document.getElementById('btn-stop').disabled   = true;
  document.getElementById('btn-export').disabled = false;
  document.getElementById('btn-prompt').disabled = false;

  if (aborted) {
    document.getElementById('status-text').textContent = '⛔ Audit interrompu.';
    setProgress(1, 1, 'Interrompu');
  } else if (counts.exposed > 0) {
    document.getElementById('status-text').textContent =
      `⚠️ Audit terminé — ${counts.exposed} fichier(s) exposé(s) publiquement !`;
    setProgress(1, 1, 'Terminé');
  } else {
    document.getElementById('status-text').textContent = '✅ Audit terminé — aucun fichier sensible exposé.';
    setProgress(1, 1, 'Terminé');
  }
}

function stopAudit() {
  if (mainAbort) mainAbort.abort();
}

// ── Export ────────────────────────────────────────────────────────────────────

function exportAIPrompt() {
  const exposed = auditResults.filter(r => r.result.kind === 'exposed');
  const warnings = auditResults.filter(r => r.result.kind === 'warning');

  if (exposed.length === 0 && warnings.length === 0) {
    navigator.clipboard.writeText('Aucun problème de sécurité détecté lors de l\'audit.').then(() => {
      const btn = document.getElementById('btn-prompt');
      const prev = btn.textContent;
      btn.textContent = '✓ Prompt copié !';
      setTimeout(() => { btn.textContent = prev; }, 2500);
    });
    return;
  }

  const lines = [
    'Tu es un expert en sécurité web frontend. Voici les problèmes détectés lors d\'un audit de fichiers sensibles exposés publiquement sur un serveur web.',
    '',
    '--- Résumé ---',
    `- Fichiers exposés (${exposed.length}) : ${exposed.map(r => r.target.path).join(', ') || 'aucun'}`,
    `- Fichiers suspects (${warnings.length}) : ${warnings.map(r => r.target.path).join(', ') || 'aucun'}`,
    '',
    '--- Détails des problèmes ---',
  ];

  for (const { target, result } of [...exposed, ...warnings]) {
    lines.push(`Fichier : ${target.path}`);
    lines.push(`Sévérité : ${target.severity.toUpperCase()}`);
    lines.push(`Statut HTTP : ${result.status || 'N/A'}`);
    if (result.preview) lines.push(`Aperçu : ${result.preview.replace(/\n/g, ' ').slice(0, 200)}`);
    if (result.note) lines.push(`Note : ${result.note}`);
    lines.push('');
  }

  lines.push('--- Actions recommandées ---');
  lines.push('1. Bloquer l\'accès aux fichiers exposés via la configuration du serveur web (nginx, Apache, etc.) ou les règles .htaccess.');
  lines.push('2. Vérifier que les fichiers .env, credentials et clés privées ne sont pas déployés dans le build ou le dossier public.');
  lines.push('3. Ajouter des règles de deny globales pour les extensions et dossiers sensibles (.git, .ssh, .env*, *.sql, etc.).');
  lines.push('4. Réviser le pipeline CI/CD pour s\'assurer qu\'aucun secret n\'est poussé par erreur.');
  lines.push('5. Si certains fichiers doivent rester accessibles (ex: package.json), confirmer explicitement que c\'est intentionnel et documenté.');
  lines.push('');
  lines.push('Propose un plan de correction minimal et priorisé, puis des snippets de configuration (nginx, Apache, ou Cloudflare) pour sécuriser ces fichiers.');

  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    const btn = document.getElementById('btn-prompt');
    const prev = btn.textContent;
    btn.textContent = '✓ Prompt copié !';
    setTimeout(() => { btn.textContent = prev; }, 2500);
  }).catch(() => alert(lines.join('\n')));
}

function exportReport() {
  const lines = [
    '=== SECURITY AUDIT REPORT ===',
    `Date     : ${new Date().toISOString()}`,
    `Origin   : ${window.location.origin}`,
    `Testé    : ${auditResults.length} fichiers`,
    '',
    `Exposés  : ${counts.exposed}`,
    `Suspects : ${counts.warning}`,
    `Protégés : ${counts.protected}`,
    `Sûrs     : ${counts.safe}`,
    '',
    '=== DÉTAIL ===',
  ];
  for (const { target, result } of auditResults) {
    const status = (result.kind || '?').toUpperCase().padEnd(9);
    const http   = result.status ? `HTTP ${result.status}` : 'N/A';
    lines.push(`[${status}] ${target.path.padEnd(36)} sév:${target.severity.padEnd(9)} ${http}`);
    if (result.preview) lines.push(`  → ${result.preview.replace(/\n/g, ' ').slice(0, 120)}`);
    if (result.note)    lines.push(`  ℹ ${result.note}`);
    if (result.message) lines.push(`  ✗ ${result.message}`);
  }
  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    const btn = document.getElementById('btn-export');
    const prev = btn.textContent;
    btn.textContent = '✓ Copié dans le presse-papier !';
    setTimeout(() => { btn.textContent = prev; }, 2500);
  }).catch(() => alert(lines.join('\n')));
}
