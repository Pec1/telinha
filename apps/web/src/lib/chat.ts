import { CHAT_MAX_LENGTH } from '@telinha/shared';

export interface ChatMessage {
  id: string;
  identity: string;
  name: string;
  text: string;
  timestamp: number;
  isLocal: boolean;
}

/** Mensagens mantidas em memória (as mais antigas saem primeiro). */
export const CHAT_HISTORY_LIMIT = 200;

// Controle (exceto quebra de linha) e formatação invisível (ex: RTL override).
const DISALLOWED = /(?!\n)[\p{Cc}\p{Cf}]/gu;

export function chatLength(text: string): number {
  return [...text].length;
}

/** Limpa e valida o texto; devolve null se vazio ou acima de 500 caracteres. */
export function normalizeChatText(raw: string): string | null {
  const text = raw.replace(DISALLOWED, '').replace(/\n{3,}/g, '\n\n').trim();
  if (!text || chatLength(text) > CHAT_MAX_LENGTH) return null;
  return text;
}

export interface ChatState {
  messages: ChatMessage[];
  unread: number;
  visible: boolean;
}

export type ChatAction =
  | { type: 'received'; message: ChatMessage }
  | { type: 'visibility'; visible: boolean };

export const initialChatState: ChatState = { messages: [], unread: 0, visible: false };

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'received': {
      if (state.messages.some((m) => m.id === action.message.id)) return state;
      const messages = [...state.messages, action.message].slice(-CHAT_HISTORY_LIMIT);
      const unread = action.message.isLocal || state.visible ? state.unread : state.unread + 1;
      return { ...state, messages, unread };
    }
    case 'visibility':
      return { ...state, visible: action.visible, unread: action.visible ? 0 : state.unread };
  }
}
