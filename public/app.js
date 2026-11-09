// Atria — interfaz (español, COP). Rutas con hash: #/clases, #/perfil, ...
const $app = document.getElementById('app');
const $nav = document.getElementById('nav');
const $aviso = document.getElementById('aviso');

// ---------- utilidades ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
class Raw { constructor(s) { this.s = s; } }
const val = (v) => (v instanceof Raw ? v.s : Array.isArray(v) ? v.map(val).join('') : esc(v));
const html = (t, ...v) => new Raw(t.reduce((a, s, i) => a + s + (i < v.length ? val(v[i]) : ''), ''));
const cop = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
const MOD = { virtual: 'Virtual', presencial: 'Presencial', ambas: 'Virtual y presencial' };
const ESTADO = { pendiente: 'espera', aceptada: 'ok', rechazada: 'mal', cancelada: 'mal' };
const fecha = (s) => new Date(s.replace(' ', 'T') + 'Z').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
const celular = (t) => `${t.slice(0, 3)} ${t.slice(3, 6)} ${t.slice(6)}`;

let yo = null;
let catalogo = { ciudades: [], materias: [], niveles: [] };

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
  setTimeout(() => $aviso.classList.remove('ver'), 3000);
}
const pintar = (r) => { $app.innerHTML = r.s; };
const opciones = (lista, sel = '', vacio) =>
  html`${vacio ? html`<option value="">${vacio}</option>` : ''}${lista.map((x) => html`<option ${x === sel ? new Raw('selected') : ''}>${x}</option>`)}`;
const optMod = (sel) => html`${Object.entries(MOD).map(([k, v]) => html`<option value="${k}" ${k === sel ? new Raw('selected') : ''}>${v}</option>`)}`;
const datosForm = (f) => Object.fromEntries(new FormData(f));
const fallo = (e) => html`<p class="error" role="alert">${e.message}</p>`;

// ---------- barra de navegación ----------
function pintarNav() {
  const enlaces = [['#/clases', 'Buscar clases']];
  if (yo?.rol === 'profesor') enlaces.push(['#/mis-clases', 'Mis clases'], ['#/solicitudes', 'Solicitudes de estudiantes'], ['#/reservas', 'Reservas']);
  if (yo?.rol === 'estudiante') enlaces.push(['#/solicitudes', 'Lo que busco'], ['#/reservas', 'Mis reservas']);
  if (yo) enlaces.push(['#/perfil', `Mi perfil`]);
  const actual = location.hash || '#/';
  $nav.innerHTML = enlaces.map(([h, t]) => `<a href="${h}" ${actual.startsWith(h) ? 'aria-current="page"' : ''}>${esc(t)}</a>`).join('') +
    (yo ? '<button data-accion="salir">Salir</button>' : '<a href="#/ingresar">Ingresar</a><a href="#/registro" class="btn chico">Crear cuenta</a>');
}

// ---------- vistas ----------
const tarjetaClase = (c) => html`
  <article class="tarjeta">
    <span class="etiqueta">${c.materia}</span>
    <h3><a href="#/clase/${c.id}">${c.titulo}</a></h3>
    <div class="suave">con <a href="#/profesor/${c.profesor_id}">${c.profesor_nombre}</a></div>
    <div>${c.nivel ? html`<span class="etiqueta">${c.nivel}</span>` : ''}<span class="etiqueta">${MOD[c.modalidad]}${c.ciudad && c.modalidad !== 'virtual' ? ' · ' + c.ciudad : ''}</span></div>
    <div class="precio">${cop(c.precio_hora)} <span class="suave">/ hora</span></div>
  </article>`;

async function vistaInicio() {
  const { clases } = await api('GET', '/api/clases');
  pintar(html`
    <section class="hero">
      <h1>Aprende con los mejores profesores de Colombia</h1>
      <p>Clases virtuales y presenciales en tu ciudad, a precios en pesos colombianos. Si enseñas, publica tus clases y encuentra estudiantes.</p>
      <div class="acciones">
        <a class="btn claro" href="#/clases">Buscar clases</a>
        ${yo ? '' : html`<a class="btn sec" href="#/registro?rol=profesor">Quiero dar clases</a>`}
      </div>
    </section>
    <h2>Clases recientes</h2>
    ${clases.length ? html`<div class="rejilla">${clases.slice(0, 6).map(tarjetaClase)}</div>` : html`<p class="vacio">Aún no hay clases publicadas. ¡Sé el primero!</p>`}`);
}

