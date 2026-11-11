// Agenda: disponibilidad del mentor, reserva de horarios y reseñas.
import {
  falla, json, texto, entero, HORA_RE, FECHA_RE, aMinutos, aHHMM, hoyCol, minutosAhoraCol, sumarDias, diaSemana,
} from './helpers.mjs';

const ANTICIPACION_MIN = 120; // no se puede reservar con menos de 2 horas de anticipación
const MAX_DIAS = 30;

export function registrarAgenda({ db, q, ruta, VISIBLE, SELECT_CLASE, exigir, exigirSuscripcion, perfilEstudianteFalta }) {
  /** ¿Ya terminó la clase? (hora de Colombia) */
  const terminada = (fecha, hora, dur) => {
    const hoy = hoyCol();
    if (fecha < hoy) return true;
    return fecha === hoy && aMinutos(hora) + dur <= minutosAhoraCol();
  };
  const solapa = (a, b) => a.ini < b.fin && b.ini < a.fin;
  const activas = (campo, id, desde, hasta) => q(`SELECT fecha, hora, duracion_min FROM reservas
    WHERE ${campo} = ? AND estado IN ('pendiente','aceptada') AND fecha BETWEEN ? AND ?`).all(id, desde, hasta)
    .map((r) => ({ fecha: r.fecha, ini: aMinutos(r.hora), fin: aMinutos(r.hora) + r.duracion_min }));

  /** Horas libres de un mentor en una fecha para clases de `dur` minutos. */
  function horasLibres(profId, fecha, dur, ocupadas) {
    const ventanas = q('SELECT inicio, fin FROM horarios WHERE profesor_id = ? AND dia = ? ORDER BY inicio').all(profId, diaSemana(fecha));
    const hoy = hoyCol();
    const minimo = fecha === hoy ? minutosAhoraCol() + ANTICIPACION_MIN : 0;
    const libres = [];
    for (const v of ventanas) {
      for (let t = aMinutos(v.inicio); t + dur <= aMinutos(v.fin); t += dur) {
        const slot = { ini: t, fin: t + dur };
        if (t < minimo) continue;
        if (ocupadas.some((o) => o.fecha === fecha && solapa(o, slot))) continue;
        libres.push(aHHMM(t));
      }
    }
    return libres;
  }

  // ---------- disponibilidad semanal del mentor ----------
  ruta('GET', '/api/horarios', ({ usuario }) => {
    exigir(usuario, 'profesor');
    return { horarios: q('SELECT dia, inicio, fin FROM horarios WHERE profesor_id = ? ORDER BY dia, inicio').all(usuario.id) };
  });

  ruta('PUT', '/api/horarios', ({ usuario, body }) => {
    exigir(usuario, 'profesor');
    const lista = Array.isArray(body.horarios) ? body.horarios : falla(400, 'Formato de horarios no válido.');
    if (lista.length > 42) falla(400, 'Demasiados bloques de horario.');
    const bloques = lista.map((h) => {
      const dia = Number(h.dia);
      if (!Number.isInteger(dia) || dia < 0 || dia > 6) falla(400, 'Día no válido.');
      if (!HORA_RE.test(h.inicio) || !HORA_RE.test(h.fin)) falla(400, 'Las horas deben tener el formato HH:MM.');
      if (aMinutos(h.inicio) >= aMinutos(h.fin)) falla(400, 'La hora de inicio debe ser anterior a la hora de fin.');
      return { dia, inicio: h.inicio, fin: h.fin };
    });
    for (const [i, a] of bloques.entries()) {
      for (const b of bloques.slice(i + 1)) {
        if (a.dia === b.dia && aMinutos(a.inicio) < aMinutos(b.fin) && aMinutos(b.inicio) < aMinutos(a.fin))
          falla(400, 'Hay bloques de horario que se cruzan el mismo día.');
      }
    }
    db.exec('BEGIN');
    try {
      q('DELETE FROM horarios WHERE profesor_id = ?').run(usuario.id);
      const ins = q('INSERT INTO horarios (profesor_id, dia, inicio, fin) VALUES (?,?,?,?)');
      for (const b of bloques) ins.run(usuario.id, b.dia, b.inicio, b.fin);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    return { horarios: bloques };
  });

  // ---------- horarios disponibles de una clase ----------
  ruta('GET', '/api/clases/(\\d+)/disponibilidad', ({ params, query, usuario }) => {
    const c = q(`${SELECT_CLASE} WHERE c.id = ?`).get(params[0]) ?? falla(404, 'Clase no encontrada.');
    const visible = q(`${SELECT_CLASE} WHERE c.id = ? AND ${VISIBLE}`).get(params[0]);
    if (!visible && usuario?.id !== c.profesor_id) falla(404, 'Clase no encontrada.');
    const n = Math.min(MAX_DIAS, Math.max(1, Number.parseInt(query.dias ?? 14, 10) || 14));
    const hoy = hoyCol();
    const ocupadas = activas('profesor_id', c.profesor_id, hoy, sumarDias(hoy, n));
    const dias = [];
    for (let i = 0; i < n; i++) {
      const fecha = sumarDias(hoy, i);
      const horas = horasLibres(c.profesor_id, fecha, c.duracion_min, ocupadas);
      if (horas.length) dias.push({ fecha, dia: diaSemana(fecha), horas });
    }
    return { duracion_min: c.duracion_min, dias };
  });

  // ---------- reservas ----------
  ruta('POST', '/api/reservas', ({ usuario, body }) => {
    exigir(usuario, 'estudiante');
    exigirSuscripcion(usuario);
    const falta = perfilEstudianteFalta(usuario);
    if (falta) falla(409, falta);
    const clase = q(`${SELECT_CLASE} WHERE c.id = ? AND ${VISIBLE}`).get(body.clase_id) ?? falla(404, 'Clase no encontrada.');
    const fecha = String(body.fecha ?? ''), hora = String(body.hora ?? '');
    if (!FECHA_RE.test(fecha) || !HORA_RE.test(hora)) falla(400, 'Elige una fecha y una hora.');
    const hoy = hoyCol();
    if (fecha < hoy || fecha > sumarDias(hoy, MAX_DIAS)) falla(400, 'La fecha está fuera del rango disponible.');
    const ocupadas = activas('profesor_id', clase.profesor_id, fecha, fecha);
    if (!horasLibres(clase.profesor_id, fecha, clase.duracion_min, ocupadas).includes(hora))
      falla(409, 'Ese horario ya no está disponible. Elige otro.');
    const slot = { ini: aMinutos(hora), fin: aMinutos(hora) + clase.duracion_min };
    if (activas('estudiante_id', usuario.id, fecha, fecha).some((o) => solapa(o, slot)))
      falla(409, 'Ya tienes otra clase reservada a esa hora.');
    let id;
    try {
      id = Number(q('INSERT INTO reservas (clase_id, profesor_id, estudiante_id, fecha, hora, duracion_min, mensaje) VALUES (?,?,?,?,?,?,?)')
        .run(clase.id, clase.profesor_id, usuario.id, fecha, hora, clase.duracion_min, texto(body.mensaje, 500)).lastInsertRowid);
    } catch { falla(409, 'Ese horario acaba de ser reservado. Elige otro.'); }
    return json(201, { reserva: { id, estado: 'pendiente', fecha, hora } });
  });

  ruta('GET', '/api/reservas', ({ usuario }) => {
    exigir(usuario);
    const esProf = usuario.rol === 'profesor';
    const filas = q(`SELECT r.*, c.titulo, c.materia, c.precio_hora, c.modalidad, c.ciudad AS clase_ciudad,
        e.nombre AS estudiante_nombre, e.telefono AS estudiante_tel, e.grado AS estudiante_grado, e.colegio_tipo AS estudiante_colegio_tipo,
        e.es_menor AS estudiante_menor, e.acudiente_nombre, e.acudiente_celular,
        p.nombre AS profesor_nombre, p.telefono AS profesor_tel,
        rs.calificacion AS resena_calificacion, rs.comentario AS resena_comentario
      FROM reservas r JOIN clases c ON c.id = r.clase_id
      JOIN usuarios e ON e.id = r.estudiante_id JOIN usuarios p ON p.id = r.profesor_id
      LEFT JOIN resenas rs ON rs.reserva_id = r.id
      WHERE ${esProf ? 'r.profesor_id' : 'r.estudiante_id'} = ? ORDER BY r.fecha DESC, r.hora DESC`).all(usuario.id);
    return {
      reservas: filas.map((r) => {
        const fin = terminada(r.fecha, r.hora, r.duracion_min);
        // El celular se comparte solo con reservas aceptadas. Si el estudiante es menor, el mentor ve el del acudiente.
        let contacto = '', contactoDe = '';
        if (r.estado === 'aceptada') {
          if (!esProf) { contacto = r.profesor_tel; contactoDe = r.profesor_nombre; }
          else if (r.estudiante_menor) { contacto = r.acudiente_celular; contactoDe = `${r.acudiente_nombre} (acudiente)`; }
          else { contacto = r.estudiante_tel; contactoDe = r.estudiante_nombre; }
        }
        return {
          id: r.id, clase_id: r.clase_id, profesor_id: r.profesor_id, titulo: r.titulo, materia: r.materia,
          precio_hora: r.precio_hora, modalidad: r.modalidad, clase_ciudad: r.clase_ciudad, fecha: r.fecha, hora: r.hora, duracion_min: r.duracion_min,
          estado: r.estado, mensaje: r.mensaje, creado: r.creado, terminada: fin,
          estudiante_nombre: r.estudiante_nombre, profesor_nombre: r.profesor_nombre,
          ...(esProf ? { estudiante_grado: r.estudiante_grado, estudiante_colegio_tipo: r.estudiante_colegio_tipo } : {}),
          contacto, contacto_de: contactoDe,
          puede_resenar: !esProf && r.estado === 'aceptada' && fin && r.resena_calificacion == null,
          resena: r.resena_calificacion != null ? { calificacion: r.resena_calificacion, comentario: r.resena_comentario } : null,
        };
      }),
    };
  });

  ruta('PUT', '/api/reservas/(\\d+)', ({ usuario, body, params }) => {
    exigir(usuario);
    const r = q('SELECT * FROM reservas WHERE id = ?').get(params[0]) ?? falla(404, 'Reserva no encontrada.');
    const nuevo = body.estado;
    const esProf = usuario.id === r.profesor_id, esEst = usuario.id === r.estudiante_id;
    const pasada = terminada(r.fecha, r.hora, r.duracion_min);
    if (esProf && r.estado === 'pendiente' && ['aceptada', 'rechazada'].includes(nuevo)) {
      if (pasada) falla(409, 'Esa clase ya pasó.');
      if (nuevo === 'aceptada') exigirSuscripcion(usuario);
    } else if ((esProf || esEst) && nuevo === 'cancelada' && ['pendiente', 'aceptada'].includes(r.estado)) {
      if (pasada) falla(409, 'Esa clase ya pasó.');
    } else falla(403, 'No puedes hacer ese cambio.');
    q('UPDATE reservas SET estado = ? WHERE id = ?').run(nuevo, r.id);
    return { ok: true };
  });

  // ---------- reseñas (solo el estudiante, una vez la clase ya ocurrió) ----------
  ruta('POST', '/api/resenas', ({ usuario, body }) => {
    exigir(usuario, 'estudiante');
    const r = q('SELECT * FROM reservas WHERE id = ? AND estudiante_id = ?').get(body.reserva_id, usuario.id) ?? falla(404, 'Reserva no encontrada.');
    if (r.estado !== 'aceptada') falla(409, 'Solo puedes calificar clases que fueron aceptadas.');
    if (!terminada(r.fecha, r.hora, r.duracion_min)) falla(409, 'Podrás calificar cuando termine la clase.');
    const cal = entero(body.calificacion, { min: 1, max: 5, campo: 'calificación (1 a 5)' });
    try {
      q('INSERT INTO resenas (reserva_id, profesor_id, estudiante_id, calificacion, comentario) VALUES (?,?,?,?,?)')
        .run(r.id, r.profesor_id, usuario.id, cal, texto(body.comentario, 500));
    } catch { falla(409, 'Ya calificaste esta clase.'); }
    return json(201, { ok: true });
  });
}
