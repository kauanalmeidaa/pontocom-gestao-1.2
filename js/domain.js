/* Regras de negócio compartilhadas entre as telas */
import { DB, get, put, uid, nextNum, settings } from './store.js';
import { ic, esc, brl, pad, fmtDate, today, addDays, addMonths, daysBetween, badge, meta, me } from './util.js';

export const ROLES = { dono: 'Dono / administrador', financeiro: 'Financeiro', tecnico: 'Técnico' };

/* ---------- permissões por módulo ---------- */
export const MODULES = [['dash', 'Início'], ['agenda', 'Agenda'], ['os', 'Ordens de serviço'], ['clients', 'Clientes'], ['quotes', 'Orçamentos'], ['stock', 'Estoque'], ['finance', 'Financeiro'], ['contracts', 'Contratos'], ['warranty', 'Garantias'], ['reminders', 'Lembretes'], ['reports', 'Relatórios']];
export const PRESETS = {
  dono: { perms: MODULES.map(m => m[0]), limited: false },
  financeiro: { perms: ['dash', 'agenda', 'os', 'clients', 'quotes', 'finance', 'contracts', 'warranty', 'reminders', 'reports'], limited: false },
  tecnico: { perms: ['agenda', 'os'], limited: true }
};
/* "limited" = só enxerga as OS em aberto dele e a agenda da semana atual */
export const userPerms = u => u.role === 'dono' ? PRESETS.dono.perms : (u.perms || PRESETS[u.role]?.perms || []);
export const isLimited = u => u.role === 'dono' ? false : (u.limited ?? PRESETS[u.role]?.limited ?? false);
export const can = k => !!me.user && (me.user.role === 'dono' || userPerms(me.user).includes(k));
export const limited = () => !!me.user && isLimited(me.user);
export const OS_ST = ['Aberta', 'Em andamento', 'Concluída', 'Cancelada'];
export const Q_ST = ['Pendente', 'Aprovado', 'Recusado'];
export const TONE = { 'Aberta': 'warn', 'Em andamento': 'info', 'Concluída': 'ok', 'Cancelada': 'bad', 'Pendente': 'warn', 'Aprovado': 'ok', 'Recusado': 'bad', 'Ativo': 'ok', 'Pausado': 'warn', 'Cancelado': 'bad' };
export const types = () => Object.keys(settings().checklists);

export const clientName = id => get('clients', id)?.name || '(sem cliente)';
export const clientOpts = () => [['', 'Selecione…'], ...[...DB.clients].sort((a, b) => a.name.localeCompare(b.name)).map(c => [c.id, c.name])];
export const techOpts = () => [['', 'Sem técnico'], ...DB.users.filter(u => u.role !== 'financeiro').map(u => [u.id, u.name])];
export const userName = id => get('users', id)?.name || '';

export const itemsTotal = (items = []) => items.reduce((a, i) => a + i.qty * i.price, 0);
export const total = o => Math.max(0, itemsTotal(o.items) - (+o.discount || 0));
export const cost = o => (o.items || []).reduce((a, i) => a + (i.pid ? i.qty * (i.cost || 0) : 0), 0);
export const stockLow = () => DB.products.filter(p => p.min > 0 && (p.stock || 0) <= p.min);
export const sum = a => a.reduce((x, f) => x + (+f.value || 0), 0);

/* ---------- linhas reutilizáveis ---------- */
export const osRow = o => `<div class="li" data-act="openOS" data-id="${o.id}"><div class="av">${ic('clip')}</div><div class="lt"><b>OS ${pad(o.num)} – ${esc(clientName(o.clientId))}</b>${meta(esc(o.type), fmtDate(o.date) + (o.time ? ' ' + o.time : ''), esc(userName(o.techId)))}</div><div class="rt">${badge(o.status, TONE[o.status])}<small>${brl(total(o))}</small></div></div>`;
export const quoteRow = q => `<div class="li" data-act="openQuote" data-id="${q.id}"><div class="av">${ic('doc')}</div><div class="lt"><b>Orçamento ${pad(q.num)} – ${esc(clientName(q.clientId))}</b>${meta(fmtDate(q.date), q.items.length + (q.items.length === 1 ? ' item' : ' itens'))}</div><div class="rt">${badge(q.status, TONE[q.status])}<small>${brl(total(q))}</small></div></div>`;

export function warrantyState(e) {
  const t = today();
  if (e.equipEnd && e.equipEnd >= t) return { tone: daysBetween(t, e.equipEnd) <= 30 ? 'warn' : 'ok', text: 'Equipamento em garantia' };
  if (e.laborEnd && e.laborEnd >= t) return { tone: 'info', text: 'Só mão de obra em garantia' };
  return { tone: 'bad', text: 'Garantia vencida' };
}

/* ---------- movimentação de estoque ---------- */
export async function addMove(pid, type, qty, extra = {}) {
  const p = get('products', pid); if (!p) return;
  const delta = type === 'saida' ? -Math.abs(qty) : qty;
  p.stock = (+p.stock || 0) + delta;
  await put('products', p);
  await put('moves', { pid, type, qty: delta, date: today(), ...extra });
}

