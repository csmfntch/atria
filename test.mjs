// Pruebas de la API: node --test test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { abrirBD } from './db.mjs';
import { crearApp } from './server.mjs';
import { firmaIntegridad, checksumEvento } from './suscripcion.mjs';
import { hoyCol, sumarDias, diaSemana } from './helpers.mjs';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64');

/** Levanta un servidor con BD en memoria. */
async function iniciar(config = {}, deps = {}) {
  const db = abrirBD(':memory:');
  const servidor = createServer(crearApp(db, { pagosSimulados: true, ...config }, deps));
  await new Promise((r) => servidor.listen(0, r));
  const base = `http://localhost:${servidor.address().port}`;
  // cliente con cookie propia
  const cliente = () => {
    let cookie = '';
    const llamar = async (metodo, ruta, cuerpo, opciones = {}) => {
      const esBin = Buffer.isBuffer(cuerpo);
      const r = await fetch(base + ruta, {
        method: metodo, redirect: 'manual',
        headers: { ...(cuerpo ? { 'Content-Type': esBin ? 'application/octet-stream' : 'application/json' } : {}), cookie },
        body: cuerpo ? (esBin ? cuerpo : JSON.stringify(cuerpo)) : undefined,
      });
      cookie = r.headers.get('set-cookie')?.split(';')[0] ?? cookie;
      const tipo = r.headers.get('content-type') ?? '';
      return { estado: r.status, cabeceras: r.headers, datos: tipo.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer()) };
    };
    return llamar;
  };
  return { db, base, cliente, cerrar: () => servidor.close() };
}

const registrar = (c, rol, n, extra = {}) => c('POST', '/api/registro',
  { rol, nombre: n, email: `${n.toLowerCase().replace(/\W/g, '')}@x.co`, password: 'clave12345', ...(rol === 'estudiante' ? { colegio_tipo: 'publico' } : {}), ...extra });

const pagarSimulado = async (c) => {
  const p = await c('POST', '/api/pagos/iniciar');
  assert.equal(p.estado, 201);
  const r = await c('POST', '/api/pagos/simular', { pago_id: p.datos.pago_id });
  assert.equal(r.datos.suscripcion.activa, true);
};

/** Crea un mentor verificado y suscrito con una clase y disponibilidad todos los días 08:00-12:00. */
async function mentorListo(app, nombre = 'Laura', extraClase = {}) {
  const m = app.cliente();
  await registrar(m, 'profesor', nombre);
  await m('PUT', '/api/perfil', { nombre, ciudad: 'Bogotá D.C.', telefono: '3001234567', materias: 'Matemáticas', tarifa: 45000, documento: '52.123.456' });
  await m('POST', '/api/verificacion/documentos?tipo=cedula', PNG);
  await m('POST', '/api/verificacion/documentos?tipo=titulo', PNG);
  await m('POST', '/api/verificacion/enviar');
  const id = (await m('GET', '/api/yo')).datos.usuario.id;
  app.db.prepare(`UPDATE usuarios SET verificacion_estado='verificado' WHERE id=?`).run(id);
  await pagarSimulado(m);
  const clase = (await m('POST', '/api/clases', { titulo: 'Álgebra', materia: 'Matemáticas', precio_hora: 40000, modalidad: 'virtual', duracion_min: 60, ...extraClase })).datos.clase;
  await m('PUT', '/api/horarios', { horarios: [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, inicio: '08:00', fin: '12:00' })) });
  return { m, id, clase };
}

/** Estudiante con perfil completo y suscripción. */
async function estudianteListo(app, nombre = 'Sofia', extra = {}) {
  const e = app.cliente();
  await registrar(e, 'estudiante', nombre, { colegio_tipo: 'privado' });
  const r = await e('PUT', '/api/perfil', {
    nombre, ciudad: 'Bogotá D.C.', telefono: '3205550202', colegio_tipo: 'privado', colegio_nombre: 'Colegio X',
    localidad: 'Usaquén', grado: '11°', ...extra,
  });
  assert.equal(r.estado, 200, JSON.stringify(r.datos));
  await pagarSimulado(e);
  return e;
}

test('registro, ingreso por rol y colegio del estudiante', async (t) => {
  const app = await iniciar({ adminEmails: ['jefa@x.co'] }); t.after(app.cerrar);
  const c = app.cliente();
  assert.equal((await registrar(c, 'estudiante', 'Ana', { colegio_tipo: undefined })).estado, 400, 'el colegio es obligatorio');
  assert.equal((await registrar(c, 'estudiante', 'Ana', { colegio_tipo: 'otro' })).estado, 400);
  let r = await registrar(c, 'estudiante', 'Ana', { colegio_tipo: 'privado', es_menor: true });
  assert.equal(r.estado, 201);
  assert.equal(r.datos.usuario.colegio_tipo, 'privado');
  assert.equal(r.datos.usuario.es_menor, true);
  assert.equal((await registrar(app.cliente(), 'estudiante', 'Ana')).estado, 409, 'correo repetido');
  assert.equal((await registrar(app.cliente(), 'profesor', 'Corta', { password: '1234' })).estado, 400);

  await registrar(app.cliente(), 'profesor', 'Luis');
  r = await app.cliente()('POST', '/api/login', { email: 'luis@x.co', password: 'clave12345', rol: 'estudiante' });
  assert.equal(r.estado, 403, 'mentor entrando por la pestaña de estudiante');
  assert.match(r.datos.error, /mentor/);
  assert.equal((await app.cliente()('POST', '/api/login', { email: 'luis@x.co', password: 'clave12345', rol: 'profesor' })).estado, 200);
  assert.equal((await app.cliente()('POST', '/api/login', { email: 'luis@x.co', password: 'mala' })).estado, 401);

  const admin = app.cliente();
  assert.equal((await admin('POST', '/api/registro', { rol: 'estudiante', nombre: 'Jefa', email: 'jefa@x.co', password: 'clave12345', colegio_tipo: 'ninguno' })).datos.usuario.es_admin, true);
});

