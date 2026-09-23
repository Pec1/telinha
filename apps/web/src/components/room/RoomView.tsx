import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useLocalParticipant,
  useParticipants,
} from '@livekit/components-react';
import { ConnectionState, DisconnectReason, Room } from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RoomSessionContext } from '../../context/RoomSession';
import { useCanShare } from '../../hooks/useCanShare';
import { useIsHost } from '../../hooks/useIsHost';
import { useScreenTracks } from '../../hooks/useScreenTracks';
import { useShareMode } from '../../hooks/useShareMode';
import { SHARE_PRESETS, isCaptureCancelled, type ShareMode } from '../../lib/media';
import { startScreenShare, stopScreenShare, switchScreenShareMode } from '../../lib/screenShare';
import type { StoredSession } from '../../lib/session';
import { useToast } from '../../context/toast';
import { Logo, Spinner } from '../ui';
import { ControlBar } from './ControlBar';
import type { EndReason } from './EndScreen';
import { Sidebar } from './Sidebar';
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
        <RoomLayout code={code} onLeave={leave} />
      </RoomSessionContext.Provider>
      <RoomAudioRenderer />
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
  const focused = screenTracks[0];
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia?.('(min-width: 768px)').matches ?? true);

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
  const prevCanShare = useRef<boolean | null>(null);
  useEffect(() => {
    if (!connected) return;
    const prev = prevCanShare.current;
    prevCanShare.current = canShare;
    if (prev === null || prev === canShare || isHost) return;
    if (canShare) toast.show('O host liberou: agora você pode compartilhar a tela.', 'success');
    else toast.show('O host removeu sua permissão de compartilhar a tela.', 'info');
  }, [canShare, connected, isHost, toast]);

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
  const reconnecting =
    connectionState === ConnectionState.Reconnecting || connectionState === ConnectionState.SignalReconnecting;

  return (
    <>
      <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2.5">
        <Logo className="text-lg" />
        <p className="text-sm text-muted">
          Sala <span className="font-mono font-semibold tracking-widest text-fg">{code}</span>
        </p>
      </header>

      {reconnecting && (
        <div role="status" className="flex items-center justify-center gap-2 bg-amber-500/15 px-4 py-2 text-sm text-amber-300">
          <Spinner label="Reconectando" /> Conexão instável, reconectando…
        </div>
      )}

      <div className="relative flex min-h-0 flex-1">
        <div ref={stageRef} className="relative min-w-0 flex-1 bg-black">
          {connecting ? (
            <div className="flex h-full items-center justify-center gap-3 text-muted">
              <Spinner label="Conectando" /> Conectando à sala…
            </div>
          ) : (
            <Stage focused={focused} />
          )}
        </div>
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>

      <ControlBar
        code={code}
        busy={busy}
        mode={mode}
        onModeChange={changeMode}
        onToggleShare={toggleShare}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
        participantCount={participants.length}
        onLeave={onLeave}
      />
    </>
  );
}
