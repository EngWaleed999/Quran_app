import { createHash } from 'node:crypto';
import {
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
import { resolve, dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const ROOT = process.cwd();
const SOURCE_PATH = resolve(ROOT, 'assets/data/quran.db');
const TARGET_PATH = resolve(ROOT, 'assets/data/quran-full.db');
const TEMP_PATH = `${TARGET_PATH}.download`;
const MAX_DOWNLOAD_BYTES = 1024 * 1024 * 1024;
const MIN_DATABASE_BYTES = 1024 * 1024;

function assertSha256(value) {
  if (!/^[a-f0-9]{64}$/i.test(value ?? '')) {
    throw new Error('QURAN_DB_SHA256 must contain the 64-character SHA-256 hex digest.');
  }
  return value.toLowerCase();
}

function readCount(db, table) {
  return Number(db.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get().count);
}

function validateDatabase(filePath) {
  const sizeBytes = statSync(filePath).size;
  if (sizeBytes < MIN_DATABASE_BYTES) {
    throw new Error(`Database is too small (${sizeBytes} bytes). The complete Quran database is required.`);
  }

  const db = new DatabaseSync(filePath, { readOnly: true });
  try {
    const integrity = db.prepare('PRAGMA quick_check').all();
    if (integrity.length !== 1 || integrity[0].quick_check !== 'ok') {
      throw new Error('SQLite quick_check failed. Do not use this database for a build.');
    }

    const tables = new Set(
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name)
    );
    const requiredTables = ['surahs', 'ayahs', 'mushaf_svg_pages', 'ayah_tafsir'];
    const missing = requiredTables.filter((table) => !tables.has(table));
    if (missing.length > 0) {
      throw new Error(`Database is missing required tables: ${missing.join(', ')}.`);
    }

    const surahs = readCount(db, 'surahs');
    const ayahs = readCount(db, 'ayahs');
    const svg = db.prepare(
      'SELECT COUNT(*) AS count, COUNT(DISTINCT page) AS distinct_pages, MIN(page) AS min_page, MAX(page) AS max_page FROM mushaf_svg_pages'
    ).get();
    const saadi = db.prepare(
      "SELECT COUNT(*) AS count FROM ayah_tafsir WHERE tafsir_type = 'saadi' AND length(trim(text)) > 0"
    ).get();

    if (surahs !== 114) throw new Error(`Expected 114 surahs, found ${surahs}.`);
    if (ayahs !== 6236) throw new Error(`Expected 6,236 ayahs, found ${ayahs}.`);
    if (
      Number(svg.count) !== 604 ||
      Number(svg.distinct_pages) !== 604 ||
      Number(svg.min_page) !== 1 ||
      Number(svg.max_page) !== 604
    ) {
      throw new Error('Database must contain exactly one SVG record for each Mushaf page (1–604).');
    }
    if (Number(saadi.count) < 1) {
      throw new Error('The database does not contain any non-empty Saadi tafsir records.');
    }

    const endpoints = db.prepare(
      'SELECT page, length(svg_xml) AS svg_length, length(raw_json) AS json_length FROM mushaf_svg_pages WHERE page IN (1, 604) ORDER BY page'
    ).all();
    if (
      endpoints.length !== 2 ||
      endpoints.some((row) => Number(row.svg_length) < 1 || Number(row.json_length) < 1)
    ) {
      throw new Error('The first and last Mushaf SVG pages must contain SVG and coordinate data.');
    }

    return {
      sizeBytes,
      surahs,
      ayahs,
      svgPages: Number(svg.count),
      saadiRecords: Number(saadi.count),
    };
  } finally {
    db.close();
  }
}

async function downloadDatabase(url, expectedSha256) {
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== 'https:') {
    throw new Error('QURAN_DB_URL must use HTTPS.');
  }

  mkdirSync(dirname(TARGET_PATH), { recursive: true });
  rmSync(TEMP_PATH, { force: true });

  console.log('Downloading the Quran database from the configured data host...');
  const response = await fetch(parsedUrl, { redirect: 'follow' });
  if (!response.ok || !response.body) {
    throw new Error(`Database download failed with HTTP ${response.status}.`);
  }
  if (new URL(response.url).protocol !== 'https:') {
    throw new Error('The database download redirected to a non-HTTPS URL.');
  }

  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > MAX_DOWNLOAD_BYTES) {
    throw new Error('The database download exceeds the 1 GiB safety limit.');
  }

  const hash = createHash('sha256');
  let downloadedBytes = 0;
  const checksumStream = new Transform({
    transform(chunk, _encoding, callback) {
      downloadedBytes += chunk.length;
      if (downloadedBytes > MAX_DOWNLOAD_BYTES) {
        callback(new Error('The database download exceeded the 1 GiB safety limit.'));
        return;
      }
      hash.update(chunk);
      callback(null, chunk);
    },
  });

  try {
    await pipeline(
      Readable.fromWeb(response.body),
      checksumStream,
      createWriteStream(TEMP_PATH, { flags: 'wx' })
    );

    const actualSha256 = hash.digest('hex');
    if (actualSha256 !== expectedSha256) {
      throw new Error(
        `SHA-256 mismatch. Expected ${expectedSha256}, received ${actualSha256}. The downloaded file was rejected.`
      );
    }

    const metrics = validateDatabase(TEMP_PATH);
    if (existsSync(TARGET_PATH)) {
      throw new Error('The target database already exists; it was not overwritten.');
    }

    renameSync(TEMP_PATH, TARGET_PATH);
    return { ...metrics, sha256: actualSha256 };
  } catch (error) {
    rmSync(TEMP_PATH, { force: true });
    throw error;
  }
}

