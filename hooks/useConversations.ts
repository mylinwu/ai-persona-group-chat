import { useState, useEffect, useCallback } from 'react';
// fix: Corrected import path to resolve module.
import { Persona, Conversation, ChatMessage } from '../types/index';
import { getAiResponseStream } from '../services/geminiService';
import { getConversationTitle, summarizeMessageIfNeeded } from '../services/conversationManager';
// fix: Corrected import path to resolve module.
import { CONVERSATION_DIRECTIONS, NEW_CONVERSATION_TITLE, DEFAULT_CONTEXT_WINDOW } from '../constants/index';

const CONVERSATIONS_STORAGE_KEY = 'ai-persona-chat-conversations';
const ACTIVE_CONV_ID_STORAGE_KEY = 'ai-persona-chat-active-id';

export const useConversations = (personas: Persona[], baseSystemPrompt: string) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
      const storedConvos = stored ? JSON.parse(stored) : [];
      
      const migratedConvos = storedConvos.map((convo: any) => ({
          ...convo,
          thinkingMode: convo.thinkingMode ?? true,
          contextWindow: convo.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
      }));

      if (migratedConvos.length === 0) {
        // No conversations exist, so create a new one to start.
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
      } else {
        setConversations(migratedConvos);
        const storedActiveId = window.localStorage.getItem(ACTIVE_CONV_ID_STORAGE_KEY);
        // Set active conversation to the stored one, or fallback to the first one.
        if (storedActiveId && migratedConvos.some((c: Conversation) => c.id === storedActiveId)) {
          setActiveConversationId(storedActiveId);
        } else {
          setActiveConversationId(migratedConvos[0].id);
        }
      }
    } catch (error) {
      console.error('Error reading from localStorage, starting with a fresh conversation.', error);
      // If storage is corrupted or fails, start with a single fresh conversation.
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
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(conversations));
      if (activeConversationId) {
        window.localStorage.setItem(ACTIVE_CONV_ID_STORAGE_KEY, activeConversationId);
      } else {
        window.localStorage.removeItem(ACTIVE_CONV_ID_STORAGE_KEY);
      }
    } catch (error) {
      console.error('Error writing to localStorage', error);
    }
  }, [conversations, activeConversationId]);
  
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
        
        for await (const chunk of stream) {
            const chunkText = chunk.text;
            if (chunkText) {
                aiMessageText += chunkText;
                if (!messageId) {
                    messageId = `${Date.now()}-ai`;
                    let sender = 'AI';
                    let avatar = { icon: '⏳', bgColor: '#f1f5f9', color: '#475569' };
                    let text = aiMessageText;

                    for (const persona of activePersonas) {
                        if (text.trim().startsWith(`${persona.name}:`)) {
                            sender = persona.name;
                            avatar = persona.avatar;
                            text = text.trim().substring(persona.name.length + 1).trimStart();
                            break;
                        }
                    }

                    setConversations(prev => prev.map(c => 
                        c.id === activeConversationId ? { ...c, messages: [...currentMessages, { id: messageId!, sender, text, avatar }] } : c
                    ));
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
                const fullText = lastMsg.text;
                for (const persona of activePersonas) {
                    const prefix = `${persona.name}:`;
                    if (fullText.trim().startsWith(prefix)) {
                        lastMsg.sender = persona.name;
                        lastMsg.text = fullText.trim().substring(prefix.length).trim();
                        lastMsg.avatar = persona.avatar;
                        break;
                    }
                }
            }
            finalAiMessage = lastMsg;
            return c;
          });

          const currentConv = finalConvos.find(c => c.id === activeConversationId);
          if (currentConv) {
             // Auto-generate title
            if (currentConv.title === NEW_CONVERSATION_TITLE && currentConv.messages.length >= 2) {
              getConversationTitle(currentConv.messages).then(title => {
                if (title && title !== NEW_CONVERSATION_TITLE) {
                  updateConversation(activeConversationId, { title });
                }
              });
            }
          }
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
        const errorMsg: ChatMessage = {
            id: `${Date.now()}-error`,
            sender: '系统',
            text: error.message || '发生错误，请重试。',
            avatar: { icon: '⚙️', bgColor: '#fee2e2', color: '#991b1b' },
        };
        updateConversation(activeConversationId, { messages: [...currentMessages, errorMsg] });
    } finally {
        setIsLoading(false);
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