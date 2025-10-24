import React from 'react';
// fix: Corrected import path to resolve module.
import { Conversation, Persona } from '../types/index';
import PersonaAvatar from './PersonaAvatar';
import { XMarkIcon } from './icons/Icons';
import { AppSettings } from '../hooks/useAppSettings';

interface ConversationSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    conversation: Conversation;
    personas: Persona[];
    onUpdateConversation: (id: string, details: Partial<Pick<Conversation, 'activePersonaIds' | 'thinkingMode' | 'contextWindow'>>) => void;
    settings: AppSettings;
}

const ConversationSettingsModal: React.FC<ConversationSettingsModalProps> = ({ isOpen, onClose, conversation, personas, onUpdateConversation, settings }) => {
    if (!isOpen) return null;

    const togglePersonaInChat = (personaId: string) => {
        const currentIds = new Set(conversation.activePersonaIds);
        if (currentIds.has(personaId)) {
            currentIds.delete(personaId);
        } else {
            currentIds.add(personaId);
        }
        onUpdateConversation(conversation.id, { activePersonaIds: Array.from(currentIds) });
    };

    const activePersonasCount = conversation.activePersonaIds.length;
    
    // 检测当前对话模型是否支持思考模式
    const chatModelSupportsThinking = settings.chatModel.includes('thinking') || 
                                      settings.chatModel.includes('o1') || 
                                      settings.chatModel.includes('o3');

    return (
        <div className="fixed inset-0 bg-black/50 z-30 flex items-center justify-center" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-900">群聊设置</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-800">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">活跃人设</h3>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                        {personas.map(persona => (
                            <div key={persona.id} className="flex items-center justify-between bg-gray-100 p-3 rounded-md">
                                <div className="flex items-center gap-3">
                                    <PersonaAvatar src={persona.avatar} name={persona.name} size="sm" />
                                    <span className="font-medium text-gray-800">{persona.name}</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={conversation.activePersonaIds.includes(persona.id)} onChange={() => togglePersonaInChat(persona.id)} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                                </label>
                            </div>
                        ))}
                    </div>
                </div>
                <hr className="my-4" />
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">高级设置</h3>
                    <div className="bg-gray-100 p-3 rounded-md space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <span className="font-medium text-gray-800">思考模式</span>
                                <p className="text-xs text-gray-500">
                                    {chatModelSupportsThinking 
                                        ? '开启后，AI 会进行更深入的思考，回答可能更全面，但响应会稍慢。' 
                                        : '当前对话模型不支持思考模式，请在全局设置中选择支持的模型（如包含 thinking、o1、o3 的模型）。'}
                                </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={conversation.thinkingMode ?? true}
                                    onChange={(e) => onUpdateConversation(conversation.id, { thinkingMode: e.target.checked })}
                                    disabled={!chatModelSupportsThinking}
                                    className="sr-only peer"
                                />
                                <div className={`w-11 h-6 ${chatModelSupportsThinking ? 'bg-gray-300' : 'bg-gray-200 cursor-not-allowed'} peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${chatModelSupportsThinking ? 'peer-checked:bg-blue-500' : 'peer-checked:bg-gray-400'} ${!chatModelSupportsThinking ? 'opacity-50' : ''}`}></div>
                            </label>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="font-medium text-gray-800">上下文消息数</span>
                                <p className="text-xs text-gray-500">保留最近N条消息原文，旧消息将被总结。范围1-50。</p>
                            </div>
                            <input
                                type="number"
                                value={conversation.contextWindow ?? 10}
                                onChange={(e) => onUpdateConversation(conversation.id, { contextWindow: Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 10)) })}
                                className="w-20 bg-white border border-gray-300 rounded-md px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                                min="1"
                                max="50"
                                autoComplete="off"
                            />
                        </div>
                    </div>
                </div>
                <p className="text-sm text-gray-500 mt-4">
                    {activePersonasCount > 0 ? `当前有 ${activePersonasCount} 位人设在群聊中。` : '请至少选择一位人设参与群聊。'}
                </p>
            </div>
        </div>
    );
};

export default ConversationSettingsModal;