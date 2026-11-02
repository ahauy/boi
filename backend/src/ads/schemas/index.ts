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
