import React, { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

import Text from './AppText';
import { colors, font } from '../theme';

interface AvatarProps {
  name: string;
  /** Ảnh đại diện (user.avatarUrl); rỗng hoặc tải lỗi thì rơi về chữ cái đầu */
  uri?: string | null;
  size?: number;
}

export default function Avatar({ name, uri, size = 66 }: AvatarProps) {
  // Nhớ chính URL đã lỗi (không phải cờ boolean): đổi sang ảnh mới thì tự thử tải lại
  const [failedUri, setFailedUri] = useState<string | null>(null);

  const showImage = Boolean(uri) && failedUri !== uri;
  const initial = (name.trim()[0] ?? 'K').toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1,
        borderColor: colors.gold,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: colors.surfaceSoft,
      }}>
      {showImage ? (
        <Image
          source={{ uri: uri as string }}
          style={{ width: size, height: size }}
          contentFit="cover"
          onError={() => setFailedUri(uri ?? null)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <>
          <Text style={{ fontFamily: font.displayStrong, fontSize: size * 0.44, color: colors.goldLight }}>{initial}</Text>
          {size >= 56 ? (
            <Text style={{ position: 'absolute', right: size * 0.06, bottom: size * 0.09, fontFamily: font.display, fontSize: 10, color: colors.gold }}>✦</Text>
          ) : null}
        </>
      )}
    </View>
  );
}
