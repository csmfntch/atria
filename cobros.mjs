// Cobro de clases: el estudiante paga a Artia al reservar; Artia retiene su comisión y liquida al mentor cada mes.
//
// Estados de pago de una reserva (reservas.pago_estado):
//   por_pagar            reservada, esperando el pago (el horario se guarda 30 min)
//   pagado               pagada; el mentor la ve y puede aceptarla
//   reembolso_pendiente  hay que devolverle el dinero al estudiante (manual, desde el panel de Wompi)
//   reembolsado          devolución hecha
//   sin_pago             reservas anteriores al cobro, o reservas que expiraron sin pago
import { randomBytes } from 'node:crypto';
import { falla, json, texto, hoyCol, minutosAhoraCol, aMinutos, sumarDias } from './helpers.mjs';
import { urlCheckout } from './suscripcion.mjs';

export const MINUTOS_PARA_PAGAR = 30;
export const HORAS_CANCELACION = 24;
const BANCOS_TIPOS = ['ahorros', 'corriente', 'nequi', 'daviplata'];

/** Valor de una clase y comisión de Artia (en COP enteros). */
export const montos = (precioHora, duracionMin, pct) => {
  const monto = Math.round((precioHora * duracionMin) / 60);
  const comision = Math.round((monto * pct) / 100);
  return { monto, comision, neto: monto - comision };
};

/** Crea el pago de una reserva y devuelve lo que necesita el navegador para completarlo. */
export function crearPagoClase({ q, config }, usuario, reservaId, monto) {
  if (!config.wompi && !config.pagosSimulados) falla(503, 'Los pagos aún no están configurados.');
  const referencia = `CLASE-${reservaId}-${randomBytes(6).toString('hex')}`;
  const { lastInsertRowid } = q('INSERT INTO pagos (usuario_id, referencia, monto_cop, proveedor) VALUES (?,?,?,?)')
    .run(usuario.id, referencia, monto, config.wompi ? 'wompi' : 'simulado');
  q('UPDATE reservas SET pago_ref = ?, pago_estado = ? WHERE id = ?').run(referencia, 'por_pagar', reservaId);
  return config.wompi
    ? { modo: 'wompi', url: urlCheckout(config, referencia, monto), monto }
    : { modo: 'simulado', pago_id: Number(lastInsertRowid), monto };
}

