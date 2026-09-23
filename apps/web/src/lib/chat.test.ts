import { describe, expect, it } from 'vitest';
import { CHAT_HISTORY_LIMIT, chatReducer, initialChatState, normalizeChatText, type ChatMessage } from './chat';

const msg = (id: string, isLocal = false): ChatMessage => ({
  id,
  identity: 'u_abcdefghij',
  name: 'Ana',
  text: 'oi',
  timestamp: 1,
  isLocal,
});

describe('normalizeChatText', () => {
  it('faz trim e rejeita vazio', () => {
    expect(normalizeChatText('  olá  ')).toBe('olá');
    expect(normalizeChatText('   ')).toBeNull();
  });
  it('limita a 500 caracteres (emoji conta como um)', () => {
    expect(normalizeChatText('a'.repeat(500))).toHaveLength(500);
    expect(normalizeChatText('a'.repeat(501))).toBeNull();
    expect(normalizeChatText('😀'.repeat(500))).not.toBeNull();
  });
  it('remove caracteres de controle mas mantém quebra de linha', () => {
    expect(normalizeChatText('a\u0000b‮c\nd')).toBe('abc\nd');
    expect(normalizeChatText('a\n\n\n\n\nb')).toBe('a\n\nb');
  });
});

describe('chatReducer', () => {
  it('conta não lidas só quando o chat está oculto e a mensagem é de outra pessoa', () => {
    let s = chatReducer(initialChatState, { type: 'received', message: msg('1') });
    s = chatReducer(s, { type: 'received', message: msg('2', true) });
    expect(s.unread).toBe(1);
    s = chatReducer(s, { type: 'visibility', visible: true });
    expect(s.unread).toBe(0);
    s = chatReducer(s, { type: 'received', message: msg('3') });
    expect(s.unread).toBe(0);
    expect(s.messages.map((m) => m.id)).toEqual(['1', '2', '3']);
  });

  it('ignora duplicadas e mantém só as últimas mensagens', () => {
    let s = initialChatState;
    for (let i = 0; i < CHAT_HISTORY_LIMIT + 10; i++) s = chatReducer(s, { type: 'received', message: msg(String(i)) });
    s = chatReducer(s, { type: 'received', message: msg(String(CHAT_HISTORY_LIMIT + 9)) });
    expect(s.messages).toHaveLength(CHAT_HISTORY_LIMIT);
    expect(s.messages[0]?.id).toBe('10');
  });
});
