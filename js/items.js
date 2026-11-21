/* Editor de itens (produtos e serviços) usado em Orçamentos e OS */
import { DB, get } from './store.js';
import { $, $$, ACT, ic, esc, brl, compressImage } from './util.js';

export function rowHTML(i = {}, photos = false) {
  const opts = '<option value="">Serviço / avulso</option>' + [...DB.products].sort((a, b) => a.name.localeCompare(b.name)).map(p =>
    `<option value="${p.id}" data-price="${p.price || 0}" data-cost="${p.cost || 0}" data-name="${esc(p.name)}" ${p.id === i.pid ? 'selected' : ''}>${esc(p.name)} (${p.stock || 0} ${esc(p.unit || 'un')})</option>`).join('');
  return `<div class="it" data-cost="${i.cost || 0}">
    <select class="ip" data-change="pickProduct" aria-label="Produto">${opts}</select>
    <input class="id" placeholder="Descrição" value="${esc(i.desc || '')}" aria-label="Descrição">
    <input class="iq" type="number" step="any" inputmode="decimal" value="${i.qty ?? 1}" data-input="recalc" aria-label="Quantidade">
    <input class="iv" type="number" step="0.01" inputmode="decimal" placeholder="0,00" value="${i.price ?? ''}" data-input="recalc" aria-label="Valor unitário">
    <button type="button" class="rm" data-act="rmItem" aria-label="Remover item">${ic('x')}</button>
    ${photos ? `<div class="iphw"><input type="hidden" class="iph" value="${esc(i.photo || '')}"><img class="iphp" alt="" ${i.photo ? `src="${esc(i.photo)}"` : 'hidden'}>
      <label class="file sm">${ic('camera')} <span class="iphl">${i.photo ? 'Trocar foto' : 'Foto do produto'}</span><input type="file" accept="image/*" data-change="itemPhoto"></label>
      <button type="button" class="btn ghost sm iphx" data-act="rmItemPhoto" ${i.photo ? '' : 'hidden'}>Remover foto</button></div>` : ''}</div>`;
}
export function itemsEditor(items, id = 'items', photos = false) {
  const list = (items && items.length) ? items : [{}];
  return `<div class="items" id="${id}" ${photos ? 'data-photos="1"' : ''}>${list.map(i => rowHTML(i, photos)).join('')}</div>
  <button type="button" class="btn ghost sm" data-act="addItem" data-target="${id}">${ic('plus')} Adicionar item</button>`;
}
export function readItems(root = document) {
  return $$('.it', root).map(r => {
    const pid = $('.ip', r).value;
    const photo = $('.iph', r)?.value || '';
    return { pid, desc: $('.id', r).value.trim(), qty: +$('.iq', r).value || 0, price: +$('.iv', r).value || 0, cost: pid ? (+r.dataset.cost || 0) : 0, ...(photo ? { photo } : {}) };
  }).filter(i => i.desc);
}
export function recalc(form) {
  const sub = readItems(form).reduce((a, i) => a + i.qty * i.price, 0);
  const d = +(form.querySelector('[name=discount]')?.value) || 0;
  const t = form.querySelector('[data-total]');
  if (t) t.textContent = brl(Math.max(0, sub - d));
}
ACT.recalc = (d, el) => recalc(el.closest('form'));
ACT.addItem = (d, el) => { const box = $('#' + d.target); box.insertAdjacentHTML('beforeend', rowHTML({}, !!box.dataset.photos)); };
const setPhoto = (row, src) => {
  $('.iph', row).value = src; const im = $('.iphp', row); im.hidden = !src; if (src) im.src = src; else im.removeAttribute('src');
  $('.iphl', row).textContent = src ? 'Trocar foto' : 'Foto do produto'; $('.iphx', row).hidden = !src;
};
ACT.itemPhoto = async (d, el) => { const f = el.files[0]; if (!f) return; setPhoto(el.closest('.it'), await compressImage(f, 640, 0.6)); el.value = ''; };
ACT.rmItemPhoto = (d, el) => setPhoto(el.closest('.it'), '');
ACT.rmItem = (d, el) => { const f = el.closest('form'); el.closest('.it').remove(); recalc(f); };
ACT.pickProduct = (d, el) => {
  const row = el.closest('.it'), o = el.selectedOptions[0];
  if (el.value) { $('.id', row).value = o.dataset.name; $('.iv', row).value = o.dataset.price; row.dataset.cost = o.dataset.cost; }
  else row.dataset.cost = 0;
  recalc(el.closest('form'));
};
export function kitSelect(kits) {
  return `<div class="f full"><label>Inserir kit pronto</label><select data-change="insertKit"><option value="">Escolha um kit…</option>${kits.map(k => `<option value="${k.id}">${esc(k.name)}</option>`).join('')}</select></div>`;
}
ACT.insertKit = (d, el) => {
  const k = get('kits', el.value); if (!k) return;
  const f = el.closest('form'), box = $('.items', f);
  if (!readItems(f).length) box.innerHTML = '';
  k.items.forEach(([q, desc, v]) => box.insertAdjacentHTML('beforeend', rowHTML({ desc, qty: +q || 1, price: +v || 0 }, !!box.dataset.photos)));
  el.value = ''; recalc(f);
};
