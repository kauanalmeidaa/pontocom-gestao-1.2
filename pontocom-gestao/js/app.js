import * as Store from './store.js';
import { uid } from './store.js';
import { $, ACT, app, me, ic, esc, F, readForm, toast, closeModal, modal, hashPin, checkPin } from './util.js';
import { ROLES, reminders, can } from './domain.js';
import './items.js';
import './docs.js';
import * as dash from './views/dashboard.js';
import * as agenda from './views/agenda.js';
import * as os from './views/os.js';
import * as clients from './views/clients.js';
import * as quotes from './views/quotes.js';
import * as stock from './views/stock.js';
import * as finance from './views/finance.js';
import * as contracts from './views/contracts.js';
import * as warranty from './views/warranty.js';
import * as remindersView from './views/reminders.js';
import * as reports from './views/reports.js';
import * as settingsView from './views/settings.js';

const ALL = ['dono', 'financeiro', 'tecnico'], ADM = ['dono', 'financeiro'];
const NAV = [
  ['dash', 'home', 'Início', ALL, dash],
  ['agenda', 'calendar', 'Agenda', ALL, agenda],
  ['os', 'clip', 'Ordens de serviço', ALL, os],
  ['clients', 'users', 'Clientes', ALL, clients],
  ['quotes', 'doc', 'Orçamentos', ADM, quotes],
  ['stock', 'box', 'Estoque', ['dono', 'tecnico'], stock],
  ['finance', 'money', 'Financeiro', ADM, finance],
  ['contracts', 'repeat', 'Contratos', ADM, contracts],
  ['warranty', 'shield', 'Garantias', ALL, warranty],
  ['reminders', 'bell', 'Lembretes', ADM, remindersView],
  ['reports', 'chart', 'Relatórios', ADM, reports],
  ['settings', 'sliders', 'Ajustes', ['dono'], settingsView]
];
const MOBILE = ['dash', 'os', 'agenda', 'clients'];
const allowed = () => NAV.filter(n => n[0] === 'settings' ? me.user.role === 'dono' : can(n[0]));

