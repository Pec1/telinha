import { describe, expect, it } from 'vitest';
import { nicknameSchema, parseRoomMetadata, roomCodeSchema } from './schemas.js';

describe('nicknameSchema', () => {
  it('faz trim e aceita 2–24 caracteres', () => {
    expect(nicknameSchema.parse('  Ana  ')).toBe('Ana');
    expect(nicknameSchema.safeParse('A').success).toBe(false);
    expect(nicknameSchema.safeParse('x'.repeat(25)).success).toBe(false);
    expect(nicknameSchema.safeParse('x'.repeat(24)).success).toBe(true);
  });

  it('rejeita caracteres de controle', () => {
    expect(nicknameSchema.safeParse('Ana\u0000').success).toBe(false);
    expect(nicknameSchema.safeParse('An\na').success).toBe(false);
    expect(nicknameSchema.safeParse('Ana‮').success).toBe(false);
  });

  it('conta emoji como um caractere', () => {
    expect(nicknameSchema.safeParse('🎮🎮').success).toBe(true);
  });
});

describe('roomCodeSchema', () => {
  it('normaliza para maiúsculas', () => {
    expect(roomCodeSchema.parse('abc234')).toBe('ABC234');
  });
  it('rejeita caracteres fora do alfabeto', () => {
    expect(roomCodeSchema.safeParse('ABC10O').success).toBe(false);
    expect(roomCodeSchema.safeParse('ABC23').success).toBe(false);
  });
});

describe('parseRoomMetadata', () => {
  it('lê metadata válida e ignora inválida', () => {
    expect(parseRoomMetadata('{"hostIdentity":"u_abcdefghij","createdAt":1}')).toEqual({
      hostIdentity: 'u_abcdefghij',
      createdAt: 1,
    });
    expect(parseRoomMetadata('lixo')).toBeNull();
    expect(parseRoomMetadata('')).toBeNull();
  });
});
