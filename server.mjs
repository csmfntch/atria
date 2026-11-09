// Servidor de Artia: API JSON + archivos estáticos, sin dependencias.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { join, normalize, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirBD } from './db.mjs';
import { CIUDADES, MATERIAS, NIVELES, MODALIDADES, normalizarCelular } from './colombia.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const PUBLICO = join(aqui, 'public');
const SESION_MS = 30 * 24 * 3600 * 1000;
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
};

class ErrorHTTP extends Error {
  constructor(estado, mensaje) { super(mensaje); this.estado = estado; }
}
const falla = (estado, mensaje) => { throw new ErrorHTTP(estado, mensaje); };

// ---------- utilidades ----------
function hashClave(clave) {
  const sal = randomBytes(16);
  return `${sal.toString('hex')}:${scryptSync(clave, sal, 64).toString('hex')}`;
}
function verificarClave(clave, guardado) {
  const [sal, hash] = guardado.split(':');
  const h = scryptSync(clave, Buffer.from(sal, 'hex'), 64);
  return timingSafeEqual(h, Buffer.from(hash, 'hex'));
}
const texto = (v, max, { requerido = false, campo = 'campo' } = {}) => {
  const s = String(v ?? '').trim().slice(0, max);
  if (requerido && !s) falla(400, `Falta el ${campo}.`);
  return s;
};
const entero = (v, { min = 0, max = 100_000_000, campo = 'valor' } = {}) => {
  const n = Number.parseInt(v ?? 0, 10);
  if (!Number.isFinite(n) || n < min || n > max) falla(400, `El ${campo} no es válido.`);
  return n;
};
const modalidad = (v) => (MODALIDADES.includes(v) ? v : falla(400, 'Modalidad no válida.'));
const ciudad = (v) => {
  const c = texto(v, 60);
  return c;
};
const listaTexto = (v, max = 200) =>
  [...new Set(String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean))].join(', ').slice(0, max);

function leerCookie(req, nombre) {
  for (const parte of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nombre) return decodeURIComponent(v.join('='));
  }
  return null;
}

async function leerJSON(req) {
  const trozos = [];
  let total = 0;
  for await (const t of req) {
    total += t.length;
    if (total > 50_000) falla(413, 'Solicitud demasiado grande.');
    trozos.push(t);
  }
  if (!total) return {};
  if (!String(req.headers['content-type'] ?? '').includes('application/json'))
    falla(415, 'Se esperaba JSON.');
  try { return JSON.parse(Buffer.concat(trozos).toString('utf8')); }
  catch { return falla(400, 'JSON inválido.'); }
}