test('perfil del estudiante: colegio público/privado, localidad de Bogotá y acudiente', async (t) => {
  const app = await iniciar(); t.after(app.cerrar);
  const e = app.cliente();
  await registrar(e, 'estudiante', 'Sofia');
  const base = { nombre: 'Sofía', ciudad: 'Bogotá D.C.', colegio_tipo: 'publico', colegio_nombre: 'IED Kennedy', localidad: 'Kennedy', grado: '10°' };
  assert.equal((await e('PUT', '/api/perfil', { ...base, colegio_nombre: '' })).estado, 400, 'falta el nombre del colegio');
  assert.equal((await e('PUT', '/api/perfil', { ...base, localidad: 'Narnia' })).estado, 400, 'localidad inválida');
  assert.equal((await e('PUT', '/api/perfil', { ...base, grado: '15°' })).estado, 400);
  assert.equal((await e('PUT', '/api/perfil', { ...base, es_menor: true })).estado, 400, 'menor sin acudiente');
  const ok = await e('PUT', '/api/perfil', { ...base, es_menor: true, acudiente_nombre: 'Marta', acudiente_celular: '+57 320 555 0202' });
  assert.equal(ok.estado, 200);
  assert.equal(ok.datos.usuario.acudiente_celular, '3205550202');
  const sin = await e('PUT', '/api/perfil', { ...base, colegio_tipo: 'ninguno', colegio_nombre: 'ignorado' });
  assert.equal(sin.datos.usuario.colegio_nombre, '', 'sin colegio no guarda nombre');
  assert.equal(sin.datos.usuario.localidad, '');
  const cat = (await e('GET', '/api/catalogo')).datos;
  assert.equal(cat.localidades.length, 20);
  assert.deepEqual(Object.keys(cat.colegioTipos), ['publico', 'privado', 'ninguno']);
});

test('verificación del mentor: documentos, revisión del administrador y visibilidad', async (t) => {
  const app = await iniciar({ adminEmails: ['admin@x.co'] }); t.after(app.cerrar);
  const m = app.cliente();
  await registrar(m, 'profesor', 'Pedro');
  await m('PUT', '/api/perfil', { nombre: 'Pedro', ciudad: 'Bogotá D.C.', materias: 'Química' });
  await m('POST', '/api/clases', { titulo: 'Química', materia: 'Química', precio_hora: 30000, modalidad: 'virtual' });
  await pagarSimulado(m);

  assert.equal((await m('GET', '/api/clases')).datos.clases.length, 0, 'sin verificar no aparece');
  assert.equal((await m('POST', '/api/verificacion/enviar')).estado, 400, 'falta la cédula');
  await m('PUT', '/api/perfil', { nombre: 'Pedro', ciudad: 'Bogotá D.C.', documento: '12' });
  assert.equal((await m('PUT', '/api/perfil', { nombre: 'Pedro', documento: '12' })).estado, 400, 'cédula inválida');
  await m('PUT', '/api/perfil', { nombre: 'Pedro', ciudad: 'Bogotá D.C.', documento: '80.111.222' });
  assert.equal((await m('POST', '/api/verificacion/documentos?tipo=cedula', Buffer.from('<script>alert(1)</script>'))).estado, 415, 'solo JPG/PNG/PDF reales');
  assert.equal((await m('POST', '/api/verificacion/documentos?tipo=otro', PNG)).estado, 400);
  assert.equal((await m('POST', '/api/verificacion/documentos?tipo=cedula', PNG)).estado, 201);
  assert.equal((await m('POST', '/api/verificacion/enviar')).estado, 400, 'falta el título');
  const titulo = await m('POST', '/api/verificacion/documentos?tipo=titulo', Buffer.from('%PDF-1.4 ejemplo'));
  assert.equal(titulo.datos.mime, 'application/pdf');
  assert.equal((await m('POST', '/api/verificacion/enviar')).estado, 200);
  assert.equal((await m('POST', '/api/verificacion/documentos?tipo=cedula', PNG)).estado, 409, 'no se edita en revisión');

  // el administrador revisa
  const noAdmin = await registrar(app.cliente(), 'estudiante', 'Ana');
  const e = app.cliente(); await registrar(e, 'estudiante', 'Eva');
  assert.equal((await e('GET', '/api/admin/verificaciones')).estado, 403);
  assert.equal((await m('GET', '/api/admin/verificaciones')).estado, 403);
  const admin = app.cliente();
  await admin('POST', '/api/registro', { rol: 'estudiante', nombre: 'Admin', email: 'admin@x.co', password: 'clave12345', colegio_tipo: 'ninguno' });
  const lista = (await admin('GET', '/api/admin/verificaciones')).datos.mentores;
  assert.equal(lista.length, 1);
  assert.equal(lista[0].documento, '80111222');
  const doc = await admin('GET', `/api/admin/documentos/${lista[0].documentos[0].id}`);
  assert.equal(doc.estado, 200);
  assert.equal(doc.cabeceras.get('content-type'), 'image/png');
  assert.match(doc.cabeceras.get('content-security-policy'), /sandbox/);
  assert.equal((await e('GET', `/api/admin/documentos/${lista[0].documentos[0].id}`)).estado, 403, 'documentos privados');
  assert.equal((await admin('PUT', `/api/admin/verificaciones/${lista[0].id}`, { estado: 'rechazado' })).estado, 400, 'rechazo sin motivo');
  await admin('PUT', `/api/admin/verificaciones/${lista[0].id}`, { estado: 'rechazado', nota: 'Cédula ilegible' });
  assert.equal((await m('GET', '/api/verificacion')).datos.nota, 'Cédula ilegible');
  // corrige y reenvía
  await m('POST', '/api/verificacion/documentos?tipo=cedula', PNG);
  await m('POST', '/api/verificacion/enviar');
  await admin('PUT', `/api/admin/verificaciones/${lista[0].id}`, { estado: 'verificado' });
  assert.equal((await admin('PUT', `/api/admin/verificaciones/${lista[0].id}`, { estado: 'verificado' })).estado, 409);

  const vis = (await m('GET', '/api/clases')).datos.clases;
  assert.equal(vis.length, 1, 'verificado + suscrito = visible');
  assert.equal(vis[0].verificado, 1);
});