/* ---------- tema e marca ---------- */
function applyTheme() { document.documentElement.dataset.theme = localStorage.getItem('theme') || 'light'; }
ACT.theme = () => { localStorage.setItem('theme', (localStorage.getItem('theme') || 'light') === 'light' ? 'dark' : 'light'); applyTheme(); shell(); };
export function applyBrand() {
  const s = Store.settings(), c = /^#[0-9a-f]{6}$/i.test(s.color) ? s.color : '#f5a300';
  const [r, g, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  document.documentElement.style.setProperty('--brand', c);
  document.documentElement.style.setProperty('--on-brand', (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#1a1200' : '#ffffff');
  document.title = s.company + ' – Gestão';
}
ACT.applyBrand = applyBrand;
const markHTML = s => `<div class="mark">${s.logo ? `<img src="${s.logo}" alt="">` : esc((s.company || 'P').trim()[0].toUpperCase())}</div>`;

/* ---------- entrada: configuração inicial e login ---------- */
function gate(html) { $('#app').innerHTML = `<div class="gate"><div class="card">${html}</div></div>`; }
function setupScreen() {
  const s = Store.settings();
  gate(`<div class="logo">${markHTML(s)}<div><b>Bem-vindo</b><small>Vamos configurar o seu sistema</small></div></div>
  <form data-submit="setup">
    ${F('company', 'Nome da empresa', s.company, { req: true })}
    ${F('name', 'Seu nome', '', { req: true })}
    ${F('pin', 'Crie um PIN de acesso (4 a 8 números)', '', { req: true, attrs: 'inputmode="numeric" pattern="[0-9]{4,8}" autocomplete="new-password"', type: 'password' })}
    <p class="err" id="gerr"></p>
    <button class="btn block">Criar acesso</button>
  </form>
  <p class="hint">Você será o dono do sistema. Depois poderá criar acessos para técnicos e financeiro em Ajustes.</p>`);
}
ACT.setup = async (d, f) => {
  const v = readForm(f);
  if (!/^\d{4,8}$/.test(v.pin)) { $('#gerr').textContent = 'O PIN precisa ter de 4 a 8 números.'; return; }
  await Store.saveSettings({ ...Store.settings(), company: v.company.trim() });
  for (const k of Store.DEFAULT_KITS) await Store.put('kits', { name: k.name, items: k.items });
  const id = uid();
  const u = await Store.put('users', { id, name: v.name.trim(), role: 'dono', pinHash: await hashPin(v.pin, id) });
  startSession(u);
};
function loginScreen() {
  const s = Store.settings(), users = Store.DB.users;
  gate(`<div class="logo">${markHTML(s)}<div><b>${esc(s.company)}</b><small>Entrar no sistema</small></div></div>
  <form data-submit="login">
    <div class="f"><label>Usuário</label><select name="uid">${users.map(u => `<option value="${u.id}">${esc(u.name)} – ${ROLES[u.role]}</option>`).join('')}</select></div>
    ${F('pin', 'PIN', '', { req: true, type: 'password', attrs: 'inputmode="numeric" autocomplete="current-password"' })}
    <p class="err" id="gerr"></p>
    <button class="btn block">Entrar</button>
  </form>`);
}
ACT.login = async (d, f) => {
  const v = readForm(f), u = Store.get('users', v.uid);
  if (u && await checkPin(v.pin, u.id, u.pinHash)) startSession(u);
  else { $('#gerr').textContent = 'PIN incorreto. Tente de novo.'; f.pin.value = ''; f.pin.focus(); }
};
ACT.logout = () => { sessionStorage.removeItem('uid'); me.user = null; location.hash = ''; loginScreen(); };
function startSession(u) {
  sessionStorage.setItem('uid', u.id); me.user = u; applyBrand();
  if (!allowed().length) { gate(`<b>Seu usuário não tem acesso a nenhuma tela.</b><p class="hint">Peça ao administrador para liberar os módulos em Ajustes → Usuários.</p><div class="btns"><button class="btn ghost" data-act="logout">Sair</button></div>`); return; }
  if (!location.hash || !allowed().some(n => '#/' + n[0] === location.hash)) location.hash = '#/' + allowed()[0][0];
  shell();
}

/* ---------- estrutura principal ---------- */
function current() { const k = (location.hash.match(/^#\/(\w+)/) || [])[1]; return allowed().find(n => n[0] === k) || allowed()[0]; }
function shell() {
  const s = Store.settings(), nav = allowed(), cur = current()[0];
  const nrem = can('reminders') ? reminders().length : 0;
  const dark = (localStorage.getItem('theme') || 'light') === 'dark';
  $('#app').innerHTML = `
  <aside class="side">
    <div class="logo">${markHTML(s)}<div><b>${esc(s.company)}</b><small>Gestão</small></div></div>
    <nav class="nav">${nav.map(([k, i, l]) => `<a href="#/${k}" class="${k === cur ? 'on' : ''}">${ic(i)}<span>${l}</span>${k === 'reminders' && nrem ? `<span class="cnt">${nrem}</span>` : ''}</a>`).join('')}</nav>
    <div class="me"><div><b>${esc(me.user.name)}</b><small>${ROLES[me.user.role]}</small></div>
      <div class="row"><button data-act="theme" aria-label="Alternar tema">${ic(dark ? 'sun' : 'moon')}</button><button data-act="logout">${ic('out')} Sair</button></div></div>
  </aside>
  <div class="main">
    <header class="top">${markHTML(s)}<h1 id="ttl"></h1></header>
    <div class="page" id="view"></div>
  </div>
  <nav class="bnav">${MOBILE.filter(k => nav.some(n => n[0] === k)).map(k => { const n = nav.find(x => x[0] === k); return `<a href="#/${k}" class="${k === cur ? 'on' : ''}">${ic(n[1])}<span>${k === 'os' ? 'OS' : n[2]}</span></a>`; }).join('')}
    <button data-act="more" class="${MOBILE.includes(cur) ? '' : 'on'}">${ic('more')}<span>Mais</span></button></nav>`;
  route(true);
}
ACT.more = () => {
  const nav = allowed().filter(n => !MOBILE.includes(n[0]));
  modal('Menu', `<div class="chips" style="flex-wrap:wrap;overflow:visible">${nav.map(([k, i, l]) => `<a class="chip" href="#/${k}" data-act="closeModal" style="display:flex;gap:8px;align-items:center">${ic(i)} ${l}</a>`).join('')}</div>
  <div class="btns"><button class="btn ghost" data-act="theme">${ic('moon')} Tema claro/escuro</button><button class="btn danger" data-act="logout">${ic('out')} Sair</button></div>`);
};
function route(keep) {
  if (!me.user) return;
  const n = current(), y = keep ? 0 : window.scrollY;
  document.querySelectorAll('.nav a,.bnav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#/' + n[0]));
  $('#ttl').textContent = n[2];
  n[4].render($('#view'));
  window.scrollTo(0, y);
}
app.refresh = () => { const y = window.scrollY; shell(); window.scrollTo(0, y); };
window.addEventListener('hashchange', () => { closeModal(); route(true); });

/* ---------- eventos globais ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const fn = ACT[b.dataset.act];
  if (fn) { if (b.tagName === 'A' && b.dataset.act !== 'closeModal') e.preventDefault(); fn(b.dataset, b, e); }
});
document.addEventListener('submit', async e => {
  const f = e.target.closest('form[data-submit]'); if (!f) return;
  e.preventDefault();
  try { await ACT[f.dataset.submit]?.(f.dataset, f, e); } catch (err) { console.error(err); toast('Algo deu errado: ' + err.message); }
});
document.addEventListener('input', e => { const t = e.target.closest('[data-input]'); if (t) ACT[t.dataset.input]?.(t.dataset, t, e); });
document.addEventListener('change', async e => { const t = e.target.closest('[data-change]'); if (t) { try { await ACT[t.dataset.change]?.(t.dataset, t, e); } catch (err) { console.error(err); toast('Algo deu errado: ' + err.message); } } });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ---------- partida ---------- */
(async function boot() {
  try {
    await Store.open(); await Store.loadAll();
  } catch (err) {
    $('#app').innerHTML = `<div class="gate"><div class="card"><b>Não foi possível abrir o banco de dados do navegador.</b><p class="hint">Saia do modo privado e abra o endereço http://localhost (não o arquivo direto).</p></div></div>`;
    return;
  }
  applyTheme(); applyBrand();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (!Store.DB.users.length) return setupScreen();
  const u = Store.get('users', sessionStorage.getItem('uid'));
  if (u) { me.user = u; startSession(u); } else loginScreen();
})();
