import React, { createContext, useContext } from 'react';
import { useWindowDimensions } from 'react-native';

const FontScaleContext = createContext(1);

/**
 * fontScale lấy một lần ở gốc. Nếu mỗi Text tự gọi useWindowDimensions thì mọi chữ trên màn hình
 * cùng re-render mỗi lần bàn phím mở/đóng, vì hook đó báo đổi theo *kích thước* cửa sổ chứ không
 * theo hệ số chữ. Context chỉ đổi khi chính fontScale đổi nên consumer đứng yên.
 */
export function FontScaleProvider({ children }: { children: React.ReactNode }) {
  const { fontScale } = useWindowDimensions();
  return <FontScaleContext.Provider value={fontScale}>{children}</FontScaleContext.Provider>;
}

export function useFontScale(): number {
  return useContext(FontScaleContext);
}
