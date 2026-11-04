const fs = require('fs');
const path = require('path');
const https = require('https');

const PAGE_COUNT = 604;
const TARGET_PATH = path.join(__dirname, '..', 'assets', 'data', 'qcf_v2_pages.json');
const REQUEST_TIMEOUT_MS = 45000;
const MAX_RETRIES = 5;
const BATCH_SIZE = 10;
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
  maxSockets: BATCH_SIZE,
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
          'User-Agent': 'QuranApp-QCFv2-PageBuilder/2.1',
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

function createToken(word, verseKey, pageNumber, lineNumber) {
  const charTypeName = word.char_type_name || 'word';
  const unicodeText =
    typeof word.text_qpc_hafs === 'string' ? word.text_qpc_hafs : null;
  const qcfText = typeof word.code_v2 === 'string' ? word.code_v2 : null;

  let renderMode;
  let text;

  if (charTypeName === 'word') {
    renderMode = 'qcf';
    text = assertCleanText(
      qcfText,
      verseKey + ' word ' + word.position + ' code_v2'
    );
    assertCleanText(
      unicodeText,
      verseKey + ' word ' + word.position + ' text_qpc_hafs'
    );
  } else if (charTypeName === 'end') {
    // Quran Foundation requires Unicode/Uthmanic Hafs for verse-end markers.
    renderMode = 'unicode';
    text = assertCleanText(
      unicodeText,
      verseKey + ' verse-end marker text_qpc_hafs'
    );
  } else if (unicodeText) {
    // Pause, sajdah and rub-el-hizb marks are kept using their Unicode form.
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
  // The two opening pages use the decorated eight-line QCF layout.
  const lineCount = pageNumber <= 2 ? 8 : 15;
  const url = new URL(API_BASE + '/verses/by_page/' + pageNumber);
  url.searchParams.set('words', 'true');
  url.searchParams.set('word_fields', 'code_v2,text_qpc_hafs');
  url.searchParams.set('mushaf', '1');

  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const headers = {};
      if (HAS_QF_CREDENTIALS) {
        headers['x-auth-token'] = await getAccessToken(attempt > 0 && lastError?.statusCode === 401);
        headers['x-client-id'] = QF_CLIENT_ID;
      }

      const response = await requestJson(url, { headers });

      if (!Array.isArray(response.verses) || response.verses.length === 0) {
        throw new Error('Page ' + pageNumber + ': API returned no verses.');
      }

      // Null is a real physical line slot reserved for headings/basmalas.
      const lines = Array.from({ length: lineCount }, () => null);
      const seenTokens = new Set();
      let acceptedTokenCount = 0;

      for (const verse of response.verses) {
        if (!verse || typeof verse.verse_key !== 'string') {
          throw new Error('Page ' + pageNumber + ': a verse is missing verse_key.');
        }
        if (!Array.isArray(verse.words)) {
          throw new Error(
            'Page ' + pageNumber + ': ' + verse.verse_key + ' has no words array.'
          );
        }

        for (const word of verse.words) {
          // A verse may span two pages. The endpoint can return boundary words
          // from both; only retain tokens assigned to the requested page.
          if (Number(word.page_number) !== pageNumber) continue;

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

          if (!lines[lineNumber - 1]) lines[lineNumber - 1] = [];
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

      if (attempt >= MAX_RETRIES || isPermanentClientError) break;

      const waitMs = Math.min(1000 * 2 ** attempt, 16000);
      console.warn(
        'Page ' + pageNumber + ' attempt ' + (attempt + 1) +
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
      'The legacy public endpoint rejected the request. Create production Content API credentials ' +
      'and set QF_CLIENT_ID and QF_CLIENT_SECRET in the environment, then retry.'
    );
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
  if (HAS_QF_CREDENTIALS) {
    console.log('Using authenticated Quran Foundation Content API (' + QF_ENV + ').');
    await getAccessToken();
  } else {
    console.warn(
      'QF_CLIENT_ID/QF_CLIENT_SECRET are not set. Trying the legacy public Quran.com API. ' +
      'If it rejects requests, configure production Content API credentials.'
    );
  }

  console.log('Building QCF V2 pages. Existing cached page data will not be reused.');

  const pages = {};

  for (let start = 1; start <= PAGE_COUNT; start += BATCH_SIZE) {
    const end = Math.min(start + BATCH_SIZE - 1, PAGE_COUNT);
    const results = await Promise.all(
      Array.from({ length: end - start + 1 }, (_, index) =>
        fetchPage(start + index)
      )
    );

    results.forEach((lines, index) => {
      pages[String(start + index)] = lines;
    });

    console.log('Generated ' + end + '/' + PAGE_COUNT + ' pages.');
    await delay(350);
  }

  if (Object.keys(pages).length !== PAGE_COUNT) {
    throw new Error(
      'Expected ' + PAGE_COUNT + ' pages but generated ' + Object.keys(pages).length + '.'
    );
  }

  const output = {
    schemaVersion: 2,
    mushafId: 1,
    pageCount: PAGE_COUNT,
    generatedAt: new Date().toISOString(),
    source: HAS_QF_CREDENTIALS
      ? 'Quran Foundation Content API v4 / QCF V2'
      : 'Quran.com Content API v4 legacy endpoint / QCF V2',
    pages,
  };

  // Write only after all 604 pages have passed validation. A failed fetch never
  // replaces the last known-good file with a partial dataset.
  writeAtomically(TARGET_PATH, JSON.stringify(output, null, 2));
  console.log('Saved ' + PAGE_COUNT + ' QCF V2 pages to ' + TARGET_PATH + '.');
  console.log('Run "npm run quran:validate-pages" before launching the app.');
}

run().catch((error) => {
  console.error('[QCF V2 generation failed]', error);
  process.exitCode = 1;
});
