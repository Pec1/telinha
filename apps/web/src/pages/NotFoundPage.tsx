import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <Link to="/" className="text-accent underline-offset-4 hover:underline">
        Voltar para o início
      </Link>
    </main>
  );
}
