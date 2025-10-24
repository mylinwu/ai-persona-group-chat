import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText, generateText } from 'ai';
import { Persona, ChatMessage, Conversation } from '../types/index';
import { DEFAULT_SYSTEM_PROMPT } from "../constants/index";

let currentApiKey = '';
let currentChatModel = 'qwen/qwen3-30b-a3b';
let currentSummaryModel = 'qwen/qwen3-8b';

export const initializeAIService = (apiKey: string, chatModel: string, summaryModel: string) => {
  currentApiKey = apiKey;
  currentChatModel = chatModel;
  currentSummaryModel = summaryModel;
};

const getOpenRouter = () => {
  if (!currentApiKey) {
    throw new Error('OpenRouter API Key 未设置。请在全局设置中配置。');
  }
  return createOpenRouter({ apiKey: currentApiKey });
};

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

// 将一次性文本结果包装为一个简单的异步可迭代流
async function* singleChunkStream(text: string) {
  if (text) {
    yield text;
  }
}

// 包装流,在迭代时捕获类型校验错误并回退到非流式
async function* wrapStreamWithFallback(
  textStream: AsyncIterable<string>,
  prompt: string,
  openrouter: ReturnType<typeof getOpenRouter>
): AsyncIterable<string> {
  try {
    for await (const chunk of textStream) {
      yield chunk;
    }
  } catch (error) {
    console.error("Stream iteration error:", error);
    const message = (error as any)?.message || '';
    const isValidationOrTransformError =
      message.includes('Type validation failed') ||
      message.includes('Invalid input') ||
      message.includes('safeParseJSON') ||
      message.includes('transform');

    if (isValidationOrTransformError) {
      console.warn('检测到流式数据类型校验错误,回退到非流式生成...');
      try {
        const { text } = await generateText({
          model: openrouter.chat(currentChatModel),
          prompt,
          temperature: 0.7,
        });
        yield text;
        return;
      } catch (fallbackErr) {
        console.error('Fallback generateText failed:', fallbackErr);
        throw new Error('AI 服务回退失败,请稍后重试。');
      }
    }
    
    throw error;
  }
}

export const getAiResponseStream = async (
  conversation: Conversation,
  activePersonas: Persona[],
  baseSystemPrompt: string,
  nextSpeaker?: string | 'AI_CHOICE'
) => {
  if (!currentApiKey) {
    throw new Error('OpenRouter API Key 未设置。请在全局设置中配置。');
  }
  
  if (activePersonas.length === 0) {
    throw new Error('错误：没有活跃的人设参与群聊。请在设置中至少选择一位。');
  }
  
  const prompt = constructPrompt(conversation, activePersonas, baseSystemPrompt, nextSpeaker);
  const openrouter = getOpenRouter();

  try {
    const result = await streamText({
      model: openrouter.chat(currentChatModel),
      prompt: prompt,
      temperature: 0.7,
    });

    // 包装流以捕获迭代时的错误
    return wrapStreamWithFallback(result.textStream, prompt, openrouter);
  } catch (error) {
    console.error("Error calling OpenRouter API:", error);
    throw new Error('调用AI服务时出错,请检查API密钥或稍后再试。');
  }
};

export const generateTitle = async (messages: ChatMessage[]): Promise<string> => {
  if (!currentApiKey) {
    throw new Error('OpenRouter API Key 未设置。');
  }
  
  const history = messages
    .slice(-4)
    .map((msg) => `${msg.sender === 'user' ? '用户' : msg.sender}: ${msg.text}`)
    .join('\n');
  
  const prompt = `根据以下对话内容，生成一个简洁的、不超过10个字的中文标题。\n\n对话内容：\n${history}\n\n标题：`;
  
  const openrouter = getOpenRouter();
  
  const { text } = await generateText({
    model: openrouter.chat(currentSummaryModel),
    prompt: prompt,
    temperature: 0.5,
  });
  
  return text.trim().replace(/["'""]/g, '').replace(/[.。]$/, '');
};

export const summarizeText = async (text: string): Promise<string> => {
  if (!currentApiKey) {
    throw new Error('OpenRouter API Key 未设置。');
  }
  
  const prompt = `请将以下文本总结为一段简洁的核心摘要，保留关键信息和语气，用于后续的AI上下文参考。\n\n文本：\n${text}\n\n摘要：`;
  
  const openrouter = getOpenRouter();
  
  const { text: summaryText } = await generateText({
    model: openrouter.chat(currentSummaryModel),
    prompt: prompt,
    temperature: 0.3,
  });
  
  return summaryText.trim();
};