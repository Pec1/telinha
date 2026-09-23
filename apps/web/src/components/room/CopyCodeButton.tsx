import { useState } from 'react';

/** Mostra o código da sala; clicar copia o código. */
export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Sem clipboard: o código continua visível para copiar à mão.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="Copiar código da sala"
      aria-label={copied ? `Código ${code} copiado` : `Copiar código da sala ${code}`}
      className="rounded-md px-2 py-1 text-sm text-muted hover:bg-surface-2 hover:text-fg"
    >
      {copied ? (
        <span className="text-success">Código copiado</span>
      ) : (
        <>
          Sala <span className="font-mono font-semibold tracking-widest text-fg">{code}</span>
        </>
      )}
    </button>
  );
}
