/* ============================================================
   DocFlow — maquette dynamique (aucune dépendance externe)
   1. Données de démonstration & génération des documents
   ============================================================ */
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NOW = Date.now();
const HOUR = 3600e3, DAY = 24 * HOUR;

/* PRNG déterministe : la maquette affiche toujours les mêmes données */
function seeded(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
const pad  = (n, l = 3) => String(n).padStart(l, '0');

const fmtDate = ts => new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const fmtDT   = ts => new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const fmtDur  = ms => {
  const late = ms < 0; ms = Math.abs(ms);
  const h = Math.floor(ms / HOUR), m = Math.floor((ms % HOUR) / 60000);
  const txt = h >= 24 ? `${Math.floor(h / 24)} j ${h % 24} h` : (h ? `${h} h ${pad(m, 2)}` : `${m} min`);
  return late ? `+${txt} de retard` : `dans ${txt}`;
};
const slaLevel = ts => {
  const d = ts - NOW;
  return d < 0 ? 'late' : d < 2 * HOUR ? 'risk' : 'ok';
};

/* ---------- Utilisateurs & groupes ---------- */
const GROUPES = {
  'OPS-IDENT-1': { nom: 'Identification — Équipe 1', perimetre: ['Orange', 'Crédit Mutuel', 'EDF'] },
  'OPS-IDENT-2': { nom: 'Identification — Équipe 2', perimetre: ['SFR', 'AXA', 'Crédit Mutuel'] },
  'OPS-SAISIE':  { nom: 'Saisie & contrôle',        perimetre: ['Crédit Mutuel', 'AXA', 'EDF'] },
  'SUPERVISEUR': { nom: 'Supervision (tous flux)',  perimetre: '*' }
};
const USERS = [
  { login: 'm.issoulghane', nom: 'M. Issoulghane', groupe: 'OPS-IDENT-1' },
  { login: 'l.moreau',      nom: 'L. Moreau',      groupe: 'OPS-IDENT-2' },
  { login: 'c.tran',        nom: 'C. Tran',        groupe: 'OPS-SAISIE'  },
  { login: 's.benali',      nom: 'S. Benali',      groupe: 'SUPERVISEUR' }
];

/* ---------- Référentiel des classes par flux ---------- */
const CLASSES = {
  BS: ['Bulletin de salaire', 'Attestation employeur', 'Contrat de travail', 'Solde de tout compte',
       'Relevé d\'identité bancaire', 'Pièce d\'identité', 'Justificatif de domicile', 'Courrier d\'accompagnement',
       'Document illisible', 'Page de séparation'],
  KYC: ['Pièce d\'identité recto', 'Pièce d\'identité verso', 'Passeport', 'Titre de séjour',
        'Justificatif de domicile', 'Relevé d\'identité bancaire', 'Avis d\'imposition', 'Kbis',
        'Statuts de société', 'Document illisible'],
  SIN: ['Déclaration de sinistre', 'Constat amiable', 'Facture de réparation', 'Devis',
        'Rapport d\'expertise', 'Photo de dommage', 'Procès-verbal', 'Certificat médical',
        'Relevé d\'identité bancaire', 'Document illisible'],
  FAC: ['Facture', 'Avoir', 'Bon de commande', 'Bon de livraison', 'Relance',
        'Relevé de compte', 'Contrat de fourniture', 'Mandat SEPA', 'Document illisible'],
  RES: ['Demande de résiliation', 'Pièce d\'identité', 'Justificatif de déménagement',
        'Attestation sur l\'honneur', 'RIB', 'Courrier recommandé', 'Document illisible']
};
const MOTIFS_REJET = ['Document illisible', 'Hors périmètre du flux', 'Doublon déjà traité',
                      'Document non conforme', 'Page blanche / séparateur'];
const MOTIFS_COMPL = ['Page manquante', 'Document tronqué à la numérisation', 'Document expiré',
                      'Signature absente', 'Pièce jointe non exploitable'];

/* ---------- Flux & activités ---------- */
const FLUX = [
  { id: 'F01', client: 'Orange',        type: 'Bulletin de salaire', cls: 'BS'  },
  { id: 'F02', client: 'Crédit Mutuel', type: 'KYC',                 cls: 'KYC' },
  { id: 'F03', client: 'AXA',           type: 'Sinistre auto',       cls: 'SIN' },
  { id: 'F04', client: 'EDF',           type: 'Facturation',         cls: 'FAC' },
  { id: 'F05', client: 'SFR',           type: 'Résiliation',         cls: 'RES' },
  { id: 'F06', client: 'Crédit Mutuel', type: 'Entrée en relation',  cls: 'KYC' },
  { id: 'F07', client: 'Orange',        type: 'Justificatif RH',     cls: 'BS'  }
];
const ACT_DEF = [
  ['A01', 'F01', 'Identification', 'OPS-IDENT-1', 42, 3.5, 'Haute'],
  ['A02', 'F02', 'Identification', 'OPS-IDENT-1', 128, -1.2, 'Haute'],
  ['A03', 'F03', 'Identification', 'OPS-IDENT-2', 61, 7, 'Normale'],
  ['A04', 'F04', 'Identification', 'OPS-IDENT-1', 24, 1.1, 'Normale'],
  ['A05', 'F05', 'Identification', 'OPS-IDENT-2', 17, 26, 'Basse'],
  ['A06', 'F06', 'Identification', 'OPS-IDENT-2', 73, 5.5, 'Haute'],
  ['A07', 'F07', 'Identification', 'OPS-IDENT-1', 9, 49, 'Basse'],
  ['A08', 'F02', 'Saisie',         'OPS-SAISIE',  56, 4, 'Haute'],
  ['A09', 'F03', 'Saisie',         'OPS-SAISIE',  31, 12, 'Normale'],
  ['A10', 'F01', 'Validation',     'OPS-SAISIE',  18, 2.5, 'Normale'],
  ['A11', 'F04', 'Validation',     'OPS-IDENT-1', 12, 22, 'Basse']
];
const ACTIVITES = ACT_DEF.map(([id, fluxId, type, groupe, nb, slaH, prio], i) => {
  const flux = FLUX.find(f => f.id === fluxId);
  const rnd = seeded(i + 7);
  return {
    id, type, groupe, prio, nbDocs: nb, flux,
    libelle: `${type} des documents — ${flux.client} ${flux.type}`,
    echeance: NOW + slaH * HOUR,
    depotMin: NOW - (2 + rnd() * 30) * HOUR,
    lot: `LOT-${new Date(NOW).getFullYear()}-${pad(120 + i)}`
  };
});

/* ---------- Génération de la file documentaire d'une activité ---------- */
const CANAUX = ['Portail client', 'E-mail', 'Courrier numérisé', 'API partenaire', 'GED interne'];
const NOMS = ['DUPONT Marie', 'BENOIT Karim', 'LEROY Sophie', 'NGUYEN Paul', 'GARCIA Ana',
              'MARTIN Luc', 'ROBERT Chloé', 'FAURE Idris', 'PETIT Elsa', 'MOREL Hugo'];

function buildDocs(act) {
  const rnd = seeded(parseInt(act.id.slice(1)) * 991);
  const classes = CLASSES[act.flux.cls];
  return Array.from({ length: act.nbDocs }, (_, i) => {
    const vraie = pick(rnd, classes.slice(0, classes.length - 1));
    const conf = 0.42 + rnd() * 0.57;
    const nbPages = 1 + Math.floor(rnd() * 3);
    return {
      id: `${act.id}-D${pad(i + 1)}`,
      ref: `${act.flux.id}-${pad(4200 + i * 7, 5)}`,
      dossier: `${act.flux.client.slice(0, 3).toUpperCase()}-${pad(9000 + Math.floor(rnd() * 900))}`,
      titulaire: pick(rnd, NOMS),
      fichier: `scan_${pad(i + 1, 4)}_${act.flux.cls.toLowerCase()}.pdf`,
      canal: pick(rnd, CANAUX),
      depot: act.depotMin + rnd() * 6 * HOUR,
      poids: (0.2 + rnd() * 4).toFixed(1) + ' Mo',
      pages: nbPages,
      vraie,
      suggestion: { classe: conf > 0.55 ? vraie : pick(rnd, classes), confiance: conf },
      seed: i * 37 + parseInt(act.id.slice(1)),
      statut: 'todo', classe: null, motif: null, commentaire: null, temps: 0
    };
  });
}

/* ---------- Rendu d'une page « scannée » en SVG ---------- */
function pageSVG(doc, page) {
  const rnd = seeded(doc.seed * 13 + page * 101);
  const W = 620, H = 850;
  const skew = (rnd() - .5) * 1.2;
  const teinte = ['#fdfdfb', '#fbfaf6', '#fcfcfa'][Math.floor(rnd() * 3)];
  const line = (x, y, w, h = 7, o = .78) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="#0f172a" opacity="${o * (.35 + rnd() * .4)}"/>`;
  let body = '';

  /* bloc en-tête */
  body += `<rect x="48" y="46" width="120" height="44" rx="4" fill="#94a3b8" opacity=".45"/>`;
  body += line(200, 52, 190, 11, .9) + line(200, 72, 130, 7);
  body += `<rect x="48" y="112" width="524" height="1" fill="#0f172a" opacity=".2"/>`;

  const titre = (page === 1 ? doc.vraie : ['Annexe', 'Suite du document', 'Page complémentaire'][page % 3]).toUpperCase();
  body += `<text x="48" y="152" font-family="Helvetica,Arial" font-size="19" font-weight="700"
             fill="#0f172a" opacity=".82" letter-spacing="1">${titre}</text>`;
  body += line(48, 172, 260, 6, .5);

  /* bloc identité */
  body += `<rect x="330" y="150" width="242" height="86" rx="4" fill="#0f172a" opacity=".04"/>`;
  body += `<text x="344" y="176" font-family="Helvetica,Arial" font-size="11" fill="#0f172a" opacity=".7">${doc.titulaire}</text>`;
  body += line(344, 190, 150, 6) + line(344, 204, 120, 6) + line(344, 218, 170, 6);

  /* paragraphes */
  let y = 262;
  for (let b = 0; b < 3; b++) {
    for (let l = 0; l < 3 + Math.floor(rnd() * 3); l++) {
      body += line(48, y, 300 + rnd() * 224); y += 16;
    }
    y += 14;
  }
  /* tableau */
  const ty = y + 6, rows = 4 + Math.floor(rnd() * 3);
  body += `<rect x="48" y="${ty}" width="524" height="${24 + rows * 22}" rx="3" fill="none" stroke="#0f172a" stroke-opacity=".18"/>`;
  body += `<rect x="48" y="${ty}" width="524" height="24" fill="#0f172a" opacity=".07"/>`;
  for (let c = 0; c < 4; c++) body += line(62 + c * 130, ty + 8, 70, 6, .6);
  for (let r = 0; r < rows; r++) {
    const ry = ty + 24 + r * 22;
    body += `<rect x="48" y="${ry}" width="524" height="1" fill="#0f172a" opacity=".1"/>`;
    for (let c = 0; c < 4; c++) body += line(62 + c * 130, ry + 7, 50 + rnd() * 50, 6, .55);
  }
  /* pied de page + tampon */
  body += line(48, 762, 200, 6, .45) + line(430, 762, 142, 6, .45);
  if (rnd() > .45) {
    body += `<g transform="translate(430 660) rotate(-14)"><rect x="0" y="0" width="140" height="60" rx="6"
      fill="none" stroke="#1d4ed8" stroke-width="3" opacity=".45"/>
      <text x="18" y="26" font-family="Helvetica" font-size="13" fill="#1d4ed8" opacity=".55">REÇU LE</text>
      <text x="18" y="46" font-family="Helvetica" font-size="13" fill="#1d4ed8" opacity=".55">${fmtDate(doc.depot)}</text></g>`;
  }
  /* bruit de numérisation */
  let noise = '';
  for (let n = 0; n < 40; n++)
    noise += `<circle cx="${rnd() * W}" cy="${rnd() * H}" r="${rnd() * 1.4}" fill="#0f172a" opacity=".07"/>`;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="${teinte}"/>
    <g transform="rotate(${skew} ${W / 2} ${H / 2})">${body}${noise}</g>
    <text x="${W - 60}" y="${H - 24}" font-family="Helvetica" font-size="10" fill="#0f172a" opacity=".45">${page}/${doc.pages}</text>
  </svg>`;
}

/* ---------- État applicatif ---------- */
const state = {
  user: null,
  sort: { key: 'sla', dir: 1 },
  act: null, docs: [], idx: 0, page: 1,
  zoom: 1, rot: 0, selClasse: null, tStart: 0, undo: null
};

/* ---------- Thème & toasts ---------- */
function initTheme() {
  const saved = localStorage.getItem('df-theme');
  if (saved) document.documentElement.dataset.theme = saved;
  $('#btn-theme').onclick = () => {
    const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
    localStorage.setItem('df-theme', t);
  };
}
function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind; el.textContent = msg;
  $('#toasts').append(el);
  setTimeout(() => { el.style.opacity = 0; setTimeout(() => el.remove(), 250); }, 2600);
}
function show(id) { $$('.screen').forEach(s => s.classList.toggle('active', s.id === id)); }