export function registrarCobros(ctx) {
  const { q, ruta, config, exigir, exigirAdmin } = ctx;
  const pct = config.comisionPct;

  /** ¿Ya terminó la clase? (hora de Colombia) */
  const terminada = (r) => {
    const hoy = hoyCol();
    return r.fecha < hoy || (r.fecha === hoy && aMinutos(r.hora) + r.duracion_min <= minutosAhoraCol());
  };
  /** Minutos que faltan para que empiece la clase (negativo si ya empezó). */
  const minutosParaClase = (r) => {
    const hoy = hoyCol();
    const dias = Math.round((Date.parse(`${r.fecha}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / 86400000);
    return dias * 1440 + aMinutos(r.hora) - minutosAhoraCol();
  };

  // ----- el estudiante retoma el pago de una reserva que aún no pagó -----
  ruta('POST', '/api/reservas/(\\d+)/pagar', ({ usuario, params }) => {
    exigir(usuario, 'estudiante');
    const r = q(`SELECT * FROM reservas WHERE id = ? AND estudiante_id = ?`).get(params[0], usuario.id) ?? falla(404, 'Reserva no encontrada.');
    if (r.pago_estado !== 'por_pagar' || r.estado !== 'pendiente') falla(409, 'Esta reserva ya no está pendiente de pago.');
    return json(201, crearPagoClase(ctx, usuario, r.id, r.monto_cop));
  });

  // ----- mantenimiento: libera horarios sin pagar y devuelve lo de clases que el mentor nunca respondió -----
  function mantenimiento() {
    q(`UPDATE reservas SET estado = 'cancelada', pago_estado = 'sin_pago'
       WHERE pago_estado = 'por_pagar' AND estado = 'pendiente' AND creado < datetime('now', ?)`).run(`-${MINUTOS_PARA_PAGAR} minutes`);
    const hoy = hoyCol();
    for (const r of q(`SELECT id, fecha, hora, duracion_min FROM reservas WHERE estado = 'pendiente' AND pago_estado = 'pagado' AND fecha <= ?`).all(hoy)) {
      if (minutosParaClase(r) > 0) continue;
      q(`UPDATE reservas SET estado = 'cancelada', pago_estado = 'reembolso_pendiente' WHERE id = ?`).run(r.id);
    }
  }
  ctx.mantenimientoCobros = mantenimiento;

  // ----- datos del mentor para recibir sus pagos -----
  ruta('PUT', '/api/cuenta-cobro', ({ usuario, body }) => {
    exigir(usuario, 'profesor');
    const tipo = String(body.tipo ?? '');
    if (!BANCOS_TIPOS.includes(tipo)) falla(400, 'Elige el tipo de cuenta.');
    const numero = String(body.numero ?? '').replace(/[\s.-]/g, '');
    if (!/^\d{6,22}$/.test(numero)) falla(400, 'El número de cuenta o celular no es válido.');
    const banco = texto(body.banco, 60, { requerido: tipo !== 'nequi' && tipo !== 'daviplata', campo: 'banco' }) || (tipo === 'nequi' ? 'Nequi' : 'Daviplata');
    const titular = texto(body.titular, 80, { requerido: true, campo: 'titular de la cuenta' });
    q('UPDATE usuarios SET cuenta_banco = ?, cuenta_tipo = ?, cuenta_numero = ?, cuenta_titular = ? WHERE id = ?').run(banco, tipo, numero, titular, usuario.id);
    return { ok: true };
  });

  // Líneas que ya generan ganancia: clases pagadas que se dieron (aceptadas y terminadas) o canceladas tarde por el estudiante.
  const devengadas = (profId, soloSinLiquidar = true) => q(`SELECT r.*, c.titulo FROM reservas r JOIN clases c ON c.id = r.clase_id
      WHERE r.profesor_id = ? AND r.pago_estado = 'pagado' AND r.monto_cop > 0 ${soloSinLiquidar ? 'AND r.liquidacion_id IS NULL' : ''}
      ORDER BY r.fecha, r.hora`).all(profId)
    .filter((r) => (r.estado === 'aceptada' && terminada(r)) || r.estado === 'cancelada');
  const sumar = (lista) => lista.reduce((a, r) => ({ n: a.n + 1, bruto: a.bruto + r.monto_cop, comision: a.comision + r.comision_cop, neto: a.neto + r.monto_cop - r.comision_cop }), { n: 0, bruto: 0, comision: 0, neto: 0 });
  const porMes = (lista) => {
    const m = new Map();
    for (const r of lista) m.set(r.fecha.slice(0, 7), [...(m.get(r.fecha.slice(0, 7)) ?? []), r]);
    return m;
  };

  ruta('GET', '/api/ganancias', ({ usuario }) => {
    exigir(usuario, 'profesor');
    const pendientes = porMes(devengadas(usuario.id));
    const porRealizar = q(`SELECT monto_cop, comision_cop FROM reservas WHERE profesor_id = ? AND pago_estado = 'pagado' AND estado = 'aceptada' AND monto_cop > 0`).all(usuario.id)
      .length;
    return {
      comision_pct: pct,
      cuenta: { banco: usuario.cuenta_banco, tipo: usuario.cuenta_tipo, numero: usuario.cuenta_numero, titular: usuario.cuenta_titular },
      por_liquidar: [...pendientes].map(([mes, l]) => ({ mes, ...sumar(l) })).sort((a, b) => b.mes.localeCompare(a.mes)),
      clases_por_realizar: porRealizar,
      liquidaciones: q('SELECT mes, clases, bruto_cop, comision_cop, neto_cop, referencia, pagado_en FROM liquidaciones WHERE profesor_id = ? ORDER BY mes DESC').all(usuario.id),
    };
  });

  // ----- administración: pagos mensuales a mentores -----
  const mesActual = () => hoyCol().slice(0, 7);
  ruta('GET', '/api/admin/pagos-mentores', ({ usuario, query }) => {
    exigirAdmin(usuario);
    const mes = /^\d{4}-\d{2}$/.test(query.mes ?? '') ? query.mes : sumarDias(hoyCol().slice(0, 7) + '-01', -1).slice(0, 7);
    const filas = [];
    for (const m of q(`SELECT id, nombre, email, documento, cuenta_banco, cuenta_tipo, cuenta_numero, cuenta_titular FROM usuarios WHERE rol = 'profesor'`).all()) {
      const l = q('SELECT * FROM liquidaciones WHERE profesor_id = ? AND mes = ?').get(m.id, mes);
      const lista = devengadas(m.id).filter((r) => r.fecha.slice(0, 7) === mes);
      if (!l && !lista.length) continue;
      const t = l ? { n: l.clases, bruto: l.bruto_cop, comision: l.comision_cop, neto: l.neto_cop } : sumar(lista);
      filas.push({ profesor_id: m.id, nombre: m.nombre, email: m.email, documento: m.documento,
        cuenta: m.cuenta_numero ? { banco: m.cuenta_banco, tipo: m.cuenta_tipo, numero: m.cuenta_numero, titular: m.cuenta_titular } : null,
        ...t, liquidacion: l ? { referencia: l.referencia, pagado_en: l.pagado_en } : null });
    }
    return { mes, cerrado: mes < mesActual(), comision_pct: pct, mentores: filas };
  });

  ruta('POST', '/api/admin/liquidaciones', ({ usuario, body }) => {
    exigirAdmin(usuario);
    const mes = String(body.mes ?? '');
    if (!/^\d{4}-\d{2}$/.test(mes)) falla(400, 'Mes no válido.');
    if (mes >= mesActual()) falla(409, 'Solo puedes liquidar meses ya terminados.');
    const m = q(`SELECT id FROM usuarios WHERE id = ? AND rol = 'profesor'`).get(body.profesor_id) ?? falla(404, 'Mentor no encontrado.');
    if (q('SELECT 1 FROM liquidaciones WHERE profesor_id = ? AND mes = ?').get(m.id, mes)) falla(409, 'Ese mes ya fue liquidado.');
    const lista = devengadas(m.id).filter((r) => r.fecha.slice(0, 7) === mes);
    if (!lista.length) falla(409, 'No hay nada por pagar a este mentor en ese mes.');
    const t = sumar(lista);
    const ref = texto(body.referencia, 80, { requerido: true, campo: 'referencia de la transferencia' });
    ctx.db.exec('BEGIN');
    try {
      const { lastInsertRowid } = q('INSERT INTO liquidaciones (profesor_id, mes, clases, bruto_cop, comision_cop, neto_cop, referencia) VALUES (?,?,?,?,?,?,?)')
        .run(m.id, mes, t.n, t.bruto, t.comision, t.neto, ref);
      for (const r of lista) q('UPDATE reservas SET liquidacion_id = ? WHERE id = ?').run(Number(lastInsertRowid), r.id);
      ctx.db.exec('COMMIT');
    } catch (e) { ctx.db.exec('ROLLBACK'); throw e; }
    ctx.notificar.liquidacion?.(m.id, mes, t.neto, ref);
    return json(201, { ok: true });
  });

  // ----- administración: devoluciones pendientes (se hacen en el panel de Wompi y aquí se marcan) -----
  ruta('GET', '/api/admin/devoluciones', ({ usuario }) => {
    exigirAdmin(usuario);
    return {
      devoluciones: q(`SELECT r.id, r.fecha, r.hora, r.monto_cop, r.pago_ref, r.pago_estado, c.titulo, e.nombre AS estudiante, e.email AS estudiante_email,
          (SELECT proveedor_id FROM pagos WHERE referencia = r.pago_ref) AS transaccion
        FROM reservas r JOIN clases c ON c.id = r.clase_id JOIN usuarios e ON e.id = r.estudiante_id
        WHERE r.pago_estado = 'reembolso_pendiente' ORDER BY r.id`).all(),
    };
  });
  ruta('POST', '/api/admin/devoluciones/(\\d+)', ({ usuario, params }) => {
    exigirAdmin(usuario);
    const { changes } = q(`UPDATE reservas SET pago_estado = 'reembolsado' WHERE id = ? AND pago_estado = 'reembolso_pendiente'`).run(params[0]);
    if (!changes) falla(404, 'No hay una devolución pendiente para esa reserva.');
    ctx.notificar.devuelta?.(Number(params[0]));
    return { ok: true };
  });
}
