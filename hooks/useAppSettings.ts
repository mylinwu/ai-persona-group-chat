import { useState, useEffect, useCallback } from 'react';
// fix: Corrected import path to resolve module.
import { DEFAULT_SYSTEM_PROMPT } from '../constants/index';

const SETTINGS_STORAGE_KEY = 'ai-persona-chat-settings';

export interface AIModel {
  id: string;
  name: string;
  supportsThinking: boolean;
}

export interface AppSettings {
  isChatStretched: boolean;
  baseSystemPrompt: string;
  aiContinueShortcut: string;
  newConversationShortcut: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  // AI Configuration
  openRouterApiKey: string;
  chatModel: string; // 对话使用的模型
  summaryModel: string; // 总结使用的模型
}

const defaultSettings: AppSettings = {
  isChatStretched: false,
  baseSystemPrompt: DEFAULT_SYSTEM_PROMPT,
  aiContinueShortcut: 'Control+Enter',
  newConversationShortcut: 'Control+N',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
  fontSize: 14,
  lineHeight: 1.6,
  openRouterApiKey: '',
  chatModel: 'qwen/qwen3-30b-a3b',
  summaryModel: 'qwen/qwen3-8b',
};

export const useAppSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        
        // Backwards compatibility for fontSize
        if (typeof parsed.fontSize === 'string') {
            switch(parsed.fontSize) {
                case 'Small': parsed.fontSize = 12; break;
                case 'Large': parsed.fontSize = 16; break;
                case 'Medium':
                default: parsed.fontSize = 14; break;
            }
        }

        return { ...defaultSettings, ...parsed };
      }
    } catch (error) {
      console.error('Error reading settings from localStorage', error);
    }
    return defaultSettings;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Error writing settings to localStorage', error);
    }
  }, [settings]);

  const setSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  return { settings, setSetting, setSettings };
};