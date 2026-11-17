import { DB, get, put } from '../store.js';
import { ACT, ic, esc, today, waLink, app, toast } from '../util.js';
import { reminders, stockLow } from '../domain.js';

let cur = [];

export function render(root) {
  cur = reminders();
  const groups = ['Visitas', 'Cobranças', 'Contratos', 'Garantias', 'Orçamentos'];
  const low = stockLow();
  root.innerHTML = `<div class="card" style="margin-bottom:12px"><p class="hint" style="margin:0">Cada lembrete abre o WhatsApp com a mensagem já escrita. Você só confere e toca em enviar. O envio automático, sem você apertar nada, exige um serviço de WhatsApp comercial e entra na versão online.</p></div>
    ${cur.length ? groups.map(g => { const l = cur.map((r, i) => [r, i]).filter(([r]) => r.group === g); if (!l.length) return '';
      return `<div class="sect"><h2>${g}</h2></div><div class="card">${l.map(([r, i]) => `<div class="rem ${r.tone}"><div class="av">${ic(r.icon)}</div><div class="lt"><b>${esc(r.title)}</b><small class="meta">${r.sub}</small>
        <div class="btns">${r.phone ? `<button class="btn ok sm" data-act="remWa" data-i="${i}">${ic('chat')} Enviar no WhatsApp</button>` : `<span class="hint">Cliente sem telefone cadastrado</span>`}<button class="btn ghost sm" data-act="remDone" data-i="${i}">${ic('check')} Já resolvi</button></div></div></div>`).join('')}</div>`; }).join('')
      : `<div class="card"><div class="empty"><b>Nenhum lembrete pendente</b>Aqui aparecem visitas de amanhã, cobranças, contratos, garantias vencendo e orçamentos sem resposta.</div></div>`}
    ${low.length ? `<div class="sect"><h2>Estoque</h2></div><div class="card"><div class="li low" onclick="location.hash='#/stock'"><div class="av">${ic('box')}</div><div class="lt"><b>${low.length} produto(s) abaixo do mínimo</b><small class="meta">${esc(low.map(p => p.name).join(', '))}</small></div></div></div>` : ''}`;
}
ACT.remWa = d => { const r = cur[+d.i]; if (r) window.open(waLink(r.phone, r.msg), '_blank'); };
ACT.remDone = async d => {
  const r = cur[+d.i]; if (!r) return;
  const m = DB.meta.find(x => x.id === 'dismissed') || { id: 'dismissed', map: {} };
  m.map[r.key] = today(); await put('meta', m); app.refresh(); toast('Lembrete marcado como resolvido');
};
