# Original User Request

## Initial Request — 2026-11-04T20:27:21Z

This is a single self-contained fix; keep it small and focused.
Fix the Quran page data generation pipeline and regenerate `assets/data/qcf_v2_pages.json` for all 604 pages so that all pages match the authentic Medina Mushaf layout without shrunk lines, fallback font characters, faded signs, or question marks (？？).

Integrity mode: development

Reference: `src/features/mushaf/components/MushafPageItem.tsx` (review page line rendering and layout consumption to ensure compatibility and identify any rendering improvements).

## Requirements

### R1. Fix Page Data Generation Pipeline
Update `scripts/build-qcf-v2-pages.js` so that when fetching verse words from the Quran API (`https://api.quran.com/api/v4/verses/by_page/{page}`), only words that strictly belong to the target page (`w.page_number === pageNumber`) are collected into the page lines. Ensure that previously cached corrupted pages are invalidated and that all 604 pages are reliably fetched and generated.

### R2. Complete and Pristine Medina Mushaf Dataset
Generate the complete `assets/data/qcf_v2_pages.json` containing authentic Medina Mushaf line data for all 604 pages:
- All pages from 1 to 604 must be present and populated.
- No line may contain words leaked from preceding or succeeding pages, duplicate words from boundary verse overlap, or out-of-range glyphs causing fallback letters or question marks.
- Review `src/features/mushaf/components/MushafPageItem.tsx` to verify that generated page lines render cleanly without unnatural font shrinking or layout discrepancies, applying any necessary component refinements if needed.

### R3. Automated Verification and Code Quality
Provide and execute an automated validation script that inspects `assets/data/qcf_v2_pages.json` across all 604 pages to verify data integrity (no page-boundary leaks, valid line counts, and valid QCF V2 glyph codes). Ensure the project passes TypeScript checks and linting.

## Acceptance Criteria

### Data Integrity & Mushaf Layout
- [ ] `assets/data/qcf_v2_pages.json` contains valid entries for all 604 pages.
- [ ] For every page and line in `assets/data/qcf_v2_pages.json`, all word tokens belong strictly to that page with zero words leaked from adjacent pages.
- [ ] No line contains duplicated words resulting from boundary verse overlap.
- [ ] Each page adheres to the authentic Medina Mushaf line structure (standard 15 lines per page, with opening surah layouts matching Mushaf structure).
- [ ] All glyph tokens in `assets/data/qcf_v2_pages.json` use valid QCF V2 character ranges for their respective page font so no question marks, faded signs, or fallback alphabet characters render.

### Code Quality & Verification
- [ ] An automated validation script executes and passes, programmatically verifying that all 604 pages have zero page-number mismatch violations and proper line counts.
- [ ] `src/features/mushaf/components/MushafPageItem.tsx` has been reviewed and verified against the generated data to prevent line shrinking or layout shifts.
- [ ] `npx tsc --noEmit` passes with 0 errors.
- [ ] `npx expo lint` passes with 0 errors.