/* ---------- Connexion ---------- */
function initLogin() {
  const sel = $('#login-user');
  sel.innerHTML = USERS.map(u => `<option value="${u.login}">${u.login} — ${u.nom}</option>`).join('');
  const info = () => {
    const u = USERS.find(x => x.login === sel.value);
    const g = GROUPES[u.groupe];
    const per = g.perimetre === '*' ? 'tous les clients' : g.perimetre.join(', ');
    $('#login-groupinfo').innerHTML = `<b>Groupe :</b> ${u.groupe} — ${g.nom}<br><b>Périmètre :</b> ${per}`;
  };
  sel.onchange = info; info();
  $('#login-form').onsubmit = e => {
    e.preventDefault();
    if (!$('#login-pwd').value) return toast('Mot de passe requis', 'err');
    state.user = USERS.find(u => u.login === sel.value);
    $('#user-chip').innerHTML = `<b>${state.user.nom}</b><span>${state.user.groupe}</span>`;
    show('screen-home'); renderHome();
    toast(`Bienvenue ${state.user.nom}`, 'ok');
  };
  $('#btn-logout').onclick = () => { state.user = null; show('screen-login'); };
}

/* ============================================================
   2. Écran d'accueil : filtres, KPI, file d'activités
   ============================================================ */
function fillSelect(sel, values, label) {
  sel.innerHTML = `<option value="">${label}</option>` + values.map(v => `<option>${v}</option>`).join('');
}
function initHome() {
  fillSelect($('#f-client'),   [...new Set(FLUX.map(f => f.client))].sort(), 'Tous');
  fillSelect($('#f-typeflux'), [...new Set(FLUX.map(f => f.type))].sort(),   'Tous');
  fillSelect($('#f-activite'), ['Identification', 'Saisie', 'Validation'],   'Toutes');
  ['#f-q', '#f-client', '#f-typeflux', '#f-activite', '#f-from', '#f-to', '#f-sla', '#f-prio', '#f-mygroup']
    .forEach(s => $(s).addEventListener('input', renderHome));
  $('#btn-reset').onclick = () => {
    ['#f-q', '#f-client', '#f-typeflux', '#f-activite', '#f-from', '#f-to', '#f-sla', '#f-prio']
      .forEach(s => $(s).value = '');
    $('#f-mygroup').checked = true; renderHome();
  };
  $$('#tbl th[data-sort]').forEach(th => th.onclick = () => {
    const k = th.dataset.sort;
    state.sort = { key: k, dir: state.sort.key === k ? -state.sort.dir : 1 };
    renderHome();
  });
  $('#btn-back').onclick = () => { show('screen-home'); renderHome(); };
}

