import { z } from 'zod';
import {
  IDENTITY_ID_LENGTH,
  IDENTITY_PREFIX,
  NICKNAME_MAX,
  NICKNAME_MIN,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from './constants.js';

// Categoria Unicode "Cc" (controle) e "Cf" (formatação invisível, ex: RTL override).
const CONTROL_CHARS = /[\p{Cc}\p{Cf}]/u;

export const nicknameSchema = z
  .string({ error: 'Informe um apelido.' })
  .trim()
  .refine((s) => [...s].length >= NICKNAME_MIN, {
    error: `O apelido precisa ter pelo menos ${NICKNAME_MIN} caracteres.`,
  })
  .refine((s) => [...s].length <= NICKNAME_MAX, {
    error: `O apelido pode ter no máximo ${NICKNAME_MAX} caracteres.`,
  })
  .refine((s) => !CONTROL_CHARS.test(s), {
    error: 'O apelido contém caracteres inválidos.',
  });

/** Nome exibido: apelido + sufixo opcional de desambiguação, ex: "Ana (2)". */
export const displayNameSchema = z
  .string()
  .trim()
  .refine((s) => {
    const len = [...s].length;
    return len >= NICKNAME_MIN && len <= NICKNAME_MAX + 8 && !CONTROL_CHARS.test(s);
  }, { error: 'Nome inválido.' });

const roomCodeRegex = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

export const roomCodeSchema = z
  .string({ error: 'Informe o código da sala.' })
  .trim()
  .toUpperCase()
  .regex(roomCodeRegex, { error: `O código tem ${ROOM_CODE_LENGTH} caracteres (letras e números).` });

const identityRegex = new RegExp(`^${IDENTITY_PREFIX}[A-Za-z0-9_-]{${IDENTITY_ID_LENGTH}}$`);
export const identitySchema = z.string().regex(identityRegex, { error: 'Identidade inválida.' });

/** Metadata da sala no LiveKit. Só o backend escreve. */
export const roomMetadataSchema = z.object({
  hostIdentity: identitySchema,
  createdAt: z.number().int(),
});
export type RoomMetadata = z.infer<typeof roomMetadataSchema>;

export function parseRoomMetadata(raw: string | undefined | null): RoomMetadata | null {
  if (!raw) return null;
  try {
    const parsed = roomMetadataSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
