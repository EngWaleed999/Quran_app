import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, I18nManager } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { QuranColors } from '../../../core/theme/theme';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityLabel="رجوع">
            <MaterialCommunityIcons name="arrow-right" size={24} color={QuranColors.emerald} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>الإعدادات</Text>

          <View style={{ width: 40 }} />
        </View>

        {/* Empty Page Body */}
        <View style={styles.body}>
          <MaterialCommunityIcons name="cog-outline" size={64} color={QuranColors.gold} />
          <Text style={styles.emptyTitle}>إعدادات التطبيق</Text>
          <Text style={styles.emptySubtitle}>
            هذه الصفحة مخصصة لإعدادات التطبيق (الوضع الليلي، اختيار القارئ الافتراضي، وتفضيلات العرض).
            سيتم تفعيل الخيارات في التحديث القادم بإذن الله.
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: QuranColors.parchment,
  },
  header: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: QuranColors.parchmentBorder,
  },
  closeBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: QuranColors.emeraldDark,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
    gap: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: QuranColors.emeraldDark,
  },
  emptySubtitle: {
    fontSize: 14,
    color: QuranColors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
  },
});
