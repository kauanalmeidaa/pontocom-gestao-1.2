import { DB, get, put, del, nextNum, settings } from '../store.js';
import { $, $$, ACT, ic, esc, brl, fmtDate, today, pad, F, readForm, modal, closeModal, toast, waLink, printHTML, printHeader, compressImage, me, app } from '../util.js';
import { OS_ST, types, clientOpts, techOpts, clientName, userName, total, osRow, afterSaveOS, limited, can, addMove } from '../domain.js';
import { itemsEditor, readItems, recalc } from '../items.js';
import { osPayButtons, osDoc, docTexts, defaultTexts } from '../docs.js';

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
  const o = old || { status: 'Aberta', type: types()[0], date: today(), time: '', items: [], discount: 0, techId: limited() ? me.user.id : '', ...defaultTexts(), ...pre }, tx = docTexts(o);
  ed = { before: [...(o.before || [])], after: [...(o.after || [])], sigDirty: false, cleared: false };
  const cl = o.checklist || checklistFor(o.type);
  modal(id ? `OS ${pad(o.num)}` : 'Nova OS', `<div class="tabs" role="tablist"><button type="button" class="tab on" data-act="osTab" data-t="dados">Dados da OS</button><button type="button" class="tab" data-act="osTab" data-t="consumo">Material de consumo</button></div>
  <div id="tabDados"><form data-submit="saveOS" data-id="${id || ''}">
    <input type="hidden" name="quoteId" value="${esc(o.quoteId || '')}">
    <div class="fg">
      ${F('clientId', 'Cliente', o.clientId, { type: 'select', opts: clientOpts(), req: true, attrs: 'data-change="osClient"' })}
      ${F('type', 'Serviço', o.type, { type: 'select', opts: types(), attrs: 'data-change="osType"' })}
      ${F('status', 'Situação', o.status, { type: 'select', opts: OS_ST })}
      ${F('techId', 'Técnico responsável', o.techId, { type: 'select', opts: techOpts() })}
      ${F('date', 'Data', o.date, { type: 'date' })}${F('time', 'Horário', o.time, { type: 'time' })}
      ${F('eqRef', 'Equipamento atendido (garantia / manutenção)', o.eqRef || '', { type: 'select', opts: eqPairs(o.clientId), full: true })}
      ${F('desc', 'Descrição do serviço', o.desc, { type: 'textarea', full: true })}
      ${F('notes', 'Observações', o.notes ?? tx.notes, { type: 'textarea', rows: 3, full: true })}
      ${F('warrantyText', 'Condições de garantia', tx.warrantyText, { type: 'textarea', rows: 4, full: true })}
      ${F('contractText', 'Condições contratuais', tx.contractText, { type: 'textarea', rows: 5, full: true })}
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
    ${id ? `<div class="btns"><button type="button" class="btn ghost" data-act="printOS" data-id="${id}">${ic('print')} PDF / imprimir</button><button type="button" class="btn ok" data-act="waOS" data-id="${id}">${ic('wa')} WhatsApp</button>${me.user.role === 'dono' ? `<button type="button" class="btn danger" data-act="deleteOS" data-id="${id}">${ic('trash')} Excluir</button>` : ''}</div>` : ''}
    ${id && o.finId && can('finance') ? osPayButtons(get('finance', o.finId)) : ''}
  </form></div>
  <div id="tabConsumo" data-id="${id || ''}" hidden></div>`, { wide: true });
  initSig(o.signature); thumbs(); recalc($('#modal form')); renderConsumo(id);
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
    discount: v.discount, signedBy: v.signedBy, notes: v.notes, warrantyText: v.warrantyText, contractText: v.contractText, items: readItems(f), before: ed.before, after: ed.after,
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
ACT.printOS = d => printHTML(osDoc(get('os', d.id)));
ACT.waOS = d => {
  const o = get('os', d.id), c = get('clients', o.clientId) || {}, s = settings();
  const msg = o.status === 'Concluída'
    ? `Olá, ${c.name}! Seu serviço (${o.type}) foi concluído – OS ${pad(o.num)}. Total: ${brl(total(o))}. ${docTexts(o, s).warrantyText}\nObrigado pela confiança!\n\n${s.company} – ${s.whats}`
    : `Olá, ${c.name}! Sua OS ${pad(o.num)} (${o.type}) está ${o.status.toLowerCase()}${o.date ? ', com data prevista para ' + fmtDate(o.date) + (o.time ? ' às ' + o.time : '') : ''}.\n\n${s.company} – ${s.whats}`;
  window.open(waLink(c.phone, msg), '_blank');
};

