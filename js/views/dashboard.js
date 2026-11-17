import { DB } from '../store.js';
import { ic, brl, fmtDate, today, lastMonths, monthLabel, barChart, me, esc, pad, meta } from '../util.js';
import { total, stockLow, reminders, osRow, sum, can, limited } from '../domain.js';

const kpi = (tone, label, value, sub = '', link = '') =>
  `<div class="kpi ${link ? 'link' : ''}" ${link ? `onclick="location.hash='${link}'"` : ''}><div class="k"><span class="led ${tone}"></span>${label}</div><b>${value}</b><small>${sub}</small></div>`;

export function render(root) {
  const t = today(), role = me.user.role, fin = can('finance');
  const mine = o => !limited() || o.techId === me.user.id;
  const os = DB.os.filter(mine);
  const open = os.filter(o => o.status === 'Aberta' || o.status === 'Em andamento');
  const pend = DB.finance.filter(f => !f.paid);
  const rec = pend.filter(f => f.type === 'receber'), pay = pend.filter(f => f.type === 'pagar');
  const late = rec.filter(f => f.due < t);
  const mk = t.slice(0, 7);
  const fat = DB.os.filter(o => o.status === 'Concluída' && (o.date || '').slice(0, 7) === mk).reduce((a, o) => a + total(o), 0);
  const mrr = DB.contracts.filter(c => c.status === 'Ativo').reduce((a, c) => a + (+c.value || 0), 0);
  const hoje = os.filter(o => o.date === t && o.status !== 'Cancelada').sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const low = stockLow(), rem = can('reminders') ? reminders() : [];
  const months = lastMonths(6);
  const flow = type => months.map(m => sum(DB.finance.filter(f => f.type === type && f.paid && (f.paidDate || '').slice(0, 7) === m)));
  const first = me.user.name.split(' ')[0];
  const nothing = !DB.clients.length && !DB.os.length;

  const kpis = fin
    ? kpi('ok', 'Faturado no mês', brl(fat), 'OS concluídas', '#/reports') + kpi('info', 'A receber', brl(sum(rec)), rec.length + ' lançamento(s)', '#/finance') +
      kpi(late.length ? 'bad' : 'ok', 'Em atraso', brl(sum(late)), late.length + ' cobrança(s)', '#/finance') + kpi('warn', 'A pagar', brl(sum(pay)), pay.length + ' conta(s)', '#/finance') +
      kpi('info', 'OS em aberto', open.length, 'abertas e em andamento', '#/os') + kpi('ok', 'Receita recorrente', brl(mrr), 'contratos ativos por mês', '#/contracts')
    : kpi('info', 'Minhas OS em aberto', open.length, '', '#/os') + kpi('warn', 'Visitas hoje', hoje.length, '', '#/agenda') + kpi(low.length ? 'bad' : 'ok', 'Estoque baixo', low.length, 'produtos', '#/stock');

  root.innerHTML = `
  <div class="hello"><h2>Olá, ${esc(first)}</h2><p>${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
  ${nothing ? `<div class="card" style="margin-bottom:12px"><h3>Comece por aqui</h3><p class="hint" style="margin:0 0 10px">O sistema está vazio. Cadastre seu primeiro cliente ou carregue dados de exemplo em Ajustes para testar todas as telas.</p><div class="btns" style="margin-top:0"><a class="btn" href="#/clients">${ic('users')} Cadastrar cliente</a>${role === 'dono' ? `<a class="btn ghost" href="#/settings">${ic('sliders')} Ir para Ajustes</a>` : ''}</div></div>` : ''}
  <div class="kpis">${kpis}</div>
  <div class="cols c2">
    ${fin ? `<div class="card"><h3>Entradas e saídas<small>últimos 6 meses (valores pagos)</small></h3>${barChart(months.map(monthLabel), [{ name: 'Recebido', color: 'var(--brand)', values: flow('receber') }, { name: 'Pago', color: '#64748b', values: flow('pagar') }])}</div>` : ''}
    <div class="card"><h3>Agenda de hoje<small>${hoje.length} visita(s)</small></h3>${hoje.length ? hoje.map(osRow).join('') : `<div class="empty"><b>Nada agendado para hoje</b>Use a Agenda para marcar visitas.</div>`}</div>
  </div>
  <div class="cols c2e" style="margin-top:12px">
    <div class="card"><h3>Atenção<small>o que precisa de ação</small></h3>
      ${low.length ? `<div class="li low" onclick="location.hash='#/stock'"><div class="av">${ic('box')}</div><div class="lt"><b>${low.length} produto(s) com estoque baixo</b>${meta(esc(low.slice(0, 3).map(p => p.name).join(', ')))}</div></div>` : ''}
      ${fin && rem.length ? `<div class="li" onclick="location.hash='#/reminders'"><div class="av">${ic('bell')}</div><div class="lt"><b>${rem.length} lembrete(s) para enviar por WhatsApp</b>${meta('contratos, garantias, cobranças e orçamentos')}</div></div>` : ''}
      ${fin && late.length ? `<div class="li low" onclick="location.hash='#/finance'"><div class="av">${ic('alert')}</div><div class="lt"><b>${late.length} cobrança(s) em atraso</b>${meta(brl(sum(late)))}</div></div>` : ''}
      ${!low.length && !(fin && (rem.length || late.length)) ? `<div class="empty"><b>Tudo em ordem</b>Sem alertas no momento.</div>` : ''}
    </div>
    <div class="card"><h3>OS em aberto</h3>${open.length ? open.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).slice(0, 6).map(osRow).join('') : `<div class="empty"><b>Nenhuma OS em aberto</b>Crie uma em Ordens de serviço.</div>`}</div>
  </div>`;
}