async function vistaClases(params) {
  const f = Object.fromEntries(params);
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const { clases } = await api('GET', '/api/clases' + (qs ? '?' + qs : ''));
  pintar(html`
    <h1>Buscar clases</h1>
    <form class="filtros" data-form="buscar" role="search">
      <input name="q" placeholder="¿Qué quieres aprender?" value="${f.q ?? ''}" aria-label="Buscar">
      <select name="materia" aria-label="Materia">${opciones(catalogo.materias, f.materia, 'Todas las materias')}</select>
      <select name="ciudad" aria-label="Ciudad">${opciones(catalogo.ciudades, f.ciudad, 'Toda Colombia')}</select>
      <select name="modalidad" aria-label="Modalidad"><option value="">Cualquier modalidad</option>${optMod(f.modalidad)}</select>
      <input name="max" type="number" min="0" step="1000" placeholder="Precio máx. por hora (COP)" value="${f.max ?? ''}" aria-label="Precio máximo">
      <button class="btn">Buscar</button>
    </form>
    ${clases.length ? html`<div class="rejilla">${clases.map(tarjetaClase)}</div>` : html`<p class="vacio">No encontramos clases con esos filtros. Prueba con otros o <a href="#/solicitudes">publica lo que buscas</a>.</p>`}`);
}

async function vistaClase(id) {
  const { clase: c, profesor: p } = await api('GET', `/api/clases/${id}`);
  const puedeReservar = yo?.rol === 'estudiante';
  pintar(html`
    <p><a href="#/clases">← Volver a las clases</a></p>
    <article class="tarjeta">
      <span class="etiqueta">${c.materia}</span>${c.nivel ? html`<span class="etiqueta">${c.nivel}</span>` : ''}
      <h1>${c.titulo}</h1>
      <p>${c.descripcion || 'Sin descripción.'}</p>
      <p><b>${cop(c.precio_hora)}</b> por hora · ${c.duracion_min} min por sesión · ${MOD[c.modalidad]}${c.ciudad && c.modalidad !== 'virtual' ? ' en ' + c.ciudad : ''}</p>
      <p>Profesor: <a href="#/profesor/${p.id}">${p.nombre}</a>${p.ciudad ? ' · ' + p.ciudad : ''}</p>
    </article>
    ${puedeReservar ? html`
      <form class="tarjeta campos" data-form="reservar" data-id="${c.id}">
        <h2>Solicitar esta clase</h2>
        <label>Mensaje para el profesor (opcional)<textarea name="mensaje" maxlength="500" placeholder="Cuéntale tu nivel y qué horarios te sirven"></textarea></label>
        <button class="btn">Enviar solicitud</button>
        <p class="suave">Cuando el profesor acepte, ambos verán el celular del otro para coordinar por WhatsApp.</p>
      </form>`
      : yo ? html`<p class="suave">Solo las cuentas de estudiante pueden solicitar clases.</p>`
      : html`<p class="tarjeta"><a href="#/ingresar">Ingresa</a> o <a href="#/registro?rol=estudiante">crea una cuenta de estudiante</a> para solicitar esta clase.</p>`}`);
}

async function vistaProfesor(id) {
  const { profesor: p, clases } = await api('GET', `/api/profesores/${id}`);
  pintar(html`
    <article class="tarjeta">
      <h1>${p.nombre}</h1>
      <p class="suave">${p.ciudad || 'Colombia'} · ${MOD[p.modalidad]}${p.tarifa ? ' · desde ' + cop(p.tarifa) + ' / hora' : ''}</p>
      <p>${p.bio || ''}</p>
      ${p.materias ? html`<p>${p.materias.split(', ').map((m) => html`<span class="etiqueta">${m}</span>`)}</p>` : ''}
      ${p.experiencia ? html`<p><b>Experiencia:</b> ${p.experiencia}</p>` : ''}
    </article>
    <h2>Clases de ${p.nombre.split(' ')[0]}</h2>
    ${clases.length ? html`<div class="rejilla">${clases.map((c) => tarjetaClase({ ...c, profesor_nombre: p.nombre }))}</div>` : html`<p class="vacio">Todavía no tiene clases publicadas.</p>`}`);
}

