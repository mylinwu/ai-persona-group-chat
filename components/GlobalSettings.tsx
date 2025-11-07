import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, AIModel } from '../hooks/useAppSettings';
import { XMarkIcon, InformationCircleIcon } from './icons/Icons';
// fix: Corrected import path to resolve module.
import { DEFAULT_SYSTEM_PROMPT } from '../constants/index';
import { formatShortcut } from '../utils/shortcutFormatter';
import { db, getStorageInfo } from '../utils/db';

interface GlobalSettingsProps {
    isOpen: boolean;
    onClose: () => void;
    settings: AppSettings;
    setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

let timer: NodeJS.Timeout;

const ShortcutInput: React.FC<{ value: string; onChange: (value: string) => void; }> = ({ value, onChange }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingText, setRecordingText] = useState('请按键...');
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!isRecording) {
            setRecordingText('请按键...');
            return;
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();
            
            const parts = [];
            if (e.ctrlKey || e.metaKey) parts.push('Control');
            if (e.altKey) parts.push('Alt');
            if (e.shiftKey) parts.push('Shift');
            
            const keyName = e.key.length === 1 ? e.key.toUpperCase() : e.key;
            
            const isModifierOnly = ['Control', 'Meta', 'Alt', 'Shift'].includes(keyName);

            if (isModifierOnly) {
                setRecordingText(parts.join('+') + '+ ...');
                return;
            }

            if (!['Control', 'Meta', 'Alt', 'Shift', 'Unidentified'].includes(keyName)) {
                parts.push(keyName);
            }

            if (parts.length > 0 && parts.some(p => !['Control', 'Alt', 'Shift'].includes(p))) {
                 onChange(parts.join('+'));
                 setIsRecording(false);
            }
        };

        const handleClickOutside = (e: MouseEvent) => {
             if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
                setIsRecording(false);
             }
        }

        window.addEventListener('keydown', handleKeyDown, { capture: true });
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            window.removeEventListener('keydown', handleKeyDown, { capture: true });
            document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isRecording, onChange]);

    return (
        <div className="flex items-center gap-2">
            <span className="font-mono text-sm bg-gray-200 px-3 py-1.5 rounded">{formatShortcut(value)}</span>
            <button ref={buttonRef} onClick={() => setIsRecording(prev => !prev)} className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-1 px-3 rounded-lg text-sm min-w-[80px] text-center">
                {isRecording ? recordingText : '修改'}
            </button>
        </div>
    );
};

