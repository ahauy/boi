import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { LIFE_ASPECTS, READING_LANGUAGES, READING_SCHOOL_LIST } from '@palmsight/shared';
import { describe, expect, it, vi } from 'vitest';
import { SCREEN_LANGUAGES, SCREEN_STRINGS } from './screen-strings';
import { SUPPORTED_LANGUAGES, TRANSLATIONS } from './translations';

vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));

const SOURCE_ROOT = path.resolve(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) && !name.endsWith('.spec.ts') ? [full] : [];
  });
}

const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();

describe('screen strings (Playbook §9)', () => {
  it('covers every supported language', () => {
    expect([...SCREEN_LANGUAGES].sort()).toEqual(SUPPORTED_LANGUAGES.map((l) => l.code).sort());
  });

  it.each(Object.entries(SCREEN_STRINGS))('%s is filled in with the same placeholders', (_key, row) => {
    for (const text of row) {
      expect(text.trim()).not.toBe('');
      expect(placeholders(text)).toEqual(placeholders(row[0]));
    }
  });

  it('names every school and topic, because those keys are built at runtime', () => {
    const keys = READING_SCHOOL_LIST.flatMap((school) => [
      `school.${school.id}.name`,
      `school.${school.id}.description`,
      `school.${school.id}.short`,
      ...(school.handHint ? [`school.${school.id}.handHint`] : []),
      ...school.sections.map((section) => `topic.${section.key}`),
    ]);
    keys.push(...LIFE_ASPECTS.map((aspect) => `topic.${aspect.key}`));

    expect(keys.filter((key) => !SCREEN_STRINGS[key])).toEqual([]);
  });

  it('uses the same language list as the AI output', () => {
    expect([...SCREEN_LANGUAGES].sort()).toEqual(Object.keys(READING_LANGUAGES).sort());
  });

  it('never promises unlimited use or no ads', () => {
    const english = Object.values(SCREEN_STRINGS).map((row) => row[0].toLowerCase());
    for (const text of english) {
      expect(text).not.toContain('unlimited');
      expect(text).not.toMatch(/\bno ads\b/);
    }
  });

  it('has a translation for every key the app calls', () => {
    const known = new Set([...Object.keys(SCREEN_STRINGS), ...Object.keys(TRANSLATIONS.en)]);
    const missing = sourceFiles(SOURCE_ROOT).flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/\bt\('([a-zA-Z]+\.[\w.]+)'/g)]
        .map((match) => match[1])
        .filter((key) => !known.has(key))
        .map((key) => `${path.basename(file)}: ${key}`)
    );

    expect(missing).toEqual([]);
  });
});
