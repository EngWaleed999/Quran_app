import { SQLiteDatabase } from 'expo-sqlite';

// Static in-memory QCF V2 layout data provider for all 604 Medina Mushaf pages
const qcfPagesRaw: Record<string, string[]> = require('../../../assets/data/qcf_v2_pages.json');

export interface QcfPageRow {
  type: 'banner' | 'line';
  text?: string;
  suraNo?: number;
  suraName?: string;
}

export class QcfPageRepository {
  private static cachedPageRows = new Map<number, QcfPageRow[]>();

  /**
   * Retrieves the raw pre-calculated lines array for a given page (1 to 604).
   */
  static getPageLines(page: number): string[] {
    const key = page.toString();
    return qcfPagesRaw[key] || [];
  }

  /**
   * Builds the exact 15-row layout grid for any page (1 to 604) in the Medina Mushaf,
   * placing Surah Banners, Basmalas, and text lines in their authentic physical positions.
   * Results are memoized in memory for instantaneous O(1) performance.
   */
  static getPageRows(db: SQLiteDatabase, page: number): QcfPageRow[] {
    if (QcfPageRepository.cachedPageRows.has(page)) {
      return QcfPageRepository.cachedPageRows.get(page)!;
    }

    const textLines = QcfPageRepository.getPageLines(page);

    // Retrieve surahs that start on this specific page (aya_no = 1)
    let surahs: { sura_no: number; sura_name_ar: string; line_start: number }[] = [];
    try {
      surahs = db.getAllSync<{ sura_no: number; sura_name_ar: string; line_start: number }>(
        `SELECT a.sura_no, s.sura_name_ar, a.line_start 
         FROM ayahs a 
         JOIN surahs s ON a.sura_no = s.sura_no 
         WHERE a.page = ? AND a.aya_no = 1 
         ORDER BY a.line_start ASC`,
        [page]
      );
    } catch {
      surahs = [];
    }

    if (surahs.length === 0) {
      const rows: QcfPageRow[] = textLines.map((t) => ({ type: 'line', text: t }));
      QcfPageRepository.cachedPageRows.set(page, rows);
      return rows;
    }

    const rows: QcfPageRow[] = [];
    let textIndex = 0;

    // Special opening page: Al-Fatihah
    if (page === 1) {
      rows.push({ type: 'banner', suraNo: 1, suraName: 'الفَاتِحة' });
      while (textIndex < textLines.length) {
        rows.push({ type: 'line', text: textLines[textIndex++] });
      }
      QcfPageRepository.cachedPageRows.set(page, rows);
      return rows;
    }

    for (let physicalLine = 1; physicalLine <= 15; physicalLine++) {
      const surahAtLine = surahs.find((s) => {
        const bannerTargetLine = s.sura_no === 9 ? s.line_start - 1 : s.line_start - 2;
        return bannerTargetLine === physicalLine;
      });

      if (surahAtLine) {
        rows.push({
          type: 'banner',
          suraNo: surahAtLine.sura_no,
          suraName: surahAtLine.sura_name_ar,
        });
        // Skip ahead by banner height equivalent (At-Tawbah has no Basmala so 1 unit, others 2)
        physicalLine += surahAtLine.sura_no === 9 ? 0 : 1;
      } else if (textIndex < textLines.length) {
        rows.push({ type: 'line', text: textLines[textIndex++] });
      }
    }

    // Append any trailing text lines if any remain
    while (textIndex < textLines.length) {
      rows.push({ type: 'line', text: textLines[textIndex++] });
    }

    QcfPageRepository.cachedPageRows.set(page, rows);
    return rows;
  }
}
