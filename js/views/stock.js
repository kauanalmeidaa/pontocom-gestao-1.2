import { DB, get, put, del } from '../store.js';
import { $, ACT, ic, esc, brl, fmtDate, today, addDays, meta, badge, F, readForm, modal, closeModal, toast, app } from '../util.js';
import { stockLow, addMove, osRow } from '../domain.js';

let q = '', onlyLow = false;

export function render(root) {
  const low = stockLow();
  const val = DB.products.reduce((a, p) => a + (p.stock || 0) * (p.cost || 0), 0);
  root.innerHTML = `<div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
      <div class="kpi"><div class="k"><span class="led info"></span>Produtos</div><b>${DB.products.length}</b></div>
      <div class="kpi link" data-act="toggleLow"><div class="k"><span class="led ${low.length ? 'bad' : 'ok'}"></span>Estoque baixo</div><b>${low.length}</b><small>toque para filtrar</small></div>
      <div class="kpi"><div class="k"><span class="led ok"></span>Valor em estoque</div><b>${brl(val)}</b><small>a preço de custo</small></div></div>
    <div class="toolbar"><div class="search">${ic('search')}<input placeholder="Buscar produto ou código" value="${esc(q)}" data-input="stockSearch"></div>
      <button class="btn" data-act="newProduct">${ic('plus')} Novo produto</button></div>
    ${onlyLow ? `<div class="chips"><button class="chip on" data-act="toggleLow">Mostrando só estoque baixo</button></div>` : ''}
    <div class="card" id="plist"></div>`;
  list();
}
function list() {
  const k = q.toLowerCase();
  const l = DB.products.filter(p => (!onlyLow || stockLow().includes(p)) && (!k || (p.name + ' ' + (p.sku || '')).toLowerCase().includes(k))).sort((a, b) => a.name.localeCompare(b.name));
  $('#plist').innerHTML = l.length ? l.map(p => { const lw = p.min > 0 && (p.stock || 0) <= p.min;
    return `<div class="li ${lw ? 'low' : ''}" data-act="openProduct" data-id="${p.id}"><div class="av">${ic('box')}</div><div class="lt"><b>${esc(p.name)}</b>${meta(esc(p.sku), 'custo ' + brl(p.cost), 'venda ' + brl(p.price))}</div><div class="rt"><span class="v">${p.stock || 0} ${esc(p.unit || 'un')}</span>${lw ? badge('Estoque baixo', 'bad') : ''}</div></div>`; }).join('')
    : `<div class="empty"><b>${DB.products.length ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}</b>${DB.products.length ? '' : 'Cadastre câmeras, centrais, motores, cabos e o que você usa nas instalações.'}</div>`;
}
ACT.stockSearch = (d, el) => { q = el.value; list(); };
ACT.toggleLow = () => { onlyLow = !onlyLow; app.refresh(); };

function productForm(id) {
  const p = get('products', id) || {};
  modal(id ? 'Editar produto' : 'Novo produto', `<form data-submit="saveProduct" data-id="${id || ''}"><div class="fg">
    ${F('name', 'Nome do produto', p.name, { req: true, full: true })}
    ${F('sku', 'Código / referência', p.sku)}${F('unit', 'Unidade', p.unit || 'un', { ph: 'un, m, rolo…' })}
    ${F('cost', 'Preço de custo (R$)', p.cost ?? '', { type: 'money' })}${F('price', 'Preço de venda (R$)', p.price ?? '', { type: 'money' })}
    ${id ? '' : F('stock', 'Quantidade em estoque agora', p.stock ?? '', { type: 'number', step: 'any' })}${F('min', 'Avisar quando chegar em (mínimo)', p.min ?? '', { type: 'number', step: 'any' })}</div>
    <div class="btns"><button class="btn">Salvar produto</button></div></form>`);
}
ACT.newProduct = () => productForm();
ACT.editProduct = d => productForm(d.id);
ACT.saveProduct = async (d, f) => {
  const v = readForm(f), old = get('products', d.id);
  const o = { ...(old || { stock: 0 }), ...v };
  if (!old) o.stock = +v.stock || 0;
  await put('products', o); closeModal(); app.refresh(); toast('Produto salvo');
};
ACT.deleteProduct = async d => {
  if (!confirm('Excluir este produto? O histórico de movimentações também some.')) return;
  for (const m of DB.moves.filter(m => m.pid === d.id)) await del('moves', m.id);
  await del('products', d.id); closeModal(); app.refresh(); toast('Produto excluído');
};