/* ---------- aba "Material de consumo": baixa de estoque ligada à OS e ao cliente ---------- */
const prodOpts = () => '<option value="">Escolha o material…</option>' + [...DB.products].sort((a, b) => a.name.localeCompare(b.name)).map(p => `<option value="${p.id}">${esc(p.name)} (em estoque: ${p.stock || 0} ${esc(p.unit || 'un')})</option>`).join('');
const crow = () => `<div class="cr"><select class="cp" aria-label="Material">${prodOpts()}</select><input class="cq" type="number" step="any" min="0" inputmode="decimal" placeholder="Qtd" aria-label="Quantidade usada"><button type="button" class="rm" data-act="rmCons" aria-label="Remover linha">${ic('x')}</button></div>`;
function renderConsumo(id) {
  const box = $('#tabConsumo'); if (!box) return;
  const o = get('os', id);
  if (!o) { box.innerHTML = `<div class="empty"><b>Salve a OS primeiro</b>Depois de salvar, volte nesta aba para dar baixa no material de consumo usado no serviço.</div>`; return; }
  const l = (o.consumo || []).slice().reverse();
  box.innerHTML = `<p class="hint" style="margin-top:0">Registre aqui o que foi gasto no serviço (fio, abraçadeira, fita, conector…). A baixa sai do estoque na hora e fica registrada no cliente <b>${esc(clientName(o.clientId))}</b> e nesta OS.</p>
  <form data-submit="saveConsumo" data-id="${o.id}"><div id="crows">${crow()}</div>
    <div class="btns"><button type="button" class="btn ghost sm" data-act="addCons">${ic('plus')} Outro material</button></div>
    <div class="btns"><button class="btn">${ic('check')} Dar baixa no estoque</button></div></form>
  <div class="sub">Material já baixado nesta OS</div>
  ${l.length ? l.map(c => `<div class="li"><div class="av">${ic('box')}</div><div class="lt"><b>${esc(c.name)}</b>${c.reverted ? `<span class="meta"><span>estornado</span></span>` : `<span class="meta"><span>${fmtDate(c.date)}</span><span>${esc(c.byName || '')}</span></span>`}</div><div class="rt"><span class="v" ${c.reverted ? 'style="text-decoration:line-through;opacity:.6"' : ''}>${c.qty} ${esc(c.unit || 'un')}</span>${c.reverted ? '' : `<button type="button" class="btn ghost sm" data-act="revertCons" data-id="${o.id}" data-cid="${c.id}">Estornar</button>`}</div></div>`).join('') : '<p class="hint">Nenhuma baixa registrada ainda.</p>'}`;
}
ACT.osTab = (d, el) => {
  document.querySelectorAll('#modal .tab').forEach(b => b.classList.toggle('on', b === el));
  $('#tabDados').hidden = d.t !== 'dados'; $('#tabConsumo').hidden = d.t !== 'consumo';
  if (d.t === 'consumo') renderConsumo($('#tabConsumo').dataset.id);
};
ACT.addCons = () => $('#crows').insertAdjacentHTML('beforeend', crow());
ACT.rmCons = (d, el) => { const rows = $('#crows'); if (rows.children.length > 1) el.closest('.cr').remove(); else { $('.cp', el.closest('.cr')).value = ''; $('.cq', el.closest('.cr')).value = ''; } };
ACT.saveConsumo = async (d, f) => {
  const o = get('os', d.id); if (!o) return;
  const lines = $$('.cr', f).map(r => ({ pid: $('.cp', r).value, qty: +$('.cq', r).value || 0 })).filter(x => x.pid || x.qty);
  if (!lines.length || lines.some(x => !x.pid || !(x.qty > 0))) return toast('Escolha o material e informe a quantidade em cada linha');
  const short = lines.filter(x => (get('products', x.pid).stock || 0) < x.qty).map(x => get('products', x.pid).name);
  if (short.length && !confirm(`Estoque insuficiente de: ${short.join(', ')}.\nDar baixa mesmo assim? O estoque ficará negativo.`)) return;
  const cons = [...(o.consumo || [])];
  for (const x of lines) {
    const p = get('products', x.pid);
    const mv = await addMove(p.id, 'saida', x.qty, { osId: o.id, clientId: o.clientId, consumo: true, by: me.user.id, note: `Consumo OS ${pad(o.num)}` });
    cons.push({ id: mv.id, pid: p.id, name: p.name, unit: p.unit || 'un', qty: x.qty, date: today(), by: me.user.id, byName: me.user.name });
  }
  await put('os', { ...get('os', d.id), consumo: cons });
  renderConsumo(d.id); toast('Baixa registrada no estoque');
};
ACT.revertCons = async d => {
  const o = get('os', d.id), c = (o.consumo || []).find(x => x.id === d.cid); if (!c || c.reverted) return;
  if (!confirm(`Estornar ${c.qty} ${c.unit} de ${c.name}? O material volta para o estoque.`)) return;
  if (get('products', c.pid)) await addMove(c.pid, 'entrada', c.qty, { osId: o.id, clientId: o.clientId, consumo: true, by: me.user.id, note: `Estorno de consumo OS ${pad(o.num)}` });
  await put('os', { ...o, consumo: o.consumo.map(x => x.id === d.cid ? { ...x, reverted: true } : x) });
  renderConsumo(d.id); toast('Estorno feito');
};
