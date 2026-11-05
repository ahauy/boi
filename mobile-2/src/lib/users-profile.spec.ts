import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  patch: vi.fn(),
  del: vi.fn(),
  upload: vi.fn(),
}));

vi.mock('./api', () => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: mocks.patch, del: mocks.del, upload: mocks.upload }));
vi.mock('./readings', () => ({ toUploadPart: (image: unknown) => ({ part: image }) }));

import { removeAvatar, updateProfile, uploadAvatar } from './users';

beforeEach(() => vi.clearAllMocks());

describe('API sửa hồ sơ', () => {
  it('updateProfile gọi PATCH /me với displayName', async () => {
    mocks.patch.mockResolvedValue({ id: 'u1' });
    await expect(updateProfile('An')).resolves.toEqual({ id: 'u1' });
    expect(mocks.patch).toHaveBeenCalledWith('/me', { displayName: 'An' });
  });

  it('uploadAvatar gửi multipart field "avatar" tới POST /me/avatar', async () => {
    mocks.upload.mockResolvedValue({ id: 'u1', avatarUrl: 'https://x/a.jpg' });
    const image = { uri: 'file:///a.jpg', name: 'a.jpg', type: 'image/jpeg' };
    await uploadAvatar(image);
    const [path, form, options] = mocks.upload.mock.calls[0];
    expect(path).toBe('/me/avatar');
    expect(form).toBeInstanceOf(FormData);
    expect((form as FormData).has('avatar')).toBe(true);
    expect(options.timeoutMs).toBeGreaterThan(0);
  });

  it('removeAvatar gọi DELETE /me/avatar', async () => {
    mocks.del.mockResolvedValue({ id: 'u1', avatarUrl: null });
    await removeAvatar();
    expect(mocks.del).toHaveBeenCalledWith('/me/avatar');
  });
});
