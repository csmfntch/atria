// Pruebas de la API: node --test test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
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
  { acepta_terminos: true, autoriza_verificacion: true, rol, nombre: n, email: `${n.toLowerCase().replace(/\W/g, '')}@x.co`, password: 'clave12345', ...(rol === 'estudiante' ? { colegio_tipo: 'publico' } : {}), ...extra });

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
  assert.equal((await admin('POST', '/api/registro', { acepta_terminos: true, autoriza_verificacion: true, rol: 'estudiante', nombre: 'Jefa', email: 'jefa@x.co', password: 'clave12345', colegio_tipo: 'ninguno' })).datos.usuario.es_admin, true);
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
  await admin('POST', '/api/registro', { acepta_terminos: true, autoriza_verificacion: true, rol: 'estudiante', nombre: 'Admin', email: 'admin@x.co', password: 'clave12345', colegio_tipo: 'ninguno' });
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
  await admin('POST', '/api/registro', { acepta_terminos: true, autoriza_verificacion: true, rol: 'estudiante', nombre: 'Admin', email: 'admin@x.co', password: 'clave12345', colegio_tipo: 'ninguno' });
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
  const salud = await (await fetch(app.base + '/api/salud')).json();
  assert.equal(salud.ok, true);
  assert.equal(salud.kyc, 'ninguno');
  assert.ok(salud.version);
  for (let i = 0; i < 8; i++) assert.equal(await intento('1.1.1.1'), 401);
  assert.equal(await intento('1.1.1.1'), 429, 'esa IP queda bloqueada');
  assert.equal(await intento('2.2.2.2'), 401, 'otra persona no se ve afectada');
});

test('configuración por entorno: dominio público de Railway y precios', async () => {
  const { configDesdeEnv } = await import('./server.mjs');
  assert.equal(configDesdeEnv({ RAILWAY_PUBLIC_DOMAIN: 'artia.up.railway.app' }).baseUrl, 'https://artia.up.railway.app');
  assert.equal(configDesdeEnv({ BASE_URL: 'https://artia.co/', RAILWAY_PUBLIC_DOMAIN: 'x.up.railway.app' }).baseUrl, 'https://artia.co', 'BASE_URL manda y se quita la barra final');
  assert.equal(configDesdeEnv({}).baseUrl, 'http://localhost:3100');
  assert.equal(configDesdeEnv({ TRUST_PROXY: '1' }).confiarProxy, true);
  assert.equal(configDesdeEnv({ NODE_ENV: 'production', PAGOS_SIMULADOS: '1' }).pagosSimulados, false, 'sin pagos simulados en producción');
});

test('KYC: coincidencia de nombres colombianos', async () => {
  const { coincideNombre, normalizarNombre } = await import('./kyc.mjs');
  assert.equal(normalizarNombre('  José  Núñez-Pérez '), 'jose nunez perez');
  assert.ok(coincideNombre('Alejandra Mora', 'MORA OCAMPO ALEJANDRA'), 'el documento trae apellidos primero');
  assert.ok(coincideNombre('José Núñez', 'NUÑEZ PEREZ JOSE'), 'sin tildes ni mayúsculas');
  assert.ok(!coincideNombre('Ana', 'RUIZ LOPEZ ANA'), 'un solo nombre no basta');
  assert.ok(!coincideNombre('Ana Ruiz', 'RUIZ LOPEZ MARIA'), 'otra persona');
  assert.ok(!coincideNombre('Ana Ruiz', ''), 'documento vacío');
});

