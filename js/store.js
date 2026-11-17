/* ============================================================
   store.js — ÚNICO arquivo que mexe com armazenamento.
   Hoje: IndexedDB no próprio navegador (teste local).
   Depois: trocar as funções put/del/loadAll por chamadas ao
   Supabase e o resto do sistema continua igual.
   ============================================================ */
const COLS = ['clients','products','moves','os','quotes','finance','contracts','equipment','kits','users','meta'];
export const DB = Object.fromEntries(COLS.map(c => [c, []]));
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const DEFAULTS = {
  company: 'PontoCom Tecnologia',
  whats: '(88) 98170-5071',
  city: 'Senador Pompeu - CE',
  doc: '',
  color: '#f5a300',
  logo: '',
  warrantyEquip: 12,
  warrantyLabor: 6,
  validity: 7,
  terms: 'Garantia de 12 meses nos equipamentos e 6 meses na mão de obra.',
  checklists: {
    'Cerca elétrica': ['Instalar hastes e isoladores','Passar o fio e fechar os circuitos','Instalar e testar a central de choque','Instalar a sirene','Testar o aterramento','Instalar as placas de aviso','Testar o funcionamento e orientar o cliente'],
    'Cerca cortante': ['Fixar suportes e cabo de aço','Instalar a concertina','Conferir fixação e acabamento','Orientar o cliente'],
    'Motor de portão': ['Verificar roldanas, trilho e estado do portão','Fixar motor e cremalheira','Ajustar o fim de curso','Cadastrar os controles','Testar o sensor anti-esmagamento','Orientar o cliente'],
    'Interfone': ['Passar o cabeamento','Instalar a unidade externa','Instalar os terminais internos','Testar áudio e abertura da fechadura','Orientar o cliente'],
    'Câmeras de segurança': ['Definir os pontos de instalação','Instalar câmeras e cabeamento','Instalar e configurar DVR/NVR e HD','Configurar acesso remoto no celular do cliente','Testar gravação e imagem noturna','Orientar o cliente'],
    'Alarme': ['Instalar a central','Instalar os sensores','Instalar a sirene','Cadastrar controles e senhas','Testar todos os setores','Orientar o cliente'],
    'Manutenção': ['Inspeção geral','Limpar e reapertar as conexões','Testar o funcionamento','Registrar defeitos encontrados','Orientar o cliente'],
    'Outro': ['Executar o serviço','Testar o funcionamento','Orientar o cliente']
  }
};

export const DEFAULT_KITS = [
  { name: 'Kit 4 câmeras', items: [['4','Câmera bullet 2MP','0'],['1','DVR 4 canais','0'],['1','HD 1TB','0'],['1','Fonte 12V e conectores','0'],['1','Mão de obra de instalação','0']] },
  { name: 'Cerca elétrica residencial', items: [['1','Central de choque','0'],['1','Sirene','0'],['1','Kit hastes e isoladores','0'],['1','Fio de aço (rolo)','0'],['1','Mão de obra de instalação','0']] },
  { name: 'Motor de portão deslizante', items: [['1','Motor deslizante','0'],['1','Cremalheira','0'],['2','Controle remoto','0'],['1','Mão de obra de instalação','0']] },
  { name: 'Interfone', items: [['1','Porteiro eletrônico','0'],['1','Terminal interno','0'],['1','Mão de obra de instalação','0']] }
];

let idb;
const req = r => new Promise((ok, err) => { r.onsuccess = () => ok(r.result); r.onerror = () => err(r.error); });
const st = (c, m = 'readonly') => idb.transaction(c, m).objectStore(c);

export function open() {
  return new Promise((ok, err) => {
    const r = indexedDB.open('pontocom-gestao', 1);
    r.onupgradeneeded = () => COLS.forEach(c => r.result.createObjectStore(c, { keyPath: 'id' }));
    r.onsuccess = () => { idb = r.result; ok(); };
    r.onerror = () => err(r.error);
  });
}
export async function loadAll() { for (const c of COLS) DB[c] = await req(st(c).getAll()); }
export async function put(c, o) {
  if (!o.id) o.id = uid();
  await req(st(c, 'readwrite').put(o));
  const i = DB[c].findIndex(x => x.id === o.id);
  if (i >= 0) DB[c][i] = o; else DB[c].push(o);
  return o;
}
export async function del(c, id) {
  await req(st(c, 'readwrite').delete(id));
  DB[c] = DB[c].filter(x => x.id !== id);
}
export const get = (c, id) => DB[c].find(x => x.id === id);

export async function nextNum(c) {
  const m = DB.meta.find(x => x.id === 'seq') || { id: 'seq' };
  m[c] = (m[c] || 0) + 1;
  await put('meta', m);
  return m[c];
}
export const settings = () => ({ ...DEFAULTS, ...(DB.meta.find(m => m.id === 'settings') || {}) });
export const saveSettings = s => put('meta', { ...s, id: 'settings' });

export const exportAll = () => Object.fromEntries(COLS.map(c => [c, DB[c]]));
export async function importAll(d) {
  for (const c of COLS) {
    await req(st(c, 'readwrite').clear());
    for (const o of (d[c] || [])) await req(st(c, 'readwrite').put(o));
  }
  await loadAll();
}