function currentFilters() {
  return {
    q: $('#f-q').value.trim().toLowerCase(),
    client: $('#f-client').value, typeflux: $('#f-typeflux').value,
    activite: $('#f-activite').value, from: $('#f-from').value, to: $('#f-to').value,
    sla: $('#f-sla').value, prio: $('#f-prio').value, mine: $('#f-mygroup').checked
  };
}
function applyFilters() {
  const f = currentFilters(), g = GROUPES[state.user.groupe];
  return ACTIVITES.filter(a => {
    if (g.perimetre !== '*' && !g.perimetre.includes(a.flux.client)) return false;
    if (f.mine && state.user.groupe !== 'SUPERVISEUR' && a.groupe !== state.user.groupe) return false;
    if (f.client && a.flux.client !== f.client) return false;
    if (f.typeflux && a.flux.type !== f.typeflux) return false;
    if (f.activite && a.type !== f.activite) return false;
    if (f.prio && a.prio !== f.prio) return false;
    if (f.from && a.depotMin < new Date(f.from + 'T00:00').getTime()) return false;
    if (f.to && a.depotMin > new Date(f.to + 'T23:59').getTime()) return false;
    if (f.sla) {
      const lvl = slaLevel(a.echeance);
      const sameDay = new Date(a.echeance).toDateString() === new Date(NOW).toDateString();
      if (f.sla === 'today' ? !sameDay : lvl !== f.sla) return false;
    }
    if (f.q) {
      const hay = [a.libelle, a.flux.client, a.flux.type, a.type, a.lot, a.id].join(' ').toLowerCase();
      if (!hay.includes(f.q)) return false;
    }
    return true;
  });
}
function sortRows(rows) {
  const { key, dir } = state.sort;
  const val = a => ({
    activite: a.type + a.libelle, client: a.flux.client + a.flux.type, type: a.flux.type,
    prio: { Haute: 0, Normale: 1, Basse: 2 }[a.prio], depot: a.depotMin,
    sla: a.echeance, docs: a.nbDocs
  }[key]);
  return rows.sort((x, y) => (val(x) > val(y) ? 1 : val(x) < val(y) ? -1 : 0) * dir);
}