test('KYC: verificación automática cuando todo coincide, revisión manual si no', async (t) => {
  const app = await iniciar({ kycSimulado: true }); t.after(app.cerrar);
  const nuevoMentor = async (nombre, sufijo) => {
    const m = app.cliente();
    await m('POST', '/api/registro', { acepta_terminos: true, autoriza_verificacion: true, rol: 'profesor', nombre, email: `kyc${sufijo}@x.co`, password: 'clave12345' });
    await m('PUT', '/api/perfil', { nombre, ciudad: 'Bogotá D.C.', documento: `5212345${sufijo}`, materias: 'Matemáticas' });
    return m;
  };
  const admin = app.cliente();
  await admin('POST', '/api/registro', { acepta_terminos: true, autoriza_verificacion: true, rol: 'estudiante', nombre: 'Admin', email: 'admin@x.co', password: 'clave12345', colegio_tipo: 'ninguno' });
  app.db.prepare(`UPDATE usuarios SET es_admin = 1 WHERE email = 'admin@x.co'`).run();

  // 1) Todo coincide → se verifica solo
  let m = await nuevoMentor('Laura Gómez', 1);
  assert.equal((await m('GET', '/api/verificacion')).datos.kyc.modo, 'simulado');
  assert.equal((await m('POST', '/api/kyc/simular', { desenlace: 'aprobado' })).estado, 409, 'primero iniciar');
  assert.equal((await m('POST', '/api/verificacion/enviar')).estado, 400, 'falta el título');
  await m('POST', '/api/verificacion/documentos?tipo=cedula', PNG);
  await m('POST', '/api/verificacion/documentos?tipo=titulo', PNG);
  assert.equal((await m('POST', '/api/verificacion/enviar')).estado, 400, 'falta la verificación de identidad');
  assert.equal((await m('POST', '/api/kyc/iniciar')).estado, 201);
  assert.equal((await m('GET', '/api/verificacion')).datos.completo, false);
  let r = await m('POST', '/api/kyc/simular', { desenlace: 'aprobado' });
  assert.equal(r.datos.kyc_estado, 'aprobado');
  assert.equal((await m('GET', '/api/verificacion')).datos.completo, true, 'no pide la foto de la cédula: la toma el proveedor');
  r = await m('POST', '/api/verificacion/enviar');
  assert.equal(r.datos.estado, 'verificado');
  assert.equal((await m('GET', '/api/yo')).datos.usuario.verificacion_estado, 'verificado');

  // 2) El documento es de otra persona → no se verifica solo: va al administrador con los motivos
  m = await nuevoMentor('Pedro Salazar', 2);
  await m('POST', '/api/verificacion/documentos?tipo=cedula', PNG);
  await m('POST', '/api/verificacion/documentos?tipo=titulo', PNG);
  await m('POST', '/api/kyc/iniciar');
  r = await m('POST', '/api/kyc/simular', { desenlace: 'no_coincide' });
  assert.equal(r.datos.kyc_estado, 'revision');
  assert.equal(r.datos.motivos.length, 2, 'cédula y nombre no coinciden');
  assert.equal((await m('POST', '/api/verificacion/enviar')).datos.estado, 'pendiente');
  const lista = (await admin('GET', '/api/admin/verificaciones')).datos.mentores.find((x) => x.nombre === 'Pedro Salazar');
  assert.equal(lista.kyc_estado, 'revision');
  assert.match(lista.kyc_motivos.join(' '), /cédula/);
  // si después la identidad se confirma, pasa a verificado sin intervención
  await m('POST', '/api/kyc/iniciar'); // reintento ya en revisión: nueva sesión
  assert.equal((await m('POST', '/api/kyc/simular', { desenlace: 'aprobado' })).datos.estado, 'verificado');

  // 3) El proveedor rechaza el documento → debe reintentar
  m = await nuevoMentor('Marta Ríos', 3);
  await m('POST', '/api/verificacion/documentos?tipo=cedula', PNG);
  await m('POST', '/api/verificacion/documentos?tipo=titulo', PNG);
  await m('POST', '/api/kyc/iniciar');
  assert.equal((await m('POST', '/api/kyc/simular', { desenlace: 'rechazado' })).datos.kyc_estado, 'rechazado');
  assert.equal((await m('POST', '/api/verificacion/enviar')).estado, 400);
  await m('POST', '/api/kyc/iniciar');
  await m('POST', '/api/kyc/simular', { desenlace: 'aprobado' });
  assert.equal((await m('POST', '/api/verificacion/enviar')).datos.estado, 'verificado');

  // 4) Validaciones al iniciar
  const sinDoc = app.cliente();
  await sinDoc('POST', '/api/registro', { acepta_terminos: true, autoriza_verificacion: true, rol: 'profesor', nombre: 'Juan Pérez', email: 'juan@x.co', password: 'clave12345' });
  assert.equal((await sinDoc('POST', '/api/kyc/iniciar')).estado, 201, 'ya no hace falta escribir la cédula antes: sale del documento');
  await sinDoc('PUT', '/api/perfil', { nombre: 'Juan', documento: '123456' });
  const unNombre = await sinDoc('POST', '/api/kyc/iniciar');
  assert.equal(unNombre.estado, 400);
  assert.match(unNombre.datos.error, /apellido/);
  const est = app.cliente(); await registrar(est, 'estudiante', 'Ana');
  assert.equal((await est('POST', '/api/kyc/iniciar')).estado, 403, 'solo mentores');
});

