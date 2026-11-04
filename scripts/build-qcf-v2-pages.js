const fs = require('fs');
const path = require('path');
const https = require('https');

const PAGE_COUNT = 604;
const CHAPTER_COUNT = 114;
const TARGET_PATH = path.join(__dirname, '..', 'assets', 'data', 'qcf_v2_pages.json');
const REQUEST_TIMEOUT_MS = 45000;
const MAX_RETRIES = 5;
const CHAPTER_BATCH_SIZE = 8;
const QF_CLIENT_ID = process.env.QF_CLIENT_ID;
const QF_CLIENT_SECRET = process.env.QF_CLIENT_SECRET;
const HAS_QF_CREDENTIALS = Boolean(QF_CLIENT_ID && QF_CLIENT_SECRET);
const QF_ENV = process.env.QF_ENV === 'prelive' ? 'prelive' : 'production';

const API_BASE = HAS_QF_CREDENTIALS
  ? (QF_ENV === 'prelive'
      ? 'https://apis-prelive.quran.foundation/content/api/v4'
      : 'https://apis.quran.foundation/content/api/v4')
  : 'https://api.quran.com/api/v4';

const OAUTH_BASE = QF_ENV === 'prelive'
  ? 'https://prelive-oauth2.quran.foundation'
  : 'https://oauth2.quran.foundation';

const AGENT = new https.Agent({
  keepAlive: true,
  maxSockets: CHAPTER_BATCH_SIZE * 2,
  timeout: REQUEST_TIMEOUT_MS,
});

let accessToken = null;
let accessTokenExpiresAt = 0;

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

function requestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: options.method || 'GET',
        agent: AGENT,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'QuranApp-QCFv2-PageBuilder/3.0',
          ...(options.headers || {}),
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

          if (statusCode < 200 || statusCode >= 300) {
            const error = new Error(
              'Quran API returned HTTP ' + statusCode + ': ' + body.slice(0, 500)
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

    if (options.body) request.write(options.body);
    request.end();
  });
}

async function getAccessToken(forceRefresh = false) {
  if (!HAS_QF_CREDENTIALS) return null;

  if (
    !forceRefresh &&
    accessToken &&
    Date.now() < accessTokenExpiresAt - 60000
  ) {
    return accessToken;
  }

  const basic = Buffer.from(
    QF_CLIENT_ID + ':' + QF_CLIENT_SECRET,
    'utf8'
  ).toString('base64');

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'content',
  }).toString();

  const tokenResponse = await requestJson(OAUTH_BASE + '/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + basic,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
    body,
  });

  if (
    typeof tokenResponse.access_token !== 'string' ||
    !Number.isFinite(Number(tokenResponse.expires_in))
  ) {
    throw new Error('OAuth token response is missing access_token or expires_in.');
  }

  accessToken = tokenResponse.access_token;
  accessTokenExpiresAt = Date.now() + Number(tokenResponse.expires_in) * 1000;
  return accessToken;
}

