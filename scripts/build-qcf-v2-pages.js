const fs = require('fs');
const path = require('path');
const https = require('https');

const PAGE_COUNT = 604;
const API_BASE = 'https://api.quran.com/api/v4/verses/by_page';
const TARGET_PATH = path.join(__dirname, '..', 'assets', 'data', 'qcf_v2_pages.json');
const AGENT = new https.Agent({ keepAlive: true, maxSockets: 10, timeout: 45000 });
const REQUEST_TIMEOUT_MS = 45000;
const MAX_RETRIES = 5;
const BATCH_SIZE = 10;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function assertCleanText(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(label + ' is missing or empty.');
  }
  if (/[\uFFFD?]/u.test(value)) {
    throw new Error(label + ' contains a replacement character or question mark.');
  }
  return value;
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        agent: AGENT,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'QuranApp-QCFv2-PageBuilder/2.0',
        },
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');

        response.on('data', (chunk) => {
          body += chunk;
        });

        response.on('end', () => {
          const statusCode = response.statusCode || 0;

          if (statusCode !== 200) {
            const error = new Error(
              'Quran API returned HTTP ' + statusCode + ': ' + body.slice(0, 300)
            );
            error.statusCode = statusCode;
            reject(error);
            return;
          }

          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error('Invalid JSON response: ' + error.message));
          }
        });
      }
    );

    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error('Request timed out after ' + REQUEST_TIMEOUT_MS + 'ms.'));
    });

    request.on('error', reject);
  });
}

function createToken(word, verseKey, pageNumber, lineNumber) {
  const charTypeName = word.char_type_name || 'word';
  const unicodeText =
    typeof word.text_qpc_hafs === 'string' ? word.text_qpc_hafs : null;
  const qcfText = typeof word.code_v2 === 'string' ? word.code_v2 : null;

  let renderMode;
  let text;

  if (charTypeName === 'word') {
    renderMode = 'qcf';
    text = assertCleanText(qcfText, verseKey + ' word ' + word.position + ' code_v2');
    assertCleanText(unicodeText, verseKey + ' word ' + word.position + ' text_qpc_hafs');
  } else if (charTypeName === 'end') {
    // Quran Foundation specifies Unicode/QPC Hafs for verse-end markers in QCF views.
    renderMode = 'unicode';
    text = assertCleanText(unicodeText, verseKey + ' verse-end marker text_qpc_hafs');
  } else if (unicodeText) {
    // Preserve pause/sajdah/rub-el-hizb marks using Unicode when the API provides it.
    renderMode = 'unicode';
    text = assertCleanText(unicodeText, verseKey + ' ' + charTypeName + ' text_qpc_hafs');
  } else {
    renderMode = 'qcf';
    text = assertCleanText(qcfText, verseKey + ' ' + charTypeName + ' code_v2');
  }

  const position = Number(word.position);
  if (!Number.isInteger(position) || position < 1) {
    throw new Error(verseKey + ' contains an invalid word position.');
  }

  return {
    renderMode,
    text,
    fallbackText: unicodeText,
    charTypeName,
    verseKey,
    position,
    pageNumber,
    lineNumber,
  };
}

