import { describe, expect, it, vi } from 'vitest';

vi.mock('../i18n', () => ({ t: (key: string) => (key === 'profile.anonymousName' ? 'Stargazer' : key) }));

import { displayNameOf } from './format';

describe('displayNameOf', () => {
  it('khách mặc định "Khách" hoặc rỗng được dịch theo ngôn ngữ app', () => {
    expect(displayNameOf({ isAnonymous: true, displayName: 'Khách' })).toBe('Stargazer');
    expect(displayNameOf({ isAnonymous: true, displayName: '  ' })).toBe('Stargazer');
    expect(displayNameOf({ isAnonymous: true, displayName: null })).toBe('Stargazer');
  });
  it('khách đã tự đặt tên giữ nguyên tên đó', () => {
    expect(displayNameOf({ isAnonymous: true, displayName: 'Lan' })).toBe('Lan');
  });
  it('tài khoản thường không bị dịch kể cả tên là "Khách"', () => {
    expect(displayNameOf({ isAnonymous: false, displayName: 'Khách' })).toBe('Khách');
    expect(displayNameOf({ isAnonymous: false, displayName: 'Minh' })).toBe('Minh');
  });
  it('không có user thì trả chuỗi rỗng', () => {
    expect(displayNameOf(null)).toBe('');
  });
});