function renderHome() {
  const rows = sortRows(applyFilters());
  const all = applyFilters();
  const docs = all.reduce((s, a) => s + a.nbDocs, 0);
  const late = all.filter(a => slaLevel(a.echeance) === 'late');
  const risk = all.filter(a => slaLevel(a.echeance) === 'risk');
  $('#kpis').innerHTML = `
    <div class="kpi"><div class="v">${docs.toLocaleString('fr-FR')}</div><div class="l">Documents en attente</div></div>
    <div class="kpi"><div class="v">${all.length}</div><div class="l">Activités affectées</div></div>
    <div class="kpi ${late.length ? 'alert' : ''}"><div class="v">${late.length}</div><div class="l">Activités hors SLA</div></div>
    <div class="kpi"><div class="v">${risk.length}</div><div class="l">Échéance &lt; 2 h</div></div>`;

  const f = currentFilters();
  const chips = [];
  if (f.mine) chips.push(['Mon groupe : ' + state.user.groupe, () => { $('#f-mygroup').checked = false; renderHome(); }]);
  [['client', 'Client'], ['typeflux', 'Flux'], ['activite', 'Activité'], ['prio', 'Priorité']].forEach(([k, lbl]) => {
    if (f[k]) chips.push([`${lbl} : ${f[k]}`, () => { $('#f-' + (k === 'typeflux' ? 'typeflux' : k)).value = ''; renderHome(); }]);
  });
  if (f.sla) chips.push([`SLA : ${$('#f-sla').selectedOptions[0].text}`, () => { $('#f-sla').value = ''; renderHome(); }]);
  if (f.from || f.to) chips.push([`Dépôt ${f.from || '…'} → ${f.to || '…'}`, () => { $('#f-from').value = $('#f-to').value = ''; renderHome(); }]);
  const chipsEl = $('#chips'); chipsEl.innerHTML = '';
  chips.forEach(([txt, fn]) => {
    const c = document.createElement('span');
    c.className = 'chip on'; c.textContent = txt + '  ✕'; c.onclick = fn; chipsEl.append(c);
  });

  const tag = t => t === 'Identification' ? 'ident' : t === 'Saisie' ? 'saisie' : 'valid';
  $('#tbody').innerHTML = rows.map(a => {
    const lvl = slaLevel(a.echeance), ident = a.type === 'Identification';
    return `<tr data-id="${a.id}" class="${ident ? '' : 'disabled'}">
      <td><div class="act-name"><span class="tag ${tag(a.type)}">${a.type}</span></div>
          <div class="act-sub">${a.libelle}</div></td>
      <td><b>${a.flux.client}</b><div class="act-sub">${a.lot}</div></td>
      <td>${a.flux.type}</td>
      <td><span class="tag prio-${a.prio}">${a.prio}</span></td>
      <td>${fmtDT(a.depotMin)}</td>
      <td><span class="sla ${lvl}"><span class="dot"></span>${fmtDur(a.echeance - NOW)}</span>
          <div class="act-sub">Échéance ${fmtDT(a.echeance)}</div></td>
      <td class="num"><span class="count">${a.nbDocs}</span></td>
      <td class="num"><button class="btn ${ident ? 'btn-primary' : ''}" ${ident ? '' : 'disabled'}>${ident ? 'Traiter' : 'Hors maquette'}</button></td>
    </tr>`;
  }).join('');
  $('#empty').hidden = rows.length > 0;
  $$('#tbody tr').forEach(tr => tr.onclick = () => {
    const a = ACTIVITES.find(x => x.id === tr.dataset.id);
    if (a.type !== 'Identification') return toast('Maquette limitée aux activités d\'identification', 'warn');
    openActivity(a);
  });
}

