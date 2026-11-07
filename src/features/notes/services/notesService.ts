import { SQLiteDatabase } from 'expo-sqlite';
import { AyahNote } from '../types/note.types';

interface AyahNoteRow {
  verse_key: string;
  sura_no: number;
  aya_no: number;
  page: number;
  sura_name: string;
  ayah_text: string;
  note_text: string;
  created_at: number;
  updated_at: number;
}

function mapRow(row: AyahNoteRow): AyahNote {
  return {
    verseKey: row.verse_key,
    suraNo: row.sura_no,
    ayaNo: row.aya_no,
    page: row.page,
    suraName: row.sura_name,
    ayahText: row.ayah_text,
    noteText: row.note_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class NotesService {
  static async getAll(db: SQLiteDatabase): Promise<AyahNote[]> {
    const rows = await db.getAllAsync<AyahNoteRow>(
      'SELECT * FROM ayah_notes ORDER BY updated_at DESC'
    );
    return rows.map(mapRow);
  }

  static async getByVerseKey(
    db: SQLiteDatabase,
    verseKey: string
  ): Promise<AyahNote | null> {
    const row = await db.getFirstAsync<AyahNoteRow>(
      'SELECT * FROM ayah_notes WHERE verse_key = ?',
      [verseKey]
    );
    return row ? mapRow(row) : null;
  }

  static async save(
    db: SQLiteDatabase,
    input: Omit<AyahNote, 'createdAt' | 'updatedAt'> & {
      createdAt?: number;
    }
  ): Promise<void> {
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO ayah_notes (
        verse_key, sura_no, aya_no, page, sura_name, ayah_text,
        note_text, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(verse_key) DO UPDATE SET
        sura_no = excluded.sura_no,
        aya_no = excluded.aya_no,
        page = excluded.page,
        sura_name = excluded.sura_name,
        ayah_text = excluded.ayah_text,
        note_text = excluded.note_text,
        updated_at = excluded.updated_at`,
      [
        input.verseKey,
        input.suraNo,
        input.ayaNo,
        input.page,
        input.suraName,
        input.ayahText,
        input.noteText.trim(),
        input.createdAt ?? now,
        now,
      ]
    );
  }

  static async delete(db: SQLiteDatabase, verseKey: string): Promise<void> {
    await db.runAsync('DELETE FROM ayah_notes WHERE verse_key = ?', [verseKey]);
  }
}
