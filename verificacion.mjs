// Verificación de mentores: cédula + título/certificado, revisados por un administrador.
import { randomBytes } from 'node:crypto';
import { falla, json, Resp, texto } from './helpers.mjs';

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

export function registrarVerificacion({ q, ruta, exigir, exigirAdmin, almacen }) {
  const documentosDe = (uid) => q('SELECT id, tipo, mime, creado FROM documentos WHERE usuario_id = ? ORDER BY id').all(uid);

  ruta('GET', '/api/verificacion', ({ usuario }) => {
    exigir(usuario, 'profesor');
    const docs = documentosDe(usuario.id);
    return {
      estado: usuario.verificacion_estado, nota: usuario.verificacion_nota, documento: usuario.documento,
      documentos: docs, completo: !!usuario.documento && TIPOS_DOC.every((t) => docs.some((d) => d.tipo === t)),
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

  ruta('POST', '/api/verificacion/enviar', ({ usuario }) => {
    exigir(usuario, 'profesor');
    if (!['sin_enviar', 'rechazado'].includes(usuario.verificacion_estado)) falla(409, 'Ya enviaste tu verificación.');
    if (!usuario.documento) falla(400, 'Agrega el número de tu cédula en tu perfil.');
    const docs = documentosDe(usuario.id);
    if (!TIPOS_DOC.every((t) => docs.some((d) => d.tipo === t))) falla(400, 'Sube tu cédula y tu título o certificado.');
    q(`UPDATE usuarios SET verificacion_estado = 'pendiente', verificacion_nota = '' WHERE id = ?`).run(usuario.id);
    return { estado: 'pendiente' };
  });

  // ---------- administración ----------
  ruta('GET', '/api/admin/verificaciones', ({ usuario, query }) => {
    exigirAdmin(usuario);
    const estado = ['pendiente', 'verificado', 'rechazado'].includes(query.estado) ? query.estado : 'pendiente';
    const mentores = q(`SELECT id, nombre, email, ciudad, telefono, materias, experiencia, documento, verificacion_estado, creado
      FROM usuarios WHERE rol = 'profesor' AND verificacion_estado = ? ORDER BY id`).all(estado);
    return { mentores: mentores.map((m) => ({ ...m, documentos: documentosDe(m.id) })) };
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
