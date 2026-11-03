Enhance the Quran mobile application (Expo SDK 58 / React Native) with smooth horizontal swipe page navigation using react-native-pager-view, balanced margins and padding to prevent character clipping in Uthmani script, and correct RTL alignment ensuring the last line terminates on the right, while strictly adhering to Clean Code and SOLID principles without unnecessary loading screens.

Working directory: d:\Quran_App
Integrity mode: development

## Requirements

### R1. Horizontal Swipe Page Navigation
Implement smooth horizontal swipe between Quran pages using `react-native-pager-view` compatible with Expo Go. Quran pages must transition according to standard Arabic reading direction (swiping from right to left advances to the next page, e.g. from page 1 to 2; swiping from left to right returns to the previous page). Retain the next and previous navigation buttons in the bottom bar as an auxiliary navigation control synchronized with the pager state.

### R2. Page Margins and Character Clipping Prevention
Add balanced lateral padding and margins around the page container to prevent Arabic Uthmani calligraphy characters, diacritics, and extended ligatures (kashida) from being cut off or clipped at the right and left edges of the screen across all page views.

### R3. Arabic Typography and RTL Last Line Alignment
Ensure Arabic text layout complies with right-to-left typographic rules such that the final line of any paragraph or page terminates at the right side (RTL alignment) rather than justifying or ending on the left, maintaining this correct alignment across text zoom levels and font size scaling.

### R4. Architectural and Clean Code Constraints
Adhere strictly to SOLID principles and Clean Code: keep component files concise, well-structured, and free of redundant or misplaced logic. Do not add landing pages, loading spinners, or blocking loading screens unless explicitly requested.

## Acceptance Criteria

### Navigation & Gestures
- [ ] Swiping horizontally between pages transitions smoothly without flickering, lag, or abrupt visual jumps.
- [ ] Swiping from right to left advances to the next page (e.g. from page 1 to page 2), and swiping from left to right returns to the previous page.
- [ ] The bottom bar next and previous buttons remain functional and stay synchronized with the active page displayed by the pager.

### Typography & Layout
- [ ] Arabic glyphs, diacritics, and ligatures in King Fahd HafsSmart font display fully with balanced margins, without touching or getting cut off by the left or right edges of the screen.
- [ ] The final line of Arabic text on any page terminates on the right (RTL alignment) regardless of font size scaling.

### Code Quality & Stability
- [ ] TypeScript compilation (`npx tsc --noEmit`) passes with zero errors.
- [ ] No unrequested landing pages, splash screens, or loading spinners are added to the application flow.
