import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
// fix: Corrected import path to resolve module.
import { Persona, Conversation } from '../types/index';
// fix: Corrected import path to resolve module.
import { CONVERSATION_DIRECTIONS } from '../constants/index';
import PersonaAvatar from './PersonaAvatar';
import ConversationSettingsModal from './ConversationSettingsModal';
import { useChatInput } from '../hooks/useChatInput';
import { formatShortcut } from '../utils/shortcutFormatter';
import { ArrowUpIcon, SparklesIcon, Cog6ToothIcon, ChevronDownIcon } from './icons/Icons';

interface ChatViewProps {
  conversation: Conversation | undefined;
  personas: Persona[];
  isStretched: boolean;
  isLoading: boolean;
  onSendMessage: (options: { userMessage?: string, nextSpeaker?: string | 'AI_CHOICE' }) => Promise<void>;
  onUpdateConversation: (id: string, details: Partial<Pick<Conversation, 'activePersonaIds' | 'direction' | 'thinkingMode' | 'contextWindow'>>) => void;
  aiContinueShortcut: string;
  fontFamily: string;
  fontSize: number;
}

const ChatView: React.FC<ChatViewProps> = ({ conversation, personas, isStretched, isLoading, onSendMessage, onUpdateConversation, aiContinueShortcut, fontFamily, fontSize }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDirectionDropdownOpen, setIsDirectionDropdownOpen] = useState(false);
  
  const activePersonas = personas.filter(p => conversation?.activePersonaIds.includes(p.id));
  const chatInput = useChatInput(activePersonas);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const directionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (directionRef.current && !directionRef.current.contains(event.target as Node)) {
            setIsDirectionDropdownOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleSendMessage = () => {
    if (chatInput.input.trim()) {
      onSendMessage({ userMessage: chatInput.input });
      chatInput.setInput('');
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (!conversation) return;
    const result = chatInput.completeSuggestion(suggestion);
    if (!result) return;
    
    if (result.type === '#') {
      onUpdateConversation(conversation.id, { direction: suggestion });
      chatInput.setInput(result.newInputValue);
    } else {
      chatInput.setInput(result.newInputValue);
    }
    
    chatInput.setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (chatInput.showSuggestions) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            chatInput.setActiveSuggestionIndex(prev => (prev + 1) % chatInput.suggestions.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            chatInput.setActiveSuggestionIndex(prev => (prev - 1 + chatInput.suggestions.length) % chatInput.suggestions.length);
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            handleSuggestionClick(chatInput.suggestions[chatInput.activeSuggestionIndex]);
        } else if (e.key === 'Escape') {
            chatInput.setShowSuggestions(false);
        }
    } else {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    }
  };
  
  const handleDirectionChange = (newDirection: string) => {
    if (conversation) {
        onUpdateConversation(conversation.id, { direction: newDirection });
        setIsDirectionDropdownOpen(false);
    }
  };

  const MarkdownComponents = {
    p: ({node, ...props}: any) => <p className="mb-2 last:mb-0" {...props} />,
    a: ({node, ...props}: any) => <a className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
    ul: ({node, ...props}: any) => <ul className="list-disc list-inside space-y-1" {...props} />,
    ol: ({node, ...props}: any) => <ol className="list-decimal list-inside space-y-1" {...props} />,
    pre: ({node, ...props}: any) => <pre className="bg-gray-100 p-2 rounded-md overflow-x-auto text-sm my-2" {...props} />,
    code: ({node, inline, ...props}: any) => <code className={`font-mono text-sm ${!inline ? 'text-white' : 'bg-gray-100 text-red-600 rounded px-1 py-0.5'}`} {...props} />,
  };
  
  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
        <h2 className="text-2xl font-semibold">开始新对话</h2>
        <p className="mt-2">从左侧选择一个对话，或创建一个新对话开始聊天。</p>
      </div>
    );
  }
  
  const containerClass = isStretched ? "w-full" : "max-w-3xl mx-auto";
  const messages = conversation.messages;
  
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className={`${containerClass} space-y-6`}>
          {messages.map((msg) => (
            <div key={msg.id} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
              {msg.sender !== 'user' && <PersonaAvatar src={msg.avatar} name={msg.sender} />}
              <div className={`flex flex-col ${isStretched ? 'max-w-4xl' : 'max-w-2xl'} ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                {msg.sender !== 'user' && <p className="text-sm font-semibold text-gray-600 mb-1">{msg.sender}</p>}
                <div 
                  className={`px-4 py-2 rounded-2xl ${msg.sender === 'user' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none border border-gray-200'}`}
                  style={{ fontFamily: fontFamily, fontSize: `${fontSize}px` }}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                    {msg.text}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length-1]?.sender !== 'user' && ( <div /> /* Handled by streaming */)}
          {isLoading && (!messages.length || messages[messages.length-1]?.sender === 'user') && (
             <div className="flex items-start gap-3">
                <PersonaAvatar src={{ icon: '⏳', bgColor: '#f1f5f9', color: '#475569' }} name="AI" />
                <div className="flex flex-col items-start max-w-lg">
                    <p className="text-sm font-semibold text-gray-600 mb-1">AI 正在思考...</p>
                    <div className="px-4 py-2 rounded-2xl bg-gray-100 border border-gray-200 text-gray-800 rounded-bl-none">
                        <div className="flex items-center space-x-2 py-2">
                            <span className="h-2 w-2 bg-blue-500 rounded-full animate-pulse [animation-delay:-0.3s]"></span>
                            <span className="h-2 w-2 bg-blue-500 rounded-full animate-pulse [animation-delay:-0.15s]"></span>
                            <span className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></span>
                        </div>
                    </div>
                </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      <div className="bg-white/80 backdrop-blur-md sticky bottom-0 border-t border-gray-200 p-4 sm:p-6">
        <div className={`${containerClass} relative`}>
          {chatInput.showSuggestions && (
            <div className="absolute bottom-full mb-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
              <ul>
                {chatInput.suggestions.map((s, index) => (
                  <li 
                    key={s} 
                    className={`px-4 py-2 cursor-pointer ${index === chatInput.activeSuggestionIndex ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                    onClick={() => handleSuggestionClick(s)}
                  >
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <div className="relative" ref={directionRef}>
                <button 
                    onClick={() => setIsDirectionDropdownOpen(prev => !prev)}
                    className="flex items-center gap-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded-md transition-colors border border-gray-200"
                >
                    <span>话题方向:</span>
                    <span className="font-semibold">{conversation.direction}</span>
                    <ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform ${isDirectionDropdownOpen ? 'transform rotate-180' : ''}`} />
                </button>

                {isDirectionDropdownOpen && (
                    <div className="absolute bottom-full mb-2 w-full min-w-[150px] bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                    <ul>
                        {CONVERSATION_DIRECTIONS.map((direction) => (
                        <li 
                            key={direction} 
                            className={`px-4 py-2 cursor-pointer text-sm ${conversation.direction === direction ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}
                            onClick={() => handleDirectionChange(direction)}
                        >
                            {direction}
                        </li>
                        ))}
                    </ul>
                    </div>
                )}
            </div>
            <button onClick={() => onSendMessage({ nextSpeaker: 'AI_CHOICE' })} disabled={isLoading} className="flex items-center gap-2 text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-800 px-3 py-1.5 rounded-md transition-colors border border-gray-200">
              <SparklesIcon className="h-4 w-4" />
              让 AI 接话
              <span className="text-gray-400 text-xs font-mono">({formatShortcut(aiContinueShortcut)})</span>
            </button>
            <button onClick={() => setIsSettingsOpen(true)} className="flex items-center gap-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded-md transition-colors border border-gray-200">
              <Cog6ToothIcon className="h-4 w-4" />
              群聊设置
            </button>
          </div>
          <div className="flex items-center gap-2 bg-gray-100 p-2 rounded-lg border border-gray-200 focus-within:ring-2 focus-within:ring-blue-500">
            <input
              ref={inputRef}
              type="text"
              value={chatInput.input}
              onChange={chatInput.handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={activePersonas.length > 0 ? `输入消息，或 @${activePersonas[0].name} 或 #${CONVERSATION_DIRECTIONS[1]}...` : "请先在设置中添加人设"}
              disabled={isLoading || activePersonas.length === 0}
              className="w-full bg-transparent focus:outline-none text-gray-800 placeholder-gray-400 px-2"
              autoComplete="off"
            />
            <button onClick={handleSendMessage} disabled={isLoading || !chatInput.input.trim()} className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed text-white p-2 rounded-md transition-colors">
              <ArrowUpIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <ConversationSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        conversation={conversation}
        personas={personas}
        onUpdateConversation={onUpdateConversation}
      />
    </div>
  );
};

export default ChatView;