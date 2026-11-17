import { DB, get, put, del, nextNum, settings } from '../store.js';
import { $, $$, ACT, ic, esc, brl, fmtDate, today, pad, F, readForm, modal, closeModal, toast, waLink, printHTML, printHeader, compressImage, me, app } from '../util.js';
import { OS_ST, types, clientOpts, techOpts, clientName, userName, total, osRow, afterSaveOS, limited, can } from '../domain.js';
import { itemsEditor, readItems, recalc } from '../items.js';
import { osPayButtons } from '../docs.js';

let filter = 'Todas', q = '', ed = {};
/* acesso limitado: só as OS dele que ainda estão em aberto */
const mine = o => !limited() || (o.techId === me.user.id && (o.status === 'Aberta' || o.status === 'Em andamento'));

export function render(root) {
  const all = DB.os.filter(mine), lim = limited();
  const cnt = s => s === 'Todas' ? all.length : all.filter(o => o.status === s).length;
  root.innerHTML = `<div class="toolbar"><div class="search">${ic('search')}<input placeholder="Buscar por cliente, serviço ou número" value="${esc(q)}" data-input="osSearch"></div>
    ${lim ? '' : `<button class="btn" data-act="newOS">${ic('plus')} Nova OS</button>`}</div>
    ${lim ? '' : `<div class="chips">${['Todas', ...OS_ST].map(s => `<button class="chip ${filter === s ? 'on' : ''}" data-act="osFilter" data-v="${s}">${s}<b>${cnt(s)}</b></button>`).join('')}</div>`}
    <div class="card" id="olist"></div>`;
  list();
}
function list() {
  const k = q.toLowerCase();
  const l = DB.os.filter(mine).filter(o => (limited() || filter === 'Todas' || o.status === filter) && (!k || [clientName(o.clientId), o.type, pad(o.num), o.desc].join(' ').toLowerCase().includes(k)))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.num - a.num);
  $('#olist').innerHTML = l.length ? l.map(osRow).join('') : `<div class="empty"><b>${limited() ? 'Nenhuma OS em aberto para você' : 'Nenhuma OS aqui'}</b>${limited() ? 'Quando o administrador passar uma OS para você, ela aparece aqui.' : 'Toque em “Nova OS” para registrar um serviço.'}</div>`;
}
ACT.osSearch = (d, el) => { q = el.value; list(); };
ACT.osFilter = d => { filter = d.v; app.refresh(); };

