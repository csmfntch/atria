// Servidor de Artia: API JSON + archivos estáticos, sin dependencias.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { join, normalize, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirBD } from './db.mjs';
import {
  CIUDADES, MATERIAS, CATEGORIAS, materiasDe, NIVELES, MODALIDADES, LOCALIDADES_BOGOTA, COLEGIO_TIPOS, GRADOS, DIAS,
  normalizarCelular, normalizarDocumento, TERMINOS_VERSION,
} from './colombia.mjs';
import {
  ErrorHTTP, Resp, falla, json, hashClave, verificarClave, texto, entero, listaTexto,
  leerCookie, leerJSON, leerBinario, sqlAhora, hoyCol, minutosAhoraCol, aMinutos,
} from './helpers.mjs';
import { registrarAgenda } from './agenda.mjs';
import { registrarCalendario } from './calendario.mjs';
import { crearCorreo } from './correo.mjs';
import { crearNotificador } from './avisos.mjs';
import { registrarSuscripcion } from './suscripcion.mjs';
import { registrarVerificacion } from './verificacion.mjs';
import { registrarAdmin } from './admin.mjs';
import { crearAlmacen } from './almacen.mjs';
import { proveedorSimulado } from './kyc.mjs';
import { proveedorDidit } from './didit.mjs';

export { hashClave };

const aqui = dirname(fileURLToPath(import.meta.url));
const PUBLICO = join(aqui, 'public');
const SESION_MS = 30 * 24 * 3600 * 1000;
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
};