const GlobalSettings: React.FC<GlobalSettingsProps> = ({ isOpen, onClose, settings, setSetting }) => {
    const [prompt, setPrompt] = useState(settings.baseSystemPrompt);
    const [showTooltip, setShowTooltip] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [models, setModels] = useState<AIModel[]>([]);
    const [loadingModels, setLoadingModels] = useState(false);
    const [apiKey, setApiKey] = useState(settings.openRouterApiKey);

    useEffect(() => {
        setPrompt(settings.baseSystemPrompt);
        setApiKey(settings.openRouterApiKey);
    }, [settings.baseSystemPrompt, settings.openRouterApiKey, isOpen]);

    // 获取模型列表
    const fetchModels = async () => {
        if (!apiKey) {
            alert('请先输入 OpenRouter API Key');
            return;
        }
        
        setLoadingModels(true);
        try {
            const response = await fetch('https://openrouter.ai/api/v1/models', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                }
            });
            
            if (!response.ok) {
                throw new Error('获取模型列表失败');
            }
            
            const data = await response.json();
            const modelList: AIModel[] = data.data.map((model: any) => ({
                id: model.id,
                name: model.name || model.id,
                supportsThinking: model.id.includes('thinking') || model.id.includes('o1') || model.id.includes('o3'),
            }));
            
            setModels(modelList);
        } catch (error) {
            console.error('Error fetching models:', error);
            alert('获取模型列表失败，请检查 API Key 是否正确');
        } finally {
            setLoadingModels(false);
        }
    };

    if (!isOpen) return null;

    const handlePromptSave = () => {
        setSetting('baseSystemPrompt', prompt);
    };
    
    const handleClose = () => {
        // save all settings on close
        handlePromptSave();
        setSetting('openRouterApiKey', apiKey);
        onClose();
    }

    const handlePromptReset = () => {
        setPrompt(DEFAULT_SYSTEM_PROMPT);
        setSetting('baseSystemPrompt', DEFAULT_SYSTEM_PROMPT);
    }

    // 导出会话数据
    const handleExportData = () => {
        try {
            const jsonData = db.exportData();
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ai-persona-chat-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            alert('数据导出成功！');
        } catch (error) {
            console.error('Export error:', error);
            alert('导出失败，请查看控制台了解详情。');
        }
    };

    // 导入会话数据
    const handleImportData = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        // ensure browsers do not try to save anything for this element
        input.autocomplete = 'off';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const jsonData = event.target?.result as string;
                    const success = db.importData(jsonData);
                    if (success) {
                        alert('数据导入成功！页面将刷新以加载新数据。');
                        window.location.reload();
                    } else {
                        alert('导入失败，请检查文件格式是否正确。');
                    }
                } catch (error) {
                    console.error('Import error:', error);
                    alert('导入失败，请查看控制台了解详情。');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center" onClick={handleClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 flex-shrink-0">
                    <h2 className="text-xl font-bold text-gray-900">全局设置</h2>
                    <button onClick={handleClose} className="text-gray-400 hover:text-gray-800">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>
                
                <div className="space-y-6 overflow-y-auto pr-2 -mr-2">
                    {/* Appearance Setting */}
                    <div>
                        <h3 className="text-lg font-medium text-gray-800 mb-2">外观与字体</h3>
                         <div className="bg-gray-100 p-3 rounded-md space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-800">拉伸聊天窗口</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={settings.isChatStretched} 
                                        onChange={(e) => setSetting('isChatStretched', e.target.checked)} 
                                        className="sr-only peer" 
                                    />
                                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                                </label>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-800">字体</span>
                                <input
                                    type="text"
                                    value={settings.fontFamily}
                                    onChange={(e) => setSetting('fontFamily', e.target.value)}
                                    className="w-2/3 bg-white border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                    placeholder="e.g., -apple-system, sans-serif"
                                    autoComplete="off"
                                    spellCheck={false}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-800">字号</span>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={settings.fontSize}
                                        onChange={(e) => setSetting('fontSize', parseInt(e.target.value, 10) || 14)}
                                        className="w-20 bg-white border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        autoComplete="off"
                                    />
                                    <span className="text-sm text-gray-600">px</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-800">行高</span>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={settings.lineHeight}
                                        onChange={(e) => setSetting('lineHeight', parseFloat(e.target.value) || 1.6)}
                                        step={0.1}
                                        min={1}
                                        className="w-20 bg-white border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        autoComplete="off"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Shortcut Settings */}
                    <div>
                        <h3 className="text-lg font-medium text-gray-800 mb-2">快捷键设置</h3>
                        <div className="bg-gray-100 p-3 rounded-md space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-800">让 AI 接话</span>
                                <ShortcutInput value={settings.aiContinueShortcut} onChange={(v) => setSetting('aiContinueShortcut', v)} />
                            </div>
                             <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-800">新建对话</span>
                                <ShortcutInput value={settings.newConversationShortcut} onChange={(v) => setSetting('newConversationShortcut', v)} />
                            </div>
                        </div>
                    </div>

                    {/* AI Configuration */}
                    <div>
                        <h3 className="text-lg font-medium text-gray-800 mb-2">AI 配置</h3>
                        <div className="bg-gray-100 p-3 rounded-md space-y-3">
                            <div>
                                <label className="block font-medium text-gray-800 mb-1">OpenRouter API Key</label>
                                <div className="flex gap-2">
                                    <input
                                        type="password"
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="sk-or-v1-..."
                                        autoComplete="new-password"
                                        autoCorrect="off"
                                        autoCapitalize="none"
                                        spellCheck={false}
                                    />
                                    <button 
                                        onClick={fetchModels}
                                        disabled={loadingModels || !apiKey}
                                        className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white py-1.5 px-4 rounded-md text-sm whitespace-nowrap"
                                    >
                                        {loadingModels ? '加载中...' : '获取模型'}
                                    </button>
                                </div>
                                <p className="text-xs text-gray-600 mt-1">
                                    在 <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">OpenRouter</a> 获取 API Key
                                </p>
                            </div>
                            
                            <div>
                                <label className="block font-medium text-gray-800 mb-1">对话模型</label>
                                <select
                                    value={settings.chatModel}
                                    onChange={(e) => setSetting('chatModel', e.target.value)}
                                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {models.length === 0 ? (
                                        <option value={settings.chatModel}>{settings.chatModel}</option>
                                    ) : (
                                        models.map(model => (
                                            <option key={model.id} value={model.id}>
                                                {model.name} {model.supportsThinking ? '🧠' : ''}
                                            </option>
                                        ))
                                    )}
                                </select>
                                <p className="text-xs text-gray-600 mt-1">
                                    用于生成对话回复的模型 {models.find(m => m.id === settings.chatModel)?.supportsThinking && '(支持思考模式)'}
                                </p>
                            </div>
                            
                            <div>
                                <label className="block font-medium text-gray-800 mb-1">总结模型</label>
                                <select
                                    value={settings.summaryModel}
                                    onChange={(e) => setSetting('summaryModel', e.target.value)}
                                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    disabled
                                >
                                    {models.length === 0 ? (
                                        <option value={settings.summaryModel}>{settings.summaryModel}</option>
                                    ) : (
                                        models.map(model => (
                                            <option key={model.id} value={model.id}>
                                                {model.name}
                                            </option>
                                        ))
                                    )}
                                </select>
                                <p className="text-xs text-gray-600 mt-1">
                                    用于生成标题和总结的模型（建议使用较快的模型）
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Data Management */}
                    <div>
                        <h3 className="text-lg font-medium text-gray-800 mb-2">数据管理</h3>
                        <div className="bg-gray-100 p-3 rounded-md space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="font-medium text-gray-800">导出会话数据</span>
                                    <p className="text-xs text-gray-600 mt-0.5">备份所有会话和消息到 JSON 文件</p>
                                </div>
                                <button 
                                    onClick={handleExportData}
                                    className="bg-blue-500 hover:bg-blue-600 text-white py-1.5 px-4 rounded-md text-sm whitespace-nowrap"
                                >
                                    导出
                                </button>
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="font-medium text-gray-800">导入会话数据</span>
                                    <p className="text-xs text-gray-600 mt-0.5">从备份文件恢复会话数据</p>
                                </div>
                                <button 
                                    onClick={handleImportData}
                                    className="bg-green-500 hover:bg-green-600 text-white py-1.5 px-4 rounded-md text-sm whitespace-nowrap"
                                >
                                    导入
                                </button>
                            </div>
                            <div className="border-t border-gray-300 pt-3">
                                <div className="text-sm text-gray-700">
                                    <div className="font-medium mb-1">存储信息</div>
                                    {(() => {
                                        const info = getStorageInfo();
                                        if (!info) return <p className="text-xs text-gray-500">无法获取存储信息</p>;
                                        return (
                                            <div className="text-xs text-gray-600 space-y-0.5">
                                                <p>会话数量: {info.conversationCount}</p>
                                                <p>消息总数: {info.totalMessages}</p>
                                                <p>数据大小: {info.dataSizeKB}</p>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* System Prompt Setting */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-medium text-gray-800">系统提示词</h3>
                            <div className="relative" ref={tooltipRef}>
                                <InformationCircleIcon 
                                    className="h-5 w-5 text-gray-500 hover:text-gray-700 cursor-help"
                                    onMouseEnter={() => setShowTooltip(true)}
                                    onMouseLeave={() => {
                                        clearTimeout(timer);
                                        timer = setTimeout(() => setShowTooltip(false), 100);
                                    }}
                                />
                                {showTooltip && (
                                    <div 
                                        className="absolute left-0 top-6 z-50 w-80 bg-gray-900 text-white text-sm rounded-lg shadow-lg p-3"
                                        onMouseEnter={() => clearTimeout(timer)}
                                        onMouseLeave={() => {
                                            clearTimeout(timer);
                                            setShowTooltip(false);
                                        }}
                                    >
                                        <div className="font-semibold mb-2">可用占位符：</div>
                                        <div className="space-y-1.5">
                                            <div>
                                                <code className="bg-gray-800 px-1.5 py-0.5 rounded text-xs">{'{personaProfiles}'}</code>
                                                <span className="ml-2 text-gray-300">- 人设</span>
                                            </div>
                                            <div>
                                                <code className="bg-gray-800 px-1.5 py-0.5 rounded text-xs">{'{direction}'}</code>
                                                <span className="ml-2 text-gray-300">- 对话方向</span>
                                            </div>
                                            <div>
                                                <code className="bg-gray-800 px-1.5 py-0.5 rounded text-xs">{'{history}'}</code>
                                                <span className="ml-2 text-gray-300">- 对话历史</span>
                                            </div>
                                            <div>
                                                <code className="bg-gray-800 px-1.5 py-0.5 rounded text-xs">{'{instruction}'}</code>
                                                <span className="ml-2 text-gray-300">- 当前任务指令</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="bg-gray-100 p-3 rounded-md">
                            <textarea 
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                rows={8}
                                className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoComplete="off"
                            />
                            <div className="flex justify-end gap-2 mt-2">
                                <button onClick={handlePromptReset} className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-1 px-3 rounded-lg text-sm">
                                    重置为默认
                                </button>
                                <button onClick={handlePromptSave} className="bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded-lg text-sm">
                                    保存提示词
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GlobalSettings;