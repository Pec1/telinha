import { z } from 'zod';

export const errorCodes = [
  'INVALID_INPUT',
  'UNAUTHORIZED',
  'NOT_HOST',
  'ROOM_NOT_FOUND',
  'PARTICIPANT_NOT_FOUND',
  'ROOM_FULL',
  'SCREEN_LIMIT',
  'KICKED',
  'RATE_LIMITED',
  'NOT_FOUND',
  'INTERNAL',
] as const;

export const errorCodeSchema = z.enum(errorCodes);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
  }),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
