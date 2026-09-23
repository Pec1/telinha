import { useConnectionQualityIndicator } from '@livekit/components-react';
import { ConnectionQuality, type Participant } from 'livekit-client';

const labels: Record<ConnectionQuality, string> = {
  [ConnectionQuality.Excellent]: 'Conexão excelente',
  [ConnectionQuality.Good]: 'Conexão boa',
  [ConnectionQuality.Poor]: 'Conexão ruim',
  [ConnectionQuality.Lost]: 'Conexão perdida',
  [ConnectionQuality.Unknown]: 'Qualidade da conexão desconhecida',
};

const bars: Record<ConnectionQuality, number> = {
  [ConnectionQuality.Excellent]: 3,
  [ConnectionQuality.Good]: 2,
  [ConnectionQuality.Poor]: 1,
  [ConnectionQuality.Lost]: 0,
  [ConnectionQuality.Unknown]: 0,
};

const colors: Record<ConnectionQuality, string> = {
  [ConnectionQuality.Excellent]: 'bg-success',
  [ConnectionQuality.Good]: 'bg-success',
  [ConnectionQuality.Poor]: 'bg-amber-400',
  [ConnectionQuality.Lost]: 'bg-danger',
  [ConnectionQuality.Unknown]: 'bg-muted',
};

export function ConnectionQualityBars({ participant }: { participant: Participant }) {
  const { quality } = useConnectionQualityIndicator({ participant });
  const active = bars[quality];
  return (
    <span role="img" aria-label={labels[quality]} title={labels[quality]} className="flex h-3.5 items-end gap-0.5">
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`w-1 rounded-sm ${i <= active ? colors[quality] : 'bg-border'}`}
          style={{ height: `${i * 33}%` }}
        />
      ))}
    </span>
  );
}
