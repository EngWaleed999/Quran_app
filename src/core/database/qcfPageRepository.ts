import { SQLiteDatabase } from 'expo-sqlite';

export interface QcfPageToken {
  renderMode: 'qcf' | 'unicode';
  text: string;
  fallbackText: string | null;
  charTypeName: string;
  verseKey: string;
  position: number;
  pageNumber: number;
  lineNumber: number;
}

type QcfPhysicalLine = QcfPageToken[] | null;

interface QcfDataset {
  schemaVersion: number;
  mushafId: number;
  pageCount: number;
  pages: Record<string, QcfPhysicalLine[]>;
}

export type QcfPageRow =
  | { type: 'line'; tokens: QcfPageToken[] }
  | { type: 'surah'; suraNo: number; suraName: string }
  | { type: 'basmala' }
  | { type: 'blank' };

const qcfDataset = require('../../../assets/data/qcf_v2_pages.json') as QcfDataset;

export class QcfPageRepository {
  private static cachedPageRows = new Map<number, QcfPageRow[]>();
  private static layoutBuilt = false;

  private static getPages(): Record<string, QcfPhysicalLine[]> {
    // The generator writes the versioned object format. Keep this check explicit
    // so an old, incompatible string-only dataset cannot silently render garbage.
    if (
      qcfDataset.schemaVersion !== 2 ||
      qcfDataset.mushafId !== 1 ||
      !qcfDataset.pages ||
      qcfDataset.pageCount !== 604
    ) {
      throw new Error(
        '[QcfPageRepository] Unsupported QCF dataset. Run "npm run quran:build-pages" first.'
      );
    }

    return qcfDataset.pages;
  }

  /**
   * Build all 604 pages once. Empty QCF line slots are meaningful: they are
   * reserved for surah headings and basmalas, including headings crossing a page.
   */
  private static buildLayout(db: SQLiteDatabase): void {
    if (QcfPageRepository.layoutBuilt) return;

    const pages = QcfPageRepository.getPages();
    const offsets = new Map<number, number>();
    const emptySlots: Array<{ page: number; lineNumber: number; absolute: number }> = [];
    let absoluteOffset = 0;

    for (let page = 1; page <= 604; page += 1) {
      const lines = pages[String(page)];
      const expectedCount = page <= 2 ? 8 : 15;

      if (!Array.isArray(lines) || lines.length !== expectedCount) {
        throw new Error(
          '[QcfPageRepository] Page ' + page + ' must contain ' +
          expectedCount + ' physical line slots.'
        );
      }

      offsets.set(page, absoluteOffset);

      lines.forEach((line, index) => {
        if (line === null) {
          emptySlots.push({
            page,
            lineNumber: index + 1,
            absolute: absoluteOffset + index,
          });
        } else if (!Array.isArray(line) || line.length === 0) {
          throw new Error(
            '[QcfPageRepository] Page ' + page + ', line ' + (index + 1) +
            ' is neither a token list nor a reserved empty slot.'
          );
        }
      });

      absoluteOffset += lines.length;
    }

    const surahStarts = db.getAllSync<{
      sura_no: number;
      sura_name_ar: string;
      page: number;
      line_start: number | null;
    }>(
      `SELECT a.sura_no, s.sura_name_ar, a.page, a.line_start
       FROM ayahs a
       JOIN surahs s ON s.sura_no = a.sura_no
       WHERE a.aya_no = 1
       ORDER BY a.page ASC, a.line_start ASC, a.sura_no ASC`
    );

    const headingBySlot = new Map<string, QcfPageRow>();
    let previousSurahStart = -1;

    for (const surah of surahStarts) {
      const pageOffset = offsets.get(surah.page);
      const lineStart = Number(surah.line_start);

      if (
        pageOffset === undefined ||
        !Number.isInteger(lineStart) ||
        lineStart < 1 ||
        lineStart > (surah.page <= 2 ? 8 : 15)
      ) {
        console.warn(
          '[QcfPageRepository] Cannot position surah heading for surah ' +
          surah.sura_no + '; invalid page/line metadata.'
        );
        continue;
      }

      const firstAyahAbsolute = pageOffset + lineStart - 1;
      const requiredSlots = surah.sura_no === 1 || surah.sura_no === 9 ? 1 : 2;
      const candidates = emptySlots.filter(
        (slot) =>
          slot.absolute > previousSurahStart &&
          slot.absolute < firstAyahAbsolute &&
          !headingBySlot.has(slot.page + ':' + slot.lineNumber)
      );

      if (candidates.length < requiredSlots) {
        console.warn(
          '[QcfPageRepository] Not enough reserved heading slots before surah ' +
          surah.sura_no + '. Preserving blank slots rather than shifting Quran text.'
        );
        previousSurahStart = firstAyahAbsolute;
        continue;
      }

      const selected = candidates.slice(-requiredSlots);

      if (requiredSlots === 1) {
        const slot = selected[0];
        headingBySlot.set(slot.page + ':' + slot.lineNumber, {
          type: 'surah',
          suraNo: surah.sura_no,
          suraName: surah.sura_name_ar,
        });
      } else {
        const nameSlot = selected[0];
        const basmalaSlot = selected[1];

        headingBySlot.set(nameSlot.page + ':' + nameSlot.lineNumber, {
          type: 'surah',
          suraNo: surah.sura_no,
          suraName: surah.sura_name_ar,
        });
        headingBySlot.set(basmalaSlot.page + ':' + basmalaSlot.lineNumber, {
          type: 'basmala',
        });
      }

      previousSurahStart = firstAyahAbsolute;
    }

    // Never remove an unassigned blank line: doing so would move every line below it.
    for (let page = 1; page <= 604; page += 1) {
      const lines = pages[String(page)];
      const rows: QcfPageRow[] = lines.map((line, index) => {
        if (line !== null) {
          return { type: 'line', tokens: line };
        }

        return (
          headingBySlot.get(page + ':' + (index + 1)) ??
          { type: 'blank' }
        );
      });

      QcfPageRepository.cachedPageRows.set(page, rows);
    }

    QcfPageRepository.layoutBuilt = true;
  }

  static getPageRows(db: SQLiteDatabase, page: number): QcfPageRow[] {
    if (!Number.isInteger(page) || page < 1 || page > 604) return [];

    if (!QcfPageRepository.layoutBuilt) {
      QcfPageRepository.buildLayout(db);
    }

    return QcfPageRepository.cachedPageRows.get(page) ?? [];
  }
}
