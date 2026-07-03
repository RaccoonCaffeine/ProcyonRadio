import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

const DB_FILE_PATH = path.join(process.cwd(), "data", "procyon.db");

class DatabaseService {
  private db!: DatabaseSync;

  constructor() {
    this.init();
  }

  private init() {
    const dataDir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.db = new DatabaseSync(DB_FILE_PATH);

    // Habilitar modo WAL y llaves foráneas
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");

    // Inicializar tablas
    this.createTables();
  }

  private createTables() {
    // 1. tracks (Caché Global Multimedia y Biblioteca)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT UNIQUE,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        album TEXT,
        genre TEXT,
        duration INTEGER NOT NULL,
        thumbnail TEXT,
        is_local INTEGER DEFAULT 0,
        file_path TEXT
      );
    `);
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_tracks_url ON tracks(url);");
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);",
    );

    // 2. roles (Perfiles Personalizables por el Owner)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role_name TEXT UNIQUE NOT NULL
      );
    `);

    // Semilla de roles por defecto
    const roleCount = this.db
      .prepare("SELECT COUNT(*) as count FROM roles")
      .get() as { count: number };
    if (roleCount.count === 0) {
      const insertRole = this.db.prepare(
        "INSERT INTO roles (role_name) VALUES (?)",
      );
      insertRole.run("owner");
      insertRole.run("admin");
      insertRole.run("operator");
      insertRole.run("guest");
      console.log("🌱 Seeded default roles: owner, admin, operator, guest");
    }

    // 3. users (Control de Operadores y Personal)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role_id INTEGER,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (role_id) REFERENCES roles(id)
      );
    `);
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);",
    );

    // 4. active_queue (Cola Interactiva en Tránsito)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS active_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        track_id INTEGER,
        position INTEGER,
        added_by INTEGER,
        FOREIGN KEY (track_id) REFERENCES tracks(id),
        FOREIGN KEY (added_by) REFERENCES users(id)
      );
    `);
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_active_queue_position ON active_queue(position);",
    );

    // 5. playlists (Listas Temáticas, Pauta y Programación Horaria)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS playlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT DEFAULT 'standard',
        ad_interval_songs INTEGER,
        ad_interval_minutes INTEGER,
        active_from_hour INTEGER,
        active_to_hour INTEGER,
        created_by INTEGER,
        FOREIGN KEY (created_by) REFERENCES users(id)
      );
    `);

    // 6. playlist_tracks (Relación M:N de Listas de Reproducción)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS playlist_tracks (
        playlist_id INTEGER,
        track_id INTEGER,
        sort_order INTEGER NOT NULL,
        PRIMARY KEY (playlist_id, track_id),
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
      );
    `);

    // 7. playback_history (Historial de Transmisión)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS playback_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        track_id INTEGER,
        played_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (track_id) REFERENCES tracks(id)
      );
    `);

    // 8. role_permissions (Matriz de Control de Acceso - ACL)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id INTEGER,
        permission_key TEXT,
        PRIMARY KEY (role_id, permission_key),
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
      );
    `);

    // 9. system_settings (Configuración Global Llave-Valor)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY UNIQUE,
        value TEXT NOT NULL
      );
    `);

    // 10. audit_logs (Historial de Acciones Administrativas y Seguridad)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    // 11. invite_tokens (Control de Invitaciones Criptográficas)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS invite_tokens (
        token TEXT PRIMARY KEY UNIQUE,
        role_id INTEGER,
        is_used INTEGER DEFAULT 0,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (role_id) REFERENCES roles(id)
      );
    `);
  }

  public getDb(): DatabaseSync {
    return this.db;
  }

  public exec(sql: string): void {
    this.db.exec(sql);
  }

  public prepare(sql: string) {
    return this.db.prepare(sql);
  }
}

export const dbService = new DatabaseService();
