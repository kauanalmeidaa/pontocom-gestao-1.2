import { DB } from '../store.js';
import { ACT, ic, esc, today, addDays, weekStart, parse, fmtDate, DIAS, badge, meta, me, app } from '../util.js';
import { osRow, clientName, limited, can } from '../domain.js';

let ws = null;

export function render(root) {
  const lim = limited();                       // acesso limitado: só a semana atual e só as OS dele em aberto
  ws = lim ? weekStart(today()) : (ws || weekStart(today()));
  const t = today(), days = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(ws, i));
  const mine = o => !lim || (o.techId === me.user.id && (o.status === 'Aberta' || o.status === 'Em andamento'));
  const canContracts = !lim && can('contracts');
  const week = DB.os.filter(o => mine(o) && o.status !== 'Cancelada' && days.includes(o.date));
  root.innerHTML = `<div class="toolbar">${lim ? '' : `<button class="btn ghost sm" data-act="wk" data-n="-7">Semana anterior</button><button class="btn ghost sm" data-act="wk" data-n="0">Hoje</button><button class="btn ghost sm" data-act="wk" data-n="7">Próxima semana</button>`}
    <b style="margin-left:${lim ? '0' : 'auto'}">${lim ? 'Semana de ' : ''}${fmtDate(days[0])} a ${fmtDate(days[6])}</b>${lim ? '' : `<button class="btn" data-act="newVisit" data-d="${t >= days[0] && t <= days[6] ? t : days[0]}">${ic('plus')} Agendar visita</button>`}</div>
    ${week.length || (!lim && DB.contracts.length) ? '' : `<div class="card"><div class="empty"><b>Agenda vazia</b>${lim ? 'Nenhuma visita sua marcada para esta semana.' : 'Agende visitas com “Agendar visita” ou crie uma OS com data e horário.'}</div></div>`}
    ${days.map(d => {
      const os = week.filter(o => o.date === d).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
      const cts = canContracts ? DB.contracts.filter(c => c.status === 'Ativo' && c.nextVisit === d) : [];
      return `<div class="day"><h3 class="${d === t ? 'today' : ''}">${DIAS[parse(d).getDay()]}, ${fmtDate(d).slice(0, 5)}${d === t ? ' – hoje' : ''}</h3>
        ${os.length || cts.length ? `<div class="card">${os.map(osRow).join('')}${cts.map(c => `<div class="li" data-act="openContract" data-id="${c.id}"><div class="av">${ic('repeat')}</div><div class="lt"><b>Visita de contrato – ${esc(clientName(c.clientId))}</b>${meta(esc(c.name))}</div><div class="rt">${badge('Contrato', 'info')}</div></div>`).join('')}</div>` : `<p class="hint" style="margin:0 0 6px">Nenhuma visita.</p>`}</div>`;
    }).join('')}`;
}
ACT.wk = d => { ws = +d.n === 0 ? weekStart(today()) : addDays(ws, +d.n); app.refresh(); };
ACT.newVisit = d => ACT.newOS({ date: d.d, time: '09:00' });
