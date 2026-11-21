import { DB, get, put, del, nextNum, settings } from '../store.js';
import { $, ACT, ic, esc, brl, fmtDate, today, addDays, pad, F, readForm, modal, closeModal, toast, waLink, printHTML, printHeader, app } from '../util.js';
import { Q_ST, PAY_METHODS, clientOpts, clientName, total, itemsTotal, quoteRow } from '../domain.js';
import { itemsEditor, readItems, recalc, kitSelect } from '../items.js';
import { quoteDoc, docTexts, defaultTexts } from '../docs.js';

let filter = 'Todos', q = '';

export function render(root) {
  const cnt = s => s === 'Todos' ? DB.quotes.length : DB.quotes.filter(x => x.status === s).length;
  root.innerHTML = `<div class="toolbar"><div class="search">${ic('search')}<input placeholder="Buscar por cliente ou número" value="${esc(q)}" data-input="quoteSearch"></div>
    <button class="btn" data-act="newQuote">${ic('plus')} Novo orçamento</button></div>
    <div class="chips">${['Todos', ...Q_ST].map(s => `<button class="chip ${filter === s ? 'on' : ''}" data-act="quoteFilter" data-v="${s}">${s}<b>${cnt(s)}</b></button>`).join('')}</div>
    <div class="card" id="qlist"></div>`;
  list();
}
function list() {
  const k = q.toLowerCase();
  const l = DB.quotes.filter(x => (filter === 'Todos' || x.status === filter) && (!k || (clientName(x.clientId) + pad(x.num)).toLowerCase().includes(k))).sort((a, b) => b.num - a.num);
  $('#qlist').innerHTML = l.length ? l.map(quoteRow).join('') : `<div class="empty"><b>Nenhum orçamento aqui</b>Toque em “Novo orçamento” para criar o primeiro.</div>`;
}
ACT.quoteSearch = (d, el) => { q = el.value; list(); };
ACT.quoteFilter = d => { filter = d.v; app.refresh(); };

export function quoteForm(id, pre = {}) {
  const s = settings();
  const x = get('quotes', id) || { items: [], discount: 0, status: 'Pendente', date: today(), validity: s.validity, ...defaultTexts(s), ...pre }, tx = docTexts(x, s);
  modal(id ? `Orçamento ${pad(x.num)}` : 'Novo orçamento', `<form data-submit="saveQuote" data-id="${id || ''}">
    <div class="fg">
      ${F('clientId', 'Cliente', x.clientId, { type: 'select', opts: clientOpts(), req: true, full: true })}
      ${F('date', 'Data', x.date, { type: 'date' })}${F('validity', 'Validade (dias)', x.validity, { type: 'number', step: '1' })}
      ${kitSelect(DB.kits)}
    </div>
    <div class="sub">Itens</div>
    ${itemsEditor(x.items, 'items', true)}
    <div class="fg" style="margin-top:8px">${F('discount', 'Desconto (R$)', x.discount || '', { type: 'money', attrs: 'data-input="recalc"' })}<div class="f"><label>Total</label><div class="total" data-total></div></div>
      ${F('status', 'Situação', x.status, { type: 'select', opts: Q_ST })}
      <div class="f full"><label>Formas de pagamento aceitas</label><div class="perms">${PAY_METHODS.map((m, i) => `<label class="chk"><input type="checkbox" name="pm${i}" ${(x.payMethods ?? s.defPay ?? []).includes(m) ? 'checked' : ''}><span>${esc(m)}</span></label>`).join('')}</div></div>
      ${F('payNote', 'Condições de pagamento (opcional)', x.payNote || '', { type: 'textarea', rows: 2, full: true, ph: 'Ex.: 50% de entrada e o restante na entrega' })}
      ${F('notes', 'Observações', tx.notes, { type: 'textarea', rows: 3, full: true })}
      ${F('warrantyText', 'Condições de garantia', tx.warrantyText, { type: 'textarea', rows: 4, full: true })}
      ${F('contractText', 'Condições contratuais', tx.contractText, { type: 'textarea', rows: 5, full: true })}</div>
    <div class="btns"><button class="btn">Salvar orçamento</button></div>
    ${id ? `<div class="btns"><button type="button" class="btn ghost" data-act="printQuote" data-id="${id}">${ic('print')} PDF / imprimir</button><button type="button" class="btn ok" data-act="waQuote" data-id="${id}">${ic('wa')} Enviar no WhatsApp</button>
      ${x.osId ? '' : `<button type="button" class="btn ghost" data-act="quoteToOS" data-id="${id}">${ic('clip')} Virar OS</button>`}<button type="button" class="btn danger" data-act="deleteQuote" data-id="${id}">${ic('trash')} Excluir</button></div>` : ''}
  </form>`, { wide: true });
  recalc($('#modal form'));
}
ACT.newQuote = d => quoteForm('', { ...d });
ACT.openQuote = d => quoteForm(d.id);
ACT.saveQuote = async (d, f) => {
  const v = readForm(f), items = readItems(f);
  if (!items.length) return toast('Adicione pelo menos um item');
  const o = { ...(get('quotes', d.id) || {}), clientId: v.clientId, date: v.date, validity: v.validity, discount: v.discount, status: v.status, notes: v.notes, warrantyText: v.warrantyText, contractText: v.contractText, payMethods: PAY_METHODS.filter((m, i) => v['pm' + i]), payNote: v.payNote, items };
  if (!d.id) o.num = await nextNum('quotes');
  const y = $('#modal .m-b')?.scrollTop || 0;
  await put('quotes', o); app.refresh(); quoteForm(o.id); toast('Orçamento salvo');   // a janela continua aberta (já com os botões de PDF e WhatsApp)
  const mb = $('#modal .m-b'); if (mb) mb.scrollTop = y;
};
ACT.deleteQuote = async d => { if (!confirm('Excluir este orçamento?')) return; await del('quotes', d.id); closeModal(); app.refresh(); toast('Orçamento excluído'); };
ACT.quoteToOS = d => {
  const x = get('quotes', d.id); closeModal();
  ACT.newOS({ clientId: x.clientId, items: x.items, discount: x.discount, quoteId: x.id, desc: x.notes || '', warrantyText: x.warrantyText, contractText: x.contractText });
};

function text(x) {
  const s = settings();
  return `*Orçamento ${pad(x.num)} – ${s.company}*\nCliente: ${clientName(x.clientId)}\nData: ${fmtDate(x.date)}\n\n` +
    x.items.map(i => `• ${i.qty}x ${i.desc} – ${brl(i.qty * i.price)}`).join('\n') +
    `\n\n${x.discount ? `Desconto: ${brl(x.discount)}\n` : ''}*Total: ${brl(total(x))}*\nValidade: ${x.validity} dias\n${(x.payMethods || []).length ? 'Formas de pagamento: ' + x.payMethods.join(', ') + '\n' : ''}${(x.payNote || '').trim() ? x.payNote + '\n' : ''}${docTexts(x, s).warrantyText}${docTexts(x, s).notes ? '\n\n' + docTexts(x, s).notes : ''}\n\n${s.company} – ${s.whats}`;
}
ACT.waQuote = d => { const x = get('quotes', d.id); window.open(waLink(get('clients', x.clientId)?.phone, text(x)), '_blank'); };
ACT.printQuote = d => printHTML(quoteDoc(get('quotes', d.id)));
