// fix: Corrected import path to resolve module.
import { ChatMessage } from '../types/index';
import { summarizeText, generateTitle } from './aiService';
// fix: Corrected import path to resolve module.
import { NEW_CONVERSATION_TITLE } from '../constants/index';

const SUMMARY_CHAR_THRESHOLD = 100;

export const summarizeMessageIfNeeded = async (message: ChatMessage): Promise<string | null> => {
  if (message.text.length > SUMMARY_CHAR_THRESHOLD) {
    try {
      const summary = await summarizeText(message.text);
      return summary;
    } catch (error) {
      console.error('Failed to summarize message:', error);
      return null; // Don't block on failure, just return null
    }
  }
  return null;
};

export const getConversationTitle = async (messages: ChatMessage[]): Promise<string> => {
    if (messages.length < 2) {
      return NEW_CONVERSATION_TITLE;
    }
    try {
        const title = await generateTitle(messages);
        return title;
    } catch (error) {
        console.error("Error generating title:", error);
        return "对话"; // Fallback title
    }
};