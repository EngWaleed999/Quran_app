import { DatabaseSync } from 'node:sqlite';
import { initializeAppSchema } from '../../src/core/database/appSchema.ts';

export function createQuranTestDatabase() {
  const raw = new DatabaseSync(':memory:');
  raw.exec(`
    CREATE TABLE surahs (
      sura_no INTEGER PRIMARY KEY,
      ayahs_count INTEGER NOT NULL,
      sura_name_ar TEXT NOT NULL,
      page_start INTEGER NOT NULL
    );
    CREATE TABLE ayahs (
      id INTEGER PRIMARY KEY,
      sura_no INTEGER NOT NULL,
      aya_no INTEGER NOT NULL,
      page INTEGER NOT NULL,
      jozz INTEGER NOT NULL DEFAULT 1,
      aya_text_emlaey TEXT NOT NULL DEFAULT '',
      UNIQUE(sura_no, aya_no)
    );
  `);

  const insertSurah = raw.prepare(
    'INSERT INTO surahs (sura_no, ayahs_count, sura_name_ar, page_start) VALUES (?, ?, ?, ?)'
  );
  insertSurah.run(1, 3118, 'السورة الأولى', 1);
  insertSurah.run(2, 3118, 'السورة الثانية', 303);

  const insertAyah = raw.prepare(
    'INSERT INTO ayahs (id, sura_no, aya_no, page, jozz, aya_text_emlaey) VALUES (?, ?, ?, ?, 1, ?)'
  );
  for (let globalAyah = 1; globalAyah <= 6236; globalAyah += 1) {
    const suraNo = globalAyah <= 3118 ? 1 : 2;
    const ayaNo = suraNo === 1 ? globalAyah : globalAyah - 3118;
    const page = Math.min(604, Math.ceil(globalAyah / 11));
    insertAyah.run(globalAyah, suraNo, ayaNo, page, `آية ${globalAyah}`);
  }

  const db = {
    raw,
    async execAsync(sql) {
      raw.exec(sql);
    },
    async getAllAsync(sql, params = []) {
      return raw.prepare(sql).all(...params);
    },
    async getFirstAsync(sql, params = []) {
      return raw.prepare(sql).get(...params) ?? null;
    },
    getFirstSync(sql, params = []) {
      return raw.prepare(sql).get(...params) ?? null;
    },
    async runAsync(sql, params = []) {
      return raw.prepare(sql).run(...params);
    },
    async withExclusiveTransactionAsync(callback) {
      raw.exec('BEGIN EXCLUSIVE');
      try {
        await callback(db);
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
    close() {
      raw.close();
    },
  };

  return initializeAppSchema(db).then(() => db);
}
