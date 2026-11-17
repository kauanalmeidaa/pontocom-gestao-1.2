import { DB, get, put, del, uid } from '../store.js';
import { $, ACT, ic, esc, brl, fmtDate, pad, meta, badge, F, readForm, modal, closeModal, toast, waLink, digits, parseCSV, app } from '../util.js';
import { osRow, quoteRow, warrantyState, total, sum } from '../domain.js';

let q = '';
const match = c => !q || [c.name, c.phone, c.city, c.address, c.doc].join(' ').toLowerCase().includes(q.toLowerCase());

export function render(root) {
  root.innerHTML = `<div class="toolbar"><div class="search">${ic('search')}<input id="cq" placeholder="Buscar por nome, telefone ou cidade" value="${esc(q)}" data-input="clientSearch"></div>
    <label class="btn ghost sm file" style="padding:8px 12px">${ic('down')} Importar CSV<input type="file" accept=".csv,text/csv,text/plain" data-change="importCSV"></label>
    <button class="btn" data-act="newClient">${ic('plus')} Novo cliente</button></div>
    <div class="card" id="clist"></div>`;
  list();
}
function list() {
  const l = DB.clients.filter(match).sort((a, b) => a.name.localeCompare(b.name));
  $('#clist').innerHTML = l.length ? l.map(c => `<div class="li" data-act="openClient" data-id="${c.id}"><div class="av">${ic('users')}</div><div class="lt"><b>${esc(c.name)}</b>${meta(esc(c.phone || 'sem telefone'), esc(c.city))}</div><div class="rt"><small>${DB.os.filter(o => o.clientId === c.id).length} OS</small></div></div>`).join('')
    : `<div class="empty"><b>${q ? 'Nenhum cliente encontrado' : 'Nenhum cliente ainda'}</b>${q ? 'Tente outro nome ou telefone.' : 'Cadastre o primeiro ou importe a lista do seu sistema atual (CSV).'}</div>`;
}
ACT.clientSearch = (d, el) => { q = el.value; list(); };

export function clientForm(id) {
  const c = get('clients', id) || {};
  modal(id ? 'Editar cliente' : 'Novo cliente', `<form data-submit="saveClient" data-id="${id || ''}"><div class="fg">
    ${F('name', 'Nome', c.name, { req: true, full: true })}
    ${F('phone', 'Telefone / WhatsApp', c.phone, { type: 'tel' })}${F('doc', 'CPF / CNPJ', c.doc)}
    ${F('city', 'Cidade', c.city)}${F('address', 'Endereço', c.address)}
    ${F('notes', 'Observações', c.notes, { type: 'textarea', full: true })}</div>
    <div class="btns"><button class="btn">Salvar cliente</button></div></form>`);
}
ACT.newClient = () => clientForm();
ACT.editClient = d => clientForm(d.id);
ACT.saveClient = async (d, f) => {
  const v = readForm(f), o = { ...(get('clients', d.id) || {}), ...v };
  await put('clients', o); closeModal(); app.refresh(); toast('Cliente salvo');
};
ACT.deleteClient = async d => {
  const c = get('clients', d.id);
  const used = DB.os.some(o => o.clientId === d.id) || DB.quotes.some(x => x.clientId === d.id);
  if (!confirm(`Excluir ${c.name}?${used ? '\nEle tem OS ou orçamentos, que continuarão no sistema sem nome de cliente.' : ''}`)) return;
  await del('clients', d.id); closeModal(); app.refresh(); toast('Cliente excluído');
};

