import { describe, it, expect } from 'vitest';
import { truncatePalmResultForGuest } from './truncate-palm-result.util';
import { PalmResult, ReadingSchool, HandOrientation } from '@palmsight/shared';

describe('truncatePalmResultForGuest (TC-001, TC-002, TC-003)', () => {
  const samplePalmResult: PalmResult = {
    isPalm: true,
    school: ReadingSchool.WESTERN,
    hand: HandOrientation.LEFT,
    summary: 'Bàn tay của bạn mang năng lượng Thổ với đường sinh đạo sâu và rõ nét...',
    disclaimer: 'Kết quả mang tính giải trí, không thay thế tư vấn chuyên môn.',
    sections: [
      {
        key: 'lifeLine',
        title: 'Đường Sinh Đạo (Life Line)',
        observation: 'Đường cong sâu, rõ, không đứt đoạn.',
        meaning: 'Thể chất dẻo dai và năng lượng dồi dào.',
      },
      {
        key: 'headLine',
        title: 'Đường Trí Đạo (Head Line)',
        observation: 'Đường trí đạo thẳng và dài.',
        meaning: 'Tư duy logic, thực tế.',
      },
      {
        key: 'heartLine',
        title: 'Đường Tâm Đạo (Heart Line)',
        observation: 'Đường tâm đạo sâu, kéo dài tới gò Mộc Tinh.',
        meaning: 'Giàu cảm xúc, chân thành trong tình yêu.',
      },
      {
        key: 'fateLine',
        title: 'Đường Định Mệnh (Fate Line)',
        observation: 'Bắt đầu từ cổ tay chạy thẳng lên gò Thổ Tinh.',
        meaning: 'Sự nghiệp tự lập từ sớm.',
      },
    ],
    aspects: {
      career: 'Sự nghiệp phát triển mạnh mẽ từ sau tuổi 28.',
      love: 'Tình duyên viên mãn khi biết lắng nghe.',
      health: 'Chú ý các bệnh về cột sống và thị lực.',
    },
    advice: 'Hãy kiên định với mục tiêu dài hạn và chăm sóc sức khỏe.',
  };

  it('TC-001: Truncates 50% for guest - keeps summary, first 2 sections open, locks rest', () => {
    const preview = truncatePalmResultForGuest(samplePalmResult);

    // Summary & disclaimer intact
    expect(preview.summary).toBe(samplePalmResult.summary);
    expect(preview.disclaimer).toBe(samplePalmResult.disclaimer);

    // First 2 sections are open (unlocked)
    expect(preview.sections).toHaveLength(4);
    expect(preview.sections[0]).toEqual({
      key: 'lifeLine',
      title: 'Đường Sinh Đạo (Life Line)',
      observation: 'Đường cong sâu, rõ, không đứt đoạn.',
      meaning: 'Thể chất dẻo dai và năng lượng dồi dào.',
      isLocked: false,
    });
    expect(preview.sections[1]).toEqual({
      key: 'headLine',
      title: 'Đường Trí Đạo (Head Line)',
      observation: 'Đường trí đạo thẳng và dài.',
      meaning: 'Tư duy logic, thực tế.',
      isLocked: false,
    });

    // Sections from index 2 onwards must be locked with null observation and meaning
    expect(preview.sections[2]).toEqual({
      key: 'heartLine',
      title: 'Đường Tâm Đạo (Heart Line)',
      observation: null,
      meaning: null,
      isLocked: true,
    });
    expect(preview.sections[3]).toEqual({
      key: 'fateLine',
      title: 'Đường Định Mệnh (Fate Line)',
      observation: null,
      meaning: null,
      isLocked: true,
    });

    // Aspects: all locked with content = null
    expect(preview.aspects.career).toEqual({
      title: 'career',
      content: null,
      isLocked: true,
    });
    expect(preview.aspects.love).toEqual({
      title: 'love',
      content: null,
      isLocked: true,
    });
    expect(preview.aspects.health).toEqual({
      title: 'health',
      content: null,
      isLocked: true,
    });

    // Advice: locked with content = null
    expect(preview.advice).toEqual({
      content: null,
      isLocked: true,
    });
  });

  it('TC-002: Handles reading with 2 or fewer sections gracefully', () => {
    const shortResult: PalmResult = {
      isPalm: true,
      summary: 'Tóm tắt ngắn',
      sections: [
        {
          key: 'lifeLine',
          title: 'Đường Sinh Đạo',
          observation: 'Rõ ràng',
          meaning: 'Sức khỏe tốt',
        },
      ],
      aspects: {
        career: 'Ổn định',
      },
    };

    const preview = truncatePalmResultForGuest(shortResult);
    expect(preview.sections).toHaveLength(1);
    expect(preview.sections[0].isLocked).toBe(false);
    expect(preview.sections[0].observation).toBe('Rõ ràng');
    expect(preview.aspects.career).toEqual({
      title: 'career',
      content: null,
      isLocked: true,
    });
    expect(preview.advice).toBeNull();
  });

  it('TC-003: Ensures immutability - original PalmResult is not mutated', () => {
    const originalClone = JSON.parse(JSON.stringify(samplePalmResult));
    truncatePalmResultForGuest(samplePalmResult);
    expect(samplePalmResult).toEqual(originalClone);
  });
});