test('KYC: aprobación manual si se desactiva la automática, y sin simulación en producción', async (t) => {
  const app = await iniciar({ kycSimulado: true, kycAutoAprobar: false }); t.after(app.cerrar);
  const m = app.cliente();
  await m('POST', '/api/registro', { acepta_terminos: true, autoriza_verificacion: true, rol: 'profesor', nombre: 'Laura Gómez', email: 'l@x.co', password: 'clave12345' });
  await m('PUT', '/api/perfil', { nombre: 'Laura Gómez', documento: '52123456' });
  await m('POST', '/api/verificacion/documentos?tipo=cedula', PNG);
  await m('POST', '/api/verificacion/documentos?tipo=titulo', PNG);
  await m('POST', '/api/kyc/iniciar');
  await m('POST', '/api/kyc/simular', { desenlace: 'aprobado' });
  assert.equal((await m('POST', '/api/verificacion/enviar')).datos.estado, 'pendiente', 'queda para el administrador');

  const sin = await iniciar(); t.after(sin.cerrar);   // sin KYC configurado: flujo manual de documentos
  const x = sin.cliente();
  await x('POST', '/api/registro', { acepta_terminos: true, autoriza_verificacion: true, rol: 'profesor', nombre: 'Ana Ruiz', email: 'a@x.co', password: 'clave12345' });
  assert.equal((await x('POST', '/api/kyc/iniciar')).estado, 503);
  assert.equal((await x('POST', '/api/kyc/simular', { desenlace: 'aprobado' })).estado, 404);
  assert.equal((await x('GET', '/api/verificacion')).datos.kyc.modo, 'ninguno');
  const { configDesdeEnv } = await import('./server.mjs');
  assert.equal(configDesdeEnv({ KYC_SIMULADO: '1', NODE_ENV: 'production' }).kycSimulado, false);
  assert.equal(configDesdeEnv({}).kycAutoAprobar, true);
  assert.equal(configDesdeEnv({ KYC_AUTO_APROBAR: '0' }).kycAutoAprobar, false);
});

// ---------- Didit ----------
const SECRETO = 'whsec_prueba';
const firmarCrudo = (crudo, secreto = SECRETO) => createHmac('sha256', secreto).update(crudo).digest('hex');
const eventoDidit = (extra = {}, decision = {}) => ({
  event_id: 'e1', webhook_type: 'status.updated', timestamp: Math.floor(Date.now() / 1000), created_at: Math.floor(Date.now() / 1000),
  application_id: 'app', environment: 'live', session_id: 'sess-1', status: 'Approved', vendor_data: 'artia-mentor-1', ...extra,
  decision: {
    session_id: 'sess-1', status: 'Approved',
    id_verifications: [{ node_id: 'ocr', status: 'Approved', document_type: 'Identity Card', document_number: '52.123.456', personal_number: '52123456',
      first_name: 'Laura', last_name: 'Gómez Pérez', full_name: 'Laura Gómez Pérez', issuing_state: 'COL', warnings: [] }],
    liveness_checks: [{ node_id: 'l', status: 'Approved', score: 98 }],
    face_matches: [{ node_id: 'f', status: 'Approved', score: 95 }],
    database_validations: [{ node_id: 'db', status: 'Approved', match_type: 'full_match' }],
    ...decision,
  },
});
const enviarWebhook = (app, evento, { secreto = SECRETO, ts, cabecerasExtra = {}, crudo = Buffer.from(JSON.stringify(evento)) } = {}) => {
  const t = String(ts ?? Math.floor(Date.now() / 1000));
  return fetch(app.base + '/api/kyc/webhook', { method: 'POST', body: crudo,
    headers: { 'Content-Type': 'application/json', 'x-timestamp': t, 'x-signature': firmarCrudo(crudo, secreto), ...cabecerasExtra } }).then(async (r) => ({ estado: r.status, datos: await r.json() }));
};