function vistaAcceso(modo, params) {
  const reg = modo === 'registro';
  const rol = params.get('rol') || 'estudiante';
  pintar(html`
    <form class="tarjeta campos" data-form="${modo}" style="max-width:460px;margin:0 auto">
      <h1>${reg ? 'Crear cuenta' : 'Ingresar'}</h1>
      <div id="error"></div>
      ${reg ? html`
        <label>Quiero…<select name="rol">
          <option value="estudiante" ${rol === 'estudiante' ? new Raw('selected') : ''}>Buscar clases (estudiante)</option>
          <option value="profesor" ${rol === 'profesor' ? new Raw('selected') : ''}>Dar clases (profesor)</option></select></label>
        <label>Nombre completo<input name="nombre" required maxlength="80" autocomplete="name"></label>` : ''}
      <label>Correo electrónico<input name="email" type="email" required autocomplete="email"></label>
      <label>Contraseña${reg ? ' (mínimo 8 caracteres)' : ''}<input name="password" type="password" required minlength="${reg ? 8 : 1}" autocomplete="${reg ? 'new-password' : 'current-password'}"></label>
      <button class="btn">${reg ? 'Crear cuenta' : 'Ingresar'}</button>
      <p class="suave">${reg ? html`¿Ya tienes cuenta? <a href="#/ingresar">Ingresa</a>` : html`¿Nuevo aquí? <a href="#/registro">Crea tu cuenta</a>`}</p>
    </form>`);
}

function vistaPerfil() {
  const esProf = yo.rol === 'profesor';
  pintar(html`
    <h1>Mi perfil de ${esProf ? 'profesor' : 'estudiante'}</h1>
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
        <label>Materias que enseñas (separadas por coma)<input name="materias" list="lista-materias" value="${yo.materias}" placeholder="Matemáticas, Inglés"></label>
        <datalist id="lista-materias">${catalogo.materias.map((m) => html`<option value="${m}">`)}</datalist>
        <div class="fila">
          <label>Valor por hora (COP)<input name="tarifa" type="number" min="0" step="1000" value="${yo.tarifa}"></label>
          <label>Modalidad<select name="modalidad">${optMod(yo.modalidad)}</select></label>
        </div>
        <label>Experiencia y estudios<textarea name="experiencia" maxlength="600">${yo.experiencia}</textarea></label>`
      : html`
        <div class="fila">
          <label>Nivel educativo<select name="nivel">${opciones(catalogo.niveles, yo.nivel, 'Selecciona')}</select></label>
          <label>Me interesa aprender<input name="intereses" value="${yo.intereses}" placeholder="Matemáticas, Inglés"></label>
        </div>`}
      <p class="suave">Tu celular solo se comparte con la otra persona cuando una reserva es aceptada.</p>
      <button class="btn">Guardar perfil</button>
    </form>`);
}

async function vistaMisClases(editarId) {
  const { clases } = await api('GET', '/api/clases/mias');
  const c = clases.find((x) => x.id === Number(editarId)) ?? { modalidad: yo.modalidad, ciudad: yo.ciudad, duracion_min: 60, precio_hora: yo.tarifa || '', activa: 1 };
  pintar(html`
    <h1>Mis clases</h1>
    ${clases.length ? clases.map((x) => html`
      <article class="tarjeta">
        <b>${x.titulo}</b> ${x.activa ? '' : html`<span class="etiqueta mal">Pausada</span>`}
        <div class="suave">${x.materia} · ${cop(x.precio_hora)} / hora · ${MOD[x.modalidad]}</div>
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
        <label>Materia<select name="materia" required>${opciones(catalogo.materias, c.materia, 'Selecciona')}</select></label>
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
      ${c.id ? html`<label><span><input type="checkbox" name="activa" style="width:auto" ${c.activa ? new Raw('checked') : ''}> Clase visible para estudiantes</span></label>` : ''}
      <div class="acciones-fila"><button class="btn">${c.id ? 'Guardar cambios' : 'Publicar clase'}</button>${c.id ? html`<a class="btn sec" href="#/mis-clases">Cancelar</a>` : ''}</div>
    </form>`);
}

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
          <p class="suave">${s.estudiante_nombre}${s.nivel ? ' · ' + s.nivel : ''} · Presupuesto: ${s.presupuesto ? cop(s.presupuesto) + ' / hora' : 'a convenir'} · ${fecha(s.creado)}</p>
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
    <form class="tarjeta campos" data-form="solicitud">
      <h2>Publicar una solicitud</h2>
      <div id="error"></div>
      <div class="fila">
        <label>¿Qué quieres aprender?<select name="materia" required>${opciones(catalogo.materias, '', 'Selecciona')}</select></label>
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
        <h3>Ofertas de profesores (${s.ofertas.length})</h3>
        ${s.ofertas.map((o) => html`<p><a href="#/profesor/${o.profesor_id}"><b>${o.profesor_nombre}</b></a>: ${o.mensaje}
          ${o.clase_titulo ? html`<br><a href="#/clase/${o.clase_id}">Ver clase: ${o.clase_titulo}</a>` : ''}</p>`)}
        <button class="btn peligro chico" data-accion="borrar-solicitud" data-id="${s.id}">Eliminar solicitud</button>
      </article>`) : html`<p class="vacio">Aún no has publicado solicitudes.</p>`}`);
}

