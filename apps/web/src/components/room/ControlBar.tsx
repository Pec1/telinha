import { useLocalParticipant } from '@livekit/components-react';
import { useState } from 'react';
import { useCanShare } from '../../hooks/useCanShare';
import { canCaptureScreen, type ShareMode } from '../../lib/media';
import {
  CheckIcon,
  ExitFullscreenIcon,
  FullscreenIcon,
  LeaveIcon,
  LinkIcon,
  ScreenShareIcon,
  StopShareIcon,
  UsersIcon,
} from '../icons';
import { Button, Spinner } from '../ui';
import { ShareModeSelect, ShareModeWarning } from './ShareModeSelect';

interface Props {
  code: string;
  busy: boolean;
  mode: ShareMode;
  onModeChange: (mode: ShareMode) => void;
  onToggleShare: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  participantCount: number;
  onLeave: () => void;
}

export function ControlBar(props: Props) {
  const { code, busy, mode, onModeChange, onToggleShare, isFullscreen, onToggleFullscreen, onLeave } = props;
  const canShare = useCanShare();
  const { isScreenShareEnabled } = useLocalParticipant();
  const [copied, setCopied] = useState(false);
  const supported = canCaptureScreen();

  async function copyLink() {
    const link = `${window.location.origin}/s/${code}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Clipboard indisponível (ex: contexto não seguro): fallback com seleção manual.
      window.prompt('Copie o link da sala:', link);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      role="toolbar"
      aria-label="Controles da sala"
      className="flex flex-wrap items-center justify-center gap-2 border-t border-border bg-surface px-3 py-3"
    >
      {canShare && supported && <ShareModeWarning mode={mode} />}

      {canShare && supported && (
        <>
          <Button
            variant={isScreenShareEnabled ? 'danger' : 'primary'}
            onClick={onToggleShare}
            disabled={busy}
            aria-pressed={isScreenShareEnabled}
          >
            {busy ? <Spinner /> : isScreenShareEnabled ? <StopShareIcon /> : <ScreenShareIcon />}
            {isScreenShareEnabled ? 'Parar' : 'Compartilhar tela'}
          </Button>
          <ShareModeSelect mode={mode} onChange={onModeChange} disabled={busy} />
        </>
      )}

      <Button
        variant="secondary"
        onClick={onToggleFullscreen}
        aria-label={isFullscreen ? 'Sair da tela cheia (Esc)' : 'Tela cheia (F)'}
      >
        {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
        <span className="hidden sm:inline">{isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}</span>
      </Button>

      <Button variant="secondary" onClick={copyLink} aria-label="Copiar link da sala">
        {copied ? <CheckIcon /> : <LinkIcon />}
        <span className="hidden sm:inline">{copied ? 'Link copiado' : 'Copiar link'}</span>
        <span className="sr-only" aria-live="polite">
          {copied ? 'Link copiado' : ''}
        </span>
      </Button>

      <Button
        variant={props.sidebarOpen ? 'secondary' : 'ghost'}
        onClick={props.onToggleSidebar}
        aria-expanded={props.sidebarOpen}
        aria-controls="room-sidebar"
        aria-label={`${props.sidebarOpen ? 'Fechar' : 'Abrir'} participantes (${props.participantCount})`}
      >
        <UsersIcon />
        <span className="tabular-nums">{props.participantCount}</span>
      </Button>

      <Button variant="ghost" onClick={onLeave} aria-label="Sair da sala" className="text-danger hover:text-danger">
        <LeaveIcon />
        <span className="hidden sm:inline">Sair</span>
      </Button>
    </div>
  );
}
