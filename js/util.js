import { cloud } from './store.js';
import { DB, settings } from './store.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const ACT = {};                 // ações chamadas pelos botões (data-act)
export const app = { refresh: () => {} };
export const me = { user: null };

/* ---------- formatação ---------- */
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const brl = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const pad = n => String(n || 0).padStart(4, '0');
export const digits = s => String(s || '').replace(/\D/g, '');
export const waNum = s => { const d = digits(s); return d.length <= 11 ? '55' + d : d; };
export const waLink = (phone, msg) => `https://wa.me/${phone ? waNum(phone) : ''}?text=${encodeURIComponent(msg)}`;

/* ---------- datas ---------- */
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => ymd(new Date());
export const parse = s => new Date(s + 'T12:00:00');
export const fmtDate = d => d ? String(d).slice(0, 10).split('-').reverse().join('/') : '';
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
export const addMonths = (s, n) => { const d = parse(s), day = d.getDate(); d.setMonth(d.getMonth() + n); if (d.getDate() !== day) d.setDate(0); return ymd(d); };
export const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
export const weekStart = s => addDays(s, -((parse(s).getDay() + 6) % 7));
export const lastMonths = n => { const base = today().slice(0, 8) + '01', out = []; for (let i = n - 1; i >= 0; i--) out.push(addMonths(base, -i).slice(0, 7)); return out; };
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const monthLabel = m => `${MES[+m.slice(5, 7) - 1]}/${m.slice(2, 4)}`;
export const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/* ---------- ícones (traço fino) ---------- */
const ICON = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.2c2.2.6 3.5 2.4 3.5 5.3"/>',
  clip: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
  doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  box: '<path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5l9 4.5 9-4.5M12 12v9"/>',
  money: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.7c0-1 1-1.7 2.5-1.7s2.5.7 2.5 1.7-1 1.5-2.5 1.8-2.5.8-2.5 1.8 1 1.7 2.5 1.7 2.5-.7 2.5-1.7"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  repeat: '<path d="M17 3l3 3-3 3"/><path d="M4 11V9a3 3 0 013-3h13M7 21l-3-3 3-3"/><path d="M20 13v2a3 3 0 01-3 3H4"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  bell: '<path d="M6 17v-6a6 6 0 0112 0v6l1.5 2h-15z"/><path d="M10 21h4"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-5M12 16V8M16 16v-8"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  camera: '<path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.5"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  wa: '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-2z"/>',
  print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 119.5 4 7 7 0 0020 14.5z"/>',
  out: '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.5v.5"/>',
  down: '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>'
};
export const ic = (n, c = '') => `<svg class="ic ${c}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n] || ''}</svg>`;

export const badge = (text, tone = 'mut') => `<span class="tag ${tone}"><i></i>${esc(text)}</span>`;
export const meta = (...p) => `<small class="meta">${p.filter(Boolean).map(x => `<span>${x}</span>`).join('')}</small>`;

/* ---------- toast e janelas ---------- */
let tt;
export function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2400);
}
export function modal(title, html, { wide = false } = {}) {
  const m = $('#modal');
  m.innerHTML = `<div class="m-bg" data-act="closeModal"></div><div class="m-box ${wide ? 'wide' : ''}" role="dialog" aria-label="${esc(title)}"><div class="m-h"><b>${esc(title)}</b><button class="x" data-act="closeModal" aria-label="Fechar">${ic('x')}</button></div><div class="m-b">${html}</div></div>`;
  m.classList.add('on'); document.body.classList.add('noscroll');
}
export function closeModal() { const m = $('#modal'); m.classList.remove('on'); m.innerHTML = ''; document.body.classList.remove('noscroll'); }
ACT.closeModal = closeModal;

