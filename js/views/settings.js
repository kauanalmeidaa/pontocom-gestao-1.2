import * as Store from '../store.js';
import * as Cloud from '../cloud.js';
import { DB, get, put, del, nextNum, settings, saveSettings, uid } from '../store.js';
import { $, ACT, ic, esc, brl, fmtDate, today, addDays, addMonths, meta, badge, F, readForm, modal, closeModal, toast, saveFile, hashPin, me, app } from '../util.js';
import { ROLES, types, afterSaveOS, MODULES, PRESETS, userPerms, isLimited } from '../domain.js';

export function render(root) {
  const s = settings(), tl = types();
  root.innerHTML = `
  <div class="card"><h3>Sua marca</h3>
    <form data-submit="saveBrand"><div class="fg">
      ${F('company', 'Nome da empresa', s.company, { req: true })}${F('doc', 'CNPJ / CPF (aparece nos documentos)', s.doc)}
      ${F('whats', 'WhatsApp', s.whats, { type: 'tel' })}${F('city', 'Cidade', s.city)}
      <div class="f"><label>Cor da marca</label><input type="color" name="color" value="${esc(s.color)}"></div>
      <div class="f"><label>Logo (PNG ou JPG)</label><label class="file" style="display:flex">${ic('plus')} Escolher imagem<input type="file" accept="image/*" data-change="setLogo"></label></div>
      ${F('warrantyEquip', 'Garantia dos equipamentos (meses)', s.warrantyEquip, { type: 'number', step: '1' })}${F('warrantyLabor', 'Garantia da mão de obra (meses)', s.warrantyLabor, { type: 'number', step: '1' })}
      ${F('validity', 'Validade padrão do orçamento (dias)', s.validity, { type: 'number', step: '1' })}<div class="f"><label>Cor de destaque (verde da logo)</label><input type="color" name="accent" value="${esc(s.accent)}"></div>
      ${F('terms', 'Texto de garantia e condições (sai nos orçamentos e OS)', s.terms, { type: 'textarea', full: true })}</div>
      <div class="btns"><button class="btn">Salvar</button>${s.logo ? `<button type="button" class="btn ghost" data-act="rmLogo">Remover logo</button>` : ''}<button type="button" class="btn ghost" data-act="resetBrand">${Store.cloud ? 'Restaurar cores padrão' : 'Restaurar logo e cores da PontoCom'}</button></div></form></div>

  <div class="card"><h3>Usuários e permissões</h3>
    ${DB.users.map(u => `<div class="li" data-act="editUser" data-id="${u.id}"><div class="av">${ic('users')}</div><div class="lt"><b>${esc(u.name)}</b>${meta(ROLES[u.role], u.role === 'dono' ? 'acesso total' : userPerms(u).length + ' módulo(s) liberado(s)', isLimited(u) ? 'acesso limitado' : '')}</div></div>`).join('')}
    <div class="btns"><button class="btn ghost" data-act="newUser">${ic('plus')} Novo usuário</button></div>
    <p class="hint">Toque em um usuário para escolher quais módulos ele acessa. O dono sempre vê tudo. ${Store.cloud ? 'Para adicionar alguém, toque em “Novo usuário”: o sistema gera um código de convite. A pessoa cria a conta (e-mail e senha) e informa o código.' : 'Nesta versão de teste o PIN protege só este aparelho. A segurança de verdade vem com o login online.'}</p></div>

  <div class="card"><h3>Etapas por tipo de serviço</h3>
    <form data-submit="saveChk"><div class="fg">${F('type', 'Tipo de serviço', tl[0], { type: 'select', opts: tl, attrs: 'data-change="chkType"' })}
      ${F('lines', 'Etapas (uma por linha)', (s.checklists[tl[0]] || []).join('\n'), { type: 'textarea', rows: 8, full: true })}</div>
      <div class="btns"><button class="btn">Salvar etapas</button></div></form>
    <form data-submit="newType" style="margin-top:14px"><div class="fg">${F('name', 'Adicionar novo tipo de serviço', '', { ph: 'Ex.: Controle de acesso' })}</div><div class="btns"><button class="btn ghost">${ic('plus')} Adicionar tipo</button></div></form></div>

  <div class="card"><h3>Kits para orçamento</h3>
    ${DB.kits.map(k => `<div class="li" data-act="openKit" data-id="${k.id}"><div class="av">${ic('box')}</div><div class="lt"><b>${esc(k.name)}</b>${meta(k.items.length + ' itens')}</div></div>`).join('') || '<p class="hint">Nenhum kit.</p>'}
    <div class="btns"><button class="btn ghost" data-act="newKit">${ic('plus')} Novo kit</button></div></div>

  <div class="card"><h3>Backup dos dados</h3>
    <p class="hint" style="margin:0 0 10px">Os dados ficam só neste navegador. Faça backup toda semana. ${s.lastBackup ? 'Último backup: ' + new Date(s.lastBackup).toLocaleString('pt-BR') + '.' : 'Você ainda não fez nenhum backup.'}</p>
    <div class="btns" style="margin-top:0"><button class="btn" data-act="backup">${ic('down')} Fazer backup agora</button></div>
    <div class="f" style="margin-top:12px"><label>Restaurar um backup (.json)</label><input type="file" accept=".json,application/json" data-change="restore"></div></div>

  <div class="card"><h3>Testes</h3>
    <p class="hint" style="margin:0 0 10px">Carrega clientes, produtos, OS, contratos e lançamentos fictícios para você testar todas as telas. Só funciona com o sistema vazio de OS e clientes.</p>
    <div class="btns" style="margin-top:0"><button class="btn ghost" data-act="seedDemo">Carregar dados de exemplo</button><button class="btn danger" data-act="wipe">${ic('trash')} Apagar todos os dados</button></div></div>`;
}

