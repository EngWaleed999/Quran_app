import type {
  DhikrItem,
  DhikrItemWithState,
  AdhkarCategoryInfo,
  RawAdhkarCategory,
} from '../types/adhkar.types';

/**
 * بناء معرّف فريد لا يتكرر عبر كل الأقسام
 * يمنع مشكلة تصادم المعرفات (ID Collisions) حيث تبدأ كل مصفوفة بـ id = 1
 */
export function buildDhikrId(categoryId: number, itemId: number): string {
  return `${categoryId}_${itemId}`;
}

/**
 * تحديد أيقونة مناسبة لكل قسم بناءً على عنوانه
 */
export function getCategoryIcon(title: string): string {
  if (title.includes('الصباح') || title.includes('المساء')) return 'weather-sunset';
  if (title.includes('النوم') || title.includes('الاستيقاظ')) return 'bed-clock';
  if (title.includes('الصلاة') || title.includes('الركوع') || title.includes('السجود') || title.includes('التشهد')) return 'hands-pray';
  if (title.includes('الأذان') || title.includes('المسجد')) return 'mosque';
  if (title.includes('الوضوء')) return 'water-outline';
  if (title.includes('الطعام')) return 'silverware-fork-knife';
  if (title.includes('رمضان')) return 'star-crescent';
  if (title.includes('السفر')) return 'airplane';
  if (title.includes('الثوب')) return 'tshirt-crew-outline';
  if (title.includes('الخلاء')) return 'door';
  if (title.includes('القرآن')) return 'book-open-page-variant';
  if (title.includes('الوتر')) return 'weather-night';
  if (title.includes('الهم') || title.includes('الكرب') || title.includes('الغضب') || title.includes('القلق')) return 'heart-pulse';
  if (title.includes('الاستغفار') || title.includes('التسبيح') || title.includes('التهليل')) return 'counter';
  return 'hands-pray';
}

/**
 * تفكيك وتسطيح البيانات الخام القادمة من adhkar_filtered.json
 */
export function parseRawAdhkar(rawCategories: RawAdhkarCategory[]): DhikrItem[] {
  const items: DhikrItem[] = [];

  for (const cat of rawCategories) {
    if (!cat || !cat.category || !Array.isArray(cat.array)) continue;

    for (const rawItem of cat.array) {
      if (!rawItem || !rawItem.text) continue;

      items.push({
        id: buildDhikrId(cat.id, rawItem.id),
        rawId: rawItem.id,
        categoryId: cat.id,
        categoryTitle: cat.category.trim(),
        text: rawItem.text.trim(),
        count: Number(rawItem.count) > 0 ? Number(rawItem.count) : 1,
        audio: rawItem.audio ?? undefined,
        filename: rawItem.filename ?? undefined,
      });
    }
  }

  return items;
}

/**
 * الترتيب المحكم: تطفو الأدعية المفضلة في بداية القائمة دائماً،
 * مع الحفاظ على الترتيب الأصلي المستقر لكل مجموعة (Stable Sort).
 */
export function sortAdhkarWithFavorites(
  items: DhikrItem[],
  favoritesSet: Set<string>
): DhikrItemWithState[] {
  const mapped: DhikrItemWithState[] = items.map((item) => ({
    ...item,
    isFavorite: favoritesSet.has(item.id),
  }));

  // Stable sort: Favorite items first (-1), non-favorites second (+1)
  return mapped.sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    return 0;
  });
}

/**
 * تصفية الأذكار حسب الفئة والبحث النصي مع الحفاظ على قاعدة تقدم المفضلات
 */
export function filterAdhkar(
  items: DhikrItemWithState[],
  selectedCategory: string,
  searchQuery = ''
): DhikrItemWithState[] {
  let result = items;

  // 1. تصفية الفئة
  if (selectedCategory === 'favorites') {
    result = result.filter((item) => item.isFavorite);
  } else if (selectedCategory !== 'all') {
    result = result.filter((item) => item.categoryTitle === selectedCategory);
  }

  // 2. تصفية البحث إن وُجد
  const query = searchQuery.trim().toLowerCase();
  if (query) {
    result = result.filter(
      (item) =>
        item.text.toLowerCase().includes(query) ||
        item.categoryTitle.toLowerCase().includes(query)
    );
  }

  return result;
}