test('Didit: firma del webhook (bytes crudos, JSON canónico V2, secreto rotado, fecha, manipulación)', async () => {
  const { verificarFirma, canonico } = await import('./didit.mjs');
  const evento = eventoDidit({}, {});
  const crudo = Buffer.from(JSON.stringify(evento));
  const ahora = Math.floor(Date.now() / 1000);
  const h = (extra) => ({ 'x-timestamp': String(ahora), ...extra });
  assert.ok(verificarFirma(crudo, h({ 'x-signature': firmarCrudo(crudo) }), SECRETO), 'X-Signature sobre los bytes exactos');
  // V2: canónico (llaves ordenadas, sin espacios, Unicode sin escapar) — aunque el cuerpo llegue con otro orden y espacios
  const reordenado = Buffer.from(JSON.stringify(evento, null, 2));
  const v2 = createHmac('sha256', SECRETO).update(canonico(evento)).digest('hex');
  assert.ok(verificarFirma(reordenado, h({ 'x-signature-v2': v2 }), SECRETO), 'X-Signature-V2 sobrevive a un re-formateo');
  assert.match(canonico({ b: 1, a: { z: 'José', 10: 1, 9: 2 } }), /^\{"a":\{"10":1,"9":2,"z":"José"\},"b":1\}$/, 'orden por texto, Unicode sin escapar');
  // secreto rotado: la firma con el secreto anterior llega en -Previous
  assert.ok(verificarFirma(crudo, h({ 'x-signature': 'mala', 'x-signature-previous': firmarCrudo(crudo) }), SECRETO));
  // rechazos
  assert.equal(verificarFirma(crudo, h({ 'x-signature': firmarCrudo(crudo, 'otro') }), SECRETO), null, 'secreto incorrecto');
  assert.equal(verificarFirma(Buffer.from(JSON.stringify({ ...evento, status: 'Declined' })), h({ 'x-signature': firmarCrudo(crudo) }), SECRETO), null, 'cuerpo alterado');
  assert.equal(verificarFirma(crudo, { 'x-timestamp': String(ahora - 400), 'x-signature': firmarCrudo(crudo) }, SECRETO), null, 'fecha vieja (repetición)');
  assert.equal(verificarFirma(crudo, { 'x-signature': firmarCrudo(crudo) }, SECRETO), null, 'sin X-Timestamp');
  assert.equal(verificarFirma(crudo, h({}), SECRETO), null, 'sin firma');
  assert.equal(verificarFirma(crudo, h({ 'x-signature': firmarCrudo(crudo) }), ''), null, 'sin secreto configurado');
  // X-Signature-Simple NO se acepta: solo firma el sobre, no la decisión
  const simple = createHmac('sha256', SECRETO).update(`${evento.timestamp}:${evento.session_id}:${evento.status}:${evento.webhook_type}`).digest('hex');
  assert.equal(verificarFirma(crudo, h({ 'x-signature-simple': simple }), SECRETO), null);
});

