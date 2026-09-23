import { SHARE_MODES, SHARE_PRESETS, type ShareMode } from '../../lib/media';

export const SHARE_MODE_WARNING_ID = 'share-mode-warning';

export function ShareModeSelect({
  mode,
  onChange,
  disabled,
}: {
  mode: ShareMode;
  onChange: (mode: ShareMode) => void;
  disabled?: boolean;
}) {
  const hasWarning = !!SHARE_PRESETS[mode].warning;
  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">Modo de transmissão</span>
      <select
        value={mode}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as ShareMode)}
        title={SHARE_PRESETS[mode].description}
        aria-describedby={hasWarning ? SHARE_MODE_WARNING_ID : undefined}
        className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-fg disabled:opacity-50"
      >
        {SHARE_MODES.map((m) => (
          <option key={m} value={m}>
            {SHARE_PRESETS[m].label} ({SHARE_PRESETS[m].short})
          </option>
        ))}
      </select>
    </label>
  );
}

/** Aviso do modo atual (ex: Ultra exige upload alto). */
export function ShareModeWarning({ mode }: { mode: ShareMode }) {
  const warning = SHARE_PRESETS[mode].warning;
  if (!warning) return null;
  return (
    <p
      id={SHARE_MODE_WARNING_ID}
      role="note"
      className="w-full rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-center text-xs text-amber-300"
    >
      ⚠ Modo {SHARE_PRESETS[mode].label}: {warning}
    </p>
  );
}
