'use strict';

export function exportAIPrompt(auditResults) {
  const exposed = auditResults.filter(r => r.result.kind === 'exposed');
  const warnings = auditResults.filter(r => r.result.kind === 'warning');

  if (exposed.length === 0 && warnings.length === 0) {
    navigator.clipboard.writeText("Aucun problème de sécurité détecté lors de l'audit.").then(() => {
      const btn = document.getElementById('btn-prompt');
      const prev = btn.textContent;
      btn.textContent = '✓ Prompt copié !';
      setTimeout(() => { btn.textContent = prev; }, 2500);
    });
    return;
  }

  const lines = [
    "Tu es un expert en sécurité web frontend. Voici les problèmes détectés lors d'un audit de fichiers sensibles exposés publiquement sur un serveur web.",
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
  lines.push("1. Bloquer l'accès aux fichiers exposés via la configuration du serveur web (nginx, Apache, etc.) ou les règles .htaccess.");
  lines.push('2. Vérifier que les fichiers .env, credentials et clés privées ne sont pas déployés dans le build ou le dossier public.');
  lines.push("3. Ajouter des règles de deny globales pour les extensions et dossiers sensibles (.git, .ssh, .env*, *.sql, etc.).");
  lines.push("4. Réviser le pipeline CI/CD pour s'assurer qu'aucun secret n'est poussé par erreur.");
  lines.push("5. Si certains fichiers doivent rester accessibles (ex: package.json), confirmer explicitement que c'est intentionnel et documenté.");
  lines.push('');
  lines.push('Propose un plan de correction minimal et priorisé, puis des snippets de configuration (nginx, Apache, ou Cloudflare) pour sécuriser ces fichiers.');

  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    const btn = document.getElementById('btn-prompt');
    const prev = btn.textContent;
    btn.textContent = '✓ Prompt copié !';
    setTimeout(() => { btn.textContent = prev; }, 2500);
  }).catch(() => alert(lines.join('\n')));
}

export function exportReport(auditResults, counts) {
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

export function downloadJSON(auditResults, counts) {
  const report = {
    date: new Date().toISOString(),
    origin: window.location.origin,
    summary: {
      total: auditResults.length,
      exposed: counts.exposed,
      warning: counts.warning,
      protected: counts.protected,
      safe: counts.safe,
    },
    results: auditResults.map(({ target, result }) => ({
      path: target.path,
      severity: target.severity,
      description: target.desc || null,
      kind: result.kind,
      status: result.status || null,
      preview: result.preview || null,
      note: result.note || null,
      secrets: result.secrets || [],
      message: result.message || null,
    })),
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `security-audit-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
