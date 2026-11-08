import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppearanceMode } from './theme';

interface AppPreferencesState {
  appearance: AppearanceMode;
  setAppearance: (appearance: AppearanceMode) => void;
}

export const useAppPreferences = create<AppPreferencesState>()(
  persist(
    (set) => ({
      appearance: 'classic',
      setAppearance: (appearance) => set({ appearance }),
    }),
    {
      name: 'quran-app-preferences',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ appearance: state.appearance }),
    }
  )
);
