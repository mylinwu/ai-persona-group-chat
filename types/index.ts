
export interface AvatarConfig {
  icon: string;
  bgColor: string;
  color: string;
}

export interface Persona {
  id: string;
  name: string;
  avatar: AvatarConfig; // Now an object
  prompt: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | string; // 'user' or persona name
  text: string;
  avatar?: AvatarConfig; // Will also be an object
  summary?: string; // Add summary field for long messages
}

export interface Conversation {
  id:string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  pinned: boolean;
  activePersonaIds: string[];
  direction: string;
  thinkingMode: boolean;
  contextWindow: number; // Add context window size
}
