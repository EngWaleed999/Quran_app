import { existsSync, mkdirSync, statSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const sourcePath = resolve(process.argv[2] ?? 'assets/data/quran.db');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const defaultOutput = resolve('backups', `${basename(sourcePath, '.db')}-${timestamp}.db`);
const outputPath = resolve(process.argv[3] ?? defaultOutput);

if (!existsSync(sourcePath)) {
  throw new Error(`Database not found: ${sourcePath}`);
}
if (existsSync(outputPath)) {
  throw new Error(`Backup already exists and will not be overwritten: ${outputPath}`);
}
mkdirSync(dirname(outputPath), { recursive: true });

const source = new DatabaseSync(sourcePath);
try {
  // Checkpoint WAL content before creating a standalone snapshot.
  source.exec('PRAGMA wal_checkpoint(FULL)');
  const safePath = outputPath.replace(/'/g, "''");
  source.exec(`VACUUM INTO '${safePath}'`);
} finally {
  source.close();
}

const backupDb = new DatabaseSync(outputPath, { readOnly: true });
try {
  const integrity = backupDb.prepare('PRAGMA quick_check').all();
  if (integrity.length !== 1 || integrity[0].quick_check !== 'ok') {
    throw new Error('Backup integrity verification failed. Keep the original database unchanged.');
  }
  console.log(JSON.stringify({
    source: sourcePath,
    backup: outputPath,
    bytes: statSync(outputPath).size,
    integrity: 'ok',
  }, null, 2));
} finally {
  backupDb.close();
}
