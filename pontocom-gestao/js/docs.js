/* Documentos impressos (PDF): orçamento e recibo, com a mesma identidade visual.
   Também guarda as ações do recibo (gerar PDF, WhatsApp, aviso ao dar baixa). */
import { get, put, nextNum, settings, DEFAULTS } from './store.js';
import { ACT, ic, esc, brl, pad, fmtDate, addDays, parse, printHTML, waLink, modal, toast } from './util.js';
import { total, itemsTotal, clientName } from './domain.js';

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
    <div><b>${esc(s.company)}</b><span>${esc(s.whats)}</span><span>${esc(s.city)}${s.doc ? ' – ' + esc(s.doc) : ''}</span></div></div>
  <div class="dx-title"><h1>${title}</h1><div class="dx-num">${num}</div></div></header>`;
const foot = s => `<footer class="dx-f"><span>${esc(s.company)}</span><span>${esc(s.whats)}</span><span>${esc(s.city)}</span></footer>`;
const cell = (label, value) => `<div><small>${label}</small><b>${value}</b></div>`;

/* ---------- orçamento ---------- */
export function quoteDoc(x) {
  const s = settings(), c = get('clients', x.clientId) || {}, t = total(x), sub = itemsTotal(x.items);
  const until = addDays(x.date, +x.validity || 0);
  const showTerms = s.terms && s.terms.trim() !== DEFAULTS.terms;
  return `<div class="dx">
  ${head('Orçamento', 'Nº ' + pad(x.num), s)}
  <div class="dx-strip">${cell('Emissão', fmtDate(x.date))}${cell('Válido até', fmtDate(until))}${cell('Situação', esc(x.status))}${cell('Itens', x.items.length)}</div>
  <div class="dx-grid">
    <div class="dx-card"><h4>Cliente</h4><b>${esc(c.name || '(sem cliente)')}</b>${c.phone ? `<span>${esc(c.phone)}</span>` : ''}${c.doc ? `<span>${esc(c.doc)}</span>` : ''}${c.address || c.city ? `<span>${esc([c.address, c.city].filter(Boolean).join(' – '))}</span>` : ''}</div>
    <div class="dx-card dx-hi"><h4>Investimento total</h4><div class="dx-big">${brl(t)}</div><span>${x.discount ? 'já com desconto de ' + brl(x.discount) : 'valor final da proposta'}</span></div>
  </div>
  <table class="dx-t"><thead><tr><th class="n">#</th><th>Descrição</th><th class="r">Qtd</th><th class="r">Unitário</th><th class="r">Subtotal</th></tr></thead>
    <tbody>${x.items.map((i, k) => `<tr><td class="n">${k + 1}</td><td>${esc(i.desc)}</td><td class="r">${i.qty}</td><td class="r">${brl(i.price)}</td><td class="r"><b>${brl(i.qty * i.price)}</b></td></tr>`).join('')}</tbody></table>
  <div class="dx-sum">
    <div><span>Subtotal</span><span>${brl(sub)}</span></div>
    ${x.discount ? `<div><span>Desconto</span><span>– ${brl(x.discount)}</span></div>` : ''}
    <div class="dx-tot"><span>Total</span><b>${brl(t)}</b></div>
  </div>
  <div class="dx-tiles">
    <div><b>${+x.validity || 0} dias</b><span>de validade da proposta</span></div>
    <div><b>${+s.warrantyEquip || 0} meses</b><span>de garantia nos equipamentos</span></div>
    <div><b>${+s.warrantyLabor || 0} meses</b><span>de garantia na mão de obra</span></div>
  </div>
  ${showTerms ? `<div class="dx-note"><b>Condições</b>${esc(s.terms).replace(/\n/g, '<br>')}</div>` : ''}
  ${x.notes ? `<div class="dx-note"><b>Observações</b>${esc(x.notes).replace(/\n/g, '<br>')}</div>` : ''}
  <div class="dx-sign"><div>${esc(s.company)}</div><div>${esc(c.name || 'Cliente')}<small>Aceito em ____/____/________</small></div></div>
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

export const receiptButtons = f => `<button type="button" class="btn ghost" data-act="printReceipt" data-id="${f.id}">${ic('print')} Recibo (PDF)</button><button type="button" class="btn ok" data-act="waReceipt" data-id="${f.id}">${ic('chat')} Enviar recibo</button>`;
/* botões na tela da OS: receber o pagamento ou emitir o recibo */
export const osPayButtons = f => !f ? '' : `<div class="btns">${f.paid ? receiptButtons(f) : `<button type="button" class="btn ok" data-act="pay" data-id="${f.id}">${ic('check')} Receber pagamento</button>`}</div>`;
