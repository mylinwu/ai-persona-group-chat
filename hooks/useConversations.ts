import { useState, useEffect, useCallback } from 'react';
// fix: Corrected import path to resolve module.
import { Persona, Conversation, ChatMessage } from '../types/index';
import { getAiResponseStream, parsePersonaFromText } from '../services/aiService';
import { getConversationTitle, summarizeMessageIfNeeded } from '../services/conversationManager';
// fix: Corrected import path to resolve module.
import { CONVERSATION_DIRECTIONS, NEW_CONVERSATION_TITLE, DEFAULT_CONTEXT_WINDOW } from '../constants/index';
import { db } from '../utils/db';

export const useConversations = (personas: Persona[], baseSystemPrompt: string) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // 初始化:从数据库加载会话
  useEffect(() => {
    try {
      const storedConvos = db.getConversations();

      if (storedConvos.length === 0) {
        // 没有会话存在,创建一个新的
        const newConversation: Conversation = {
          id: new Date().toISOString(),
          title: NEW_CONVERSATION_TITLE,
          messages: [],
          createdAt: Date.now(),
          pinned: false,
          activePersonaIds: personas.map(p => p.id),
          direction: CONVERSATION_DIRECTIONS[0],
          thinkingMode: true,
          contextWindow: DEFAULT_CONTEXT_WINDOW,
        };
        setConversations([newConversation]);
        setActiveConversationId(newConversation.id);
        db.saveConversations([newConversation]);
        db.saveActiveConversationId(newConversation.id);
      } else {
        setConversations(storedConvos);
        const storedActiveId = db.getActiveConversationId();
        // 设置激活的会话,如果存储的 ID 有效则使用,否则使用第一个
        if (storedActiveId && storedConvos.some((c: Conversation) => c.id === storedActiveId)) {
          setActiveConversationId(storedActiveId);
        } else {
          setActiveConversationId(storedConvos[0].id);
          db.saveActiveConversationId(storedConvos[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading conversations from database, starting with a fresh conversation.', error);
      // 如果存储损坏或失败,创建一个新会话
      const newConversation: Conversation = {
        id: new Date().toISOString(),
        title: NEW_CONVERSATION_TITLE,
        messages: [],
        createdAt: Date.now(),
        pinned: false,
        activePersonaIds: personas.map(p => p.id),
        direction: CONVERSATION_DIRECTIONS[0],
        thinkingMode: true,
        contextWindow: DEFAULT_CONTEXT_WINDOW,
      };
      setConversations([newConversation]);
      setActiveConversationId(newConversation.id);
    } finally {
      // 标记初始化完成
      setIsInitialized(true);
    }
  }, []);

  // 自动保存:会话或激活 ID 变化时保存到数据库
  // 只在初始化完成后才保存,避免在加载数据前保存空数组
  useEffect(() => {
    if (!isInitialized) return;
    
    db.saveConversations(conversations);
    db.saveActiveConversationId(activeConversationId);
  }, [conversations, activeConversationId, isInitialized]);
  
  const addConversation = () => {
    const newConversation: Conversation = {
      id: new Date().toISOString(),
      title: NEW_CONVERSATION_TITLE,
      messages: [],
      createdAt: Date.now(),
      pinned: false,
      activePersonaIds: personas.map(p => p.id),
      direction: CONVERSATION_DIRECTIONS[0],
      thinkingMode: true,
      contextWindow: DEFAULT_CONTEXT_WINDOW,
    };
    setConversations(prev => [newConversation, ...prev]);
    setActiveConversationId(newConversation.id);
  };

  const deleteConversation = (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConversationId === id) {
      setActiveConversationId(conversations.find(c => c.id !== id)?.id || null);
    }
  };

  const updateConversation = useCallback((id: string, updatedFields: Partial<Conversation>) => {
    setConversations(prev => prev.map(c => (c.id === id ? { ...c, ...updatedFields } : c)));
  }, []);

  const clearAllConversations = () => {
    if (window.confirm('您确定要删除所有会话吗？此操作无法撤销。')) {
      db.clearAllConversations();
      setConversations([]);
      setActiveConversationId(null);
    }
  };
  
  const updateConversationDetails = (id: string, details: Partial<Pick<Conversation, 'activePersonaIds' | 'direction' | 'thinkingMode' | 'contextWindow'>>) => {
      updateConversation(id, details);
  };
  
  const updateConversationTitle = (id: string, title: string) => {
      updateConversation(id, { title });
  };
  
  const pinConversation = (id: string, pinned: boolean) => {
      updateConversation(id, { pinned });
  };

  const sendMessage = useCallback(async ({ userMessage, nextSpeaker }: { userMessage?: string, nextSpeaker?: string | 'AI_CHOICE' }) => {
    if (!activeConversationId) return;

    const conv = conversations.find(c => c.id === activeConversationId);
    if (!conv) return;

    const trimmedMessage = userMessage?.trim();
    if (!trimmedMessage && !nextSpeaker) return;

    setIsLoading(true);
    
    let currentMessages = [...conv.messages];

    if (trimmedMessage) {
        const userMessageId = `${Date.now()}-user`;
        const messageToAdd: ChatMessage = { id: userMessageId, sender: 'user', text: trimmedMessage };
        currentMessages.push(messageToAdd);
        updateConversation(activeConversationId, { messages: currentMessages });

        // Background summarization for user message
        summarizeMessageIfNeeded(messageToAdd).then(summary => {
            if (summary) {
                setConversations(prev => prev.map(c => {
                    if (c.id !== activeConversationId) return c;
                    return { ...c, messages: c.messages.map(m => m.id === userMessageId ? { ...m, summary } : m) };
                }));
            }
        });
    }

    const mentionMatch = trimmedMessage?.match(/@(\S+)/);
    let finalNextSpeaker = nextSpeaker;
    const activePersonas = personas.filter(p => conv.activePersonaIds.includes(p.id));

    if (mentionMatch) {
      const mentionedName = mentionMatch[1];
      const mentionedPersona = activePersonas.find(p => p.name === mentionedName);
      if (mentionedPersona) {
        finalNextSpeaker = mentionedPersona.name;
      }
    }

    // 立即添加"思考中"占位消息，提供即时反馈
    const thinkingMessageId = `${Date.now()}-thinking`;
    const thinkingMessage: ChatMessage = {
        id: thinkingMessageId,
        sender: 'AI',
        text: '思考中...',
        avatar: { icon: '💭', bgColor: '#f1f5f9', color: '#64748b' }
    };
    currentMessages.push(thinkingMessage);
    updateConversation(activeConversationId, { messages: currentMessages });

    try {
        const updatedConv = { ...conv, messages: currentMessages };

        const stream = await getAiResponseStream(
            updatedConv,
            activePersonas,
            baseSystemPrompt,
            finalNextSpeaker
        );

        let messageId: string | null = null;
        let aiMessageText = '';
        
        for await (const chunkText of stream) {
            if (chunkText) {
                aiMessageText += chunkText;
                if (!messageId) {
                    messageId = `${Date.now()}-ai`;
                    
                    // 使用新的解析函数
                    const parsed = parsePersonaFromText(aiMessageText, activePersonas);
                    const sender = parsed.personaName || 'AI';
                    const avatar = parsed.personaName 
                        ? activePersonas.find(p => p.name === parsed.personaName)?.avatar || { icon: '⏳', bgColor: '#f1f5f9', color: '#475569' }
                        : { icon: '⏳', bgColor: '#f1f5f9', color: '#475569' };
                    const text = parsed.cleanedText || aiMessageText;

                    // 替换"思考中"消息为实际 AI 回复
                    setConversations(prev => prev.map(c => {
                        if (c.id !== activeConversationId) return c;
                        const messagesWithoutThinking = c.messages.filter(m => m.id !== thinkingMessageId);
                        return { ...c, messages: [...messagesWithoutThinking, { id: messageId!, sender, text, avatar }] };
                    }));
                } else {
                    setConversations(prev => prev.map(c => {
                        if (c.id !== activeConversationId) return c;
                        const lastMsg = c.messages[c.messages.length - 1];
                        if (lastMsg?.id === messageId) {
                             const fullText = lastMsg.text + chunkText;
                             return { ...c, messages: [...c.messages.slice(0, -1), { ...lastMsg, text: fullText }] };
                        }
                        return c;
                    }));
                }
            }
        }
        
        // Final processing to correct speaker name, generate title, and summarize
        let finalAiMessage: ChatMessage | null = null;
        setConversations(prev => {
          const finalConvos = prev.map(c => {
            if (c.id !== activeConversationId) return c;
            
            let lastMsg = c.messages[c.messages.length-1];
            if(lastMsg && lastMsg.id === messageId) {
                // 使用新的解析函数进行最终处理
                const parsed = parsePersonaFromText(lastMsg.text, activePersonas);
                if (parsed.personaName) {
                    lastMsg.sender = parsed.personaName;
                    lastMsg.text = parsed.cleanedText;
                    const persona = activePersonas.find(p => p.name === parsed.personaName);
                    if (persona) {
                        lastMsg.avatar = persona.avatar;
                    }
                }
            }
            finalAiMessage = lastMsg;
            return c;
          });

          return finalConvos;
        });

        // Background summarization for AI message
        if (finalAiMessage) {
            summarizeMessageIfNeeded(finalAiMessage).then(summary => {
                if (summary && finalAiMessage?.id) {
                     setConversations(prev => prev.map(c => {
                        if (c.id !== activeConversationId) return c;
                        return { ...c, messages: c.messages.map(m => m.id === finalAiMessage!.id ? { ...m, summary } : m) };
                    }));
                }
            });
        }

    } catch (error: any) {
        // 移除"思考中"消息
        setConversations(prev => prev.map(c => {
            if (c.id !== activeConversationId) return c;
            const messagesWithoutThinking = c.messages.filter(m => m.id !== thinkingMessageId);
            return { ...c, messages: messagesWithoutThinking };
        }));
        
        // 添加错误消息
        const errorMsg: ChatMessage = {
            id: `${Date.now()}-error`,
            sender: '系统',
            text: error.message || '发生错误，请重试。',
            avatar: { icon: '⚙️', bgColor: '#fee2e2', color: '#991b1b' },
        };
        
        setConversations(prev => prev.map(c => {
            if (c.id !== activeConversationId) return c;
            const messagesWithoutThinking = c.messages.filter(m => m.id !== thinkingMessageId);
            return { ...c, messages: [...messagesWithoutThinking, errorMsg] };
        }));
    } finally {
        setIsLoading(false);
        
        // 在对话生成完成后,检查是否需要生成标题
        // 要求:至少3条消息,且标题仍为默认标题
        const currentConv = conversations.find(c => c.id === activeConversationId);
        if (currentConv && 
            currentConv.title === NEW_CONVERSATION_TITLE && 
            currentConv.messages.length >= 3) {
          // 使用前3条消息生成标题
          const messagesToUse = currentConv.messages.slice(0, 3);
          getConversationTitle(messagesToUse).then(title => {
            if (title && title !== NEW_CONVERSATION_TITLE) {
              updateConversation(activeConversationId, { title });
            }
          }).catch(err => {
            console.error('Failed to generate title:', err);
          });
        }
    }
  }, [activeConversationId, conversations, personas, baseSystemPrompt, updateConversation]);

  return {
    conversations,
    activeConversationId,
    setActiveConversationId,
    addConversation,
    deleteConversation,
    updateConversationTitle,
    pinConversation,
    clearAllConversations,
    updateConversationDetails,
    sendMessage,
    isLoading
  };
};