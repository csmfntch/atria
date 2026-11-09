// Base de datos SQLite (node:sqlite, sin dependencias externas).
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

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
      -- solo profesores
      materias   TEXT NOT NULL DEFAULT '',   -- separadas por coma
      tarifa     INTEGER NOT NULL DEFAULT 0, -- COP por hora
      modalidad  TEXT NOT NULL DEFAULT 'ambas',
      experiencia TEXT NOT NULL DEFAULT '',
      -- solo estudiantes
      nivel      TEXT NOT NULL DEFAULT '',
      intereses  TEXT NOT NULL DEFAULT '',
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

    CREATE TABLE IF NOT EXISTS reservas (
      id            INTEGER PRIMARY KEY,
      clase_id      INTEGER NOT NULL REFERENCES clases(id) ON DELETE CASCADE,
      estudiante_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      mensaje       TEXT NOT NULL DEFAULT '',
      estado        TEXT NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente','aceptada','rechazada','cancelada')),
      creado        TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (clase_id, estudiante_id, estado)
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

    CREATE INDEX IF NOT EXISTS idx_clases_materia ON clases(materia);
    CREATE INDEX IF NOT EXISTS idx_clases_ciudad ON clases(ciudad);
  `);
  return db;
}
