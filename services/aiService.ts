import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText, generateText } from 'ai';
import { Persona, ChatMessage, Conversation } from '../types/index';
import { DEFAULT_SYSTEM_PROMPT } from "../constants/index";

// 配置常量
const STREAM_TIMEOUT_MS = 60000; // 60秒流式超时
const CHUNK_TIMEOUT_MS = 10000; // 10秒单个chunk超时
const MAX_RETRIES = 2; // 最大重试次数
const RETRY_DELAY_MS = 1000; // 重试延迟

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

// 工具函数：延迟
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 工具函数：带超时的Promise包装
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
};

// 工具函数：从用户输入中提取所有 @ 提及的角色名
export const extractMentionedPersonas = (
  text: string,
  activePersonas: Persona[]
): Persona[] => {
  if (!text || !text.trim()) {
    return [];
  }

  // 匹配所有 @角色名 格式（支持中英文、数字、下划线）
  const mentionPattern = /@([\u4e00-\u9fa5a-zA-Z0-9_]+)/g;
  const matches = text.matchAll(mentionPattern);
  const mentionedPersonas: Persona[] = [];
  const seenNames = new Set<string>();

  for (const match of matches) {
    const mentionedName = match[1];
    
    // 精确匹配
    const persona = activePersonas.find(p => p.name === mentionedName);
    if (persona && !seenNames.has(persona.name)) {
      mentionedPersonas.push(persona);
      seenNames.add(persona.name);
      continue;
    }
    
    // 模糊匹配（忽略空格）
    const fuzzyPersona = activePersonas.find(p => 
      p.name.replace(/\s/g, '') === mentionedName.replace(/\s/g, '')
    );
    if (fuzzyPersona && !seenNames.has(fuzzyPersona.name)) {
      mentionedPersonas.push(fuzzyPersona);
      seenNames.add(fuzzyPersona.name);
    }
  }

  return mentionedPersonas;
};

