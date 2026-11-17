import { DB, get, put, del } from '../store.js';
import { $, ACT, ic, esc, brl, fmtDate, today, addMonths, lastMonths, monthLabel, barChart, meta, badge, F, readForm, modal, closeModal, toast, app, daysBetween } from '../util.js';
import { clientOpts, clientName, sum } from '../domain.js';
import { receiptButtons } from '../docs.js';

let tab = 'receber', flt = 'pendentes';
const METHODS = ['PIX', 'Dinheiro', 'Cartão', 'Boleto', 'Transferência'];

export function render(root) {
  const t = today(), all = DB.finance.filter(f => tab === 'fluxo' || f.type === tab);
  const pend = DB.finance.filter(f => !f.paid);
  const rec = pend.filter(f => f.type === 'receber'), pay = pend.filter(f => f.type === 'pagar');
  const late = rec.filter(f => f.due < t);
  const month = t.slice(0, 7);
  const inMonth = DB.finance.filter(f => f.paid && (f.paidDate || '').slice(0, 7) === month);
  root.innerHTML = `<div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
      <div class="kpi"><div class="k"><span class="led info"></span>A receber</div><b>${brl(sum(rec))}</b><small>${rec.length} lançamento(s)</small></div>
      <div class="kpi"><div class="k"><span class="led ${late.length ? 'bad' : 'ok'}"></span>Em atraso</div><b>${brl(sum(late))}</b><small>${late.length} cobrança(s)</small></div>
      <div class="kpi"><div class="k"><span class="led warn"></span>A pagar</div><b>${brl(sum(pay))}</b><small>${pay.length} conta(s)</small></div>
      <div class="kpi"><div class="k"><span class="led ok"></span>Saldo do mês</div><b>${brl(sum(inMonth.filter(f => f.type === 'receber')) - sum(inMonth.filter(f => f.type === 'pagar')))}</b><small>recebido menos pago</small></div></div>
    <div class="toolbar"><div class="chips" style="margin:0;flex:1">${[['receber', 'A receber'], ['pagar', 'A pagar'], ['fluxo', 'Fluxo de caixa']].map(([k, l]) => `<button class="chip ${tab === k ? 'on' : ''}" data-act="finTab" data-v="${k}">${l}</button>`).join('')}</div>
      <button class="btn" data-act="newFin">${ic('plus')} Novo lançamento</button></div>
    ${tab === 'fluxo' ? flow() : `<div class="chips">${[['pendentes', 'Pendentes'], ['atrasados', 'Atrasados'], ['pagos', 'Pagos'], ['todos', 'Todos']].map(([k, l]) => `<button class="chip ${flt === k ? 'on' : ''}" data-act="finFlt" data-v="${k}">${l}</button>`).join('')}</div><div class="card" id="flist">${rows(all)}</div>`}`;
}
function rows(all) {
  const t = today();
  const l = all.filter(f => flt === 'todos' || (flt === 'pendentes' && !f.paid) || (flt === 'pagos' && f.paid) || (flt === 'atrasados' && !f.paid && f.due < t))
    .sort((a, b) => flt === 'pagos' ? (b.paidDate || '').localeCompare(a.paidDate || '') : (a.due || '').localeCompare(b.due || ''));
  if (!l.length) return `<div class="empty"><b>Nada por aqui</b>${tab === 'receber' ? 'As cobranças das OS concluídas aparecem sozinhas nesta lista.' : 'Lance contas como aluguel, combustível e compras.'}</div>`;
  return l.map(f => {
    const late = !f.paid && f.due < t, d = daysBetween(t, f.due);
    return `<div class="li" data-act="openFin" data-id="${f.id}"><div class="av">${ic('money')}</div><div class="lt"><b>${esc(f.desc)}</b>${meta(f.clientId ? esc(clientName(f.clientId)) : '', f.paid ? 'pago em ' + fmtDate(f.paidDate) + (f.method ? ' (' + esc(f.method) + ')' : '') : 'vence ' + fmtDate(f.due), esc(f.category))}</div>
      <div class="rt"><span class="v">${brl(f.value)}</span>${f.paid ? badge('Pago', 'ok') : late ? badge('Atrasado ' + (-d) + 'd', 'bad') : d <= 3 ? badge('Vence em breve', 'warn') : badge('Pendente', 'info')}</div></div>`;
  }).join('');
}
function flow() {
  const months = lastMonths(6), ahead = [1, 2].map(n => addMonths(today().slice(0, 8) + '01', n).slice(0, 7));
  const ms = [...months, ...ahead], cur = today().slice(0, 7);
  const val = (type, m) => sum(DB.finance.filter(f => f.type === type && (f.paid ? (f.paidDate || '').slice(0, 7) : (f.due || '').slice(0, 7)) === m));
  const ins = ms.map(m => val('receber', m)), outs = ms.map(m => val('pagar', m));
  return `<div class="card"><h3>Fluxo de caixa<small>meses futuros mostram o que está previsto</small></h3>${barChart(ms.map(monthLabel), [{ name: 'Entradas', color: 'var(--brand)', values: ins, faded: ms.map(m => m > cur) }, { name: 'Saídas', color: '#64748b', values: outs, faded: ms.map(m => m > cur) }])}
    <div class="scroll-x" style="margin-top:12px"><table class="t"><thead><tr><th>Mês</th><th class="r">Entradas</th><th class="r">Saídas</th><th class="r">Resultado</th></tr></thead><tbody>${ms.map((m, i) => `<tr><td>${monthLabel(m)}${m > cur ? ' (previsto)' : ''}</td><td class="r">${brl(ins[i])}</td><td class="r">${brl(outs[i])}</td><td class="r"><b>${brl(ins[i] - outs[i])}</b></td></tr>`).join('')}</tbody></table></div></div>`;
}
ACT.finTab = d => { tab = d.v; app.refresh(); };
ACT.finFlt = d => { flt = d.v; app.refresh(); };

