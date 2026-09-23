import { LiveKitRoom, RoomAudioRenderer, useConnectionState, useLocalParticipant } from '@livekit/components-react';
import { ConnectionState, DisconnectReason, Room } from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useCanShare } from '../../hooks/useCanShare';
import { useScreenTracks } from '../../hooks/useScreenTracks';
import { useShareMode } from '../../hooks/useShareMode';
import { isCaptureCancelled, screenCaptureOptions, screenPublishOptions } from '../../lib/media';
import { Logo, Spinner } from '../ui';
import { ControlBar } from './ControlBar';
import type { EndReason } from './EndScreen';
import { Stage } from './Stage';

export interface Connection {
  token: string;
  url: string;
}

interface Props {
  code: string;
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

export function RoomView({ code, connection, onEnded, onLeave }: Props) {
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
      <RoomLayout code={code} onLeave={leave} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

function RoomLayout({ code, onLeave }: { code: string; onLeave: () => void }) {
  const connectionState = useConnectionState();
  const canShare = useCanShare();
  const { localParticipant, isScreenShareEnabled } = useLocalParticipant();
  const [mode] = useShareMode();
  const [busy, setBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const screenTracks = useScreenTracks();
  const focused = screenTracks[0];

  const stageRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Perdeu a permissão enquanto transmitia: encerra a transmissão localmente.
  useEffect(() => {
    if (!canShare && isScreenShareEnabled) {
      void localParticipant.setScreenShareEnabled(false);
    }
  }, [canShare, isScreenShareEnabled, localParticipant]);

  const toggleShare = useCallback(async () => {
    setShareError(null);
    setBusy(true);
    try {
      if (localParticipant.isScreenShareEnabled) {
        await localParticipant.setScreenShareEnabled(false);
      } else {
        await localParticipant.setScreenShareEnabled(true, screenCaptureOptions(mode), screenPublishOptions(mode));
      }
    } catch (err) {
      if (!isCaptureCancelled(err)) {
        console.error('[tela]', err);
        setShareError('Não foi possível compartilhar a tela.');
      }
    } finally {
      setBusy(false);
    }
  }, [localParticipant, mode]);

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
      {shareError && (
        <div role="alert" className="bg-danger/15 px-4 py-2 text-center text-sm text-danger">
          {shareError}
        </div>
      )}

      <div ref={stageRef} className="relative min-h-0 flex-1 bg-black">
        {connecting ? (
          <div className="flex h-full items-center justify-center gap-3 text-muted">
            <Spinner label="Conectando" /> Conectando à sala…
          </div>
        ) : (
          <Stage focused={focused} />
        )}
      </div>

      <ControlBar
        code={code}
        busy={busy}
        onToggleShare={toggleShare}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        onLeave={onLeave}
      />
    </>
  );
}
