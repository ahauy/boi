import React from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { READING_SCHOOLS, ReadingStatus, type ReadingListItemDto } from '@palmsight/shared';

import Text from './AppText';
import { StatusPill } from './ui';
import { colors, font, radius, spacing, text as type } from '../theme';
import { haptic } from '../lib/haptics';
import { formatDateTime, handLabel, SCHOOL_SHORT_LABEL, topicsLabel } from '../lib/format';

const STATUS_LABEL: Record<ReadingStatus, string> = {
  [ReadingStatus.DONE]: 'hoàn tất',
  [ReadingStatus.PROCESSING]: 'đang luận giải',
  [ReadingStatus.FAILED]: 'lỗi, đã hoàn credit',
  [ReadingStatus.REJECTED]: 'ảnh không rõ, đã hoàn credit',
  [ReadingStatus.GUEST_PREVIEW]: 'bói thử',
};

function ReadingCard({ item, compact = false }: { item: ReadingListItemDto; compact?: boolean }) {
  const thumbnail = item.annotatedImageUrl ?? item.imageUrl;
  const createdDate = formatDateTime(item.createdAt).split(' ')[0];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Quẻ ${READING_SCHOOLS[item.school]?.name ?? item.school} ngày ${formatDateTime(item.createdAt)}, ${STATUS_LABEL[item.status]}`}
      android_ripple={{ color: 'rgba(231,199,119,0.1)', foreground: true }}
      onPress={() => {
        haptic.select();
        router.push({ pathname: '/reading/[id]', params: { id: item.id } });
      }}
      style={({ pressed }) => ({ borderRadius: radius.xl, overflow: 'hidden', opacity: pressed ? 0.86 : 1 })}>
      <LinearGradient
        colors={['rgba(20,30,62,0.72)', 'rgba(8,13,30,0.86)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flexDirection: 'row',
          gap: spacing.md,
          borderWidth: 1,
          borderColor: colors.glassBorder,
          borderRadius: radius.xl,
          padding: spacing.sm,
          minHeight: compact ? 100 : 112,
        }}>
        <View
          style={{
            width: compact ? 78 : 88,
            // Không có height thì chiều cao ô ảnh bị tỷ lệ của ảnh gốc quyết định: ảnh 3:4 dựng đứng
            // cả card và bóp chữ sang một bên. Box phải tự quyết kích thước, ảnh chỉ việc crop vào.
            height: compact ? 96 : 104,
            borderRadius: radius.md,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.glassBorder,
            backgroundColor: colors.obsidian,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {thumbnail ? (
            <Image
              source={{ uri: thumbnail, cacheKey: item.id }}
              recyclingKey={item.id}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              transition={160}
            />
          ) : (
            <View style={{ alignItems: 'center', gap: 3 }}>
              <Text style={{ fontFamily: font.display, fontSize: 26, color: colors.gold }}>✦</Text>
              <Text style={[type.code, { color: colors.goldLight, fontSize: 10 }]}>{SCHOOL_SHORT_LABEL[item.school]}</Text>
            </View>
          )}
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(4,6,17,0)', 'rgba(4,6,17,0.65)']}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 30 }}
          />
        </View>

        <View style={{ flex: 1, gap: 3, paddingVertical: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
            <Text numberOfLines={1} style={[type.captionStrong, { color: colors.goldLight, letterSpacing: 0.7, flexShrink: 1 }]}>
              {READING_SCHOOLS[item.school]?.name ?? item.school}
            </Text>
            <Text numberOfLines={1} style={[type.code, { color: colors.stone, fontSize: 10.5 }]}>{createdDate}</Text>
          </View>

          <Text style={[type.bodyBold, { color: colors.ink }]} numberOfLines={1}>
            {`${handLabel(item.hand)} · ${topicsLabel(item.topics, item.school)}`}
          </Text>

          <Text style={[type.caption, { color: colors.mute, lineHeight: 18 }]} numberOfLines={2}>
            {item.summary ?? 'Chưa có tóm tắt cho quẻ này.'}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', gap: spacing.sm }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <StatusPill status={item.status} />
            </View>
            <Text style={{ color: colors.gold, fontSize: 18, flexShrink: 0 }}>›</Text>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

// Danh sách quẻ dài ra từng trang; mỗi dòng mang 2 gradient và một ảnh, nên chỉ vẽ lại khi item đổi.
export default React.memo(ReadingCard);
