import { Link } from 'react-router';
import { Button, Logo } from '../ui';

export type EndReason = 'kicked' | 'closed' | 'duplicate' | 'error';

const content: Record<EndReason, { title: string; body: string }> = {
  kicked: {
    title: 'Você foi removido',
    body: 'O host removeu você desta sala. Não é possível voltar com esta sessão.',
  },
  closed: {
    title: 'Sala encerrada',
    body: 'Esta sala não existe mais. Ela fecha sozinha alguns minutos depois que todos saem.',
  },
  duplicate: {
    title: 'Você entrou em outra aba',
    body: 'Esta sessão foi aberta em outra aba ou dispositivo, então esta conexão foi encerrada.',
  },
  error: {
    title: 'Conexão perdida',
    body: 'Não foi possível manter a conexão com a sala.',
  },
};

export function EndScreen({
  reason,
  detail,
  onRetry,
}: {
  reason: EndReason;
  detail?: string;
  onRetry?: () => void;
}) {
  const { title, body } = content[reason];
  return (
    <main className="flex min-h-full flex-col items-center justify-center px-4 py-12 text-center">
      <Logo className="mb-10 text-2xl" />
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-3 text-muted">{body}</p>
        {detail && <p className="mt-2 text-sm text-muted/80">{detail}</p>}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {onRetry && <Button onClick={onRetry}>Tentar de novo</Button>}
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium hover:bg-border/60"
          >
            Voltar para o início
          </Link>
        </div>
      </div>
    </main>
  );
}
