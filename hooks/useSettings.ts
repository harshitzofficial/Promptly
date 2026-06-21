import { useState, useEffect } from 'react';

export interface Settings {
  tone: string;
  detail: string;
  customInstructions: string;
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>({
    tone: 'professional',
    detail: 'balanced',
    customInstructions: ''
  });

  useEffect(() => {
    // 1. Initial Load
    browser.storage.local.get(['selectedTone', 'selectedDetail', 'customInstructions']).then((data: any) => {
      setSettings(prev => ({
        tone: data.selectedTone || prev.tone,
        detail: data.selectedDetail || prev.detail,
        customInstructions: data.customInstructions || prev.customInstructions
      }));
    });

    // 2. Listen for changes in other contexts
    const listener = (changes: any, area: string) => {
      if (area === 'local') {
        setSettings(prev => ({
          tone: changes.selectedTone ? changes.selectedTone.newValue : prev.tone,
          detail: changes.selectedDetail ? changes.selectedDetail.newValue : prev.detail,
          customInstructions: changes.customInstructions ? changes.customInstructions.newValue : prev.customInstructions
        }));
      }
    };
    
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, []);

  // 3. Setter to update state AND local storage simultaneously
  const updateSetting = (key: keyof Settings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    
    const storageMap: Record<string, string> = {
      tone: 'selectedTone',
      detail: 'selectedDetail',
      customInstructions: 'customInstructions'
    };
    
    browser.storage.local.set({ [storageMap[key]]: value });
  };

  return { settings, updateSetting };
}
