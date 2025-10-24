import { Conversation } from '../types/index';

/**
 * LocalStorage 数据管理模块
 * 统一管理会话数据的存储和读取
 */

// Storage Keys
const STORAGE_KEYS = {
  CONVERSATIONS: 'ai-persona-chat-conversations',
  ACTIVE_CONVERSATION_ID: 'ai-persona-chat-active-id',
  APP_VERSION: 'ai-persona-chat-version',
} as const;

// 当前应用版本,用于数据迁移
const CURRENT_VERSION = '1.0.0';

/**
 * 数据库接口
 */
export interface IDatabase {
  // 会话相关
  getConversations(): Conversation[];
  saveConversations(conversations: Conversation[]): void;
  getActiveConversationId(): string | null;
  saveActiveConversationId(id: string | null): void;
  
  // 单个会话操作
  getConversation(id: string): Conversation | null;
  addConversation(conversation: Conversation): void;
  updateConversation(id: string, updates: Partial<Conversation>): void;
  deleteConversation(id: string): void;
  
  // 批量操作
  clearAllConversations(): void;
  
  // 工具方法
  exportData(): string;
  importData(jsonData: string): boolean;
}

/**
 * LocalStorage 数据库实现
 */
class LocalStorageDatabase implements IDatabase {
  /**
   * 安全地从 localStorage 读取数据
   */
  private safeGetItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      console.error(`Error reading from localStorage (key: ${key}):`, error);
      return null;
    }
  }

  /**
   * 安全地向 localStorage 写入数据
   */
  private safeSetItem(key: string, value: string): boolean {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.error(`Error writing to localStorage (key: ${key}):`, error);
      // 可能是存储空间已满
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('LocalStorage quota exceeded. Consider clearing old data.');
      }
      return false;
    }
  }

  /**
   * 安全地从 localStorage 删除数据
   */
  private safeRemoveItem(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing from localStorage (key: ${key}):`, error);
    }
  }

  /**
   * 数据迁移和版本管理
   */
  private migrateData(conversations: Conversation[]): Conversation[] {
    const storedVersion = this.safeGetItem(STORAGE_KEYS.APP_VERSION);
    
    // 如果版本不同,执行数据迁移
    if (storedVersion !== CURRENT_VERSION) {
      console.log(`Migrating data from version ${storedVersion || 'unknown'} to ${CURRENT_VERSION}`);
      
      // 在这里添加版本迁移逻辑
      const migratedConversations = conversations.map(convo => ({
        ...convo,
        // 确保所有必需字段都存在
        thinkingMode: convo.thinkingMode ?? true,
        contextWindow: convo.contextWindow ?? 10,
        pinned: convo.pinned ?? false,
        activePersonaIds: convo.activePersonaIds ?? [],
        direction: convo.direction ?? 'sequential',
      }));
      
      // 更新版本号
      this.safeSetItem(STORAGE_KEYS.APP_VERSION, CURRENT_VERSION);
      
      return migratedConversations;
    }
    
    return conversations;
  }

  /**
   * 获取所有会话
   */
  getConversations(): Conversation[] {
    const stored = this.safeGetItem(STORAGE_KEYS.CONVERSATIONS);
    
    if (!stored) {
      return [];
    }
    
    try {
      const conversations = JSON.parse(stored) as Conversation[];
      return this.migrateData(conversations);
    } catch (error) {
      console.error('Error parsing conversations from localStorage:', error);
      return [];
    }
  }

  /**
   * 保存所有会话
   */
  saveConversations(conversations: Conversation[]): void {
    const success = this.safeSetItem(
      STORAGE_KEYS.CONVERSATIONS,
      JSON.stringify(conversations)
    );
    
    if (!success) {
      console.warn('Failed to save conversations to localStorage');
    }
  }

  /**
   * 获取当前激活的会话 ID
   */
  getActiveConversationId(): string | null {
    return this.safeGetItem(STORAGE_KEYS.ACTIVE_CONVERSATION_ID);
  }

  /**
   * 保存当前激活的会话 ID
   */
  saveActiveConversationId(id: string | null): void {
    if (id === null) {
      this.safeRemoveItem(STORAGE_KEYS.ACTIVE_CONVERSATION_ID);
    } else {
      this.safeSetItem(STORAGE_KEYS.ACTIVE_CONVERSATION_ID, id);
    }
  }

  /**
   * 获取单个会话
   */
  getConversation(id: string): Conversation | null {
    const conversations = this.getConversations();
    return conversations.find(c => c.id === id) || null;
  }

  /**
   * 添加新会话
   */
  addConversation(conversation: Conversation): void {
    const conversations = this.getConversations();
    conversations.unshift(conversation); // 添加到开头
    this.saveConversations(conversations);
  }

  /**
   * 更新会话
   */
  updateConversation(id: string, updates: Partial<Conversation>): void {
    const conversations = this.getConversations();
    const index = conversations.findIndex(c => c.id === id);
    
    if (index !== -1) {
      conversations[index] = { ...conversations[index], ...updates };
      this.saveConversations(conversations);
    }
  }

  /**
   * 删除会话
   */
  deleteConversation(id: string): void {
    const conversations = this.getConversations();
    const filtered = conversations.filter(c => c.id !== id);
    this.saveConversations(filtered);
    
    // 如果删除的是当前激活的会话,清除激活状态
    if (this.getActiveConversationId() === id) {
      this.saveActiveConversationId(null);
    }
  }

  /**
   * 清除所有会话
   */
  clearAllConversations(): void {
    this.safeRemoveItem(STORAGE_KEYS.CONVERSATIONS);
    this.safeRemoveItem(STORAGE_KEYS.ACTIVE_CONVERSATION_ID);
  }

  /**
   * 导出所有数据为 JSON 字符串
   */
  exportData(): string {
    const data = {
      version: CURRENT_VERSION,
      conversations: this.getConversations(),
      activeConversationId: this.getActiveConversationId(),
      exportedAt: new Date().toISOString(),
    };
    
    return JSON.stringify(data, null, 2);
  }

  /**
   * 从 JSON 字符串导入数据
   */
  importData(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      
      if (!data.conversations || !Array.isArray(data.conversations)) {
        throw new Error('Invalid data format: conversations must be an array');
      }
      
      // 验证数据结构
      const conversations = data.conversations as Conversation[];
      
      // 保存数据
      this.saveConversations(conversations);
      
      if (data.activeConversationId) {
        this.saveActiveConversationId(data.activeConversationId);
      }
      
      console.log('Data imported successfully');
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }
}

/**
 * 数据库单例实例
 */
export const db: IDatabase = new LocalStorageDatabase();

/**
 * 获取存储使用情况(仅用于调试)
 */
export const getStorageInfo = () => {
  try {
    const conversations = db.getConversations();
    const dataSize = JSON.stringify(conversations).length;
    const dataSizeKB = (dataSize / 1024).toFixed(2);
    
    return {
      conversationCount: conversations.length,
      totalMessages: conversations.reduce((sum, c) => sum + c.messages.length, 0),
      dataSizeBytes: dataSize,
      dataSizeKB: `${dataSizeKB} KB`,
      activeConversationId: db.getActiveConversationId(),
    };
  } catch (error) {
    console.error('Error getting storage info:', error);
    return null;
  }
};