test('Didit: crear sesión, webhook firmado → verificación automática, y casos de rechazo', async (t) => {
  const llamadas = [];
  const fetchFn = async (url, init) => { llamadas.push({ url, init }); return { ok: true, status: 201, json: async () => ({ session_id: 'sess-1', url: 'https://verify.didit.me/session/abc', status: 'Not Started' }), text: async () => '' }; };
  const app = await iniciar({ didit: { apiKey: 'sk_test_x', workflowId: 'wf-1', webhookSecret: SECRETO }, baseUrl: 'https://artia.test' }, { fetchFn });
  t.after(app.cerrar);
  const m = app.cliente();
  await m('POST', '/api/registro', { acepta_terminos: true, autoriza_verificacion: true, rol: 'profesor', nombre: 'Laura Gómez', email: 'l@x.co', password: 'clave12345' });
  await m('PUT', '/api/perfil', { nombre: 'Laura Gómez', ciudad: 'Bogotá D.C.', documento: '52123456' });
  await m('POST', '/api/verificacion/documentos?tipo=cedula', PNG);
  await m('POST', '/api/verificacion/documentos?tipo=titulo', PNG);
  assert.equal((await m('GET', '/api/verificacion')).datos.kyc.modo, 'didit');

  const ini = await m('POST', '/api/kyc/iniciar');
  assert.equal(ini.estado, 201);
  assert.equal(ini.datos.url, 'https://verify.didit.me/session/abc', 'devuelve el enlace de Didit');
  const { url, init } = llamadas[0];
  const cuerpo = JSON.parse(init.body);
  assert.equal(url, 'https://verification.didit.me/v3/session/');
  assert.equal(init.headers['x-api-key'], 'sk_test_x');
  assert.equal(cuerpo.workflow_id, 'wf-1');
  assert.match(cuerpo.vendor_data, /^artia-mentor-\d+$/);
  assert.equal(cuerpo.callback, 'https://artia.test/api/kyc/retorno');
  assert.equal(cuerpo.language, 'es');
  assert.equal(cuerpo.expected_details.id_country, 'COL');
  assert.match(cuerpo.biometric_consent.given_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, 'se informa a Didit la autorización ya recogida');
  assert.ok(cuerpo.biometric_consent.text_version);
  assert.equal(cuerpo.expected_details.identification_number, '52123456');

  const retorno = await fetch(app.base + '/api/kyc/retorno?verificationSessionId=sess-1&status=Approved', { redirect: 'manual' });
  assert.equal(retorno.status, 302);
  assert.equal(retorno.headers.get('location'), '/#/verificacion?kyc=1');

  // firma mala → 401 y no cambia nada
  assert.equal((await enviarWebhook(app, eventoDidit(), { secreto: 'otro' })).estado, 401);
  assert.equal((await m('GET', '/api/verificacion')).datos.kyc.estado, 'pendiente');
  // evento «en curso» no pisa nada
  assert.equal((await enviarWebhook(app, eventoDidit({ status: 'In Progress' }, { id_verifications: null }))).estado, 200);
  assert.equal((await m('GET', '/api/verificacion')).datos.kyc.estado, 'pendiente');
  // aprobado y todo coincide (número en document_number con puntos; nombre en orden «NOMBRE APELLIDOS»)
  assert.equal((await enviarWebhook(app, eventoDidit())).estado, 200);
  assert.equal((await m('GET', '/api/verificacion')).datos.kyc.estado, 'aprobado');
  assert.equal((await m('POST', '/api/verificacion/enviar')).datos.estado, 'verificado');

  // otro mentor: Didit aprueba pero el documento es de otra persona → administrador, con motivos
  const p = app.cliente();
  await p('POST', '/api/registro', { acepta_terminos: true, autoriza_verificacion: true, rol: 'profesor', nombre: 'Pedro Salazar', email: 'p@x.co', password: 'clave12345' });
  await p('PUT', '/api/perfil', { nombre: 'Pedro Salazar', documento: '80111222' });
  await p('POST', '/api/kyc/iniciar');
  llamadas.length = 0;
  app.db.prepare(`UPDATE usuarios SET kyc_sesion = 'sess-2' WHERE email = 'p@x.co'`).run();
  await enviarWebhook(app, eventoDidit({ session_id: 'sess-2' }));   // documento de Laura Gómez, cédula 52123456
  const v = (await p('GET', '/api/verificacion')).datos.kyc;
  assert.equal(v.estado, 'revision');
  assert.equal(v.motivos.length, 3, 'cédula, nombre y cédula ya usada por otra cuenta');
  assert.match(v.motivos.join(' '), /otra cuenta/);

  // sin prueba de vida o sin rostro en el flujo → nunca se verifica solo
  const q2 = app.cliente();
  await q2('POST', '/api/registro', { acepta_terminos: true, autoriza_verificacion: true, rol: 'profesor', nombre: 'Ana Ruiz', email: 'a@x.co', password: 'clave12345' });
  await q2('PUT', '/api/perfil', { nombre: 'Ana Ruiz', documento: '52123456' });
  await q2('POST', '/api/kyc/iniciar');
  app.db.prepare(`UPDATE usuarios SET kyc_sesion = 'sess-3' WHERE email = 'a@x.co'`).run();
  await enviarWebhook(app, eventoDidit({ session_id: 'sess-3' }, { id_verifications: [{ status: 'Approved', document_number: '52123456', full_name: 'Ana Ruiz' }], liveness_checks: null, face_matches: [{ status: 'Declined' }] }));
  const v3 = (await q2('GET', '/api/verificacion')).datos.kyc;
  assert.equal(v3.estado, 'revision');
  assert.match(v3.motivos.join(' '), /rostro/);
  assert.match(v3.motivos.join(' '), /vida/);

  // Didit rechaza el documento → el mentor puede reintentar
  const r = app.cliente();
  await r('POST', '/api/registro', { acepta_terminos: true, autoriza_verificacion: true, rol: 'profesor', nombre: 'Marta Ríos', email: 'm@x.co', password: 'clave12345' });
  await r('PUT', '/api/perfil', { nombre: 'Marta Ríos', documento: '60123456' });
  await r('POST', '/api/kyc/iniciar');
  app.db.prepare(`UPDATE usuarios SET kyc_sesion = 'sess-4' WHERE email = 'm@x.co'`).run();
  await enviarWebhook(app, eventoDidit({ session_id: 'sess-4', status: 'Declined' }, { id_verifications: [{ status: 'Declined', warnings: [{ risk: 'DOCUMENT_EXPIRED' }] }] }));
  assert.equal((await r('GET', '/api/verificacion')).datos.kyc.estado, 'rechazado');

  // eventos desordenados: uno más antiguo no pisa el resultado reciente
  const t0 = Math.floor(Date.now() / 1000);
  await enviarWebhook(app, eventoDidit({ session_id: 'sess-4', status: 'Approved', created_at: t0 + 100 }, { id_verifications: [{ status: 'Approved', document_number: '60123456', full_name: 'Marta Ríos' }] }));
  assert.equal((await r('GET', '/api/verificacion')).datos.kyc.estado, 'aprobado');
  await enviarWebhook(app, eventoDidit({ session_id: 'sess-4', status: 'Declined', created_at: t0 + 50 }, {}));
  assert.equal((await r('GET', '/api/verificacion')).datos.kyc.estado, 'aprobado', 'el evento antiguo se ignora');

  // sesión desconocida: se acepta (200) sin efecto; sin proveedor la ruta no existe
  assert.equal((await enviarWebhook(app, eventoDidit({ session_id: 'no-existe' }))).estado, 200);
  const sin = await iniciar(); t.after(sin.cerrar);
  assert.equal((await enviarWebhook(sin, eventoDidit())).estado, 404);
});

