import { useRoomContext } from '@livekit/components-react';
import { CHAT_MAX_LENGTH, CHAT_TOPIC } from '@telinha/shared';
import { useCallback, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { ChatContext, type ChatApi } from '../../context/chat';
import { chatReducer, initialChatState, normalizeChatText } from '../../lib/chat';

// UTF-8 usa até 4 bytes por caractere: acima disso a mensagem certamente passa de 500 caracteres.
const MAX_BYTES = CHAT_MAX_LENGTH * 4;

/**
 * Chat via text streams do LiveKit (tópico próprio). Nada passa pelo backend e nada é
 * persistido: as mensagens vivem só na memória desta aba.
 */
export function ChatProvider({ children }: { children: ReactNode }) {
  const room = useRoomContext();
  const [state, dispatch] = useReducer(chatReducer, initialChatState);

  useEffect(() => {
    room.registerTextStreamHandler(CHAT_TOPIC, async (reader, { identity }) => {
      if (reader.info.size !== undefined && reader.info.size > MAX_BYTES) return;
      let raw = '';
      try {
        for await (const chunk of reader) {
          raw += chunk;
          // Remetente mal-comportado: para de ler assim que passa do limite.
          if (raw.length > MAX_BYTES) return;
        }
      } catch {
        return;
      }
      const text = normalizeChatText(raw);
      if (!text) return;
      const sender = room.getParticipantByIdentity(identity);
      dispatch({
        type: 'received',
        message: {
          id: reader.info.id,
          identity,
          name: sender?.name || 'Alguém',
          text,
          timestamp: reader.info.timestamp,
          isLocal: false,
        },
      });
    });
    return () => room.unregisterTextStreamHandler(CHAT_TOPIC);
  }, [room]);

  const send = useCallback(
    async (raw: string) => {
      const text = normalizeChatText(raw);
      if (!text) throw new Error(`A mensagem precisa ter de 1 a ${CHAT_MAX_LENGTH} caracteres.`);
      const info = await room.localParticipant.sendText(text, { topic: CHAT_TOPIC });
      dispatch({
        type: 'received',
        message: {
          id: info.id,
          identity: room.localParticipant.identity,
          name: room.localParticipant.name || 'Você',
          text,
          timestamp: info.timestamp,
          isLocal: true,
        },
      });
    },
    [room],
  );

  const setVisible = useCallback((visible: boolean) => dispatch({ type: 'visibility', visible }), []);

  const api = useMemo<ChatApi>(
    () => ({ messages: state.messages, unread: state.unread, send, setVisible }),
    [state.messages, state.unread, send, setVisible],
  );

  return <ChatContext.Provider value={api}>{children}</ChatContext.Provider>;
}
