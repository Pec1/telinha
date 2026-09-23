import { CloseIcon } from '../icons';
import { ParticipantList } from './ParticipantList';

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <aside
      id="room-sidebar"
      aria-label="Participantes"
      hidden={!open}
      className="absolute inset-y-0 right-0 z-20 flex w-full max-w-xs flex-col border-l border-border bg-surface shadow-2xl shadow-black/50 md:static md:z-auto md:shadow-none"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold">Participantes</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar painel lateral"
          className="rounded p-1 text-muted hover:bg-surface-2 hover:text-fg"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
      <ParticipantList />
    </aside>
  );
}
