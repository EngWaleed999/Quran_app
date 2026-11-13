export interface DhikrItem {
  id: string; // Unique composite identifier: `${categoryId}_${itemId}`
  rawId: number;
  categoryId: number;
  categoryTitle: string;
  text: string;
  count: number;
  audio?: string;
  filename?: string;
}

export interface DhikrItemWithState extends DhikrItem {
  isFavorite: boolean;
}

export interface AdhkarCategoryInfo {
  id: string;
  title: string;
  count: number;
  icon: string;
}

export interface RawAdhkarItem {
  id: number;
  text: string;
  count: number;
  audio?: string;
  filename?: string;
}

export interface RawAdhkarCategory {
  id: number;
  category: string;
  array: RawAdhkarItem[];
}
