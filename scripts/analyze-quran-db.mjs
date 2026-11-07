import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const input = resolve(process.argv[2] ?? 'assets/data/quran.db');
const db = new DatabaseSync(input, { readOnly: true });

function scalar(sql) {
  return db.prepare(sql).get();
}

try {
  const fileBytes = statSync(input).size;
  const pageSize = Number(scalar('PRAGMA page_size').page_size);
  const pageCount = Number(scalar('PRAGMA page_count').page_count);
  const freePages = Number(scalar('PRAGMA freelist_count').freelist_count);

  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all().map((row) => row.name);

  const contents = {};
  for (const [table, column] of [
    ['mushaf_svg_pages', 'svg_xml'],
    ['mushaf_svg_pages', 'raw_json'],
    ['ayah_tafsir', 'text'],
    ['ayahs', 'aya_text'],
    ['ayahs', 'aya_text_emlaey'],
  ]) {
    try {
      const row = db.prepare(`SELECT COUNT(*) AS rows, COALESCE(SUM(length("${column}")), 0) AS characters, COALESCE(SUM(length(CAST("${column}" AS BLOB))), 0) AS payload_bytes FROM "${table}"`).get();
      contents[`${table}.${column}`] = {
        rows: Number(row.rows),
        characters: Number(row.characters),
        payloadBytes: Number(row.payload_bytes),
      };
    } catch {
      // This table/column may not exist in an older database.
    }
  }

  let storageByObject = null;
  try {
    storageByObject = db.prepare(
      'SELECT name, path, pageno, pgsize FROM dbstat'
    ).all().reduce((acc, row) => {
      const current = acc[row.name] ?? { bytes: 0, pages: 0 };
      current.bytes += Number(row.pgsize);
      current.pages += 1;
      acc[row.name] = current;
      return acc;
    }, {});
  } catch {
    // dbstat is not compiled into every SQLite build; logical payload totals above still help.
  }

  console.log(JSON.stringify({
    file: input,
    fileBytes,
    pageSize,
    pageCount,
    allocatedBytes: pageSize * pageCount,
    freePages,
    reclaimableBytes: freePages * pageSize,
    tables,
    contentPayloads: contents,
    storageByObject,
  }, null, 2));
} finally {
  db.close();
}