/* ---------- o que acontece ao salvar uma OS ---------- */
export async function afterSaveOS(o) {
  const s = settings();
  if (!o.id) o.id = uid();
  if (o.status === 'Concluída') {
    if (!o.stockDone) {
      for (const i of (o.items || [])) if (i.pid && get('products', i.pid)) await addMove(i.pid, 'saida', i.qty, { osId: o.id, note: 'OS ' + pad(o.num) });
      o.stockDone = true;
    }
    if (!o.finId && total(o) > 0) {
      const f = await put('finance', { type: 'receber', desc: `OS ${pad(o.num)} – ${clientName(o.clientId)}`, value: total(o), due: o.date || today(), paid: false, osId: o.id, clientId: o.clientId, category: 'Serviços' });
      o.finId = f.id;
    }
    if (o.newEquip?.model && !o.equipId) {
      const d = o.date || today();
      const e = await put('equipment', { clientId: o.clientId, type: o.type, model: o.newEquip.model, serial: o.newEquip.serial || '', location: o.newEquip.location || '', installDate: d, equipMonths: s.warrantyEquip, laborMonths: s.warrantyLabor, equipEnd: addMonths(d, s.warrantyEquip), laborEnd: addMonths(d, s.warrantyLabor), osId: o.id });
      o.equipId = e.id;
    }
  }
  if (o.finId) { const f = get('finance', o.finId); if (f && !f.paid && f.value !== total(o)) { f.value = total(o); await put('finance', f); } }
  await put('os', o);
  return o;
}

/* ---------- lembretes (WhatsApp) ---------- */
export function reminders() {
  const s = settings(), t = today(), out = [];
  const dis = (DB.meta.find(m => m.id === 'dismissed') || {}).map || {};
  const push = r => { if (dis[r.key] && daysBetween(dis[r.key], t) < 7) return; out.push(r); };
  const phone = id => get('clients', id)?.phone || '';
  const sign = `\n\n${s.company} – ${s.whats}`;

  DB.contracts.filter(c => c.status === 'Ativo' && c.nextVisit).forEach(c => {
    const d = daysBetween(t, c.nextVisit); if (d > 15) return;
    const when = d < 0 ? `atrasada ${-d} dia(s)` : d === 0 ? 'hoje' : `em ${d} dia(s)`;
    push({ key: 'ct' + c.id + c.nextVisit, tone: d < 0 ? 'bad' : 'warn', icon: 'repeat', group: 'Contratos', title: `Visita de manutenção – ${clientName(c.clientId)}`, sub: `${esc(c.name)} – ${when} (${fmtDate(c.nextVisit)})`, phone: phone(c.clientId),
      msg: `Olá, ${clientName(c.clientId)}! Está chegando a data da manutenção preventiva do seu contrato (${c.name}), prevista para ${fmtDate(c.nextVisit)}. Podemos confirmar o melhor horário para você?${sign}` });
  });
  DB.equipment.forEach(e => {
    if (!e.equipEnd) return; const d = daysBetween(t, e.equipEnd); if (d < 0 || d > 30) return;
    push({ key: 'gw' + e.id + e.equipEnd, tone: 'warn', icon: 'shield', group: 'Garantias', title: `Garantia vencendo – ${clientName(e.clientId)}`, sub: `${esc(e.type)} ${esc(e.model)} – vence em ${d} dia(s) (${fmtDate(e.equipEnd)})`, phone: phone(e.clientId),
      msg: `Olá, ${clientName(e.clientId)}! A garantia do seu equipamento (${e.type} ${e.model}) termina em ${fmtDate(e.equipEnd)}. Que tal agendar uma revisão para garantir que tudo continue funcionando bem? Também temos planos de manutenção.${sign}` });
  });
  DB.finance.filter(f => f.type === 'receber' && !f.paid && daysBetween(t, f.due) <= 3).forEach(f => {
    const d = daysBetween(t, f.due), cn = clientName(f.clientId);
    push({ key: 'fi' + f.id + f.due, tone: d < 0 ? 'bad' : 'warn', icon: 'money', group: 'Cobranças', title: `${d < 0 ? 'Cobrança em atraso' : 'Cobrança a vencer'} – ${cn}`, sub: `${esc(f.desc)} – ${brl(f.value)} – vence ${fmtDate(f.due)}`, phone: phone(f.clientId),
      msg: d < 0 ? `Olá, ${cn}! Identificamos que o pagamento de ${f.desc} (${brl(f.value)}), com vencimento em ${fmtDate(f.due)}, ainda está em aberto. Pode nos confirmar? Obrigado!${sign}` : `Olá, ${cn}! Passando para lembrar do pagamento de ${f.desc} (${brl(f.value)}), com vencimento em ${fmtDate(f.due)}.${sign}` });
  });
  DB.quotes.filter(q => q.status === 'Pendente' && daysBetween(q.date, t) >= 3).forEach(q => {
    const cn = clientName(q.clientId);
    push({ key: 'qt' + q.id, tone: 'info', icon: 'doc', group: 'Orçamentos', title: `Orçamento sem resposta – ${cn}`, sub: `Orçamento ${pad(q.num)} – ${brl(total(q))} – enviado em ${fmtDate(q.date)}`, phone: phone(q.clientId),
      msg: `Olá, ${cn}! Tudo bem? Passando para saber se conseguiu analisar o orçamento ${pad(q.num)} (${brl(total(q))}). Qualquer dúvida, estou à disposição!${sign}` });
  });
  const tm = addDays(t, 1);
  DB.os.filter(o => o.date === tm && (o.status === 'Aberta' || o.status === 'Em andamento')).forEach(o => {
    const cn = clientName(o.clientId);
    push({ key: 'os' + o.id + o.date, tone: 'info', icon: 'calendar', group: 'Visitas', title: `Visita amanhã – ${cn}`, sub: `OS ${pad(o.num)} – ${esc(o.type)}${o.time ? ' às ' + o.time : ''}`, phone: phone(o.clientId),
      msg: `Olá, ${cn}! Confirmando nossa visita amanhã (${fmtDate(o.date)})${o.time ? ' às ' + o.time : ''} para o serviço de ${o.type}. Podemos confirmar?${sign}` });
  });
  return out;
}
export const nextSeq = nextNum;
