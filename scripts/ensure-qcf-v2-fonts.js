const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const QCF_DIR = path.join(ROOT, 'assets', 'fonts', 'qcf_v2');
const UNICODE_FONT_PATH = path.join(ROOT, 'assets', 'fonts', 'UthmanicHafs1Ver18.ttf');
const QCF_CDN = 'https://verses.quran.foundation/fonts/quran/hafs/v2/ttf/p';
const UNICODE_FONT_URL =
  'https://verses.quran.foundation/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.ttf';
const CONCURRENCY = 8;
const MAX_RETRIES = 4;

function isTrueType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 10000) return false;
  const signature = buffer.subarray(0, 4).toString('hex');
  return ['00010000', '4f54544f', '74727565', '74797031'].includes(signature);
}

function isValidFile(filePath) {
  try {
    return isTrueType(fs.readFileSync(filePath));
  } catch {
    return false;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function downloadFont(url, destination, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 4) {
      reject(new Error('Too many redirects downloading ' + url));
      return;
    }

    const request = https.get(
      url,
      {
        headers: {
          'User-Agent': 'QuranApp-QCFv2-FontSetup/1.0',
          Accept: 'font/ttf,application/octet-stream,*/*',
        },
      },
      (response) => {
        const status = response.statusCode || 0;

        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume();
          const redirectedUrl = new URL(response.headers.location, url).toString();
          downloadFont(redirectedUrl, destination, redirects + 1).then(resolve, reject);
          return;
        }

        if (status !== 200) {
          response.resume();
          reject(new Error('HTTP ' + status + ' while downloading ' + url));
          return;
        }

        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          if (!isTrueType(buffer)) {
            reject(new Error('Downloaded file is not a valid TTF font: ' + url));
            return;
          }

          const temporaryPath = destination + '.download';
          try {
            fs.writeFileSync(temporaryPath, buffer);
            fs.renameSync(temporaryPath, destination);
            resolve();
          } catch (error) {
            try {
              fs.rmSync(temporaryPath, { force: true });
            } catch {}
            reject(error);
          }
        });
      }
    );

    request.setTimeout(60000, () => {
      request.destroy(new Error('Font download timed out: ' + url));
    });
    request.on('error', reject);
  });
}

async function ensureFont(url, destination) {
  if (isValidFile(destination)) return false;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      await downloadFont(url, destination);
      return true;
    } catch (error) {
      if (attempt === MAX_RETRIES) throw error;
      const waitMs = Math.min(1000 * 2 ** attempt, 12000);
      console.warn(
        'Font download attempt ' + (attempt + 1) + ' failed: ' +
        error.message + '. Retrying in ' + waitMs + 'ms.'
      );
      await delay(waitMs);
    }
  }

  return false;
}

async function runPool(items, worker, concurrency) {
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= items.length) return;
        await worker(items[index], index);
      }
    }
  );
  await Promise.all(workers);
}

async function run() {
  fs.mkdirSync(QCF_DIR, { recursive: true });

  const unicodeDownloaded = await ensureFont(
    UNICODE_FONT_URL,
    UNICODE_FONT_PATH
  );
  console.log(
    unicodeDownloaded
      ? 'Downloaded the official Uthmanic Hafs Unicode font.'
      : 'Uthmanic Hafs Unicode font is already available.'
  );

  const missingPages = [];
  for (let page = 1; page <= 604; page += 1) {
    const destination = path.join(QCF_DIR, 'p' + page + '.ttf');
    if (!isValidFile(destination)) missingPages.push(page);
  }

  if (missingPages.length === 0) {
    console.log('All 604 QCF V2 page fonts are present and have valid TTF headers.');
    return;
  }

  console.log(
    'Downloading ' + missingPages.length +
    ' missing/invalid QCF V2 page fonts. This is a one-time setup step.'
  );

  let completed = 0;
  await runPool(
    missingPages,
    async (page) => {
      const destination = path.join(QCF_DIR, 'p' + page + '.ttf');
      await ensureFont(QCF_CDN + page + '.ttf', destination);
      completed += 1;
      if (completed % 25 === 0 || completed === missingPages.length) {
        console.log(
          'QCF fonts: ' + completed + '/' + missingPages.length + ' downloaded.'
        );
      }
    },
    CONCURRENCY
  );

  const invalid = [];
  for (let page = 1; page <= 604; page += 1) {
    const fontPath = path.join(QCF_DIR, 'p' + page + '.ttf');
    if (!isValidFile(fontPath)) invalid.push(page);
  }

  if (invalid.length > 0) {
    throw new Error(
      'Some QCF fonts are still missing or invalid: ' + invalid.join(', ')
    );
  }

  console.log('All 604 QCF V2 page fonts are ready.');
}

run().catch((error) => {
  console.error('[QCF font setup failed]', error);
  process.exitCode = 1;
});
