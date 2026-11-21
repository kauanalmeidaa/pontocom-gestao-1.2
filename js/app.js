import * as Store from './store.js';
import * as Cloud from './cloud.js';
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
ACT.theme = () => { localStorage.setItem('theme', (localStorage.getItem('theme') || 'light') === 'light' ? 'dark' : 'light'); applyTheme(); applyBrand(); shell(); };
const hexRGB = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const toHex = a => '#' + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (h, t, k) => { const a = hexRGB(h), b = hexRGB(t); return toHex(a.map((v, i) => v + (b[i] - v) * k)); };
const lum = h => { const [r, g, b] = hexRGB(h); return (r * 299 + g * 587 + b * 114) / 1000; };
export function applyBrand() {
  const s = Store.settings(), isHex = x => /^#[0-9a-f]{6}$/i.test(x);
  const c = isHex(s.color) ? s.color : '#053565', a = isHex(s.accent) ? s.accent : '#06bf2f';
  const dark = document.documentElement.dataset.theme === 'dark', R = document.documentElement.style;
  const ui = dark ? mix(c, '#ffffff', .5) : c;            // no tema escuro o azul-marinho é clareado para ficar legível
  R.setProperty('--brand', ui); R.setProperty('--on-brand', lum(ui) >= 150 ? '#06182e' : '#ffffff');
  R.setProperty('--accent', a); R.setProperty('--on-accent', lum(a) > 110 ? '#06182e' : '#ffffff');
  R.setProperty('--doc', c); R.setProperty('--on-doc', lum(c) >= 150 ? '#06182e' : '#ffffff'); R.setProperty('--doc-dark', mix(c, '#000000', .55));  // PDFs
  R.setProperty('--side', mix(c, '#000000', dark ? .72 : .5)); R.setProperty('--side2', mix(c, '#000000', dark ? .55 : .32));       // menu lateral
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', mix(c, '#000000', dark ? .72 : .5));
  document.title = (s.company || 'PontoCom') + ' – Gestão';
}
ACT.applyBrand = applyBrand;
const markHTML = s => { const src = s.icon || s.logo; return `<div class="mark">${src ? `<img src="${src}" alt="">` : esc((s.company || 'P').trim()[0].toUpperCase())}</div>`; };
const gateLogo = (s, sub) => s.logo ? `<img class="gate-logo" src="${s.logo}" alt="${esc(s.company)}"><p class="hint" style="margin:0 0 16px;text-align:center">${sub}</p>` : '';

