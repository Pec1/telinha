import {
  roomCodeSchema,
  type RejoinRoomResponse,
  type RoomInfoResponse,
} from '@telinha/shared';
import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { JoinRoomForm, type EnteredRoom } from '../components/EntryForms';
import { EndScreen, type EndReason } from '../components/room/EndScreen';
import { RoomView, type Connection } from '../components/room/RoomView';
import { Logo, Spinner } from '../components/ui';
import { ApiRequestError, apiRequest } from '../lib/api';
import { clearSession, loadSession, saveSession } from '../lib/session';
import { NotFoundPage } from './NotFoundPage';

type Phase =
  | { kind: 'loading' }
  | { kind: 'form'; notice?: string }
  | { kind: 'room'; connection: Connection }
  | { kind: 'ended'; reason: EndReason; detail?: string };

interface NavState {
  connection?: Connection;
}

export function RoomPage() {
  const params = useParams();
  const parsed = roomCodeSchema.safeParse(params.code ?? '');
  if (!parsed.success) return <NotFoundPage />;
  // key: trocar de sala recria todo o estado.
  return <RoomGate key={parsed.data} code={parsed.data} />;
}

function RoomGate({ code }: { code: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [phase, setPhase] = useState<Phase>(() => {
    // Veio da página inicial (acabou de criar/entrar): já tem token.
    const conn = (location.state as NavState | null)?.connection;
    return conn && loadSession(code) ? { kind: 'room', connection: conn } : { kind: 'loading' };
  });
  const [attempt, setAttempt] = useState(0);

  // O token passado pela navegação só vale uma vez: num reload usamos /rejoin.
  useEffect(() => {
    if ((location.state as NavState | null)?.connection) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  useEffect(() => {
    if (phase.kind !== 'loading') return;
    const controller = new AbortController();
    const session = loadSession(code);

    async function run() {
      if (session) {
        try {
          const res = await apiRequest<RejoinRoomResponse>(`/api/rooms/${code}/rejoin`, {
            body: { identity: session.identity, name: session.name },
            sessionKey: session.sessionKey,
            signal: controller.signal,
          });
          setPhase({ kind: 'room', connection: res });
          return;
        } catch (err) {
          if (controller.signal.aborted) return;
          if (err instanceof ApiRequestError) {
            if (err.code === 'KICKED') {
              clearSession();
              return setPhase({ kind: 'ended', reason: 'kicked' });
            }
            if (err.code === 'ROOM_NOT_FOUND') {
              clearSession();
              return setPhase({ kind: 'ended', reason: 'closed' });
            }
            if (err.code === 'UNAUTHORIZED') clearSession();
            else return setPhase({ kind: 'ended', reason: 'error', detail: err.message });
          } else {
            return setPhase({ kind: 'ended', reason: 'error' });
          }
        }
      }

      // Sem sessão: mostra o formulário, avisando se a sala não existe ou está cheia.
      try {
        const info = await apiRequest<RoomInfoResponse>(`/api/rooms/${code}`, { signal: controller.signal });
        if (!info.exists) setPhase({ kind: 'form', notice: 'Esta sala não existe ou já foi encerrada.' });
        else if (info.full) setPhase({ kind: 'form', notice: 'Esta sala está cheia no momento.' });
        else setPhase({ kind: 'form' });
      } catch {
        if (!controller.signal.aborted) setPhase({ kind: 'form' });
      }
    }

    void run();
    return () => controller.abort();
  }, [code, phase.kind, attempt]);

  const handleEntered = useCallback((room: EnteredRoom) => {
    saveSession({ code: room.code, identity: room.identity, name: room.name, sessionKey: room.sessionKey });
    setPhase({ kind: 'room', connection: { token: room.token, url: room.url } });
  }, []);

  const handleEnded = useCallback((reason: EndReason, detail?: string) => {
    if (reason === 'kicked' || reason === 'closed') clearSession();
    setPhase({ kind: 'ended', reason, detail });
  }, []);

  const handleLeave = useCallback(() => {
    clearSession();
    navigate('/');
  }, [navigate]);

  const retry = useCallback(() => {
    setPhase({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  switch (phase.kind) {
    case 'loading':
      return (
        <main className="flex min-h-full items-center justify-center gap-3 text-muted">
          <Spinner label="Carregando sala" /> Carregando sala…
        </main>
      );
    case 'room': {
      const session = loadSession(code);
      if (!session) return <EndScreen reason="error" onRetry={retry} />;
      return (
        <RoomView
          code={code}
          session={session}
          connection={phase.connection}
          onEnded={handleEnded}
          onLeave={handleLeave}
        />
      );
    }
    case 'ended':
      return (
        <EndScreen
          reason={phase.reason}
          detail={phase.detail}
          onRetry={phase.reason === 'error' || phase.reason === 'duplicate' ? retry : undefined}
        />
      );
    case 'form':
      return (
        <main className="flex min-h-full flex-col items-center justify-center px-4 py-12">
          <div className="w-full max-w-md">
            <header className="mb-8 text-center">
              <Link to="/" aria-label="Telinha, voltar para o início">
                <Logo className="text-3xl" />
              </Link>
              <p className="mt-3 text-muted">
                Entrando na sala <span className="font-mono font-semibold tracking-widest text-fg">{code}</span>
              </p>
            </header>
            <section className="rounded-2xl border border-border bg-surface p-6 shadow-xl shadow-black/30">
              {phase.notice && (
                <p role="status" className="mb-5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
                  {phase.notice}
                </p>
              )}
              <JoinRoomForm initialCode={code} onEntered={handleEntered} />
            </section>
          </div>
        </main>
      );
  }
}
