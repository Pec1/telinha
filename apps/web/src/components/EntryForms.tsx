import {
  ROOM_CODE_LENGTH,
  nicknameSchema,
  roomCodeSchema,
  type CreateRoomResponse,
  type JoinRoomResponse,
} from '@telinha/shared';
import { useState, type FormEvent } from 'react';
import { ApiRequestError, apiRequest } from '../lib/api';
import { Button, Spinner, TextField } from './ui';

export interface EnteredRoom {
  code: string;
  identity: string;
  name: string;
  sessionKey: string;
  token: string;
  url: string;
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) return err.message;
  return 'Algo deu errado. Tente novamente.';
}

function validateNickname(value: string): string | null {
  const r = nicknameSchema.safeParse(value);
  return r.success ? null : (r.error.issues[0]?.message ?? 'Apelido inválido.');
}

export function CreateRoomForm({ onEntered }: { onEntered: (room: EnteredRoom) => void }) {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const invalid = validateNickname(nickname);
    if (invalid) return setError(invalid);
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<CreateRoomResponse>('/api/rooms', { body: { nickname } });
      onEntered(res);
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <TextField
        label="Seu apelido"
        name="nickname"
        autoComplete="nickname"
        placeholder="Como vão te chamar"
        maxLength={24}
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        error={error}
        autoFocus
      />
      <Button type="submit" disabled={loading}>
        {loading ? <Spinner label="Criando sala" /> : null}
        Criar sala
      </Button>
      <p className="text-xs text-muted">
        Você será o host: só você compartilha a tela até dar permissão a alguém.
      </p>
    </form>
  );
}

export function JoinRoomForm({
  initialCode = '',
  onEntered,
}: {
  initialCode?: string;
  onEntered: (room: EnteredRoom) => void;
}) {
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [nickname, setNickname] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [nickError, setNickError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsedCode = roomCodeSchema.safeParse(code);
    const cErr = parsedCode.success ? null : (parsedCode.error.issues[0]?.message ?? 'Código inválido.');
    const nErr = validateNickname(nickname);
    setCodeError(cErr);
    setNickError(nErr);
    setFormError(null);
    if (!parsedCode.success || nErr) return;

    setLoading(true);
    try {
      const res = await apiRequest<JoinRoomResponse>(`/api/rooms/${parsedCode.data}/join`, {
        body: { nickname },
      });
      onEntered({ ...res, code: parsedCode.data });
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'ROOM_NOT_FOUND') setCodeError(err.message);
      else setFormError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <TextField
        label="Código da sala"
        name="code"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="EX: 7KQ2MX"
        maxLength={ROOM_CODE_LENGTH}
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
        error={codeError}
        className="[&_input]:font-mono [&_input]:tracking-[0.3em] [&_input]:uppercase"
        autoFocus={!initialCode}
      />
      <TextField
        label="Seu apelido"
        name="nickname"
        autoComplete="nickname"
        placeholder="Como vão te chamar"
        maxLength={24}
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        error={nickError}
        autoFocus={!!initialCode}
      />
      {formError && (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {formError}
        </p>
      )}
      <Button type="submit" disabled={loading}>
        {loading ? <Spinner label="Entrando" /> : null}
        Entrar
      </Button>
    </form>
  );
}
