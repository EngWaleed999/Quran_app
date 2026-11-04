# Quran app data and font setup

## Normal development

1. Install dependencies with the project package manager (`pnpm install`).
2. Start through the package script (`pnpm start`, `pnpm android`, or `pnpm ios`).

The repository enables pnpm pre/post scripts explicitly, so the pre-start hooks run reliably. They verify the single Unicode Hafs font and all 604 page-specific QCF V2 fonts. Missing or invalid TTF files are downloaded from the official Quran Foundation font CDN. Once bundled into the app, reading does not require an internet connection.

Do not start with a bare `npx expo start` when the local font directory is incomplete; it bypasses the pre-start font verification. Use `pnpm start`.

## QCF V2 data generation

The page generator always rebuilds all 604 pages. It deliberately does not reuse the previous JSON cache, because a cached page may already contain damaged glyphs or words from a neighbouring page.

```sh
npm run quran:build-pages
npm run quran:validate-pages
```

The validator checks:

- all 604 page records and their physical line-slot counts;
- the 226 reserved surah-heading/basmala slots;
- page and line ownership for every token;
- duplicate tokens and invalid Unicode replacement characters;
- increasing word order within each ayah;
- complete ayah coverage against the bundled SQLite Quran database;
- exactly one ayah-end marker per ayah.

The generator writes atomically only after every page has been fetched and checked. If a request fails or the source returns a corrupted token, the current dataset is left untouched.

## Quran Foundation API credentials

The generator supports the production Content API OAuth2 flow. Set these environment variables in the shell running the generator:

- `QF_CLIENT_ID`
- `QF_CLIENT_SECRET`
- `QF_ENV=production`

Never commit the client secret to this repository or put it inside the mobile app. The legacy public Quran.com endpoint is attempted only when Content API credentials are absent; if that endpoint is no longer available, use production credentials.

The GitHub Actions workflow also reads repository Actions secrets named `QF_CLIENT_ID` and `QF_CLIENT_SECRET` when they are configured. It then regenerates, validates, type-checks, and commits the dataset to `main`.

## Rendering rules

- Normal QCF V2 words use the font for their own page and `code_v2`.
- Ayah-end markers and Unicode special marks use the Uthmanic Hafs Unicode font and `text_qpc_hafs`.
- Surah headings and basmalas occupy the original empty physical line slots. The slot positions are derived from page/line metadata in the bundled SQLite database; a page break between a heading and its basmala is preserved.
- A failed page-font load does not make the line disappear. Unicode word text is used as a visible fallback and the failure is logged.