/* ============================================================
   3. Poste de travail « Identification »
   ============================================================ */
const store = {
  key: a => `df-progress-${a.id}`,
  load(a, docs) {
    try {
      const raw = JSON.parse(localStorage.getItem(this.key(a)) || '{}');
      docs.forEach(d => Object.assign(d, raw[d.id] || {}));
    } catch (e) { /* ignore */ }
  },
  save(a, docs) {
    const o = {};
    docs.forEach(d => { if (d.statut !== 'todo') o[d.id] = { statut: d.statut, classe: d.classe, motif: d.motif, commentaire: d.commentaire, temps: d.temps }; });
    localStorage.setItem(this.key(a), JSON.stringify(o));
  }
};

function openActivity(act) {
  state.act = act;
  state.docs = buildDocs(act);
  store.load(act, state.docs);
  state.idx = Math.max(0, state.docs.findIndex(d => d.statut === 'todo'));
  if (state.idx < 0) state.idx = 0;
  $('#work-title').textContent = `${act.libelle} · ${act.lot}`;
  const lvl = slaLevel(act.echeance);
  const sla = $('#work-sla');
  sla.textContent = `SLA ${fmtDur(act.echeance - NOW)}`;
  sla.className = 'sla-pill sla ' + lvl;
  show('screen-work');
  renderClasses(); loadDoc(0, true);
}

const cur = () => state.docs[state.idx];
const doneCount = () => state.docs.filter(d => d.statut !== 'todo').length;

/* ---------- Chargement d'un document ---------- */
function loadDoc(i, abs = false) {
  const n = state.docs.length;
  const target = abs ? i : state.idx + i;
  if (target < 0) return toast('Début de la file atteint', 'warn');
  if (target >= n) return toast('Fin de la file atteinte', 'warn');
  if (state.tStart && cur()) cur().temps += Date.now() - state.tStart;
  state.idx = target; state.page = 1; state.rot = 0; state.zoom = 1;
  state.tStart = Date.now();
  const d = cur();
  state.selClasse = d.classe || (d.suggestion.confiance > .75 ? d.suggestion.classe : null);
  $('#cls-search').value = '';
  renderAll();
}
function renderAll() { renderViewer(); renderMeta(); renderQueue(); renderClasses(); renderProgress(); }

