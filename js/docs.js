/* Documentos impressos (PDF): orçamento e recibo, com a mesma identidade visual.
   Também guarda as ações do recibo (gerar PDF, WhatsApp, aviso ao dar baixa). */
import { get, put, nextNum, settings } from './store.js';
import { ACT, ic, esc, brl, pad, fmtDate, addDays, parse, printHTML, waLink, modal, toast } from './util.js';
import { total, itemsTotal, clientName, userName } from './domain.js';

/* ---------- valor por extenso ---------- */
const U = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const D = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const C = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
function ate999(n) {
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100), r = n % 100, p = [];
  if (c) p.push(C[c]);
  if (r) p.push(r < 20 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' e ' + U[r % 10] : ''));
  return p.join(' e ');
}
function inteiro(n) {
  if (n === 0) return 'zero';
  const g = [[Math.floor(n / 1e9) % 1000, ' bilhão', ' bilhões'], [Math.floor(n / 1e6) % 1000, ' milhão', ' milhões'], [Math.floor(n / 1e3) % 1000, ' mil', ' mil'], [n % 1000, '', '']].filter(x => x[0]);
  return g.map(([v, s, p], i) => {
    const txt = (v === 1 && s === ' mil') ? 'mil' : ate999(v) + (v === 1 ? s : p);
    return i === 0 ? txt : ((v < 100 || v % 100 === 0) ? ' e ' : ', ') + txt;
  }).join('');
}
export function extenso(valor) {
  const c = Math.round((+valor || 0) * 100), r = Math.floor(c / 100), cent = c % 100;
  let s = '';
  if (r) s = inteiro(r) + (r >= 1e6 && r % 1e6 === 0 ? ' de' : '') + (r === 1 ? ' real' : ' reais');
  if (cent) s += (r ? ' e ' : '') + inteiro(cent) + (cent === 1 ? ' centavo' : ' centavos');
  s = s || 'zero real';
  return s[0].toUpperCase() + s.slice(1);
}
/* "OS 0006 – Câmeras de segurança" em vez de repetir o nome do cliente */
const refText = f => { const o = f.osId ? get('os', f.osId) : null; return o ? `OS ${pad(o.num)} – ${o.type}` : f.desc; };
const longDate = d => parse(d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

/* ---------- peças comuns ---------- */
const head = (title, num, s) => `<header class="dx-h">
  <svg class="dx-sig" viewBox="0 0 200 200" preserveAspectRatio="xMaxYMin slice" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2"><circle cx="200" cy="0" r="42"/><circle cx="200" cy="0" r="84"/><circle cx="200" cy="0" r="126"/><circle cx="200" cy="0" r="168"/></g></svg>
  <div class="dx-brand">${s.logo ? `<img src="${s.logo}" alt="">` : `<div class="dx-mono">${esc((s.company || 'P').trim()[0].toUpperCase())}</div>`}
    <div>${s.logo && !s.logo.startsWith('data:') ? '' : `<b>${esc(s.company)}</b>`}<span class="nw">${esc(s.whats)}</span>${s.city ? `<span class="nw">${esc(s.city)}</span>` : ''}${s.doc ? `<span class="nw">${esc(s.doc)}</span>` : ''}</div></div>
  <div class="dx-title"><h1>${title}</h1><div class="dx-num">${num}</div></div></header>`;
const foot = s => `<footer class="dx-f"><span class="nw">${esc(s.company)}</span><span class="nw">${esc(s.whats)}</span><span class="nw">${esc(s.city)}</span></footer>`;
const cell = (label, value) => `<div><small>${label}</small><b>${value}</b></div>`;

/* ---------- textos do documento: observações, garantia, condições contratuais ---------- */
/* Cada orçamento/OS guarda o seu texto. Documentos antigos (sem o campo) usam o texto padrão dos Ajustes. */
export const docTexts = (x, s = settings()) => ({
  notes: x.notes ?? s.defNotes ?? '',
  warrantyText: x.warrantyText ?? s.terms ?? '',
  contractText: x.contractText ?? s.contractTerms ?? ''
});
export const defaultTexts = (s = settings()) => ({ notes: s.defNotes || '', warrantyText: s.terms || '', contractText: s.contractTerms || '' });
const nl = v => esc(v).replace(/\n/g, '<br>');
const textBlocks = (x, s) => { const t = docTexts(x, s);
  return [['Observações', t.notes], ['Condições de garantia', t.warrantyText], ['Condições contratuais', t.contractText]]
    .filter(([, v]) => (v || '').trim()).map(([h, v]) => `<div class="dx-note"><b>${h}</b>${nl(v)}</div>`).join(''); };

/* ---------- peças compartilhadas por orçamento e OS ---------- */
const clientCard = c => `<div class="dx-card"><h4>Cliente</h4><b>${esc(c.name || '(sem cliente)')}</b>${c.phone ? `<span class="nw">${esc(c.phone)}</span>` : ''}${c.doc ? `<span class="nw">${esc(c.doc)}</span>` : ''}${c.address || c.city ? `<span>${esc([c.address, c.city].filter(Boolean).join(' – '))}</span>` : ''}</div>`;
const itemsTable = items => `<table class="dx-t"><thead><tr><th class="n">#</th><th>Descrição</th><th class="r">Qtd</th><th class="r">Unitário</th><th class="r">Subtotal</th></tr></thead>
  <tbody>${items.map((i, k) => `<tr><td class="n">${k + 1}</td><td>${i.photo ? `<img class="dx-img" src="${i.photo}" alt="">` : ''}<span class="dx-d">${esc(i.desc)}</span></td><td class="r">${i.qty}</td><td class="r">${brl(i.price)}</td><td class="r"><b>${brl(i.qty * i.price)}</b></td></tr>`).join('')}</tbody></table>`;
const sumBlock = x => `<div class="dx-sum">
  <div><span>Subtotal dos itens</span><span>${brl(itemsTotal(x.items))}</span></div>
  ${x.discount ? `<div><span>Desconto</span><span>– ${brl(x.discount)}</span></div>` : ''}
  <div class="dx-tot"><span>Total</span><b>${brl(total(x))}</b></div></div>`;
const payBlock = x => ((x.payMethods || []).length || (x.payNote || '').trim()) ? `<div class="dx-note"><b>Formas de pagamento</b>${(x.payMethods || []).length ? `<div class="dx-pay">${x.payMethods.map(m => `<span>${esc(m)}</span>`).join('')}</div>` : ''}${(x.payNote || '').trim() ? nl(x.payNote) : ''}</div>` : '';

/* ---------- orçamento ---------- */
export function quoteDoc(x) {
  const s = settings(), c = get('clients', x.clientId) || {}, until = addDays(x.date, +x.validity || 0);
  return `<div class="dx">
  ${head('Orçamento', 'Nº ' + pad(x.num), s)}
  <div class="dx-strip">${cell('Emissão', fmtDate(x.date))}${cell('Válido até', fmtDate(until))}${cell('Situação', esc(x.status))}${cell('Itens', x.items.length)}</div>
  <div class="dx-grid">${clientCard(c)}</div>
  ${itemsTable(x.items)}
  ${sumBlock(x)}
  ${payBlock(x)}
  ${textBlocks(x, s)}
  <div class="dx-sign"><div>${esc(s.company)}</div><div>${esc(c.name || 'Cliente')}<small>Aceito em ____/____/________</small></div></div>
  ${foot(s)}</div>`;
}

/* ---------- ordem de serviço (mesmo layout do orçamento) ---------- */
export function osDoc(o) {
  const s = settings(), c = get('clients', o.clientId) || {}, items = o.items || [], ph = [...(o.before || []).map(x => [x, 'Antes']), ...(o.after || []).map(x => [x, 'Depois'])];
  return `<div class="dx">
  ${head('Ordem de serviço', 'Nº ' + pad(o.num), s)}
  <div class="dx-strip">${cell('Data', fmtDate(o.date) + (o.time ? ' ' + esc(o.time) : ''))}${cell('Serviço', esc(o.type))}${cell('Situação', esc(o.status))}${cell('Técnico', esc(o.techId ? userName(o.techId) : '–'))}</div>
  <div class="dx-grid">${clientCard(c)}</div>
  ${o.desc ? `<div class="dx-note"><b>Descrição do serviço</b>${nl(o.desc)}</div>` : ''}
  ${(o.checklist || []).length ? `<div class="dx-note dx-chk"><b>Etapas do serviço</b>${o.checklist.map(x => `<span>${x.done ? '☑' : '☐'} ${esc(x.t)}</span>`).join('')}</div>` : ''}
  ${items.length ? itemsTable(items) + sumBlock({ items, discount: o.discount }) : ''}
  ${ph.length ? `<div class="dx-note dx-ph-h"><b>Registro fotográfico</b></div><div class="dx-ph">${ph.map(([x, l]) => `<figure><img src="${x}" alt=""><figcaption>${l}</figcaption></figure>`).join('')}</div>` : ''}
  ${textBlocks(o, s)}
  <div class="dx-sign"><div>${esc(s.company)}</div><div>${o.signature ? `<img class="dx-sigimg" src="${o.signature}" alt="">` : ''}${esc(o.signedBy || c.name || 'Cliente')}<small>Assinatura do cliente</small></div></div>
  ${foot(s)}</div>`;
}

/* ---------- recibo ---------- */
export function receiptDoc(f) {
  const s = settings(), c = get('clients', f.clientId) || {}, o = f.osId ? get('os', f.osId) : null;
  const when = f.paidDate || new Date().toISOString().slice(0, 10);
  const ref = refText(f);
  return `<div class="dx">
  ${head('Recibo', 'Nº ' + pad(f.receiptNum), s)}
  <div class="dx-amount"><div><h4>Valor recebido</h4><div class="dx-big">${brl(f.value)}</div><p class="dx-ext">${esc(extenso(f.value))}</p></div><div class="dx-stamp">PAGO</div></div>
  <p class="dx-body">Recebemos de <b>${esc(c.name || 'cliente não informado')}</b>${c.doc ? `, documento ${esc(c.doc)}` : ''}, a importância de <b>${brl(f.value)}</b> (${esc(extenso(f.value).toLowerCase())}), referente a <b>${esc(ref)}</b>, dando plena quitação deste valor.</p>
  <div class="dx-strip">${cell('Forma de pagamento', esc(f.method || 'Não informada'))}${cell('Data do pagamento', fmtDate(when))}${cell('Ordem de serviço', o ? pad(o.num) : '–')}${cell('Serviço', esc(o ? o.type : (f.category || '–')))}</div>
  <p class="dx-local">${esc((s.city || '').split('-')[0].trim() || 'Local')}, ${longDate(when)}.</p>
  <div class="dx-sign one"><div>${esc(s.company)}${s.doc ? `<small>${esc(s.doc)}</small>` : ''}</div></div>
  ${foot(s)}</div>`;
}

/* ---------- ações do recibo ---------- */
async function ensureNumber(f) {
  if (!f.receiptNum) { f.receiptNum = await nextNum('receipt'); await put('finance', f); }
  return f;
}
ACT.printReceipt = async d => { const f = await ensureNumber(get('finance', d.id)); printHTML(receiptDoc(f)); };
ACT.waReceipt = async d => {
  const f = await ensureNumber(get('finance', d.id)), s = settings(), c = get('clients', f.clientId) || {};
  const msg = `*Recibo Nº ${pad(f.receiptNum)} – ${s.company}*\nRecebemos de ${c.name || 'cliente'} o valor de *${brl(f.value)}* (${extenso(f.value).toLowerCase()}), referente a ${refText(f)}.\nForma de pagamento: ${f.method || 'não informada'} em ${fmtDate(f.paidDate)}.\n\nObrigado pela confiança!\n${s.company} – ${s.whats}`;
  window.open(waLink(c.phone, msg), '_blank');
};
ACT.receiptPrompt = d => {
  const f = get('finance', d.id); if (!f) return;
  modal('Pagamento registrado', `<p style="margin-bottom:4px"><b>${brl(f.value)}</b> recebido${f.clientId ? ' de ' + esc(clientName(f.clientId)) : ''}.</p>
    <p class="hint" style="margin:0 0 4px">${esc(f.desc)}</p>
    <div class="btns">${receiptButtons(f)}<button type="button" class="btn ghost" data-act="closeModal">Agora não</button></div>
    <p class="hint">O WhatsApp abre com a mensagem pronta. Para mandar o PDF, use “Recibo (PDF)”, escolha salvar como PDF e anexe na conversa.</p>`);
};

export const receiptButtons = f => `<button type="button" class="btn ghost" data-act="printReceipt" data-id="${f.id}">${ic('print')} Recibo (PDF)</button><button type="button" class="btn ok" data-act="waReceipt" data-id="${f.id}">${ic('wa')} Enviar recibo</button>`;
/* botões na tela da OS: receber o pagamento ou emitir o recibo */
export const osPayButtons = f => !f ? '' : `<div class="btns">${f.paid ? receiptButtons(f) : `<button type="button" class="btn ok" data-act="pay" data-id="${f.id}">${ic('check')} Receber pagamento</button>`}</div>`;