test('una clase solo es pública con mentor verificado y suscripción activa', async (t) => {
  const app = await iniciar(); t.after(app.cerrar);
  const { m, id, clase } = await mentorListo(app);
  const e = await estudianteListo(app);
  assert.equal((await e('GET', '/api/clases')).datos.clases.length, 1);
  app.db.prepare(`UPDATE suscripciones SET vence = '2000-01-01 00:00:00' WHERE usuario_id = ?`).run(id);
  assert.equal((await e('GET', '/api/clases')).datos.clases.length, 0, 'suscripción vencida');
  assert.equal((await e('GET', `/api/clases/${clase.id}`)).estado, 404);
  assert.equal((await m('GET', '/api/clases/mias')).datos.clases[0].oculta_por, 'Suscripción inactiva');
  assert.equal((await m('GET', `/api/clases/${clase.id}`)).estado, 200, 'el dueño la sigue viendo');
  assert.equal((await e('GET', `/api/profesores/${id}`)).datos.clases.length, 0);
});

test('suscripción con Wompi: checkout firmado, retorno verificado y webhook idempotente', async (t) => {
  const solicitudes = [];
  const wompi = { publicKey: 'pub_test_abc', integritySecret: 'integ_secret', eventsSecret: 'events_secret' };
  let respuesta;
  const app = await iniciar({ wompi, pagosSimulados: false, baseUrl: 'https://artia.test', precios: { profesor: 49900, estudiante: 19900 } },
    { fetchFn: async (url) => { solicitudes.push(url); return { json: async () => respuesta }; } });
  t.after(app.cerrar);
  const e = app.cliente();
  await registrar(e, 'estudiante', 'Ana');
  assert.equal((await e('POST', '/api/pagos/simular', { pago_id: 1 })).estado, 404, 'sin simulación cuando hay Wompi');

  const ini = await e('POST', '/api/pagos/iniciar');
  assert.equal(ini.datos.modo, 'wompi');
  const url = new URL(ini.datos.url);
  assert.equal(url.origin + url.pathname, 'https://checkout.wompi.co/p/');
  const ref = url.searchParams.get('reference');
  assert.equal(url.searchParams.get('amount-in-cents'), '1990000');
  assert.equal(url.searchParams.get('currency'), 'COP');
  assert.equal(url.searchParams.get('public-key'), 'pub_test_abc');
  assert.equal(url.searchParams.get('redirect-url'), 'https://artia.test/api/pagos/retorno');
  assert.equal(url.searchParams.get('signature:integrity'), firmaIntegridad(ref, 1990000, 'COP', 'integ_secret'));

  // retorno: se consulta la transacción a Wompi (nunca se confía en la URL)
  respuesta = { data: { id: 'tx-1', reference: ref, status: 'APPROVED', amount_in_cents: 1 } };
  let r = await e('GET', '/api/pagos/retorno?id=tx-1');
  assert.equal(r.estado, 302);
  assert.equal((await e('GET', '/api/suscripcion')).datos.suscripcion.activa, false, 'monto distinto: ignorado');
  respuesta = { data: { id: 'tx-1', reference: ref, status: 'APPROVED', amount_in_cents: 1990000 } };
  r = await e('GET', '/api/pagos/retorno?id=tx-1');
  assert.equal(r.cabeceras.get('location'), '/#/suscripcion?pago=ok');
  assert.match(solicitudes[0], /^https:\/\/sandbox\.wompi\.co\/v1\/transactions\/tx-1$/);
  const vence1 = (await e('GET', '/api/suscripcion')).datos.suscripcion.vence;
  assert.ok(vence1);

  // webhook: firma inválida rechazada; válido e idempotente (no suma otros 30 días)
  const evento = (status, firma) => {
    const ev = { event: 'transaction.updated', timestamp: 1700000000,
      data: { transaction: { id: 'tx-1', status, amount_in_cents: 1990000, reference: ref } },
      signature: { properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'] } };
    ev.signature.checksum = firma ?? checksumEvento(ev, 'events_secret');
    return ev;
  };
  assert.equal((await e('POST', '/api/wompi/eventos', evento('APPROVED', 'falsa'))).estado, 401);
  assert.equal((await e('POST', '/api/wompi/eventos', evento('APPROVED'))).estado, 200);
  assert.equal((await e('POST', '/api/wompi/eventos', evento('DECLINED'))).estado, 200);
  const s = (await e('GET', '/api/suscripcion')).datos;
  assert.equal(s.suscripcion.vence, vence1, 'idempotente: una aprobación suma 30 días una sola vez');
  assert.equal(s.pagos[0].estado, 'aprobado', 'un pago aprobado no se revierte');
  assert.equal(s.modo, 'wompi');

  // renovar mientras está activa suma desde la fecha de vencimiento
  const ini2 = await e('POST', '/api/pagos/iniciar');
  const ref2 = new URL(ini2.datos.url).searchParams.get('reference');
  const ev2 = { event: 'transaction.updated', timestamp: 1700000001,
    data: { transaction: { id: 'tx-2', status: 'APPROVED', amount_in_cents: 1990000, reference: ref2 } },
    signature: { properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'] } };
  ev2.signature.checksum = checksumEvento(ev2, 'events_secret');
  await e('POST', '/api/wompi/eventos', ev2);
  const vence2 = Date.parse((await e('GET', '/api/suscripcion')).datos.suscripcion.vence.replace(' ', 'T') + 'Z');
  assert.ok(Math.abs(vence2 - Date.parse(vence1.replace(' ', 'T') + 'Z') - 30 * 86400000) < 1000);
});

test('pagos no configurados y precios por rol', async (t) => {
  const app = await iniciar({ pagosSimulados: false, precios: { profesor: 49900, estudiante: 19900 } }); t.after(app.cerrar);
  const e = app.cliente(); await registrar(e, 'estudiante', 'Ana');
  assert.equal((await e('POST', '/api/pagos/iniciar')).estado, 503);
  assert.equal((await e('POST', '/api/wompi/eventos', {})).estado, 503);
  const m = app.cliente(); await registrar(m, 'profesor', 'Luis');
  assert.equal((await m('GET', '/api/yo')).datos.usuario.suscripcion.precio, 49900);
  assert.equal((await e('GET', '/api/yo')).datos.usuario.suscripcion.precio, 19900);
  assert.equal((await app.cliente()('GET', '/api/suscripcion')).estado, 401);
});

test('agenda: horarios, reserva por horario, choques y contacto', async (t) => {
  const app = await iniciar(); t.after(app.cerrar);
  const { m, id, clase } = await mentorListo(app);
  const sofia = await estudianteListo(app, 'Sofia', { es_menor: true, acudiente_nombre: 'Marta', acudiente_celular: '3115550000' });
  const manana = sumarDias(hoyCol(), 1);

  // horarios del mentor
  assert.equal((await m('PUT', '/api/horarios', { horarios: [{ dia: 1, inicio: '10:00', fin: '09:00' }] })).estado, 400);
  assert.equal((await m('PUT', '/api/horarios', { horarios: [{ dia: 1, inicio: '09:00', fin: '11:00' }, { dia: 1, inicio: '10:00', fin: '12:00' }] })).estado, 400, 'bloques que se cruzan');
  assert.equal((await m('PUT', '/api/horarios', { horarios: [{ dia: 9, inicio: '09:00', fin: '11:00' }] })).estado, 400);
  assert.equal((await m('PUT', '/api/horarios', { horarios: [{ dia: 1, inicio: '9am', fin: '11:00' }] })).estado, 400);
  assert.equal((await sofia('GET', '/api/horarios')).estado, 403);
  await m('PUT', '/api/horarios', { horarios: [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, inicio: '08:00', fin: '12:00' })) });

  const disp = (await sofia('GET', `/api/clases/${clase.id}/disponibilidad`)).datos;
  const dia = disp.dias.find((d) => d.fecha === manana);
  assert.deepEqual(dia.horas, ['08:00', '09:00', '10:00', '11:00']);
  assert.equal(dia.dia, diaSemana(manana));
  assert.ok(disp.dias.every((d) => d.fecha >= hoyCol()));

  // reservar
  assert.equal((await sofia('POST', '/api/reservas', { clase_id: clase.id, fecha: manana, hora: '08:30' })).estado, 409, 'hora fuera de la cuadrícula');
  assert.equal((await sofia('POST', '/api/reservas', { clase_id: clase.id, fecha: sumarDias(hoyCol(), -1), hora: '09:00' })).estado, 400, 'fecha pasada');
  assert.equal((await sofia('POST', '/api/reservas', { clase_id: clase.id, fecha: manana, hora: 'x' })).estado, 400);
  const r = await sofia('POST', '/api/reservas', { clase_id: clase.id, fecha: manana, hora: '09:00', mensaje: 'Hola' });
  assert.equal(r.estado, 201);
  const reservaId = r.datos.reserva.id;
  const otra = await estudianteListo(app, 'Otra');
  assert.equal((await otra('POST', '/api/reservas', { clase_id: clase.id, fecha: manana, hora: '09:00' })).estado, 409, 'horario ocupado');
  const libres = (await otra('GET', `/api/clases/${clase.id}/disponibilidad`)).datos.dias.find((d) => d.fecha === manana).horas;
  assert.deepEqual(libres, ['08:00', '10:00', '11:00'], 'el horario reservado ya no aparece');
  assert.equal((await sofia('POST', '/api/reservas', { clase_id: clase.id, fecha: manana, hora: '09:00' })).estado, 409);

  // privacidad del contacto
  let lista = (await m('GET', '/api/reservas')).datos.reservas[0];
  assert.equal(lista.contacto, '');
  assert.equal(lista.estudiante_grado, '11°');
  assert.equal(lista.estudiante_colegio_tipo, 'privado');
  assert.ok(!('colegio_nombre' in lista) && !('estudiante_tel' in lista), 'no expone el nombre del colegio');
  assert.equal((await sofia('PUT', `/api/reservas/${reservaId}`, { estado: 'aceptada' })).estado, 403);
  assert.equal((await m('PUT', `/api/reservas/${reservaId}`, { estado: 'aceptada' })).estado, 200);
  lista = (await m('GET', '/api/reservas')).datos.reservas[0];
  assert.equal(lista.contacto, '3115550000', 'si el estudiante es menor, el mentor ve el celular del acudiente');
  assert.match(lista.contacto_de, /acudiente/);
  assert.equal((await sofia('GET', '/api/reservas')).datos.reservas[0].contacto, '3001234567');

  // cancelar libera el horario
  assert.equal((await sofia('PUT', `/api/reservas/${reservaId}`, { estado: 'cancelada' })).estado, 200);
  assert.ok((await otra('GET', `/api/clases/${clase.id}/disponibilidad`)).datos.dias.find((d) => d.fecha === manana).horas.includes('09:00'));
  assert.equal((await otra('POST', '/api/reservas', { clase_id: clase.id, fecha: manana, hora: '09:00' })).estado, 201);
  assert.equal((await sofia('POST', '/api/reservas', { clase_id: clase.id, fecha: manana, hora: '09:00' })).estado, 409);

  // un mentor no reserva; un estudiante sin cuenta tampoco
  assert.equal((await m('POST', '/api/reservas', { clase_id: clase.id, fecha: manana, hora: '10:00' })).estado, 403);
  assert.equal((await app.cliente()('POST', '/api/reservas', { clase_id: clase.id, fecha: manana, hora: '10:00' })).estado, 401);
});

test('reservar exige suscripción y perfil de colegio completo; el mentor exige suscripción para aceptar', async (t) => {
  const app = await iniciar(); t.after(app.cerrar);
  const { m, id, clase } = await mentorListo(app);
  const manana = sumarDias(hoyCol(), 1);
  const e = app.cliente();
  await registrar(e, 'estudiante', 'Luna', { colegio_tipo: 'privado', es_menor: true });
  let r = await e('POST', '/api/reservas', { clase_id: clase.id, fecha: manana, hora: '09:00' });
  assert.equal(r.estado, 402, 'sin suscripción');
  await pagarSimulado(e);
  r = await e('POST', '/api/reservas', { clase_id: clase.id, fecha: manana, hora: '09:00' });
  assert.equal(r.estado, 409);
  assert.match(r.datos.error, /ciudad/);
  await e('PUT', '/api/perfil', { nombre: 'Luna', ciudad: 'Bogotá D.C.', colegio_tipo: 'privado', colegio_nombre: 'Colegio Y', es_menor: true, acudiente_nombre: 'Rosa', acudiente_celular: '3001112222' });
  r = await e('POST', '/api/reservas', { clase_id: clase.id, fecha: manana, hora: '09:00' });
  assert.equal(r.estado, 201);
  app.db.prepare(`UPDATE suscripciones SET vence = '2000-01-01 00:00:00' WHERE usuario_id = ?`).run(id);
  assert.equal((await m('PUT', `/api/reservas/${r.datos.reserva.id}`, { estado: 'aceptada' })).estado, 402);
  assert.equal((await m('PUT', `/api/reservas/${r.datos.reserva.id}`, { estado: 'rechazada' })).estado, 200, 'rechazar siempre se puede');
});

test('reseñas: solo tras la clase, una vez, y alimentan el perfil del mentor', async (t) => {
  const app = await iniciar(); t.after(app.cerrar);
  const { m, id, clase } = await mentorListo(app);
  const sofia = await estudianteListo(app, 'Sofia');
  const dani = await estudianteListo(app, 'Dani');
  const sid = (await sofia('GET', '/api/yo')).datos.usuario.id;
  const did = (await dani('GET', '/api/yo')).datos.usuario.id;

  const manana = sumarDias(hoyCol(), 1);
  const futura = (await sofia('POST', '/api/reservas', { clase_id: clase.id, fecha: manana, hora: '09:00' })).datos.reserva.id;
  await m('PUT', `/api/reservas/${futura}`, { estado: 'aceptada' });
  assert.equal((await sofia('POST', '/api/resenas', { reserva_id: futura, calificacion: 5 })).estado, 409, 'la clase aún no ocurre');
  assert.equal((await sofia('GET', '/api/reservas')).datos.reservas[0].puede_resenar, false);

  // clases ya ocurridas (se insertan directamente: la API no deja reservar en el pasado)
  const ins = app.db.prepare(`INSERT INTO reservas (clase_id, profesor_id, estudiante_id, fecha, hora, duracion_min, estado) VALUES (?,?,?,?,?,60,?)`);
  const pasada1 = Number(ins.run(clase.id, id, sid, sumarDias(hoyCol(), -2), '09:00', 'aceptada').lastInsertRowid);
  const pasada2 = Number(ins.run(clase.id, id, did, sumarDias(hoyCol(), -3), '09:00', 'aceptada').lastInsertRowid);
  const sinAceptar = Number(ins.run(clase.id, id, sid, sumarDias(hoyCol(), -4), '09:00', 'pendiente').lastInsertRowid);

  assert.equal((await sofia('POST', '/api/resenas', { reserva_id: sinAceptar, calificacion: 5 })).estado, 409, 'no aceptada');
  assert.equal((await sofia('POST', '/api/resenas', { reserva_id: pasada2, calificacion: 5 })).estado, 404, 'reserva de otro estudiante');
  assert.equal((await sofia('POST', '/api/resenas', { reserva_id: pasada1, calificacion: 6 })).estado, 400);
  assert.equal((await sofia('POST', '/api/resenas', { reserva_id: pasada1, calificacion: 0 })).estado, 400);
  assert.equal((await m('POST', '/api/resenas', { reserva_id: pasada1, calificacion: 5 })).estado, 403, 'el mentor no se califica a sí mismo');
  assert.equal((await sofia('GET', '/api/reservas')).datos.reservas.find((r) => r.id === pasada1).puede_resenar, true);
  assert.equal((await sofia('POST', '/api/resenas', { reserva_id: pasada1, calificacion: 5, comentario: 'Excelente' })).estado, 201);
  assert.equal((await sofia('POST', '/api/resenas', { reserva_id: pasada1, calificacion: 1 })).estado, 409, 'una sola reseña por clase');
  assert.equal((await dani('POST', '/api/resenas', { reserva_id: pasada2, calificacion: 4, comentario: 'Buena' })).estado, 201);

  const perfil = (await app.cliente()('GET', `/api/profesores/${id}`)).datos;
  assert.equal(perfil.profesor.promedio, 4.5);
  assert.equal(perfil.profesor.num_resenas, 2);
  assert.equal(perfil.profesor.verificado, true);
  assert.deepEqual(perfil.resenas.map((r) => r.autor).sort(), ['Dani', 'Sofia']);
  assert.ok(!JSON.stringify(perfil).includes('@x.co'), 'el perfil público no expone correos');
  const tarjeta = (await sofia('GET', '/api/clases')).datos.clases[0];
  assert.equal(tarjeta.promedio, 4.5);
  assert.equal(tarjeta.num_resenas, 2);
});

test('solicitudes y ofertas respetan verificación, suscripción y privacidad', async (t) => {
  const app = await iniciar(); t.after(app.cerrar);
  const { m, clase } = await mentorListo(app);
  const e = app.cliente();
  await registrar(e, 'estudiante', 'Ana', { colegio_tipo: 'publico' });
  assert.equal((await e('POST', '/api/solicitudes', { materia: 'Física', modalidad: 'virtual' })).estado, 402, 'requiere suscripción');
  await pagarSimulado(e);
  await e('PUT', '/api/perfil', { nombre: 'Ana', ciudad: 'Bogotá D.C.', telefono: '3205550202', colegio_tipo: 'publico', colegio_nombre: 'IED Kennedy', grado: '9°' });
  const s = await e('POST', '/api/solicitudes', { materia: 'Física', descripcion: 'Ayuda', presupuesto: 30000, modalidad: 'virtual' });
  assert.equal(s.estado, 201);
  const vista = (await m('GET', '/api/solicitudes')).datos.solicitudes[0];
  assert.equal(vista.grado, '9°');
  assert.equal(vista.colegio_tipo, 'publico');
  assert.ok(!('telefono' in vista) && !('estudiante_id' in vista) && !JSON.stringify(vista).includes('Kennedy'));
  assert.equal((await m('POST', `/api/solicitudes/${s.datos.id}/ofertas`, { mensaje: 'Puedo ayudarte', clase_id: clase.id })).estado, 201);
  assert.equal((await m('POST', `/api/solicitudes/${s.datos.id}/ofertas`, { mensaje: 'otra vez' })).estado, 409);
  assert.equal((await e('GET', '/api/solicitudes')).datos.solicitudes[0].ofertas.length, 1);

  const nuevo = app.cliente(); await registrar(nuevo, 'profesor', 'Nuevo');
  assert.equal((await nuevo('POST', `/api/solicitudes/${s.datos.id}/ofertas`, { mensaje: 'hola' })).estado, 403, 'mentor sin verificar');
});

test('clases: permisos del mentor, búsqueda y filtros', async (t) => {
  const app = await iniciar(); t.after(app.cerrar);
  const { m, clase } = await mentorListo(app, 'Laura');
  const e = await estudianteListo(app);
  assert.equal((await e('POST', '/api/clases', { titulo: 'x', materia: 'x', precio_hora: 40000, modalidad: 'virtual' })).estado, 403);
  assert.equal((await m('POST', '/api/clases', { titulo: 'Álgebra', materia: 'Matemáticas', precio_hora: 1000, modalidad: 'virtual' })).estado, 400, 'precio mínimo');
  const pres = await m('POST', '/api/clases', { titulo: 'Presencial', materia: 'Física', precio_hora: 40000, modalidad: 'presencial' });
  assert.equal(pres.datos.clase.ciudad, 'Bogotá D.C.', 'usa la ciudad del perfil');

  assert.equal((await e('GET', '/api/clases?q=lgebra&materia=Matem%C3%A1ticas&max=50000')).datos.clases.length, 1);
  assert.equal((await e('GET', '/api/clases?max=10000')).datos.clases.length, 0);
  assert.equal((await e('GET', '/api/clases?q=%25')).datos.clases.length, 0, 'el comodín % se escapa');
  assert.equal((await e('GET', '/api/clases?ciudad=Cali')).datos.clases.length, 1, 'solo la virtual aparece fuera de la ciudad');

  const otro = app.cliente(); await registrar(otro, 'profesor', 'Pedro');
  assert.equal((await otro('PUT', `/api/clases/${clase.id}`, { titulo: 'Hack', materia: 'x', precio_hora: 40000, modalidad: 'virtual' })).estado, 404);
  assert.equal((await otro('DELETE', `/api/clases/${clase.id}`)).estado, 404);
});

test('sesión, logout, archivos estáticos y cabeceras', async (t) => {
  const app = await iniciar(); t.after(app.cerrar);
  const c = app.cliente();
  assert.equal((await c('GET', '/api/reservas')).estado, 401);
  await registrar(c, 'estudiante', 'Ana');
  assert.equal((await c('GET', '/api/yo')).datos.usuario.email, 'ana@x.co');
  await c('POST', '/api/logout');
  assert.equal((await c('GET', '/api/yo')).datos.usuario, null);

  const idx = await fetch(app.base + '/');
  assert.equal(idx.status, 200);
  assert.match(await idx.text(), /Artia/);
  assert.equal(idx.headers.get('x-frame-options'), 'DENY');
  assert.equal((await fetch(app.base + '/no-existe.js')).status, 404);
  assert.equal((await fetch(app.base + '/api/nada')).status, 404);
  assert.notEqual((await fetch(app.base + '/..%2f..%2fpackage.json')).status, 200);
});

test('catálogo por categorías, filtros del marketplace y materias válidas', async (t) => {
  const app = await iniciar(); t.after(app.cerrar);
  const cat = (await app.cliente()('GET', '/api/catalogo')).datos;
  assert.deepEqual(cat.categorias.map((c) => c.nombre), ['Idiomas', 'Ciencias y números', 'Humanidades', 'Bienestar y espiritualidad', 'Arte y creatividad', 'Deportes', 'Tecnología']);
  for (const m of ['Inglés', 'Francés', 'Alemán', 'Italiano', 'Matemáticas', 'Física', 'Química', 'Contabilidad', 'Ciencias sociales', 'Escritura', 'Yoga', 'Pilates',
    'Astrología', 'Reiki', 'Ángeles', 'Tarot', 'Cerámica', 'Arte', 'Tenis', 'Pádel', 'Rutinas de ejercicio', 'Inteligencia artificial']) assert.ok(cat.materias.includes(m), m);

  const { m, clase } = await mentorListo(app, 'Laura');
  await m('PUT', '/api/perfil', { nombre: 'Laura', ciudad: 'Bogotá D.C.', materias: 'Yoga, Tarot' });
  assert.equal((await m('PUT', '/api/perfil', { nombre: 'Laura', materias: 'Yoga, Brujería' })).estado, 400, 'materia fuera del catálogo');
  assert.equal((await m('POST', '/api/clases', { titulo: 'x', materia: 'Otra cosa', precio_hora: 40000, modalidad: 'virtual' })).estado, 400);
  await m('POST', '/api/clases', { titulo: 'Yoga suave', materia: 'Yoga', precio_hora: 30000, modalidad: 'virtual' });
  await m('POST', '/api/clases', { titulo: 'Tarot', materia: 'Tarot', precio_hora: 90000, modalidad: 'virtual' });

  const e = await estudianteListo(app);
  const buscar = async (qs) => (await e('GET', '/api/clases' + qs)).datos.clases.map((c) => c.titulo);
  assert.equal((await buscar('')).length, 3);
  assert.deepEqual((await buscar('?categoria=Bienestar%20y%20espiritualidad')).sort(), ['Tarot', 'Yoga suave']);
  assert.deepEqual(await buscar('?categoria=Idiomas'), []);
  assert.deepEqual(await buscar('?categoria=Inventada'), [], 'categoría desconocida no devuelve nada');
  assert.deepEqual(await buscar('?materia=Yoga'), ['Yoga suave']);
  assert.deepEqual(await buscar('?orden=precio_asc'), ['Yoga suave', 'Álgebra', 'Tarot']);
  assert.deepEqual(await buscar('?orden=precio_desc'), ['Tarot', 'Álgebra', 'Yoga suave']);
  assert.deepEqual(await buscar('?calificacion_min=4'), [], 'sin reseñas no pasa el filtro de calificación');
  assert.deepEqual(await buscar('?categoria=Bienestar%20y%20espiritualidad&max=50000'), ['Yoga suave']);
  assert.equal((await e('POST', '/api/solicitudes', { materia: 'Brujería', modalidad: 'virtual' })).estado, 400);
});

test('primeros pasos y precios por defecto', async (t) => {
  const app = await iniciar(); t.after(app.cerrar);
  const e = app.cliente(); await registrar(e, 'estudiante', 'Ana', { colegio_tipo: 'privado' });
  let u = (await e('GET', '/api/yo')).datos.usuario;
  assert.deepEqual(u.pasos.map((p) => p.ok), [false, false, false]);
  assert.equal(u.suscripcion.precio, 24900, 'estudiante: $24.900 al mes');
  await e('PUT', '/api/perfil', { nombre: 'Ana', ciudad: 'Bogotá D.C.', colegio_tipo: 'privado', colegio_nombre: 'Colegio X' });
  await pagarSimulado(e);
  u = (await e('GET', '/api/yo')).datos.usuario;
  assert.deepEqual(u.pasos.map((p) => p.ok), [true, true, false]);

  const m = app.cliente(); await registrar(m, 'profesor', 'Luis');
  u = (await m('GET', '/api/yo')).datos.usuario;
  assert.equal(u.suscripcion.precio, 59900, 'mentor: $59.900 al mes');
  assert.deepEqual(u.pasos.map((p) => p.id), ['perfil', 'verificacion', 'suscripcion', 'clase', 'horarios']);
  assert.ok(u.pasos.every((p) => !p.ok));
});

test('documentos de verificación en almacenamiento privado (Supabase Storage)', async (t) => {
  const objetos = new Map(); let fallar = false;
  const almacen = {
    async guardar(ruta, buf, mime) { if (fallar) throw new Error('caído'); objetos.set(ruta, { buf, mime }); },
    async leer(ruta) { return objetos.get(ruta).buf; },
    async borrar(ruta) { objetos.delete(ruta); },
  };
  const app = await iniciar({ adminEmails: ['admin@x.co'] }, { almacen }); t.after(app.cerrar);
  const m = app.cliente(); await registrar(m, 'profesor', 'Pedro');
  const id = (await m('GET', '/api/yo')).datos.usuario.id;

  assert.equal((await m('POST', '/api/verificacion/documentos?tipo=cedula', PNG)).estado, 201);
  const fila = app.db.prepare(`SELECT datos, ruta FROM documentos WHERE usuario_id = ?`).get(id);
  assert.equal(fila.datos.length, 0, 'el archivo no queda en la base de datos');
  assert.match(fila.ruta, new RegExp(`^${id}/cedula-[0-9a-f]{16}\\.png$`));
  assert.equal(objetos.get(fila.ruta).mime, 'image/png');

  // reemplazar borra el objeto anterior
  await m('POST', '/api/verificacion/documentos?tipo=cedula', PNG);
  assert.equal(objetos.size, 1);
  assert.ok(!objetos.has(fila.ruta));

  // si el almacenamiento falla no se pierde el documento anterior ni queda una fila rota
  fallar = true;
  assert.equal((await m('POST', '/api/verificacion/documentos?tipo=cedula', PNG)).estado, 502);
  fallar = false;
  assert.equal(app.db.prepare(`SELECT COUNT(*) n FROM documentos WHERE usuario_id = ?`).get(id).n, 1);

  // el administrador lee el archivo desde el almacén
  await m('PUT', '/api/perfil', { nombre: 'Pedro', documento: '80111222' });
  await m('POST', '/api/verificacion/documentos?tipo=titulo', PNG);
  await m('POST', '/api/verificacion/enviar');
  const admin = app.cliente();
  await admin('POST', '/api/registro', { rol: 'estudiante', nombre: 'Admin', email: 'admin@x.co', password: 'clave12345', colegio_tipo: 'ninguno' });
  const lista = (await admin('GET', '/api/admin/verificaciones')).datos.mentores[0];
  const doc = await admin('GET', `/api/admin/documentos/${lista.documentos[0].id}`);
  assert.equal(doc.estado, 200);
  assert.deepEqual(doc.datos, PNG);
  assert.equal(doc.cabeceras.get('content-type'), 'image/png');
});

test('salud y límite de intentos por IP real detrás de un proxy', async (t) => {
  const app = await iniciar({ confiarProxy: true }); t.after(app.cerrar);
  await registrar(app.cliente(), 'profesor', 'Luis');
  const intento = (ip) => fetch(app.base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ email: 'luis@x.co', password: 'mala' }) }).then((r) => r.status);
  assert.equal((await fetch(app.base + '/api/salud')).status, 200);
  for (let i = 0; i < 8; i++) assert.equal(await intento('1.1.1.1'), 401);
  assert.equal(await intento('1.1.1.1'), 429, 'esa IP queda bloqueada');
  assert.equal(await intento('2.2.2.2'), 401, 'otra persona no se ve afectada');
});