async function vistaReservas() {
  const { reservas } = await api('GET', '/api/reservas');
  const esProf = yo.rol === 'profesor';
  pintar(html`
    <h1>${esProf ? 'Reservas recibidas' : 'Mis reservas'}</h1>
    ${reservas.length ? reservas.map((r) => html`
      <article class="tarjeta">
        <span class="etiqueta ${ESTADO[r.estado]}">${r.estado}</span>
        <h3><a href="#/clase/${r.clase_id}">${r.titulo}</a></h3>
        <p class="suave">${esProf ? 'Estudiante: ' + r.estudiante_nombre : 'Profesor: ' + r.profesor_nombre} · ${cop(r.precio_hora)} / hora · ${fecha(r.creado)}</p>
        ${r.mensaje ? html`<p>“${r.mensaje}”</p>` : ''}
        ${r.contacto ? html`<p>Contacto: <a href="https://wa.me/57${r.contacto}" target="_blank" rel="noopener">WhatsApp ${celular(r.contacto)}</a></p>`
          : r.estado === 'aceptada' ? html`<p class="suave">La otra persona aún no tiene celular en su perfil.</p>` : ''}
        <div class="acciones-fila">
          ${esProf && r.estado === 'pendiente' ? html`
            <button class="btn chico" data-accion="reserva" data-id="${r.id}" data-estado="aceptada">Aceptar</button>
            <button class="btn peligro chico" data-accion="reserva" data-id="${r.id}" data-estado="rechazada">Rechazar</button>` : ''}
          ${!esProf && ['pendiente', 'aceptada'].includes(r.estado) ? html`<button class="btn peligro chico" data-accion="reserva" data-id="${r.id}" data-estado="cancelada">Cancelar</button>` : ''}
        </div>
      </article>`) : html`<p class="vacio">Todavía no hay reservas.</p>`}`);
}

// ---------- enrutador ----------
async function enrutar() {
  const [rutaTxt, qs] = (location.hash.slice(1) || '/').split('?');
  const params = new URLSearchParams(qs ?? '');
  const [, base, arg] = rutaTxt.split('/');
  const protegida = ['perfil', 'mis-clases', 'solicitudes', 'reservas'];
  try {
    if (protegida.includes(base) && !yo) { location.hash = '#/ingresar'; return; }
    if (base === 'mis-clases' && yo.rol !== 'profesor') { location.hash = '#/'; return; }
    pintarNav();
    switch (base) {
      case '': case undefined: await vistaInicio(); break;
      case 'clases': await vistaClases(params); break;
      case 'clase': await vistaClase(arg); break;
      case 'profesor': await vistaProfesor(arg); break;
      case 'ingresar': vistaAcceso('login', params); break;
      case 'registro': vistaAcceso('registro', params); break;
      case 'perfil': vistaPerfil(); break;
      case 'mis-clases': await vistaMisClases(arg); break;
      case 'solicitudes': await vistaSolicitudes(); break;
      case 'reservas': await vistaReservas(); break;
      default: pintar(html`<p class="vacio">Página no encontrada. <a href="#/">Ir al inicio</a></p>`);
    }
  } catch (e) { pintar(html`<p class="error" role="alert">${e.message}</p>`); }
  window.scrollTo(0, 0);
  $app.focus({ preventScroll: true });
}

