import { useEffect, useRef, type KeyboardEvent } from 'react';
import { useChatChannel } from '../../context/chat';
import { CloseIcon } from '../icons';
import { ChatPanel } from './ChatPanel';
import { ParticipantList } from './ParticipantList';

export type SidebarTab = 'participants' | 'chat';

const tabs: { id: SidebarTab; label: string }[] = [
  { id: 'participants', label: 'Participantes' },
  { id: 'chat', label: 'Chat' },
];

export function Sidebar({
  open,
  tab,
  onTabChange,
  onClose,
  participantCount,
}: {
  open: boolean;
  tab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onClose: () => void;
  participantCount: number;
}) {
  const { unread, setVisible } = useChatChannel();
  const tabRefs = useRef<Record<SidebarTab, HTMLButtonElement | null>>({ participants: null, chat: null });

  // Mensagens só contam como lidas com o chat aberto e visível.
  useEffect(() => setVisible(open && tab === 'chat'), [open, tab, setVisible]);

  function onTabKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const next: SidebarTab = tab === 'participants' ? 'chat' : 'participants';
    onTabChange(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <aside
      id="room-sidebar"
      aria-label="Painel lateral"
      hidden={!open}
      className="absolute inset-y-0 right-0 z-20 flex w-full flex-col md:max-w-xs border-l border-border bg-surface shadow-2xl shadow-black/50 md:static md:z-auto md:shadow-none"
    >
      <div className="flex items-center gap-2 border-b border-border px-2 py-2">
        <div role="tablist" aria-label="Painel lateral" className="flex flex-1 gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              id={`sidebar-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`sidebar-panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => onTabChange(t.id)}
              onKeyDown={onTabKey}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg'
              }`}
            >
              {t.label}
              {t.id === 'participants' && <span className="text-xs tabular-nums text-muted">{participantCount}</span>}
              {t.id === 'chat' && unread > 0 && <UnreadBadge count={unread} />}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar painel lateral"
          className="rounded p-1 text-muted hover:bg-surface-2 hover:text-fg"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>

      <div
        role="tabpanel"
        id={`sidebar-panel-${tab}`}
        aria-labelledby={`sidebar-tab-${tab}`}
        className="flex min-h-0 flex-1 flex-col"
      >
        {tab === 'participants' ? <ParticipantList /> : <ChatPanel />}
      </div>
    </aside>
  );
}

export function UnreadBadge({ count }: { count: number }) {
  return (
    <span className="min-w-5 rounded-full bg-accent px-1.5 text-center text-xs font-semibold tabular-nums text-white">
      <span aria-hidden="true">{count > 99 ? '99+' : count}</span>
      <span className="sr-only">{count} mensagens não lidas</span>
    </span>
  );
}
