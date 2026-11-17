import { DB, get, put, del, settings } from '../store.js';
import { $, ACT, ic, esc, fmtDate, today, addMonths, daysBetween, meta, badge, F, readForm, modal, closeModal, toast, app } from '../util.js';
import { types, clientOpts, clientName, warrantyState, osRow } from '../domain.js';

let flt = 'todos', q = '';
const cls = e => { const t = today(); if (e.equipEnd >= t) return daysBetween(t, e.equipEnd) <= 30 ? 'vencendo' : 'garantia'; return 'vencida'; };

export function render(root) {
  const c = k => k === 'todos' ? DB.equipment.length : DB.equipment.filter(e => cls(e) === k || (k === 'garantia' && cls(e) === 'vencendo')).length;
  root.innerHTML = `<div class="toolbar"><div class="search">${ic('search')}<input placeholder="Buscar por cliente, modelo ou série" value="${esc(q)}" data-input="warSearch"></div><button class="btn" data-act="newEquip">${ic('plus')} Novo equipamento</button></div>
    <div class="chips">${[['todos', 'Todos'], ['garantia', 'Em garantia'], ['vencendo', 'Vencendo em 30 dias'], ['vencida', 'Vencida']].map(([k, l]) => `<button class="chip ${flt === k ? 'on' : ''}" data-act="warFlt" data-v="${k}">${l}<b>${c(k)}</b></button>`).join('')}</div>
    <div class="card" id="wlist"></div>`;
  list();
}
function list() {
  const k = q.toLowerCase();
  const l = DB.equipment.filter(e => (flt === 'todos' || cls(e) === flt || (flt === 'garantia' && cls(e) === 'vencendo')) && (!k || [clientName(e.clientId), e.model, e.serial, e.type, e.location].join(' ').toLowerCase().includes(k))).sort((a, b) => (a.equipEnd || '').localeCompare(b.equipEnd || ''));
  $('#wlist').innerHTML = l.length ? l.map(e => { const w = warrantyState(e);
    return `<div class="li" data-act="openEquip" data-id="${e.id}"><div class="av">${ic('shield')}</div><div class="lt"><b>${esc(clientName(e.clientId))} – ${esc(e.type)} ${esc(e.model)}</b>${meta(e.serial ? 'série ' + esc(e.serial) : '', esc(e.location), 'instalado em ' + fmtDate(e.installDate))}</div><div class="rt">${badge(w.text, w.tone)}<small>equip. até ${fmtDate(e.equipEnd)}</small><small>mão de obra até ${fmtDate(e.laborEnd)}</small></div></div>`; }).join('')
    : `<div class="empty"><b>Nenhum equipamento aqui</b>Os equipamentos entram sozinhos quando você conclui uma OS com “Equipamento instalado”. Também dá para cadastrar à mão.</div>`;
}
ACT.warSearch = (d, el) => { q = el.value; list(); };
ACT.warFlt = d => { flt = d.v; app.refresh(); };

function form(id, pre = {}) {
  const s = settings(), e = get('equipment', id) || { type: types()[0], installDate: today(), equipMonths: s.warrantyEquip, laborMonths: s.warrantyLabor, ...pre };
  const hist = id ? DB.os.filter(o => o.eqRef === id || o.equipId === id).sort((a, b) => (b.date || '').localeCompare(a.date || '')) : [];
  modal(id ? 'Equipamento' : 'Novo equipamento', `<form data-submit="saveEquip" data-id="${id || ''}"><div class="fg">
    ${F('clientId', 'Cliente', e.clientId, { type: 'select', opts: clientOpts(), req: true, full: true })}
    ${F('type', 'Tipo', e.type, { type: 'select', opts: types() })}${F('model', 'Modelo / descrição', e.model, { req: true })}
    ${F('serial', 'Número de série', e.serial)}${F('location', 'Local de instalação', e.location)}
    ${F('installDate', 'Data da instalação', e.installDate, { type: 'date' })}<div></div>
    ${F('equipMonths', 'Garantia do equipamento (meses)', e.equipMonths, { type: 'number', step: '1' })}${F('laborMonths', 'Garantia da mão de obra (meses)', e.laborMonths, { type: 'number', step: '1' })}</div>
    <div class="btns"><button class="btn">Salvar equipamento</button></div></form>
    ${id ? `<div class="btns"><button class="btn ghost" data-act="warrantyOS" data-id="${id}">${ic('clip')} Abrir OS de atendimento</button><button class="btn danger" data-act="deleteEquip" data-id="${id}">${ic('trash')} Excluir</button></div>
      <div class="sub">Histórico de atendimentos (${hist.length})</div>${hist.length ? hist.map(osRow).join('') : '<p class="hint">Nenhum atendimento registrado para este equipamento.</p>'}` : ''}`, { wide: true });
}
ACT.newEquip = d => form('', { ...d });
ACT.openEquip = d => form(d.id);
ACT.saveEquip = async (d, f) => {
  const v = readForm(f); v.equipMonths = +v.equipMonths || 0; v.laborMonths = +v.laborMonths || 0;
  v.equipEnd = addMonths(v.installDate, v.equipMonths); v.laborEnd = addMonths(v.installDate, v.laborMonths);
  await put('equipment', { ...(get('equipment', d.id) || {}), ...v }); closeModal(); app.refresh(); toast('Equipamento salvo');
};
ACT.deleteEquip = async d => { if (!confirm('Excluir este equipamento?')) return; await del('equipment', d.id); closeModal(); app.refresh(); toast('Equipamento excluído'); };
ACT.warrantyOS = d => { const e = get('equipment', d.id); closeModal(); ACT.newOS({ clientId: e.clientId, eqRef: e.id, type: 'Manutenção', desc: `Atendimento – ${e.type} ${e.model}` }); };