/* ---------- Visionneuse ---------- */
function renderViewer() {
  const d = cur();
  $('#page-holder').innerHTML = pageSVG(d, state.page);
  applyTransform();
  $('#p-label').textContent = `Page ${state.page} / ${d.pages}`;
  $('#counter').textContent = `${state.idx + 1} / ${state.docs.length}`;
  $('#v-meta').innerHTML = `<span>Réf. <b>${d.ref}</b></span><span>Fichier <b>${d.fichier}</b></span>
    <span>Canal <b>${d.canal}</b></span>`;
  $('#n-prev').disabled = state.idx === 0;
  $('#n-first').disabled = state.idx === 0;
  $('#n-next').disabled = state.idx === state.docs.length - 1;
  $('#n-last').disabled = state.idx === state.docs.length - 1;
  $('#p-prev').disabled = state.page === 1;
  $('#p-next').disabled = state.page === d.pages;
}
function applyTransform() {
  $('#page-holder').style.transform = `scale(${state.zoom}) rotate(${state.rot}deg)`;
  $('#v-zoom').textContent = Math.round(state.zoom * 100) + ' %';
}
function zoom(delta) { state.zoom = Math.min(3, Math.max(.35, +(state.zoom + delta).toFixed(2))); applyTransform(); }

/* ---------- Métadonnées & suggestion IA ---------- */
function renderMeta() {
  const d = cur();
  const st = { todo: 'À traiter', classe: 'Classé', rejete: 'Rejeté', complement: 'Complément demandé' }[d.statut];
  $('#doc-meta').innerHTML = `
    <dt>Référence</dt><dd>${d.ref}</dd>
    <dt>Dossier</dt><dd>${d.dossier}</dd>
    <dt>Titulaire</dt><dd>${d.titulaire}</dd>
    <dt>Dépôt</dt><dd>${fmtDT(d.depot)}</dd>
    <dt>Pages / poids</dt><dd>${d.pages} p. · ${d.poids}</dd>
    <dt>Statut</dt><dd>${st}${d.classe ? ' — ' + d.classe : ''}${d.motif ? ' — ' + d.motif : ''}</dd>`;
  const s = d.suggestion, pc = Math.round(s.confiance * 100);
  $('#ia-block').innerHTML = `<h3>Pré-classement automatique</h3>
    <div class="sugg"><b>${s.classe}</b><span>${pc} %</span></div>
    <div class="bar"><i style="width:${pc}%"></i></div>
    <button class="btn btn-block" id="ia-apply" style="margin-top:10px">Reprendre la proposition <kbd>S</kbd></button>`;
  $('#ia-apply').onclick = () => { state.selClasse = s.classe; renderClasses(); };
}

/* ---------- File de documents ---------- */
function renderQueue() {
  const f = $('#queue-filter').value;
  const list = state.docs
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => f === 'all' || (f === 'todo' ? d.statut === 'todo' : d.statut !== 'todo'));
  $('#queue-count').textContent = state.docs.length;
  $('#queue-list').innerHTML = list.map(({ d, i }) => `
    <li data-i="${i}" class="${i === state.idx ? 'cur' : ''}">
      <span class="q-idx">${pad(i + 1)}</span>
      <span class="q-body"><span class="q-name">${d.ref}</span>
        <span class="q-sub">${d.classe || d.motif || d.titulaire}</span></span>
      <span class="q-st ${d.statut}"></span>
    </li>`).join('');
  $$('#queue-list li').forEach(li => li.onclick = () => loadDoc(+li.dataset.i, true));
  const c = $('#queue-list .cur'); if (c) c.scrollIntoView({ block: 'nearest' });
}
function renderProgress() {
  const done = doneCount(), n = state.docs.length;
  $('#progress-bar').style.width = (done / n * 100) + '%';
  $('#progress-label').textContent = `${done}/${n} traités`;
}

/* ---------- Liste des classes ---------- */
function visibleClasses() {
  const q = $('#cls-search').value.trim().toLowerCase();
  return CLASSES[state.act.flux.cls].filter(c => c.toLowerCase().includes(q));
}
function renderClasses() {
  if (!state.act) return;
  const list = visibleClasses();
  $('#cls-list').innerHTML = list.map((c, i) => `
    <li data-c="${c}" class="${c === state.selClasse ? 'sel' : ''}">
      <span class="num">${i < 9 ? i + 1 : '·'}</span><span>${c}</span></li>`).join('');
  $$('#cls-list li').forEach(li => li.onclick = () => {
    state.selClasse = li.dataset.c; renderClasses();
  });
  $('#a-valid').disabled = !state.selClasse;
}

