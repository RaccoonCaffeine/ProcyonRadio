// Sistema de migraciones mínima y funcional para ProcyonRadio
// Implementa migración 001 al crear/abrir la base de datos SQLite

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'backend', 'prcyonradio.db');

let db: DatabaseSync | null = null;

export function initialize(): DatabaseSync {
  db = new DatabaseSync(DB_PATH);

  // Crear tabla de control de migraciones si no existe
  db.prepare(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'applied'
    )
  `).run();

  // Obtener versión actual del esquema
  const currentVer: { max: number | null } | undefined = db.prepare(
    'SELECT MAX(version) as max FROM schema_migrations WHERE status = ?'
  ).get('applied') as any;

  const currentVersion = currentVer?.max ?? 0;

  if (currentVersion >= 1) {
    console.log('[DB] Migración 001 ya aplicada - esquema actual:', currentVersion);
    return db;
  }

  console.log('[DB] Aplicando migración 001 (initial_schema)...');

  // Tabla: users
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      salt TEXT,
      email TEXT UNIQUE,
      role TEXT DEFAULT 'user',
      display_name TEXT,
      avatar_url TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Tabla: config
  db.prepare(`
    CREATE TABLE IF NOT EXISTS config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT,
      type TEXT,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Tabla: generation_radios
  db.prepare(`
    CREATE TABLE IF NOT EXISTS generation_radios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      language TEXT,
      region TEXT,
      tags TEXT,
      cover_url TEXT,
      is_active INTEGER DEFAULT 1,
      is_featured INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Tabla: genres
  db.prepare(`
    CREATE TABLE IF NOT EXISTS genres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      cover_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Tabla: tracks
  db.prepare(`
    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      meta_duration_ms INTEGER,
      cover_url TEXT,
      download_url TEXT,
      youtube_id TEXT,
      thumb_url TEXT,
      uploaded_at TEXT,
      stream_url TEXT,
      tags TEXT,
      bitrate INTEGER,
      genre_id INTEGER,
      radio_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (genre_id) REFERENCES genres(id),
      FOREIGN KEY (radio_id) REFERENCES generation_radios(id)
    )
  `).run();

  // Tabla: artists
  db.prepare(`
    CREATE TABLE IF NOT EXISTS artists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      bio TEXT,
      tags TEXT,
      slug TEXT UNIQUE,
      cover_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Tabla: tracks_artists (many-to-many)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS tracks_artists (
      track_id INTEGER NOT NULL,
      artist_id INTEGER NOT NULL,
      role TEXT DEFAULT 'main',
      PRIMARY KEY (track_id, artist_id),
      FOREIGN KEY (track_id) REFERENCES tracks(id),
      FOREIGN KEY (artist_id) REFERENCES artists(id)
    )
  `).run();

  // Tabla: tracks_genres (many-to-many)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS tracks_genres (
      track_id INTEGER NOT NULL,
      genre_id INTEGER NOT NULL,
      PRIMARY KEY (track_id, genre_id),
      FOREIGN KEY (track_id) REFERENCES tracks(id),
      FOREIGN KEY (genre_id) REFERENCES genres(id)
    )
  `).run();

  // Tabla: lately_played
  db.prepare(`
    CREATE TABLE IF NOT EXISTS lately_played (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      track_id INTEGER NOT NULL,
      played_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (track_id) REFERENCES tracks(id),
      UNIQUE(user_id, track_id)
    )
  `).run();

  // Tabla: user_radio_favourites
  db.prepare(`
    CREATE TABLE IF NOT EXISTS user_radio_favourites (
      user_id INTEGER NOT NULL,
      radio_id INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, radio_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (radio_id) REFERENCES generation_radios(id)
    )
  `).run();

  // Insertar configuración inicial obligatoria
  const configInicial = [
    ['app_name', 'ProcyonRadio', 'string', 'Nombre de la aplicación'],
    ['app_version', '1.1.1', 'string', 'Versión de la aplicación'],
    ['api_endpoint', 'http://localhost:8000', 'string', 'Endpoint de la API'],
    ['frontend_url', 'http://localhost:3000', 'string', 'URL del frontend'],
    ['stream_url', 'http://localhost:8000/stream', 'string', 'URL del stream'],
    ['default_language', 'es', 'string', 'Idioma por defecto'],
    ['copyright_notice', '© 2025 ProcyonRadio', 'string', 'Texto de copyright'],
    ['youtube_api_key', '', 'string', 'API Key de YouTube'],
    ['ga_tracking_id', '', 'string', 'Google Analytics tracking ID'],
    ['discord_webhook_url', '', 'string', 'Webhook de Discord para notificaciones']
  ];

  const stmt = db.prepare(
    'INSERT OR IGNORE INTO config(key, value, type, description) VALUES(?, ?, ?, ?)'
  );
  for (const [key, value, type, description] of configInicial) {
    stmt.run(key, value, type, description);
  }

  // Registrar migración aplicada
  db.prepare(
    'INSERT INTO schema_migrations(version, name, status) VALUES(?, ?, ?)'
  ).run(1, 'initial_schema', 'applied');

  console.log('[DB] ✓ Migración 001 (initial_schema) aplicada correctamente');
  console.log('[DB] Base de datos lista en:', DB_PATH);
  console.log('[DB] Tablas creadas: users, config, generation_radios, genres, tracks, artists, tracks_artists, tracks_genres, lately_played, user_radio_favourites');

  return db;
}

export { db };