// ---------- eventos ----------
document.addEventListener('submit', async (ev) => {
  const f = ev.target.closest('form[data-form]');
  if (!f) return;
  ev.preventDefault();
  const d = datosForm(f);
  const boton = f.querySelector('button:not([type=button])');
  const mostrarError = (e) => { const c = f.querySelector('#error'); if (c) c.innerHTML = fallo(e).s; else avisar(e.message); };
  if (boton) boton.disabled = true;
  try {
    switch (f.dataset.form) {
      case 'buscar': {
        const p = new URLSearchParams(Object.entries(d).filter(([, v]) => v));
        const destino = '#/clases' + (p.size ? '?' + p : '');
        if (location.hash === destino) await enrutar(); else location.hash = destino;
        break;
      }
      case 'registro': case 'login': {
        ({ usuario: yo } = await api('POST', f.dataset.form === 'login' ? '/api/login' : '/api/registro', d));
        avisar(f.dataset.form === 'login' ? `¡Hola de nuevo, ${yo.nombre.split(' ')[0]}!` : '¡Cuenta creada! Completa tu perfil.');
        location.hash = f.dataset.form === 'login' ? '#/' : '#/perfil';
        break;
      }
      case 'perfil':
        ({ usuario: yo } = await api('PUT', '/api/perfil', d));
        pintarNav(); avisar('Perfil guardado'); break;
      case 'clase': {
        const id = f.dataset.id;
        const cuerpo = { ...d, activa: id ? 'activa' in d : true };
        await api(id ? 'PUT' : 'POST', id ? `/api/clases/${id}` : '/api/clases', cuerpo);
        avisar(id ? 'Clase actualizada' : '¡Clase publicada!');
        if (id) location.hash = '#/mis-clases'; else await enrutar();
        break;
      }
      case 'reservar':
        await api('POST', '/api/reservas', { clase_id: Number(f.dataset.id), mensaje: d.mensaje });
        avisar('Solicitud enviada al profesor'); location.hash = '#/reservas'; break;
      case 'solicitud':
        await api('POST', '/api/solicitudes', d); avisar('Solicitud publicada'); await enrutar(); break;
      case 'oferta':
        await api('POST', `/api/solicitudes/${f.dataset.id}/ofertas`, { ...d, clase_id: d.clase_id ? Number(d.clase_id) : null });
        avisar('Oferta enviada'); await enrutar(); break;
    }
  } catch (e) { mostrarError(e); if (boton) boton.disabled = false; }
});

document.addEventListener('click', async (ev) => {
  const b = ev.target.closest('[data-accion]');
  if (!b) return;
  const { accion, id, estado } = b.dataset;
  try {
    if (accion === 'salir') { await api('POST', '/api/logout'); yo = null; location.hash = '#/'; pintarNav(); avisar('Sesión cerrada'); return; }
    if (accion === 'borrar-clase' && confirm('¿Eliminar esta clase?')) { await api('DELETE', `/api/clases/${id}`); await enrutar(); }
    if (accion === 'borrar-solicitud' && confirm('¿Eliminar esta solicitud?')) { await api('DELETE', `/api/solicitudes/${id}`); await enrutar(); }
    if (accion === 'reserva') { await api('PUT', `/api/reservas/${id}`, { estado }); await enrutar(); }
  } catch (e) { avisar(e.message); }
});

window.addEventListener('hashchange', enrutar);

(async () => {
  try {
    [{ usuario: yo }, catalogo] = await Promise.all([api('GET', '/api/yo'), api('GET', '/api/catalogo')]);
  } catch { /* se mostrará el error en la vista */ }
  enrutar();
})();