/* ---------- Actions métier ---------- */
function setStatut(patch, msg, kind) {
  const d = cur();
  state.undo = { id: d.id, prev: { statut: d.statut, classe: d.classe, motif: d.motif, commentaire: d.commentaire } };
  Object.assign(d, patch);
  d.temps += Date.now() - state.tStart; state.tStart = Date.now();
  store.save(state.act, state.docs);
  toast(msg, kind);
  renderProgress();
  if (state.idx < state.docs.length - 1) loadDoc(1); else { renderAll(); finishModal(); }
}
function valider() {
  if (!state.selClasse) return toast('Sélectionnez une classe cible', 'err');
  setStatut({ statut: 'classe', classe: state.selClasse, motif: null }, `Classé : ${state.selClasse}`, 'ok');
}
function undo() {
  if (!state.undo) return toast('Aucune action à annuler', 'warn');
  const { id, prev } = state.undo;
  const i = state.docs.findIndex(d => d.id === id);
  Object.assign(state.docs[i], prev);
  state.undo = null; store.save(state.act, state.docs);
  loadDoc(i, true); toast('Action annulée', 'warn');
}

/* ---------- Modales ---------- */
let modalOpen = false;
function openModal(html, onMount) {
  $('#modal').innerHTML = html; $('#modal-backdrop').hidden = false; modalOpen = true;
  if (onMount) onMount();
  const first = $('#modal input,#modal textarea,#modal button');
  if (first) first.focus();
}
function closeModal() {
  if (document.activeElement) document.activeElement.blur();
  $('#modal-backdrop').hidden = true; $('#modal').innerHTML = ''; modalOpen = false;
}
$('#modal-backdrop').addEventListener('click', e => { if (e.target.id === 'modal-backdrop') closeModal(); });

function motifModal(kind) {
  const rejet = kind === 'rejet';
  const motifs = rejet ? MOTIFS_REJET : MOTIFS_COMPL;
  openModal(`
    <h2>${rejet ? 'Rejeter le document' : 'Demander un complément'}</h2>
    <p class="sub">${cur().ref} — ${cur().titulaire}</p>
    <div class="opts">${motifs.map((m, i) => `
      <label><input type="radio" name="motif" value="${m}" ${i === 0 ? 'checked' : ''}><span>${m}</span></label>`).join('')}</div>
    ${rejet ? '' : '<label class="field"><span>Destinataire</span><select id="m-dest"><option>Client — espace de dépôt</option><option>Service courrier</option><option>Superviseur du flux</option></select></label>'}
    <label class="field" style="margin-top:10px"><span>Commentaire (optionnel)</span>
      <textarea id="m-com" placeholder="Précisez le contexte…"></textarea></label>
    <div class="modal-actions">
      <button class="btn" id="m-cancel">Annuler <kbd>Échap</kbd></button>
      <button class="btn ${rejet ? 'btn-danger' : 'btn-warn'}" id="m-ok">${rejet ? 'Confirmer le rejet' : 'Envoyer la demande'}</button>
    </div>`, () => {
    $('#m-cancel').onclick = closeModal;
    $('#m-ok').onclick = () => {
      const motif = $('#modal input[name=motif]:checked').value;
      const com = $('#m-com').value.trim();
      closeModal();
      setStatut(
        { statut: rejet ? 'rejete' : 'complement', motif, commentaire: com, classe: null },
        rejet ? `Document rejeté — ${motif}` : `Complément demandé — ${motif}`,
        rejet ? 'err' : 'warn');
    };
  });
}

function finishModal() {
  const d = state.docs;
  const n = k => d.filter(x => x.statut === k).length;
  const traites = doneCount();
  const tps = traites ? Math.round(d.reduce((s, x) => s + x.temps, 0) / traites / 1000) : 0;
  openModal(`
    <h2>Session d'identification</h2>
    <p class="sub">${state.act.libelle} · ${state.act.lot}</p>
    <table class="recap">
      <tr><td>Documents classés</td><td>${n('classe')}</td></tr>
      <tr><td>Documents rejetés</td><td>${n('rejete')}</td></tr>
      <tr><td>Compléments demandés</td><td>${n('complement')}</td></tr>
      <tr><td>Restant à traiter</td><td>${d.length - traites}</td></tr>
      <tr><td>Temps moyen par document</td><td>${tps} s</td></tr>
    </table>
    <div class="modal-actions">
      <button class="btn" id="m-stay">Reprendre le traitement</button>
      <button class="btn btn-primary" id="m-quit">Clôturer et revenir à la file</button>
    </div>`, () => {
    $('#m-stay').onclick = closeModal;
    $('#m-quit').onclick = () => {
      closeModal();
      state.act.nbDocs = d.length - traites;
      show('screen-home'); renderHome();
      toast(`${traites} document(s) traité(s)`, 'ok');
    };
  });
}

