import type { Context } from 'hono';
import type { z } from 'zod';
import { ApiError, zodMessage } from './errors.js';

/** Lê e valida o corpo JSON. Qualquer falha vira 400 INVALID_INPUT. */
export async function readJson<S extends z.ZodType>(c: Context, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new ApiError(400, 'INVALID_INPUT', 'Corpo da requisição precisa ser JSON.');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ApiError(400, 'INVALID_INPUT', zodMessage(parsed.error));
  return parsed.data;
}

export function parseParam<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiError(400, 'INVALID_INPUT', zodMessage(parsed.error));
  return parsed.data;
}
