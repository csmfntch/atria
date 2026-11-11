// Calendario: archivo .ics por reserva y enlace de suscripción personal (iCal) para Google, Apple y Outlook.
import { randomBytes } from 'node:crypto';
import { falla, json, Resp, aMinutos, hoyCol, sumarDias } from './helpers.mjs';

const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
/** Pliega líneas a 75 caracteres, como exige el formato iCalendar. */
const plegar = (l) => (l.length <= 75 ? l : l.match(/.{1,74}/g).map((t, i) => (i ? ' ' + t : t)).join('\r\n'));
/** Fecha y hora de Colombia (UTC-5, sin horario de verano) → AAAAMMDDTHHMMSSZ en UTC. */
const aUTC = (fecha, minutos) => {
  const [y, m, d] = fecha.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 5, minutos));
  return dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
};

export function eventoReserva(r, { baseUrl, esProf }) {
  const ini = aMinutos(r.hora);
  const otro = esProf ? r.estudiante_nombre : r.profesor_nombre;
  const cancelada = ['cancelada', 'rechazada'].includes(r.estado);
  const lugar = r.modalidad === 'virtual' ? 'Virtual (acuerda el enlace con tu ' + (esProf ? 'estudiante' : 'mentor') + ')' : (r.clase_ciudad || 'Presencial');
  return [
    'BEGIN:VEVENT',
    `UID:reserva-${r.id}@artia`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `DTSTART:${aUTC(r.fecha, ini)}`,
    `DTEND:${aUTC(r.fecha, ini + r.duracion_min)}`,
    `SUMMARY:${esc(`${r.titulo} — con ${otro}`)}`,
    `DESCRIPTION:${esc(`Clase de ${r.materia} en Artia con ${otro}. Detalles y contacto: ${baseUrl}/#/agenda`)}`,
    `LOCATION:${esc(lugar)}`,
    `URL:${baseUrl}/#/clase/${r.clase_id}`,
    `STATUS:${cancelada ? 'CANCELLED' : r.estado === 'aceptada' ? 'CONFIRMED' : 'TENTATIVE'}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Clase en 1 hora', 'TRIGGER:-PT1H', 'END:VALARM',
    'END:VEVENT',
  ].map(plegar).join('\r\n');
}
const calendario = (nombre, eventos) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Artia//Clases//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
  `X-WR-CALNAME:${esc(nombre)}`, 'X-WR-TIMEZONE:America/Bogota', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H', ...eventos, 'END:VCALENDAR'].join('\r\n') + '\r\n';

export function registrarCalendario({ q, ruta, config, exigir }) {
  const SELECT = `SELECT r.*, c.titulo, c.materia, c.modalidad, c.ciudad AS clase_ciudad,
      e.nombre AS estudiante_nombre, p.nombre AS profesor_nombre
    FROM reservas r JOIN clases c ON c.id = r.clase_id
    JOIN usuarios e ON e.id = r.estudiante_id JOIN usuarios p ON p.id = r.profesor_id`;
  const archivo = (nombre, cuerpo, adjunto) => new Resp(200, {
    'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-store',
    ...(adjunto ? { 'Content-Disposition': `attachment; filename="${nombre}"` } : {}),
  }, cuerpo);

  // Una reserva (descarga desde la agenda).
  ruta('GET', '/api/reservas/(\\d+)/ics', ({ usuario, params }) => {
    exigir(usuario);
    const r = q(`${SELECT} WHERE r.id = ?`).get(params[0]);
    if (!r || (r.estudiante_id !== usuario.id && r.profesor_id !== usuario.id)) falla(404, 'Reserva no encontrada.');
    return archivo(`artia-clase-${r.id}.ics`, calendario('Artia', [eventoReserva(r, { baseUrl: config.baseUrl, esProf: usuario.id === r.profesor_id })]), true);
  });

  const tokenDe = (u, renovar = false) => {
    let t = renovar ? '' : q('SELECT cal_token FROM usuarios WHERE id = ?').get(u.id)?.cal_token;
    if (!t) { t = randomBytes(24).toString('hex'); q('UPDATE usuarios SET cal_token = ? WHERE id = ?').run(t, u.id); }
    return t;
  };
  const enlaces = (t) => ({ url: `${config.baseUrl}/api/calendario/${t}.ics`, webcal: `${config.baseUrl.replace(/^https?:/, 'webcal:')}/api/calendario/${t}.ics` });

  ruta('GET', '/api/calendario/enlace', ({ usuario }) => { exigir(usuario); return enlaces(tokenDe(usuario)); });
  ruta('POST', '/api/calendario/regenerar', ({ usuario }) => { exigir(usuario); return enlaces(tokenDe(usuario, true)); });

  // Suscripción: todas las reservas activas (y las canceladas de las últimas semanas, para que se borren del calendario).
  ruta('GET', '/api/calendario/([a-f0-9]{48})\\.ics', ({ params }) => {
    const u = q('SELECT id, rol FROM usuarios WHERE cal_token = ? AND suspendido = 0').get(params[0]);
    if (!u) falla(404, 'Enlace no válido.');
    const esProf = u.rol === 'profesor';
    const filas = q(`${SELECT} WHERE r.${esProf ? 'profesor_id' : 'estudiante_id'} = ? AND r.fecha >= ? ORDER BY r.fecha, r.hora`).all(u.id, sumarDias(hoyCol(), -30));
    return archivo('artia.ics', calendario('Artia — mis clases', filas.map((r) => eventoReserva(r, { baseUrl: config.baseUrl, esProf }))), false);
  });
}