// ---------- aplicación ----------
export function crearApp(db, { seguro = false } = {}) {
  const q = (sql) => db.prepare(sql);
  const intentos = new Map(); // limitador simple de inicio de sesión: ip -> {n, hasta}

  const publico = (u) => ({
    id: u.id, rol: u.rol, nombre: u.nombre, ciudad: u.ciudad, bio: u.bio,
    materias: u.materias, tarifa: u.tarifa, modalidad: u.modalidad,
    experiencia: u.experiencia, nivel: u.nivel, intereses: u.intereses,
  });
  const privado = (u) => ({ ...publico(u), email: u.email, telefono: u.telefono });

  function crearSesion(res, usuarioId) {
    const token = randomBytes(32).toString('hex');
    q('INSERT INTO sesiones (token, usuario_id, expira) VALUES (?,?,?)')
      .run(token, usuarioId, Date.now() + SESION_MS);
    res.setHeader('Set-Cookie',
      `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESION_MS / 1000}${seguro ? '; Secure' : ''}`);
  }
  function usuarioActual(req) {
    const token = leerCookie(req, 'sid');
    if (!token) return null;
    const s = q('SELECT usuario_id, expira FROM sesiones WHERE token = ?').get(token);
    if (!s) return null;
    if (s.expira < Date.now()) { q('DELETE FROM sesiones WHERE token = ?').run(token); return null; }
    return q('SELECT * FROM usuarios WHERE id = ?').get(s.usuario_id) ?? null;
  }
  const exigir = (u, rol) => {
    if (!u) falla(401, 'Debes iniciar sesión.');
    if (rol && u.rol !== rol) falla(403, `Solo disponible para ${rol === 'profesor' ? 'profesores' : 'estudiantes'}.`);
    return u;
  };

  // ---------- rutas ----------
  const rutas = [];
  const ruta = (metodo, patron, fn) => rutas.push({ metodo, re: new RegExp(`^${patron}$`), fn });

  ruta('GET', '/api/catalogo', () => ({ ciudades: CIUDADES, materias: MATERIAS, niveles: NIVELES }));

  ruta('POST', '/api/registro', ({ body, res, ip }) => {
    const rol = body.rol === 'profesor' || body.rol === 'estudiante' ? body.rol : falla(400, 'Elige si eres profesor o estudiante.');
    const email = texto(body.email, 120, { requerido: true, campo: 'correo' }).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) falla(400, 'El correo no es válido.');
    const clave = String(body.password ?? '');
    if (clave.length < 8) falla(400, 'La contraseña debe tener al menos 8 caracteres.');
    const nombre = texto(body.nombre, 80, { requerido: true, campo: 'nombre' });
    if (q('SELECT 1 FROM usuarios WHERE email = ?').get(email)) falla(409, 'Ya existe una cuenta con ese correo.');
    const { lastInsertRowid } = q('INSERT INTO usuarios (email, pass_hash, rol, nombre) VALUES (?,?,?,?)')
      .run(email, hashClave(clave), rol, nombre);
    crearSesion(res, Number(lastInsertRowid));
    return { estado: 201, datos: { usuario: privado(q('SELECT * FROM usuarios WHERE id = ?').get(lastInsertRowid)) } };
  });

  ruta('POST', '/api/login', ({ body, res, ip }) => {
    const reg = intentos.get(ip);
    if (reg && reg.hasta > Date.now() && reg.n >= 8) falla(429, 'Demasiados intentos. Espera unos minutos.');
    const u = q('SELECT * FROM usuarios WHERE email = ?').get(String(body.email ?? '').trim().toLowerCase());
    if (!u || !verificarClave(String(body.password ?? ''), u.pass_hash)) {
      const n = (reg && reg.hasta > Date.now() ? reg.n : 0) + 1;
      intentos.set(ip, { n, hasta: Date.now() + 10 * 60_000 });
      falla(401, 'Correo o contraseña incorrectos.');
    }
    intentos.delete(ip);
    crearSesion(res, u.id);
    return { usuario: privado(u) };
  });

  ruta('POST', '/api/logout', ({ req, res }) => {
    const token = leerCookie(req, 'sid');
    if (token) q('DELETE FROM sesiones WHERE token = ?').run(token);
    res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    return { ok: true };
  });

  ruta('GET', '/api/yo', ({ usuario }) => ({ usuario: usuario ? privado(usuario) : null }));

  ruta('PUT', '/api/perfil', ({ usuario, body }) => {
    exigir(usuario);
    const tel = body.telefono ? normalizarCelular(body.telefono) ?? falla(400, 'El celular debe tener 10 dígitos y empezar por 3 (ej. 300 123 4567).') : '';
    const comunes = [texto(body.nombre, 80, { requerido: true, campo: 'nombre' }), ciudad(body.ciudad), tel, texto(body.bio, 600)];
    if (usuario.rol === 'profesor') {
      q(`UPDATE usuarios SET nombre=?, ciudad=?, telefono=?, bio=?, materias=?, tarifa=?, modalidad=?, experiencia=? WHERE id=?`)
        .run(...comunes, listaTexto(body.materias), entero(body.tarifa, { campo: 'valor por hora', max: 5_000_000 }),
          modalidad(body.modalidad ?? 'ambas'), texto(body.experiencia, 600), usuario.id);
    } else {
      q(`UPDATE usuarios SET nombre=?, ciudad=?, telefono=?, bio=?, nivel=?, intereses=? WHERE id=?`)
        .run(...comunes, texto(body.nivel, 60), listaTexto(body.intereses), usuario.id);
    }
    return { usuario: privado(q('SELECT * FROM usuarios WHERE id = ?').get(usuario.id)) };
  });

  ruta('GET', '/api/profesores/(\\d+)', ({ params }) => {
    const p = q(`SELECT * FROM usuarios WHERE id = ? AND rol = 'profesor'`).get(params[0]) ?? falla(404, 'Profesor no encontrado.');
    const clases = q('SELECT * FROM clases WHERE profesor_id = ? AND activa = 1 ORDER BY id DESC').all(p.id);
    return { profesor: publico(p), clases };
  });

  // --- clases ---
  const SELECT_CLASE = `SELECT c.*, u.nombre AS profesor_nombre FROM clases c JOIN usuarios u ON u.id = c.profesor_id`;

  ruta('GET', '/api/clases', ({ query }) => {
    const filtros = ['c.activa = 1'];
    const args = [];
    const like = (s) => `%${s.replace(/[%_\\]/g, '\\$&')}%`;
    if (query.q) { filtros.push(`(c.titulo LIKE ? ESCAPE '\\' OR c.descripcion LIKE ? ESCAPE '\\' OR c.materia LIKE ? ESCAPE '\\')`); args.push(like(query.q), like(query.q), like(query.q)); }
    if (query.materia) { filtros.push('c.materia = ?'); args.push(query.materia); }
    if (query.ciudad) { filtros.push(`(c.ciudad = ? OR c.modalidad IN ('virtual','ambas'))`); args.push(query.ciudad); }
    if (query.modalidad && MODALIDADES.includes(query.modalidad)) {
      filtros.push(query.modalidad === 'ambas' ? '1=1' : `c.modalidad IN (?, 'ambas')`);
      if (query.modalidad !== 'ambas') args.push(query.modalidad);
    }
    if (query.max && /^\d+$/.test(query.max)) { filtros.push('c.precio_hora <= ?'); args.push(Number(query.max)); }
    return { clases: q(`${SELECT_CLASE} WHERE ${filtros.join(' AND ')} ORDER BY c.id DESC LIMIT 100`).all(...args) };
  });

  ruta('GET', '/api/clases/mias', ({ usuario }) => {
    exigir(usuario, 'profesor');
    return { clases: q(`${SELECT_CLASE} WHERE c.profesor_id = ? ORDER BY c.id DESC`).all(usuario.id) };
  });

  ruta('GET', '/api/clases/(\\d+)', ({ params }) => {
    const c = q(`${SELECT_CLASE} WHERE c.id = ? AND c.activa = 1`).get(params[0]) ?? falla(404, 'Clase no encontrada.');
    const prof = q('SELECT * FROM usuarios WHERE id = ?').get(c.profesor_id);
    return { clase: c, profesor: publico(prof) };
  });

  const leerClase = (body, usuario) => ({
    titulo: texto(body.titulo, 100, { requerido: true, campo: 'título' }),
    materia: texto(body.materia, 60, { requerido: true, campo: 'tema o materia' }),
    nivel: texto(body.nivel, 60),
    descripcion: texto(body.descripcion, 1000),
    precio: entero(body.precio_hora, { min: 5000, max: 5_000_000, campo: 'precio por hora (mínimo $5.000)' }),
    duracion: entero(body.duracion_min ?? 60, { min: 15, max: 480, campo: 'duración' }),
    mod: modalidad(body.modalidad),
    ciudad: ciudad(body.ciudad || usuario.ciudad),
  });

  ruta('POST', '/api/clases', ({ usuario, body }) => {
    exigir(usuario, 'profesor');
    const c = leerClase(body, usuario);
    if (c.mod !== 'virtual' && !c.ciudad) falla(400, 'Indica la ciudad para clases presenciales.');
    const { lastInsertRowid } = q(`INSERT INTO clases (profesor_id, titulo, materia, nivel, descripcion, precio_hora, duracion_min, modalidad, ciudad)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(usuario.id, c.titulo, c.materia, c.nivel, c.descripcion, c.precio, c.duracion, c.mod, c.ciudad);
    return { estado: 201, datos: { clase: q('SELECT * FROM clases WHERE id = ?').get(lastInsertRowid) } };
  });

  ruta('PUT', '/api/clases/(\\d+)', ({ usuario, body, params }) => {
    exigir(usuario, 'profesor');
    q('SELECT id FROM clases WHERE id = ? AND profesor_id = ?').get(params[0], usuario.id) ?? falla(404, 'Clase no encontrada.');
    const c = leerClase(body, usuario);
    q(`UPDATE clases SET titulo=?, materia=?, nivel=?, descripcion=?, precio_hora=?, duracion_min=?, modalidad=?, ciudad=?, activa=? WHERE id=?`)
      .run(c.titulo, c.materia, c.nivel, c.descripcion, c.precio, c.duracion, c.mod, c.ciudad, body.activa === false ? 0 : 1, params[0]);
    return { clase: q('SELECT * FROM clases WHERE id = ?').get(params[0]) };
  });

  ruta('DELETE', '/api/clases/(\\d+)', ({ usuario, params }) => {
    exigir(usuario, 'profesor');
    const r = q('DELETE FROM clases WHERE id = ? AND profesor_id = ?').run(params[0], usuario.id);
    if (!r.changes) falla(404, 'Clase no encontrada.');
    return { ok: true };
  });

  // --- reservas (el estudiante pide una clase; el profesor acepta o rechaza) ---
  ruta('POST', '/api/reservas', ({ usuario, body }) => {
    exigir(usuario, 'estudiante');
    const clase = q('SELECT * FROM clases WHERE id = ? AND activa = 1').get(body.clase_id) ?? falla(404, 'Clase no encontrada.');
    if (q(`SELECT 1 FROM reservas WHERE clase_id = ? AND estudiante_id = ? AND estado IN ('pendiente','aceptada')`).get(clase.id, usuario.id))
      falla(409, 'Ya tienes una solicitud activa para esta clase.');
    const { lastInsertRowid } = q('INSERT INTO reservas (clase_id, estudiante_id, mensaje) VALUES (?,?,?)')
      .run(clase.id, usuario.id, texto(body.mensaje, 500));
    return { estado: 201, datos: { reserva: { id: Number(lastInsertRowid), estado: 'pendiente' } } };
  });

  ruta('GET', '/api/reservas', ({ usuario }) => {
    exigir(usuario);
    const esProf = usuario.rol === 'profesor';
    const filas = q(`SELECT r.*, c.titulo, c.materia, c.precio_hora, c.modalidad, c.profesor_id,
        e.nombre AS estudiante_nombre, e.telefono AS estudiante_tel,
        p.nombre AS profesor_nombre, p.telefono AS profesor_tel
      FROM reservas r JOIN clases c ON c.id = r.clase_id
      JOIN usuarios e ON e.id = r.estudiante_id JOIN usuarios p ON p.id = c.profesor_id
      WHERE ${esProf ? 'c.profesor_id' : 'r.estudiante_id'} = ? ORDER BY r.id DESC`).all(usuario.id);
    // El celular de la otra persona solo se comparte cuando la reserva fue aceptada.
    return {
      reservas: filas.map(({ estudiante_tel, profesor_tel, ...r }) => ({
        ...r,
        contacto: r.estado === 'aceptada' ? (esProf ? estudiante_tel : profesor_tel) : '',
      })),
    };
  });

  ruta('PUT', '/api/reservas/(\\d+)', ({ usuario, body, params }) => {
    exigir(usuario);
    const r = q(`SELECT r.*, c.profesor_id FROM reservas r JOIN clases c ON c.id = r.clase_id WHERE r.id = ?`).get(params[0]) ?? falla(404, 'Reserva no encontrada.');
    const nuevo = body.estado;
    if (usuario.id === r.profesor_id && ['aceptada', 'rechazada'].includes(nuevo) && r.estado === 'pendiente') { /* ok */ }
    else if (usuario.id === r.estudiante_id && nuevo === 'cancelada' && ['pendiente', 'aceptada'].includes(r.estado)) { /* ok */ }
    else falla(403, 'No puedes hacer ese cambio.');
    q('UPDATE reservas SET estado = ? WHERE id = ?').run(nuevo, r.id);
    return { ok: true };
  });

  // --- solicitudes (el estudiante publica lo que busca; los profesores ofrecen) ---
  ruta('POST', '/api/solicitudes', ({ usuario, body }) => {
    exigir(usuario, 'estudiante');
    const mod = modalidad(body.modalidad ?? 'ambas');
    const c = ciudad(body.ciudad || usuario.ciudad);
    if (mod !== 'virtual' && !c) falla(400, 'Indica tu ciudad para clases presenciales.');
    const { lastInsertRowid } = q('INSERT INTO solicitudes (estudiante_id, materia, descripcion, presupuesto, modalidad, ciudad) VALUES (?,?,?,?,?,?)')
      .run(usuario.id, texto(body.materia, 60, { requerido: true, campo: 'tema o materia' }), texto(body.descripcion, 800),
        entero(body.presupuesto, { max: 5_000_000, campo: 'presupuesto' }), mod, c);
    return { estado: 201, datos: { id: Number(lastInsertRowid) } };
  });

  ruta('GET', '/api/solicitudes', ({ usuario, query }) => {
    exigir(usuario);
    if (usuario.rol === 'estudiante') {
      const filas = q('SELECT * FROM solicitudes WHERE estudiante_id = ? ORDER BY id DESC').all(usuario.id);
      const ofertas = q(`SELECT o.*, p.nombre AS profesor_nombre, p.tarifa, c.titulo AS clase_titulo
        FROM ofertas o JOIN usuarios p ON p.id = o.profesor_id LEFT JOIN clases c ON c.id = o.clase_id
        WHERE o.solicitud_id = ? ORDER BY o.id`);
      return { solicitudes: filas.map((s) => ({ ...s, ofertas: ofertas.all(s.id) })) };
    }
    const filtros = ['s.abierta = 1'];
    const args = [];
    if (query.materia) { filtros.push('s.materia = ?'); args.push(query.materia); }
    if (query.ciudad) { filtros.push(`(s.ciudad = ? OR s.modalidad IN ('virtual','ambas'))`); args.push(query.ciudad); }
    const filas = q(`SELECT s.id, s.materia, s.descripcion, s.presupuesto, s.modalidad, s.ciudad, s.creado,
        e.nombre AS estudiante_nombre, e.nivel,
        EXISTS (SELECT 1 FROM ofertas o WHERE o.solicitud_id = s.id AND o.profesor_id = ?) AS ya_ofrecido
      FROM solicitudes s JOIN usuarios e ON e.id = s.estudiante_id
      WHERE ${filtros.join(' AND ')} ORDER BY s.id DESC LIMIT 100`).all(usuario.id, ...args);
    return { solicitudes: filas };
  });

  ruta('POST', '/api/solicitudes/(\\d+)/ofertas', ({ usuario, body, params }) => {
    exigir(usuario, 'profesor');
    q('SELECT id FROM solicitudes WHERE id = ? AND abierta = 1').get(params[0]) ?? falla(404, 'Solicitud no encontrada.');
    let claseId = null;
    if (body.clase_id) {
      claseId = (q('SELECT id FROM clases WHERE id = ? AND profesor_id = ?').get(body.clase_id, usuario.id) ?? falla(400, 'Esa clase no es tuya.')).id;
    }
    const mensaje = texto(body.mensaje, 500, { requerido: true, campo: 'mensaje' });
    try { q('INSERT INTO ofertas (solicitud_id, profesor_id, clase_id, mensaje) VALUES (?,?,?,?)').run(params[0], usuario.id, claseId, mensaje); }
    catch { falla(409, 'Ya enviaste una oferta a esta solicitud.'); }
    return { estado: 201, datos: { ok: true } };
  });

  ruta('DELETE', '/api/solicitudes/(\\d+)', ({ usuario, params }) => {
    exigir(usuario, 'estudiante');
    const r = q('DELETE FROM solicitudes WHERE id = ? AND estudiante_id = ?').run(params[0], usuario.id);
    if (!r.changes) falla(404, 'Solicitud no encontrada.');
    return { ok: true };
  });

  // ---------- despachador ----------
  return async function manejar(req, res) {
    try {
      const url = new URL(req.url, 'http://localhost');
      const ip = req.socket.remoteAddress ?? '?';
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'same-origin');

      if (url.pathname.startsWith('/api/')) {
        const r = rutas.find((x) => x.metodo === req.method && x.re.test(url.pathname));
        if (!r) {
          if (rutas.some((x) => x.re.test(url.pathname))) falla(405, 'Método no permitido.');
          falla(404, 'No encontrado.');
        }
        const body = ['POST', 'PUT'].includes(req.method) ? await leerJSON(req) : {};
        const salida = await r.fn({
          req, res, ip, body, params: url.pathname.match(r.re).slice(1),
          query: Object.fromEntries(url.searchParams), usuario: usuarioActual(req),
        });
        const { estado = 200, datos = salida } = salida?.datos !== undefined ? salida : { datos: salida };
        res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify(datos));
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') falla(405, 'Método no permitido.');
      const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
      let archivo = join(PUBLICO, rel === '/' ? 'index.html' : rel);
      if (!archivo.startsWith(PUBLICO)) falla(403, 'Prohibido.');
      let datos;
      try { datos = await readFile(archivo); }
      catch { // la app usa rutas con # así que todo lo demás es 404 real, salvo "/"
        if (extname(rel)) falla(404, 'No encontrado.');
        archivo = join(PUBLICO, 'index.html');
        datos = await readFile(archivo);
      }
      res.writeHead(200, { 'Content-Type': TIPOS[extname(archivo)] ?? 'application/octet-stream' });
      return res.end(req.method === 'HEAD' ? undefined : datos);
    } catch (e) {
      const estado = e instanceof ErrorHTTP ? e.estado : 500;
      if (estado === 500) console.error(e);
      res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: estado === 500 ? 'Error interno del servidor.' : e.message }));
    }
  };
}

// ---------- arranque ----------
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ruta = process.env.DB_PATH ?? join(aqui, 'data', 'artia.db');
  const db = abrirBD(ruta);
  if (process.argv.includes('--demo')) (await import('./demo.mjs')).sembrar(db, { hashClave });
  const puerto = Number(process.env.PORT ?? 3100);
  createServer(crearApp(db, { seguro: process.env.NODE_ENV === 'production' }))
    .listen(puerto, () => console.log(`Artia en http://localhost:${puerto}  (BD: ${ruta})`));
}