// 工具函数：解析人物名称（容错处理）
export const parsePersonaFromText = (
  text: string,
  activePersonas: Persona[]
): { personaName: string | null; cleanedText: string } => {
  if (!text || !text.trim()) {
    return { personaName: null, cleanedText: text };
  }

  const trimmedText = text.trim();
  
  // 尝试多种格式的匹配
  const patterns = [
    // 标准格式：人物名: 内容
    /^([^:\n]+?):\s*(.*)$/s,
    // 加粗格式：**人物名**: 内容
    /^\*\*([^*:\n]+?)\*\*:\s*(.*)$/s,
    // 加粗格式2：**人物名:**内容
    /^\*\*([^*:\n]+?):\*\*\s*(.*)$/s,
    // 中文冒号：人物名：内容
    /^([^：\n]+?)：\s*(.*)$/s,
  ];

  for (const pattern of patterns) {
    const match = trimmedText.match(pattern);
    if (match) {
      const potentialName = match[1].trim().replace(/\*\*/g, ''); // 移除可能的加粗符号
      const content = match[2];
      
      // 检查是否是有效的人物名称
      const persona = activePersonas.find(p => p.name === potentialName);
      if (persona) {
        return {
          personaName: persona.name,
          cleanedText: content.trim(),
        };
      }
      
      // 模糊匹配：处理可能的空格或大小写问题
      const fuzzyPersona = activePersonas.find(p => 
        p.name.replace(/\s/g, '') === potentialName.replace(/\s/g, '')
      );
      if (fuzzyPersona) {
        return {
          personaName: fuzzyPersona.name,
          cleanedText: content.trim(),
        };
      }
    }
  }

  // 如果没有匹配到任何格式，返回原文
  return { personaName: null, cleanedText: trimmedText };
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

// 带超时控制的流式迭代器
async function* streamWithTimeout(
  textStream: AsyncIterable<string>,
  chunkTimeoutMs: number
): AsyncIterable<string> {
  const iterator = textStream[Symbol.asyncIterator]();
  
  while (true) {
    try {
      const result = await withTimeout(
        iterator.next(),
        chunkTimeoutMs,
        `流式数据接收超时（${chunkTimeoutMs}ms内未收到数据）`
      );
      
      if (result.done) {
        break;
      }
      
      if (result.value) {
        yield result.value;
      }
    } catch (error) {
      // 清理迭代器
      if (iterator.return) {
        await iterator.return();
      }
      throw error;
    }
  }
}

// 包装流，提供完整的错误处理和回退机制
async function* wrapStreamWithFallback(
  textStream: AsyncIterable<string>,
  prompt: string,
  openrouter: ReturnType<typeof getOpenRouter>
): AsyncIterable<string> {
  let hasYieldedAnyContent = false;
  
  try {
    // 使用带超时的流迭代器
    for await (const chunk of streamWithTimeout(textStream, CHUNK_TIMEOUT_MS)) {
      if (chunk) {
        hasYieldedAnyContent = true;
        yield chunk;
      }
    }
  } catch (error) {
    console.error("流式处理错误:", error);
    const message = (error as any)?.message || '';
    
    // 如果已经输出了部分内容，不要回退，直接抛出错误
    if (hasYieldedAnyContent) {
      console.warn('流式输出中断，已输出部分内容');
      throw error;
    }
    
    // 检查是否是可以回退的错误类型
    const isRecoverableError =
      message.includes('Type validation failed') ||
      message.includes('Invalid input') ||
      message.includes('safeParseJSON') ||
      message.includes('transform') ||
      message.includes('超时');

    if (isRecoverableError) {
      console.warn('检测到可恢复错误，回退到非流式生成...');
      try {
        const { text } = await withTimeout(
          generateText({
            model: openrouter.chat(currentChatModel),
            prompt,
            temperature: 0.7,
          }),
          STREAM_TIMEOUT_MS,
          '非流式生成超时'
        );
        
        if (text) {
          yield text;
        }
        return;
      } catch (fallbackErr) {
        console.error('回退生成失败:', fallbackErr);
        throw new Error('AI 服务暂时不可用，请稍后重试。');
      }
    }
    
    throw error;
  }
}

// 带重试的流式请求
const streamTextWithRetry = async (
  openrouter: ReturnType<typeof getOpenRouter>,
  prompt: string,
  retries: number = MAX_RETRIES
): Promise<AsyncIterable<string>> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`重试第 ${attempt} 次...`);
        await delay(RETRY_DELAY_MS * attempt); // 指数退避
      }
      
      const result = await streamText({
        model: openrouter.chat(currentChatModel),
        prompt: prompt,
        temperature: 0.7,
      });
      
      return wrapStreamWithFallback(result.textStream, prompt, openrouter);
    } catch (error) {
      lastError = error as Error;
      console.error(`尝试 ${attempt + 1} 失败:`, error);
      
      // 某些错误不应该重试
      const message = (error as any)?.message || '';
      if (message.includes('API Key') || message.includes('未设置')) {
        throw error;
      }
      
      // 最后一次尝试，不再重试
      if (attempt === retries) {
        break;
      }
    }
  }
  
  throw lastError || new Error('AI 服务请求失败');
};

// 为单个指定角色生成回答流
export const getAiResponseStreamForPersona = async (
  conversation: Conversation,
  activePersonas: Persona[],
  baseSystemPrompt: string,
  personaName: string
) => {
  if (!currentApiKey) {
    throw new Error('OpenRouter API Key 未设置。请在全局设置中配置。');
  }
  
  if (activePersonas.length === 0) {
    throw new Error('错误：没有活跃的人设参与群聊。请在设置中至少选择一位。');
  }
  
  const prompt = constructPrompt(conversation, activePersonas, baseSystemPrompt, personaName);
  const openrouter = getOpenRouter();

  try {
    return await streamTextWithRetry(openrouter, prompt);
  } catch (error) {
    console.error("调用 AI 服务失败:", error);
    const message = (error as any)?.message || '';
    
    if (message.includes('API Key') || message.includes('未设置')) {
      throw error;
    }
    
    throw new Error('AI 服务暂时不可用，请稍后重试。');
  }
};

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
    return await streamTextWithRetry(openrouter, prompt);
  } catch (error) {
    console.error("调用 AI 服务失败:", error);
    const message = (error as any)?.message || '';
    
    if (message.includes('API Key') || message.includes('未设置')) {
      throw error;
    }
    
    throw new Error('AI 服务暂时不可用，请稍后重试。');
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