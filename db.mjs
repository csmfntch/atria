// Base de datos SQLite (node:sqlite, sin dependencias externas).
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const columnas = (db, tabla) => db.prepare(`PRAGMA table_info(${tabla})`).all().map((c) => c.name);
function agregarColumna(db, tabla, col, def) {
  if (!columnas(db, tabla).includes(col)) db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${col} ${def}`);
}

export function abrirBD(ruta) {
  if (ruta !== ':memory:') mkdirSync(dirname(ruta), { recursive: true });
  const db = new DatabaseSync(ruta);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS usuarios (
      id         INTEGER PRIMARY KEY,
      email      TEXT NOT NULL UNIQUE,
      pass_hash  TEXT NOT NULL,
      rol        TEXT NOT NULL CHECK (rol IN ('profesor','estudiante')),
      nombre     TEXT NOT NULL,
      ciudad     TEXT NOT NULL DEFAULT '',
      telefono   TEXT NOT NULL DEFAULT '',   -- celular colombiano, 10 dígitos
      bio        TEXT NOT NULL DEFAULT '',
      es_admin   INTEGER NOT NULL DEFAULT 0,
      -- mentores
      materias   TEXT NOT NULL DEFAULT '',   -- separadas por coma
      tarifa     INTEGER NOT NULL DEFAULT 0, -- COP por hora
      modalidad  TEXT NOT NULL DEFAULT 'ambas',
      experiencia TEXT NOT NULL DEFAULT '',
      documento  TEXT NOT NULL DEFAULT '',   -- cédula
      verificacion_estado TEXT NOT NULL DEFAULT 'sin_enviar'
                 CHECK (verificacion_estado IN ('sin_enviar','pendiente','verificado','rechazado')),
      verificacion_nota   TEXT NOT NULL DEFAULT '',
      terminos_version TEXT NOT NULL DEFAULT '',        -- versión de Términos y Privacidad aceptada
      terminos_fecha   TEXT NOT NULL DEFAULT '',        -- cuándo (UTC)
      verificacion_autorizada TEXT NOT NULL DEFAULT '', -- cuándo el mentor autorizó verificar su identidad (UTC)
      documento_origen TEXT NOT NULL DEFAULT 'colombiano', -- colombiano | extranjero (define qué documentos acepta la verificación)
      kyc_estado    TEXT NOT NULL DEFAULT '',   -- '', pendiente, aprobado, revision, rechazado
      kyc_sesion    TEXT NOT NULL DEFAULT '',   -- id de la sesión en el proveedor
      kyc_resultado TEXT NOT NULL DEFAULT '',   -- resumen JSON de la decisión (sin imágenes)
      -- estudiantes
      nivel      TEXT NOT NULL DEFAULT '',
      intereses  TEXT NOT NULL DEFAULT '',
      colegio_tipo   TEXT NOT NULL DEFAULT '' CHECK (colegio_tipo IN ('','publico','privado','ninguno')),
      colegio_nombre TEXT NOT NULL DEFAULT '',
      localidad      TEXT NOT NULL DEFAULT '', -- localidad de Bogotá
      grado          TEXT NOT NULL DEFAULT '',
      es_menor       INTEGER NOT NULL DEFAULT 0,
      acudiente_nombre  TEXT NOT NULL DEFAULT '',
      acudiente_celular TEXT NOT NULL DEFAULT '',
      creado     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sesiones (
      token      TEXT PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      expira     INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clases (
      id          INTEGER PRIMARY KEY,
      profesor_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      titulo      TEXT NOT NULL,
      materia     TEXT NOT NULL,
      nivel       TEXT NOT NULL DEFAULT '',
      descripcion TEXT NOT NULL DEFAULT '',
      precio_hora INTEGER NOT NULL,
      duracion_min INTEGER NOT NULL DEFAULT 60,
      modalidad   TEXT NOT NULL CHECK (modalidad IN ('virtual','presencial','ambas')),
      ciudad      TEXT NOT NULL DEFAULT '',
      activa      INTEGER NOT NULL DEFAULT 1,
      creado      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Disponibilidad semanal del mentor (hora de Colombia). dia: 0 = domingo … 6 = sábado
    CREATE TABLE IF NOT EXISTS horarios (
      id          INTEGER PRIMARY KEY,
      profesor_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      dia         INTEGER NOT NULL CHECK (dia BETWEEN 0 AND 6),
      inicio      TEXT NOT NULL,
      fin         TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS solicitudes (
      id            INTEGER PRIMARY KEY,
      estudiante_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      materia       TEXT NOT NULL,
      descripcion   TEXT NOT NULL DEFAULT '',
      presupuesto   INTEGER NOT NULL DEFAULT 0, -- COP por hora (0 = a convenir)
      modalidad     TEXT NOT NULL CHECK (modalidad IN ('virtual','presencial','ambas')),
      ciudad        TEXT NOT NULL DEFAULT '',
      abierta       INTEGER NOT NULL DEFAULT 1,
      creado        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ofertas (
      id           INTEGER PRIMARY KEY,
      solicitud_id INTEGER NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
      profesor_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      clase_id     INTEGER REFERENCES clases(id) ON DELETE SET NULL,
      mensaje      TEXT NOT NULL,
      creado       TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (solicitud_id, profesor_id)
    );

    -- Documentos de verificación de mentores (cédula, título). Se guardan en la BD.
    CREATE TABLE IF NOT EXISTS documentos (
      id         INTEGER PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      tipo       TEXT NOT NULL CHECK (tipo IN ('cedula','titulo')),
      mime       TEXT NOT NULL,
      datos      BLOB NOT NULL,           -- vacío cuando el archivo está en Supabase Storage
      ruta       TEXT NOT NULL DEFAULT '', -- ruta en el bucket privado (si aplica)
      creado     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Suscripción mensual (mentores y estudiantes). vence: 'YYYY-MM-DD HH:MM:SS' UTC.
    CREATE TABLE IF NOT EXISTS suscripciones (
      usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
      vence      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pagos (
      id          INTEGER PRIMARY KEY,
      usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      referencia  TEXT NOT NULL UNIQUE,
      monto_cop   INTEGER NOT NULL,
      estado      TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobado','rechazado','error')),
      proveedor   TEXT NOT NULL DEFAULT 'wompi',
      proveedor_id TEXT NOT NULL DEFAULT '',
      creado      TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Las reservas ahora son por horario. Las bases de datos anteriores (prototipo) se reconstruyen.
  if (db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='reservas'`).get()
      && !columnas(db, 'reservas').includes('fecha')) {
    db.exec('DROP TABLE reservas');
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS reservas (
      id            INTEGER PRIMARY KEY,
      clase_id      INTEGER NOT NULL REFERENCES clases(id) ON DELETE CASCADE,
      profesor_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      estudiante_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      fecha         TEXT NOT NULL,           -- YYYY-MM-DD (hora de Colombia)
      hora          TEXT NOT NULL,           -- HH:MM
      duracion_min  INTEGER NOT NULL,
      mensaje       TEXT NOT NULL DEFAULT '',
      estado        TEXT NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente','aceptada','rechazada','cancelada')),
      creado        TEXT NOT NULL DEFAULT (datetime('now'))
    );
    -- Un mismo horario del mentor no puede tener dos reservas activas
    CREATE UNIQUE INDEX IF NOT EXISTS idx_reserva_slot
      ON reservas (profesor_id, fecha, hora) WHERE estado IN ('pendiente','aceptada');

    CREATE TABLE IF NOT EXISTS resenas (
      id            INTEGER PRIMARY KEY,
      reserva_id    INTEGER NOT NULL UNIQUE REFERENCES reservas(id) ON DELETE CASCADE,
      profesor_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      estudiante_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      calificacion  INTEGER NOT NULL CHECK (calificacion BETWEEN 1 AND 5),
      comentario    TEXT NOT NULL DEFAULT '',
      creado        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_clases_materia ON clases(materia);
    CREATE INDEX IF NOT EXISTS idx_clases_ciudad ON clases(ciudad);
    CREATE INDEX IF NOT EXISTS idx_resenas_prof ON resenas(profesor_id);
    CREATE INDEX IF NOT EXISTS idx_horarios_prof ON horarios(profesor_id);
  `);

  // Migración de bases de datos creadas antes de estas funciones
  for (const [col, def] of [
    ['es_admin', 'INTEGER NOT NULL DEFAULT 0'], ['documento', `TEXT NOT NULL DEFAULT ''`],
    ['verificacion_estado', `TEXT NOT NULL DEFAULT 'sin_enviar'`], ['verificacion_nota', `TEXT NOT NULL DEFAULT ''`],
    ['colegio_tipo', `TEXT NOT NULL DEFAULT ''`], ['colegio_nombre', `TEXT NOT NULL DEFAULT ''`],
    ['localidad', `TEXT NOT NULL DEFAULT ''`], ['grado', `TEXT NOT NULL DEFAULT ''`],
    ['es_menor', 'INTEGER NOT NULL DEFAULT 0'], ['acudiente_nombre', `TEXT NOT NULL DEFAULT ''`],
    ['acudiente_celular', `TEXT NOT NULL DEFAULT ''`],
    ['terminos_version', `TEXT NOT NULL DEFAULT ''`], ['terminos_fecha', `TEXT NOT NULL DEFAULT ''`], ['verificacion_autorizada', `TEXT NOT NULL DEFAULT ''`],
    ['documento_origen', `TEXT NOT NULL DEFAULT 'colombiano'`],
    ['kyc_estado', `TEXT NOT NULL DEFAULT ''`], ['kyc_sesion', `TEXT NOT NULL DEFAULT ''`], ['kyc_resultado', `TEXT NOT NULL DEFAULT ''`],
  ]) agregarColumna(db, 'usuarios', col, def);
  agregarColumna(db, 'documentos', 'ruta', `TEXT NOT NULL DEFAULT ''`);

  return db;
}
