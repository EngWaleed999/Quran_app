import os
import sqlite3
import json
import re

def populate_mushaf_svg_pages():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    svg_dir = os.path.join(base_dir, 'quran_svg_1', 'svg')
    json_dir = os.path.join(base_dir, 'quran_svg_1', 'json')
    db_path = os.path.join(base_dir, 'assets', 'data', 'quran.db')

    print(f"[PopulateSvg] Base Directory: {base_dir}")
    print(f"[PopulateSvg] SVG Directory: {svg_dir}")
    print(f"[PopulateSvg] JSON Directory: {json_dir}")
    print(f"[PopulateSvg] Target Database: {db_path}")

    if not os.path.exists(db_path):
        raise FileNotFoundError(f"Missing quran.db at: {db_path}")
    if not os.path.exists(svg_dir) or not os.path.exists(json_dir):
        raise FileNotFoundError("Missing SVG or JSON source folders!")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Fast insertion pragmas
    cursor.execute("PRAGMA journal_mode = WAL")
    cursor.execute("PRAGMA synchronous = NORMAL")
    cursor.execute("PRAGMA page_size = 4096")

    # Ensure table exists
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS mushaf_svg_pages (
        page INTEGER PRIMARY KEY,
        view_box TEXT NOT NULL,
        svg_xml TEXT NOT NULL,
        raw_json TEXT NOT NULL
    );
    """)

    # Clean previous records
    cursor.execute("DELETE FROM mushaf_svg_pages")
    conn.commit()

    rows = []
    print("[PopulateSvg] Reading and preprocessing 604 SVG & JSON files...")

    for p in range(1, 605):
        fname = f'{p:03d}'
        svg_file = os.path.join(svg_dir, f'{fname}.svg')
        json_file = os.path.join(json_dir, f'{fname}.json')

        if not os.path.exists(svg_file) or not os.path.exists(json_file):
            conn.close()
            raise FileNotFoundError(f"Missing page {p} SVG or JSON file!")

        with open(svg_file, 'r', encoding='utf-8') as f:
            svg_content = f.read()
        with open(json_file, 'r', encoding='utf-8') as f:
            json_content = f.read()

        # Validate JSON parseability
        parsed_json = json.loads(json_content)
        if not isinstance(parsed_json, list) or len(parsed_json) == 0:
            conn.close()
            raise ValueError(f"Page {p} JSON is empty or invalid!")

        # Apply viewBox and title optimizations for Pages 1 and 2
        if p == 1:
            view_box = "-10 8 258 220"
            # Remove unboxed floating calligraphy title outside the frame
            svg_content = re.sub(
                r'<g><path fill="#231f20" fill-rule="evenodd" d="[^"]+" transform="translate\(197\.29 406\.52\)"\/><\/g>',
                '',
                svg_content
            )
            svg_content = re.sub(r'viewBox="[^"]+"', f'viewBox="{view_box}"', svg_content)
        elif p == 2:
            view_box = "-10 32 258 200"
            # Remove unboxed floating calligraphy title outside the frame
            svg_content = re.sub(
                r'<g><path fill="#231f20" fill-rule="evenodd" d="[^"]+" transform="translate\(191\.3 407\.03\)"\/><\/g>',
                '',
                svg_content
            )
            svg_content = re.sub(r'viewBox="[^"]+"', f'viewBox="{view_box}"', svg_content)
        else:
            vb_match = re.search(r'viewBox="([^"]+)"', svg_content)
            view_box = vb_match.group(1) if vb_match else "0 0 345 550"

        rows.append((p, view_box, svg_content, json_content))

    print(f"[PopulateSvg] Inserting {len(rows)} pages into mushaf_svg_pages...")
    cursor.executemany(
        "INSERT INTO mushaf_svg_pages (page, view_box, svg_xml, raw_json) VALUES (?, ?, ?, ?)",
        rows
    )
    conn.commit()

    # Integrity check
    cursor.execute("PRAGMA integrity_check")
    integ = cursor.fetchone()[0]
    if integ != 'ok':
        conn.close()
        raise RuntimeError(f"Database integrity check failed: {integ}")
    print(f"[PopulateSvg] PRAGMA integrity_check: {integ}")

    # Compact database
    print("[PopulateSvg] Running VACUUM...")
    cursor.execute("VACUUM")
    conn.close()

    final_size_mb = os.path.getsize(db_path) / (1024 * 1024)
    print(f"[PopulateSvg] SUCCESS: {len(rows)} pages inserted into {db_path}. Total size: {final_size_mb:.2f} MB")

if __name__ == '__main__':
    populate_mushaf_svg_pages()
