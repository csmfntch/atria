// Suscripción mensual (mentores y estudiantes) con pagos por Wompi (PSE, Nequi, tarjetas).
//
// Flujo: POST /api/pagos/iniciar crea un pago pendiente y devuelve la URL del Web Checkout de Wompi.
// Wompi confirma el pago de dos formas: (1) al volver el usuario a /api/pagos/retorno, donde consultamos
// la transacción directamente a la API de Wompi, y (2) con el webhook /api/wompi/eventos (firma verificada).
// Ambas rutas son idempotentes: un pago aprobado solo suma 30 días una vez.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { falla, json, redirigir, sqlAhora } from './helpers.mjs';

const DIA_MS = 24 * 3600 * 1000;
const PERIODO_DIAS = 30;
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

export const firmaIntegridad = (referencia, centavos, moneda, secreto) => sha256(`${referencia}${centavos}${moneda}${secreto}`);

/** Checksum de un evento de Wompi: concatena las propiedades indicadas + timestamp + secreto de eventos. */
export function checksumEvento(evento, secreto) {
  const props = evento?.signature?.properties ?? [];
  const valores = props.map((p) => p.split('.').reduce((o, k) => o?.[k], evento.data) ?? '');
  return sha256(valores.join('') + evento.timestamp + secreto);
}
const iguales = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
const apiWompi = (publicKey) => (publicKey.startsWith('pub_prod_') ? 'https://production.wompi.co/v1' : 'https://sandbox.wompi.co/v1');

export function registrarSuscripcion({ db, q, ruta, config, fetchFn, exigir, suscripcionDe }) {
  /** Marca el pago según el estado de Wompi y, si se aprobó por primera vez, extiende la suscripción 30 días. */
  function aplicarTransaccion({ reference: referencia, status, amount_in_cents: centavos, id }) {
    const pago = q('SELECT * FROM pagos WHERE referencia = ?').get(referencia);
    if (!pago) return null;
    if (centavos !== undefined && Number(centavos) !== pago.monto_cop * 100) {
      console.warn(`Pago ${referencia}: el monto no coincide (${centavos} vs ${pago.monto_cop * 100}). Ignorado.`);
      return pago;
    }
    const estado = { APPROVED: 'aprobado', DECLINED: 'rechazado', VOIDED: 'rechazado', ERROR: 'error' }[status];
    if (!estado || pago.estado === 'aprobado') return pago;
    db.exec('BEGIN');
    try {
      const { changes } = q(`UPDATE pagos SET estado = ?, proveedor_id = ? WHERE id = ? AND estado != 'aprobado'`)
        .run(estado, String(id ?? ''), pago.id);
      if (changes && estado === 'aprobado') {
        const actual = q('SELECT vence FROM suscripciones WHERE usuario_id = ?').get(pago.usuario_id);
        const base = Math.max(Date.now(), actual ? Date.parse(actual.vence.replace(' ', 'T') + 'Z') : 0);
        q(`INSERT INTO suscripciones (usuario_id, vence) VALUES (?, ?)
           ON CONFLICT(usuario_id) DO UPDATE SET vence = excluded.vence`).run(pago.usuario_id, sqlAhora(base + PERIODO_DIAS * DIA_MS));
      }
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    return q('SELECT * FROM pagos WHERE id = ?').get(pago.id);
  }

  ruta('GET', '/api/suscripcion', ({ usuario }) => {
    exigir(usuario);
    return {
      suscripcion: suscripcionDe(usuario),
      modo: config.wompi ? 'wompi' : config.pagosSimulados ? 'simulado' : 'ninguno',
      pagos: q('SELECT id, monto_cop, estado, creado FROM pagos WHERE usuario_id = ? ORDER BY id DESC LIMIT 12').all(usuario.id),
    };
  });

  ruta('POST', '/api/pagos/iniciar', ({ usuario }) => {
    exigir(usuario);
    if (!config.wompi && !config.pagosSimulados) falla(503, 'Los pagos aún no están configurados.');
    const monto = config.precios[usuario.rol];
    const referencia = `ARTIA-${randomBytes(8).toString('hex')}`;
    const { lastInsertRowid } = q('INSERT INTO pagos (usuario_id, referencia, monto_cop, proveedor) VALUES (?,?,?,?)')
      .run(usuario.id, referencia, monto, config.wompi ? 'wompi' : 'simulado');
    if (!config.wompi) return json(201, { modo: 'simulado', pago_id: Number(lastInsertRowid), monto });
    const centavos = monto * 100;
    const params = new URLSearchParams({
      'public-key': config.wompi.publicKey, currency: 'COP', 'amount-in-cents': String(centavos), reference: referencia,
      'signature:integrity': firmaIntegridad(referencia, centavos, 'COP', config.wompi.integritySecret),
      'redirect-url': `${config.baseUrl}/api/pagos/retorno`,
    });
    return json(201, { modo: 'wompi', url: `https://checkout.wompi.co/p/?${params}`, monto });
  });

  // Solo desarrollo (PAGOS_SIMULADOS=1, nunca en producción): aprueba un pago sin pasar por Wompi.
  ruta('POST', '/api/pagos/simular', ({ usuario, body }) => {
    exigir(usuario);
    if (!config.pagosSimulados) falla(404, 'No encontrado.');
    const p = q(`SELECT * FROM pagos WHERE id = ? AND usuario_id = ? AND proveedor = 'simulado'`).get(body.pago_id, usuario.id) ?? falla(404, 'Pago no encontrado.');
    aplicarTransaccion({ reference: p.referencia, status: 'APPROVED', amount_in_cents: p.monto_cop * 100, id: `sim-${p.id}` });
    return { suscripcion: suscripcionDe(usuario) };
  });

  // Wompi devuelve al usuario aquí con ?id=<transacción>. No confiamos en la URL: consultamos la transacción a Wompi.
  ruta('GET', '/api/pagos/retorno', async ({ query }) => {
    let resultado = 'fallo';
    try {
      if (config.wompi && /^[\w-]{3,64}$/.test(query.id ?? '')) {
        const r = await fetchFn(`${apiWompi(config.wompi.publicKey)}/transactions/${encodeURIComponent(query.id)}`);
        const tx = (await r.json())?.data;
        if (tx?.reference) {
          const pago = aplicarTransaccion(tx);
          resultado = pago?.estado === 'aprobado' ? 'ok' : tx.status === 'PENDING' ? 'pendiente' : 'fallo';
        }
      }
    } catch (e) { console.error('Error consultando Wompi:', e.message); resultado = 'pendiente'; }
    return redirigir(`/#/suscripcion?pago=${resultado}`);
  });

  ruta('POST', '/api/wompi/eventos', ({ body }) => {
    if (!config.wompi?.eventsSecret) falla(503, 'Webhook no configurado.');
    if (!iguales(checksumEvento(body, config.wompi.eventsSecret), body?.signature?.checksum ?? '')) falla(401, 'Firma inválida.');
    if (body.event === 'transaction.updated' && body.data?.transaction) aplicarTransaccion(body.data.transaction);
    return { ok: true };
  });
}