test('Didit: error del proveedor al crear la sesión no deja al mentor a medias', async (t) => {
  const fetchFn = async () => ({ ok: false, status: 400, text: async () => '{"workflow_id":["Invalid workflow_id."]}', json: async () => ({}) });
  const app = await iniciar({ didit: { apiKey: 'k', workflowId: 'mal', webhookSecret: SECRETO } }, { fetchFn }); t.after(app.cerrar);
  const m = app.cliente();
  await m('POST', '/api/registro', { acepta_terminos: true, autoriza_verificacion: true, rol: 'profesor', nombre: 'Laura Gómez', email: 'l@x.co', password: 'clave12345' });
  await m('PUT', '/api/perfil', { nombre: 'Laura Gómez', documento: '52123456' });
  const r = await m('POST', '/api/kyc/iniciar');
  assert.equal(r.estado, 502);
  assert.doesNotMatch(JSON.stringify(r.datos), /workflow_id/, 'no filtra el detalle interno al usuario');
  assert.equal((await m('GET', '/api/verificacion')).datos.kyc.estado, '');
});

test('KYC: la cédula sale del documento verificado (sin escribirla antes) y no se repite entre cuentas', async (t) => {
  const app = await iniciar({ kycSimulado: true }); t.after(app.cerrar);
  const nuevo = async (nombre, correo) => {
    const m = app.cliente();
    await m('POST', '/api/registro', { acepta_terminos: true, autoriza_verificacion: true, rol: 'profesor', nombre, email: correo, password: 'clave12345' });
    await m('POST', '/api/verificacion/documentos?tipo=cedula', PNG);
    await m('POST', '/api/verificacion/documentos?tipo=titulo', PNG);
    return m;
  };
  const a = await nuevo('Camila Ortiz', 'c@x.co');
  assert.equal((await a('GET', '/api/yo')).datos.usuario.documento, '', 'no tiene cédula escrita');
  assert.equal((await a('POST', '/api/kyc/iniciar')).estado, 201);
  assert.equal((await a('POST', '/api/verificacion/enviar')).estado, 400, 'falta la identidad');
  assert.equal((await a('POST', '/api/kyc/simular', { desenlace: 'aprobado' })).datos.kyc_estado, 'aprobado');
  assert.equal((await a('GET', '/api/yo')).datos.usuario.documento, '1020304050', 'la cédula verificada queda en el perfil');
  assert.equal((await a('GET', '/api/verificacion')).datos.completo, true);
  assert.equal((await a('POST', '/api/verificacion/enviar')).datos.estado, 'verificado');

  // otra cuenta con la misma cédula verificada → administrador, y no se le asigna esa cédula
  const b = await nuevo('Pedro Salazar', 'p@x.co');
  await b('POST', '/api/kyc/iniciar');
  const r = await b('POST', '/api/kyc/simular', { desenlace: 'aprobado' });
  assert.equal(r.datos.kyc_estado, 'revision');
  assert.match(r.datos.motivos.join(' '), /otra cuenta de mentor/);
  assert.equal((await b('GET', '/api/yo')).datos.usuario.documento, '');
  assert.equal((await b('POST', '/api/verificacion/enviar')).datos.estado, 'pendiente');

  // sin proveedor (modo manual) la cédula sigue siendo obligatoria
  const sin = await iniciar(); t.after(sin.cerrar);
  const x = sin.cliente();
  await x('POST', '/api/registro', { acepta_terminos: true, autoriza_verificacion: true, rol: 'profesor', nombre: 'Ana Ruiz', email: 'a@x.co', password: 'clave12345' });
  await x('POST', '/api/verificacion/documentos?tipo=cedula', PNG);
  await x('POST', '/api/verificacion/documentos?tipo=cedula', PNG);
  await x('POST', '/api/verificacion/documentos?tipo=titulo', PNG);
  assert.equal((await x('POST', '/api/verificacion/enviar')).estado, 400);
});

