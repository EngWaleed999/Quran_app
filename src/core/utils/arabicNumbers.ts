/**
 * Utility to convert English/Western Arabic numerals (0-9) to Eastern Arabic numerals (٠-٩).
 * Used extensively in the Quran reader for Ayah and Page numbering.
 */
export function toArabicNumerals(num: number | string): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).replace(/[0-9]/g, (digit) => arabicDigits[Number(digit)]);
}

