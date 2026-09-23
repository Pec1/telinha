import { useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { CreateRoomForm, JoinRoomForm, type EnteredRoom } from '../components/EntryForms';
import { Logo } from '../components/ui';
import { saveSession } from '../lib/session';

type Tab = 'create' | 'join';
const tabs: { id: Tab; label: string }[] = [
  { id: 'create', label: 'Criar sala' },
  { id: 'join', label: 'Entrar' },
];

export function HomePage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('create');
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ create: null, join: null });

  function handleEntered(room: EnteredRoom) {
    saveSession({ code: room.code, identity: room.identity, name: room.name, sessionKey: room.sessionKey });
    navigate(`/s/${room.code}`, { state: { connection: { token: room.token, url: room.url } } });
  }

  // Navegação por setas entre abas (padrão WAI-ARIA).
  function handleTabKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const next: Tab = tab === 'create' ? 'join' : 'create';
    setTab(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <main className="flex min-h-full flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,rgba(109,93,252,0.18),transparent_60%)] px-4 py-12">
      <div className="w-full max-w-md">
        <header className="mb-8 text-center">
          <h1>
            <Logo className="text-3xl" />
          </h1>
          <p className="mt-3 text-muted">Compartilhe sua tela em 1080p. Sem cadastro, é só criar e mandar o link.</p>
        </header>

        <section className="rounded-2xl border border-border bg-surface p-6 shadow-xl shadow-black/30">
          <div role="tablist" aria-label="Como você quer começar" className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-bg p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[t.id] = el;
                }}
                role="tab"
                type="button"
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`panel-${t.id}`}
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => setTab(t.id)}
                onKeyDown={handleTabKey}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  tab === t.id ? 'bg-surface-2 text-fg shadow' : 'text-muted hover:text-fg'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === 'create' ? (
              <CreateRoomForm onEntered={handleEntered} />
            ) : (
              <JoinRoomForm onEntered={handleEntered} />
            )}
          </div>
        </section>

        <ul className="mt-8 grid grid-cols-3 gap-3 text-center text-xs text-muted">
          <li className="rounded-lg border border-border/60 bg-surface/50 px-2 py-3">
            <strong className="block text-sm text-fg">1080p</strong>até 60 fps
          </li>
          <li className="rounded-lg border border-border/60 bg-surface/50 px-2 py-3">
            <strong className="block text-sm text-fg">Sem conta</strong>só um apelido
          </li>
          <li className="rounded-lg border border-border/60 bg-surface/50 px-2 py-3">
            <strong className="block text-sm text-fg">Várias telas</strong>ao mesmo tempo
          </li>
        </ul>
      </div>
    </main>
  );
}
