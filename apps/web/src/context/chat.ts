import { createContext, useContext } from 'react';
import type { ChatMessage } from '../lib/chat';

export interface ChatApi {
  messages: ChatMessage[];
  unread: number;
  send: (text: string) => Promise<void>;
  setVisible: (visible: boolean) => void;
}

export const ChatContext = createContext<ChatApi | null>(null);

export function useChatChannel(): ChatApi {
  const api = useContext(ChatContext);
  if (!api) throw new Error('useChatChannel fora de ChatProvider');
  return api;
}
