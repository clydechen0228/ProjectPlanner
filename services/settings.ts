import { AISettings, DEFAULT_SETTINGS } from '../types';

const SETTINGS_KEY = 'mdm_planner_settings';

export const settingsService = {
    getSettings(): AISettings {
        const stored = localStorage.getItem(SETTINGS_KEY);
        if (!stored) return DEFAULT_SETTINGS;
        try {
            return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
        } catch (e) {
            return DEFAULT_SETTINGS;
        }
    },

    saveSettings(settings: AISettings) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }
};