export function configDesdeEnv(env = process.env) {
  const produccion = env.NODE_ENV === 'production';
  return {
    seguro: produccion,
    baseUrl: (env.BASE_URL ?? (env.RAILWAY_PUBLIC_DOMAIN ? `https://${env.RAILWAY_PUBLIC_DOMAIN}` : `http://localhost:${env.PORT ?? 3100}`)).replace(/\/$/, ''),
    // Precios de la suscripción mensual en COP (se pueden cambiar con variables de entorno).
    precios: { profesor: Number(env.PRECIO_MENTOR ?? 59900), estudiante: Number(env.PRECIO_ESTUDIANTE ?? 24900) },
    wompi: env.WOMPI_PUBLIC_KEY && env.WOMPI_INTEGRITY_SECRET
      ? { publicKey: env.WOMPI_PUBLIC_KEY, integritySecret: env.WOMPI_INTEGRITY_SECRET, eventsSecret: env.WOMPI_EVENTS_SECRET ?? '' }
      : null,
    pagosSimulados: env.PAGOS_SIMULADOS === '1' && !produccion,
    // Detrás de un proxy (Render, Railway, Fly…) la IP real viene en X-Forwarded-For.
    confiarProxy: env.TRUST_PROXY === '1',
    // Datos de la empresa para los textos legales y contacto de soporte (se muestran en Términos, Privacidad y recuperación de clave).
    empresa: { nombre: env.EMPRESA_RAZON_SOCIAL ?? '', nit: env.EMPRESA_NIT ?? '', direccion: env.EMPRESA_DIRECCION ?? '', correo: env.EMPRESA_CORREO ?? '', ciudad: env.EMPRESA_CIUDAD ?? '' },
    soporte: env.SOPORTE_CONTACTO ?? '',
    legalRevisado: env.LEGAL_REVISADO === '1',
    // Correos con Resend: RESEND_API_KEY y EMAIL_REMITENTE (por ejemplo «Artia <avisos@tudominio.com>», con el dominio verificado en Resend).
    correo: env.RESEND_API_KEY && env.EMAIL_REMITENTE ? { apiKey: env.RESEND_API_KEY, remitente: env.EMAIL_REMITENTE } : null,
    limiteRegistros: Number(env.LIMITE_REGISTROS_HORA ?? 20),
    // KYC: simulado solo en desarrollo; en producción lo da el proveedor (Didit) cuando esté integrado.
    // KYC_PROVEEDOR=manual apaga Didit (verificación manual de documentos por un administrador) sin borrar las llaves.
    didit: env.KYC_PROVEEDOR !== 'manual' && env.DIDIT_API_KEY && env.DIDIT_WORKFLOW_ID && env.DIDIT_WEBHOOK_SECRET
      ? { apiKey: env.DIDIT_API_KEY, workflowId: env.DIDIT_WORKFLOW_ID, webhookSecret: env.DIDIT_WEBHOOK_SECRET } : null,
    kycSimulado: env.KYC_SIMULADO === '1' && !produccion,
    kycAutoAprobar: env.KYC_AUTO_APROBAR !== '0',
    adminEmails: (env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  };
}

// ---------- aplicación ----------
export function crearApp(db, configParcial = {}, { fetchFn = globalThis.fetch, almacen = null, kyc = null, correo: correoExterno = null } = {}) {
  const config = { ...configDesdeEnv({}), ...configParcial };
  const q = (sql) => db.prepare(sql);
  const intentos = new Map(); // limitador simple de inicio de sesión: ip -> {n, hasta}

  for (const email of config.adminEmails) q('UPDATE usuarios SET es_admin = 1 WHERE email = ?').run(email);

  // ----- consultas compartidas -----
  const SUSCRITO = (col) => `EXISTS (SELECT 1 FROM suscripciones s WHERE s.usuario_id = ${col} AND s.vence > datetime('now'))`;
  const suscripcionDe = (u) => {
    const s = q('SELECT vence FROM suscripciones WHERE usuario_id = ?').get(u.id);
    const activa = !!s && s.vence > new Date().toISOString().slice(0, 19).replace('T', ' ');
    return { activa, vence: s?.vence ?? null, precio: config.precios[u.rol], plan: u.rol === 'profesor' ? 'Mentor' : 'Estudiante' };
  };
  const resumenResenas = (profId) => q('SELECT COUNT(*) AS n, ROUND(AVG(calificacion), 1) AS promedio FROM resenas WHERE profesor_id = ?').get(profId);

  const publico = (u) => {
    const r = u.rol === 'profesor' ? resumenResenas(u.id) : { n: 0, promedio: null };
    return {
      id: u.id, rol: u.rol, nombre: u.nombre, ciudad: u.ciudad, bio: u.bio,
      materias: u.materias, tarifa: u.tarifa, modalidad: u.modalidad, experiencia: u.experiencia,
      verificado: u.verificacion_estado === 'verificado', promedio: r.promedio, num_resenas: r.n,
    };
  };
  /** Lista de «primeros pasos» de la cuenta (para guiar la suscripción y la primera reserva). */
  const pasosDe = (u) => {
    const contar = (sql) => q(sql).get(u.id).n;
    const suscrita = suscripcionDe(u).activa;
    if (u.rol === 'estudiante') {
      return [
        { id: 'perfil', ok: !perfilEstudianteFalta(u), texto: 'Completa tu perfil', enlace: '#/perfil' },
        { id: 'reserva', ok: contar('SELECT COUNT(*) AS n FROM reservas WHERE estudiante_id = ?') > 0, texto: 'Elige y reserva tu primera clase (pagas la suscripción al reservar)', enlace: '#/clases' },
      ];
    }
    return [
      { id: 'perfil', ok: !!(u.ciudad && u.telefono && u.materias && u.tarifa > 0), texto: 'Completa tu perfil', enlace: '#/perfil' },
      { id: 'verificacion', ok: u.verificacion_estado === 'verificado', nota: u.verificacion_estado === 'pendiente' ? 'En revisión' : '', texto: 'Verifica tu identidad (cédula y título)', enlace: '#/verificacion' },
      { id: 'suscripcion', ok: suscrita, texto: 'Activa tu suscripción', enlace: '#/suscripcion' },
      { id: 'clase', ok: contar('SELECT COUNT(*) AS n FROM clases WHERE profesor_id = ?') > 0, texto: 'Publica tu primera clase', enlace: '#/mis-clases' },
      { id: 'horarios', ok: contar('SELECT COUNT(*) AS n FROM horarios WHERE profesor_id = ?') > 0, texto: 'Define tus horarios disponibles', enlace: '#/horarios' },
    ];
  };
  // Clases aceptadas que ya terminaron y que el estudiante aún no ha calificado.
  const resenasPendientes = (u) => {
    if (u.rol !== 'estudiante') return 0;
    const hoy = hoyCol(), ahora = minutosAhoraCol();
    return q(`SELECT fecha, hora, duracion_min FROM reservas r WHERE estudiante_id = ? AND estado = 'aceptada' AND fecha <= ?
      AND NOT EXISTS (SELECT 1 FROM resenas WHERE reserva_id = r.id)`).all(u.id, hoy)
      .filter((r) => r.fecha < hoy || aMinutos(r.hora) + r.duracion_min <= ahora).length;
  };
  const privado = (u) => ({
    ...publico(u), email: u.email, telefono: u.telefono, es_admin: !!u.es_admin,
    documento: u.documento, documento_origen: u.documento_origen, verificacion_estado: u.verificacion_estado, verificacion_nota: u.verificacion_nota, kyc_estado: u.kyc_estado,
    nivel: u.nivel, intereses: u.intereses, colegio_tipo: u.colegio_tipo, colegio_nombre: u.colegio_nombre,
    localidad: u.localidad, grado: u.grado, es_menor: !!u.es_menor,
    acudiente_nombre: u.acudiente_nombre, acudiente_celular: u.acudiente_celular,
    clave_temporal: !!u.clave_temporal, terminos_ok: u.terminos_version === TERMINOS_VERSION, terminos_version: u.terminos_version,
    verificacion_autorizada: !!u.verificacion_autorizada,
    suscripcion: suscripcionDe(u), pasos: pasosDe(u), resenas_pendientes: resenasPendientes(u),
  });

  // Una clase es visible al público si el mentor está verificado y su suscripción está activa.
  const SELECT_CLASE = `SELECT c.*, u.nombre AS profesor_nombre,
      (u.verificacion_estado = 'verificado') AS verificado,
      (SELECT ROUND(AVG(calificacion), 1) FROM resenas r WHERE r.profesor_id = c.profesor_id) AS promedio,
      (SELECT COUNT(*) FROM resenas r WHERE r.profesor_id = c.profesor_id) AS num_resenas
    FROM clases c JOIN usuarios u ON u.id = c.profesor_id`;
  const VISIBLE = `c.activa = 1 AND u.suspendido = 0 AND u.verificacion_estado = 'verificado' AND ${SUSCRITO('u.id')}`;

  // ----- sesión -----
  function crearSesion(res, usuarioId) {
    const token = randomBytes(32).toString('hex');
    q('INSERT INTO sesiones (token, usuario_id, expira) VALUES (?,?,?)').run(token, usuarioId, Date.now() + SESION_MS);
    res.setHeader('Set-Cookie',
      `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESION_MS / 1000}${config.seguro ? '; Secure' : ''}`);
  }
  function usuarioActual(req) {
    const token = leerCookie(req, 'sid');
    if (!token) return null;
    const s = q('SELECT usuario_id, expira FROM sesiones WHERE token = ?').get(token);
    if (!s) return null;
    if (s.expira < Date.now()) { q('DELETE FROM sesiones WHERE token = ?').run(token); return null; }
    const u = q('SELECT * FROM usuarios WHERE id = ?').get(s.usuario_id) ?? null;
    return u && !u.suspendido ? u : null;
  }
  const exigir = (u, rol) => {
    if (!u) falla(401, 'Debes iniciar sesión.');
    if (rol && u.rol !== rol) falla(403, `Solo disponible para ${rol === 'profesor' ? 'mentores' : 'estudiantes'}.`);
    return u;
  };
  const exigirAdmin = (u) => { exigir(u); if (!u.es_admin) falla(403, 'Solo para administradores.'); return u; };
  const exigirSuscripcion = (u) => {
    if (!suscripcionDe(u).activa) falla(402, 'Necesitas una suscripción activa. Actívala en la sección «Suscripción».');
  };
  const exigirMentorActivo = (u) => {
    exigir(u, 'profesor');
    if (u.verificacion_estado !== 'verificado') falla(403, 'Tu cuenta de mentor aún no está verificada.');
    exigirSuscripcion(u);
  };
  /** Mensaje de lo que falta del perfil del estudiante, o null si está completo. */
  const perfilEstudianteFalta = (u) => {
    if (!u.ciudad) return 'Indica tu ciudad en tu perfil.';
    if (!u.colegio_tipo) return 'Indica en tu perfil si tu colegio es público o privado.';
    if (u.colegio_tipo !== 'ninguno' && !u.colegio_nombre) return 'Indica el nombre de tu colegio en tu perfil.';
    if (u.es_menor && (!u.acudiente_nombre || !u.acudiente_celular)) return 'Como eres menor de edad, agrega los datos de tu acudiente en tu perfil.';
    return null;
  };

  // ---------- rutas ----------
  const rutas = [];
  const ruta = (metodo, patron, fn, opciones = {}) => rutas.push({ metodo, re: new RegExp(`^${patron}$`), fn, ...opciones });
  const correo = correoExterno ?? crearCorreo({ ...(config.correo ?? {}), baseUrl: config.baseUrl, fetchFn });
  const notificar = crearNotificador({ q, correo, baseUrl: config.baseUrl });
  const ctx = {
    notificar, db, q, ruta, config, fetchFn, almacen, kyc: kyc ?? (config.didit ? proveedorDidit({ ...config.didit, baseUrl: config.baseUrl, fetchFn }) : config.kycSimulado ? proveedorSimulado() : null), SUSCRITO, SELECT_CLASE, VISIBLE, suscripcionDe, publico, privado,
    exigir, exigirAdmin, exigirSuscripcion, exigirMentorActivo, perfilEstudianteFalta, resumenResenas,
  };

  // `version`: commit desplegado (Railway lo define), para comprobar qué versión está en línea.
  ruta('GET', '/api/salud', () => ({ ok: true, version: (process.env.RAILWAY_GIT_COMMIT_SHA ?? '').slice(0, 7) || 'local', kyc: ctx.kyc?.modo ?? 'ninguno', pagos: config.wompi ? 'wompi' : config.pagosSimulados ? 'simulado' : 'ninguno' }));

  ruta('GET', '/api/catalogo', () => ({
    ciudades: CIUDADES, materias: MATERIAS, categorias: CATEGORIAS, niveles: NIVELES, localidades: LOCALIDADES_BOGOTA,
    colegioTipos: COLEGIO_TIPOS, grados: GRADOS, dias: DIAS, terminosVersion: TERMINOS_VERSION,
    empresa: config.empresa, soporte: config.soporte, legalRevisado: config.legalRevisado,
  }));

  const materia = (v, campo = 'materia') => {
    const m = texto(v, 60, { requerido: true, campo });
    return MATERIAS.includes(m) ? m : falla(400, `Elige una ${campo} de la lista.`);
  };
  const listaMaterias = (v) => {
    const lista = listaTexto(v);
    for (const m of lista ? lista.split(', ') : []) if (!MATERIAS.includes(m)) falla(400, `«${m}» no está en la lista de materias.`);
    return lista;
  };
  // Intereses del estudiante: materias del catálogo y, si marca «Otra», textos propios (cortos y limitados).
  const listaIntereses = (v) =>
    [...new Set(String(v ?? '').split(',').map((x) => x.trim().slice(0, 40)).filter(Boolean))].slice(0, 60).join(', ');
  const clave = (v) => { const c = String(v ?? ''); if (c.length < 8) falla(400, 'La contraseña debe tener al menos 8 caracteres.'); return c; };
  const marcado = (v) => v === true || v === 'true' || v === '1' || v === 'on' || v === 1;

  const registros = new Map(); // ip -> { n, desde }
  ruta('POST', '/api/registro', ({ body, res, ip }) => {
    const rg = registros.get(ip);
    if (rg && Date.now() - rg.desde < 3_600_000 && rg.n >= config.limiteRegistros) falla(429, 'Demasiadas cuentas creadas desde esta conexión. Inténtalo más tarde.');
    const rol = body.rol === 'profesor' || body.rol === 'estudiante' ? body.rol : falla(400, 'Elige si eres mentor o estudiante.');
    const email = texto(body.email, 120, { requerido: true, campo: 'correo' }).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) falla(400, 'El correo no es válido.');
    const nombre = texto(body.nombre, 80, { requerido: true, campo: 'nombre' });
    const pass = clave(body.password);
    let colegio = '', menor = 0;
    if (rol === 'estudiante') {
      colegio = body.colegio_tipo in COLEGIO_TIPOS ? body.colegio_tipo : falla(400, 'Indica si tu colegio es público, privado o si no estás en un colegio.');
      menor = marcado(body.es_menor) ? 1 : 0;
    }
    // Autorizaciones expresas (Ley 1581 de 2012): sin ellas no se crea la cuenta.
    if (!marcado(body.acepta_terminos)) falla(400, 'Debes aceptar los Términos y Condiciones y la Política de Tratamiento de Datos para crear tu cuenta.');
    if (rol === 'profesor' && !marcado(body.autoriza_verificacion)) falla(400, 'Para ser mentor debes autorizar la verificación de tu identidad (cédula, selfie y documentos).');
    if (q('SELECT 1 FROM usuarios WHERE email = ?').get(email)) falla(409, 'Ya existe una cuenta con ese correo.');
    const ahora = sqlAhora();
    const { lastInsertRowid } = q('INSERT INTO usuarios (email, pass_hash, rol, nombre, colegio_tipo, es_menor, es_admin, terminos_version, terminos_fecha, verificacion_autorizada) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(email, hashClave(pass), rol, nombre, colegio, menor, config.adminEmails.includes(email) ? 1 : 0, TERMINOS_VERSION, ahora, rol === 'profesor' ? ahora : '');
    registros.set(ip, rg && Date.now() - rg.desde < 3_600_000 ? { ...rg, n: rg.n + 1 } : { n: 1, desde: Date.now() });
    crearSesion(res, Number(lastInsertRowid));
    return json(201, { usuario: privado(q('SELECT * FROM usuarios WHERE id = ?').get(lastInsertRowid)) });
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
    if (u.suspendido) falla(403, `Tu cuenta está suspendida o fue eliminada.${config.soporte ? ' Escríbenos a ' + config.soporte + '.' : ''}`);
    if (body.rol && body.rol !== u.rol && !u.es_admin)
      falla(403, u.rol === 'profesor' ? 'Esta cuenta es de mentor. Ingresa por «Soy mentor».' : 'Esta cuenta es de estudiante. Ingresa por «Soy estudiante».');
    crearSesion(res, u.id);
    return { usuario: privado(u) };
  });

  ruta('POST', '/api/logout', ({ req, res }) => {
    const token = leerCookie(req, 'sid');
    if (token) q('DELETE FROM sesiones WHERE token = ?').run(token);
    res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    return { ok: true };
  });

  ruta('POST', '/api/clave', ({ req, usuario, body }) => {
    exigir(usuario);
    if (!verificarClave(String(body.actual ?? ''), usuario.pass_hash)) falla(400, 'La contraseña actual no es correcta.');
    const nueva = clave(body.nueva);
    q('UPDATE usuarios SET pass_hash = ?, clave_temporal = 0 WHERE id = ?').run(hashClave(nueva), usuario.id);
    q('DELETE FROM sesiones WHERE usuario_id = ? AND token != ?').run(usuario.id, leerCookie(req, 'sid') ?? '');
    return { ok: true };
  });

  /**
   * Eliminar mi cuenta (derecho de supresión). Se borran los datos personales, los documentos y las sesiones; se desactivan
   * las clases y se cancelan las reservas futuras. Los registros de pagos y suscripciones se conservan, sin datos personales,
   * por obligaciones contables.
   */
  ruta('POST', '/api/cuenta/eliminar', async ({ res, usuario, body }) => {
    exigir(usuario);
    if (usuario.es_admin) falla(403, 'Una cuenta de administrador no se puede eliminar desde aquí.');
    if (!verificarClave(String(body.password ?? ''), usuario.pass_hash)) falla(400, 'La contraseña no es correcta.');
    const hoy = new Date().toISOString().slice(0, 10);
    for (const d of q('SELECT ruta FROM documentos WHERE usuario_id = ? AND ruta != ?').all(usuario.id, '')) {
      if (almacen) await almacen.borrar(d.ruta).catch((e) => console.error(e.message));
    }
    db.exec('BEGIN');
    try {
      q('DELETE FROM documentos WHERE usuario_id = ?').run(usuario.id);
      q('DELETE FROM sesiones WHERE usuario_id = ?').run(usuario.id);
      q('DELETE FROM horarios WHERE profesor_id = ?').run(usuario.id);
      q('DELETE FROM solicitudes WHERE estudiante_id = ?').run(usuario.id);
      q('UPDATE clases SET activa = 0 WHERE profesor_id = ?').run(usuario.id);
      q(`UPDATE reservas SET estado = 'cancelada' WHERE (profesor_id = ? OR estudiante_id = ?) AND estado IN ('pendiente','aceptada') AND fecha >= ?`).run(usuario.id, usuario.id, hoy);
      q(`UPDATE usuarios SET email = ?, nombre = 'Cuenta eliminada', pass_hash = '!', ciudad = '', telefono = '', bio = '', materias = '', tarifa = 0,
         experiencia = '', documento = '', nivel = '', intereses = '', colegio_nombre = '', localidad = '', grado = '', acudiente_nombre = '',
         acudiente_celular = '', kyc_sesion = '', kyc_resultado = '', verificacion_nota = '', cal_token = '', suspendido = 1 WHERE id = ?`).run(`eliminado-${usuario.id}@artia.invalid`, usuario.id);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    return { ok: true };
  });

  // Quien creó su cuenta con una versión anterior de los documentos debe aceptar la vigente.
  ruta('POST', '/api/terminos/aceptar', ({ usuario, body }) => {
    exigir(usuario);
    if (!marcado(body.acepta_terminos)) falla(400, 'Debes aceptar los Términos y la Política de Tratamiento de Datos.');
    q('UPDATE usuarios SET terminos_version = ?, terminos_fecha = ? WHERE id = ?').run(TERMINOS_VERSION, sqlAhora(), usuario.id);
    return { usuario: privado(q('SELECT * FROM usuarios WHERE id = ?').get(usuario.id)) };
  });

  ruta('GET', '/api/yo', ({ usuario }) => ({ usuario: usuario ? privado(usuario) : null }));

  ruta('PUT', '/api/perfil', ({ usuario, body }) => {
    exigir(usuario);
    const tel = body.telefono ? normalizarCelular(body.telefono) ?? falla(400, 'El celular debe tener 10 dígitos y empezar por 3 (ej. 300 123 4567).') : '';
    const nombre = texto(body.nombre, 80, { requerido: true, campo: 'nombre' });
    const ciudad = texto(body.ciudad, 60);
    if (ciudad && !CIUDADES.includes(ciudad)) falla(400, 'Selecciona una ciudad de la lista.');
    const bio = texto(body.bio, 600);

    if (usuario.rol === 'profesor') {
      const doc = body.documento ? normalizarDocumento(body.documento) ?? falla(400, 'La cédula debe tener entre 5 y 12 dígitos.') : '';
      const mod = MODALIDADES.includes(body.modalidad ?? 'ambas') ? (body.modalidad ?? 'ambas') : falla(400, 'Modalidad no válida.');
      q(`UPDATE usuarios SET nombre=?, ciudad=?, telefono=?, bio=?, materias=?, tarifa=?, modalidad=?, experiencia=?, documento=? WHERE id=?`)
        .run(nombre, ciudad, tel, bio, listaMaterias(body.materias), entero(body.tarifa, { campo: 'valor por hora', max: 5_000_000 }),
          mod, texto(body.experiencia, 600), doc, usuario.id);
    } else {
      const tipo = body.colegio_tipo in COLEGIO_TIPOS ? body.colegio_tipo : falla(400, 'Indica si tu colegio es público, privado o si no estás en un colegio.');
      const nombreColegio = tipo === 'ninguno' ? '' : texto(body.colegio_nombre, 100, { requerido: true, campo: 'nombre del colegio' });
      const localidad = texto(body.localidad, 40);
      if (localidad && !LOCALIDADES_BOGOTA.includes(localidad)) falla(400, 'Selecciona una localidad de Bogotá de la lista.');
      const grado = texto(body.grado, 30);
      if (grado && !GRADOS.includes(grado)) falla(400, 'Selecciona un grado de la lista.');
      const menor = marcado(body.es_menor) ? 1 : 0;
      let acuNombre = '', acuCel = '';
      if (menor) {
        acuNombre = texto(body.acudiente_nombre, 80, { requerido: true, campo: 'nombre del acudiente' });
        acuCel = normalizarCelular(body.acudiente_celular) ?? falla(400, 'El celular del acudiente debe tener 10 dígitos y empezar por 3.');
      }
      q(`UPDATE usuarios SET nombre=?, ciudad=?, telefono=?, bio=?, nivel=?, intereses=?, colegio_tipo=?, colegio_nombre=?, localidad=?,
           grado=?, es_menor=?, acudiente_nombre=?, acudiente_celular=? WHERE id=?`)
        .run(nombre, ciudad, tel, bio, texto(body.nivel, 60), listaIntereses(body.intereses), tipo, nombreColegio,
          tipo === 'ninguno' ? '' : localidad, grado, menor, acuNombre, acuCel, usuario.id);
    }
    return { usuario: privado(q('SELECT * FROM usuarios WHERE id = ?').get(usuario.id)) };
  });

  // ----- mentores (públicos solo si están verificados) -----
  ruta('GET', '/api/profesores/(\\d+)', ({ params, usuario }) => {
    const p = q(`SELECT * FROM usuarios WHERE id = ? AND rol = 'profesor'`).get(params[0]) ?? falla(404, 'Mentor no encontrado.');
    if ((p.verificacion_estado !== 'verificado' || p.suspendido) && usuario?.id !== p.id && !usuario?.es_admin) falla(404, 'Mentor no encontrado.');
    const clases = q(`${SELECT_CLASE} WHERE c.profesor_id = ? AND c.activa = 1 ORDER BY c.id DESC`).all(p.id);
    const resenas = q(`SELECT r.calificacion, r.comentario, r.creado, e.nombre AS autor FROM resenas r
      JOIN usuarios e ON e.id = r.estudiante_id WHERE r.profesor_id = ? ORDER BY r.id DESC LIMIT 50`).all(p.id)
      .map((r) => ({ ...r, autor: abreviar(r.autor) }));
    return { profesor: publico(p), clases: suscripcionDe(p).activa || usuario?.id === p.id ? clases : [], resenas };
  });
  const abreviar = (n) => { const [a, b] = n.split(' '); return b ? `${a} ${b[0]}.` : a; };

  // ----- clases -----
  ruta('GET', '/api/clases', ({ query }) => {
    const filtros = [VISIBLE];
    const args = [];
    const like = (s) => `%${s.replace(/[%_\\]/g, '\\$&')}%`;
    if (query.q) { filtros.push(`(c.titulo LIKE ? ESCAPE '\\' OR c.descripcion LIKE ? ESCAPE '\\' OR c.materia LIKE ? ESCAPE '\\')`); args.push(like(query.q), like(query.q), like(query.q)); }
    if (query.categoria) {
      const lista = materiasDe(query.categoria);
      filtros.push(`c.materia IN (${lista.map(() => '?').join(',') || "''"})`); args.push(...lista);
    }
    if (query.materia) { filtros.push('c.materia = ?'); args.push(query.materia); }
    if (query.ciudad) { filtros.push(`(c.ciudad = ? OR c.modalidad IN ('virtual','ambas'))`); args.push(query.ciudad); }
    if (query.modalidad && MODALIDADES.includes(query.modalidad) && query.modalidad !== 'ambas') {
      filtros.push(`c.modalidad IN (?, 'ambas')`); args.push(query.modalidad);
    }
    if (query.max && /^\d+$/.test(query.max)) { filtros.push('c.precio_hora <= ?'); args.push(Number(query.max)); }
    if (query.calificacion_min && /^[1-5]$/.test(query.calificacion_min)) {
      filtros.push('(SELECT AVG(calificacion) FROM resenas r WHERE r.profesor_id = c.profesor_id) >= ?'); args.push(Number(query.calificacion_min));
    }
    const orden = {
      precio_asc: 'c.precio_hora ASC, c.id DESC', precio_desc: 'c.precio_hora DESC, c.id DESC', recientes: 'c.id DESC',
    }[query.orden] ?? 'promedio IS NULL, promedio DESC, num_resenas DESC, c.id DESC';
    return { clases: q(`${SELECT_CLASE} WHERE ${filtros.join(' AND ')} ORDER BY ${orden} LIMIT 100`).all(...args) };
  });

  ruta('GET', '/api/clases/mias', ({ usuario }) => {
    exigir(usuario, 'profesor');
    const motivo = usuario.verificacion_estado !== 'verificado' ? 'Pendiente de verificación'
      : !suscripcionDe(usuario).activa ? 'Suscripción inactiva' : '';
    return { clases: q(`${SELECT_CLASE} WHERE c.profesor_id = ? ORDER BY c.id DESC`).all(usuario.id).map((c) => ({ ...c, oculta_por: c.activa ? motivo : '' })) };
  });

  ruta('GET', '/api/clases/(\\d+)', ({ params, usuario }) => {
    const c = q(`${SELECT_CLASE} WHERE c.id = ?`).get(params[0]) ?? falla(404, 'Clase no encontrada.');
    const visible = q(`${SELECT_CLASE} WHERE c.id = ? AND ${VISIBLE}`).get(params[0]);
    if (!visible && usuario?.id !== c.profesor_id && !usuario?.es_admin) falla(404, 'Clase no encontrada.');
    return { clase: c, profesor: publico(q('SELECT * FROM usuarios WHERE id = ?').get(c.profesor_id)), reservable: !!visible };
  });

  const leerClase = (body, usuario) => {
    const c = {
      titulo: texto(body.titulo, 100, { requerido: true, campo: 'título' }),
      materia: materia(body.materia, 'materia'),
      nivel: texto(body.nivel, 60), descripcion: texto(body.descripcion, 1000),
      precio: entero(body.precio_hora, { min: 5000, max: 5_000_000, campo: 'precio por hora (mínimo $5.000)' }),
      duracion: entero(body.duracion_min ?? 60, { min: 15, max: 480, campo: 'duración' }),
      mod: MODALIDADES.includes(body.modalidad) ? body.modalidad : falla(400, 'Modalidad no válida.'),
      ciudad: texto(body.ciudad || usuario.ciudad, 60),
    };
    if (c.mod !== 'virtual' && !c.ciudad) falla(400, 'Indica la ciudad para clases presenciales.');
    return c;
  };

  ruta('POST', '/api/clases', ({ usuario, body }) => {
    exigir(usuario, 'profesor');
    const c = leerClase(body, usuario);
    const { lastInsertRowid } = q(`INSERT INTO clases (profesor_id, titulo, materia, nivel, descripcion, precio_hora, duracion_min, modalidad, ciudad)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(usuario.id, c.titulo, c.materia, c.nivel, c.descripcion, c.precio, c.duracion, c.mod, c.ciudad);
    return json(201, { clase: q('SELECT * FROM clases WHERE id = ?').get(lastInsertRowid) });
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
    if (!q('DELETE FROM clases WHERE id = ? AND profesor_id = ?').run(params[0], usuario.id).changes) falla(404, 'Clase no encontrada.');
    return { ok: true };
  });

  // ----- solicitudes (el estudiante publica lo que busca; los mentores ofrecen) -----
  ruta('POST', '/api/solicitudes', ({ usuario, body }) => {
    exigir(usuario, 'estudiante');
    exigirSuscripcion(usuario);
    const mod = MODALIDADES.includes(body.modalidad ?? 'ambas') ? (body.modalidad ?? 'ambas') : falla(400, 'Modalidad no válida.');
    const c = texto(body.ciudad || usuario.ciudad, 60);
    if (mod !== 'virtual' && !c) falla(400, 'Indica tu ciudad para clases presenciales.');
    const { lastInsertRowid } = q('INSERT INTO solicitudes (estudiante_id, materia, descripcion, presupuesto, modalidad, ciudad) VALUES (?,?,?,?,?,?)')
      .run(usuario.id, materia(body.materia, 'materia'), texto(body.descripcion, 800),
        entero(body.presupuesto, { max: 5_000_000, campo: 'presupuesto' }), mod, c);
    return json(201, { id: Number(lastInsertRowid) });
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
    // Los mentores ven el grado y el tipo de colegio (no el nombre del colegio ni datos de contacto).
    const filas = q(`SELECT s.id, s.materia, s.descripcion, s.presupuesto, s.modalidad, s.ciudad, s.creado,
        e.nombre AS estudiante_nombre, e.nivel, e.grado, e.colegio_tipo,
        EXISTS (SELECT 1 FROM ofertas o WHERE o.solicitud_id = s.id AND o.profesor_id = ?) AS ya_ofrecido
      FROM solicitudes s JOIN usuarios e ON e.id = s.estudiante_id
      WHERE ${filtros.join(' AND ')} ORDER BY s.id DESC LIMIT 100`).all(usuario.id, ...args);
    return { solicitudes: filas };
  });

  ruta('POST', '/api/solicitudes/(\\d+)/ofertas', ({ usuario, body, params }) => {
    exigirMentorActivo(usuario);
    q('SELECT id FROM solicitudes WHERE id = ? AND abierta = 1').get(params[0]) ?? falla(404, 'Solicitud no encontrada.');
    let claseId = null;
    if (body.clase_id) claseId = (q('SELECT id FROM clases WHERE id = ? AND profesor_id = ?').get(body.clase_id, usuario.id) ?? falla(400, 'Esa clase no es tuya.')).id;
    const mensaje = texto(body.mensaje, 500, { requerido: true, campo: 'mensaje' });
    try { q('INSERT INTO ofertas (solicitud_id, profesor_id, clase_id, mensaje) VALUES (?,?,?,?)').run(params[0], usuario.id, claseId, mensaje); }
    catch { falla(409, 'Ya enviaste una oferta a esta solicitud.'); }
    notificar.oferta(Number(params[0]), usuario.id);
    return json(201, { ok: true });
  });

  ruta('DELETE', '/api/solicitudes/(\\d+)', ({ usuario, params }) => {
    exigir(usuario, 'estudiante');
    if (!q('DELETE FROM solicitudes WHERE id = ? AND estudiante_id = ?').run(params[0], usuario.id).changes) falla(404, 'Solicitud no encontrada.');
    return { ok: true };
  });

  registrarAgenda(ctx);
  registrarCalendario(ctx);
  registrarSuscripcion(ctx);
  registrarVerificacion(ctx);
  registrarAdmin(ctx);

  // ---------- despachador ----------
  manejar.avisos = notificar.procesar;
  return manejar;
  async function manejar(req, res) {
    try {
      const url = new URL(req.url, 'http://localhost');
      const ip = (config.confiarProxy && String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim()) || req.socket.remoteAddress || '?';
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'same-origin');
      res.setHeader('X-Frame-Options', 'DENY');

      if (url.pathname.startsWith('/api/')) {
        const r = rutas.find((x) => x.metodo === req.method && x.re.test(url.pathname));
        if (!r) {
          if (rutas.some((x) => x.re.test(url.pathname))) falla(405, 'Método no permitido.');
          falla(404, 'No encontrado.');
        }
        const cuerpo = ['POST', 'PUT'].includes(req.method) ? (r.binario ? await leerBinario(req, r.binario) : await leerJSON(req)) : {};
        const salida = await r.fn({
          req, res, ip, body: cuerpo, params: url.pathname.match(r.re).slice(1),
          query: Object.fromEntries(url.searchParams), usuario: usuarioActual(req),
        });
        const resp = salida instanceof Resp ? salida : json(200, salida);
        res.writeHead(resp.estado, resp.headers);
        return res.end(resp.cuerpo);
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') falla(405, 'Método no permitido.');
      const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
      let archivo = join(PUBLICO, rel === '/' ? 'index.html' : rel);
      if (!archivo.startsWith(PUBLICO)) falla(403, 'Prohibido.');
      let datos;
      try { datos = await readFile(archivo); }
      catch {
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
  // Base de datos: DB_PATH, o el volumen persistente de Railway, o ./data para desarrollo.
  const volumen = process.env.RAILWAY_VOLUME_MOUNT_PATH;
  const rutaBD = process.env.DB_PATH ?? (volumen ? join(volumen, 'artia.db') : join(aqui, 'data', 'artia.db'));
  if (process.env.NODE_ENV === 'production' && !process.env.DB_PATH && !volumen)
    console.warn('⚠ Sin volumen persistente: la base de datos se perderá en cada despliegue. Adjunta un volumen o define DB_PATH.');
  const db = abrirBD(rutaBD);
  if (process.argv.includes('--demo')) (await import('./demo.mjs')).sembrar(db, { hashClave });
  const puerto = Number(process.env.PORT ?? 3100);
  const config = configDesdeEnv();
  if (config.seguro && !config.didit) console.warn('⚠ DIDIT_* no configurado: la verificación de mentores será manual (revisión de documentos).');
  if (config.seguro && !config.wompi) console.warn('⚠ WOMPI_PUBLIC_KEY / WOMPI_INTEGRITY_SECRET no configurados: no se podrán cobrar suscripciones.');
  // Documentos de verificación: Supabase Storage (bucket privado) si hay SUPABASE_URL; si no, la base local.
  const almacen = process.env.SUPABASE_URL ? crearAlmacen({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY }) : null;
  const manejador = crearApp(db, config, { almacen });
  if (config.correo) setInterval(() => { try { manejador.avisos(); } catch (e) { console.error('Avisos:', e.message); } }, 10 * 60 * 1000).unref();
  else console.warn('⚠ RESEND_API_KEY / EMAIL_REMITENTE no configurados: no se enviarán correos.');
  createServer(manejador).listen(puerto, () =>
    console.log(`Artia en http://localhost:${puerto}  (BD: ${rutaBD}${config.wompi ? ', Wompi activo' : config.pagosSimulados ? ', pagos simulados' : ''}${almacen ? ', documentos en Supabase Storage' : ''})`));
}
