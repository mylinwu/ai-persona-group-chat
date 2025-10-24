import { GoogleGenAI } from "@google/genai";
// fix: Corrected import path to resolve module.
import { Persona, ChatMessage, Conversation } from '../types/index';
// fix: Corrected import path to resolve module.
import { DEFAULT_SYSTEM_PROMPT } from "../constants/index";

if (!process.env.API_KEY) {
    console.warn("API_KEY environment variable not set. Using a placeholder. Please set your API key for the app to function.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || 'YOUR_API_KEY_HERE' });

const formatConversationHistory = (messages: ChatMessage[], contextWindow: number): string => {
  const threshold = contextWindow || 10;
  
  const recentMessages = messages.slice(-threshold);
  const olderMessages = messages.slice(0, -threshold);

  const formatMessage = (msg: ChatMessage, useSummary: boolean): string => {
    const prefix = msg.sender === 'user' ? '用户' : msg.sender;
    const content = useSummary 
      ? (msg.summary || `(总结) ${msg.text.substring(0, 50)}...`)
      : msg.text;
    return `${prefix}: ${content}`;
  };

  const olderHistory = olderMessages.map(msg => formatMessage(msg, true)).join('\n');
  const recentHistory = recentMessages.map(msg => formatMessage(msg, false)).join('\n');

  if (olderHistory && recentHistory) {
    return `${olderHistory}\n\n(--- 部分历史记录为AI总结 ---)\n\n${recentHistory}`;
  }
  return olderHistory || recentHistory;
};

function constructPrompt(
  conversation: Conversation,
  activePersonas: Persona[],
  baseSystemPrompt: string,
  nextSpeaker?: string | 'AI_CHOICE'
): string {
  const { direction } = conversation;
  
  const history = formatConversationHistory(conversation.messages, conversation.contextWindow);

  const personaProfiles = activePersonas
    .map(
      (p) => `---
**姓名:** ${p.name}
**人设简介:** ${p.prompt}
---`
    )
    .join('\n');

  let instruction =
    "分析用户的最新问题和对话历史，从下方“活跃人设”中选择一位最合适的角色进行回答。";

  if (nextSpeaker === 'AI_CHOICE') {
    instruction =
      "用户让你来决定谁来接话。请分析对话历史，选择一个最合理的角色，以其口吻和风格延续对话。";
  } else if (nextSpeaker) {
    instruction = `用户指定了由 **${nextSpeaker}** 来回答。你必须使用 ${nextSpeaker} 的人设、口吻和风格来生成回应。`;
  }
  
  const finalPrompt = (baseSystemPrompt || DEFAULT_SYSTEM_PROMPT)
    .replace('{{personaProfiles}}', personaProfiles)
    .replace('{{direction}}', direction)
    .replace('{{history}}', history)
    .replace('{{instruction}}', instruction);

  return finalPrompt;
}

export const getAiResponseStream = async (
  conversation: Conversation,
  activePersonas: Persona[],
  baseSystemPrompt: string,
  nextSpeaker?: string | 'AI_CHOICE'
) => {
  if (!process.env.API_KEY) {
      throw new Error('Error: API_KEY is not configured. Please set it up to use the AI features.');
  }
  
  if (activePersonas.length === 0) {
     throw new Error('错误：没有活跃的人设参与群聊。请在设置中至少选择一位。');
  }
  
  const prompt = constructPrompt(conversation, activePersonas, baseSystemPrompt, nextSpeaker);
  
  const modelParams: { model: string, contents: string, config?: any } = {
    model: 'gemini-2.5-flash',
    contents: prompt,
  };

  if (conversation.thinkingMode) {
    modelParams.config = {
        thinkingConfig: { thinkingBudget: 8192 }
    };
  }

  try {
    const response = await ai.models.generateContentStream(modelParams);
    return response;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error('调用AI服务时出错，请检查API密钥或稍后再试。');
  }
};

export const generateTitle = async (messages: ChatMessage[]): Promise<string> => {
   if (!process.env.API_KEY) {
      throw new Error('Cannot generate title: API_KEY is not configured.');
  }
  const history = messages
    .slice(-4) // Use last 4 messages for context
    .map((msg) => `${msg.sender === 'user' ? '用户' : msg.sender}: ${msg.text}`)
    .join('\n');
  
  const prompt = `根据以下对话内容，生成一个简洁的、不超过10个字的中文标题。\n\n对话内容：\n${history}\n\n标题：`;

  const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
  });
  return response.text.trim().replace(/["'“”]/g, '').replace(/[.。]$/, '');
};

export const summarizeText = async (text: string): Promise<string> => {
  if (!process.env.API_KEY) {
      throw new Error('Cannot summarize text: API_KEY is not configured.');
  }
  const prompt = `请将以下文本总结为一段简洁的核心摘要，保留关键信息和语气，用于后续的AI上下文参考。\n\n文本：\n${text}\n\n摘要：`;
  const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
  });
  return response.text.trim();
};