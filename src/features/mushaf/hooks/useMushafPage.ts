import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SQLiteDatabase } from 'expo-sqlite';
import { QuranRepository } from '../../../core/database/quranRepository';
import { PageInfo } from '../types/mushaf.types';

const LAST_PAGE_KEY = '@quran_last_page_read';

export function useMushafPage(db: SQLiteDatabase) {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Directly restore last read page on first mount before displaying
  useEffect(() => {
    let isMounted = true;

    async function initPage() {
      try {
        const saved = await AsyncStorage.getItem(LAST_PAGE_KEY);
        let targetPage = 1;
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (parsed >= 1 && parsed <= 604) {
            targetPage = parsed;
          }
        }
        if (isMounted) {
          setCurrentPage(targetPage);
          setIsInitialized(true);
        }
      } catch (e) {
        console.warn('Could not read saved page:', e);
        if (isMounted) {
          setIsInitialized(true);
        }
      }
    }

    initPage();
    return () => {
      isMounted = false;
    };
  }, []);

  const loadPage = useCallback(async (pageNumber: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const ayahs = await QuranRepository.getPageAyahs(db, pageNumber);
      if (ayahs.length > 0) {
        const primarySurahName = ayahs[0].sura_name_ar || '';
        const jozz = ayahs[0].jozz;
        setPageInfo({
          page: pageNumber,
          jozz,
          primarySurahName,
          ayahs,
        });
      } else {
        setPageInfo(null);
      }
      await AsyncStorage.setItem(LAST_PAGE_KEY, pageNumber.toString());
    } catch (err: any) {
      console.error('[useMushafPage] Error loading page:', err);
      setError(err?.message || 'فشل تحميل الصفحة');
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useEffect(() => {
    if (isInitialized) {
      loadPage(currentPage);
    }
  }, [currentPage, isInitialized, loadPage]);

  const goToPage = useCallback((targetPage: number) => {
    if (targetPage >= 1 && targetPage <= 604) {
      setCurrentPage(targetPage);
    }
  }, []);

  const nextPage = useCallback(() => {
    if (currentPage < 604) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [currentPage]);

  const prevPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  }, [currentPage]);

  return {
    currentPage,
    pageInfo,
    isLoading: !isInitialized || isLoading,
    error,
    goToPage,
    nextPage,
    prevPage,
  };
}
