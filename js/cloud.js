/* ============================================================
   cloud.js — login e dados online (Firebase: Authentication + Firestore).
   Só é usado quando js/config.js está preenchido.
   Estrutura no Firestore:
     users/{uid}                          → a quem o usuário pertence (empresa, função, permissões)
     companies/{empresa}                  → dados da empresa
     companies/{empresa}/cols/{tipo}/items/{id} → clientes, OS, orçamentos… (isolado por empresa)
     invites/{código}                     → convites para a equipe
   ============================================================ */
import { CLOUD } from './config.js';
export const enabled = !!(CLOUD.apiKey && CLOUD.projectId && CLOUD.appId);
const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
const ALL = ['dash', 'agenda', 'os', 'clients', 'quotes', 'stock', 'finance', 'contracts', 'warranty', 'reminders', 'reports'];
const MAX_DOC = 900000;
let F, app, auth, db, member = null;

export async function init() {
  F = window.__fbLib || { a: await import(SDK + 'firebase-app.js'), au: await import(SDK + 'firebase-auth.js'), s: await import(SDK + 'firebase-firestore.js') };
  app = F.a.initializeApp(CLOUD); auth = F.au.getAuth(app); db = F.s.getFirestore(app);
}
const MSG = [
  [/invalid-credential|wrong-password|user-not-found|invalid-login/i, 'E-mail ou senha incorretos.'],
  [/email-already-in-use/i, 'Este e-mail já tem cadastro. Use "Entrar" ou "Esqueci minha senha".'],
  [/weak-password/i, 'Senha fraca. Use pelo menos 8 caracteres.'],
  [/too-many-requests/i, 'Muitas tentativas. Espere alguns minutos e tente de novo.'],
  [/invalid-email/i, 'E-mail inválido.'],
  [/network-request-failed|unavailable/i, 'Sem conexão com a internet. Tente de novo.'],
  [/permission-denied|insufficient permissions/i, 'Sem permissão para esta ação. Se o problema continuar, peça ao administrador.'],
  [/convite_invalido/i, 'Convite inválido, já usado ou vencido. Peça um novo ao administrador.'],
  [/registro_grande/i, 'Este registro ficou grande demais (muitas fotos). Remova algumas fotos e salve de novo.']
];
const fail = e => { const m = String(e?.code || '') + ' ' + String(e?.message || e || ''); throw new Error((MSG.find(([r]) => r.test(m)) || [, 'Não foi possível concluir. ' + m.trim()])[1]); };
const run = async fn => { try { return await fn(); } catch (e) { fail(e); } };
const clean = o => JSON.parse(JSON.stringify(o));
const ref = (...p) => F.s.doc(db, ...p);
const col = (...p) => F.s.collection(db, ...p);

/* ---------- login ---------- */
export const getSession = () => new Promise(res => { const un = F.au.onAuthStateChanged(auth, u => { un(); res(u); }); });
export const signUp = (email, password) => run(() => F.au.createUserWithEmailAndPassword(auth, email, password));
export const signIn = (email, password) => run(() => F.au.signInWithEmailAndPassword(auth, email, password));
export const signOut = async () => { member = null; await F.au.signOut(auth); };
export const resetPassword = email => run(() => F.au.sendPasswordResetEmail(auth, email));
export const currentMember = () => member;

/* ---------- empresa ---------- */
export async function loadMember() {
  const u = auth.currentUser; if (!u) return null;
  const s = await run(() => F.s.getDoc(ref('users', u.uid)));
  if (!s.exists()) return (member = null);
  const d = s.data();
  return (member = { id: u.uid, companyId: d.companyId, name: d.name, role: d.role, perms: d.perms || undefined, limited: !!d.limited, email: u.email });
}
export const createCompany = (company, name) => run(async () => {
  const u = auth.currentUser, cref = F.s.doc(col('companies')), b = F.s.writeBatch(db);
  b.set(cref, { name: company.trim().slice(0, 120), ownerUid: u.uid });
  b.set(ref('users', u.uid), { companyId: cref.id, name: name.trim().slice(0, 120), role: 'dono', perms: ALL, limited: false, email: u.email });
  await b.commit();
});
export const joinCompany = (code, name) => run(async () => {
  const u = auth.currentUser, c = code.trim().toUpperCase();
  const s = c ? await F.s.getDoc(ref('invites', c)) : null;
  if (!s || !s.exists()) throw new Error('convite_invalido');
  const i = s.data();
  if (i.used || Date.now() - i.createdAt > 14 * 864e5) throw new Error('convite_invalido');
  const b = F.s.writeBatch(db);
  b.set(ref('users', u.uid), { companyId: i.companyId, name: (name.trim() || i.name).slice(0, 120), role: i.role, perms: i.perms || null, limited: !!i.limited, email: u.email, inviteCode: c });
  b.update(ref('invites', c), { used: true });
  await b.commit();
});
export const createInvite = (name, role, perms, limited) => run(async () => {
  const a = new Uint8Array(5); crypto.getRandomValues(a);
  const code = [...a].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  await F.s.setDoc(ref('invites', code), { companyId: member.companyId, name: name.slice(0, 120), role, perms, limited: !!limited, used: false, createdAt: Date.now() });
  return code;
});

/* ---------- dados ---------- */
export async function loadAll(DB, COLS) {
  COLS.forEach(c => { DB[c] = []; });
  const cid = member.companyId;
  const us = await run(() => F.s.getDocs(F.s.query(col('users'), F.s.where('companyId', '==', cid))));
  DB.users = us.docs.map(x => { const d = x.data(); return { id: x.id, name: d.name, role: d.role, perms: d.perms || undefined, limited: !!d.limited }; });
  await Promise.all(COLS.filter(c => c !== 'users').map(async c => {
    try { DB[c] = (await F.s.getDocs(col('companies', cid, 'cols', c, 'items'))).docs.map(x => x.data()); }
    catch (e) { if (!/permission-denied|insufficient/i.test(String(e?.code) + e?.message)) fail(e); }   // sem permissão (ex.: financeiro) = lista vazia
  }));
}
export const put = (c, o) => run(async () => {
  if (c === 'users') { await F.s.updateDoc(ref('users', o.id), { name: o.name, role: o.role, perms: o.perms || null, limited: !!o.limited }); return; }
  const data = clean(o);
  if (JSON.stringify(data).length > MAX_DOC) throw new Error('registro_grande');
  await F.s.setDoc(ref('companies', member.companyId, 'cols', c, 'items', String(o.id)), data);
});
export const del = (c, id) => run(() => F.s.deleteDoc(c === 'users' ? ref('users', id) : ref('companies', member.companyId, 'cols', c, 'items', String(id))));
export const importAll = (d, COLS) => run(async () => {
  const cid = member.companyId, ops = [];
  for (const c of COLS.filter(x => x !== 'users')) {
    const old = await F.s.getDocs(col('companies', cid, 'cols', c, 'items'));
    old.docs.forEach(x => ops.push(['d', x.ref]));
    for (const o of (d[c] || [])) ops.push(['s', ref('companies', cid, 'cols', c, 'items', String(o.id)), clean(o)]);
  }
  for (let i = 0; i < ops.length; i += 400) {
    const b = F.s.writeBatch(db);
    ops.slice(i, i + 400).forEach(([k, r, v]) => k === 'd' ? b.delete(r) : b.set(r, v));
    await b.commit();
  }
});