function createToken(word, verseKey, chapterNumber) {
  const charTypeName = word.char_type_name;
  if (typeof charTypeName !== 'string' || charTypeName.length === 0) {
    throw new Error(verseKey + ' contains a word without char_type_name.');
  }

  const unicodeText =
    typeof word.text_qpc_hafs === 'string' ? word.text_qpc_hafs : null;
  const qcfText = typeof word.code_v2 === 'string' ? word.code_v2 : null;

  const pageNumber = Number(word.page_number);
  const lineNumber = Number(word.line_number);
  const position = Number(word.position);
  const expectedLineCount = pageNumber <= 2 ? 8 : 15;

  if (
    !Number.isInteger(pageNumber) ||
    pageNumber < 1 ||
    pageNumber > PAGE_COUNT
  ) {
    throw new Error(
      verseKey + ' word ' + word.position + ' has invalid page_number: ' +
      word.page_number
    );
  }

  if (
    !Number.isInteger(lineNumber) ||
    lineNumber < 1 ||
    lineNumber > expectedLineCount
  ) {
    throw new Error(
      verseKey + ' word ' + word.position + ' has invalid line_number: ' +
      word.line_number
    );
  }

  if (!Number.isInteger(position) || position < 1) {
    throw new Error(verseKey + ' contains an invalid word position.');
  }

  let renderMode;
  let text;

  if (charTypeName === 'word') {
    renderMode = 'qcf';
    text = assertCleanText(
      qcfText,
      verseKey + ' word ' + position + ' code_v2'
    );
    assertCleanText(
      unicodeText,
      verseKey + ' word ' + position + ' text_qpc_hafs'
    );
  } else if (charTypeName === 'end') {
    // QCF documentation explicitly requires Uthmanic Hafs for ayah-end markers.
    renderMode = 'unicode';
    text = assertCleanText(
      unicodeText,
      verseKey + ' verse-end marker text_qpc_hafs'
    );
  } else if (unicodeText) {
    renderMode = 'unicode';
    text = assertCleanText(
      unicodeText,
      verseKey + ' ' + charTypeName + ' text_qpc_hafs'
    );
  } else {
    renderMode = 'qcf';
    text = assertCleanText(
      qcfText,
      verseKey + ' ' + charTypeName + ' code_v2'
    );
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

async function fetchChapter(chapterNumber) {
  const url = new URL(API_BASE + '/verses/by_chapter/' + chapterNumber);
  url.searchParams.set('words', 'true');
  url.searchParams.set(
    'word_fields',
    'code_v2,text_qpc_hafs,char_type_name,position,line_number,page_number'
  );
  url.searchParams.set('mushaf', '1');
  url.searchParams.set('per_page', '50');

  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const headers = {};
      if (HAS_QF_CREDENTIALS) {
        headers['x-auth-token'] = await getAccessToken(
          attempt > 0 && lastError && lastError.statusCode === 401
        );
        headers['x-client-id'] = QF_CLIENT_ID;
      }

      const chapterTokens = [];
      const seenTokens = new Set();
      let apiPage = 1;
      let totalApiPages = 1;

      while (apiPage <= totalApiPages) {
        const requestUrl = new URL(url);
        requestUrl.searchParams.set('page', String(apiPage));

        const response = await requestJson(requestUrl, { headers });

        if (!Array.isArray(response.verses)) {
          throw new Error(
            'Chapter ' + chapterNumber + ', API page ' + apiPage +
            ': response has no verses array.'
          );
        }

        for (const verse of response.verses) {
          if (
            !verse ||
            typeof verse.verse_key !== 'string' ||
            !verse.verse_key.startsWith(chapterNumber + ':')
          ) {
            throw new Error(
              'Chapter ' + chapterNumber + ': response contains an invalid verse key.'
            );
          }

          if (!Array.isArray(verse.words) || verse.words.length === 0) {
            throw new Error(
              'Chapter ' + chapterNumber + ': ' + verse.verse_key +
              ' has no word records.'
            );
          }

          for (const word of verse.words) {
            const token = createToken(word, verse.verse_key, chapterNumber);
            const tokenKey =
              token.verseKey + ':' + token.position + ':' + token.charTypeName;

            if (seenTokens.has(tokenKey)) {
              throw new Error(
                'Chapter ' + chapterNumber + ': duplicate token ' + tokenKey + '.'
              );
            }

            seenTokens.add(tokenKey);
            chapterTokens.push(token);
          }
        }

        const pagination = response.pagination || {};
        totalApiPages = Math.max(
          totalApiPages,
          Number(pagination.total_pages) || 1
        );

        if (
          pagination.next_page !== null &&
          pagination.next_page !== undefined
        ) {
          apiPage = Number(pagination.next_page);
        } else if (apiPage < totalApiPages) {
          apiPage += 1;
        } else {
          break;
        }

        if (!Number.isInteger(apiPage) || apiPage < 1 || apiPage > 20) {
          throw new Error(
            'Chapter ' + chapterNumber +
            ': invalid or excessive API pagination sequence.'
          );
        }
      }

      if (chapterTokens.length === 0) {
        throw new Error('Chapter ' + chapterNumber + ': API returned no words.');
      }

      return chapterTokens;
    } catch (error) {
      lastError = error;
      const statusCode = error.statusCode;
      const isPermanentClientError =
        statusCode >= 400 &&
        statusCode < 500 &&
        statusCode !== 429 &&
        !(HAS_QF_CREDENTIALS && statusCode === 401);

      if (attempt >= MAX_RETRIES || isPermanentClientError) break;

      const waitMs = Math.min(1000 * 2 ** attempt, 16000);
      console.warn(
        'Chapter ' + chapterNumber + ' attempt ' + (attempt + 1) +
        ' failed: ' + error.message + '. Retrying in ' + waitMs + 'ms.'
      );
      await delay(waitMs);
    }
  }

  if (
    !HAS_QF_CREDENTIALS &&
    lastError &&
    (lastError.statusCode === 401 || lastError.statusCode === 403)
  ) {
    throw new Error(
      'The legacy public endpoint rejected the request. Configure production ' +
      'Content API credentials using QF_CLIENT_ID and QF_CLIENT_SECRET.'
    );
  }

  throw new Error(
    'Failed to build chapter ' + chapterNumber + ' after ' +
    (MAX_RETRIES + 1) + ' attempts: ' + (lastError && lastError.message)
  );
}

