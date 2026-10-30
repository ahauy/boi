import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  LIFE_ASPECTS_MAP,
  LifeAspect,
  READING_SCHOOLS,
  getTopicLabel,
  type GuestReadingPreviewDto,
  type ReadingAspectPreviewDto,
} from '@palmsight/shared';

import Screen, { ScreenHeader } from '../../components/Screen';
import { Banner, Button, Card, Chip, TextLink } from '../../components/ui';
import { formatDateTime, handLabel } from '../../lib/format';
import { fetchGuestPreview } from '../../lib/readings';
import { ApiError } from '../../lib/api';
import { colors, text as type } from '../../theme';

export default function GuestReadingScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [preview, setPreview] = useState<GuestReadingPreviewDto | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setPreview(await fetchGuestPreview(token));
      setFailure(null);
    } catch (error) {
      setFailure(
        error instanceof ApiError && error.status === 404
          ? 'Bài bói thử đã hết hạn (bản lưu chỉ giữ 7 ngày) hoặc không tồn tại.'
          : 'Không thể tải kết quả bài bói. Vui lòng thử lại.'
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const schoolName = preview ? READING_SCHOOLS[preview.school]?.name ?? preview.school : '';

  return (
    <Screen
      header={
        <ScreenHeader
          eyebrow="✦ Palmsight // Guest Preview ✦"
          title="Bài bói thử của bạn"
          subtitle={preview ? `${schoolName} · ${handLabel(preview.hand)} · ${formatDateTime(preview.createdAt)}` : undefined}
        />
      }
      footer={
        <View style={{ gap: 8 }}>
          <Button
            label="Tạo tài khoản — lưu bài bói & nhận 3 credits"
            onPress={() =>
              router.push(token ? { pathname: '/register', params: { claimToken: token } } : '/register')
            }
          />
          <Button
            label="Đã có tài khoản? Đăng nhập"
            variant="ghost"
            onPress={() => router.push(token ? { pathname: '/login', params: { claimToken: token } } : '/login')}
          />
        </View>
      }>
      {loading && !preview ? <Text style={[type.bodyMd, { color: colors.mute }]}>Đang tải kết quả...</Text> : null}

      {!loading && failure ? (
        <Banner
          variant="error"
          title="Bài bói thử không xem được"
          lines={[failure]}
          action={{ label: 'Bói thử lại', onPress: () => router.replace('/guest') }}
        />
      ) : null}

      {preview ? <GuestPreviewBody preview={preview} /> : null}
    </Screen>
  );
}

function GuestPreviewBody({ preview }: { preview: GuestReadingPreviewDto }) {
  const [usingAnnotated, setUsingAnnotated] = useState(true);
  const annotated = preview.annotatedImageUrl;
  const imageUrl = (usingAnnotated ? annotated ?? preview.imageUrl : preview.imageUrl) ?? annotated ?? null;

  return (
    <View style={{ gap: 16 }}>
      <Banner
        variant="warning"
        title="Đây là bản xem trước của khách"
        lines={[`Bài bói thử chỉ được lưu đến ${formatDateTime(preview.previewExpiresAt)}. Tạo tài khoản để lưu bài bói vĩnh viễn.`]}
      />

      {imageUrl ? (
        <Card style={{ padding: 0, overflow: 'hidden', gap: 0 }}>
          <Image
            source={{ uri: imageUrl, cacheKey: preview.id }}
            style={{ width: '100%', height: 300, backgroundColor: colors.obsidian }}
            contentFit="contain"
            transition={220}
            accessibilityLabel="Ảnh chỉ tay đã phân tích"
          />
          <View style={{ padding: 12, gap: 8 }}>
            <Text style={[type.code, { color: colors.stone }]}>ẢNH CHỈ TAY ĐÃ PHÂN TÍCH</Text>
            {annotated ? (
              <TextLink
                label={usingAnnotated ? 'Ẩn đường chỉ tay' : 'Hiện đường chỉ tay'}
                onPress={() => setUsingAnnotated((value) => !value)}
              />
            ) : null}
          </View>
        </Card>
      ) : null}

      <Card style={{ gap: 8 }}>
        <Text style={[type.bodyStrong, { color: colors.ink }]}>Mục đã bói:</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {preview.topics.map((topic) => (
            <Chip key={topic} label={getTopicLabel(topic, preview.school)} />
          ))}
        </View>
      </Card>

      {preview.summary ? (
        <Card style={{ gap: 8 }}>
          <Text style={[type.headingSm, { color: colors.gold }]}>Tổng quan năng lượng lòng bàn tay</Text>
          <Text style={[type.bodyMd, { color: colors.body }]}>{preview.summary}</Text>
        </Card>
      ) : null}

      {preview.sections.map((section) => (
        <Card key={section.key} style={{ gap: 8 }}>
          <Text style={[type.headingSm, { color: colors.ink }]}>{`✦ ${section.title}`}</Text>
          {section.observation ? (
            <View style={{ gap: 4 }}>
              <Text style={[type.caption, { color: colors.success }]}>Quan sát</Text>
              <Text style={[type.bodyMd, { color: colors.body }]}>{section.observation}</Text>
            </View>
          ) : null}
          {section.meaning ? (
            <View style={{ gap: 4 }}>
              <Text style={[type.caption, { color: colors.violet }]}>Ý nghĩa</Text>
              <Text style={[type.bodyMd, { color: colors.body }]}>{section.meaning}</Text>
            </View>
          ) : null}
        </Card>
      ))}

      {Object.keys(preview.aspects).length > 0 ? (
        <Card style={{ gap: 12 }}>
          <Text style={[type.headingSm, { color: colors.gold }]}>Khía cạnh cuộc sống</Text>
          {Object.entries(preview.aspects).map(([key, aspect]: [string, ReadingAspectPreviewDto]) => (
            <View key={key} style={{ gap: 4 }}>
              <Text style={[type.caption, { color: colors.goldLight }]}>{LIFE_ASPECTS_MAP[key as LifeAspect]?.label ?? key}</Text>
              <Text style={[type.bodyMd, { color: colors.body }]}>{aspect.content}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      {preview.advice?.content ? (
        <Card style={{ gap: 8 }}>
          <Text style={[type.headingSm, { color: colors.gold }]}>Lời khuyên</Text>
          <Text style={[type.bodyMd, { color: colors.body }]}>{preview.advice.content}</Text>
        </Card>
      ) : null}

      <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.hairlineSoft, padding: 12 }}>
        <Text style={[type.caption, { color: colors.stone }]}>{preview.disclaimer}</Text>
      </View>
    </View>
  );
}