ACT.openProduct = d => {
  const p = get('products', d.id), mv = DB.moves.filter(m => m.pid === p.id).sort((a, b) => (b.date || '').localeCompare(a.date || '') || 0).slice(0, 12);
  modal(p.name, `
    <div class="kpis" style="grid-template-columns:repeat(3,1fr)"><div class="kpi"><div class="k">Em estoque</div><b>${p.stock || 0}</b><small>${esc(p.unit || 'un')}</small></div><div class="kpi"><div class="k">Custo</div><b>${brl(p.cost)}</b></div><div class="kpi"><div class="k">Venda</div><b>${brl(p.price)}</b></div></div>
    <div class="btns" style="margin-top:0"><button class="btn" data-act="entry" data-id="${p.id}">${ic('plus')} Entrada de estoque</button><button class="btn ghost" data-act="adjust" data-id="${p.id}">Ajustar quantidade</button><button class="btn ghost" data-act="editProduct" data-id="${p.id}">${ic('edit')} Editar</button></div>
    <div class="sub">Últimas movimentações</div>
    ${mv.length ? `<table class="t"><tbody>${mv.map(m => `<tr><td>${fmtDate(m.date)}</td><td>${m.type === 'entrada' ? 'Entrada' : m.type === 'saida' ? 'Saída' : 'Ajuste'}${m.note ? ' – ' + esc(m.note) : ''}</td><td class="r"><b>${m.qty > 0 ? '+' : ''}${m.qty}</b></td></tr>`).join('')}</tbody></table>` : '<p class="hint">Nenhuma movimentação ainda. As saídas acontecem sozinhas quando você conclui uma OS com este produto.</p>'}
    <div class="btns"><button class="btn danger" data-act="deleteProduct" data-id="${p.id}">${ic('trash')} Excluir produto</button></div>`);
};

ACT.entry = d => {
  const p = get('products', d.id);
  modal('Entrada – ' + p.name, `<form data-submit="saveEntry" data-id="${p.id}"><div class="fg">
    ${F('qty', 'Quantidade que chegou', '', { type: 'number', step: 'any', req: true })}${F('cost', 'Custo unitário (R$)', p.cost ?? '', { type: 'money' })}
    ${F('supplier', 'Fornecedor / observação', '', { full: true })}
    <div class="f full"><label class="chk"><input type="checkbox" name="payable" checked><span>Lançar em Contas a pagar</span></label></div>
    ${F('due', 'Vencimento do pagamento', addDays(today(), 7), { type: 'date' })}</div>
    <div class="btns"><button class="btn">Registrar entrada</button></div></form>`);
};
ACT.saveEntry = async (d, f) => {
  const v = readForm(f), p = get('products', d.id); if (!(v.qty > 0)) return toast('Informe a quantidade');
  if (v.cost > 0) { p.cost = v.cost; await put('products', p); }
  await addMove(p.id, 'entrada', v.qty, { note: v.supplier || 'Compra' });
  if (v.payable && v.cost > 0) await put('finance', { type: 'pagar', desc: `Compra: ${p.name} (${v.qty} ${p.unit || 'un'})${v.supplier ? ' – ' + v.supplier : ''}`, value: v.qty * v.cost, due: v.due, paid: false, category: 'Compras' });
  closeModal(); app.refresh(); toast('Entrada registrada');
};
ACT.adjust = d => {
  const p = get('products', d.id);
  modal('Ajustar – ' + p.name, `<form data-submit="saveAdjust" data-id="${p.id}"><div class="fg">
    ${F('real', 'Quantidade real em estoque', p.stock || 0, { type: 'number', step: 'any', req: true })}${F('why', 'Motivo (contagem, perda, devolução…)', '')}</div>
    <div class="btns"><button class="btn">Ajustar</button></div></form>`);
};
ACT.saveAdjust = async (d, f) => {
  const v = readForm(f), p = get('products', d.id), diff = v.real - (p.stock || 0);
  if (diff !== 0) await addMove(p.id, 'ajuste', diff, { note: v.why || 'Ajuste de contagem' });
  closeModal(); app.refresh(); toast('Estoque ajustado');
};
