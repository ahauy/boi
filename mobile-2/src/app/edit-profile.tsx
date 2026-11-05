import React, { useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import Screen, { ScreenHeader } from '../components/Screen';
import Text from '../components/AppText';
import Avatar from '../components/Avatar';
import { Banner, Button, Input } from '../components/ui';
import { runExternalActivity } from '../lib/external-activity';
import { displayNameOf, DEFAULT_GUEST_DISPLAY_NAME } from '../lib/format';
import { errorCodeOf } from '../lib/forms';
import { haptic } from '../lib/haptics';
import { avatarAssetProblem, avatarUploadName, DISPLAY_NAME_MAX, profileErrorKey, validateDisplayName } from '../lib/profile-edit';
import { removeAvatar, updateProfile, uploadAvatar, type ProfileUser } from '../lib/users';
import { useAuth } from '../state/auth';
import { colors, spacing, text as type } from '../theme';
import { t, useI18n } from '../i18n';

type Busy = null | 'save' | 'library' | 'camera' | 'remove';

// Cắt vuông + nén nhẹ ngay trong bộ chọn (không có expo-image-manipulator) để ảnh nằm dưới giới hạn 5 MB
const PICKER_OPTIONS = { mediaTypes: ['images'] as ImagePicker.MediaType[], allowsEditing: true, aspect: [1, 1] as [number, number], quality: 0.7 };

export default function EditProfileScreen() {
  useI18n();
  const { user, applyUserUpdate } = useAuth();
  const me = user as ProfileUser | null;
  const initialName = me && me.isAnonymous && me.displayName.trim() === DEFAULT_GUEST_DISPLAY_NAME ? '' : me?.displayName ?? '';
  const [name, setName] = useState(initialName);
  const [nameError, setNameError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [needSettings, setNeedSettings] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  // Ref khoá đồng bộ: state `busy` chỉ cập nhật sau render nên hai tap liên tiếp vẫn lọt qua
  const lockRef = useRef(false);

  if (!me) return null;
  const locked = busy !== null;
  const dirty = name.trim() !== initialName.trim();

  async function run(kind: Exclude<Busy, null>, task: () => Promise<void>) {
    if (lockRef.current) return;
    lockRef.current = true;
    setBusy(kind);
    setFailure(null);
    setSuccess(null);
    setNeedSettings(false);
    try {
      await task();
    } catch (err) {
      setFailure(t(profileErrorKey(errorCodeOf(err))));
    } finally {
      lockRef.current = false;
      setBusy(null);
    }
  }

  function save() {
    haptic.tap();
    const check = validateDisplayName(name);
    if (!check.ok) {
      setNameError(t(check.errorKey, { max: DISPLAY_NAME_MAX }));
      return;
    }
    setNameError(undefined);
    void run('save', async () => {
      applyUserUpdate(await updateProfile(check.value));
      setName(check.value);
      setSuccess(t('editProfile.saved'));
    });
  }

  async function sendPicked(result: ImagePicker.ImagePickerResult) {
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    const problem = avatarAssetProblem(asset);
    if (problem) {
      setFailure(t(problem));
      return;
    }
    const { name: fileName, type: mime } = avatarUploadName(asset.mimeType);
    applyUserUpdate(await uploadAvatar({ uri: asset.uri, name: fileName, type: mime }));
    setSuccess(t('editProfile.avatarSaved'));
  }

  function pickFromLibrary() {
    haptic.select();
    void run('library', async () => {
      const permission = await runExternalActivity('permission', () => ImagePicker.requestMediaLibraryPermissionsAsync());
      if (!permission.granted) {
        setFailure(t('editProfile.libraryDenied'));
        setNeedSettings(!permission.canAskAgain);
        return;
      }
      const result = await runExternalActivity('photo_picker', () => ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS));
      await sendPicked(result);
    });
  }

  function takePhoto() {
    haptic.select();
    void run('camera', async () => {
      const permission = await runExternalActivity('permission', () => ImagePicker.requestCameraPermissionsAsync());
      if (!permission.granted) {
        setFailure(t('editProfile.cameraDenied'));
        setNeedSettings(!permission.canAskAgain);
        return;
      }
      const result = await runExternalActivity('photo_picker', () => ImagePicker.launchCameraAsync(PICKER_OPTIONS));
      await sendPicked(result);
    });
  }

  function remove() {
    haptic.select();
    void run('remove', async () => {
      applyUserUpdate(await removeAvatar());
      setSuccess(t('editProfile.avatarRemoved'));
    });
  }

  return (
    <Screen
      header={<ScreenHeader compact title={t('editProfile.title')} onBack={() => router.back()} />}
      footer={<Button label={busy === 'save' ? t('editProfile.saving') : t('editProfile.save')} onPress={save} loading={busy === 'save'} disabled={locked || !dirty} size="lg" noInterstitial />}>
      <View style={{ alignItems: 'center', gap: spacing.md }}>
        <Avatar name={displayNameOf(me)} uri={me.avatarUrl} size={112} />
        <Text style={[type.caption, { color: colors.mute, textAlign: 'center' }]}>{t('editProfile.photoHint')}</Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Button label={busy === 'library' ? t('editProfile.uploading') : t('editProfile.pickLibrary')} variant="outline" onPress={pickFromLibrary} loading={busy === 'library'} disabled={locked} noInterstitial />
        <Button label={busy === 'camera' ? t('editProfile.uploading') : t('editProfile.takePhoto')} variant="outline" onPress={takePhoto} loading={busy === 'camera'} disabled={locked} noInterstitial />
        {me.hasCustomAvatar === true ? (
          <Button label={t('editProfile.removePhoto')} variant="ghost" onPress={remove} loading={busy === 'remove'} disabled={locked} noInterstitial />
        ) : null}
      </View>

      <Input
        label={t('editProfile.nameLabel')}
        value={name}
        onChangeText={(next) => {
          setName(next);
          setNameError(undefined);
        }}
        placeholder={t('profile.anonymousName')}
        helper={t('editProfile.nameHelper', { max: DISPLAY_NAME_MAX })}
        autoCapitalize="words"
        autoComplete="name"
        maxLength={DISPLAY_NAME_MAX + 10}
        error={nameError}
        returnKeyType="done"
        onSubmitEditing={save}
        editable={!locked}
      />

      {success ? <Banner variant="success" title={success} /> : null}
      {failure ? (
        <Banner
          variant="error"
          title={failure}
          action={needSettings ? { label: t('camera.openSettings'), onPress: () => void runExternalActivity('browser', () => Linking.openSettings()) } : undefined}
        />
      ) : null}
    </Screen>
  );
}