async function fetchPage(pageNumber) {
  const lineCount = 15;
  const url = new URL(API_BASE + '/' + pageNumber);
  url.searchParams.set('words', 'true');
  url.searchParams.set(
    'word_fields',
    'code_v2,text_qpc_hafs,char_type_name,line_number,page_number'
  );
  url.searchParams.set('mushaf', '1');

  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await requestJson(url);

      if (!Array.isArray(response.verses) || response.verses.length === 0) {
        throw new Error('Page ' + pageNumber + ': API returned no verses.');
      }

      // Null entries are intentional physical slots reserved for headings/basmalas.
      const lines = Array.from({ length: lineCount }, () => null);
      const seenTokens = new Set();
      let acceptedTokenCount = 0;

      for (const verse of response.verses) {
        if (!verse || typeof verse.verse_key !== 'string') {
          throw new Error('Page ' + pageNumber + ': a verse is missing verse_key.');
        }

        if (!Array.isArray(verse.words)) {
          throw new Error('Page ' + pageNumber + ': ' + verse.verse_key + ' has no words array.');
        }

        for (const word of verse.words) {
          // by_page may include words on an adjacent page for a boundary verse.
          // Never let those words leak into this page's glyph stream.
          const wordPage = Number(word.page_number);
          if (wordPage !== pageNumber) continue;

          const lineNumber = Number(word.line_number);
          if (
            !Number.isInteger(lineNumber) ||
            lineNumber < 1 ||
            lineNumber > lineCount
          ) {
            throw new Error(
              'Page ' + pageNumber + ': ' + verse.verse_key +
              ' has invalid line_number ' + word.line_number + '.'
            );
          }

          const token = createToken(word, verse.verse_key, pageNumber, lineNumber);
          const tokenKey =
            token.verseKey + ':' + token.position + ':' + token.charTypeName;

          if (seenTokens.has(tokenKey)) {
            throw new Error('Page ' + pageNumber + ': duplicate token ' + tokenKey + '.');
          }
          seenTokens.add(tokenKey);

          if (!lines[lineNumber - 1]) {
            lines[lineNumber - 1] = [];
          }

          // The API returns words in Mushaf order. Keep that order; a line may
          // contain words from several verses and word.position resets per verse.
          lines[lineNumber - 1].push(token);
          acceptedTokenCount += 1;
        }
      }

      if (acceptedTokenCount === 0) {
        throw new Error('Page ' + pageNumber + ': no words belong to this page.');
      }

      return lines;
    } catch (error) {
      lastError = error;
      const statusCode = error.statusCode;
      const isPermanentClientError =
        statusCode >= 400 && statusCode < 500 && statusCode !== 429;

      if (attempt >= MAX_RETRIES || isPermanentClientError) {
        break;
      }

      const waitMs = Math.min(1000 * 2 ** attempt, 16000);
      console.warn(
        'Page ' + pageNumber + ' attempt ' + (attempt + 1) +
        ' failed: ' + error.message + '. Retrying in ' + waitMs + 'ms.'
      );
      await delay(waitMs);
    }
  }

  throw new Error(
    'Failed to build page ' + pageNumber + ' after ' + (MAX_RETRIES + 1) +
    ' attempts: ' + (lastError && lastError.message)
  );
}

function writeAtomically(filePath, content) {
  const tempPath = filePath + '.tmp';
  fs.writeFileSync(tempPath, content, 'utf8');
  fs.renameSync(tempPath, filePath);
}

async function run() {
  console.log(
    'Building QCF V2 pages from the Quran API. Existing page data will not be reused.'
  );

  const pages = {};

  for (let start = 1; start <= PAGE_COUNT; start += BATCH_SIZE) {
    const end = Math.min(start + BATCH_SIZE - 1, PAGE_COUNT);
    const batch = [];

    for (let page = start; page <= end; page += 1) {
      batch.push(fetchPage(page));
    }

    const results = await Promise.all(batch);

    results.forEach((lines, index) => {
      const pageNumber = start + index;
      pages[String(pageNumber)] = lines;
    });

    console.log('Generated ' + end + '/' + PAGE_COUNT + ' pages.');
    await delay(350);
  }

  const pageNumbers = Object.keys(pages);
  if (pageNumbers.length !== PAGE_COUNT) {
    throw new Error(
      'Expected ' + PAGE_COUNT + ' pages but generated ' + pageNumbers.length + '.'
    );
  }

  const output = {
    schemaVersion: 2,
    mushafId: 1,
    pageCount: PAGE_COUNT,
    generatedAt: new Date().toISOString(),
    source: 'Quran.com Content API v4 / QCF V2',
    pages,
  };

  writeAtomically(TARGET_PATH, JSON.stringify(output, null, 2));
  console.log('Saved ' + PAGE_COUNT + ' QCF V2 pages to ' + TARGET_PATH + '.');
  console.log('Next: run "npm run quran:validate-pages" before opening the app.');
}

run().catch((error) => {
  console.error('[QCF V2 generation failed]', error);
  process.exitCode = 1;
});
