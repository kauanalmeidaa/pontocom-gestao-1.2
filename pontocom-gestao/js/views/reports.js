import { DB } from '../store.js';
import { ACT, ic, esc, brl, fmtDate, today, addMonths, lastMonths, monthLabel, barChart, F, toCSV, saveFile, app, pad } from '../util.js';
import { total, cost, clientName, userName, sum } from '../domain.js';

let P = 6;

export function render(root) {
  const start = addMonths(today().slice(0, 8) + '01', -(P - 1));
  const done = DB.os.filter(o => o.status === 'Concluída' && (o.date || '') >= start);
  const rev = done.reduce((a, o) => a + total(o), 0), cst = done.reduce((a, o) => a + cost(o), 0), mar = rev - cst;
  const months = lastMonths(Math.max(P, 3));
  const byM = months.map(m => done.filter(o => (o.date || '').slice(0, 7) === m).reduce((a, o) => a + total(o), 0));

  const byType = {}; done.forEach(o => { const x = byType[o.type] ||= { n: 0, rev: 0, cost: 0 }; x.n++; x.rev += total(o); x.cost += cost(o); });
  const typeRows = Object.entries(byType).sort((a, b) => b[1].rev - a[1].rev);
  const byClient = {}; done.forEach(o => { byClient[o.clientId] = (byClient[o.clientId] || 0) + total(o); });
  const topClients = Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const byProd = {}; done.forEach(o => (o.items || []).forEach(i => { if (i.pid) { const x = byProd[i.desc] ||= { q: 0, v: 0 }; x.q += i.qty; x.v += i.qty * i.price; } }));
  const topProd = Object.entries(byProd).sort((a, b) => b[1].v - a[1].v).slice(0, 5);
  const byTech = {}; done.forEach(o => { const n = userName(o.techId) || 'Sem técnico'; byTech[n] = (byTech[n] || 0) + 1; });
  const maxClient = topClients[0]?.[1] || 1;

  root.innerHTML = `<div class="toolbar"><div class="f" style="min-width:220px">${F('p', 'Período', P, { type: 'select', opts: [[1, 'Este mês'], [3, 'Últimos 3 meses'], [6, 'Últimos 6 meses'], [12, 'Últimos 12 meses']], attrs: 'data-change="repPeriod"' })}</div>
      <div style="flex:1"></div>
      <button class="btn ghost sm" data-act="exportCSV" data-v="finance">${ic('down')} Financeiro (CSV)</button><button class="btn ghost sm" data-act="exportCSV" data-v="os">${ic('down')} OS (CSV)</button><button class="btn ghost sm" data-act="exportCSV" data-v="clients">${ic('down')} Clientes (CSV)</button></div>
    <div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
      <div class="kpi"><div class="k"><span class="led ok"></span>Faturamento</div><b>${brl(rev)}</b><small>${done.length} OS concluídas</small></div>
      <div class="kpi"><div class="k"><span class="led warn"></span>Custo de materiais</div><b>${brl(cst)}</b></div>
      <div class="kpi"><div class="k"><span class="led info"></span>Margem</div><b>${brl(mar)}</b><small>${rev ? Math.round(mar / rev * 100) : 0}% do faturamento</small></div>
      <div class="kpi"><div class="k"><span class="led info"></span>Ticket médio</div><b>${brl(done.length ? rev / done.length : 0)}</b><small>por OS</small></div></div>
    <div class="card"><h3>Faturamento por mês<small>OS concluídas</small></h3>${barChart(months.map(monthLabel), [{ name: 'Faturamento', color: 'var(--brand)', values: byM }])}</div>
    <div class="cols c2e" style="margin-top:12px">
      <div class="card"><h3>Serviços mais vendidos e margem</h3>${typeRows.length ? `<div class="scroll-x"><table class="t"><thead><tr><th>Serviço</th><th class="r">Qtd</th><th class="r">Faturado</th><th class="r">Margem</th></tr></thead><tbody>${typeRows.map(([t, x]) => `<tr><td>${esc(t)}</td><td class="r">${x.n}</td><td class="r">${brl(x.rev)}</td><td class="r"><b>${x.rev ? Math.round((x.rev - x.cost) / x.rev * 100) : 0}%</b></td></tr>`).join('')}</tbody></table></div><p class="hint">A margem considera só o custo dos produtos cadastrados no estoque. Mão de obra entra como lucro.</p>` : '<div class="empty">Sem OS concluídas no período.</div>'}</div>
      <div class="card"><h3>Melhores clientes</h3>${topClients.length ? topClients.map(([id, v]) => `<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between"><span>${esc(clientName(id))}</span><b>${brl(v)}</b></div><div class="bar"><i style="width:${Math.round(v / maxClient * 100)}%"></i></div></div>`).join('') : '<div class="empty">Sem dados no período.</div>'}</div>
      <div class="card"><h3>Produtos mais vendidos</h3>${topProd.length ? `<table class="t"><tbody>${topProd.map(([n, x]) => `<tr><td>${esc(n)}</td><td class="r">${x.q} un</td><td class="r"><b>${brl(x.v)}</b></td></tr>`).join('')}</tbody></table>` : '<div class="empty">Sem produtos vendidos no período.</div>'}</div>
      <div class="card"><h3>OS concluídas por técnico</h3>${Object.keys(byTech).length ? `<table class="t"><tbody>${Object.entries(byTech).map(([n, c]) => `<tr><td>${esc(n)}</td><td class="r"><b>${c}</b></td></tr>`).join('')}</tbody></table>` : '<div class="empty">Sem dados no período.</div>'}</div>
    </div>`;
}
ACT.repPeriod = (d, el) => { P = +el.value; app.refresh(); };

ACT.exportCSV = async d => {
  let rows, name;
  if (d.v === 'finance') { name = 'financeiro'; rows = [['Tipo', 'Descrição', 'Cliente', 'Valor', 'Vencimento', 'Situação', 'Pago em', 'Forma', 'Categoria'], ...DB.finance.map(f => [f.type === 'receber' ? 'Receber' : 'Pagar', f.desc, f.clientId ? clientName(f.clientId) : '', String(f.value).replace('.', ','), fmtDate(f.due), f.paid ? 'Pago' : 'Pendente', fmtDate(f.paidDate), f.method || '', f.category || ''])]; }
  else if (d.v === 'os') { name = 'ordens-de-servico'; rows = [['Número', 'Data', 'Cliente', 'Serviço', 'Situação', 'Técnico', 'Total', 'Custo materiais'], ...DB.os.map(o => [pad(o.num), fmtDate(o.date), clientName(o.clientId), o.type, o.status, userName(o.techId), String(total(o)).replace('.', ','), String(cost(o)).replace('.', ',')])]; }
  else { name = 'clientes'; rows = [['Nome', 'Telefone', 'CPF/CNPJ', 'Cidade', 'Endereço', 'Observações'], ...DB.clients.map(c => [c.name, c.phone, c.doc, c.city, c.address, c.notes])]; }
  await saveFile(`${name}-${today()}.csv`, new Blob([toCSV(rows)], { type: 'text/csv' }));
};
