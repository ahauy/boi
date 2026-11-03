import * as yup from 'yup';
import { RewardedAdPlacement } from '@palmsight/shared';

export const rewardedAdIntentBodySchema = yup
  .object({
    placement: yup
      .string()
      .oneOf(
        Object.values(RewardedAdPlacement),
        'Vị trí hiển thị quảng cáo không hợp lệ',
      )
      .required('Thiếu vị trí hiển thị quảng cáo'),
  })
  .strict()
  .noUnknown();

/** Nonce do `createIntent` cấp: 32 hex, nhưng không chốt cứng độ dài để còn đổi thuật toán sinh. */
export const rewardedAdDevGrantBodySchema = yup
  .object({
    nonce: yup
      .string()
      .trim()
      .min(8, 'Nonce quảng cáo không hợp lệ')
      .max(64, 'Nonce quảng cáo không hợp lệ')
      .required('Thiếu nonce quảng cáo'),
  })
  .strict()
  .noUnknown();
