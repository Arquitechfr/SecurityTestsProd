'use strict';

import {
  setupPinInputs, TARGETS, TIMEOUT_MS, checkTarget, readBody, isSPAFallback,
} from './audit-core.js';
import {
  appendRow, updateRow, updateStats, setProgress,
} from './audit-ui.js';
import {
  exportAIPrompt, exportReport, downloadJSON,
} from './audit-report.js';

// ── State ──────────────────────────────────────────────────────────────────────

let mainAbort    = null;
let isRunning    = false;
let auditResults = [];
const counts     = { exposed: 0, warning: 0, protected: 0, safe: 0 };

// ── Init ───────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  setupPinInputs();
  document.getElementById('lbl-origin').textContent = window.location.origin;
  document.getElementById('lbl-count').textContent  = TARGETS.length;

  document.getElementById('btn-start').addEventListener('click', startAudit);
  document.getElementById('btn-stop').addEventListener('click', stopAudit);
  document.getElementById('btn-export').addEventListener('click', () => exportReport(auditResults, counts));
  document.getElementById('btn-json').addEventListener('click', () => downloadJSON(auditResults, counts));
  document.getElementById('btn-prompt').addEventListener('click', () => exportAIPrompt(auditResults));
});

// ── Audit orchestration ────────────────────────────────────────────────────────

async function startAudit() {
  if (isRunning) return;
  if (window.location.protocol === 'file:') {
    alert('⚠️ Ce fichier doit être servi par un serveur web (pas ouvert via file://).');
    return;
  }
  isRunning = true;

  Object.assign(counts, { exposed: 0, warning: 0, protected: 0, safe: 0 });
  auditResults = [];
  document.getElementById('tbody').innerHTML = '';
  document.getElementById('status-text').textContent = 'Audit en cours...';
  document.getElementById('btn-start').disabled  = true;
  document.getElementById('btn-stop').disabled   = false;
  document.getElementById('btn-export').disabled = true;
  document.getElementById('btn-json').disabled   = true;
  document.getElementById('btn-prompt').disabled = true;
  document.getElementById('progress-wrap').style.display = 'block';
  document.getElementById('stats').style.display = 'grid';
  document.getElementById('results-table').style.display = 'table';
  updateStats(counts);

  mainAbort = new AbortController();
  const mainSignal = mainAbort.signal;

  const seen = new Set();
  const uniqueTargets = [];
  for (const t of TARGETS) {
    if (!seen.has(t.path)) {
      seen.add(t.path);
      uniqueTargets.push(t);
      appendRow(t);
    }
  }

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
    updateStats(counts);
    auditResults.push({ target, result });

    done++;
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
  document.getElementById('btn-json').disabled   = false;
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
