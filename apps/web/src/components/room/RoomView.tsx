import {
  LiveKitRoom,
  useConnectionState,
  useLocalParticipant,
  useParticipants,
} from '@livekit/components-react';
import { ConnectionState, DisconnectReason, Room } from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RoomSessionContext, useRoomSession } from '../../context/RoomSession';
import { useCanShare } from '../../hooks/useCanShare';
import { useHeartbeat } from '../../hooks/useHeartbeat';
import { useHostIdentity, useIsHost } from '../../hooks/useIsHost';
import { useScreenTracks } from '../../hooks/useScreenTracks';
import { useShareMode } from '../../hooks/useShareMode';
import { apiRequest } from '../../lib/api';
import { pickFocusedIdentity } from '../../lib/focus';
import { SHARE_PRESETS, canCaptureScreen, isCaptureCancelled, type ShareMode } from '../../lib/media';
import { startScreenShare, stopScreenShare, switchScreenShareMode } from '../../lib/screenShare';
import type { StoredSession } from '../../lib/session';
import { useToast } from '../../context/toast';
import { Logo, Spinner } from '../ui';
import { ConnectionQualityBars } from './ConnectionQualityBars';
import { CopyCodeButton } from './CopyCodeButton';
import { ControlBar } from './ControlBar';
import type { EndReason } from './EndScreen';
import { ChatProvider } from './ChatProvider';
import { Sidebar, type SidebarTab } from './Sidebar';
import { Stage } from './Stage';

export interface Connection {
  token: string;
  url: string;
}

interface Props {
  code: string;
  session: StoredSession;
  connection: Connection;
  onEnded: (reason: EndReason, detail?: string) => void;
  onLeave: () => void;
}

function endReasonFor(reason: DisconnectReason | undefined): EndReason | null {
  switch (reason) {
    case DisconnectReason.CLIENT_INITIATED:
      return null;
    case DisconnectReason.PARTICIPANT_REMOVED:
      return 'kicked';
    case DisconnectReason.ROOM_DELETED:
    case DisconnectReason.ROOM_CLOSED:
      return 'closed';
    case DisconnectReason.DUPLICATE_IDENTITY:
      return 'duplicate';
    default:
      return 'error';
  }
}

export function RoomView({ code, session, connection, onEnded, onLeave }: Props) {
  const [room] = useState(
    () =>
      new Room({
        adaptiveStream: true,
        dynacast: true,
      }),
  );
  const leavingRef = useRef(false);

  const handleDisconnected = useCallback(
    (reason?: DisconnectReason) => {
      if (leavingRef.current) return;
      const end = endReasonFor(reason);
      if (end) onEnded(end);
    },
    [onEnded],
  );

  const handleError = useCallback(
    (err: Error) => {
      console.error('[livekit]', err);
      if (room.state === ConnectionState.Disconnected && !leavingRef.current) onEnded('error', err.message);
    },
    [room, onEnded],
  );

  const leave = useCallback(async () => {
    leavingRef.current = true;
    await room.disconnect();
    onLeave();
  }, [room, onLeave]);

  return (
    <LiveKitRoom
      room={room}
      serverUrl={connection.url}
      token={connection.token}
      connect
      onDisconnected={handleDisconnected}
      onError={handleError}
      className="flex h-full flex-col"
    >
      <RoomSessionContext.Provider value={session}>
        <ChatProvider>
          <RoomLayout code={code} onLeave={leave} />
        </ChatProvider>
      </RoomSessionContext.Provider>
    </LiveKitRoom>
  );
}

