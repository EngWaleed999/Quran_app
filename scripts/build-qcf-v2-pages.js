const fs = require('fs');
const path = require('path');
const https = require('https');

const targetPath = path.join(__dirname, '..', 'assets', 'data', 'qcf_v2_pages.json');

const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 25,
  timeout: 30000,
});

// Load existing progress if any
let allPages = {};
if (fs.existsSync(targetPath)) {
  try {
    const existing = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    // Only keep pages that have true code_v2 (starts with 0xfc41 or similar, not 0xfb51)
    for (const [p, lines] of Object.entries(existing)) {
      if (lines && lines.length > 0 && lines[0].charCodeAt(0) >= 0xfc00) {
        allPages[p] = lines;
      }
    }
  } catch {}
}

console.log(`Starting with ${Object.keys(allPages).length} already valid pages.`);

function fetchPage(pageNumber, retries = 5) {
  return new Promise((resolve, reject) => {
    const url = `https://api.quran.com/api/v4/verses/by_page/${pageNumber}?words=true&word_fields=code_v2,line_number,page_number&mushaf=1`;
    const req = https.get(url, { agent }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          if (retries > 0) {
            return setTimeout(() => fetchPage(pageNumber, retries - 1).then(resolve).catch(reject), 1000);
          }
          return reject(new Error(`Status ${res.statusCode} on page ${pageNumber}`));
        }
        try {
          const json = JSON.parse(body);
          const linesMap = {};
          if (json.verses) {
            json.verses.forEach(v => {
              if (v.words) {
                v.words.forEach(w => {
                  if (!linesMap[w.line_number]) {
                    linesMap[w.line_number] = [];
                  }
                  linesMap[w.line_number].push(w.code_v2);
                });
              }
            });
          }
          const lines = [];
          for (let l = 1; l <= 15; l++) {
            if (linesMap[l]) {
              lines.push(linesMap[l].join(' '));
            }
          }
          resolve({ pageNumber, lines });
        } catch (err) {
          if (retries > 0) {
            return setTimeout(() => fetchPage(pageNumber, retries - 1).then(resolve).catch(reject), 1000);
          }
          reject(err);
        }
      });
    });

    req.on('error', (err) => {
      if (retries > 0) {
        setTimeout(() => fetchPage(pageNumber, retries - 1).then(resolve).catch(reject), 1000);
      } else {
        reject(err);
      }
    });

    req.setTimeout(30000, () => {
      req.destroy();
      if (retries > 0) {
        setTimeout(() => fetchPage(pageNumber, retries - 1).then(resolve).catch(reject), 1000);
      } else {
        reject(new Error(`Timeout page ${pageNumber}`));
      }
    });
  });
}

async function run() {
  const missing = [];
  for (let p = 1; p <= 604; p++) {
    if (!allPages[p.toString()]) {
      missing.push(p);
    }
  }

  console.log(`Need to fetch ${missing.length} missing pages.`);

  const BATCH_SIZE = 20;
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const chunk = missing.slice(i, i + BATCH_SIZE);
    const promises = chunk.map(p => fetchPage(p));
    const results = await Promise.all(promises);
    for (const r of results) {
      allPages[r.pageNumber.toString()] = r.lines;
    }
    const doneCount = Object.keys(allPages).length;
    process.stdout.write(`\rProgress: ${doneCount}/604 (${Math.round((doneCount / 604) * 100)}%)`);

    // Save checkpoint every 60 pages
    if (doneCount % 60 === 0 || doneCount === 604) {
      fs.writeFileSync(targetPath, JSON.stringify(allPages, null, 2), 'utf8');
    }
  }

  fs.writeFileSync(targetPath, JSON.stringify(allPages, null, 2), 'utf8');
  console.log(`\nSuccessfully saved all 604 authentic QCF V2 pages to ${targetPath}!`);

  // Verify page 135
  const p135 = allPages['135'];
  console.log('Page 135 lines count:', p135.length);
  console.log('Page 135 Line 1:', p135[0]);
}

run().catch(console.error);