async function main() {
  const isEasBuild =
    process.argv.includes('--eas') || process.env.EAS_BUILD === 'true';
  const configuredUrl = process.env.QURAN_DB_URL?.trim();
  const configuredSha = process.env.QURAN_DB_SHA256?.trim();
  const expectedSha256 = configuredSha ? assertSha256(configuredSha) : null;

  mkdirSync(dirname(TARGET_PATH), { recursive: true });

  let metrics;
  if (existsSync(TARGET_PATH)) {
    metrics = validateDatabase(TARGET_PATH);
    if (expectedSha256) {
      const actual = createHash('sha256').update(await import('node:fs').then((fs) => fs.readFileSync(TARGET_PATH))).digest('hex');
      if (actual !== expectedSha256) {
        throw new Error('The existing quran-full.db does not match QURAN_DB_SHA256.');
      }
    }
  } else if (isEasBuild) {
    if (!configuredUrl || !expectedSha256) {
      throw new Error(
        'EAS build requires QURAN_DB_URL and QURAN_DB_SHA256. Upload the full database to a release/object store and configure both variables in the EAS build environment.'
      );
    }
    metrics = await downloadDatabase(configuredUrl, expectedSha256);
  } else if (configuredUrl && expectedSha256) {
    metrics = await downloadDatabase(configuredUrl, expectedSha256);
  } else if (existsSync(SOURCE_PATH)) {
    metrics = validateDatabase(SOURCE_PATH);
    if (existsSync(TARGET_PATH)) {
      throw new Error('The target quran-full.db already exists; refusing to overwrite it.');
    }
    copyFileSync(SOURCE_PATH, TARGET_PATH);
  } else {
    throw new Error(
      'Full Quran database not found. Put the complete database at assets/data/quran.db, or configure QURAN_DB_URL and QURAN_DB_SHA256.'
    );
  }

  // Revalidate the final path after a local copy. No source file is ever deleted or modified.
  metrics = validateDatabase(TARGET_PATH);
  const digest = createHash('sha256')
    .update(await import('node:fs').then((fs) => fs.readFileSync(TARGET_PATH)))
    .digest('hex');

  console.log('Quran database is ready for Metro bundling.');
  console.log(JSON.stringify({ ...metrics, sha256: digest, asset: 'assets/data/quran-full.db' }, null, 2));
}

main().catch((error) => {
  console.error('[prepare-quran-db] ' + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
