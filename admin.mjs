// Administración: usuarios (buscar, suspender, clave temporal) y moderación de reseñas.
import { randomInt } from 'node:crypto';
import { falla, hashClave } from './helpers.mjs';

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; // sin caracteres que se confunden (0/O, 1/l/I)
const claveTemporal = () => Array.from({ length: 12 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');

export function registrarAdmin({ q, ruta, exigirAdmin }) {
  ruta('GET', '/api/admin/usuarios', ({ usuario, query }) => {
    exigirAdmin(usuario);
    const like = `%${String(query.q ?? '').trim().replace(/[%_\\]/g, '\\$&')}%`;
    return { usuarios: q(`SELECT id, nombre, email, rol, es_admin, suspendido, verificacion_estado, creado FROM usuarios
      WHERE (email LIKE ? ESCAPE '\\' OR nombre LIKE ? ESCAPE '\\') ORDER BY id DESC LIMIT 50`).all(like, like) };
  });

  ruta('PUT', '/api/admin/usuarios/(\\d+)/suspender', ({ usuario, params, body }) => {
    exigirAdmin(usuario);
    const u = q('SELECT id, es_admin FROM usuarios WHERE id = ?').get(params[0]) ?? falla(404, 'Usuario no encontrado.');
    if (u.es_admin) falla(403, 'No se puede suspender a un administrador.');
    const suspender = body.suspendido === true ? 1 : 0;
    q('UPDATE usuarios SET suspendido = ? WHERE id = ?').run(suspender, u.id);
    if (suspender) q('DELETE FROM sesiones WHERE usuario_id = ?').run(u.id);
    return { ok: true, suspendido: !!suspender };
  });

  // Recuperación de contraseña asistida: el administrador entrega una clave temporal (se muestra una sola vez).
  ruta('POST', '/api/admin/usuarios/(\\d+)/clave-temporal', ({ usuario, params }) => {
    exigirAdmin(usuario);
    const u = q('SELECT id, es_admin, email FROM usuarios WHERE id = ?').get(params[0]) ?? falla(404, 'Usuario no encontrado.');
    if (u.es_admin) falla(403, 'No se puede restablecer la contraseña de un administrador desde aquí.');
    if (u.email.endsWith('@artia.invalid')) falla(409, 'Esa cuenta fue eliminada.');
    const clave = claveTemporal();
    q('UPDATE usuarios SET pass_hash = ?, clave_temporal = 1 WHERE id = ?').run(hashClave(clave), u.id);
    q('DELETE FROM sesiones WHERE usuario_id = ?').run(u.id);
    return { clave, email: u.email };
  });

  ruta('GET', '/api/admin/resenas', ({ usuario }) => {
    exigirAdmin(usuario);
    return { resenas: q(`SELECT r.id, r.calificacion, r.comentario, r.creado, e.nombre AS autor, p.nombre AS mentor
      FROM resenas r JOIN usuarios e ON e.id = r.estudiante_id JOIN usuarios p ON p.id = r.profesor_id ORDER BY r.id DESC LIMIT 50`).all() };
  });

  ruta('DELETE', '/api/admin/resenas/(\\d+)', ({ usuario, params }) => {
    exigirAdmin(usuario);
    if (!q('DELETE FROM resenas WHERE id = ?').run(params[0]).changes) falla(404, 'Reseña no encontrada.');
    return { ok: true };
  });
}
