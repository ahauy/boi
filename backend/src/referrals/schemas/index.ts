import * as yup from 'yup';

export * from '../../schemas/referral.schema';

export const enterReferralBodySchema = yup
  .object({
    code: yup
      .string()
      .test(
        'is-string',
        'Mã giới thiệu phải là chuỗi ký tự',
        function () {
          return typeof this.originalValue === 'string';
        },
      )
      .test(
        'is-not-empty',
        'Mã giới thiệu không được để trống',
        function (val) {
          return typeof val === 'string' && val.trim().length > 0;
        },
      )
      .required('Mã giới thiệu không được để trống'),
  })
  .strict()
  .noUnknown();

