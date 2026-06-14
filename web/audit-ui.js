'use strict';

import { esc } from './audit-core.js';

export const SEV_META = {
  CRITIQUE: { label: 'CRITIQUE', dot: 'd-critical' },
  ÉLEVÉ:    { label: 'ÉLEVÉ',    dot: 'd-high'     },
  MOYEN:    { label: 'MOYEN',    dot: 'd-medium'   },
  FAIBLE:   { label: 'FAIBLE',   dot: 'd-low'      },
  INFO:     { label: 'INFO',     dot: 'd-info'      },
};

export const KIND_META = {
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

export function sevBadgeHtml(severity) {
  const m = SEV_META[severity] || SEV_META.INFO;
  return `<span class="badge sev-badge"><span class="sev-dot ${m.dot}"></span>${m.label}</span>`;
}

export function statusBadgeHtml(kind) {
  const m = KIND_META[kind] || KIND_META.error;
  return `<span class="badge ${m.cls}">${m.label}</span>`;
}

export function pathCellHtml(target) {
  const parts = target.path.split('/');
  const name  = parts.pop();
  const dir   = parts.length ? parts.join('/') + '/' : '';
  return `<td class="path">
    <span class="path-name">${esc(name)}</span>
    ${dir ? `<span class="path-sub">${esc(dir)}</span>` : ''}
    ${target.desc ? `<span class="path-desc">${esc(target.desc)}</span>` : ''}
  </td>`;
}

export function appendRow(target) {
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

export function updateRow(target, result) {
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
  if (result.secrets && result.secrets.length) {
    detailHtml += `<div class="secrets-box">${result.secrets.map(s => `<div class="secret-line">⚠ ${esc(s.name)} → ${esc(s.masked)}</div>`).join('')}</div>`;
  }

  tr.children[1].innerHTML = sevBadgeHtml(target.severity);
  tr.children[2].innerHTML = statusBadgeHtml(result.kind);
  tr.children[3].innerHTML = httpHtml;
  tr.children[4].innerHTML = detailHtml;
}

export function updateStats(counts) {
  document.getElementById('n-exposed').textContent   = counts.exposed;
  document.getElementById('n-warning').textContent   = counts.warning;
  document.getElementById('n-protected').textContent = counts.protected;
  document.getElementById('n-safe').textContent      = counts.safe;
}

export function setProgress(done, total, label) {
  const pct = Math.round((done / total) * 100);
  document.getElementById('progress-fill').style.width  = `${pct}%`;
  document.getElementById('progress-pct').textContent   = `${pct}%`;
  document.getElementById('progress-label').textContent = label;
}
