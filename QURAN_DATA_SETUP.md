# Quran database: backup, validation, and EAS builds

## Why the full database is not committed to Git

The complete offline database is a build asset, not source code. The full file contains the canonical Quran text, 604 Mushaf SVG pages, coordinate metadata, and Saadi tafsir. Keep it outside Git history.

GitHub blocks normal Git files larger than 100 MiB and recommends using a file-sharing service for databases or Releases for large downloadable binaries. The repository therefore keeps the full database out of commits.

The build expects this local/generated path:

`assets/data/quran-full.db`

It is ignored by Git. Do not delete your existing `assets/data/quran.db` while setting this up.

## 1. Make a verified backup first

Close Expo/the app before running database maintenance.

```sh
pnpm db:backup
```

This creates a timestamped, standalone SQLite snapshot in `backups/` using `VACUUM INTO`. The original database is not deleted or overwritten. Copy the backup to another physical device or cloud storage as well; a backup on the same disk is not sufficient protection against disk failure.

## 2. Inspect the current database

```sh
pnpm db:analyze
```

The report includes SQLite page allocation, free pages, table sizes (when SQLite's dbstat module is available), SVG/XML payload, coordinate JSON payload, and tafsir text totals.

Do not run `VACUUM` or rebuild tables blindly. First inspect which tables consume the space. The 120 MB figure alone does not reveal whether the cause is SVG markup, duplicated coordinate JSON, indexes, or free pages.

## 3. Prepare a local development asset

Put your verified full database at:

`assets/data/quran.db`

Then run:

```sh
pnpm db:prepare
pnpm start
```

The preparation script validates SQLite integrity and required data:
- 114 surahs;
- 6,236 ayahs;
- exactly 604 distinct SVG pages (1–604);
- non-empty Saadi tafsir records.

It copies the source to `assets/data/quran-full.db` without changing or deleting `quran.db`. The normal `pnpm start`, `pnpm android`, and `pnpm ios` scripts run the preparation check first.

## 4. Configure cloud APK builds

Upload the full `quran.db` once as a binary asset. A GitHub Release asset is suitable; Cloudflare R2 or another HTTPS object store also works. Do not upload it as a regular Git file and do not commit it through Git LFS as the first choice.

For a public GitHub Release asset, use its direct browser download URL, for example:

`https://github.com/OWNER/REPOSITORY/releases/download/quran-data-v1/quran.db`

Calculate the SHA-256 locally:

**PowerShell**
```powershell
(Get-FileHash .\quran.db -Algorithm SHA256).Hash.ToLower()
```

**macOS/Linux**
```sh
sha256sum quran.db
```

In Expo dashboard → Project → Environment variables, add these variables to both the `preview` and `production` environments:

- `QURAN_DB_URL`: direct HTTPS download URL of the full database;
- `QURAN_DB_SHA256`: the 64-character SHA-256 digest.

Keep the URL and digest together. For a private object store, use a read-only signed URL and rotate it when needed. These values are used only by the build hook; they are not prefixed with `EXPO_PUBLIC_` and are not bundled into the app.

The `eas-build-post-install` hook downloads the database to `assets/data/quran-full.db`, checks the checksum and SQLite integrity, validates the 604 pages and tafsir, and then lets Metro bundle the database. It fails the build rather than silently packaging the old 4 MB placeholder.

To create an Android APK, choose the `preview` profile (or `production`):

```sh
eas build --platform android --profile preview
```

## 5. Database migrations and user data

The app schema now uses a versioned migration ledger. Migrations are applied transactionally and only alter app-owned tables such as notes and Khatmah plans. They do not recreate or delete the canonical Quran tables.

The bundled database is copied into the app's private SQLite directory only on first installation (`forceOverwrite: false`). App updates therefore do not replace the installed database and cannot wipe the user's notes or Khatmah records. The migration ledger applies schema changes in place.

## 6. About reducing the 120 MB size

The preparation workflow intentionally does not mutate or compress the master database. First run `pnpm db:analyze` and review the output. If most of the size is in `svg_xml` or `raw_json`, we can test a compressed representation against five sample pages and benchmark memory/CPU before deciding whether to change the on-device format. If most of the size is free SQLite pages, a separate `VACUUM INTO` copy may shrink it without changing the schema. Never test optimization on the only copy.
