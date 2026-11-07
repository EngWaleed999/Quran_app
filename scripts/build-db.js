// Intentionally disabled.
//
// The former script deleted assets/data/quran.db and rebuilt only the
// surahs/ayahs tables from a machine-specific absolute path. That could destroy
// the only complete 604-page SVG + tafsir database. Use:
//   pnpm db:backup
//   pnpm db:analyze
//   pnpm db:prepare
//
// The new workflow never deletes or overwrites the source database.
console.error(
  'This destructive legacy database builder has been disabled. ' +
  'Use pnpm db:backup, pnpm db:analyze, and pnpm db:prepare instead.'
);
process.exitCode = 1;
