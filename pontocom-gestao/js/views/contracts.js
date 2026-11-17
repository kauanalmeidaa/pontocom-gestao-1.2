import { DB, get, put, del, nextNum, settings } from '../store.js';
import { $, ACT, ic, esc, brl, fmtDate, today, addMonths, addDays, daysBetween, monthLabel, meta, badge, F, readForm, modal, closeModal, toast, waLink, app } from '../util.js';
import { clientOpts, clientName, TONE, afterSaveOS } from '../domain.js';

export function render(root) {
  const t = today(), act = DB.contracts.filter(c => c.status === 'Ativo');
  const mrr = act.reduce((a, c) => a + (+c.value || 0), 0);
  const soon = act.filter(c => c.nextVisit && daysBetween(t, c.nextVisit) <= 30);
  const late = act.filter(c => c.nextVisit && c.nextVisit < t);
  root.innerHTML = `<div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
      <div class="kpi"><div class="k"><span class="led ok"></span>Receita recorrente</div><b>${brl(mrr)}</b><small>por mês</small></div>
      <div class="kpi"><div class="k"><span class="led info"></span>Contratos ativos</div><b>${act.length}</b></div>
      <div class="kpi"><div class="k"><span class="led warn"></span>Visitas em 30 dias</div><b>${soon.length}</b></div>
      <div class="kpi"><div class="k"><span class="led ${late.length ? 'bad' : 'ok'}"></span>Visitas atrasadas</div><b>${late.length}</b></div></div>
    <div class="toolbar"><div style="flex:1"></div><button class="btn" data-act="newContract">${ic('plus')} Novo contrato</button></div>
    <div class="card">${DB.contracts.length ? DB.contracts.slice().sort((a, b) => (a.nextVisit || '').localeCompare(b.nextVisit || '')).map(c => {
      const d = c.nextVisit ? daysBetween(t, c.nextVisit) : null;
      return `<div class="li" data-act="openContract" data-id="${c.id}"><div class="av">${ic('repeat')}</div><div class="lt"><b>${esc(clientName(c.clientId))} – ${esc(c.name)}</b>${meta(brl(c.value) + ' por mês', 'visita a cada ' + c.periodMonths + (c.periodMonths == 1 ? ' mês' : ' meses'), c.nextVisit ? 'próxima ' + fmtDate(c.nextVisit) : '')}</div>
        <div class="rt">${badge(c.status, TONE[c.status])}${c.status === 'Ativo' && d !== null ? `<small>${d < 0 ? 'visita atrasada ' + (-d) + 'd' : d === 0 ? 'visita hoje' : 'visita em ' + d + 'd'}</small>` : ''}</div></div>`; }).join('')
      : `<div class="empty"><b>Nenhum contrato de manutenção</b>Contratos geram mensalidade e lembram você de cada visita preventiva.</div>`}</div>`;
}

function form(id, pre = {}) {
  const c = get('contracts', id) || { status: 'Ativo', periodMonths: 3, start: today(), nextVisit: addMonths(today(), 3), billDay: 10, ...pre };
  modal(id ? 'Contrato' : 'Novo contrato', `<form data-submit="saveContract" data-id="${id || ''}"><div class="fg">
    ${F('clientId', 'Cliente', c.clientId, { type: 'select', opts: clientOpts(), req: true, full: true })}
    ${F('name', 'Nome do plano', c.name, { req: true, ph: 'Ex.: Manutenção trimestral de cerca elétrica', full: true })}
    ${F('value', 'Mensalidade (R$)', c.value ?? '', { type: 'money', req: true })}${F('billDay', 'Dia do vencimento', c.billDay, { type: 'number', step: '1' })}
    ${F('periodMonths', 'Visita preventiva a cada', c.periodMonths, { type: 'select', opts: [[1, '1 mês'], [2, '2 meses'], [3, '3 meses'], [6, '6 meses'], [12, '12 meses']] })}${F('nextVisit', 'Próxima visita', c.nextVisit, { type: 'date' })}
    ${F('start', 'Início do contrato', c.start, { type: 'date' })}${F('status', 'Situação', c.status, { type: 'select', opts: ['Ativo', 'Pausado', 'Cancelado'] })}
    ${F('notes', 'Observações', c.notes, { type: 'textarea', full: true })}</div>
    <div class="btns"><button class="btn">Salvar contrato</button></div></form>
    ${id ? `<div class="sub">Ações do contrato</div><div class="btns" style="margin-top:0"><button class="btn ghost" data-act="genVisit" data-id="${id}">${ic('clip')} Gerar OS da visita</button><button class="btn ghost" data-act="genBill" data-id="${id}">${ic('money')} Gerar cobrança do mês</button><button class="btn danger" data-act="deleteContract" data-id="${id}">${ic('trash')} Excluir</button></div>` : ''}`);
}
ACT.newContract = () => form('');
ACT.openContract = d => form(d.id);
ACT.saveContract = async (d, f) => { const v = readForm(f); v.periodMonths = +v.periodMonths; await put('contracts', { ...(get('contracts', d.id) || {}), ...v }); closeModal(); app.refresh(); toast('Contrato salvo'); };
ACT.deleteContract = async d => { if (!confirm('Excluir este contrato?')) return; await del('contracts', d.id); closeModal(); app.refresh(); toast('Contrato excluído'); };

ACT.genVisit = async d => {
  const c = get('contracts', d.id);
  const o = { num: await nextNum('os'), clientId: c.clientId, type: 'Manutenção', status: 'Aberta', date: c.nextVisit || today(), time: '', items: [], discount: 0, techId: '', desc: `Visita preventiva – ${c.name}`, contractId: c.id,
    checklist: (settings().checklists['Manutenção'] || []).map(t => ({ t, done: false })) };
  await afterSaveOS(o);
  c.nextVisit = addMonths(c.nextVisit || today(), c.periodMonths || 3); await put('contracts', c);
  closeModal(); app.refresh(); toast('OS criada e próxima visita reagendada para ' + fmtDate(c.nextVisit));
  ACT.openOS({ id: o.id });
};
ACT.genBill = async d => {
  const c = get('contracts', d.id), mk = today().slice(0, 7);
  if (DB.finance.some(f => f.contractId === c.id && f.monthKey === mk)) return toast('A cobrança deste mês já foi gerada');
  const day = String(Math.min(+c.billDay || 10, 28)).padStart(2, '0');
  await put('finance', { type: 'receber', desc: `Mensalidade ${c.name} – ${monthLabel(mk)}`, value: +c.value, due: `${mk}-${day}`, paid: false, clientId: c.clientId, contractId: c.id, monthKey: mk, category: 'Contratos' });
  closeModal(); app.refresh(); toast('Cobrança lançada no financeiro');
};
