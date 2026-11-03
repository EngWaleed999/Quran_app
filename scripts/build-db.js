const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const jsonPath = 'D:/Quran/kfgqpc_hafs_smart_data/hafs_smart_v8.json';
const dbPath = path.join(__dirname, '..', 'assets', 'data', 'quran.db');

console.log('Reading JSON dataset from:', jsonPath);
const rawData = fs.readFileSync(jsonPath, 'utf8');
const ayahsData = JSON.parse(rawData);

console.log(`Loaded ${ayahsData.length} ayahs.`);

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('Existing quran.db removed.');
}

const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA journal_mode = OFF;
  PRAGMA synchronous = 0;

  CREATE TABLE IF NOT EXISTS surahs (
    sura_no INTEGER PRIMARY KEY,
    sura_name_ar TEXT NOT NULL,
    sura_name_en TEXT NOT NULL,
    revelation_place TEXT NOT NULL,
    ayahs_count INTEGER NOT NULL,
    page_start INTEGER NOT NULL,
    page_end INTEGER NOT NULL,
    jozz_start INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ayahs (
    id INTEGER PRIMARY KEY,
    jozz INTEGER NOT NULL,
    sura_no INTEGER NOT NULL,
    page INTEGER NOT NULL,
    line_start INTEGER,
    line_end INTEGER,
    aya_no INTEGER NOT NULL,
    aya_text TEXT NOT NULL,
    aya_text_emlaey TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_ayahs_page ON ayahs(page);
  CREATE INDEX IF NOT EXISTS idx_ayahs_sura ON ayahs(sura_no);
  CREATE INDEX IF NOT EXISTS idx_ayahs_search ON ayahs(aya_text_emlaey);
`);

// 28 Surahs agreed to be Madaniyyah
const madaniSurahs = new Set([
  2, 3, 4, 5, 8, 9, 13, 22, 24, 33, 47, 48, 49, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 76, 98, 99, 110
]);

const surahStats = new Map();

const insertAyah = db.prepare(`
  INSERT INTO ayahs (id, jozz, sura_no, page, line_start, line_end, aya_no, aya_text, aya_text_emlaey)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

db.exec('BEGIN TRANSACTION');

for (const a of ayahsData) {
  insertAyah.run(
    a.id,
    a.jozz,
    a.sura_no,
    a.page,
    a.line_start ?? null,
    a.line_end ?? null,
    a.aya_no,
    a.aya_text,
    a.aya_text_emlaey
  );

  if (!surahStats.has(a.sura_no)) {
    surahStats.set(a.sura_no, {
      sura_no: a.sura_no,
      sura_name_ar: a.sura_name_ar,
      sura_name_en: a.sura_name_en,
      revelation_place: madaniSurahs.has(a.sura_no) ? 'مدنية' : 'مكية',
      ayahs_count: 0,
      page_start: a.page,
      page_end: a.page,
      jozz_start: a.jozz,
    });
  }

  const s = surahStats.get(a.sura_no);
  s.ayahs_count += 1;
  s.page_end = Math.max(s.page_end, a.page);
}

db.exec('COMMIT');

console.log('Inserted all ayahs into SQLite.');

const insertSurah = db.prepare(`
  INSERT INTO surahs (sura_no, sura_name_ar, sura_name_en, revelation_place, ayahs_count, page_start, page_end, jozz_start)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

db.exec('BEGIN TRANSACTION');
for (const s of surahStats.values()) {
  insertSurah.run(
    s.sura_no,
    s.sura_name_ar,
    s.sura_name_en,
    s.revelation_place,
    s.ayahs_count,
    s.page_start,
    s.page_end,
    s.jozz_start
  );
}
db.exec('COMMIT');

console.log(`Inserted ${surahStats.size} surahs into SQLite.`);

// Verification query
const totalAyahs = db.prepare('SELECT count(*) as count FROM ayahs').get();
const totalSurahs = db.prepare('SELECT count(*) as count FROM surahs').get();
const fatihah = db.prepare('SELECT sura_name_ar, ayahs_count, revelation_place FROM surahs WHERE sura_no = 1').get();
const baqarah = db.prepare('SELECT sura_name_ar, ayahs_count, revelation_place FROM surahs WHERE sura_no = 2').get();

console.log('Verification:');
console.log('Total Ayahs in DB:', totalAyahs.count);
console.log('Total Surahs in DB:', totalSurahs.count);
console.log('Sura 1:', fatihah);
console.log('Sura 2:', baqarah);

db.close();
console.log('quran.db created successfully at:', dbPath);