function helpModal() {
  const rows = [
    ['←  /  →', 'Document précédent / suivant'], ['Origine  /  Fin', 'Premier / dernier document'],
    ['↑  /  ↓', 'Page précédente / suivante'], ['1 … 9', 'Sélectionner une classe cible'],
    ['Entrée', 'Valider le classement'], ['R', 'Rejeter le document'],
    ['C', 'Demander un complément'], ['S', 'Reprendre la proposition automatique'],
    ['F', 'Filtrer la liste des classes'], ['U', 'Annuler la dernière action'],
    ['+  /  −  /  0', 'Zoom avant / arrière / ajuster'], ['Maj + R', 'Rotation 90°'],
    ['Échap', 'Fermer la fenêtre'], ['?', 'Afficher cette aide']
  ];
  openModal(`<h2>Raccourcis clavier</h2>
    <p class="sub">Le poste de travail est entièrement pilotable au clavier, sans utiliser les boutons.</p>
    <div class="shortcuts">${rows.map(([k, v]) => `<div><kbd>${k}</kbd><span>${v}</span></div>`).join('')}</div>
    <div class="modal-actions"><button class="btn btn-primary" id="m-close">Fermer</button></div>`,
    () => $('#m-close').onclick = closeModal);
}

/* ---------- Câblage du poste de travail ---------- */
function initWork() {
  $('#n-first').onclick = () => loadDoc(0, true);
  $('#n-prev').onclick  = () => loadDoc(-1);
  $('#n-next').onclick  = () => loadDoc(1);
  $('#n-last').onclick  = () => loadDoc(state.docs.length - 1, true);
  $('#p-prev').onclick  = () => { if (state.page > 1) { state.page--; renderViewer(); } };
  $('#p-next').onclick  = () => { if (state.page < cur().pages) { state.page++; renderViewer(); } };
  $('#v-zoomin').onclick = () => zoom(.15);
  $('#v-zoomout').onclick = () => zoom(-.15);
  $('#v-fit').onclick = () => { state.zoom = 1; state.rot = 0; applyTransform(); };
  $('#v-rot').onclick = () => { state.rot = (state.rot + 90) % 360; applyTransform(); };
  $('#queue-filter').onchange = renderQueue;
  $('#cls-search').oninput = renderClasses;
  $('#a-valid').onclick  = valider;
  $('#a-reject').onclick = () => motifModal('rejet');
  $('#a-compl').onclick  = () => motifModal('complement');
  $('#a-undo').onclick   = undo;
  $('#btn-help').onclick = helpModal;
  $('#btn-finish').onclick = finishModal;

  /* panoramique à la souris */
  const canvas = $('#canvas');
  let drag = null;
  canvas.addEventListener('mousedown', e => { drag = { x: e.clientX, y: e.clientY, l: canvas.scrollLeft, t: canvas.scrollTop }; canvas.classList.add('drag'); });
  addEventListener('mouseup', () => { drag = null; canvas.classList.remove('drag'); });
  addEventListener('mousemove', e => {
    if (!drag) return;
    canvas.scrollLeft = drag.l - (e.clientX - drag.x);
    canvas.scrollTop  = drag.t - (e.clientY - drag.y);
  });
  canvas.addEventListener('wheel', e => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoom(e.deltaY > 0 ? -.1 : .1); } }, { passive: false });

  /* ---------- Clavier ---------- */
  addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (modalOpen) { closeModal(); e.preventDefault(); } else $('#cls-search').blur(); return; }
    if (modalOpen) { if (e.key === 'Enter' && $('#m-ok')) { $('#m-ok').click(); e.preventDefault(); } return; }
    if (!$('#screen-work').classList.contains('active')) return;

    const ae = document.activeElement;
    const inField = ae.id === 'cls-search' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT';
    if (inField && e.key !== 'Enter' && !e.key.startsWith('Arrow')) return;

    switch (e.key) {
      case 'ArrowLeft':  loadDoc(-1); break;
      case 'ArrowRight': loadDoc(1); break;
      case 'Home':       loadDoc(0, true); break;
      case 'End':        loadDoc(state.docs.length - 1, true); break;
      case 'ArrowUp':    if (state.page > 1) { state.page--; renderViewer(); } break;
      case 'ArrowDown':  if (state.page < cur().pages) { state.page++; renderViewer(); } break;
      case 'PageUp':     loadDoc(-1); break;
      case 'PageDown':   loadDoc(1); break;
      case 'Enter':      document.activeElement.blur(); valider(); break;
      case '+': case '=': zoom(.15); break;
      case '-': zoom(-.15); break;
      case '0': state.zoom = 1; state.rot = 0; applyTransform(); break;
      case '?': helpModal(); break;
      default: {
        const k = e.key.toLowerCase();
        if (/^[1-9]$/.test(e.key)) {
          const c = visibleClasses()[+e.key - 1];
          if (c) { state.selClasse = c; renderClasses(); }
        } else if (k === 'r') { e.shiftKey ? (state.rot = (state.rot + 90) % 360, applyTransform()) : motifModal('rejet'); }
        else if (k === 'c') motifModal('complement');
        else if (k === 's') { state.selClasse = cur().suggestion.classe; renderClasses(); }
        else if (k === 'u') undo();
        else if (k === 'f') { e.preventDefault(); $('#cls-search').focus(); }
        else return;
      }
    }
    if (!inField) e.preventDefault();
  });
}

/* ---------- Démarrage ---------- */
initTheme(); initLogin(); initHome(); initWork();
