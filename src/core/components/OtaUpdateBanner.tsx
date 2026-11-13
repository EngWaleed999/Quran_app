import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import * as Updates from 'expo-updates';
import { useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText as Text } from '../theme/components/AppText';
import { QuranColors } from '../theme/theme';

type UpdateStatus = 'idle' | 'available' | 'downloading' | 'ready';

export const OtaUpdateBanner: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const slideAnim = useRef(new Animated.Value(-120)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // التحقق التلقائي في وضع الإنتاج فقط مع تفعيل expo-updates
    if (__DEV__ || !Updates.isEnabled) {
      return;
    }

    let isMounted = true;

    async function checkUpdate() {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (isMounted && check.isAvailable) {
          setStatus('available');
        }
      } catch (err) {
        // الفشل الصامت عند انقطاع الإنترنت أو عدم توفر الشبكة
        console.log('[OtaUpdateBanner] Check update failed:', err);
      }
    }

    // فحص خفيف بعد استقرار الواجهة بثانية ونصف
    const timer = setTimeout(() => {
      void checkUpdate();
    }, 1500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (status !== 'idle') {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 60,
        friction: 9,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -150,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [status, slideAnim]);

  const handleStartUpdate = async () => {
    try {
      setStatus('downloading');
      setErrorMessage(null);

      // تحريك شريط التقدم تدريجياً ليعكس التنزيل للمستخدم
      progressAnim.setValue(0);
      Animated.timing(progressAnim, {
        toValue: 0.85,
        duration: 3500,
        useNativeDriver: false,
      }).start();

      const result = await Updates.fetchUpdateAsync();

      // إكمال شريط التقدم إلى 100% فور انتهاء الجلب
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start(async () => {
        if (result.isNew) {
          setStatus('ready');
          // انتظار نصف ثانية حتى يرى المستخدم عبارة الاكتمال ثم إعادة التشغيل
          setTimeout(async () => {
            try {
              await Updates.reloadAsync();
            } catch {
              // في حال تعذر إعادة التحميل التلقائية
              setStatus('idle');
            }
          }, 600);
        } else {
          setStatus('idle');
        }
      });
    } catch (error) {
      console.warn('[OtaUpdateBanner] Fetch update failed:', error);
      setErrorMessage('تعذر إكمال التنزيل، تحقق من الاتصال.');
      setStatus('available');
    }
  };

  const handleDismiss = () => {
    setStatus('idle');
  };

  if (status === 'idle') {
    return null;
  }

  const progressInterpolate = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      style={[
        styles.floatingContainer,
        {
          top: Math.max(insets.top + 6, 12),
          transform: [{ translateY: slideAnim }],
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.bannerCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: QuranColors.gold,
            shadowColor: '#000',
          },
        ]}
      >
        {/* شريط التقدم المتحرك أسفل الكرت */}
        {status === 'downloading' && (
          <View style={styles.progressBarTrack}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: progressInterpolate,
                  backgroundColor: QuranColors.gold,
                },
              ]}
            />
          </View>
        )}

        <View style={styles.contentRow}>
          <View style={[styles.iconWrapper, { backgroundColor: 'rgba(197, 155, 39, 0.12)' }]}>
            <MaterialCommunityIcons
              name={
                status === 'ready'
                  ? 'check-circle'
                  : status === 'downloading'
                  ? 'cloud-download'
                  : 'cloud-sync'
              }
              size={22}
              color={QuranColors.gold}
            />
          </View>

          <View style={styles.textColumn}>
            <Text style={[styles.titleText, { color: theme.colors.onSurface }]}>
              {status === 'ready'
                ? 'اكتمل التحميل، جاري إعادة التشغيل...'
                : status === 'downloading'
                ? 'جاري تنزيل التحديث الهوائي...'
                : 'يتوفر تحديث جديد لتطبيق بيان'}
            </Text>
            {errorMessage ? (
              <Text style={styles.errorSubText}>{errorMessage}</Text>
            ) : status === 'available' ? (
              <Text style={[styles.subText, { color: theme.colors.onSurfaceVariant }]}>
                تحسينات جديدة على الأداء والمظهر
              </Text>
            ) : null}
          </View>

          {status === 'available' && (
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionBtnPrimary, { backgroundColor: theme.colors.primary }]}
                onPress={handleStartUpdate}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnPrimaryText}>تحديث الآن</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtnDismiss}
                onPress={handleDismiss}
                hitSlop={8}
              >
                <Text style={[styles.actionBtnDismissText, { color: theme.colors.onSurfaceVariant }]}>
                  لاحقاً
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 20,
    alignItems: 'center',
  },
  bannerCard: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1.2,
    paddingVertical: 10,
    paddingHorizontal: 12,
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    overflow: 'hidden',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textColumn: {
    flex: 1,
    gap: 2,
    alignItems: 'flex-end',
  },
  titleText: {
    fontSize: 13.5,
    fontWeight: 'bold',
    textAlign: 'start',
    writingDirection: 'rtl',
  },
  subText: {
    fontSize: 11,
    textAlign: 'start',
    writingDirection: 'rtl',
  },
  errorSubText: {
    fontSize: 11,
    color: '#D32F2F',
    textAlign: 'start',
    writingDirection: 'rtl',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtnPrimary: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionBtnDismiss: {
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  actionBtnDismissText: {
    fontSize: 11.5,
  },
  progressBarTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  progressBarFill: {
    height: '100%',
  },
});