/* ---------- marca ---------- */
ACT.saveBrand = async (d, f) => { const v = readForm(f); await saveSettings({ ...settings(), ...v }); ACT.applyBrand(); app.refresh(); toast('Ajustes salvos'); };
ACT.setLogo = (d, el) => {
  const file = el.files[0]; if (!file) return;
  const url = URL.createObjectURL(file), im = new Image();
  im.onload = async () => {
    const k = Math.min(1, 360 / im.width), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
    await saveSettings({ ...settings(), logo: c.toDataURL('image/png'), icon: '' }); ACT.applyBrand(); app.refresh(); toast('Logo atualizada');
  };
  im.src = url;
};
ACT.rmLogo = async () => { await saveSettings({ ...settings(), logo: '', icon: '' }); app.refresh(); };
ACT.resetBrand = async () => { const D = Store.DEFAULTS; await saveSettings({ ...settings(), color: D.color, accent: D.accent, logo: D.logo, icon: D.icon }); ACT.applyBrand(); app.refresh(); toast(Store.cloud ? 'Cores padrão restauradas' : 'Logo e cores da PontoCom restauradas'); };

/* ---------- etapas ---------- */
ACT.chkType = (d, el) => { $('[name=lines]', el.closest('form')).value = (settings().checklists[el.value] || []).join('\n'); };
ACT.saveChk = async (d, f) => {
  const v = readForm(f), s = settings();
  s.checklists = { ...s.checklists, [v.type]: v.lines.split('\n').map(x => x.trim()).filter(Boolean) };
  await saveSettings(s); toast('Etapas salvas');
};
ACT.newType = async (d, f) => {
  const n = readForm(f).name.trim(); if (!n) return;
  const s = settings(); if (s.checklists[n]) return toast('Esse tipo já existe');
  s.checklists = { ...s.checklists, [n]: ['Executar o serviço', 'Testar o funcionamento', 'Orientar o cliente'] };
  await saveSettings(s); app.refresh(); toast('Tipo adicionado');
};