function form(id, pre = {}) {
  const f = get('finance', id) || { type: tab === 'pagar' ? 'pagar' : 'receber', due: today(), ...pre };
  modal(id ? 'Lançamento' : 'Novo lançamento', `<form data-submit="saveFin" data-id="${id || ''}"><div class="fg">
    ${F('type', 'Tipo', f.type, { type: 'select', opts: [['receber', 'A receber (entrada)'], ['pagar', 'A pagar (saída)']] })}${F('value', 'Valor (R$)', f.value ?? '', { type: 'money', req: true })}
    ${F('desc', 'Descrição', f.desc, { req: true, full: true })}
    ${F('due', 'Vencimento', f.due, { type: 'date' })}${F('category', 'Categoria', f.category || '', { ph: 'Serviços, Compras, Combustível…' })}
    ${F('clientId', 'Cliente (opcional)', f.clientId || '', { type: 'select', opts: clientOpts(), full: true })}</div>
    <div class="btns"><button class="btn">Salvar</button></div></form>
    ${id ? `<div class="btns">${f.paid ? `${f.type === 'receber' ? receiptButtons(f) : ''}<button class="btn ghost" data-act="unpay" data-id="${id}">Desfazer baixa</button>` : `<button class="btn ok" data-act="pay" data-id="${id}">${ic('check')} Dar baixa (pago)</button>`}<button class="btn danger" data-act="deleteFin" data-id="${id}">${ic('trash')} Excluir</button></div>` : ''}`);
}
ACT.newFin = () => form('');
ACT.openFin = d => form(d.id);
ACT.saveFin = async (d, f) => { const v = readForm(f); await put('finance', { ...(get('finance', d.id) || { paid: false }), ...v }); closeModal(); app.refresh(); toast('Lançamento salvo'); };
ACT.deleteFin = async d => { if (!confirm('Excluir este lançamento?')) return; await del('finance', d.id); closeModal(); app.refresh(); toast('Lançamento excluído'); };
ACT.pay = d => {
  const f = get('finance', d.id);
  modal('Dar baixa', `<form data-submit="savePay" data-id="${f.id}"><p style="margin-bottom:12px"><b>${esc(f.desc)}</b><br>${brl(f.value)}</p><div class="fg">${F('paidDate', 'Data do pagamento', today(), { type: 'date' })}${F('method', 'Forma de pagamento', 'PIX', { type: 'select', opts: METHODS })}</div><div class="btns"><button class="btn ok">Confirmar pagamento</button></div></form>`);
};
ACT.savePay = async (d, f) => { const v = readForm(f), x = get('finance', d.id); x.paid = true; x.paidDate = v.paidDate; x.method = v.method; await put('finance', x); closeModal(); app.refresh(); toast('Baixa registrada'); if (x.type === 'receber') ACT.receiptPrompt({ id: x.id }); };
ACT.unpay = async d => { const x = get('finance', d.id); x.paid = false; x.paidDate = ''; x.method = ''; await put('finance', x); closeModal(); app.refresh(); toast('Baixa desfeita'); };
