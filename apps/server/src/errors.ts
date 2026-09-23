import type { ApiErrorBody, ErrorCode } from '@telinha/shared';
import type { Context, ErrorHandler, NotFoundHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { z } from 'zod';

const defaultMessages: Record<ErrorCode, string> = {
  INVALID_INPUT: 'Dados inválidos.',
  UNAUTHORIZED: 'Sessão inválida.',
  NOT_HOST: 'Apenas o host pode fazer isso.',
  ROOM_NOT_FOUND: 'Sala não encontrada.',
  PARTICIPANT_NOT_FOUND: 'Participante não encontrado.',
  ROOM_FULL: 'A sala está cheia.',
  SCREEN_LIMIT: 'Limite de pessoas com permissão de tela atingido.',
  KICKED: 'Você foi removido desta sala.',
  RATE_LIMITED: 'Muitas requisições. Tente novamente em instantes.',
  NOT_FOUND: 'Rota não encontrada.',
  INTERNAL: 'Erro interno. Tente novamente.',
};

export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: ErrorCode,
    message: string = defaultMessages[code],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorBody(code: ErrorCode, message: string = defaultMessages[code]): ApiErrorBody {
  return { error: { code, message } };
}

export function jsonError(c: Context, status: ContentfulStatusCode, code: ErrorCode, message?: string) {
  return c.json(errorBody(code, message), status);
}

/** Primeira mensagem legível de um erro do Zod. */
export function zodMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? defaultMessages.INVALID_INPUT;
}

export const onError: ErrorHandler = (err, c) => {
  if (err instanceof ApiError) return jsonError(c, err.status, err.code, err.message);
  console.error('[erro]', err);
  return jsonError(c, 500, 'INTERNAL');
};

export const onNotFound: NotFoundHandler = (c) => jsonError(c, 404, 'NOT_FOUND');