function RoomLayout({ code, onLeave }: { code: string; onLeave: () => void }) {
  const connectionState = useConnectionState();
  const canShare = useCanShare();
  const isHost = useIsHost();
  const toast = useToast();
  const participants = useParticipants();
  const { localParticipant, isScreenShareEnabled } = useLocalParticipant();
  const [mode, setMode] = useShareMode();
  const [busy, setBusy] = useState(false);
  const screenTracks = useScreenTracks();
  const [selectedScreen, setSelectedScreen] = useState<string | null>(null);
  const focusedIdentity = pickFocusedIdentity(
    screenTracks.map((t) => ({ identity: t.participant.identity, isLocal: t.participant.isLocal })),
    selectedScreen,
  );
  const focused = screenTracks.find((t) => t.participant.identity === focusedIdentity);
  const session = useRoomSession();
  const hostIdentity = useHostIdentity();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia?.('(min-width: 768px)').matches ?? true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('participants');

  // Botões da barra: abrem o painel na aba escolhida; clicar de novo na aba aberta fecha.
  const toggleSidebarTab = useCallback(
    (tab: SidebarTab) => {
      if (sidebarOpen && sidebarTab === tab) setSidebarOpen(false);
      else {
        setSidebarTab(tab);
        setSidebarOpen(true);
      }
    },
    [sidebarOpen, sidebarTab],
  );

  const stageRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Perdeu a permissão enquanto transmitia: encerra a transmissão localmente.
  useEffect(() => {
    if (!canShare && isScreenShareEnabled) {
      void stopScreenShare(localParticipant);
    }
  }, [canShare, isScreenShareEnabled, localParticipant]);

  // Avisos ao ganhar/perder permissão (o estado vem do LiveKit; ignoramos o valor inicial).
  const connected = connectionState === ConnectionState.Connected;
  const reconnecting =
    connectionState === ConnectionState.Reconnecting || connectionState === ConnectionState.SignalReconnecting;
  useHeartbeat(connected || reconnecting);

  // Aviso quando a conexão volta depois de uma queda.
  const wasReconnecting = useRef(false);
  useEffect(() => {
    if (reconnecting) wasReconnecting.current = true;
    else if (connected && wasReconnecting.current) {
      wasReconnecting.current = false;
      toast.show('Conexão restabelecida.', 'success');
    }
  }, [reconnecting, connected, toast]);
  const prevCanShare = useRef<boolean | null>(null);
  useEffect(() => {
    if (!connected) return;
    const prev = prevCanShare.current;
    prevCanShare.current = canShare;
    if (prev === null || prev === canShare || isHost) return;
    if (canShare) toast.show('O host liberou: agora você pode compartilhar a tela.', 'success');
    else toast.show('O host removeu sua permissão de compartilhar a tela.', 'info');
  }, [canShare, connected, isHost, toast]);

  // Aviso ao virar host / quando outra pessoa vira host (a metadata vem do LiveKit).
  const prevHost = useRef<string | null>(null);
  useEffect(() => {
    if (!connected || !hostIdentity) return;
    const prev = prevHost.current;
    prevHost.current = hostIdentity;
    if (prev === null || prev === hostIdentity) return;
    if (hostIdentity === localParticipant.identity) {
      toast.show('Você agora é o host da sala: pode liberar telas e remover pessoas.', 'success');
    } else {
      const name = participants.find((p) => p.identity === hostIdentity)?.name;
      toast.show(name ? `${name} agora é o host da sala.` : 'A sala tem um novo host.', 'info');
    }
  }, [connected, hostIdentity, localParticipant, participants, toast]);

  // Fallback da sucessão: se o host sumiu da sala, avisa o server (que aplica a carência).
  // Cobre o caso do webhook do LiveKit não chegar (ex: Codespaces com porta privada).
  const hostPresent = !hostIdentity || participants.some((p) => p.identity === hostIdentity);
  const reportedHost = useRef<string | null>(null);
  useEffect(() => {
    if (!connected || hostPresent || !hostIdentity || reportedHost.current === hostIdentity) return;
    const timer = window.setTimeout(() => {
      reportedHost.current = hostIdentity;
      apiRequest<void>(`/api/rooms/${session.code}/host-check`, {
        body: { identity: session.identity },
        sessionKey: session.sessionKey,
      }).catch((err: unknown) => console.warn('[host-check]', err));
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [connected, hostPresent, hostIdentity, session]);

  const reportShareError = useCallback(
    (err: unknown) => {
      if (isCaptureCancelled(err)) return;
      console.error('[tela]', err);
      toast.show('Não foi possível compartilhar a tela.', 'error');
    },
    [toast],
  );

  const toggleShare = useCallback(async () => {
    setBusy(true);
    try {
      if (localParticipant.isScreenShareEnabled) await stopScreenShare(localParticipant);
      else await startScreenShare(localParticipant, mode);
    } catch (err) {
      reportShareError(err);
    } finally {
      setBusy(false);
    }
  }, [localParticipant, mode, reportShareError]);

  // Trocar de modo durante a transmissão republica a tela com as novas configurações.
  const changeMode = useCallback(
    async (next: ShareMode) => {
      setMode(next);
      if (!localParticipant.isScreenShareEnabled) return;
      setBusy(true);
      try {
        await switchScreenShareMode(localParticipant, next);
        toast.show(`Modo ${SHARE_PRESETS[next].label} aplicado.`, 'success');
      } catch (err) {
        reportShareError(err);
      } finally {
        setBusy(false);
      }
    },
    [localParticipant, setMode, toast, reportShareError],
  );

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stageRef.current?.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Atalho F = tela cheia (Esc sai da tela cheia nativamente).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleFullscreen]);

  const connecting = connectionState === ConnectionState.Connecting;

  return (
    <>
      <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2">
        <div className="flex items-center gap-3">
          <Logo className="text-lg" />
          <h1 className="sr-only">Sala {code}</h1>
          {isHost && (
            <span className="hidden rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-xs text-amber-300 sm:inline">
              Você é o host
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <CopyCodeButton code={code} />
          <ConnectionQualityBars participant={localParticipant} />
        </div>
      </header>

      {canShare && !canCaptureScreen() && (
        <div role="note" className="bg-surface-2 px-4 py-2 text-center text-sm text-muted">
          Este navegador não permite compartilhar a tela (comum em celulares). Você pode assistir normalmente.
        </div>
      )}

      {reconnecting && (
        <div role="status" className="flex items-center justify-center gap-2 bg-amber-500/15 px-4 py-2 text-sm text-amber-300">
          <Spinner label="Reconectando" /> Conexão instável, reconectando…
        </div>
      )}

      <main className="relative flex min-h-0 flex-1">
        <div ref={stageRef} className="relative min-w-0 flex-1 bg-black">
          {connecting ? (
            <div className="flex h-full items-center justify-center gap-3 text-muted">
              <Spinner label="Conectando" /> Conectando à sala…
            </div>
          ) : (
            <Stage screens={screenTracks} focused={focused} onSelect={setSelectedScreen} />
          )}
        </div>
        <Sidebar
          open={sidebarOpen}
          tab={sidebarTab}
          onTabChange={setSidebarTab}
          onClose={() => setSidebarOpen(false)}
          participantCount={participants.length}
        />
      </main>

      <ControlBar
        code={code}
        busy={busy}
        mode={mode}
        onModeChange={changeMode}
        onToggleShare={toggleShare}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        sidebarOpen={sidebarOpen}
        sidebarTab={sidebarTab}
        onToggleSidebarTab={toggleSidebarTab}
        participantCount={participants.length}
        onLeave={onLeave}
      />
    </>
  );
}
