import { useState, useEffect } from 'react';

export type FilterPreset = {
  id: string;
  name: string;
  filters: {
    showOnlyActive: boolean;
    percentageRange: [number, number];
    excludedEmployees: number[];
    viewMode: 'week' | 'month';
  };
};

const STORAGE_KEY = 'employee-filter-presets';

export function useFilterPresets() {
  const [presets, setPresets] = useState<FilterPreset[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  }, [presets]);

  const savePreset = (name: string, filters: FilterPreset['filters']) => {
    const newPreset: FilterPreset = {
      id: crypto.randomUUID(),
      name,
      filters
    };
    setPresets(prev => [...prev, newPreset]);
    return newPreset.id;
  };

  const deletePreset = (id: string) => {
    setPresets(prev => prev.filter(preset => preset.id !== id));
  };

  const getPreset = (id: string) => {
    return presets.find(preset => preset.id === id);
  };

  return {
    presets,
    savePreset,
    deletePreset,
    getPreset
  };
} 