function writeAtomically(filePath, content) {
  const tempPath = filePath + '.tmp';
  fs.writeFileSync(tempPath, content, 'utf8');
  fs.renameSync(tempPath, filePath);
}

async function run() {
  if (HAS_QF_CREDENTIALS) {
    console.log('Using authenticated Quran Foundation Content API (' + QF_ENV + ').');
    await getAccessToken();
  } else {
    console.warn(
      'QF_CLIENT_ID/QF_CLIENT_SECRET are not set. Trying the legacy public Quran.com API. ' +
      'If it rejects requests, configure production Content API credentials.'
    );
  }

  console.log(
    'Building QCF V2 pages from all 114 chapters. ' +
    'Words are assigned to their own page_number/line_number, including cross-page ayahs.'
  );

  const pages = {};
  for (let page = 1; page <= PAGE_COUNT; page += 1) {
    const lineCount = page <= 2 ? 8 : 15;
    pages[String(page)] = Array.from({ length: lineCount }, () => null);
  }

  const seenTokens = new Set();
  let tokenCount = 0;

  for (
    let start = 1;
    start <= CHAPTER_COUNT;
    start += CHAPTER_BATCH_SIZE
  ) {
    const end = Math.min(start + CHAPTER_BATCH_SIZE - 1, CHAPTER_COUNT);
    const chapterResults = await Promise.all(
      Array.from({ length: end - start + 1 }, (_, index) =>
        fetchChapter(start + index)
      )
    );

    // Promise.all preserves chapter order; each chapter response preserves verse
    // and word order. This keeps physical line reading order deterministic.
    for (const chapterTokens of chapterResults) {
      for (const token of chapterTokens) {
        const tokenKey =
          token.verseKey + ':' + token.position + ':' + token.charTypeName;

        if (seenTokens.has(tokenKey)) {
          throw new Error('Duplicate Quran token detected: ' + tokenKey + '.');
        }
        seenTokens.add(tokenKey);

        const line = pages[String(token.pageNumber)][token.lineNumber - 1];
        if (line === null) {
          pages[String(token.pageNumber)][token.lineNumber - 1] = [token];
        } else {
          line.push(token);
        }

        tokenCount += 1;
      }
    }

    console.log(
      'Fetched chapters ' + start + '-' + end + '/' + CHAPTER_COUNT +
      '; collected ' + tokenCount + ' word/marker tokens.'
    );
    await delay(250);
  }

  for (let page = 1; page <= PAGE_COUNT; page += 1) {
    if (!pages[String(page)].some((line) => Array.isArray(line) && line.length > 0)) {
      throw new Error('QCF page ' + page + ' contains no word tokens.');
    }
  }

  const output = {
    schemaVersion: 2,
    mushafId: 1,
    pageCount: PAGE_COUNT,
    generatedAt: new Date().toISOString(),
    source: HAS_QF_CREDENTIALS
      ? 'Quran Foundation Content API v4 / by_chapter / QCF V2'
      : 'Quran.com Content API v4 legacy endpoint / by_chapter / QCF V2',
    pages,
  };

  // Do not touch the old dataset until every chapter and every token succeeds.
  writeAtomically(TARGET_PATH, JSON.stringify(output, null, 2));

  console.log(
    'Saved all 604 QCF V2 pages (' + tokenCount +
    ' tokens) to ' + TARGET_PATH + '.'
  );
  console.log('Run "npm run quran:validate-pages" before launching the app.');
}

run().catch((error) => {
  console.error('[QCF V2 generation failed]', error);
  process.exitCode = 1;
});
