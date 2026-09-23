import { IDENTITY_ID_LENGTH, IDENTITY_PREFIX, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@telinha/shared';
import { customAlphabet, nanoid } from 'nanoid';

export const generateRoomCode = customAlphabet(ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH);

export function generateIdentity(): string {
  return IDENTITY_PREFIX + nanoid(IDENTITY_ID_LENGTH);
}

/** Nickname repetido na sala ganha sufixo " (2)", " (3)"... (comparação sem diferenciar maiúsculas). */
export function uniqueName(nickname: string, taken: Iterable<string>): string {
  const normalize = (s: string) => s.trim().toLocaleLowerCase('pt-BR');
  const used = new Set(Array.from(taken, normalize));
  if (!used.has(normalize(nickname))) return nickname;
  for (let i = 2; ; i++) {
    const candidate = `${nickname} (${i})`;
    if (!used.has(normalize(candidate))) return candidate;
  }
}
