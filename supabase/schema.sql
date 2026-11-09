-- Artia — esquema para Supabase (PostgreSQL). EQUIVALENTE al esquema SQLite de db.mjs.
-- ESTADO: preparado pero SIN PROBAR contra un proyecto real (aún no hay credenciales en esta sesión).
-- Se ejecuta en el SQL Editor de Supabase o con la CLI (supabase db push).
--
-- Seguridad: todas las tablas tienen RLS activado y SIN políticas. El navegador (llave `anon`) no puede leer
-- nada; solo el servidor de Artia, que usa la llave `service_role` (nunca se expone al navegador), accede a los datos.

create table if not exists usuarios (
  id          bigint generated always as identity primary key,
  email       text not null unique check (email = lower(email)),
  pass_hash   text not null,
  rol         text not null check (rol in ('profesor','estudiante')),
  nombre      text not null,
  ciudad      text not null default '',
  telefono    text not null default '',
  bio         text not null default '',
  es_admin    boolean not null default false,
  -- mentores
  materias    text not null default '',
  tarifa      integer not null default 0,
  modalidad   text not null default 'ambas',
  experiencia text not null default '',
  documento   text not null default '',
  verificacion_estado text not null default 'sin_enviar' check (verificacion_estado in ('sin_enviar','pendiente','verificado','rechazado')),
  verificacion_nota   text not null default '',
  kyc_estado    text not null default '' check (kyc_estado in ('','pendiente','aprobado','revision','rechazado')),
  kyc_sesion    text not null default '',
  kyc_resultado text not null default '',   -- resumen JSON de la decisión (sin imágenes)
  -- estudiantes
  nivel       text not null default '',
  intereses   text not null default '',
  colegio_tipo   text not null default '' check (colegio_tipo in ('','publico','privado','ninguno')),
  colegio_nombre text not null default '',
  localidad      text not null default '',
  grado          text not null default '',
  es_menor       boolean not null default false,
  acudiente_nombre  text not null default '',
  acudiente_celular text not null default '',
  creado      timestamptz not null default now()
);

create table if not exists sesiones (
  token      text primary key,
  usuario_id bigint not null references usuarios(id) on delete cascade,
  expira     timestamptz not null
);

create table if not exists clases (
  id           bigint generated always as identity primary key,
  profesor_id  bigint not null references usuarios(id) on delete cascade,
  titulo       text not null,
  materia      text not null,
  nivel        text not null default '',
  descripcion  text not null default '',
  precio_hora  integer not null,
  duracion_min integer not null default 60,
  modalidad    text not null check (modalidad in ('virtual','presencial','ambas')),
  ciudad       text not null default '',
  activa       boolean not null default true,
  creado       timestamptz not null default now()
);
create index if not exists idx_clases_materia on clases(materia);
create index if not exists idx_clases_ciudad on clases(ciudad);

-- Disponibilidad semanal (hora de Colombia). dia: 0 = domingo … 6 = sábado
create table if not exists horarios (
  id          bigint generated always as identity primary key,
  profesor_id bigint not null references usuarios(id) on delete cascade,
  dia         smallint not null check (dia between 0 and 6),
  inicio      time not null,
  fin         time not null check (fin > inicio)
);
create index if not exists idx_horarios_prof on horarios(profesor_id);

create table if not exists reservas (
  id            bigint generated always as identity primary key,
  clase_id      bigint not null references clases(id) on delete cascade,
  profesor_id   bigint not null references usuarios(id) on delete cascade,
  estudiante_id bigint not null references usuarios(id) on delete cascade,
  fecha         date not null,   -- hora de Colombia
  hora          time not null,
  duracion_min  integer not null,
  mensaje       text not null default '',
  estado        text not null default 'pendiente' check (estado in ('pendiente','aceptada','rechazada','cancelada')),
  creado        timestamptz not null default now()
);
-- Un mismo horario del mentor no puede tener dos reservas activas
create unique index if not exists idx_reserva_slot on reservas (profesor_id, fecha, hora) where estado in ('pendiente','aceptada');

create table if not exists resenas (
  id            bigint generated always as identity primary key,
  reserva_id    bigint not null unique references reservas(id) on delete cascade,
  profesor_id   bigint not null references usuarios(id) on delete cascade,
  estudiante_id bigint not null references usuarios(id) on delete cascade,
  calificacion  smallint not null check (calificacion between 1 and 5),
  comentario    text not null default '',
  creado        timestamptz not null default now()
);
create index if not exists idx_resenas_prof on resenas(profesor_id);

create table if not exists solicitudes (
  id            bigint generated always as identity primary key,
  estudiante_id bigint not null references usuarios(id) on delete cascade,
  materia       text not null,
  descripcion   text not null default '',
  presupuesto   integer not null default 0,
  modalidad     text not null check (modalidad in ('virtual','presencial','ambas')),
  ciudad        text not null default '',
  abierta       boolean not null default true,
  creado        timestamptz not null default now()
);

create table if not exists ofertas (
  id           bigint generated always as identity primary key,
  solicitud_id bigint not null references solicitudes(id) on delete cascade,
  profesor_id  bigint not null references usuarios(id) on delete cascade,
  clase_id     bigint references clases(id) on delete set null,
  mensaje      text not null,
  creado       timestamptz not null default now(),
  unique (solicitud_id, profesor_id)
);

-- Documentos de verificación: el archivo va a Supabase Storage (bucket privado), aquí solo la referencia.
create table if not exists documentos (
  id         bigint generated always as identity primary key,
  usuario_id bigint not null references usuarios(id) on delete cascade,
  tipo       text not null check (tipo in ('cedula','titulo')),
  mime       text not null,
  ruta       text not null,          -- ruta dentro del bucket «documentos-verificacion»
  creado     timestamptz not null default now()
);

create table if not exists suscripciones (
  usuario_id bigint primary key references usuarios(id) on delete cascade,
  vence      timestamptz not null
);

create table if not exists pagos (
  id           bigint generated always as identity primary key,
  usuario_id   bigint not null references usuarios(id) on delete cascade,
  referencia   text not null unique,
  monto_cop    integer not null,
  estado       text not null default 'pendiente' check (estado in ('pendiente','aprobado','rechazado','error')),
  proveedor    text not null default 'wompi',
  proveedor_id text not null default '',
  creado       timestamptz not null default now()
);

-- RLS activado, sin políticas: solo la llave service_role (servidor) puede acceder.
do $$
declare t text;
begin
  foreach t in array array['usuarios','sesiones','clases','horarios','reservas','resenas','solicitudes','ofertas','documentos','suscripciones','pagos']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Bucket privado para cédulas y títulos (sin acceso público):
insert into storage.buckets (id, name, public) values ('documentos-verificacion', 'documentos-verificacion', false)
on conflict (id) do nothing;
