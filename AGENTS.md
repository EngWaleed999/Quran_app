This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Incremental Feature-First Delivery (مبدأ التنفيذ التدريجي حبة حبة)
- عند العمل على ميزة جديدة، لا تبدأ في ميزات أخرى بالتوازي مهما كانت في الخطة العامة.
- ركّز بنسبة 100% على الشريحة المحددة حالياً (مثلاً: إتقان عرض المصحف للقراءة).
- اختبر الميزة بدقة وتأكد من عملها بدون أخطاء، وخذ تأكيد المستخدم قبل الانتقال للميزة التالية (الصوت، البحث، الفهرس، إلخ).

## Architectural & Engineering Guardrails (القواعد الهندسية والمعمارية)
- **Zero Layout Shifts (Floating Overlays)**: عند إظهار أو إخفاء عناصر التحكم (Header/Bottom Bar) في وضع ملء الشاشة، يجب أن تظهر كـ Floating Overlay عائم (`position: 'absolute'`). يُمنع تعديل أبعاد أو ارتفاع حاوية القراءة أو حجم الخط نهائياً عند إظهار أو إخفاء أدوات التحكم لضمان ثبات النص تماماً دون أي اهتزاز (Zero Layout Shift).
- **Gesture Disambiguation (Swipe vs Tap)**: التمرير الأفقي بين الصفحات مخصص حصراً للتصفح والتقليب، ويجب ألا يغير حالة ملء الشاشة نهائياً إلا عند النقر المباشر الثابت المستقر ($\Delta < 10\text{px}$).
- **Ecosystem-First & Expo Docs**: في أي مسألة معقدة (مثل ضبط النصوص عبر الشاشات المختلفة، إدارة الإيماءات، أو الصوتيات)، ابحث دائماً في Expo Docs والمكتبات القياسية المعتمدة ولا تبنِ الحلول من الصفر بحسابات معقدة قابلة للهشاشة.
- **Strict DRY**: أي كود أو منطق أو تصميم يتكرر أكثر من مرة يجب استخراجه فوراً كـ Shared Module.
- **Universal Subtle Highlight**: لون التظليل للآيات المعتمد هو ذهبي/زمردي شفاف وخفيف جداً `rgba(197, 155, 39, 0.16)` يعمل بوضوح متناسق في الثيم الفاتح والداكن دون حجب النص.
- **Full-Screen Immersion**: عند إخفاء أزرار التحكم (التالية/السابقة)، يجب أن يظل اسم السورة ورقم الصفحة ظاهراً بوضوح وهدوء في أعلى وأسفل الصفحة، مع حركات انتقالية انسيابية (Smooth 60fps Animation).
- **Critical Technical Partnership**: التدقيق والمناقشة الصريحة لكل فكرة، واقتراح الحل الأبسط والأنظف والأقل استهلاكاً للذاكرة والـ CPU لدعم الهواتف الاقتصادية.


