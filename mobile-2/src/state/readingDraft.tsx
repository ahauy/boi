import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  HandOrientation,
  LIFE_ASPECTS,
  ReadingSchool,
  READING_SCHOOL_LIST,
  getAllSchoolTopics,
  type ReadingSchoolConfig,
} from '@palmsight/shared';

import { getLastSchool, setLastSchool } from '../lib/preferences';

interface ReadingDraftValue {
  school: ReadingSchool;
  schoolConfig: ReadingSchoolConfig;
  allTopics: string[];
  selected: string[];
  hand: HandOrientation;
  aiConsent: boolean;
  pickSchool(next: ReadingSchool): void;
  toggleTopic(key: string): void;
  toggleAll(): void;
  setHand(next: HandOrientation): void;
  setAiConsent(next: boolean): void;
}

const ReadingDraftContext = createContext<ReadingDraftValue | null>(null);

export function ReadingDraftProvider({ children }: { children: React.ReactNode }) {
  const [school, setSchool] = useState<ReadingSchool>(ReadingSchool.EASTERN);
  const [selected, setSelected] = useState<string[]>(() => getAllSchoolTopics(ReadingSchool.EASTERN));
  const [hand, setHand] = useState<HandOrientation>(HandOrientation.LEFT);
  const [aiConsent, setAiConsent] = useState(false);

  useEffect(() => {
    void getLastSchool().then((stored) => {
      setSchool(stored);
      setSelected(getAllSchoolTopics(stored));
    });
  }, []);

  const schoolConfig = useMemo(
    () => READING_SCHOOL_LIST.find((config) => config.id === school) ?? READING_SCHOOL_LIST[0],
    [school]
  );
  const allTopics = useMemo(() => getAllSchoolTopics(school), [school]);

  const pickSchool = useCallback((next: ReadingSchool) => {
    const nextConfig = READING_SCHOOL_LIST.find((config) => config.id === next) ?? READING_SCHOOL_LIST[0];
    const nextKeys = new Set<string>([...nextConfig.sections.map((section) => section.key), ...LIFE_ASPECTS.map((aspect) => aspect.key)]);
    // Đổi trường phái chỉ bỏ các mục riêng của trường phái cũ, giữ khía cạnh cuộc sống đã chọn
    setSchool(next);
    setSelected((current) => current.filter((key) => nextKeys.has(key)));
    void setLastSchool(next);
  }, []);

  const toggleTopic = useCallback((key: string) => {
    setSelected((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((current) => (current.length === allTopics.length ? [] : allTopics));
  }, [allTopics]);

  const value = useMemo<ReadingDraftValue>(
    () => ({
      school,
      schoolConfig,
      allTopics,
      selected,
      hand,
      aiConsent,
      pickSchool,
      toggleTopic,
      toggleAll,
      setHand,
      setAiConsent,
    }),
    [aiConsent, allTopics, hand, pickSchool, school, schoolConfig, selected, toggleAll, toggleTopic]
  );

  return <ReadingDraftContext.Provider value={value}>{children}</ReadingDraftContext.Provider>;
}

export function useReadingDraft(): ReadingDraftValue {
  const context = useContext(ReadingDraftContext);
  if (!context) throw new Error('useReadingDraft phải nằm trong ReadingDraftProvider');
  return context;
}
