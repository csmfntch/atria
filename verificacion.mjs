// Verificación de mentores: cédula + título/certificado, revisados por un administrador.
import { randomBytes } from 'node:crypto';
import { falla, json, redirigir, Resp, texto } from './helpers.mjs';
import { evaluarResultado, resumen, normalizarNombre } from './kyc.mjs';

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'application/pdf': 'pdf' };

const MAX_DOC = 4 * 1024 * 1024; // 4 MB
const TIPOS_DOC = ['cedula', 'titulo'];

/** Detecta el tipo real del archivo por sus primeros bytes (no confía en el Content-Type del cliente). */
export function tipoArchivo(buf) {
  if (buf.length > 4 && buf[0] === 0x89 && buf.subarray(1, 4).toString('latin1') === 'PNG') return 'image/png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 4 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  return null;
}

export function registrarVerificacion({ q, ruta, exigir, exigirAdmin, almacen, kyc, config }) {
  const documentosDe = (uid) => q('SELECT id, tipo, mime, creado FROM documentos WHERE usuario_id = ? ORDER BY id').all(uid);
  const tieneTitulo = (uid) => documentosDe(uid).some((d) => d.tipo === 'titulo');
  const motivosDe = (u) => { try { return JSON.parse(u.kyc_resultado || '{}').motivos ?? []; } catch { return []; } };

  /**
   * Aplica un resultado normalizado del proveedor de KYC (webhook o simulación) al mentor dueño de la sesión.
   * - Rechazado por el proveedor → el mentor puede reintentar.
   * - Aprobado y todo coincide (cédula, nombre, rostro, vida) → si ya envió su verificación y subió su título,
   *   se verifica solo (KYC_AUTO_APROBAR, activado por defecto); si no, queda para el administrador.
   */
  function procesarResultadoKyc(r) {
    const u = q('SELECT * FROM usuarios WHERE kyc_sesion = ? AND rol = ?').get(r.sesionId, 'profesor');
    if (!u || u.verificacion_estado === 'verificado') return null;
    const decision = evaluarResultado(u, r);
    if (decision.kyc === 'pendiente') return decision;   // «en curso»: no pisa un resultado ya recibido
    // Los eventos pueden llegar desordenados: se ignora uno más antiguo que el ya guardado.
    try {
      const previo = JSON.parse(u.kyc_resultado || '{}').evento_ts;
      if (r.eventoTs && previo && r.eventoTs < previo) return null;
    } catch { /* sin resultado previo */ }
    q('UPDATE usuarios SET kyc_estado = ?, kyc_resultado = ? WHERE id = ?').run(decision.kyc, resumen(kyc?.nombre ?? 'proveedor', r, decision), u.id);
    if (decision.kyc === 'rechazado' && u.verificacion_estado === 'pendiente')
      q(`UPDATE usuarios SET verificacion_estado = 'rechazado', verificacion_nota = ? WHERE id = ?`).run('No pudimos verificar tu identidad. Inténtalo de nuevo con buena luz y el documento completo.', u.id);
    if (decision.kyc === 'aprobado' && u.verificacion_estado === 'pendiente' && config.kycAutoAprobar && tieneTitulo(u.id))
      q(`UPDATE usuarios SET verificacion_estado = 'verificado', verificacion_nota = '' WHERE id = ?`).run(u.id);
    return decision;
  }

  ruta('GET', '/api/verificacion', ({ usuario }) => {
    exigir(usuario, 'profesor');
    const docs = documentosDe(usuario.id);
    const conKyc = !!kyc;
    const completo = conKyc
      ? !!usuario.documento && docs.some((d) => d.tipo === 'titulo') && ['aprobado', 'revision'].includes(usuario.kyc_estado)
      : !!usuario.documento && TIPOS_DOC.every((t) => docs.some((d) => d.tipo === t));
    return {
      estado: usuario.verificacion_estado, nota: usuario.verificacion_nota, documento: usuario.documento,
      documentos: docs, completo,
      kyc: { modo: kyc?.modo ?? 'ninguno', estado: usuario.kyc_estado, motivos: motivosDe(usuario), auto: config.kycAutoAprobar },
    };
  });

  ruta('POST', '/api/verificacion/documentos', async ({ usuario, query, body }) => {
    exigir(usuario, 'profesor');
    if (!['sin_enviar', 'rechazado'].includes(usuario.verificacion_estado))
      falla(409, usuario.verificacion_estado === 'pendiente' ? 'Tu verificación está en revisión.' : 'Tu cuenta ya está verificada.');
    const tipo = TIPOS_DOC.includes(query.tipo) ? query.tipo : falla(400, 'Tipo de documento no válido.');
    if (!Buffer.isBuffer(body) || !body.length) falla(400, 'Adjunta un archivo.');
    const mime = tipoArchivo(body) ?? falla(415, 'El archivo debe ser una imagen JPG, PNG o un PDF.');
    // Con Supabase el archivo va al bucket privado; si no, a la base de datos local (desarrollo).
    let rutaObjeto = '', datos = body;
    if (almacen) {
      rutaObjeto = `${usuario.id}/${tipo}-${randomBytes(8).toString('hex')}.${EXT[mime]}`;
      try { await almacen.guardar(rutaObjeto, body, mime); }
      catch (e) { console.error(e.message); falla(502, 'No pudimos guardar el documento. Inténtalo de nuevo.'); }
      datos = Buffer.alloc(0);
    }
    const previos = q('SELECT id, ruta FROM documentos WHERE usuario_id = ? AND tipo = ?').all(usuario.id, tipo);
    const { lastInsertRowid } = q('INSERT INTO documentos (usuario_id, tipo, mime, datos, ruta) VALUES (?,?,?,?,?)').run(usuario.id, tipo, mime, datos, rutaObjeto);
    for (const d of previos) {
      q('DELETE FROM documentos WHERE id = ?').run(d.id);
      if (d.ruta && almacen) await almacen.borrar(d.ruta).catch((e) => console.error(e.message));
    }
    return json(201, { id: Number(lastInsertRowid), tipo, mime });
  }, { binario: MAX_DOC });

  // ---------- KYC: verificación de identidad con proveedor ----------
  ruta('POST', '/api/kyc/iniciar', async ({ usuario }) => {
    exigir(usuario, 'profesor');
    if (!kyc) falla(503, 'La verificación de identidad aún no está disponible.');
    if (usuario.verificacion_estado === 'verificado') falla(409, 'Tu cuenta ya está verificada.');
    if (!usuario.documento) falla(400, 'Agrega el número de tu cédula antes de iniciar.');
    if (normalizarNombre(usuario.nombre).split(' ').filter(Boolean).length < 2) falla(400, 'Escribe tu nombre y apellido completos en tu perfil, como aparecen en tu cédula.');
    let sesion;
    try { sesion = await kyc.crearSesion({ usuario }); } catch (e) { console.error(e.message); falla(502, 'No pudimos iniciar la verificación. Inténtalo de nuevo.'); }
    q('UPDATE usuarios SET kyc_estado = ?, kyc_sesion = ?, kyc_resultado = ? WHERE id = ?').run('pendiente', sesion.sesionId, '', usuario.id);
    return json(201, { modo: kyc.modo, url: sesion.url });
  });

  // Didit devuelve al mentor aquí (con ?verificationSessionId=…&status=…); el resultado real llega por el webhook.
  ruta('GET', '/api/kyc/retorno', () => redirigir('/#/verificacion?kyc=1'));

  // Webhook del proveedor. Se lee el cuerpo crudo (la firma se calcula sobre esos bytes) y se verifica ANTES de usarlo.
  ruta('POST', '/api/kyc/webhook', ({ req, body }) => {
    if (!kyc?.verificarWebhook) falla(404, 'No encontrado.');
    const evento = kyc.verificarWebhook(body, req.headers) ?? falla(401, 'Firma inválida.');
    const r = kyc.aResultado(evento);
    if (r) procesarResultadoKyc(r);
    return { ok: true };
  }, { binario: 2_000_000 });

  // Solo desarrollo (KYC_SIMULADO=1): fabrica un desenlace de prueba y lo procesa como si lo enviara el proveedor.
  ruta('POST', '/api/kyc/simular', ({ usuario, body }) => {
    exigir(usuario, 'profesor');
    if (kyc?.modo !== 'simulado') falla(404, 'No encontrado.');
    if (!usuario.kyc_sesion) falla(409, 'Primero inicia la verificación.');
    const desenlace = ['aprobado', 'rechazado', 'no_coincide'].includes(body.desenlace) ? body.desenlace : falla(400, 'Desenlace no válido.');
    procesarResultadoKyc(kyc.resultadoDePrueba(usuario, usuario.kyc_sesion, desenlace));
    const u = q('SELECT kyc_estado, kyc_resultado, verificacion_estado FROM usuarios WHERE id = ?').get(usuario.id);
    return { kyc_estado: u.kyc_estado, motivos: motivosDe(u), estado: u.verificacion_estado };
  });

  ruta('POST', '/api/verificacion/enviar', ({ usuario }) => {
    exigir(usuario, 'profesor');
    if (!['sin_enviar', 'rechazado'].includes(usuario.verificacion_estado)) falla(409, 'Ya enviaste tu verificación.');
    if (!usuario.documento) falla(400, 'Agrega el número de tu cédula en tu perfil.');
    const docs = documentosDe(usuario.id);
    if (kyc) {
      if (!docs.some((d) => d.tipo === 'titulo')) falla(400, 'Sube tu título o certificado.');
      if (usuario.kyc_estado === 'rechazado') falla(400, 'No se pudo verificar tu identidad. Inicia la verificación de nuevo.');
      if (!['aprobado', 'revision'].includes(usuario.kyc_estado)) falla(400, 'Completa primero la verificación de identidad.');
    } else if (!TIPOS_DOC.every((t) => docs.some((d) => d.tipo === t))) falla(400, 'Sube tu cédula y tu título o certificado.');
    // Identidad confirmada por el proveedor y todo coincide → se verifica automáticamente (si está activado)
    const auto = !!kyc && usuario.kyc_estado === 'aprobado' && config.kycAutoAprobar;
    q('UPDATE usuarios SET verificacion_estado = ?, verificacion_nota = ? WHERE id = ?').run(auto ? 'verificado' : 'pendiente', '', usuario.id);
    return { estado: auto ? 'verificado' : 'pendiente' };
  });

  // ---------- administración ----------
  ruta('GET', '/api/admin/verificaciones', ({ usuario, query }) => {
    exigirAdmin(usuario);
    const estado = ['pendiente', 'verificado', 'rechazado'].includes(query.estado) ? query.estado : 'pendiente';
    const mentores = q(`SELECT id, nombre, email, ciudad, telefono, materias, experiencia, documento, verificacion_estado, kyc_estado, kyc_resultado, creado
      FROM usuarios WHERE rol = 'profesor' AND verificacion_estado = ? ORDER BY id`).all(estado);
    return { mentores: mentores.map(({ kyc_resultado, ...m }) => ({ ...m, kyc_motivos: motivosDe({ kyc_resultado }), documentos: documentosDe(m.id) })) };
  });

  ruta('GET', '/api/admin/documentos/(\\d+)', async ({ usuario, params }) => {
    exigirAdmin(usuario);
    const d = q('SELECT mime, datos, ruta FROM documentos WHERE id = ?').get(params[0]) ?? falla(404, 'Documento no encontrado.');
    let contenido;
    if (d.ruta) {
      if (!almacen) falla(503, 'El almacenamiento de documentos no está configurado.');
      try { contenido = await almacen.leer(d.ruta); } catch (e) { console.error(e.message); falla(502, 'No pudimos leer el documento.'); }
    } else contenido = Buffer.from(d.datos);
    return new Resp(200, {
      'Content-Type': d.mime, 'Cache-Control': 'private, no-store',
      'Content-Security-Policy': "default-src 'none'; sandbox", 'Content-Disposition': 'inline',
    }, contenido);
  });

  ruta('PUT', '/api/admin/verificaciones/(\\d+)', ({ usuario, params, body }) => {
    exigirAdmin(usuario);
    const m = q(`SELECT id, verificacion_estado FROM usuarios WHERE id = ? AND rol = 'profesor'`).get(params[0]) ?? falla(404, 'Mentor no encontrado.');
    if (m.verificacion_estado !== 'pendiente') falla(409, 'Esa verificación no está pendiente.');
    if (!['verificado', 'rechazado'].includes(body.estado)) falla(400, 'Estado no válido.');
    const nota = texto(body.nota, 300, { requerido: body.estado === 'rechazado', campo: 'motivo del rechazo' });
    q('UPDATE usuarios SET verificacion_estado = ?, verificacion_nota = ? WHERE id = ?').run(body.estado, nota, m.id);
    return { ok: true };
  });
}