/* ---------- kits ---------- */
function kitForm(id) {
  const k = get('kits', id) || { name: '', items: [] };
  modal(id ? 'Editar kit' : 'Novo kit', `<form data-submit="saveKit" data-id="${id || ''}"><div class="fg">
    ${F('name', 'Nome do kit', k.name, { req: true, full: true })}
    ${F('lines', 'Itens (um por linha: quantidade | descrição | valor)', k.items.map(i => i.join(' | ')).join('\n'), { type: 'textarea', rows: 8, full: true, ph: '4 | Câmera bullet 2MP | 160' })}</div>
    <div class="btns"><button class="btn">Salvar kit</button>${id ? `<button type="button" class="btn danger" data-act="deleteKit" data-id="${id}">${ic('trash')} Excluir</button>` : ''}</div></form>`);
}
ACT.newKit = () => kitForm(''); ACT.openKit = d => kitForm(d.id);
ACT.saveKit = async (d, f) => {
  const v = readForm(f);
  const items = v.lines.split('\n').map(l => l.split('|').map(x => x.trim())).filter(p => p[1]).map(p => [p[0] || '1', p[1], (p[2] || '0').replace(',', '.')]);
  await put('kits', { ...(get('kits', d.id) || {}), name: v.name, items }); closeModal(); app.refresh(); toast('Kit salvo');
};
ACT.deleteKit = async d => { if (!confirm('Excluir este kit?')) return; await del('kits', d.id); closeModal(); app.refresh(); };

/* ---------- usuários ---------- */
function userForm(id) {
  const u = get('users', id) || { role: 'tecnico' };
  const on = userPerms(u), dono = u.role === 'dono';
  modal(id ? 'Editar usuário' : 'Novo usuário', `<form data-submit="saveUser" data-id="${id || ''}"><div class="fg">
    ${F('name', 'Nome', u.name, { req: true })}${F('role', 'Função', u.role, { type: 'select', opts: Object.entries(ROLES), attrs: 'data-change="userRole"' })}
    ${Store.cloud ? '' : F('pin', id ? 'Novo PIN (deixe vazio para manter)' : 'PIN (4 a 8 números)', '', { type: 'password', req: !id, attrs: 'inputmode="numeric" autocomplete="new-password"', full: true })}</div>
    <div class="sub">O que este usuário pode acessar</div>
    <p class="hint" style="margin:0 0 6px">Marque os módulos liberados. Ao trocar a função, as opções se ajustam ao modelo dela e você pode mudar do jeito que quiser.</p>
    <div class="perms">${MODULES.map(([k, l]) => `<label class="chk"><input type="checkbox" name="perm_${k}" ${on.includes(k) ? 'checked' : ''} ${dono ? 'disabled' : ''}><span>${l}</span></label>`).join('')}</div>
    <label class="chk" style="margin-top:6px"><input type="checkbox" name="limited" ${isLimited(u) ? 'checked' : ''} ${dono ? 'disabled' : ''}><span><b>Acesso limitado</b><br><small class="hint">Vê só as OS em aberto dele e a agenda da semana atual. As OS aparecem para ele quando você escolhe o nome dele em “Técnico responsável”.</small></span></label>
    <div class="btns"><button class="btn">${Store.cloud && !id ? 'Gerar convite' : 'Salvar usuário'}</button>${id && id !== me.user.id ? `<button type="button" class="btn danger" data-act="deleteUser" data-id="${id}">${ic('trash')} Excluir</button>` : ''}</div></form>`);
}
ACT.newUser = () => userForm(''); ACT.editUser = d => userForm(d.id);
ACT.userRole = (d, el) => {
  const f = el.closest('form'), p = PRESETS[el.value], dono = el.value === 'dono';
  MODULES.forEach(([k]) => { const b = f.elements['perm_' + k]; b.checked = p.perms.includes(k); b.disabled = dono; });
  f.elements.limited.checked = p.limited; f.elements.limited.disabled = dono;
};
ACT.saveUser = async (d, f) => {
  const v = readForm(f), old = get('users', d.id);
  if (!Store.cloud && v.pin && !/^\d{4,8}$/.test(v.pin)) return toast('O PIN precisa ter de 4 a 8 números');
  const donos = DB.users.filter(u => u.role === 'dono' && u.id !== d.id).length;
  if (old && old.role === 'dono' && v.role !== 'dono' && !donos) return toast('Precisa existir pelo menos um dono');
  if (Store.cloud && !d.id) {
    const perms = v.role === 'dono' ? PRESETS.dono.perms : MODULES.map(m => m[0]).filter(k => v['perm_' + k]);
    if (!perms.length) return toast('Marque pelo menos um módulo para este usuário');
    const code = await Cloud.createInvite(v.name.trim(), v.role, perms, v.role === 'dono' ? false : !!v.limited);
    const msg = `Olá, ${v.name.trim()}! Acesse ${location.origin}${location.pathname}, toque em “Criar conta” e depois use este código de convite: ${code}`;
    modal('Convite gerado', `<p>Envie ao usuário. O código vale por 14 dias e só funciona uma vez.</p><div class="card" style="text-align:center;font-size:26px;letter-spacing:3px;font-weight:700">${code}</div><div class="btns"><a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">Enviar pelo WhatsApp</a><button class="btn ghost" data-act="closeModal">Fechar</button></div>`);
    return;
  }
  const id = d.id || uid();
  const o = { ...(old || {}), id, name: v.name.trim(), role: v.role };
  if (v.role === 'dono') { o.perms = PRESETS.dono.perms; o.limited = false; }
  else {
    o.perms = MODULES.map(m => m[0]).filter(k => v['perm_' + k]); o.limited = !!v.limited;
    if (!o.perms.length) return toast('Marque pelo menos um módulo para este usuário');
  }
  if (!Store.cloud && v.pin) o.pinHash = await hashPin(v.pin, id);
  await put('users', o); if (me.user.id === id) me.user = o;
  closeModal(); app.refresh(); toast('Usuário salvo');
};
ACT.deleteUser = async d => { if (!confirm('Excluir este usuário?')) return; await del('users', d.id); closeModal(); app.refresh(); };

