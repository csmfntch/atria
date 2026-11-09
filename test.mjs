// Pruebas de la API: node --test test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { abrirBD } from './db.mjs';
import { crearApp } from './server.mjs';

let servidor, base;
before(async () => {
  servidor = createServer(crearApp(abrirBD(':memory:')));
  await new Promise((r) => servidor.listen(0, r));
  base = `http://localhost:${servidor.address().port}`;
});
after(() => servidor.close());

// cliente mínimo con cookie propia
const cliente = () => {
  let cookie = '';
  return async (metodo, ruta, cuerpo) => {
    const r = await fetch(base + ruta, {
      method: metodo,
      headers: { ...(cuerpo ? { 'Content-Type': 'application/json' } : {}), cookie },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    cookie = r.headers.get('set-cookie')?.split(';')[0] ?? cookie;
    return { estado: r.status, datos: await r.json().catch(() => ({})) };
  };
};

test('flujo completo profesor ↔ estudiante', async () => {
  const prof = cliente(), est = cliente();

  let r = await prof('POST', '/api/registro', { rol: 'profesor', nombre: 'Laura', email: 'l@x.co', password: 'clave12345' });
  assert.equal(r.estado, 201);
  r = await prof('POST', '/api/registro', { rol: 'profesor', nombre: 'Otra', email: 'L@x.co', password: 'clave12345' });
  assert.equal(r.estado, 409, 'correo duplicado (sin distinguir mayúsculas)');
  r = await prof('POST', '/api/registro', { rol: 'profesor', nombre: 'X', email: 'z@x.co', password: 'corta' });
  assert.equal(r.estado, 400);

  r = await prof('PUT', '/api/perfil', { nombre: 'Laura Gómez', ciudad: 'Bogotá D.C.', telefono: '+57 300 123 4567', materias: 'Matemáticas, Matemáticas, Física', tarifa: 45000, modalidad: 'ambas' });
  assert.equal(r.estado, 200);
  assert.equal(r.datos.usuario.telefono, '3001234567');
  assert.equal(r.datos.usuario.materias, 'Matemáticas, Física');
  r = await prof('PUT', '/api/perfil', { nombre: 'Laura', telefono: '12345' });
  assert.equal(r.estado, 400, 'celular inválido');

  r = await prof('POST', '/api/clases', { titulo: 'Álgebra', materia: 'Matemáticas', precio_hora: 1000, modalidad: 'virtual' });
  assert.equal(r.estado, 400, 'precio mínimo');
  r = await prof('POST', '/api/clases', { titulo: 'Álgebra', materia: 'Matemáticas', precio_hora: 40000, modalidad: 'presencial' });
  assert.equal(r.estado, 201, 'usa la ciudad del perfil');
  const claseId = r.datos.clase.id;
  assert.equal(r.datos.clase.ciudad, 'Bogotá D.C.');

  await est('POST', '/api/registro', { rol: 'estudiante', nombre: 'Sofía', email: 's@x.co', password: 'clave12345' });
  r = await est('POST', '/api/clases', { titulo: 'x', materia: 'x', precio_hora: 40000, modalidad: 'virtual' });
  assert.equal(r.estado, 403, 'un estudiante no publica clases');

  // búsqueda
  r = await est('GET', '/api/clases?q=lgebra&materia=Matem%C3%A1ticas&max=50000');
  assert.equal(r.datos.clases.length, 1);
  r = await est('GET', '/api/clases?max=10000');
  assert.equal(r.datos.clases.length, 0);
  r = await est('GET', '/api/clases?q=%25');
  assert.equal(r.datos.clases.length, 0, 'el comodín % se escapa');
  r = await est('GET', '/api/clases?ciudad=Cali');
  assert.equal(r.datos.clases.length, 0, 'presencial de otra ciudad no aparece');

  // reserva y privacidad del celular
  await est('PUT', '/api/perfil', { nombre: 'Sofía', ciudad: 'Cali', telefono: '3205550202' });
  r = await est('POST', '/api/reservas', { clase_id: claseId, mensaje: 'Hola' });
  assert.equal(r.estado, 201);
  r = await est('POST', '/api/reservas', { clase_id: claseId });
  assert.equal(r.estado, 409, 'reserva duplicada');
  r = await prof('GET', '/api/reservas');
  assert.equal(r.datos.reservas[0].contacto, '', 'sin celular antes de aceptar');
  const reservaId = r.datos.reservas[0].id;
  r = await est('PUT', `/api/reservas/${reservaId}`, { estado: 'aceptada' });
  assert.equal(r.estado, 403, 'el estudiante no puede aceptar');
  r = await prof('PUT', `/api/reservas/${reservaId}`, { estado: 'aceptada' });
  assert.equal(r.estado, 200);
  r = await prof('GET', '/api/reservas');
  assert.equal(r.datos.reservas[0].contacto, '3205550202');
  r = await est('GET', '/api/reservas');
  assert.equal(r.datos.reservas[0].contacto, '3001234567');

  // solicitudes y ofertas
  r = await est('POST', '/api/solicitudes', { materia: 'Física', descripcion: 'Ayuda', presupuesto: 30000, modalidad: 'virtual' });
  assert.equal(r.estado, 201);
  const solId = r.datos.id;
  r = await prof('GET', '/api/solicitudes');
  assert.equal(r.datos.solicitudes.length, 1);
  assert.ok(!('telefono' in r.datos.solicitudes[0]) && !('estudiante_id' in r.datos.solicitudes[0]), 'no expone datos privados');
  r = await prof('POST', `/api/solicitudes/${solId}/ofertas`, { mensaje: 'Puedo ayudarte', clase_id: claseId });
  assert.equal(r.estado, 201);
  r = await prof('POST', `/api/solicitudes/${solId}/ofertas`, { mensaje: 'otra vez' });
  assert.equal(r.estado, 409);
  r = await est('GET', '/api/solicitudes');
  assert.equal(r.datos.solicitudes[0].ofertas.length, 1);

  // un profesor ajeno no puede editar clases de otro
  const otro = cliente();
  await otro('POST', '/api/registro', { rol: 'profesor', nombre: 'Pedro', email: 'p@x.co', password: 'clave12345' });
  r = await otro('PUT', `/api/clases/${claseId}`, { titulo: 'Hack', materia: 'x', precio_hora: 40000, modalidad: 'virtual' });
  assert.equal(r.estado, 404);
  r = await otro('DELETE', `/api/clases/${claseId}`);
  assert.equal(r.estado, 404);
});

test('sesión, logout y rutas protegidas', async () => {
  const c = cliente();
  assert.equal((await c('GET', '/api/reservas')).estado, 401);
  await c('POST', '/api/registro', { rol: 'estudiante', nombre: 'Ana', email: 'a@x.co', password: 'clave12345' });
  assert.equal((await c('GET', '/api/yo')).datos.usuario.email, 'a@x.co');
  const mala = await cliente()('POST', '/api/login', { email: 'a@x.co', password: 'incorrecta' });
  assert.equal(mala.estado, 401);
  await c('POST', '/api/logout');
  assert.equal((await c('GET', '/api/yo')).datos.usuario, null);
});

test('archivos estáticos y 404', async () => {
  const idx = await fetch(base + '/');
  assert.equal(idx.status, 200);
  assert.match(await idx.text(), /Artia/);
  assert.equal((await fetch(base + '/no-existe.js')).status, 404);
  assert.equal((await fetch(base + '/api/nada')).status, 404);
  const trav = await fetch(base + '/..%2f..%2fpackage.json');
  assert.notEqual(trav.status, 200);
});