/* ---------- entrada: configuração inicial e login ---------- */
function gate(html) { $('#app').innerHTML = `<div class="gate"><div class="card">${html}</div></div>`; }
function setupScreen() {
  const s = Store.settings();
  gate(`${gateLogo(s, 'Vamos configurar o seu sistema') || `<div class="logo">${markHTML(s)}<div><b>Bem-vindo</b><small>Vamos configurar o seu sistema</small></div></div>`}
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
  gate(`${gateLogo(s, 'Entrar no sistema') || `<div class="logo">${markHTML(s)}<div><b>${esc(s.company)}</b><small>Entrar no sistema</small></div></div>`}
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
ACT.logout = async () => {
  sessionStorage.removeItem('uid'); me.user = null; location.hash = '';
  if (Store.cloud) { try { await Cloud.signOut(); } catch (e) {} Store.DB.users = []; return authScreen('in'); }
  loginScreen();
};

/* ---------- login online (Supabase) ---------- */
const pw = (name, label, extra = '') => F(name, label, '', { req: true, type: 'password', attrs: `minlength="8" autocomplete="${extra || 'current-password'}"` });
function authScreen(mode = 'in', msg = '') {
  const s = Store.settings();
  const head = gateLogo({ logo: 'assets/logo.png', company: 'PontoCom Gestão' }, 'Gestão para empresas de segurança');
  const note = msg ? `<p class="hint" id="gmsg" style="color:var(--ok,#0a7a2f);margin:0 0 10px">${esc(msg)}</p>` : '';
  const tabs = mode === 'forgot' ? '' : `<div class="chips" style="margin-bottom:12px"><button type="button" class="chip ${mode === 'in' ? 'on' : ''}" data-act="authMode" data-m="in">Entrar</button><button type="button" class="chip ${mode === 'up' ? 'on' : ''}" data-act="authMode" data-m="up">Criar conta</button></div>`;
  const body = mode === 'up' ? `<form data-submit="authUp">${F('email', 'E-mail', '', { req: true, type: 'email', attrs: 'autocomplete="email"' })}${pw('password', 'Crie uma senha (mínimo 8 caracteres)', 'new-password')}${pw('password2', 'Repita a senha', 'new-password')}<p class="err" id="gerr"></p><button class="btn block">Criar minha conta</button></form>
      <p class="hint">Se você recebeu um código de convite da sua empresa, crie a conta aqui e use o código na próxima tela.</p>`
    : mode === 'forgot' ? `<b>Recuperar senha</b><form data-submit="authForgot" style="margin-top:10px">${F('email', 'E-mail da conta', '', { req: true, type: 'email', attrs: 'autocomplete="email"' })}<p class="err" id="gerr"></p><button class="btn block">Enviar link para o e-mail</button></form><div class="btns"><button type="button" class="btn ghost" data-act="authMode" data-m="in">Voltar</button></div>`
    : `<form data-submit="authIn">${F('email', 'E-mail', '', { req: true, type: 'email', attrs: 'autocomplete="email"' })}${pw('password', 'Senha')}<p class="err" id="gerr"></p><button class="btn block">Entrar</button></form><div class="btns"><button type="button" class="btn ghost" data-act="authMode" data-m="forgot">Esqueci minha senha</button></div>`;
  const google = mode === 'forgot' ? '' : `<div class="btns" style="margin-top:14px"><button type="button" class="btn ghost block" data-act="authGoogle" style="justify-content:center;gap:10px"><svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true" style="flex:none"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> Continuar com Google</button></div>`;
  gate(head + note + tabs + body + google);
}
ACT.authGoogle = async (d, b) => {
  b.disabled = true;
  try { if (await Cloud.signInGoogle()) await afterAuth(); else b.disabled = false; }
  catch (e) { b.disabled = false; const g = $('#gerr'); if (g) g.textContent = e.message; else toast(e.message); }
};
ACT.authMode = d => authScreen(d.m);
const busy = (f, on) => { const b = f.querySelector('button.btn'); if (b) b.disabled = on; };
const gerr = m => { $('#gerr').textContent = m || ''; };
ACT.authIn = async (d, f) => {
  const v = readForm(f); gerr(); busy(f, true);
  try { await Cloud.signIn(v.email.trim(), v.password); await afterAuth(); } catch (e) { gerr(e.message); busy(f, false); }
};
ACT.authUp = async (d, f) => {
  const v = readForm(f); gerr();
  if (v.password.length < 8) return gerr('A senha precisa ter pelo menos 8 caracteres.');
  if (v.password !== v.password2) return gerr('As senhas não são iguais.');
  busy(f, true);
  try {
    await Cloud.signUp(v.email.trim(), v.password); await afterAuth();
  } catch (e) { gerr(e.message); busy(f, false); }
};
ACT.authForgot = async (d, f) => {
  const v = readForm(f); gerr(); busy(f, true);
  try { await Cloud.resetPassword(v.email.trim()); authScreen('in', 'Se o e-mail tiver cadastro, enviamos um link para criar uma nova senha.'); } catch (e) { gerr(e.message); busy(f, false); }
};
function onboardScreen() {
  gate(`${gateLogo({ logo: 'assets/logo.png', company: 'PontoCom Gestão' }, 'Falta pouco para começar')}
  <b>Criar minha empresa</b>
  <form data-submit="createCo" style="margin:10px 0 18px">${F('company', 'Nome da empresa', '', { req: true })}${F('name', 'Seu nome', '', { req: true })}<p class="err" id="gerr"></p><button class="btn block">Criar empresa e entrar</button></form>
  <b>Recebi um convite</b>
  <form data-submit="joinCo" style="margin-top:10px">${F('code', 'Código do convite', '', { req: true, attrs: 'autocapitalize="characters" autocomplete="off"' })}${F('name', 'Seu nome', '', { req: true })}<p class="err" id="gerr2"></p><button class="btn block ghost">Entrar na empresa do convite</button></form>
  <div class="btns"><button type="button" class="btn ghost" data-act="logout">Sair</button></div>`);
}
ACT.createCo = async (d, f) => {
  const v = readForm(f); gerr(); busy(f, true);
  try {
    await Cloud.createCompany(v.company, v.name); await Cloud.loadMember(); await Store.loadAll();
    await Store.saveSettings({ ...Store.settings(), company: v.company.trim() });
    await afterAuth();
  } catch (e) { gerr(e.message); busy(f, false); }
};
ACT.joinCo = async (d, f) => {
  const v = readForm(f); $('#gerr2').textContent = ''; busy(f, true);
  try { await Cloud.joinCompany(v.code, v.name); await afterAuth(); } catch (e) { $('#gerr2').textContent = e.message; busy(f, false); }
};
async function afterAuth() {
  const m = await Cloud.loadMember();
  if (!m) return onboardScreen();
  await Store.loadAll(); applyBrand(); me.user = m; startSession(m);
}
async function bootCloud() {
  try { await Cloud.redirectResult(); } catch (e) {}
  let ses = null;
  try { ses = await Cloud.getSession(); } catch (e) {}
  if (!ses) return authScreen('in');
  try { await afterAuth(); } catch (e) { console.error(e); authScreen('in', 'Entre novamente para continuar.'); }
}
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
    await Store.open(); if (!Store.cloud) await Store.loadAll();
  } catch (err) {
    $('#app').innerHTML = `<div class="gate"><div class="card"><b>Não foi possível abrir o banco de dados do navegador.</b><p class="hint">Saia do modo privado e abra o endereço http://localhost (não o arquivo direto).</p></div></div>`;
    return;
  }
  applyTheme(); applyBrand();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (Store.cloud) return bootCloud();
  /* site publicado sem Firebase configurado: não mostra o modo local (PIN) para ninguém. Para abrir o modo local e fazer backup: acrescente ?local=1 ao endereço. */
  if (/[?&]local=1/.test(location.search)) sessionStorage.setItem('local', '1');
  if (sessionStorage.getItem('local') !== '1') return gate(`${gateLogo({ logo: 'assets/logo.png', company: 'PontoCom Gestão' }, 'Gestão para empresas de segurança')}<b>Login online ainda não configurado</b><p class="hint">O administrador precisa preencher o arquivo <code>js/config.js</code> com os dados do Firebase. Depois disso, esta tela passa a pedir e-mail e senha, o botão de entrar com Google e o cadastro de novas empresas.</p>`);
  if (!Store.DB.users.length) return setupScreen();
  const u = Store.get('users', sessionStorage.getItem('uid'));
  if (u) { me.user = u; startSession(u); } else loginScreen();
})();
