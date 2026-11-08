import { create } from 'zustand';

interface FontLoadingState {
  loaded: boolean;
}

export const useFontLoadingStore = create<FontLoadingState>(() => ({
  loaded: false,
}));
