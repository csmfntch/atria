// Artia — interfaz (español, COP). Rutas con hash: #/clases, #/agenda, #/suscripcion, ...
const $app = document.getElementById('app');
const $nav = document.getElementById('nav');
const $aviso = document.getElementById('aviso');

import { terminos, privacidad, datosEmpresa, AUTORIZACION_VERIFICACION } from '/legal.js';

// ---------- utilidades ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
class Raw { constructor(s) { this.s = s; } }
const val = (v) => (v instanceof Raw ? v.s : Array.isArray(v) ? v.map(val).join('') : esc(v));
const html = (t, ...v) => new Raw(t.reduce((a, s, i) => a + s + (i < v.length ? val(v[i]) : ''), ''));
const sel = (cond) => (cond ? new Raw('selected') : '');
const chk = (cond) => (cond ? new Raw('checked') : '');

const cop = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
const MOD = { virtual: 'Virtual', presencial: 'Presencial', ambas: 'Virtual y presencial' };
const ESTADO = { pendiente: 'espera', aceptada: 'ok', rechazada: 'mal', cancelada: 'mal' };
const ESTADO_TXT = { pendiente: 'Pendiente', aceptada: 'Confirmada', rechazada: 'Rechazada', cancelada: 'Cancelada' };
const COLEGIO = { publico: 'Colegio público', privado: 'Colegio privado', ninguno: 'Sin colegio' };
const fechaSQL = (s) => new Date(s.replace(' ', 'T') + 'Z').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
const diaLargo = (f) => new Date(f + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
const hora12 = (h) => { const [H, M] = h.split(':').map(Number); return `${H % 12 || 12}:${String(M).padStart(2, '0')} ${H < 12 ? 'a. m.' : 'p. m.'}`; };
const finHora = (h, dur) => { const t = Number(h.slice(0, 2)) * 60 + Number(h.slice(3)) + dur; return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
const celular = (t) => `${t.slice(0, 3)} ${t.slice(3, 6)} ${t.slice(6)}`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const estrellas = (p) => (p == null ? '' : html`<span class="estrellas" role="img" aria-label="${p} de 5">${'★'.repeat(Math.round(p))}${'☆'.repeat(5 - Math.round(p))}</span>`);
const insignia = (c) => (c.verificado ? html`<span class="verif" title="Identidad y título revisados por Artia">✓ Verificado</span>` : '');

let yo = null;
let catalogo = { ciudades: [], materias: [], categorias: [], niveles: [], localidades: [], colegioTipos: {}, grados: [], dias: [], empresa: {}, soporte: '', legalRevisado: false };
const ICONOS = { 'Idiomas': '🗣️', 'Ciencias y números': '🧮', 'Humanidades': '📖', 'Bienestar y espiritualidad': '🧘', 'Arte y creatividad': '🎨', 'Deportes': '🎾', 'Tecnología': '🤖', 'Business': '💼', 'Psicoterapia': '🧠', 'Danza': '💃', 'Música': '🎵', 'Juegos de mesa': '🎲', 'Pastelería': '🧁', 'Cocina': '🍳', 'Enología': '🍷', 'Decoración': '🛋️' };

async function api(metodo, ruta, cuerpo) {
  const r = await fetch(ruta, {
    method: metodo,
    headers: cuerpo ? { 'Content-Type': 'application/json' } : {},
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(datos.error || 'Algo salió mal. Inténtalo de nuevo.');
  return datos;
}
function avisar(msg) {
  $aviso.textContent = msg;
  $aviso.classList.add('ver');
  setTimeout(() => $aviso.classList.remove('ver'), 3200);
}
const opciones = (lista, actual = '', vacio) =>
  html`${vacio ? html`<option value="">${vacio}</option>` : ''}${lista.map((x) => html`<option ${sel(x === actual)}>${x}</option>`)}`;
/** <option>s de materias agrupadas por categoría. */
const opcionesMaterias = (actual = '', vacio) =>
  html`${vacio ? html`<option value="">${vacio}</option>` : ''}${catalogo.categorias.map((c) =>
    html`<optgroup label="${c.nombre}">${c.materias.map((m) => html`<option ${sel(m === actual)}>${m}</option>`)}</optgroup>`)}`;
const optMod = (actual) => html`${Object.entries(MOD).map(([k, v]) => html`<option value="${k}" ${sel(k === actual)}>${v}</option>`)}`;
const datosForm = (f) => { const o = {}; for (const [k, v] of new FormData(f)) o[k] = k in o ? `${o[k]}, ${v}` : v; return o; };
const fallo = (e) => html`<p class="error" role="alert">${e.message}</p>`;

// ---------- avisos de cuenta (suscripción, verificación, perfil) ----------
function perfilEstudianteIncompleto(u) {
  return !u.ciudad || !u.colegio_tipo || (u.colegio_tipo !== 'ninguno' && !u.colegio_nombre) || (u.es_menor && (!u.acudiente_nombre || !u.acudiente_celular));
}
function avisosCuenta() {
  if (!yo) return html``;
  const items = [];
  if (yo.clave_temporal) items.push(html`Entraste con una clave temporal. <a href="#/perfil">Cámbiala ahora</a> en «Seguridad de la cuenta».`);
  if (!yo.terminos_ok) items.push(html`Actualizamos los <a href="#/terminos">Términos</a> y la <a href="#/privacidad">Política de Datos</a>. <button class="btn chico" data-accion="aceptar-terminos">Aceptar</button>`);
  const s = yo.suscripcion;
  if (yo.rol === 'profesor' && yo.verificacion_estado !== 'verificado') {
    items.push(yo.verificacion_estado === 'pendiente'
      ? html`Estamos revisando tu verificación. Tus clases serán públicas cuando la aprobemos.`
      : html`Tus clases no son visibles hasta que <a href="#/verificacion">verifiques tu identidad</a>.`);
  }
  if (!s.activa && yo.rol === 'profesor') {
    items.push(html`${yo.rol === 'profesor' ? 'Activa tu suscripción para publicar tus clases y recibir reservas.' : 'Activa tu suscripción para reservar clases.'} <a href="#/suscripcion">Ir a suscripción</a>`);
  } else if (s.activa && s.vence && Date.parse(s.vence.replace(' ', 'T') + 'Z') - Date.now() < 5 * 86400000) {
    items.push(html`Tu suscripción vence el ${fechaSQL(s.vence)}. <a href="#/suscripcion">Renovar</a>`);
  }
  if (yo.resenas_pendientes) items.push(html`Tienes ${yo.resenas_pendientes} ${yo.resenas_pendientes === 1 ? 'clase' : 'clases'} por calificar. <a href="#/agenda">Calificar ahora</a>`);
  if (yo.rol === 'estudiante' && perfilEstudianteIncompleto(yo)) items.push(html`Completa tu perfil (colegio y acudiente si eres menor) para poder reservar. <a href="#/perfil">Ir a mi perfil</a>`);
  return items.length ? html`<div class="banner" role="status">${items.map((i) => html`<p>${i}</p>`)}</div>` : html``;
}
function pintar(r, { aviso = true } = {}) { $app.innerHTML = (aviso ? avisosCuenta().s : '') + r.s; }

// ---------- navegación ----------
function pintarNav() {
  const enlaces = [['#/clases', 'Buscar clases']];
  const pendientes = yo ? yo.pasos.filter((p) => !p.ok).length : 0;
  if (pendientes) enlaces.unshift(['#/empezar', `Primeros pasos (${yo.pasos.length - pendientes}/${yo.pasos.length})`]);
  if (yo?.rol === 'profesor') enlaces.push(['#/mis-clases', 'Mis clases'], ['#/horarios', 'Horarios'], ['#/agenda', 'Agenda'], ['#/solicitudes', 'Solicitudes'], ['#/ganancias', 'Ganancias']);
  if (yo?.rol === 'estudiante') enlaces.push(['#/agenda', 'Mi agenda'], ['#/solicitudes', 'Lo que busco']);
  if (yo?.es_admin) enlaces.push(['#/admin', 'Administración']);
  if (yo) enlaces.push(['#/perfil', 'Mi cuenta']);
  const actual = location.hash || '#/';
  const cuenta = ['#/perfil', '#/suscripcion', '#/verificacion', '#/ganancias'];
  $nav.innerHTML = enlaces.map(([h, t]) => {
    const activo = h === '#/perfil' ? cuenta.some((c) => actual.startsWith(c)) : actual.startsWith(h);
    return `<a href="${h}" ${activo ? 'aria-current="page"' : ''}>${esc(t)}</a>`;
  }).join('') + (yo && !yo.suscripcion.activa ? '<a href="#/suscripcion" class="btn chico activar">Activa tu suscripción</a>' : '') + (yo ? '<button data-accion="salir">Salir</button>' : '<a href="#/ingresar">Ingresar</a><a href="#/registro" class="btn chico">Crear cuenta</a>');
}
const tabsCuenta = (actual) => html`
  <div class="tabs" role="tablist">
    <a href="#/perfil" class="${actual === 'perfil' ? 'activa' : ''}">Perfil</a>
    ${yo.rol === 'estudiante' ? html`<a href="#/suscripcion" class="${actual === 'suscripcion' ? 'activa' : ''}">Suscripción</a>` : html`<a href="#/ganancias" class="${actual === 'ganancias' ? 'activa' : ''}">Ganancias</a>`}
    ${yo.rol === 'profesor' ? html`<a href="#/verificacion" class="${actual === 'verificacion' ? 'activa' : ''}">Verificación</a>` : ''}
  </div>`;

// ---------- vistas públicas ----------
const tarjetaClase = (c) => html`
  <article class="tarjeta">
    <span class="etiqueta">${c.materia}</span>
    <h3><a href="#/clase/${c.id}">${c.titulo}</a></h3>
    <div class="suave">con <a href="#/profesor/${c.profesor_id}">${c.profesor_nombre}</a> ${insignia(c)}</div>
    ${c.promedio != null ? html`<div class="suave">${estrellas(c.promedio)} ${c.promedio} (${c.num_resenas})</div>` : html`<div class="suave">Aún sin reseñas</div>`}
    <div>${c.nivel ? html`<span class="etiqueta">${c.nivel}</span>` : ''}<span class="etiqueta">${MOD[c.modalidad]}${c.ciudad && c.modalidad !== 'virtual' ? ' · ' + c.ciudad : ''}</span></div>
    <div class="precio">${cop(c.precio_hora)} <span class="suave">/ hora</span></div>
  </article>`;

async function vistaInicio() {
  const { clases } = await api('GET', '/api/clases');
  pintar(html`
    <section class="hero">
      <h1>El arte de <br><em>aprender.</em></h1>
      <p>Conecta con profesores, creadores y mentores de toda Colombia para dominar nuevas habilidades y oficios. Clases virtuales y presenciales.</p>
      <div class="acciones">
        <a class="btn morado" href="#/clases">Encontrar una clase</a>
        ${yo?.rol === 'profesor' ? html`<a class="btn sec" href="#/mis-clases">Mis clases</a>`
          : yo ? html`<a class="btn sec" href="#/solicitudes">Publicar lo que busco</a>`
          : html`<a class="btn sec" href="#/registro?rol=profesor">Conviértete en mentor</a>`}
      </div>
    </section>
    <section class="mision" aria-labelledby="mision-t">
      <p class="mision-meta"><b>10.000.000</b> personas más felices · <b>2030</b></p>
      <h2 id="mision-t">Conectamos metas y pasiones en un solo lugar.</h2>
      <div class="mision-cols">
        <article><h3>Nuestra misión</h3><p>Hacer más felices a 10 millones de personas para 2030, conectándolas con quienes pueden guiarlas para que alcancen sus metas y sueños.</p></article>
        <article><h3>Nuestra visión</h3><p>Ser el lugar de Latinoamérica donde cualquiera encuentra a quien le enseñe lo que sueña aprender, y donde cada pasión compartida se convierte en una oportunidad.</p></article>
      </div>
    </section>
    <h2>Aprende algo nuevo y llévate más que una clase</h2>
    <p class="suave sub-seccion">Cada categoría trae mentores verificados. Elige la que más te llame y empieza hoy.</p>
    <div class="categorias-pro">${catalogo.categorias.map((c) => html`
      <a class="cat-tarjeta" href="#/clases?categoria=${encodeURIComponent(c.nombre)}">
        <span class="cat-icono" aria-hidden="true">${ICONOS[c.nombre] ?? '✨'}</span>
        <h3>${c.nombre}</h3>
        <p><b>Aprenderás</b> ${c.aprenderas}</p>
        <p><b>Te llevas</b> ${c.ganas}</p>
        <span class="cat-materias">${c.materias.slice(0, 4).map((m) => html`<span class="etiqueta">${m}</span>`)}</span>
        <span class="cat-ver">Ver clases →</span>
      </a>`)}</div>
    <h2 style="margin-top:2rem">Clases destacadas</h2>
    ${clases.length ? html`<div class="rejilla">${clases.slice(0, 6).map(tarjetaClase)}</div>` : html`<p class="vacio">Aún no hay clases publicadas. ¡Sé el primero!</p>`}`);
}

async function vistaClases(params) {
  const f = Object.fromEntries(params);
  const activos = Object.entries(f).filter(([, v]) => v);
  const { clases } = await api('GET', '/api/clases' + (activos.length ? '?' + new URLSearchParams(activos) : ''));
  const url = (cambios) => '#/clases?' + new URLSearchParams(Object.entries({ ...f, ...cambios }).filter(([, v]) => v));
  const delCategoria = f.categoria ? catalogo.categorias.find((c) => c.nombre === f.categoria)?.materias ?? [] : null;
  const nFiltros = ['materia', 'ciudad', 'modalidad', 'max', 'calificacion_min', 'q'].filter((k) => f[k]).length;
  pintar(html`
    <h1>Clases</h1>
    <div class="chips" role="group" aria-label="Categorías">
      <a class="chip ${f.categoria ? '' : 'activa'}" href="${url({ categoria: '', materia: '' })}">Todas</a>
      ${catalogo.categorias.map((c) => html`<a class="chip ${f.categoria === c.nombre ? 'activa' : ''}" href="${url({ categoria: c.nombre, materia: '' })}"><span aria-hidden="true">${ICONOS[c.nombre] ?? ''}</span> ${c.nombre}</a>`)}
    </div>
    ${delCategoria ? html`<div class="chips sub" role="group" aria-label="Materias">
      ${delCategoria.map((m) => html`<a class="chip chica ${f.materia === m ? 'activa' : ''}" href="${url({ materia: f.materia === m ? '' : m })}">${m}</a>`)}
    </div>` : ''}
    <details class="filtros-caja" ${window.innerWidth >= 720 || nFiltros ? new Raw('open') : ''}>
      <summary>Filtros${nFiltros ? ` (${nFiltros})` : ''}</summary>
      <form class="filtros" data-form="buscar" role="search">
        <input type="hidden" name="categoria" value="${f.categoria ?? ''}">
        <input name="q" placeholder="¿Qué quieres aprender?" value="${f.q ?? ''}" aria-label="Buscar">
        <select name="materia" aria-label="Materia">${f.categoria ? opciones(delCategoria, f.materia, 'Todas las materias') : opcionesMaterias(f.materia, 'Todas las materias')}</select>
        <select name="ciudad" aria-label="Ciudad">${opciones(catalogo.ciudades, f.ciudad, 'Toda Colombia')}</select>
        <select name="modalidad" aria-label="Modalidad"><option value="">Cualquier modalidad</option>${optMod(f.modalidad)}</select>
        <input name="max" type="number" min="0" step="1000" placeholder="Precio máx. por hora (COP)" value="${f.max ?? ''}" aria-label="Precio máximo por hora">
        <select name="calificacion_min" aria-label="Calificación mínima">
          <option value="">Cualquier calificación</option>
          ${[4, 3].map((n) => html`<option value="${n}" ${sel(f.calificacion_min === String(n))}>${'★'.repeat(n)} o más</option>`)}
        </select>
        <select name="orden" aria-label="Ordenar por">
          <option value="">Mejor calificadas</option>
          <option value="precio_asc" ${sel(f.orden === 'precio_asc')}>Precio: menor a mayor</option>
          <option value="precio_desc" ${sel(f.orden === 'precio_desc')}>Precio: mayor a menor</option>
          <option value="recientes" ${sel(f.orden === 'recientes')}>Más recientes</option>
        </select>
        <button class="btn">Aplicar filtros</button>
      </form>
    </details>
    <p class="suave resultados" aria-live="polite">${clases.length} ${clases.length === 1 ? 'clase encontrada' : 'clases encontradas'}${activos.length ? html` · <a href="#/clases">Limpiar filtros</a>` : ''}</p>
    ${clases.length ? html`<div class="rejilla">${clases.map(tarjetaClase)}</div>` : html`<p class="vacio">No encontramos clases con esos filtros. Prueba con otros o <a href="#/solicitudes">publica lo que buscas</a>.</p>`}`);
}

async function vistaClase(id) {
  const { clase: c, profesor: p, reservable } = await api('GET', `/api/clases/${id}`);
  const esDueno = yo?.id === c.profesor_id;
  let reserva;
  if (!reservable) reserva = html`<p class="tarjeta suave">Esta clase no está disponible para reservas en este momento.</p>`;
  else if (esDueno) reserva = html`<p class="tarjeta suave">Esta es tu clase. Administra tus horarios en <a href="#/horarios">Horarios</a>.</p>`;
  else if (!yo) reserva = html`<p class="tarjeta"><a href="#/ingresar?rol=estudiante">Ingresa</a> o <a href="#/registro?rol=estudiante">crea una cuenta de estudiante</a> para reservar esta clase.</p>`;
  else if (yo.rol !== 'estudiante') reserva = html`<p class="tarjeta suave">Solo las cuentas de estudiante pueden reservar clases.</p>`;
  else if (perfilEstudianteIncompleto(yo)) reserva = html`<p class="tarjeta">Antes de reservar completa tu perfil (colegio público o privado y, si eres menor, tu acudiente). <a class="btn chico" href="#/perfil">Completar perfil</a></p>`;
  else if (!yo.suscripcion.activa) reserva = html`<div class="tarjeta"><p>Para reservar esta clase activa tu suscripción mensual de <b>${cop(yo.suscripcion.precio)}</b>. Al terminar el pago volverás aquí para elegir tu horario.</p><button class="btn" data-accion="pagar" data-volver="${c.id}">Pagar suscripción y reservar</button></div>`;
  else {
    const { dias, duracion_min } = await api('GET', `/api/clases/${c.id}/disponibilidad`);
    reserva = html`
      <form class="tarjeta campos" data-form="reservar" data-id="${c.id}">
        <h2>Elige tu horario</h2>
        <div id="error"></div>
        <p class="suave">Clases de ${duracion_min} minutos · Hora de Colombia (GMT-5)</p>
        ${dias.length ? dias.map((d) => html`
          <fieldset class="dia"><legend>${cap(diaLargo(d.fecha))}</legend>
            <div class="slots">${d.horas.map((h) => html`<label class="slot"><input type="radio" name="slot" value="${d.fecha}|${h}" required><span>${hora12(h)}</span></label>`)}</div>
          </fieldset>`) : html`<p class="vacio">El mentor no tiene horarios libres en los próximos días. Prueba más tarde o <a href="#/solicitudes">publica lo que buscas</a>.</p>`}
        ${dias.length ? html`
          <label>Mensaje para el mentor (opcional)<textarea name="mensaje" maxlength="500" placeholder="Cuéntale tu nivel y qué quieres trabajar"></textarea></label>
          <button class="btn">Pagar y reservar ${cop(Math.round(c.precio_hora * duracion_min / 60))}</button>
          <p class="suave">Pagas la clase ahora, de forma segura, a través de Artia. El mentor confirma tu reserva y, cuando la acepte, verás su WhatsApp para coordinar. Si no la acepta o no puede darte la clase, te devolvemos todo. Puedes cancelar sin costo hasta 24 horas antes.</p>` : ''}
      </form>`;
  }
  pintar(html`
    <p><a href="#/clases">← Volver a las clases</a></p>
    <article class="tarjeta">
      <span class="etiqueta">${c.materia}</span>${c.nivel ? html`<span class="etiqueta">${c.nivel}</span>` : ''}
      <h1>${c.titulo}</h1>
      <p>${c.descripcion || 'Sin descripción.'}</p>
      <p><b>${cop(c.precio_hora)}</b> por hora · ${c.duracion_min} min por sesión · ${MOD[c.modalidad]}${c.ciudad && c.modalidad !== 'virtual' ? ' en ' + c.ciudad : ''}</p>
      <p>Mentor: <a href="#/profesor/${p.id}">${p.nombre}</a> ${insignia(p)}${p.promedio != null ? html` · ${estrellas(p.promedio)} ${p.promedio} (${p.num_resenas})` : ''}${p.ciudad ? ' · ' + p.ciudad : ''}</p>
    </article>
    ${reserva}`);
}

async function vistaProfesor(id) {
  const { profesor: p, clases, resenas } = await api('GET', `/api/profesores/${id}`);
  pintar(html`
    <article class="tarjeta">
      <h1>${p.nombre} ${insignia(p)}</h1>
      <p class="suave">${p.ciudad || 'Colombia'} · ${MOD[p.modalidad]}${p.tarifa ? ' · desde ' + cop(p.tarifa) + ' / hora' : ''}</p>
      <p>${p.promedio != null ? html`${estrellas(p.promedio)} <b>${p.promedio}</b> · ${p.num_resenas} ${p.num_resenas === 1 ? 'reseña' : 'reseñas'}` : 'Aún sin reseñas'}</p>
      <p>${p.bio || ''}</p>
      ${p.materias ? html`<p>${p.materias.split(', ').map((m) => html`<span class="etiqueta">${m}</span>`)}</p>` : ''}
      ${p.experiencia ? html`<p><b>Experiencia:</b> ${p.experiencia}</p>` : ''}
    </article>
    <h2>Clases de ${p.nombre.split(' ')[0]}</h2>
    ${clases.length ? html`<div class="rejilla">${clases.map((c) => tarjetaClase({ ...c, profesor_nombre: p.nombre }))}</div>` : html`<p class="vacio">No tiene clases disponibles por ahora.</p>`}
    <h2 style="margin-top:2rem">Reseñas</h2>
    ${resenas.length ? resenas.map((r) => html`
      <article class="tarjeta"><div>${estrellas(r.calificacion)} <b>${r.autor}</b> <span class="suave">· ${fechaSQL(r.creado)}</span></div>
        ${r.comentario ? html`<p>${r.comentario}</p>` : ''}</article>`) : html`<p class="vacio">Todavía no hay reseñas. Las dejan los estudiantes después de cada clase.</p>`}`);
}

// ---------- acceso (estudiante / mentor) ----------
function vistaAcceso(modo, params) {
  const reg = modo === 'registro';
  const rol = params.get('rol') === 'profesor' ? 'profesor' : 'estudiante';
  const esMentor = rol === 'profesor';
  pintar(html`
    <div class="acceso">
      <div class="tabs" role="tablist" aria-label="Tipo de cuenta">
        <a href="#/${modo}?rol=estudiante" class="${esMentor ? '' : 'activa'}" role="tab" aria-selected="${!esMentor}">Soy estudiante</a>
        <a href="#/${modo}?rol=profesor" class="${esMentor ? 'activa' : ''}" role="tab" aria-selected="${esMentor}">Soy mentor</a>
      </div>
      <form class="tarjeta campos" data-form="${modo}">
        <h1>${reg ? (esMentor ? 'Crea tu cuenta de mentor' : 'Crea tu cuenta de estudiante') : (esMentor ? 'Ingresa como mentor' : 'Ingresa como estudiante')}</h1>
        <p class="suave">${esMentor ? 'Publica tus clases, define tus horarios y recibe estudiantes de toda Colombia.' : 'Encuentra mentores verificados y reserva clases en el horario que te sirva.'}</p>
        <div id="error"></div>
        <input type="hidden" name="rol" value="${rol}">
        ${reg ? html`<label>Nombre completo<input name="nombre" required maxlength="80" autocomplete="name"></label>` : ''}
        <label>Correo electrónico<input name="email" type="email" required autocomplete="email"></label>
        <label>Contraseña${reg ? ' (mínimo 8 caracteres)' : ''}<input name="password" type="password" required minlength="${reg ? 8 : 1}" autocomplete="${reg ? 'new-password' : 'current-password'}"></label>
        ${reg && !esMentor ? html`
          <fieldset class="opciones"><legend>¿Tu colegio es público o privado? (Bogotá)</legend>
            ${Object.entries(catalogo.colegioTipos).map(([k, v]) => html`<label class="opcion"><input type="radio" name="colegio_tipo" value="${k}" required> ${v}</label>`)}
          </fieldset>
          <label class="opcion"><input type="checkbox" name="es_menor"> Soy menor de 18 años (un acudiente deberá registrarse en mi perfil)</label>` : ''}
        ${reg && esMentor ? html`
          <p class="suave">Después de crear tu cuenta verificarás tu identidad (cédula, selfie y título) para que tus clases sean públicas.</p>
          <label class="opcion"><input type="checkbox" name="autoriza_verificacion" required> <span>${AUTORIZACION_VERIFICACION}</span></label>` : ''}
        ${reg ? html`<label class="opcion"><input type="checkbox" name="acepta_terminos" required> <span>Acepto los <a href="#/terminos" target="_blank" rel="noopener">Términos y Condiciones</a> y la <a href="#/privacidad" target="_blank" rel="noopener">Política de Tratamiento de Datos Personales</a>.${!esMentor ? ' Si soy menor de 18 años, mi acudiente los acepta y me autoriza a usar Artia.' : ''}</span></label>` : ''}
        <button class="btn">${reg ? 'Crear cuenta' : 'Ingresar'}</button>
        ${reg ? '' : html`<p class="suave"><a href="#/ayuda-clave">¿Olvidaste tu contraseña?</a></p>`}
        <p class="suave">${reg ? html`¿Ya tienes cuenta? <a href="#/ingresar?rol=${rol}">Ingresa</a>` : html`¿Nuevo aquí? <a href="#/registro?rol=${rol}">Crea tu cuenta</a>`}</p>
      </form>
    </div>`, { aviso: false });
}

// ---------- perfil ----------
function vistaPerfil() {
  const esProf = yo.rol === 'profesor';
  const propias = new Set(yo.materias ? yo.materias.split(', ') : []);
  const interesesTodos = yo.intereses ? yo.intereses.split(', ') : [];
  const interesesPropios = new Set(interesesTodos.filter((i) => catalogo.materias.includes(i)));
  const otrosIntereses = interesesTodos.filter((i) => !catalogo.materias.includes(i)).join(', ');
  pintar(html`
    ${tabsCuenta('perfil')}
    <h1>Mi perfil de ${esProf ? 'mentor' : 'estudiante'} ${esProf ? insignia(yo) : ''}</h1>
    <form class="tarjeta campos" data-form="perfil">
      <div id="error"></div>
      <div class="fila">
        <label>Nombre<input name="nombre" required maxlength="80" value="${yo.nombre}"></label>
        <label>Ciudad<select name="ciudad">${opciones(catalogo.ciudades, yo.ciudad, 'Selecciona tu ciudad')}</select></label>
      </div>
      <div class="fila">
        <label>Celular (WhatsApp)<input name="telefono" inputmode="tel" placeholder="300 123 4567" value="${yo.telefono ? celular(yo.telefono) : ''}"></label>
        <label>Correo<input value="${yo.email}" disabled></label>
      </div>
      <label>${esProf ? 'Sobre mí' : 'Cuéntanos de ti'}<textarea name="bio" maxlength="600">${yo.bio}</textarea></label>
      ${esProf ? html`
        <fieldset class="materias"><legend>Materias que enseñas <span class="suave">(marca todas las que ofreces)</span></legend>
          ${catalogo.categorias.map((c) => html`<div class="grupo-materias"><b>${ICONOS[c.nombre] ?? ''} ${c.nombre}</b>
            <div class="opciones-fila">${c.materias.map((m) => html`<label class="opcion"><input type="checkbox" name="materias" value="${m}" ${chk(propias.has(m))}> ${m}</label>`)}</div></div>`)}
        </fieldset>
        <div class="fila">
          <label>Valor por hora (COP)<input name="tarifa" type="number" min="0" step="1000" value="${yo.tarifa}"></label>
          <label>Modalidad<select name="modalidad">${optMod(yo.modalidad)}</select></label>
        </div>
        <label>Experiencia y estudios<textarea name="experiencia" maxlength="600">${yo.experiencia}</textarea></label>
        <input type="hidden" name="documento" value="${yo.documento}">`
      : html`
        <div class="fila">
          <label>Nivel educativo<select name="nivel">${opciones(catalogo.niveles, yo.nivel, 'Selecciona')}</select></label>
          <label>Grado<select name="grado">${opciones(catalogo.grados, yo.grado, 'Selecciona')}</select></label>
        </div>
        <fieldset class="materias"><legend>Me interesa aprender <span class="suave">(marca todo lo que te interese)</span></legend>
          ${catalogo.categorias.map((c) => html`<div class="grupo-materias"><b>${ICONOS[c.nombre] ?? ''} ${c.nombre}</b>
            <div class="opciones-fila">${c.materias.map((m) => html`<label class="opcion"><input type="checkbox" name="intereses" value="${m}" ${chk(interesesPropios.has(m))}> ${m}</label>`)}</div></div>`)}
          <div class="grupo-materias">
            <label class="opcion"><input type="checkbox" name="intereses_otra_check" ${chk(!!otrosIntereses)}> <b>Otra</b> (escríbela)</label>
            <div data-grupo="otra-interes" ${otrosIntereses ? '' : new Raw('hidden')}>
              <input name="intereses_otra" maxlength="120" value="${otrosIntereses}" placeholder="Ej. Danza, Fotografía (separa con comas)" aria-label="Otras materias que te interesan">
            </div>
          </div>
        </fieldset>
        <fieldset class="opciones"><legend>Tu colegio</legend>
          ${Object.entries(catalogo.colegioTipos).map(([k, v]) => html`<label class="opcion"><input type="radio" name="colegio_tipo" value="${k}" ${chk(yo.colegio_tipo === k)} required> ${v}</label>`)}
        </fieldset>
        <div class="fila" data-grupo="colegio">
          <label>Nombre del colegio<input name="colegio_nombre" maxlength="100" value="${yo.colegio_nombre}"></label>
          <label data-grupo="localidad">Localidad de Bogotá<select name="localidad">${opciones(catalogo.localidades, yo.localidad, 'Selecciona')}</select></label>
        </div>
        <label class="opcion"><input type="checkbox" name="es_menor" ${chk(yo.es_menor)}> Soy menor de 18 años</label>
        <div class="fila" data-grupo="acudiente">
          <label>Nombre de tu acudiente<input name="acudiente_nombre" maxlength="80" value="${yo.acudiente_nombre}"></label>
          <label>Celular del acudiente<input name="acudiente_celular" inputmode="tel" placeholder="311 555 0000" value="${yo.acudiente_celular ? celular(yo.acudiente_celular) : ''}"></label>
        </div>
        <p class="suave">Los mentores solo ven tu grado y si tu colegio es público o privado, nunca el nombre del colegio. Si eres menor, comparten el contacto de tu acudiente, no el tuyo.</p>`}
      <p class="suave">Tu celular solo se comparte con la otra persona cuando una reserva es aceptada.</p>
      <button class="btn">Guardar perfil</button>
    </form>
    <section class="tarjeta campos" id="seguridad">
      <h2>Seguridad de la cuenta</h2>
      <form class="campos" data-form="clave">
        <div id="error"></div>
        <div class="fila">
          <label>Contraseña actual<input type="password" name="actual" required autocomplete="current-password"></label>
          <label>Nueva contraseña (mínimo 8 caracteres)<input type="password" name="nueva" required minlength="8" autocomplete="new-password"></label>
        </div>
        <button class="btn sec chico">Cambiar contraseña</button>
      </form>
    </section>
    ${yo.es_admin ? '' : html`
    <section class="tarjeta campos zona-peligro">
      <h2>Eliminar mi cuenta</h2>
      <p class="suave">Borramos tus datos personales, tus documentos y tus solicitudes; desactivamos tus clases y cancelamos tus reservas futuras. Los registros de pagos se conservan, sin datos personales, por obligaciones contables. Esta acción no se puede deshacer.</p>
      <form class="campos" data-form="eliminar-cuenta">
        <div id="error"></div>
        <label>Escribe tu contraseña para confirmar<input type="password" name="password" required autocomplete="current-password"></label>
        <button class="btn peligro chico">Eliminar mi cuenta definitivamente</button>
      </form>
    </section>`}`, { aviso: true });
  const f = $app.querySelector('form[data-form=perfil]');
  if (f && !esProf) sincronizarPerfil(f);
}
function sincronizarPerfil(f) {
  const tipo = f.querySelector('[name=colegio_tipo]:checked')?.value ?? '';
  const conColegio = tipo === 'publico' || tipo === 'privado';
  const bogota = f.ciudad.value === 'Bogotá D.C.';
  f.querySelector('[data-grupo=colegio]').hidden = !conColegio;
  f.querySelector('[data-grupo=localidad]').hidden = !bogota;
  f.colegio_nombre.required = conColegio;
  const otra = f.querySelector('[name=intereses_otra_check]');
  if (otra) { const g = f.querySelector('[data-grupo=otra-interes]'); g.hidden = !otra.checked; if (!otra.checked) f.intereses_otra.value = ''; }
  const menor = f.es_menor.checked;
  f.querySelector('[data-grupo=acudiente]').hidden = !menor;
  f.acudiente_nombre.required = menor;
  f.acudiente_celular.required = menor;
}

// ---------- suscripción ----------
async function vistaSuscripcion(params) {
  const { suscripcion: s, modo, pagos } = await api('GET', '/api/suscripcion');
  if (params.get('pago') === 'ok') {
    let v = null; try { v = sessionStorage.getItem('volverClase'); sessionStorage.removeItem('volverClase'); } catch {}
    if (v && /^(\d+|solicitudes)$/.test(v)) { await refrescarYo(); avisar(v === 'solicitudes' ? '¡Pago aprobado! Ya puedes publicar tu solicitud.' : '¡Pago aprobado! Ya puedes elegir tu horario.'); location.hash = v === 'solicitudes' ? '#/solicitudes' : `#/clase/${v}`; return; }
  }
  const resultado = { ok: ['ok', '¡Pago aprobado! Tu suscripción está activa.'], pendiente: ['espera', 'Tu pago está en proceso. Se activará en cuanto el banco lo confirme.'], fallo: ['mal', 'El pago no se completó. Puedes intentarlo de nuevo.'] }[params.get('pago')];
  pintar(html`
    ${tabsCuenta('suscripcion')}
    <h1>Suscripción</h1>
    ${resultado ? html`<p class="banner ${resultado[0]}" role="status">${resultado[1]}</p>` : ''}
    <article class="tarjeta plan">
      <span class="etiqueta ${s.activa ? 'ok' : 'mal'}">${s.activa ? 'Activa' : 'Inactiva'}</span>
      <h2>Plan ${s.plan}</h2>
      <p class="precio-plan">${cop(s.precio)} <span class="suave">/ mes</span></p>
      <ul class="beneficios">
        ${yo.rol === 'profesor'
          ? html`<li>Tus clases visibles para estudiantes de toda Colombia</li><li>Agenda con reservas por horario</li><li>Insignia de mentor verificado</li><li>Respuesta a solicitudes de estudiantes</li>`
          : html`<li>Mentores con identidad verificada (cédula, selfie y título revisados)</li><li>Pagos seguros a través de Artia y devolución si la clase no se da</li><li>Acceso a toda la oferta de clases</li><li>Agenda para reservar y ver tus clases en un solo lugar</li><li>Contacto directo con tu mentor por WhatsApp al confirmar la reserva</li><li>Publica lo que buscas y recibe ofertas</li><li>Reseñas reales de otros estudiantes</li>`}
      </ul>
      <p class="suave">Con tu suscripción mantenemos la plataforma segura: verificamos a cada mentor, cuidamos tus datos y te damos la agenda y las herramientas para reservar sin complicaciones.</p>
      ${s.activa ? html`<p>Vigente hasta el <b>${fechaSQL(s.vence)}</b>. Si renuevas ahora, se suman 30 días a tu fecha de vencimiento.</p>` : ''}
      <div id="error"></div>
      ${modo === 'ninguno' ? html`<p class="error">Los pagos aún no están disponibles. Intenta más tarde.</p>`
        : html`<button class="btn" data-accion="pagar">${s.activa ? 'Renovar' : 'Pagar'} ${cop(s.precio)}</button>`}
      <p class="suave">${modo === 'simulado' ? 'Modo de pruebas: no se cobra dinero real.' : 'Pago seguro con Wompi (PSE, Nequi y tarjetas). Cada pago cubre 30 días; recuerda renovarlo antes de que venza.'}</p>
    </article>
    <h2>Historial de pagos</h2>
    ${pagos.length ? html`<div class="tarjeta"><table class="tabla"><thead><tr><th>Fecha</th><th>Valor</th><th>Estado</th></tr></thead><tbody>
      ${pagos.map((p) => html`<tr><td>${fechaSQL(p.creado)}</td><td>${cop(p.monto_cop)}</td><td><span class="etiqueta ${p.estado === 'aprobado' ? 'ok' : p.estado === 'pendiente' ? 'espera' : 'mal'}">${p.estado}</span></td></tr>`)}
    </tbody></table></div>` : html`<p class="vacio">Aún no tienes pagos.</p>`}`, { aviso: false });
}

// ---------- verificación del mentor ----------
const KYC_TXT = { '': ['espera', 'Sin iniciar'], pendiente: ['espera', 'En proceso'], aprobado: ['ok', 'Identidad confirmada'], revision: ['espera', 'Requiere revisión manual'], rechazado: ['mal', 'No se pudo verificar'] };
let sondeoKyc = 0;
async function vistaVerificacion(params = new URLSearchParams()) {
  const v = await api('GET', '/api/verificacion');
  // El resultado de Didit llega por webhook unos segundos después de que el mentor vuelve: se actualiza solo.
  if (v.kyc.modo === 'didit' && v.kyc.estado === 'pendiente' && params.get('kyc') && sondeoKyc < 40) {
    sondeoKyc++;
    setTimeout(() => { if (location.hash.startsWith('#/verificacion')) enrutar(); }, 3000);
  } else if (v.kyc.estado !== 'pendiente') sondeoKyc = 0;
  const doc = (t) => v.documentos.find((d) => d.tipo === t);
  const editable = ['sin_enviar', 'rechazado'].includes(v.estado);
  const ESTADOS = { sin_enviar: ['mal', 'Sin enviar'], pendiente: ['espera', 'En revisión'], verificado: ['ok', 'Verificado'], rechazado: ['mal', 'Rechazado'] };
  const conKyc = v.kyc.modo !== 'ninguno';
  const paso = (tipo, titulo, ayuda) => html`
    <div class="paso">
      <b>${titulo}</b> ${doc(tipo) ? html`<span class="etiqueta ok">Cargado</span>` : html`<span class="etiqueta espera">Falta</span>`}
      <p class="suave">${ayuda}</p>
      ${doc(tipo) ? html`<p class="archivo-ok">✓ Guardado el ${fechaSQL(doc(tipo).creado)} (${{ 'image/png': 'imagen PNG', 'image/jpeg': 'imagen JPG', 'application/pdf': 'PDF' }[doc(tipo).mime] ?? 'archivo'}).${editable ? ' Si quieres cambiarlo, elige otro archivo.' : ''}</p>` : ''}
      ${editable ? html`<input type="file" data-doc="${tipo}" accept="image/png,image/jpeg,application/pdf" aria-label="${doc(tipo) ? 'Reemplazar' : 'Subir'} ${titulo}">` : ''}
    </div>`;
  const k = KYC_TXT[v.kyc.estado] ?? KYC_TXT[''];
  const faltan = [];
  const nombreOk = yo.nombre.trim().split(/\s+/).length >= 2;
  if (conKyc) {
    if (!nombreOk) faltan.push('escribir tu nombre y apellido completos en tu perfil');
    if (!['aprobado', 'revision'].includes(v.kyc.estado)) faltan.push('verificar tu identidad (paso 1)');
  } else if (!v.documento) faltan.push('guardar el número de tu cédula (botón «Guardar cédula»)');
  if (!doc('cedula')) faltan.push('subir la foto de tu documento de identidad');
  if (!doc('titulo')) faltan.push('subir tu título o certificado');
  pintar(html`
    ${tabsCuenta('verificacion')}
    <h1>Verificación de mentor</h1>
    <article class="tarjeta">
      <p>Estado: <span class="etiqueta ${ESTADOS[v.estado][0]}">${ESTADOS[v.estado][1]}</span></p>
      ${params.get('kyc') && v.kyc.estado === 'pendiente' ? html`<p class="banner espera" role="status">Estamos procesando tu verificación de identidad. Esto toma unos segundos; esta página se actualiza sola.</p>` : ''}
      ${v.estado === 'rechazado' && v.nota ? html`<p class="error">Motivo: ${v.nota}. Corrige y vuelve a enviar.</p>` : ''}
      ${v.estado === 'pendiente' ? html`<p>Recibimos tu información. Un administrador la revisará pronto.</p>` : ''}
      ${v.estado === 'verificado' ? html`<p>Tu identidad fue verificada. Tus clases muestran la insignia <span class="verif">✓ Verificado</span>.</p>` : ''}
    </article>
    ${!yo.verificacion_autorizada && editable ? html`
    <form class="tarjeta campos" data-form="autorizar">
      <h2>Autorización</h2>
      <div id="error"></div>
      <label class="opcion"><input type="checkbox" name="acepto" required> <span>${AUTORIZACION_VERIFICACION}</span></label>
      <button class="btn">Autorizar y continuar</button>
    </form>` : ''}
    ${editable || v.estado === 'pendiente' ? html`
    ${conKyc ? '' : html`
    <form class="tarjeta campos" data-form="documento">
      <h2>1. Tu cédula</h2>
      <div id="error"></div>
      <label>Número de cédula de ciudadanía<input name="documento" inputmode="numeric" placeholder="52.123.456" value="${v.documento}" ${editable ? '' : new Raw('disabled')}></label>
      ${conKyc ? html`<p class="suave">Tu nombre en <a href="#/perfil">tu perfil</a> debe ser el mismo de tu cédula: <b>${yo.nombre}</b>. Si no coincide, la verificación pasará a revisión manual.</p>` : ''}
      ${editable ? html`<button class="btn sec chico">Guardar cédula</button>` : ''}
    </form>
    `}
    ${conKyc ? html`
    <section class="tarjeta campos">
      <h2>1. Verifica tu identidad</h2>
      <p>Estado: <span class="etiqueta ${k[0]}">${k[1]}</span>${v.documento ? html` · Documento verificado: <b>${v.documento}</b>` : ''}</p>
      ${nombreOk ? html`<p class="suave">Tu nombre en <a href="#/perfil">tu perfil</a> es <b>${yo.nombre}</b>. Debe ser igual al de tu cédula; si no, el caso pasará a revisión manual.</p>`
        : html`<p class="banner espera">Antes de empezar, escribe tu <b>nombre y apellido completos</b>, tal como aparecen en tu cédula, en <a href="#/perfil">tu perfil</a>.</p>`}
      <p class="suave">No tienes que escribir tu número de documento: lo leemos del documento. Tomarás una foto de tu cédula o pasaporte y una selfie. Comprobamos que el documento sea real, que coincida con tu nombre, y que la selfie sea tuya.${v.kyc.auto ? ' Si todo coincide, tu cuenta se verifica automáticamente.' : ''}</p>
      ${v.kyc.estado === 'revision' && v.kyc.motivos.length ? html`<div class="banner espera"><b>Un administrador revisará tu caso:</b>${v.kyc.motivos.map((m) => html`<p>${m}</p>`)}</div>` : ''}
      ${editable ? html`<fieldset class="opciones"><legend>¿Con qué documento te vas a verificar?</legend>
        <label class="opcion"><input type="radio" name="origen" value="colombiano" ${chk(v.origen !== 'extranjero')}> Cédula de ciudadanía de Colombia</label>
        <label class="opcion"><input type="radio" name="origen" value="extranjero" ${chk(v.origen === 'extranjero')}> Documento de otro país: pasaporte, cédula de extranjería u otro documento de identidad vigente</label>
      </fieldset>` : ''}
      ${editable ? html`<button class="btn ${v.kyc.estado === 'aprobado' ? 'sec' : ''}" data-accion="kyc-iniciar" ${nombreOk ? '' : new Raw('disabled')}>${v.kyc.estado ? 'Repetir verificación' : 'Verificar mi identidad'}</button>` : ''}
      ${v.kyc.modo === 'simulado' && v.kyc.estado === 'pendiente' ? html`
        <div class="banner"><b>Modo de pruebas</b> (sin documentos reales). Simula el resultado del proveedor:
          <div class="acciones-fila">
            <button class="btn chico" data-accion="kyc-simular" data-desenlace="aprobado">Todo coincide</button>
            <button class="btn sec chico" data-accion="kyc-simular" data-desenlace="no_coincide">Documento de otra persona</button>
            <button class="btn peligro chico" data-accion="kyc-simular" data-desenlace="rechazado">Rechazado</button>
          </div></div>` : ''}
    </section>` : ''}
    <section class="tarjeta campos">
      <h2>2. Documentos <span class="etiqueta mal">Obligatorios</span></h2>
      <p class="suave">Para publicar tus clases necesitamos <b>los dos documentos</b>. Un administrador los puede revisar.</p>
      ${paso('cedula', 'Foto de tu documento de identidad *', 'Cédula (por ambos lados) o pasaporte. JPG, PNG o PDF, máximo 4 MB. Debe verse completa y legible.')}
      ${paso('titulo', 'Título, diploma o certificado *', 'Del estudio o experiencia que respalda lo que enseñas (JPG, PNG o PDF, máximo 4 MB).')}
      ${editable ? html`<button class="btn" data-accion="enviar-verificacion" ${v.completo ? '' : new Raw('disabled')}>${conKyc ? 'Terminar verificación' : 'Enviar a revisión'}</button>
        ${v.completo ? '' : html`<p class="banner espera" role="status">Para continuar falta: ${faltan.join(', ')}.</p>`}
        <p class="suave">Solo el equipo de Artia ve tus documentos. No se muestran en tu perfil público.</p>` : ''}
    </section>` : ''}`, { aviso: false });
}

// ---------- mentor: clases y horarios ----------
async function vistaMisClases(editarId) {
  const { clases } = await api('GET', '/api/clases/mias');
  const c = clases.find((x) => x.id === Number(editarId)) ?? { modalidad: yo.modalidad, ciudad: yo.ciudad, duracion_min: 60, precio_hora: yo.tarifa || '', activa: 1 };
  pintar(html`
    <h1>Mis clases</h1>
    ${clases.length ? clases.map((x) => html`
      <article class="tarjeta">
        <b>${x.titulo}</b> ${!x.activa ? html`<span class="etiqueta mal">Pausada</span>` : x.oculta_por ? html`<span class="etiqueta espera">Oculta: ${x.oculta_por}</span>` : html`<span class="etiqueta ok">Visible</span>`}
        <div class="suave">${x.materia} · ${cop(x.precio_hora)} / hora · ${x.duracion_min} min · ${MOD[x.modalidad]}</div>
        <div class="acciones-fila">
          <a class="btn sec chico" href="#/mis-clases/${x.id}">Editar</a>
          <button class="btn peligro chico" data-accion="borrar-clase" data-id="${x.id}">Eliminar</button>
        </div>
      </article>`) : html`<p class="vacio">Aún no has publicado clases. Crea la primera aquí abajo.</p>`}
    <form class="tarjeta campos" data-form="clase" data-id="${c.id ?? ''}">
      <h2>${c.id ? 'Editar clase' : 'Publicar una clase'}</h2>
      <div id="error"></div>
      <label>Título<input name="titulo" required maxlength="100" value="${c.titulo ?? ''}" placeholder="Ej. Refuerzo de matemáticas para bachillerato"></label>
      <div class="fila">
        <label>Materia<select name="materia" required>${opcionesMaterias(c.materia, 'Selecciona')}</select></label>
        <label>Nivel<select name="nivel">${opciones(catalogo.niveles, c.nivel, 'Todos los niveles')}</select></label>
      </div>
      <label>Descripción<textarea name="descripcion" maxlength="1000">${c.descripcion ?? ''}</textarea></label>
      <div class="fila">
        <label>Precio por hora (COP)<input name="precio_hora" type="number" min="5000" step="1000" required value="${c.precio_hora}"></label>
        <label>Duración por sesión (min)<input name="duracion_min" type="number" min="15" max="480" step="15" value="${c.duracion_min}"></label>
      </div>
      <div class="fila">
        <label>Modalidad<select name="modalidad">${optMod(c.modalidad)}</select></label>
        <label>Ciudad (para presencial)<select name="ciudad">${opciones(catalogo.ciudades, c.ciudad, 'Solo virtual')}</select></label>
      </div>
      ${c.id ? html`<label class="opcion"><input type="checkbox" name="activa" ${chk(c.activa)}> Clase visible para estudiantes</label>` : ''}
      <div class="acciones-fila"><button class="btn">${c.id ? 'Guardar cambios' : 'Publicar clase'}</button>${c.id ? html`<a class="btn sec" href="#/mis-clases">Cancelar</a>` : ''}</div>
    </form>`);
}

let bloques = [];
function leerBloques() {
  const f = $app.querySelector('form[data-form=horarios]');
  if (!f) return bloques;
  bloques = [...f.querySelectorAll('[data-bloque]')].map((r) => ({ dia: Number(r.dataset.dia), inicio: r.querySelector('[name=inicio]').value, fin: r.querySelector('[name=fin]').value }));
  return bloques;
}
function pintarHorarios() {
  pintar(html`
    <h1>Mis horarios</h1>
    <p class="suave">Define en qué horas puedes dar clase cada semana (hora de Colombia). Los estudiantes reservarán dentro de estos bloques, en espacios de la duración de cada clase.</p>
    <form class="tarjeta campos" data-form="horarios">
      <div id="error"></div>
      ${catalogo.dias.map((nombre, dia) => {
        const del = bloques.map((b, i) => ({ ...b, i })).filter((b) => b.dia === dia);
        return html`<fieldset class="dia"><legend>${nombre}</legend>
          ${del.length ? '' : html`<p class="suave">Sin disponibilidad</p>`}
          ${del.map((b) => html`<div class="bloque" data-bloque data-dia="${dia}">
            <label>Desde<input type="time" name="inicio" value="${b.inicio}" required></label>
            <label>Hasta<input type="time" name="fin" value="${b.fin}" required></label>
            <button type="button" class="btn peligro chico" data-accion="quitar-bloque" data-i="${b.i}" aria-label="Quitar bloque del ${nombre}">Quitar</button>
          </div>`)}
          <button type="button" class="btn sec chico" data-accion="agregar-bloque" data-dia="${dia}">+ Agregar bloque</button>
        </fieldset>`;
      })}
      <button class="btn">Guardar horarios</button>
    </form>`);
}
async function vistaHorarios() {
  bloques = (await api('GET', '/api/horarios')).horarios;
  pintarHorarios();
}

// ---------- solicitudes ----------
async function vistaSolicitudes() {
  const { solicitudes } = await api('GET', '/api/solicitudes');
  if (yo.rol === 'profesor') {
    const { clases } = await api('GET', '/api/clases/mias');
    return pintar(html`
      <h1>Estudiantes que buscan clase</h1>
      ${solicitudes.length ? solicitudes.map((s) => html`
        <article class="tarjeta">
          <span class="etiqueta">${s.materia}</span><span class="etiqueta">${MOD[s.modalidad]}${s.ciudad ? ' · ' + s.ciudad : ''}</span>
          <p>${s.descripcion || 'Sin detalles.'}</p>
          <p class="suave">${s.estudiante_nombre}${s.grado ? ' · ' + s.grado : ''}${s.colegio_tipo && s.colegio_tipo !== 'ninguno' ? ' · ' + COLEGIO[s.colegio_tipo] : ''} · Presupuesto: ${s.presupuesto ? cop(s.presupuesto) + ' / hora' : 'a convenir'} · ${fechaSQL(s.creado)}</p>
          ${s.ya_ofrecido ? html`<span class="etiqueta ok">Ya enviaste una oferta</span>` : html`
          <form class="campos" data-form="oferta" data-id="${s.id}">
            <label>Tu mensaje<textarea name="mensaje" required maxlength="500" placeholder="Hola, puedo ayudarte con esto. Mi experiencia es…"></textarea></label>
            ${clases.length ? html`<label>Clase que ofreces (opcional)<select name="clase_id"><option value="">—</option>${clases.map((c) => html`<option value="${c.id}">${c.titulo}</option>`)}</select></label>` : ''}
            <button class="btn chico">Enviar oferta</button>
          </form>`}
        </article>`) : html`<p class="vacio">No hay solicitudes abiertas por ahora.</p>`}`);
  }
  pintar(html`
    <h1>Lo que estoy buscando</h1>
    ${yo.suscripcion.activa ? '' : html`<div class="tarjeta"><p>Para publicar una solicitud activa tu suscripción mensual de <b>${cop(yo.suscripcion.precio)}</b>. Al terminar el pago volverás aquí.</p><button class="btn" data-accion="pagar" data-volver="solicitudes">Pagar suscripción</button></div>`}
    <form class="tarjeta campos" data-form="solicitud" ${yo.suscripcion.activa ? '' : new Raw('hidden')}>
      <h2>Publicar una solicitud</h2>
      <div id="error"></div>
      <div class="fila">
        <label>¿Qué quieres aprender?<select name="materia" required>${opcionesMaterias('', 'Selecciona')}</select></label>
        <label>Presupuesto por hora (COP, 0 = a convenir)<input name="presupuesto" type="number" min="0" step="1000" value="0"></label>
      </div>
      <label>Detalles<textarea name="descripcion" maxlength="800" placeholder="Tu nivel, tus metas, horarios disponibles…"></textarea></label>
      <div class="fila">
        <label>Modalidad<select name="modalidad">${optMod('ambas')}</select></label>
        <label>Ciudad<select name="ciudad">${opciones(catalogo.ciudades, yo.ciudad, 'Solo virtual')}</select></label>
      </div>
      <button class="btn">Publicar solicitud</button>
    </form>
    <h2>Mis solicitudes</h2>
    ${solicitudes.length ? solicitudes.map((s) => html`
      <article class="tarjeta">
        <span class="etiqueta">${s.materia}</span><span class="etiqueta">${MOD[s.modalidad]}</span>
        <p>${s.descripcion}</p>
        <h3>Ofertas de mentores (${s.ofertas.length})</h3>
        ${s.ofertas.map((o) => html`<p><a href="#/profesor/${o.profesor_id}"><b>${o.profesor_nombre}</b></a>: ${o.mensaje}
          ${o.clase_titulo ? html`<br><a href="#/clase/${o.clase_id}">Ver clase: ${o.clase_titulo}</a>` : ''}</p>`)}
        <button class="btn peligro chico" data-accion="borrar-solicitud" data-id="${s.id}">Eliminar solicitud</button>
      </article>`) : html`<p class="vacio">Aún no has publicado solicitudes.</p>`}`);
}

// ---------- agenda (reservas de ambos roles) ----------
const aUTC = (fecha, min) => new Date(Date.UTC(+fecha.slice(0, 4), +fecha.slice(5, 7) - 1, +fecha.slice(8, 10), 5, min)).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
function enlaceGoogle(r, otro) {
  const ini = +r.hora.slice(0, 2) * 60 + +r.hora.slice(3, 5);
  const p = new URLSearchParams({ action: 'TEMPLATE', text: `${r.titulo} — con ${otro}`, dates: `${aUTC(r.fecha, ini)}/${aUTC(r.fecha, ini + r.duracion_min)}`,
    details: `Clase de ${r.materia} en Artia. Detalles: ${location.origin}/#/agenda`, location: r.modalidad === 'virtual' ? 'Virtual' : (r.clase_ciudad ?? ''), ctz: 'America/Bogota' });
  return 'https://calendar.google.com/calendar/render?' + p;
}
function tarjetaReserva(r, esProf) {
  const otro = esProf ? r.estudiante_nombre : r.profesor_nombre;
  return html`
    <article class="tarjeta reserva">
      <div class="hora"><b>${hora12(r.hora)}</b><span class="suave">a ${hora12(finHora(r.hora, r.duracion_min))}</span></div>
      <div class="detalle">
        <span class="etiqueta ${r.pago_estado === 'por_pagar' ? 'espera' : ESTADO[r.estado]}">${r.pago_estado === 'por_pagar' ? 'Pendiente de pago' : ESTADO_TXT[r.estado]}</span>
        <h3><a href="#/clase/${r.clase_id}">${r.titulo}</a></h3>
        <p class="suave">${esProf ? 'Estudiante' : 'Mentor'}: ${esProf ? otro : html`<a href="#/profesor/${r.profesor_id}">${otro}</a>`}
          ${esProf && r.estudiante_grado ? ' · ' + r.estudiante_grado : ''}${esProf && r.estudiante_colegio_tipo && r.estudiante_colegio_tipo !== 'ninguno' ? ' · ' + COLEGIO[r.estudiante_colegio_tipo] : ''}
          · ${MOD[r.modalidad]} · ${cop(r.precio_hora)} / hora</p>
        ${r.monto_cop ? (esProf
          ? html`<p class="suave">Recibes <b>${cop(r.neto_cop)}</b> <span class="suave">(valor ${cop(r.monto_cop)} − comisión de Artia ${cop(r.comision_cop)})</span> · se te paga con la liquidación mensual</p>`
          : html`<p class="suave">${{ por_pagar: 'Total a pagar', pagado: 'Pagado', reembolso_pendiente: 'Devolución en proceso', reembolsado: 'Devuelto' }[r.pago_estado] ?? 'Valor'}: <b>${cop(r.monto_cop)}</b>${r.pago_estado === 'reembolso_pendiente' ? ' · te lo devolveremos a tu medio de pago' : ''}</p>`) : ''}
        ${r.mensaje ? html`<p>“${r.mensaje}”</p>` : ''}
        ${r.contacto ? html`<p>Contacto con ${r.contacto_de}: <a href="https://wa.me/57${r.contacto}" target="_blank" rel="noopener">WhatsApp ${celular(r.contacto)}</a></p>`
          : r.estado === 'aceptada' ? html`<p class="suave">La otra persona aún no tiene celular en su perfil.</p>` : ''}
        ${r.resena ? html`<p>${esProf ? 'Reseña del estudiante' : 'Tu reseña'}: ${estrellas(r.resena.calificacion)} ${r.resena.comentario}</p>` : ''}
        ${r.estado === 'aceptada' && !r.terminada ? html`<p class="acciones-fila">
          <a class="btn sec chico" href="${enlaceGoogle(r, otro)}" target="_blank" rel="noopener">📅 Google Calendar</a>
          <a class="btn sec chico" href="/api/reservas/${r.id}/ics" download>📅 Apple / Outlook (.ics)</a></p>` : ''}
        <div class="acciones-fila">
          ${esProf && r.estado === 'pendiente' && !r.terminada ? html`
            <button class="btn chico" data-accion="reserva" data-id="${r.id}" data-estado="aceptada">Aceptar</button>
            <button class="btn peligro chico" data-accion="reserva" data-id="${r.id}" data-estado="rechazada">Rechazar</button>` : ''}
          ${['pendiente', 'aceptada'].includes(r.estado) && !r.terminada && !(esProf && r.estado === 'pendiente') ? html`<button class="btn peligro chico" data-accion="reserva" data-id="${r.id}" data-estado="cancelada" ${!esProf && r.estado === 'aceptada' && r.pago_estado === 'pagado' && (Date.parse(`${r.fecha}T${r.hora}:00-05:00`) - Date.now()) < 24 * 3600000 ? new Raw('data-sin-devolucion="1"') : ''}>Cancelar</button>` : ''}
          ${!esProf && r.pago_estado === 'por_pagar' ? html`<button class="btn chico" data-accion="pagar-reserva" data-id="${r.id}">Pagar ahora ${cop(r.monto_cop)}</button>` : ''}
        </div>
        ${r.puede_resenar ? html`
          <form class="campos resena" data-form="resena" data-id="${r.id}">
            <b>¿Cómo fue tu clase?</b>
            <label>Calificación<select name="calificacion" required>
              <option value="">Selecciona</option>
              ${[5, 4, 3, 2, 1].map((n) => html`<option value="${n}">${'★'.repeat(n)}${'☆'.repeat(5 - n)} — ${['', 'Muy mala', 'Mala', 'Regular', 'Buena', 'Excelente'][n]}</option>`)}
            </select></label>
            <label>Comentario (opcional)<textarea name="comentario" maxlength="500" placeholder="Cuéntales a otros estudiantes cómo te fue"></textarea></label>
            <button class="btn chico">Publicar reseña</button>
          </form>` : ''}
      </div>
    </article>`;
}
/** Lleva al estudiante al pago de su clase (Wompi) o, en pruebas, lo aprueba al instante. */
async function pagarClase(pago) {
  if (pago.modo === 'wompi') { location.href = pago.url; return; }
  await api('POST', '/api/pagos/simular', { pago_id: pago.pago_id });
  avisar('Pago aprobado (modo de pruebas). El mentor ya puede aceptar tu reserva.'); location.hash = '#/agenda?pago=ok'; await enrutar();
}
async function vistaAgenda(params = new URLSearchParams()) {
  const { reservas } = await api('GET', '/api/reservas');
  const esProf = yo.rol === 'profesor';
  const proximas = reservas.filter((r) => !r.terminada && ['pendiente', 'aceptada'].includes(r.estado)).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  const porCalificar = reservas.filter((r) => r.puede_resenar);
  const historial = reservas.filter((r) => !proximas.includes(r) && !porCalificar.includes(r));
  const porDia = (lista) => [...new Set(lista.map((r) => r.fecha))].map((f) => html`
    <section><h3 class="dia-titulo">${cap(diaLargo(f))}</h3>${lista.filter((r) => r.fecha === f).map((r) => tarjetaReserva(r, esProf))}</section>`);
  const porRevisar = esProf ? proximas.filter((r) => r.estado === 'pendiente').length : 0;
  pintar(html`
    <h1>${esProf ? 'Mi agenda' : 'Mi agenda de clases'}</h1>
    ${{ ok: html`<p class="banner ok" role="status">¡Pago recibido! Ahora el mentor debe aceptar tu reserva; te avisaremos por correo.</p>`, pendiente: html`<p class="banner espera" role="status">Tu pago está en proceso. Se confirmará en cuanto el banco lo apruebe.</p>`, fallo: html`<p class="banner mal" role="status">El pago no se completó y tu horario se liberó. Puedes intentarlo de nuevo desde la clase.</p>` }[params.get('pago')] ?? ''}
    ${porRevisar ? html`<p class="banner espera">Tienes ${porRevisar} ${porRevisar === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'} por responder.</p>` : ''}
    ${porCalificar.length ? html`<h2>Por calificar</h2><p class="suave">Tu opinión ayuda a otros estudiantes y a tu mentor. Elige las estrellas; escribir un comentario es opcional.</p>${porCalificar.map((r) => tarjetaReserva(r, esProf))}` : ''}
    <h2>Próximas clases</h2>
    ${proximas.length ? porDia(proximas) : html`<p class="vacio">No tienes clases próximas. ${esProf ? 'Cuando un estudiante reserve, aparecerá aquí.' : html`<a href="#/clases">Busca una clase</a> y reserva tu horario.`}</p>`}
    ${historial.length ? html`<h2 style="margin-top:2rem">Historial</h2>${porDia(historial)}` : ''}
    <details class="tarjeta" style="margin-top:2rem"><summary><b>📅 Sincroniza tu calendario</b></summary>
      <p class="suave">Agrega este enlace una sola vez a Google Calendar, Apple Calendar u Outlook y tus clases aparecerán (y se actualizarán) solas. Es personal: no lo compartas.</p>
      <div id="cal-caja"><button class="btn chico" data-accion="cal-enlace">Obtener mi enlace</button></div>
    </details>`);
}

// ---------- ganancias del mentor ----------
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const nombreMes = (m) => `${MESES[+m.slice(5, 7) - 1]} de ${m.slice(0, 4)}`;
async function vistaGanancias() {
  const g = await api('GET', '/api/ganancias');
  const c = g.cuenta;
  pintar(html`
    ${tabsCuenta('ganancias')}
    <h1>Ganancias</h1>
    <p class="suave">Publicar tus clases en Artia no cuesta nada. El estudiante paga la clase a Artia al reservar, y cada mes te pagamos lo acumulado, descontando una comisión de <b>${g.comision_pct}%</b>.</p>
    <article class="tarjeta">
      <h2>Por pagarte</h2>
      ${g.por_liquidar.length ? g.por_liquidar.map((m) => html`<p><b>${cap(nombreMes(m.mes))}</b>: ${m.n} ${m.n === 1 ? 'clase' : 'clases'} · valor ${cop(m.bruto)} − comisión ${cop(m.comision)} = <b>${cop(m.neto)}</b></p>`)
        : html`<p class="suave">Aún no tienes clases dadas pendientes de pago.</p>`}
      ${g.clases_por_realizar ? html`<p class="suave">${g.clases_por_realizar} ${g.clases_por_realizar === 1 ? 'clase pagada y confirmada está' : 'clases pagadas y confirmadas están'} por realizarse; sumarán a tus ganancias cuando se den.</p>` : ''}
    </article>
    <form class="tarjeta campos" data-form="cuenta">
      <h2>Datos para recibir tus pagos</h2>
      <div id="error"></div>
      ${c.numero ? '' : html`<p class="banner espera">Agrega tu cuenta para que podamos pagarte cada mes.</p>`}
      <div class="fila">
        <label>Tipo<select name="tipo" required>${[['ahorros', 'Cuenta de ahorros'], ['corriente', 'Cuenta corriente'], ['nequi', 'Nequi'], ['daviplata', 'Daviplata']].map(([v, t]) => html`<option value="${v}" ${sel(c.tipo === v)}>${t}</option>`)}</select></label>
        <label>Banco (si es cuenta bancaria)<input name="banco" maxlength="60" value="${c.tipo === 'nequi' || c.tipo === 'daviplata' ? '' : c.banco}" placeholder="Bancolombia"></label>
      </div>
      <div class="fila">
        <label>Número de cuenta o celular<input name="numero" inputmode="numeric" required value="${c.numero}"></label>
        <label>Nombre del titular<input name="titular" required maxlength="80" value="${c.titular}" placeholder="Debe coincidir con tu cédula"></label>
      </div>
      <button class="btn">Guardar</button>
      <p class="suave">Solo tú y el equipo de Artia pueden ver estos datos.</p>
    </form>
    ${g.liquidaciones.length ? html`<h2>Pagos recibidos</h2>${g.liquidaciones.map((l) => html`<article class="tarjeta"><b>${cap(nombreMes(l.mes))}</b> · ${l.clases} ${l.clases === 1 ? 'clase' : 'clases'} · <b>${cop(l.neto_cop)}</b> <span class="suave">(valor ${cop(l.bruto_cop)} − comisión ${cop(l.comision_cop)})</span><br><span class="suave">Transferencia ${l.referencia} · ${fechaSQL(l.pagado_en)}</span></article>`)}` : ''}`);
}

// ---------- administración ----------
const tabsAdmin = (actual) => html`<div class="tabs"><a href="#/admin/pendiente">Verificaciones</a><a href="#/admin/usuarios" class="${actual === 'usuarios' ? 'activa' : ''}">Usuarios</a><a href="#/admin/resenas" class="${actual === 'resenas' ? 'activa' : ''}">Reseñas</a><a href="#/admin/pagos" class="${actual === 'pagos' ? 'activa' : ''}">Pagos a mentores</a><a href="#/admin/devoluciones" class="${actual === 'devoluciones' ? 'activa' : ''}">Devoluciones</a></div>`;

async function vistaAdminPagos(params) {
  const d = await api('GET', '/api/admin/pagos-mentores' + (params.get('mes') ? '?mes=' + encodeURIComponent(params.get('mes')) : ''));
  const total = d.mentores.reduce((a, m) => a + (m.liquidacion ? 0 : m.neto), 0);
  pintar(html`
    <h1>Administración</h1>${tabsAdmin('pagos')}
    <form class="filtros" data-form="admin-mes"><label>Mes<input type="month" name="mes" value="${d.mes}"></label><button class="btn">Ver</button></form>
    <p class="suave">${cap(nombreMes(d.mes))} · comisión ${d.comision_pct}% · ${d.cerrado ? 'mes terminado: puedes pagar' : 'mes en curso: se paga cuando termine'}${total ? html` · <b>Por pagar: ${cop(total)}</b>` : ''}</p>
    ${d.mentores.length ? d.mentores.map((m) => html`
      <article class="tarjeta">
        <h3>${m.nombre} <span class="suave">· ${m.email}</span></h3>
        <p>${m.n} ${m.n === 1 ? 'clase' : 'clases'} · valor ${cop(m.bruto)} − comisión ${cop(m.comision)} = <b>${cop(m.neto)}</b></p>
        ${m.cuenta ? html`<p class="suave">${m.cuenta.tipo === 'nequi' || m.cuenta.tipo === 'daviplata' ? m.cuenta.banco : m.cuenta.banco + ' · ' + m.cuenta.tipo}: <b>${m.cuenta.numero}</b> · Titular: ${m.cuenta.titular} · Cédula: ${m.documento || '—'}</p>` : html`<p class="error">Este mentor aún no registró sus datos de pago.</p>`}
        ${m.liquidacion ? html`<span class="etiqueta ok">Pagado · ${m.liquidacion.referencia}</span>`
          : d.cerrado && m.cuenta ? html`<button class="btn chico" data-accion="liquidar" data-id="${m.profesor_id}" data-mes="${d.mes}" data-nombre="${m.nombre}" data-neto="${cop(m.neto)}">Registrar pago realizado</button>` : ''}
      </article>`) : html`<p class="vacio">No hay pagos pendientes a mentores en este mes.</p>`}`, { aviso: false });
}

async function vistaAdminDevoluciones() {
  const { devoluciones } = await api('GET', '/api/admin/devoluciones');
  pintar(html`
    <h1>Administración</h1>${tabsAdmin('devoluciones')}
    <p class="suave">Devuelve cada pago desde el panel de Wompi (Transacciones → la transacción → Devolver) y luego márcalo aquí; el estudiante recibe un aviso por correo.</p>
    ${devoluciones.length ? devoluciones.map((d) => html`
      <article class="tarjeta">
        <h3>${d.estudiante} <span class="suave">· ${d.estudiante_email}</span></h3>
        <p>${d.titulo} · ${d.fecha} ${d.hora} · <b>${cop(d.monto_cop)}</b></p>
        <p class="suave">Referencia: ${d.pago_ref}${d.transaccion ? ' · Transacción de Wompi: ' + d.transaccion : ''}</p>
        <button class="btn chico" data-accion="devolucion-hecha" data-id="${d.id}">Ya la devolví</button>
      </article>`) : html`<p class="vacio">No hay devoluciones pendientes.</p>`}`, { aviso: false });
}

async function vistaAdminUsuarios(params) {
  const q = params.get('q') ?? '';
  const { usuarios } = await api('GET', '/api/admin/usuarios' + (q ? '?q=' + encodeURIComponent(q) : ''));
  pintar(html`
    <h1>Administración</h1>${tabsAdmin('usuarios')}
    <form class="filtros" data-form="admin-buscar" role="search"><input name="q" value="${q}" placeholder="Buscar por nombre o correo" aria-label="Buscar usuario"><button class="btn">Buscar</button></form>
    ${usuarios.length ? usuarios.map((u) => html`
      <article class="tarjeta">
        <h3>${u.nombre} ${u.es_admin ? html`<span class="etiqueta">Administrador</span>` : ''} ${u.suspendido ? html`<span class="etiqueta mal">Suspendido</span>` : ''}</h3>
        <p class="suave">${u.email} · ${u.rol === 'profesor' ? 'Mentor' : 'Estudiante'}${u.rol === 'profesor' ? ' · verificación: ' + u.verificacion_estado : ''} · desde ${fechaSQL(u.creado)}</p>
        ${u.es_admin || u.email.endsWith('@artia.invalid') ? '' : html`<div class="acciones-fila">
          <button class="btn sec chico" data-accion="clave-temporal" data-id="${u.id}" data-nombre="${u.nombre}">Clave temporal</button>
          <button class="btn ${u.suspendido ? '' : 'peligro'} chico" data-accion="suspender" data-id="${u.id}" data-estado="${u.suspendido ? 'no' : 'si'}" data-nombre="${u.nombre}">${u.suspendido ? 'Reactivar' : 'Suspender'}</button>
        </div>`}
      </article>`) : html`<p class="vacio">No hay usuarios con esa búsqueda.</p>`}`, { aviso: false });
}

async function vistaAdminResenas() {
  const { resenas } = await api('GET', '/api/admin/resenas');
  pintar(html`
    <h1>Administración</h1>${tabsAdmin('resenas')}
    ${resenas.length ? resenas.map((r) => html`
      <article class="tarjeta">
        <p>${estrellas(r.calificacion)} <b>${r.autor}</b> sobre <b>${r.mentor}</b> <span class="suave">· ${fechaSQL(r.creado)}</span></p>
        ${r.comentario ? html`<p>${r.comentario}</p>` : ''}
        <button class="btn peligro chico" data-accion="borrar-resena" data-id="${r.id}">Eliminar reseña</button>
      </article>`) : html`<p class="vacio">Aún no hay reseñas.</p>`}`, { aviso: false });
}

async function vistaAdmin(estado = 'pendiente', params = new URLSearchParams()) {
  if (estado === 'usuarios') return vistaAdminUsuarios(params);
  if (estado === 'resenas') return vistaAdminResenas();
  if (estado === 'pagos') return vistaAdminPagos(params);
  if (estado === 'devoluciones') return vistaAdminDevoluciones();
  const { mentores } = await api('GET', `/api/admin/verificaciones?estado=${estado}`);
  const T = { pendiente: 'Pendientes', verificado: 'Verificados', rechazado: 'Rechazados' };
  const NOMBRE_DOC = { cedula: 'Cédula', titulo: 'Título / certificado' };
  pintar(html`
    <h1>Verificación de mentores</h1>
    <div class="tabs">${Object.entries(T).map(([k, v]) => html`<a href="#/admin/${k}" class="${k === estado ? 'activa' : ''}">${v}</a>`)}<a href="#/admin/usuarios">Usuarios</a><a href="#/admin/resenas">Reseñas</a><a href="#/admin/pagos">Pagos a mentores</a><a href="#/admin/devoluciones">Devoluciones</a></div>
    ${mentores.length ? mentores.map((m) => html`
      <article class="tarjeta">
        <h3>${m.nombre}</h3>
        <p class="suave">${m.email} · ${m.ciudad || 'sin ciudad'} · Documento: <b>${m.documento || '—'}</b>${m.documento_origen === 'extranjero' ? ' (extranjero)' : ''} · Celular: ${m.telefono ? celular(m.telefono) : '—'}</p>
        <p><b>Materias:</b> ${m.materias || '—'}<br><b>Experiencia:</b> ${m.experiencia || '—'}</p>
        <p><b>Identidad (KYC):</b> <span class="etiqueta ${(KYC_TXT[m.kyc_estado] ?? KYC_TXT[''])[0]}">${(KYC_TXT[m.kyc_estado] ?? ['', 'Sin KYC (revisión manual de documentos)'])[1]}</span></p>
        ${m.kyc_motivos.length ? html`<div class="banner espera">${m.kyc_motivos.map((x) => html`<p>${x}</p>`)}</div>` : ''}
        <p>${m.documentos.map((d) => html`<a class="btn sec chico" href="/api/admin/documentos/${d.id}" target="_blank" rel="noopener">Ver ${NOMBRE_DOC[d.tipo]}</a> `)}</p>
        ${estado === 'pendiente' ? html`<div class="acciones-fila">
          <button class="btn chico" data-accion="aprobar" data-id="${m.id}">Aprobar</button>
          <button class="btn peligro chico" data-accion="rechazar" data-id="${m.id}">Rechazar</button></div>` : ''}
      </article>`) : html`<p class="vacio">No hay mentores en este estado.</p>`}`, { aviso: false });
}

// ---------- primeros pasos ----------
async function vistaEmpezar() {
  const pasos = yo.pasos;
  const hechos = pasos.filter((p) => p.ok).length;
  const siguiente = pasos.find((p) => !p.ok);
  pintar(html`
    <div class="empezar">
      <h1>${hechos === pasos.length ? '¡Todo listo!' : `Bienvenid@, ${yo.nombre.split(' ')[0]}`}</h1>
      <p class="suave">${yo.rol === 'profesor' ? 'Sigue estos pasos para publicar tus clases y recibir estudiantes.' : 'Sigue estos pasos para reservar tu primera clase en minutos.'}</p>
      <div class="progreso" role="progressbar" aria-valuemin="0" aria-valuemax="${pasos.length}" aria-valuenow="${hechos}"><span style="width:${Math.round((hechos / pasos.length) * 100)}%"></span></div>
      <p class="suave">${hechos} de ${pasos.length} pasos completados</p>
      <ol class="pasos">
        ${pasos.map((p, i) => html`<li class="${p.ok ? 'hecho' : p === siguiente ? 'actual' : ''}">
          <span class="num" aria-hidden="true">${p.ok ? '✓' : i + 1}</span>
          <div><b>${p.texto}</b>${p.nota ? html` <span class="etiqueta espera">${p.nota}</span>` : ''}</div>
          ${p.ok ? html`<span class="etiqueta ok">Listo</span>` : html`<a class="btn ${p === siguiente ? '' : 'sec'} chico" href="${p.enlace}">${p === siguiente ? 'Empezar' : 'Ir'}</a>`}
        </li>`)}
      </ol>
      ${hechos === pasos.length ? html`<p><a class="btn morado" href="${yo.rol === 'profesor' ? '#/agenda' : '#/clases'}">${yo.rol === 'profesor' ? 'Ver mi agenda' : 'Buscar clases'}</a></p>` : ''}
    </div>`, { aviso: false });
}

// ---------- ayuda con la contraseña ----------
function vistaAyudaClave() {
  pintar(html`<div class="acceso"><article class="tarjeta">
    <h1>¿Olvidaste tu contraseña?</h1>
    <p>Por ahora la recuperamos con ayuda de nuestro equipo.</p>
    <ol>
      <li>Escríbenos ${catalogo.soporte ? html`a <b>${catalogo.soporte}</b>` : 'a nuestro canal de soporte'} <b>desde el correo con el que te registraste</b>.</li>
      <li>Confirmaremos que eres tú y te daremos una <b>clave temporal</b>.</li>
      <li>Entra con ella: Artia te pedirá cambiarla por una nueva.</li>
    </ol>
    <p><a class="btn sec" href="#/ingresar">Volver a ingresar</a></p>
  </article></div>`, { aviso: false });
}

// ---------- páginas legales ----------
function vistaLegal(doc, otro) {
  pintar(html`
    <article class="legal">
      ${!catalogo.legalRevisado ? html`<p class="banner espera" role="note"><b>Borrador.</b> Este texto debe ser revisado por un abogado y completado antes de publicar la plataforma.</p>` : ''}
      <h1>${doc.titulo}</h1>
      <p class="suave">Versión ${catalogo.terminosVersion} · <a href="#/${otro[0]}">${otro[1]}</a></p>
      ${doc.secciones.map(([t, ps]) => html`<section><h2>${t}</h2>${ps.map((x) => html`<p>${x}</p>`)}</section>`)}
    </article>`, { aviso: false });
}

// ---------- enrutador ----------
async function enrutar() {
  const [rutaTxt, qs] = (location.hash.slice(1) || '/').split('?');
  const params = new URLSearchParams(qs ?? '');
  const [, base, arg] = rutaTxt.split('/');
  const protegidas = ['empezar', 'perfil', 'suscripcion', 'ganancias', 'verificacion', 'mis-clases', 'horarios', 'agenda', 'solicitudes', 'reservas', 'admin'];
  try {
    if (protegidas.includes(base) && !yo) { location.hash = '#/ingresar'; return; }
    if (['mis-clases', 'horarios', 'verificacion', 'ganancias'].includes(base) && yo.rol !== 'profesor') { location.hash = '#/'; return; }
    if (base === 'suscripcion' && yo.rol === 'profesor') { location.hash = '#/ganancias'; return; }
    if (base === 'admin' && !yo.es_admin) { location.hash = '#/'; return; }
    pintarNav();
    switch (base) {
      case '': case undefined: await vistaInicio(); break;
      case 'clases': await vistaClases(params); break;
      case 'clase': await vistaClase(arg); break;
      case 'profesor': await vistaProfesor(arg); break;
      case 'ingresar': vistaAcceso('ingresar', params); break;
      case 'registro': vistaAcceso('registro', params); break;
      case 'empezar': await vistaEmpezar(); break;
      case 'ayuda-clave': vistaAyudaClave(); break;
      case 'terminos': vistaLegal(terminos(datosEmpresa(catalogo.empresa)), ['privacidad', 'Política de Tratamiento de Datos']); break;
      case 'privacidad': vistaLegal(privacidad(datosEmpresa(catalogo.empresa)), ['terminos', 'Términos y Condiciones']); break;
      case 'perfil': vistaPerfil(); break;
      case 'suscripcion': await vistaSuscripcion(params); break;
      case 'ganancias': await vistaGanancias(); break;
      case 'verificacion': await vistaVerificacion(params); break;
      case 'mis-clases': await vistaMisClases(arg); break;
      case 'horarios': await vistaHorarios(); break;
      case 'solicitudes': await vistaSolicitudes(); break;
      case 'agenda': case 'reservas': await vistaAgenda(params); break;
      case 'admin': await vistaAdmin(arg, params); break;
      default: pintar(html`<p class="vacio">Página no encontrada. <a href="#/">Ir al inicio</a></p>`, { aviso: false });
    }
  } catch (e) { pintar(html`<p class="error" role="alert">${e.message}</p>`, { aviso: false }); }
  window.scrollTo(0, 0);
  $app.focus({ preventScroll: true });
}
async function refrescarYo() { ({ usuario: yo } = await api('GET', '/api/yo')); }

// ---------- eventos ----------
document.addEventListener('submit', async (ev) => {
  const f = ev.target.closest('form[data-form]');
  if (!f) return;
  ev.preventDefault();
  const d = datosForm(f);
  const boton = f.querySelector('button:not([type=button])');
  const mostrarError = (e) => { const c = f.querySelector('#error'); if (c) { c.innerHTML = fallo(e).s; c.scrollIntoView({ block: 'nearest' }); } else avisar(e.message); };
  if (boton) boton.disabled = true;
  try {
    switch (f.dataset.form) {
      case 'buscar': {
        const p = new URLSearchParams(Object.entries(d).filter(([, v]) => v));
        const destino = '#/clases' + (p.size ? '?' + p : '');
        if (location.hash === destino) await enrutar(); else location.hash = destino;
        break;
      }
      case 'admin-mes': location.hash = '#/admin/pagos?mes=' + encodeURIComponent(d.mes); break;
      case 'admin-buscar': { const p = new URLSearchParams(Object.entries(d).filter(([, v]) => v)); location.hash = '#/admin/usuarios' + (p.size ? '?' + p : ''); break; }
      case 'registro': case 'ingresar': {
        const reg = f.dataset.form === 'registro';
        ({ usuario: yo } = await api('POST', reg ? '/api/registro' : '/api/login', { ...d, es_menor: 'es_menor' in d, acepta_terminos: 'acepta_terminos' in d, autoriza_verificacion: 'autoriza_verificacion' in d }));
        avisar(reg ? '¡Cuenta creada! Sigue los primeros pasos.' : `¡Hola de nuevo, ${yo.nombre.split(' ')[0]}!`);
        location.hash = reg && yo.rol === 'estudiante' ? '#/perfil' : reg || yo.pasos.some((p) => !p.ok) ? '#/empezar' : yo.rol === 'profesor' ? '#/agenda' : '#/clases';
        break;
      }
      case 'perfil':
        ({ usuario: yo } = await api('PUT', '/api/perfil', { ...d, es_menor: 'es_menor' in d, ...(yo.rol === 'estudiante' ? { intereses: [d.intereses, 'intereses_otra_check' in d ? d.intereses_otra : ''].filter(Boolean).join(', ') } : {}) }));
        avisar('Perfil guardado'); pintarNav();
        if (yo.rol === 'estudiante' && !perfilEstudianteIncompleto(yo)) { if (location.hash === '#/clases') await enrutar(); else location.hash = '#/clases'; } else await enrutar();
        break;
      case 'documento':
        await api('PUT', '/api/perfil', { nombre: yo.nombre, ciudad: yo.ciudad, telefono: yo.telefono, bio: yo.bio, materias: yo.materias, tarifa: yo.tarifa, modalidad: yo.modalidad, experiencia: yo.experiencia, documento: d.documento });
        await refrescarYo(); avisar('Cédula guardada'); await enrutar(); break;
      case 'clase': {
        const id = f.dataset.id;
        await api(id ? 'PUT' : 'POST', id ? `/api/clases/${id}` : '/api/clases', { ...d, activa: id ? 'activa' in d : true });
        avisar(id ? 'Clase actualizada' : '¡Clase publicada!');
        if (id) location.hash = '#/mis-clases'; else await enrutar();
        break;
      }
      case 'horarios':
        await api('PUT', '/api/horarios', { horarios: leerBloques() });
        avisar('Horarios guardados'); break;
      case 'reservar': {
        const [fecha, hora] = d.slot.split('|');
        const r = await api('POST', '/api/reservas', { clase_id: Number(f.dataset.id), fecha, hora, mensaje: d.mensaje });
        await pagarClase(r.pago); break;
      }
      case 'cuenta':
        await api('PUT', '/api/cuenta-cobro', d); await refrescarYo(); pintarNav(); avisar('Datos guardados'); await enrutar(); break;
      case 'resena':
        await api('POST', '/api/resenas', { reserva_id: Number(f.dataset.id), calificacion: Number(d.calificacion), comentario: d.comentario });
        avisar('¡Gracias por tu reseña!'); await enrutar(); break;
      case 'solicitud':
        await api('POST', '/api/solicitudes', d); avisar('Solicitud publicada'); await enrutar(); break;
      case 'clave':
        await api('POST', '/api/clave', d); await refrescarYo(); f.reset(); avisar('Contraseña cambiada'); await enrutar(); break;
      case 'eliminar-cuenta':
        if (!confirm('¿Seguro que quieres eliminar tu cuenta? No se puede deshacer.')) break;
        await api('POST', '/api/cuenta/eliminar', d); yo = null; location.hash = '#/'; pintarNav(); avisar('Tu cuenta fue eliminada'); break;
      case 'autorizar':
        await api('POST', '/api/verificacion/autorizar', { acepto: 'acepto' in d }); await refrescarYo(); avisar('Autorización registrada'); await enrutar(); break;
      case 'oferta':
        await api('POST', `/api/solicitudes/${f.dataset.id}/ofertas`, { ...d, clase_id: d.clase_id ? Number(d.clase_id) : null });
        avisar('Oferta enviada'); await enrutar(); break;
    }
  } catch (e) {
    mostrarError(e);
    if (e.message.includes('suscripción') && f.dataset.form !== 'registro') avisar(e.message);
  } finally { if (boton) boton.disabled = false; }
});

document.addEventListener('input', (ev) => { const f = ev.target.closest('form[data-form=perfil]'); if (f && yo?.rol === 'estudiante') sincronizarPerfil(f); });

document.addEventListener('change', async (ev) => {
  const input = ev.target.closest('input[data-doc]');
  if (!input || !input.files[0]) return;
  const archivo = input.files[0];
  if (archivo.size > 4 * 1024 * 1024) { avisar('El archivo supera los 4 MB.'); input.value = ''; return; }
  try {
    const r = await fetch(`/api/verificacion/documentos?tipo=${input.dataset.doc}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: archivo });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'No se pudo subir el archivo.');
    avisar('Documento cargado'); await enrutar();
  } catch (e) { avisar(e.message); input.value = ''; }
});

document.addEventListener('click', async (ev) => {
  const b = ev.target.closest('[data-accion]');
  if (!b) return;
  const { accion, id, estado, dia, i } = b.dataset;
  if (accion === 'menu') { const abierto = $nav.classList.toggle('abierto'); b.setAttribute('aria-expanded', abierto); return; }
  try {
    if (accion === 'salir') { await api('POST', '/api/logout'); yo = null; location.hash = '#/'; pintarNav(); avisar('Sesión cerrada'); return; }
    if (accion === 'borrar-clase' && confirm('¿Eliminar esta clase?')) { await api('DELETE', `/api/clases/${id}`); await enrutar(); }
    if (accion === 'borrar-solicitud' && confirm('¿Eliminar esta solicitud?')) { await api('DELETE', `/api/solicitudes/${id}`); await enrutar(); }
    if (accion === 'reserva') {
      if (estado === 'cancelada' && !confirm(b.dataset.sinDevolucion ? 'Faltan menos de 24 horas para la clase: si la cancelas no habrá devolución del pago. ¿Cancelar de todos modos?' : '¿Cancelar esta clase?')) return;
      await api('PUT', `/api/reservas/${id}`, { estado }); await enrutar();
    }
    if (accion === 'pagar-reserva') { b.disabled = true; const r = await api('POST', `/api/reservas/${id}/pagar`); await pagarClase(r); return; }
    if (accion === 'devolucion-hecha' && confirm('¿Ya devolviste este pago desde el panel de Wompi?')) { await api('POST', `/api/admin/devoluciones/${id}`); avisar('Devolución marcada'); await enrutar(); return; }
    if (accion === 'liquidar') {
      const referencia = prompt(`Escribe la referencia de la transferencia a ${b.dataset.nombre} (por ${b.dataset.neto}):`);
      if (!referencia) return;
      await api('POST', '/api/admin/liquidaciones', { profesor_id: Number(id), mes: b.dataset.mes, referencia }); avisar('Pago registrado'); await enrutar(); return;
    }
    if (accion === 'agregar-bloque') { leerBloques(); bloques.push({ dia: Number(dia), inicio: '14:00', fin: '18:00' }); pintarHorarios(); }
    if (accion === 'quitar-bloque') { leerBloques(); bloques.splice(Number(i), 1); pintarHorarios(); }
    if (accion === 'kyc-iniciar') {
      b.disabled = true;
      const origen = document.querySelector('input[name=origen]:checked')?.value;
      const r = await api('POST', '/api/kyc/iniciar', origen ? { origen } : undefined);
      if (r.url) { location.href = r.url; return; }
      await enrutar(); return;
    }
    if (accion === 'kyc-simular') {
      const r = await api('POST', '/api/kyc/simular', { desenlace: b.dataset.desenlace });
      await refrescarYo(); avisar(r.estado === 'verificado' ? '¡Verificado automáticamente!' : 'Resultado procesado'); await enrutar(); return;
    }
    if (accion === 'cal-enlace' || accion === 'cal-regenerar') {
      if (accion === 'cal-regenerar' && !confirm('El enlace anterior dejará de funcionar. ¿Generar uno nuevo?')) return;
      const c = await api(accion === 'cal-enlace' ? 'GET' : 'POST', accion === 'cal-enlace' ? '/api/calendario/enlace' : '/api/calendario/regenerar');
      document.getElementById('cal-caja').innerHTML = `<label>Tu enlace de calendario<input readonly value="${esc(c.url)}" onclick="this.select()"></label>
        <p class="acciones-fila"><a class="btn chico" href="${esc(c.webcal)}">Abrir en mi app de calendario</a>
        <a class="btn sec chico" target="_blank" rel="noopener" href="https://calendar.google.com/calendar/r?cid=${encodeURIComponent(c.webcal)}">Agregar a Google Calendar</a>
        <button class="btn sec chico" data-accion="cal-regenerar">Generar enlace nuevo</button></p>`;
      return;
    }
    if (accion === 'aceptar-terminos') { ({ usuario: yo } = await api('POST', '/api/terminos/aceptar', { acepta_terminos: true })); avisar('Gracias por aceptar'); await enrutar(); return; }
    if (accion === 'enviar-verificacion') { await api('POST', '/api/verificacion/enviar'); await refrescarYo(); avisar(yo.verificacion_estado === 'verificado' ? '¡Verificado! Tus clases ya muestran la insignia.' : 'Enviado a revisión'); await enrutar(); }
    if (accion === 'pagar') {
      b.disabled = true;
      try { if (b.dataset.volver) sessionStorage.setItem('volverClase', b.dataset.volver); else sessionStorage.removeItem('volverClase'); } catch {}
      const p = await api('POST', '/api/pagos/iniciar');
      if (p.modo === 'wompi') { location.href = p.url; return; }
      await api('POST', '/api/pagos/simular', { pago_id: p.pago_id });
      await refrescarYo(); avisar('Suscripción activada (modo de pruebas)');
      let v = null; try { v = sessionStorage.getItem('volverClase'); sessionStorage.removeItem('volverClase'); } catch {}
      if (v && /^(\d+|solicitudes)$/.test(v)) location.hash = v === 'solicitudes' ? '#/solicitudes' : `#/clase/${v}`; else await enrutar();
    }
    if (accion === 'suspender') {
      const suspender = estado === 'si';
      if (!confirm(suspender ? `¿Suspender a ${b.dataset.nombre}? Se cerrará su sesión y sus clases dejarán de verse.` : `¿Reactivar a ${b.dataset.nombre}?`)) return;
      await api('PUT', `/api/admin/usuarios/${id}/suspender`, { suspendido: suspender }); avisar(suspender ? 'Usuario suspendido' : 'Usuario reactivado'); await enrutar(); return;
    }
    if (accion === 'clave-temporal') {
      if (!confirm(`¿Generar una clave temporal para ${b.dataset.nombre}? Se cerrará su sesión y la clave anterior dejará de servir.`)) return;
      const r = await api('POST', `/api/admin/usuarios/${id}/clave-temporal`);
      prompt(`Clave temporal para ${r.email}. Cópiala y envíala por un canal seguro: no se vuelve a mostrar.`, r.clave); return;
    }
    if (accion === 'borrar-resena' && confirm('¿Eliminar esta reseña?')) { await api('DELETE', `/api/admin/resenas/${id}`); avisar('Reseña eliminada'); await enrutar(); return; }
    if (accion === 'aprobar') { await api('PUT', `/api/admin/verificaciones/${id}`, { estado: 'verificado' }); avisar('Mentor verificado'); await enrutar(); }
    if (accion === 'rechazar') {
      const nota = prompt('Motivo del rechazo (el mentor lo verá):');
      if (!nota) return;
      await api('PUT', `/api/admin/verificaciones/${id}`, { estado: 'rechazado', nota }); avisar('Verificación rechazada'); await enrutar();
    }
  } catch (e) { avisar(e.message); if (b) b.disabled = false; }
});

window.addEventListener('hashchange', async () => {
  $nav.classList.remove('abierto'); document.getElementById('menu-btn')?.setAttribute('aria-expanded', 'false');
  if (yo) { try { await refrescarYo(); } catch { /* sin sesión */ } }
  enrutar();
});

(async () => {
  try {
    [{ usuario: yo }, catalogo] = await Promise.all([api('GET', '/api/yo'), api('GET', '/api/catalogo')]);
  } catch { /* se mostrará el error en la vista */ }
  const pie = document.getElementById('pie-soporte');
  if (pie && catalogo.soporte) pie.textContent = `Soporte: ${catalogo.soporte}`;
  enrutar();
})();