/**
 * استخراج قائمة الأقسام مع دمج الفئات المتشابهة بالاسم وتثبيت (الكل والمفضلة) في البداية
 */
export function extractCategories(
  items: DhikrItem[],
  favoritesCount: number
): AdhkarCategoryInfo[] {
  const categoryMap = new Map<string, number>();

  for (const item of items) {
    const currentCount = categoryMap.get(item.categoryTitle) ?? 0;
    categoryMap.set(item.categoryTitle, currentCount + 1);
  }

  const dynamicCategories: AdhkarCategoryInfo[] = Array.from(categoryMap.entries()).map(
    ([title, count]) => ({
      id: title,
      title,
      count,
      icon: getCategoryIcon(title),
    })
  );

  return [
    {
      id: 'all',
      title: 'الكل',
      count: items.length,
      icon: 'apps',
    },
    {
      id: 'favorites',
      title: 'المفضلة',
      count: favoritesCount,
      icon: 'heart',
    },
    ...dynamicCategories,
  ];
}

/**
 * مدة الصلاحية التلقائية لحالة اكتمال العداد: 90 دقيقة (ساعة ونصف)
 * تعطي وقتاً كافياً بعد الصلاة لرؤية الإنجاز، ثم تتصفر تلقائياً قبل الصلاة التالية.
 */
export const COUNTER_AUTO_RESET_TTL_MS = 90 * 60 * 1000;

export interface CounterState {
  count: number;
  completedAt: number | null;
  lastUpdatedAt: number;
}

/**
 * فحص ما إذا تغير اليوم التقويمي بالاعتماد على التوقيت المحلي
 */
export function isDayChanged(
  lastTimestamp: number,
  currentTimestamp: number = Date.now()
): boolean {
  const lastDate = new Date(lastTimestamp);
  const currentDate = new Date(currentTimestamp);
  return (
    lastDate.getFullYear() !== currentDate.getFullYear() ||
    lastDate.getMonth() !== currentDate.getMonth() ||
    lastDate.getDate() !== currentDate.getDate()
  );
}

/**
 * فحص ما إذا كان يجب تصفير العداد تلقائياً (تغير اليوم أو انتهاء مهلة الـ 90 دقيقة)
 */
export function shouldResetCounter(
  counter: CounterState,
  now: number = Date.now(),
  ttlMs: number = COUNTER_AUTO_RESET_TTL_MS
): boolean {
  if (counter.count <= 0) return false;
  // 1. إذا تغير اليوم التقويمي، يتصفر فوراً لليوم الجديد
  if (isDayChanged(counter.lastUpdatedAt, now)) return true;
  // 2. إذا اكتمل الذكر وانتهت مهلة الـ TTL
  if (counter.completedAt !== null && now - counter.completedAt >= ttlMs) {
    return true;
  }
  return false;
}

/**
 * حساب قيمة العداد التالية مع دعم استئناف جولة جديدة عند النقر على ذكر مكتمل
 */
export function computeNextCounter(
  current: CounterState,
  maxCount: number,
  now: number = Date.now()
): { state: CounterState; isNewRound: boolean; isJustCompleted: boolean } {
  // إذا اكتمل العداد سابقاً ونقر عليه المستخدم مجدداً، نبدأ جولة جديدة تبدأ من 1
  if (current.count >= maxCount) {
    const isSingle = maxCount === 1;
    return {
      state: {
        count: 1,
        completedAt: isSingle ? now : null,
        lastUpdatedAt: now,
      },
      isNewRound: true,
      isJustCompleted: isSingle,
    };
  }

  const nextCount = current.count + 1;
  const isJustCompleted = nextCount >= maxCount;

  return {
    state: {
      count: nextCount,
      completedAt: isJustCompleted ? now : null,
      lastUpdatedAt: now,
    },
    isNewRound: false,
    isJustCompleted,
  };
}

