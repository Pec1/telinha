import { CHAT_MAX_LENGTH } from '@telinha/shared';
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useChatChannel } from '../../context/chat';
import { chatLength } from '../../lib/chat';
import { Button } from '../ui';

const timeFormat = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function ChatPanel() {
  const { messages, send } = useChatChannel();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const inputId = useId();

  const length = chatLength(draft.trim());
  const tooLong = length > CHAT_MAX_LENGTH;

  // Rola para a última mensagem se o usuário já estava perto do fim.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    const last = messages[messages.length - 1];
    if (nearBottom || last?.isLocal) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!length || tooLong || sending) return;
    setSending(true);
    setError(null);
    try {
      await send(draft);
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar.');
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ol
        ref={listRef}
        role="log"
        aria-label="Mensagens do chat"
        aria-live="polite"
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3"
      >
        {messages.length === 0 && (
          <li className="pt-8 text-center text-sm text-muted">
            Nenhuma mensagem ainda. As mensagens não ficam salvas: quem entrar depois não vê o histórico.
          </li>
        )}
        {messages.map((m) => (
          <li key={m.id} className="text-sm">
            <p className="flex items-baseline gap-2">
              <span className={`font-semibold ${m.isLocal ? 'text-accent' : 'text-fg'}`}>
                {m.isLocal ? 'Você' : m.name}
              </span>
              <time dateTime={new Date(m.timestamp).toISOString()} className="text-xs text-muted">
                {timeFormat.format(m.timestamp)}
              </time>
            </p>
            <p className="whitespace-pre-wrap break-words text-fg/90">{m.text}</p>
          </li>
        ))}
      </ol>

      <form onSubmit={submit} className="border-t border-border p-3">
        <label htmlFor={inputId} className="sr-only">
          Mensagem
        </label>
        <textarea
          id={inputId}
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Escreva uma mensagem…"
          aria-invalid={tooLong || undefined}
          aria-describedby={`${inputId}-count`}
          className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none aria-invalid:border-danger"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span
            id={`${inputId}-count`}
            className={`text-xs tabular-nums ${tooLong ? 'text-danger' : 'text-muted'}`}
          >
            {length}/{CHAT_MAX_LENGTH}
          </span>
          <Button type="submit" className="px-3 py-1.5" disabled={!length || tooLong || sending}>
            Enviar
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-xs text-danger">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
