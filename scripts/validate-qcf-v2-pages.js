const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const PAGE_COUNT = 604;
const EXPECTED_EMPTY_SLOTS = 226;
const DATA_PATH = path.join(__dirname, '..', 'assets', 'data', 'qcf_v2_pages.json');
const DB_PATH = path.join(__dirname, '..', 'assets', 'data', 'quran.db');

function fail(message) {
  throw new Error(message);
}

function isCleanText(value) {
  return typeof value === 'string' && value.length > 0 && !/[\uFFFD?]/u.test(value);
}

function validate() {
  if (!fs.existsSync(DATA_PATH)) {
    fail('Dataset not found: ' + DATA_PATH);
  }
  if (!fs.existsSync(DB_PATH)) {
    fail('Quran database not found: ' + DB_PATH);
  }

  const dataset = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  if (dataset.schemaVersion !== 2 || dataset.mushafId !== 1) {
    fail('Unsupported dataset schema. Regenerate the QCF V2 dataset first.');
  }
  if (!dataset.pages || typeof dataset.pages !== 'object') {
    fail('Dataset has no pages object.');
  }

  const pageKeys = Object.keys(dataset.pages);
  if (pageKeys.length !== PAGE_COUNT) {
    fail('Expected ' + PAGE_COUNT + ' pages, found ' + pageKeys.length + '.');
  }

  const seenVerseKeys = new Set();
  const seenTokenKeys = new Set();
  let emptySlots = 0;
  let tokenCount = 0;
  let wordCount = 0;

  for (let pageNumber = 1; pageNumber <= PAGE_COUNT; pageNumber += 1) {
    const pageKey = String(pageNumber);
    const lines = dataset.pages[pageKey];
    const expectedLineCount = pageNumber <= 2 ? 8 : 15;

    if (!Array.isArray(lines) || lines.length !== expectedLineCount) {
      fail(
        'Page ' + pageNumber + ': expected ' + expectedLineCount + ' physical line slots.'
      );
    }

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];

      if (line === null) {
        emptySlots += 1;
        continue;
      }
      if (!Array.isArray(line) || line.length === 0) {
        fail('Page ' + pageNumber + ', line ' + (lineIndex + 1) + ': expected tokens or null.');
      }

      for (const token of line) {
        tokenCount += 1;

        if (!token || typeof token !== 'object') {
          fail('Page ' + pageNumber + ', line ' + (lineIndex + 1) + ': malformed token.');
        }
        if (token.pageNumber !== pageNumber) {
          fail('Page ' + pageNumber + ': token leaked from page ' + token.pageNumber + '.');
        }
        if (token.lineNumber !== lineIndex + 1) {
          fail('Page ' + pageNumber + ': token has incorrect line number.');
        }
        if (!/^\d{1,3}:\d{1,3}$/.test(token.verseKey || '')) {
          fail('Page ' + pageNumber + ': token has invalid verseKey.');
        }
        if (!Number.isInteger(token.position) || token.position < 1) {
          fail('Page ' + pageNumber + ': token has invalid position.');
        }
        if (!isCleanText(token.text)) {
          fail('Page ' + pageNumber + ': token text is empty or corrupted.');
        }
        if (
          token.fallbackText !== null &&
          token.fallbackText !== undefined &&
          !isCleanText(token.fallbackText)
        ) {
          fail('Page ' + pageNumber + ': token fallback text is corrupted.');
        }

        if (token.charTypeName === 'word') {
          wordCount += 1;
          if (token.renderMode !== 'qcf' || !isCleanText(token.fallbackText)) {
            fail('Page ' + pageNumber + ': a Quran word is missing QCF/Unicode text.');
          }
        } else if (token.charTypeName === 'end') {
          if (
            token.renderMode !== 'unicode' ||
            !isCleanText(token.fallbackText) ||
            token.text !== token.fallbackText
          ) {
            fail('Page ' + pageNumber + ': verse-end marker is not Unicode-renderable.');
          }
        } else if (!['qcf', 'unicode'].includes(token.renderMode)) {
          fail('Page ' + pageNumber + ': unsupported render mode.');
        }

        const tokenKey =
          token.verseKey + ':' + token.position + ':' + token.charTypeName;
        if (seenTokenKeys.has(tokenKey)) {
          fail('Duplicate token detected: ' + tokenKey + '.');
        }
        seenTokenKeys.add(tokenKey);
        seenVerseKeys.add(token.verseKey);
      }
    }

    if (!lines.some((line) => Array.isArray(line) && line.length > 0)) {
      fail('Page ' + pageNumber + ' contains no Quran words.');
    }
  }

  if (emptySlots !== EXPECTED_EMPTY_SLOTS) {
    fail(
      'Expected ' + EXPECTED_EMPTY_SLOTS + ' reserved heading slots, found ' + emptySlots + '.'
    );
  }

  // The local SQLite Quran text is an independent completeness check.
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  try {
    const ayahs = db
      .prepare('SELECT sura_no, aya_no FROM ayahs ORDER BY sura_no, aya_no')
      .all();

    const expectedVerseKeys = new Set(
      ayahs.map((ayah) => ayah.sura_no + ':' + ayah.aya_no)
    );

    const missing = [...expectedVerseKeys].filter(
      (verseKey) => !seenVerseKeys.has(verseKey)
    );
    const unexpected = [...seenVerseKeys].filter(
      (verseKey) => !expectedVerseKeys.has(verseKey)
    );

    if (missing.length > 0 || unexpected.length > 0) {
      fail(
        'Verse coverage mismatch. Missing: ' + (missing.slice(0, 20).join(', ') || 'none') +
        '. Unexpected: ' + (unexpected.slice(0, 20).join(', ') || 'none') + '.'
      );
    }

    console.log('QCF V2 dataset validation passed.');
    console.log('Pages: ' + PAGE_COUNT);
    console.log('Physical line slots: ' + (PAGE_COUNT * 15 - 22));
    console.log('Reserved surah/basmala slots: ' + emptySlots);
    console.log('Tokens: ' + tokenCount);
    console.log('Quran word tokens: ' + wordCount);
    console.log('Ayahs represented: ' + seenVerseKeys.size);
  } finally {
    db.close();
  }
}

try {
  validate();
} catch (error) {
  console.error('[QCF V2 validation failed]', error.message);
  process.exitCode = 1;
}