/* ---------- formulários ---------- */
export function F(name, label, val = '', o = {}) {
  const t = o.type || 'text';
  let inp;
  if (t === 'textarea') inp = `<textarea name="${name}" rows="${o.rows || 3}" ${o.attrs || ''}>${esc(val)}</textarea>`;
  else if (t === 'select') inp = `<select name="${name}" ${o.req ? 'required' : ''} ${o.attrs || ''}>${(o.opts || []).map(x => { const [v, l] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
  else {
    const num = (t === 'money' || t === 'number') ? `type="number" step="${o.step || '0.01'}" inputmode="decimal" data-num` : `type="${t}"`;
    inp = `<input name="${name}" ${num} value="${esc(val)}" ${o.req ? 'required' : ''} placeholder="${esc(o.ph || '')}" ${o.attrs || ''}>`;
  }
  return `<div class="f ${o.full ? 'full' : ''}"><label>${label}</label>${inp}</div>`;
}
export function readForm(f) {
  const o = {};
  for (const el of f.elements) {
    if (!el.name || el.type === 'file') continue;
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else o[el.name] = el.hasAttribute('data-num') ? (el.value === '' ? 0 : +el.value) : el.value;
  }
  return o;
}

/* ---------- gráfico de barras (SVG próprio, funciona offline) ---------- */
const short = v => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(v >= 1e4 ? 0 : 1) + 'k' : Math.round(v);
export function barChart(labels, series, { h = 200 } = {}) {
  const W = 600, pt = 22, pb = 26, ph = h - pt - pb, n = labels.length, gw = W / n;
  const max = Math.max(1, ...series.flatMap(s => s.values));
  const bw = Math.min(36, (gw - 14) / series.length);
  let g = '';
  labels.forEach((l, i) => {
    const x0 = i * gw + gw / 2 - (bw * series.length) / 2;
    series.forEach((s, j) => {
      const v = s.values[i], bh = Math.max(v > 0 ? 2 : 0, v / max * ph), x = x0 + j * bw, y = pt + ph - bh;
      g += `<rect x="${x + 1}" y="${y}" width="${bw - 2}" height="${bh}" rx="3" fill="${s.color}" opacity="${(s.faded && s.faded[i]) ? 0.4 : 1}"/>`;
      if (v > 0) g += `<text x="${x + bw / 2}" y="${y - 5}" text-anchor="middle" class="cv">${short(v)}</text>`;
    });
    g += `<text x="${i * gw + gw / 2}" y="${h - 8}" text-anchor="middle" class="cl">${esc(l)}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${h}" class="chart" role="img">${g}</svg><div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`;
}

/* ---------- arquivos, imagens, impressão ---------- */
export async function saveFile(name, blob) {
  const file = new File([blob], name, { type: blob.type });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; } }
  catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export function toCSV(rows) {
  return '﻿' + rows.map(r => r.map(c => { const s = String(c ?? ''); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\n');
}
export function parseCSV(t) {
  const first = t.split(/\r?\n/)[0] || '';
  const d = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let r = [], c = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else if (ch === '"') q = true;
    else if (ch === d) { r.push(c); c = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; r.push(c); c = ''; if (r.some(x => x.trim())) rows.push(r); r = []; }
    else c += ch;
  }
  r.push(c); if (r.some(x => x.trim())) rows.push(r);
  return rows;
}
export function compressImage(file, max = cloud ? 1024 : 1280, q = cloud ? 0.6 : 0.72) {  /* online: fotos menores (limite de 1 MB por registro) */
  return new Promise((ok, err) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', q));
    };
    im.onerror = err; im.src = url;
  });
}
export function printHTML(html) { $('#print').innerHTML = html; setTimeout(() => window.print(), 250); }
export function printHeader(title, sub) {
  const s = settings();
  return `<div class="ph">${(s.icon || s.logo) ? `<img src="${s.icon || s.logo}" alt="">` : ''}<div><h2>${esc(s.company)}</h2><div>${esc(s.whats)} – ${esc(s.city)}${s.doc ? ' – ' + esc(s.doc) : ''}</div></div><div class="pr"><b>${esc(title)}</b><br>${esc(sub)}</div></div>`;
}

/* ---------- PIN local ---------- */
function weakHash(s) { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return 'x' + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16); }
export async function hashPin(pin, salt) {
  const s = salt + ':' + pin;
  if (globalThis.crypto && crypto.subtle) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  return weakHash(s);
}
export async function checkPin(pin, salt, stored) {
  if (stored.startsWith('x')) return weakHash(salt + ':' + pin) === stored;
  return (await hashPin(pin, salt)) === stored;
}