/* ---------- formulário ---------- */
const checklistFor = t => (settings().checklists[t] || []).map(x => ({ t: x, done: false }));
const chkHTML = l => l.map(c => `<label class="chk"><input type="checkbox" ${c.done ? 'checked' : ''}><span>${esc(c.t)}</span></label>`).join('');
const eqPairs = cid => [['', 'Nenhum'], ...DB.equipment.filter(e => e.clientId === cid).map(e => [e.id, `${e.type} ${e.model} (garantia até ${fmtDate(e.equipEnd)})`])];
const optHTML = (pairs, sel) => pairs.map(([v, l]) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(l)}</option>`).join('');

export function osForm(id, pre = {}) {
  const old = get('os', id);
  const o = old || { status: 'Aberta', type: types()[0], date: today(), time: '', items: [], discount: 0, techId: limited() ? me.user.id : '', ...pre };
  ed = { before: [...(o.before || [])], after: [...(o.after || [])], sigDirty: false, cleared: false };
  const cl = o.checklist || checklistFor(o.type);
  modal(id ? `OS ${pad(o.num)}` : 'Nova OS', `<form data-submit="saveOS" data-id="${id || ''}">
    <input type="hidden" name="quoteId" value="${esc(o.quoteId || '')}">
    <div class="fg">
      ${F('clientId', 'Cliente', o.clientId, { type: 'select', opts: clientOpts(), req: true, attrs: 'data-change="osClient"' })}
      ${F('type', 'Serviço', o.type, { type: 'select', opts: types(), attrs: 'data-change="osType"' })}
      ${F('status', 'Situação', o.status, { type: 'select', opts: OS_ST })}
      ${F('techId', 'Técnico responsável', o.techId, { type: 'select', opts: techOpts() })}
      ${F('date', 'Data', o.date, { type: 'date' })}${F('time', 'Horário', o.time, { type: 'time' })}
      ${F('eqRef', 'Equipamento atendido (garantia / manutenção)', o.eqRef || '', { type: 'select', opts: eqPairs(o.clientId), full: true })}
      ${F('desc', 'Descrição do serviço', o.desc, { type: 'textarea', full: true })}
    </div>
    <div class="sub">Etapas do serviço</div>
    <div id="chk">${chkHTML(cl)}</div>
    <div style="display:flex;gap:8px;margin-top:8px"><input id="newchk" placeholder="Adicionar etapa"><button type="button" class="btn ghost sm" data-act="addChk">Adicionar</button></div>
    <div class="sub">Materiais e serviços</div>
    ${itemsEditor(o.items)}
    <div class="fg" style="margin-top:8px">${F('discount', 'Desconto (R$)', o.discount || '', { type: 'money', attrs: 'data-input="recalc"' })}<div class="f"><label>Total</label><div class="total" data-total></div></div></div>
    ${!o.equipId ? `<div class="sub">Equipamento instalado nesta OS</div><div class="fg">${F('neqModel', 'Modelo / descrição', o.newEquip?.model || '')}${F('neqSerial', 'Número de série', o.newEquip?.serial || '')}${F('neqLocation', 'Local de instalação', o.newEquip?.location || '', { full: true })}</div><p class="hint">Ao concluir a OS, o equipamento entra na lista de garantias automaticamente.</p>` : '<p class="hint">O equipamento desta OS já está registrado em Garantias.</p>'}
    <div class="sub">Fotos do antes e do depois</div>
    <div class="btns" style="margin-top:0"><label class="file">${ic('camera')} Fotos do antes<input type="file" accept="image/*" multiple data-change="addPhotos" data-kind="before"></label><label class="file">${ic('camera')} Fotos do depois<input type="file" accept="image/*" multiple data-change="addPhotos" data-kind="after"></label></div>
    <div class="photos" id="ph-before"></div><div class="photos" id="ph-after"></div>
    <div class="sub">Assinatura do cliente</div>
    <canvas id="sig"></canvas>
    <div class="fg" style="margin-top:8px">${F('signedBy', 'Nome de quem assinou', o.signedBy || '')}<div class="f"><label>&nbsp;</label><button type="button" class="btn ghost block" data-act="clearSig">Limpar assinatura</button></div></div>
    <div class="btns"><button class="btn">Salvar OS</button></div>
    ${id ? `<div class="btns"><button type="button" class="btn ghost" data-act="printOS" data-id="${id}">${ic('print')} PDF / imprimir</button><button type="button" class="btn ok" data-act="waOS" data-id="${id}">${ic('chat')} WhatsApp</button>${me.user.role === 'dono' ? `<button type="button" class="btn danger" data-act="deleteOS" data-id="${id}">${ic('trash')} Excluir</button>` : ''}</div>` : ''}
    ${id && o.finId && can('finance') ? osPayButtons(get('finance', o.finId)) : ''}
  </form>`, { wide: true });
  initSig(o.signature); thumbs(); recalc($('#modal form'));
}
ACT.newOS = d => osForm('', { ...d });
ACT.openOS = d => osForm(d.id);

ACT.osClient = (d, el) => { $('[name=eqRef]', el.closest('form')).innerHTML = optHTML(eqPairs(el.value), ''); };
ACT.osType = (d, el) => {
  const f = el.closest('form');
  if (!$$('#chk input:checked', f).length) $('#chk', f).innerHTML = chkHTML(checklistFor(el.value));
};
ACT.addChk = () => {
  const i = $('#newchk'), t = i.value.trim(); if (!t) return;
  $('#chk').insertAdjacentHTML('beforeend', chkHTML([{ t, done: false }])); i.value = '';
};

/* ---------- fotos ---------- */
function thumbs() {
  for (const k of ['before', 'after']) {
    $('#ph-' + k).innerHTML = ed[k].length ? `<b style="width:100%;font-size:13px;color:var(--mut)">${k === 'before' ? 'Antes' : 'Depois'}</b>` + ed[k].map((s, i) => `<div class="th"><img src="${s}" alt=""><button type="button" data-act="rmPhoto" data-kind="${k}" data-i="${i}" aria-label="Remover foto">${ic('x')}</button></div>`).join('') : '';
  }
}
ACT.addPhotos = async (d, el) => {
  for (const f of el.files) ed[d.kind].push(await compressImage(f));
  el.value = ''; thumbs();
};
ACT.rmPhoto = d => { ed[d.kind].splice(+d.i, 1); thumbs(); };

/* ---------- assinatura ---------- */
function initSig(existing) {
  const c = $('#sig'); if (!c) return;
  const r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, H = 160;
  c.width = Math.round(r.width * dpr); c.height = H * dpr;
  const x = c.getContext('2d'); x.scale(dpr, dpr);
  x.fillStyle = '#fff'; x.fillRect(0, 0, r.width, H);
  x.lineWidth = 2.2; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#111';
  if (existing) { const im = new Image(); im.onload = () => x.drawImage(im, 0, 0, r.width, H); im.src = existing; }
  const pt = e => { const b = c.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
  let down = false;
  c.onpointerdown = e => { down = true; c.setPointerCapture(e.pointerId); const p = pt(e); x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x + 0.1, p.y + 0.1); x.stroke(); ed.sigDirty = true; };
  c.onpointermove = e => { if (!down) return; const p = pt(e); x.lineTo(p.x, p.y); x.stroke(); };
  c.onpointerup = c.onpointercancel = () => { down = false; };
  ed.canvas = c; ed.ctx = x; ed.w = r.width; ed.H = H;
}
ACT.clearSig = () => { ed.ctx.fillStyle = '#fff'; ed.ctx.fillRect(0, 0, ed.w, ed.H); ed.sigDirty = false; ed.cleared = true; };

/* ---------- salvar ---------- */
ACT.saveOS = async (d, f) => {
  const v = readForm(f), old = get('os', d.id) || {};
  const o = { ...old, clientId: v.clientId, type: v.type, status: v.status, techId: v.techId, date: v.date, time: v.time, desc: v.desc, eqRef: v.eqRef,
    discount: v.discount, signedBy: v.signedBy, items: readItems(f), before: ed.before, after: ed.after,
    checklist: $$('#chk label', f).map(l => ({ t: $('span', l).textContent, done: $('input', l).checked })) };
  if (v.quoteId) o.quoteId = v.quoteId;
  if (ed.sigDirty) o.signature = ed.canvas.toDataURL('image/png'); else if (ed.cleared) o.signature = '';
  if (v.neqModel && !old.equipId) o.newEquip = { model: v.neqModel, serial: v.neqSerial, location: v.neqLocation };
  if (!d.id) o.num = await nextNum('os');
  const had = !!old.finId;
  await afterSaveOS(o);
  if (o.quoteId && !old.quoteId) { const qt = get('quotes', o.quoteId); if (qt) { qt.status = 'Aprovado'; qt.osId = o.id; await put('quotes', qt); } }
  closeModal(); app.refresh();
  toast(!had && o.finId ? 'OS salva e cobrança lançada no financeiro' : 'OS salva');
};
ACT.deleteOS = async d => {
  const o = get('os', d.id);
  if (!confirm(`Excluir a OS ${pad(o.num)}?\nA baixa de estoque e o lançamento financeiro já feitos não são desfeitos.`)) return;
  await del('os', d.id); closeModal(); app.refresh(); toast('OS excluída');
};

/* ---------- impressão e WhatsApp ---------- */
ACT.printOS = d => {
  const o = get('os', d.id), c = get('clients', o.clientId) || {}, s = settings();
  printHTML(`${printHeader('ORDEM DE SERVIÇO Nº ' + pad(o.num), fmtDate(o.date))}
    <div class="box"><b>Cliente:</b> ${esc(c.name)}${c.phone ? ' – ' + esc(c.phone) : ''}${c.address ? '<br>' + esc(c.address) : ''}${c.city ? ' – ' + esc(c.city) : ''}</div>
    <div class="box"><b>Serviço:</b> ${esc(o.type)} &nbsp; <b>Situação:</b> ${esc(o.status)}${o.techId ? ' &nbsp; <b>Técnico:</b> ' + esc(userName(o.techId)) : ''}${o.desc ? '<br>' + esc(o.desc).replace(/\n/g, '<br>') : ''}</div>
    ${(o.checklist || []).length ? `<b>Etapas</b><ul>${o.checklist.map(x => `<li>${x.done ? '[x]' : '[ ]'} ${esc(x.t)}</li>`).join('')}</ul>` : ''}
    ${(o.items || []).length ? `<table><thead><tr><th>Descrição</th><th class="r">Qtd</th><th class="r">Unitário</th><th class="r">Subtotal</th></tr></thead><tbody>${o.items.map(i => `<tr><td>${esc(i.desc)}</td><td class="r">${i.qty}</td><td class="r">${brl(i.price)}</td><td class="r">${brl(i.qty * i.price)}</td></tr>`).join('')}</tbody></table>${o.discount ? `<div class="r">Desconto: ${brl(o.discount)}</div>` : ''}<div class="tot">Total: ${brl(total(o))}</div>` : ''}
    ${(o.before || []).length || (o.after || []).length ? `<p><b>Registro fotográfico</b></p><div class="pg">${[...(o.before || []), ...(o.after || [])].map(x => `<img src="${x}" alt="">`).join('')}</div>` : ''}
    <div class="box">${esc(s.terms)}</div>
    <div class="sign"><div>${esc(s.company)}</div><div>${o.signature ? `<img src="${o.signature}" alt="">` : ''}${esc(o.signedBy || c.name || 'Cliente')}</div></div>`);
};
ACT.waOS = d => {
  const o = get('os', d.id), c = get('clients', o.clientId) || {}, s = settings();
  const msg = o.status === 'Concluída'
    ? `Olá, ${c.name}! Seu serviço (${o.type}) foi concluído – OS ${pad(o.num)}. Total: ${brl(total(o))}. ${s.terms}\nObrigado pela confiança!\n\n${s.company} – ${s.whats}`
    : `Olá, ${c.name}! Sua OS ${pad(o.num)} (${o.type}) está ${o.status.toLowerCase()}${o.date ? ', com data prevista para ' + fmtDate(o.date) + (o.time ? ' às ' + o.time : '') : ''}.\n\n${s.company} – ${s.whats}`;
  window.open(waLink(c.phone, msg), '_blank');
};