/* ---------- backup ---------- */
ACT.backup = async () => {
  await saveSettings({ ...settings(), lastBackup: new Date().toISOString() });
  await saveFile(`backup-gestao-${today()}.json`, new Blob([JSON.stringify(Store.exportAll())], { type: 'application/json' }));
  app.refresh();
};
ACT.restore = (d, el) => {
  const file = el.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = async () => {
    try {
      const data = JSON.parse(r.result); if (!data.users || !data.clients) throw 0;
      if (!confirm('Isso substitui TODOS os dados atuais pelos do backup. Continuar?')) return;
      await Store.importAll(data); sessionStorage.removeItem('uid'); location.reload();
    } catch (e) { toast('Arquivo de backup inválido'); }
  };
  r.readAsText(file);
};
ACT.wipe = async () => {
  if (!confirm('Apagar TODOS os dados deste navegador? Faça um backup antes.')) return;
  if (!confirm('Tem certeza? Esta ação não pode ser desfeita.')) return;
  await Store.importAll({}); sessionStorage.removeItem('uid'); location.reload();
};

/* ---------- dados de exemplo ---------- */
ACT.seedDemo = async () => {
  if (DB.clients.length || DB.os.length) return toast('Só dá para carregar com clientes e OS vazios');
  const t = today(), mk = async (c, o) => put(c, { id: uid(), ...o });
  const cl = {};
  for (const [k, name, phone, city] of [['joao', 'João Pereira', '(88) 99911-2233', 'Senador Pompeu'], ['maria', 'Maria Souza', '(88) 99822-3344', 'Quixeramobim'], ['merc', 'Mercadinho Bom Preço', '(88) 99733-4455', 'Mombaça'], ['cond', 'Condomínio Vila Verde', '(88) 99644-5566', 'Senador Pompeu']]) cl[k] = (await mk('clients', { name, phone, city, address: 'Centro', notes: '' })).id;
  const pr = {};
  for (const [k, name, cost, price, stock, min, unit] of [['cam', 'Câmera bullet 2MP', 85, 160, 12, 4, 'un'], ['dvr', 'DVR 4 canais', 260, 450, 3, 2, 'un'], ['cen', 'Central de choque', 180, 320, 5, 2, 'un'], ['mot', 'Motor deslizante', 650, 1100, 2, 2, 'un'], ['utp', 'Cabo UTP', 1.2, 3, 300, 100, 'm'], ['ctl', 'Controle remoto', 18, 45, 20, 5, 'un']]) pr[k] = (await mk('products', { name, sku: k.toUpperCase(), cost, price, stock, min, unit })).id;
  const it = (k, qty, price) => ({ pid: pr[k], desc: get('products', pr[k]).name, qty, price, cost: get('products', pr[k]).cost });
  const labor = (v, d = 'Mão de obra de instalação') => ({ pid: '', desc: d, qty: 1, price: v, cost: 0 });
  const jobs = [
    [5, 'joao', 'Câmeras de segurança', [it('cam', 4, 160), it('dvr', 1, 450), labor(350)], 12],
    [4, 'merc', 'Cerca elétrica', [it('cen', 1, 320), labor(600)], 8],
    [3, 'maria', 'Motor de portão', [it('mot', 1, 1100), it('ctl', 2, 45), labor(400)], 15],
    [2, 'cond', 'Interfone', [labor(900, 'Instalação de interfone coletivo')], 6],
    [1, 'joao', 'Cerca elétrica', [it('cen', 1, 320), labor(550)], 10],
    [0, 'merc', 'Câmeras de segurança', [it('cam', 2, 160), labor(200)], 3]
  ];
  let n = 0;
  for (const [back, c, type, items, day] of jobs) {
    const date = addMonths(t.slice(0, 8) + '01', -back).slice(0, 8) + String(day).padStart(2, '0');
    const o = { num: await nextNum('os'), clientId: cl[c], type, status: 'Concluída', techId: me.user.id, date: date > t ? t : date, time: '', items, discount: 0, desc: 'Serviço concluído (exemplo)', checklist: [], newEquip: n < 4 ? { model: type + ' – modelo exemplo', serial: 'SN' + (1000 + n), location: 'Frente da casa' } : null };
    await afterSaveOS(o);
    if (back > 0) { const f = get('finance', o.finId); f.paid = true; f.paidDate = o.date; f.method = 'PIX'; await put('finance', f); }
    n++;
  }
  await afterSaveOS({ num: await nextNum('os'), clientId: cl.maria, type: 'Cerca elétrica', status: 'Aberta', techId: me.user.id, date: addDays(t, 1), time: '09:00', items: [], discount: 0, desc: 'Visita para instalação', checklist: [] });
  await afterSaveOS({ num: await nextNum('os'), clientId: cl.cond, type: 'Manutenção', status: 'Em andamento', techId: me.user.id, date: t, time: '14:00', items: [], discount: 0, desc: 'Revisão do portão', checklist: [] });
  await put('quotes', { id: uid(), num: await nextNum('quotes'), clientId: cl.maria, date: addDays(t, -5), validity: 7, status: 'Pendente', discount: 0, notes: '', items: [labor(1800, 'Kit 4 câmeras instalado')] });
  await put('contracts', { id: uid(), clientId: cl.cond, name: 'Manutenção trimestral', value: 350, periodMonths: 3, start: addMonths(t, -5), nextVisit: addDays(t, 6), billDay: 10, status: 'Ativo' });
  await put('contracts', { id: uid(), clientId: cl.merc, name: 'Monitoramento e revisão mensal', value: 120, periodMonths: 1, start: addMonths(t, -3), nextVisit: addDays(t, -2), billDay: 5, status: 'Ativo' });
  await put('finance', { id: uid(), type: 'pagar', desc: 'Aluguel da sala', value: 800, due: addDays(t, 5), paid: false, category: 'Fixas' });
  await put('finance', { id: uid(), type: 'pagar', desc: 'Combustível', value: 260, due: addDays(t, -6), paid: true, paidDate: addDays(t, -6), method: 'Cartão', category: 'Veículo' });
  app.refresh(); toast('Dados de exemplo carregados');
};
