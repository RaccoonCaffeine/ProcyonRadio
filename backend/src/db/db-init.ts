/**
 * Gestiona el ciclo de vida de la base de datos SQLite para ProcyonRadio
 * Importa y ejecuta el sistema de migraciones desde init-db.mts
 */
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

let db: DatabaseSync | null = null;

export async function initialize(): Promise<DatabaseSync> {
  // Construir la ruta absoluta al archivo init-db.mts
  const initDbPath = path.resolve(process.cwd(), 'init-db.mts');

  // Importar dinámicamente el módulo de migraciones
  const module = await import(initDbPath);
  const { initialize: init } = module;

  // Ejecutar la inicialización (aplicará migración 001 si es necesario)
  const result = init();
  db = result;

  return db as DatabaseSync;
}

export { db };