test('la foto de la cédula y el título son obligatorios también con KYC', async (t) => {
  const app = await iniciar({ kycSimulado: true }); t.after(app.cerrar);
  const m = app.cliente();
  await m('POST', '/api/registro', { acepta_terminos: true, autoriza_verificacion: true, rol: 'profesor', nombre: 'Camila Ortiz', email: 'c@x.co', password: 'clave12345' });
  await m('POST', '/api/kyc/iniciar');
  await m('POST', '/api/kyc/simular', { desenlace: 'aprobado' });
  assert.equal((await m('GET', '/api/verificacion')).datos.completo, false, 'identidad ok pero sin documentos');
  let r = await m('POST', '/api/verificacion/enviar');
  assert.equal(r.estado, 400);
  assert.match(r.datos.error, /cédula/);
  await m('POST', '/api/verificacion/documentos?tipo=cedula', PNG);
  r = await m('POST', '/api/verificacion/enviar');
  assert.equal(r.estado, 400, 'con solo la cédula tampoco alcanza');
  assert.match(r.datos.error, /título/);
  await m('POST', '/api/verificacion/documentos?tipo=titulo', PNG);
  assert.equal((await m('GET', '/api/verificacion')).datos.completo, true);
  assert.equal((await m('POST', '/api/verificacion/enviar')).datos.estado, 'verificado');
});