/* ---------- ficha do cliente ---------- */
ACT.openClient = d => {
  const c = get('clients', d.id); if (!c) return;
  const eq = DB.equipment.filter(e => e.clientId === c.id), os = DB.os.filter(o => o.clientId === c.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const qs = DB.quotes.filter(x => x.clientId === c.id).sort((a, b) => b.num - a.num), ct = DB.contracts.filter(x => x.clientId === c.id);
  const pend = DB.finance.filter(f => f.clientId === c.id && f.type === 'receber' && !f.paid);
  modal(c.name, `
    <div class="meta" style="margin-bottom:4px">${[c.phone, c.doc, c.city, c.address].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('')}</div>
    ${c.notes ? `<p class="hint">${esc(c.notes)}</p>` : ''}
    <div class="btns">
      ${c.phone ? `<a class="btn ok" href="${waLink(c.phone, '')}" target="_blank" rel="noopener">${ic('chat')} WhatsApp</a><a class="btn ghost" href="tel:${digits(c.phone)}">${ic('phone')} Ligar</a>` : ''}
      <button class="btn ghost" data-act="newOSFor" data-id="${c.id}">${ic('clip')} Nova OS</button>
      <button class="btn ghost" data-act="newQuoteFor" data-id="${c.id}">${ic('doc')} Novo orçamento</button>
      <button class="btn ghost" data-act="newEquipFor" data-id="${c.id}">${ic('shield')} Novo equipamento</button>
      <button class="btn ghost" data-act="editClient" data-id="${c.id}">${ic('edit')} Editar</button>
    </div>
    ${pend.length ? `<div class="sub">A receber</div><p>${brl(sum(pend))} em ${pend.length} lançamento(s)</p>` : ''}
    <div class="sub">Equipamentos instalados (${eq.length})</div>
    ${eq.length ? eq.map(e => { const w = warrantyState(e); return `<div class="li" data-act="openEquip" data-id="${e.id}"><div class="av">${ic('shield')}</div><div class="lt"><b>${esc(e.type)} – ${esc(e.model)}</b>${meta(esc(e.location), 'garantia até ' + fmtDate(e.equipEnd))}</div><div class="rt">${badge(w.text, w.tone)}</div></div>`; }).join('') : '<p class="hint">Nenhum equipamento registrado.</p>'}
    <div class="sub">Ordens de serviço (${os.length})</div>
    ${os.length ? os.slice(0, 8).map(osRow).join('') : '<p class="hint">Nenhuma OS.</p>'}
    <div class="sub">Orçamentos (${qs.length})</div>
    ${qs.length ? qs.slice(0, 6).map(quoteRow).join('') : '<p class="hint">Nenhum orçamento.</p>'}
    ${ct.length ? `<div class="sub">Contratos</div>${ct.map(x => `<div class="li" data-act="openContract" data-id="${x.id}"><div class="av">${ic('repeat')}</div><div class="lt"><b>${esc(x.name)}</b>${meta(brl(x.value) + ' por mês', 'próxima visita ' + fmtDate(x.nextVisit))}</div></div>`).join('')}` : ''}
    <div class="btns"><button class="btn danger" data-act="deleteClient" data-id="${c.id}">${ic('trash')} Excluir cliente</button></div>`, { wide: true });
};
ACT.newOSFor = d => { closeModal(); ACT.newOS({ clientId: d.id }); };
ACT.newQuoteFor = d => { closeModal(); ACT.newQuote({ clientId: d.id }); };
ACT.newEquipFor = d => { closeModal(); ACT.newEquip({ clientId: d.id }); };

/* ---------- importar CSV ---------- */
ACT.importCSV = (d, el) => {
  const file = el.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = async () => {
    const rows = parseCSV(String(r.result).replace(/^﻿/, ''));
    if (!rows.length) return toast('A planilha está vazia');
    const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const heads = rows[0].map(norm), find = n => heads.findIndex(h => n.some(x => h.includes(x)));
    let ix = { name: find(['nome', 'cliente', 'razao']), phone: find(['telefone', 'celular', 'whats', 'fone', 'tel']), city: find(['cidade', 'municipio']), address: find(['endereco', 'logradouro', 'rua']), notes: find(['obs']), doc: find(['cpf', 'cnpj', 'documento']) };
    let body = rows.slice(1);
    if (ix.name < 0) { ix = { name: 0, phone: 1, city: 2, address: 3, notes: 4, doc: -1 }; body = rows; }
    const g = (row, k) => ix[k] >= 0 ? (row[ix[k]] || '').trim() : '';
    let added = 0;
    for (const row of body) {
      const name = g(row, 'name'); if (!name) continue;
      const phone = g(row, 'phone');
      if (DB.clients.some(c => c.name.toLowerCase() === name.toLowerCase() && digits(c.phone) === digits(phone))) continue;
      await put('clients', { id: uid(), name, phone, city: g(row, 'city'), address: g(row, 'address'), notes: g(row, 'notes'), doc: g(row, 'doc') }); added++;
    }
    el.value = ''; app.refresh(); toast(`${added} cliente(s) importado(s)`);
  };
  r.readAsText(file, 'UTF-8');
};
