import { useParticipantPermissions, useParticipants } from '@livekit/components-react';
import type { Participant } from 'livekit-client';
import { useState } from 'react';
import { useRoomSession } from '../../context/RoomSession';
import { PROTO_SOURCE_SCREEN_SHARE } from '../../hooks/useCanShare';
import { useHostIdentity } from '../../hooks/useIsHost';
import { ApiRequestError } from '../../lib/api';
import { kickParticipant, setScreenPermission } from '../../lib/hostActions';
import { CrownIcon, ScreenShareIcon } from '../icons';
import { useToast } from '../../context/toast';
import { Button, Spinner } from '../ui';
import { ConnectionQualityBars } from './ConnectionQualityBars';

export function ParticipantList() {
  const participants = useParticipants();
  const hostIdentity = useHostIdentity();
  const session = useRoomSession();
  const amHost = hostIdentity === session.identity;

  const sorted = [...participants].sort((a, b) => {
    const rank = (p: Participant) => (p.identity === hostIdentity ? 0 : p.isLocal ? 1 : 2);
    return rank(a) - rank(b) || (a.joinedAt?.getTime() ?? 0) - (b.joinedAt?.getTime() ?? 0);
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className="sr-only">Participantes</h2>
      <p className="px-4 pb-2 pt-3 text-xs uppercase tracking-wide text-muted">
        {participants.length} {participants.length === 1 ? 'pessoa' : 'pessoas'} na sala
      </p>
      <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {sorted.map((p) => (
          <ParticipantRow key={p.identity} participant={p} isHost={p.identity === hostIdentity} amHost={amHost} />
        ))}
      </ul>
    </div>
  );
}

function ParticipantRow({ participant, isHost, amHost }: { participant: Participant; isHost: boolean; amHost: boolean }) {
  const session = useRoomSession();
  const toast = useToast();
  const permissions = useParticipantPermissions({ participant });
  const canShare = !!permissions?.canPublish && permissions.canPublishSources.includes(PROTO_SOURCE_SCREEN_SHARE);
  const [pending, setPending] = useState<'perm' | 'kick' | null>(null);
  const [confirmKick, setConfirmKick] = useState(false);

  const name = participant.name || participant.identity;
  const sharing = participant.isScreenShareEnabled;
  const showHostControls = amHost && !participant.isLocal && !isHost;

  async function togglePermission() {
    setPending('perm');
    try {
      await setScreenPermission(session, participant.identity, !canShare);
    } catch (err) {
      toast.show(err instanceof ApiRequestError ? err.message : 'Não foi possível alterar a permissão.', 'error');
    } finally {
      setPending(null);
    }
  }

  async function kick() {
    setPending('kick');
    try {
      await kickParticipant(session, participant.identity);
      toast.show(`${name} foi removido da sala.`, 'success');
    } catch (err) {
      toast.show(err instanceof ApiRequestError ? err.message : 'Não foi possível remover.', 'error');
      setPending(null);
      setConfirmKick(false);
    }
  }

  return (
    <li className="rounded-lg px-2 py-2 hover:bg-surface-2/60">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold uppercase"
        >
          {[...name][0]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm">
            <span className="truncate">{name}</span>
            {participant.isLocal && <span className="text-muted">(você)</span>}
          </p>
          <p className="flex items-center gap-2 text-xs text-muted">
            {isHost && (
              <span className="inline-flex items-center gap-1 text-amber-300">
                <CrownIcon className="h-3.5 w-3.5" /> Host
              </span>
            )}
            {sharing && (
              <span className="inline-flex items-center gap-1 text-accent">
                <ScreenShareIcon className="h-3.5 w-3.5" /> Transmitindo
              </span>
            )}
            {!isHost && !sharing && canShare && <span>Pode compartilhar</span>}
          </p>
        </div>
        <ConnectionQualityBars participant={participant} />
      </div>

      {showHostControls && (
        <div className="mt-2 flex items-center justify-between gap-2 pl-10">
          <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-xs text-muted">
            <button
              type="button"
              role="switch"
              aria-checked={canShare}
              aria-label={`Pode compartilhar: ${name}`}
              disabled={pending !== null}
              onClick={togglePermission}
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-60 ${canShare ? 'bg-accent' : 'bg-border'}`}
            >
              <span
                className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${canShare ? 'translate-x-4' : 'translate-x-0.5'}`}
              />
            </button>
            Pode compartilhar
            {pending === 'perm' && <Spinner label="Alterando permissão" />}
          </label>

          {confirmKick ? (
            <span className="flex items-center gap-1">
              <Button variant="danger" className="px-2 py-1 text-xs" onClick={kick} disabled={pending !== null}>
                {pending === 'kick' ? <Spinner label="Removendo" /> : null}
                Confirmar
              </Button>
              <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setConfirmKick(false)}>
                Cancelar
              </Button>
            </span>
          ) : (
            <Button
              variant="ghost"
              className="px-2 py-1 text-xs text-danger hover:text-danger"
              onClick={() => setConfirmKick(true)}
              aria-label={`Remover ${name} da sala`}
            >
              Remover
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
