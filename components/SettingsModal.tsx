import React, { useState, useEffect } from 'react';
import { X, Settings, Save, ShieldCheck, Globe } from 'lucide-react';
import { AISettings, AIProvider } from '../types';
import { settingsService } from '../services/settings';
import { useToast } from '../context/ToastContext';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [settings, setSettings] = useState<AISettings>(settingsService.getSettings());
    const toast = useToast();

    useEffect(() => {
        if (isOpen) {
            setSettings(settingsService.getSettings());
        }
    }, [isOpen]);

    const handleSave = () => {
        settingsService.saveSettings(settings);
        toast.success('Settings saved successfully');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">

                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Settings className="text-slate-600" size={24} />
                        Settings
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Provider Selection */}
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">AI Provider</label>
                        <div className="grid grid-cols-2 gap-3">
                            {(['gemini', 'qwen'] as AIProvider[]).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setSettings({ ...settings, provider: p, modelName: p === 'gemini' ? 'gemini-1.5-flash' : 'qwen3-32b' })}
                                    className={`px-4 py-3 rounded-xl border-2 transition-all text-sm font-bold flex flex-col items-center gap-1 ${settings.provider === p
                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                        : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                                        }`}
                                >
                                    <span className="capitalize">{p}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Conditional API Key Input */}
                    {settings.provider === 'gemini' ? (
                        <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Gemini API Key</label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        value={settings.geminiApiKey}
                                        onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                                        placeholder="Enter your Google Gemini API Key"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                    />
                                    <ShieldCheck size={16} className="absolute right-3 top-3 text-slate-300" />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1.5 px-1">
                                    Stored locally in your browser. Never sent to our servers.
                                </p>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Model Name</label>
                                <select
                                    value={settings.modelName}
                                    onChange={(e) => setSettings({ ...settings, modelName: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all appearance-none"
                                >
                                    <option value="gemini-1.5-flash">Gemini 1.5 Flash (Fast)</option>
                                    <option value="gemini-1.5-pro">Gemini 1.5 Pro (Powerful)</option>
                                    <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash Exp</option>
                                </select>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">DashScope API Key</label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        value={settings.qwenApiKey}
                                        onChange={(e) => setSettings({ ...settings, qwenApiKey: e.target.value })}
                                        placeholder="Enter your API Key"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                    />
                                    <ShieldCheck size={16} className="absolute right-3 top-3 text-slate-300" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">API Endpoint</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={settings.qwenEndpoint}
                                        onChange={(e) => setSettings({ ...settings, qwenEndpoint: e.target.value })}
                                        placeholder="https://..."
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                    />
                                    <Globe size={16} className="absolute right-3 top-3 text-slate-300" />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1.5 px-1 font-medium">
                                    Environment: <span className="text-amber-600">Testing (UAT)</span>
                                </p>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Model Name</label>
                                <select
                                    value={settings.modelName}
                                    onChange={(e) => setSettings({ ...settings, modelName: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all appearance-none"
                                >
                                    <option value="qwen3-32b">Qwen3-32B (Default)</option>
                                    <option value="qwen-max">Qwen Max</option>
                                    <option value="qwen-plus">Qwen Plus</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors text-sm font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-blue-100 transition-all"
                    >
                        <Save size={16} /> Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};
