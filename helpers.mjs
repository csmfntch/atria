// Utilidades compartidas del servidor.
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export class ErrorHTTP extends Error {
  constructor(estado, mensaje) { super(mensaje); this.estado = estado; }
}
export const falla = (estado, mensaje) => { throw new ErrorHTTP(estado, mensaje); };

/** Respuesta explícita (estado, cabeceras, cuerpo). Las rutas que devuelven un objeto simple responden 200 JSON. */
export class Resp {
  constructor(estado, headers = {}, cuerpo = '') { this.estado = estado; this.headers = headers; this.cuerpo = cuerpo; }
}
export const json = (estado, datos) =>
  new Resp(estado, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, JSON.stringify(datos));
export const redirigir = (url) => new Resp(302, { Location: url, 'Cache-Control': 'no-store' });

// ---------- contraseñas ----------
export function hashClave(clave) {
  const sal = randomBytes(16);
  return `${sal.toString('hex')}:${scryptSync(clave, sal, 64).toString('hex')}`;
}
export function verificarClave(clave, guardado) {
  const [sal, hash] = guardado.split(':');
  return timingSafeEqual(scryptSync(clave, Buffer.from(sal, 'hex'), 64), Buffer.from(hash, 'hex'));
}

// ---------- validación ----------
export const texto = (v, max, { requerido = false, campo = 'campo' } = {}) => {
  const s = String(v ?? '').trim().slice(0, max);
  if (requerido && !s) falla(400, `Falta el ${campo}.`);
  return s;
};
export const entero = (v, { min = 0, max = 100_000_000, campo = 'valor' } = {}) => {
  const n = Number.parseInt(v ?? 0, 10);
  if (!Number.isFinite(n) || n < min || n > max) falla(400, `El ${campo} no es válido.`);
  return n;
};
export const listaTexto = (v, max = 200) =>
  [...new Set(String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean))].join(', ').slice(0, max);

export function leerCookie(req, nombre) {
  for (const parte of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nombre) return decodeURIComponent(v.join('='));
  }
  return null;
}

async function leerCuerpo(req, max) {
  const trozos = [];
  let total = 0;
  for await (const t of req) {
    total += t.length;
    if (total > max) falla(413, 'Solicitud demasiado grande.');
    trozos.push(t);
  }
  return Buffer.concat(trozos);
}
export async function leerJSON(req) {
  const buf = await leerCuerpo(req, 50_000);
  if (!buf.length) return {};
  if (!String(req.headers['content-type'] ?? '').includes('application/json')) falla(415, 'Se esperaba JSON.');
  try { return JSON.parse(buf.toString('utf8')); } catch { return falla(400, 'JSON inválido.'); }
}
export const leerBinario = (req, max) => leerCuerpo(req, max);

// ---------- fechas en hora de Colombia (UTC-5, sin horario de verano) ----------
const OFFSET_COL_MS = -5 * 3600 * 1000;
export const ahoraCol = () => new Date(Date.now() + OFFSET_COL_MS); // usar getUTC*()
export const fechaISO = (d) => d.toISOString().slice(0, 10);
export const hoyCol = () => fechaISO(ahoraCol());
export const minutosAhoraCol = () => { const d = ahoraCol(); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
export const aMinutos = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
export const aHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
export const sumarDias = (fecha, n) => { const d = new Date(`${fecha}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return fechaISO(d); };
export const diaSemana = (fecha) => new Date(`${fecha}T00:00:00Z`).getUTCDay(); // 0 = domingo
export const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Fecha y hora UTC en el formato de SQLite ('YYYY-MM-DD HH:MM:SS'). */
export const sqlAhora = (ms = Date.now()) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
