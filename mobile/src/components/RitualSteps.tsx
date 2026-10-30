import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors, font, radius, spacing, text as type } from '../theme';
import { Card } from './ui';
import MysticDivider from './mystic/MysticDivider';

export interface RitualStep {
  index: number;
  title: string;
  tag: string;
  short: string;
}

export function StepCard({ step, total, children }: { step: RitualStep; total: number; children: React.ReactNode }) {
  return (
    <Card ornate style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Text style={{ fontFamily: font.displayStrong, fontSize: 44, lineHeight: 46, color: colors.gold, opacity: 0.92 }}>
          {`0${step.index}`}
        </Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.eyebrow, { color: colors.gold, letterSpacing: 2 }]}>{step.tag.toUpperCase()}</Text>
          <Text style={[type.headingMd, { color: colors.ink }]} accessibilityRole="header">
            {step.title}
          </Text>
        </View>
        <Text style={[type.monoStrong, { color: colors.stone }]}>{`BƯỚC ${step.index}/${total}`}</Text>
      </View>
      <MysticDivider compact symbol="✦" />
      {children}
    </Card>
  );
}

export default function RitualStepper({ steps, step, onSelect }: { steps: readonly RitualStep[]; step: number; onSelect: (next: number) => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderWidth: 1,
        borderColor: colors.hairline,
        backgroundColor: 'rgba(11,7,22,0.5)',
        borderRadius: radius.xl,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.md,
      }}>
      {steps.map((entry, index) => {
        const done = entry.index < step;
        const active = entry.index === step;
        return (
          <React.Fragment key={entry.index}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Bước ${entry.index}: ${entry.title}`}
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(entry.index)}
              style={{ width: 60, alignItems: 'center', gap: spacing.xs }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: done || active ? colors.gold : colors.hairline,
                  backgroundColor: active ? colors.goldWashStrong : done ? 'rgba(52,211,153,0.1)' : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text style={[type.monoStrong, { color: done ? colors.success : active ? colors.gold : colors.stone }]}>
                  {done ? '✓' : `0${entry.index}`}
                </Text>
              </View>
              <Text
                style={[
                  type.captionStrong,
                  { color: active ? colors.goldLight : done ? colors.body : colors.stone, textAlign: 'center' },
                ]}>
                {entry.short}
              </Text>
            </Pressable>
            {index < steps.length - 1 ? (
              <View
                style={{
                  flex: 1,
                  height: 1,
                  marginTop: 14,
                  backgroundColor: entry.index < step ? colors.gold : colors.hairlineSoft,
                  opacity: entry.index < step ? 0.7 : 1,
                }}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}