test('términos y condiciones: aceptación obligatoria, registrada y versionada', async (t) => {
  const app = await iniciar(); t.after(app.cerrar);
  const base = { nombre: 'Ana Ruiz', email: 'ana@x.co', password: 'clave12345', colegio_tipo: 'publico' };
  const c = app.cliente();
  let r = await c('POST', '/api/registro', { ...base, rol: 'estudiante' });
  assert.equal(r.estado, 400, 'sin aceptar no se crea la cuenta');
  assert.match(r.datos.error, /Términos/);
  assert.equal((await c('POST', '/api/registro', { ...base, rol: 'estudiante', acepta_terminos: false })).estado, 400);
  assert.equal(app.db.prepare('SELECT COUNT(*) n FROM usuarios').get().n, 0, 'no quedó ninguna cuenta a medias');
  r = await c('POST', '/api/registro', { ...base, rol: 'estudiante', acepta_terminos: true });
  assert.equal(r.estado, 201);
  assert.equal(r.datos.usuario.terminos_ok, true);
  assert.equal(r.datos.usuario.verificacion_autorizada, false, 'un estudiante no autoriza verificación de identidad');
  const fila = app.db.prepare(`SELECT terminos_version, terminos_fecha FROM usuarios WHERE email = 'ana@x.co'`).get();
  assert.match(fila.terminos_version, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(fila.terminos_fecha, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, 'queda la fecha y hora de la aceptación');
  assert.ok((await app.cliente()('GET', '/api/catalogo')).datos.terminosVersion);

  // el mentor además autoriza expresamente la verificación de su identidad (datos sensibles)
  const m = app.cliente();
  const mb = { nombre: 'Laura Gómez', email: 'l@x.co', password: 'clave12345', rol: 'profesor', acepta_terminos: true };
  r = await m('POST', '/api/registro', mb);
  assert.equal(r.estado, 400);
  assert.match(r.datos.error, /identidad/);
  r = await m('POST', '/api/registro', { ...mb, autoriza_verificacion: true });
  assert.equal(r.estado, 201);
  assert.equal(r.datos.usuario.verificacion_autorizada, true);

  // quien aceptó una versión anterior debe aceptar la vigente
  app.db.prepare(`UPDATE usuarios SET terminos_version = '2020-01-01' WHERE email = 'ana@x.co'`).run();
  const a = app.cliente(); await a('POST', '/api/login', { email: 'ana@x.co', password: 'clave12345' });
  assert.equal((await a('GET', '/api/yo')).datos.usuario.terminos_ok, false);
  assert.equal((await a('POST', '/api/terminos/aceptar', {})).estado, 400);
  assert.equal((await a('POST', '/api/terminos/aceptar', { acepta_terminos: true })).datos.usuario.terminos_ok, true);
  assert.equal((await app.cliente()('POST', '/api/terminos/aceptar', { acepta_terminos: true })).estado, 401);
});

test('verificación de identidad exige la autorización específica del mentor', async (t) => {
  const app = await iniciar({ kycSimulado: true }); t.after(app.cerrar);
  const m = app.cliente();
  await m('POST', '/api/registro', { rol: 'profesor', nombre: 'Laura Gómez', email: 'l@x.co', password: 'clave12345', acepta_terminos: true, autoriza_verificacion: true });
  // cuenta anterior sin autorización registrada
  app.db.prepare(`UPDATE usuarios SET verificacion_autorizada = ''`).run();
  assert.equal((await m('POST', '/api/kyc/iniciar')).estado, 403);
  assert.equal((await m('POST', '/api/verificacion/documentos?tipo=cedula', PNG)).estado, 403, 'tampoco se suben documentos');
  assert.equal((await m('POST', '/api/verificacion/autorizar', {})).estado, 400, 'hay que marcarla');
  assert.equal((await m('POST', '/api/verificacion/autorizar', { acepto: true })).estado, 200);
  assert.ok(app.db.prepare(`SELECT verificacion_autorizada v FROM usuarios`).get().v, 'queda la fecha de la autorización');
  assert.equal((await m('POST', '/api/kyc/iniciar')).estado, 201);
  assert.equal((await m('POST', '/api/verificacion/documentos?tipo=cedula', PNG)).estado, 201);
  const est = app.cliente(); await registrar(est, 'estudiante', 'Ana');
  assert.equal((await est('POST', '/api/verificacion/autorizar', { acepto: true })).estado, 403, 'solo mentores');
});
