import { ROOM_CODE_ALPHABET } from '@telinha/shared';
import { describe, expect, it } from 'vitest';
import { generateIdentity, generateRoomCode, uniqueName } from './ids.js';

describe('código de sala', () => {
  it('tem 6 caracteres do alfabeto permitido', () => {
    for (let i = 0; i < 500; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(6);
      for (const ch of code) expect(ROOM_CODE_ALPHABET).toContain(ch);
    }
  });
  it('não usa caracteres ambíguos', () => {
    for (const ch of '01OIL') expect(ROOM_CODE_ALPHABET).not.toContain(ch);
  });
});

describe('identity', () => {
  it('é u_ + 10 caracteres', () => {
    expect(generateIdentity()).toMatch(/^u_[A-Za-z0-9_-]{10}$/);
  });
});

describe('uniqueName', () => {
  it('mantém nome livre e adiciona sufixo quando repetido', () => {
    expect(uniqueName('Ana', [])).toBe('Ana');
    expect(uniqueName('Ana', ['Bia'])).toBe('Ana');
    expect(uniqueName('Ana', ['ana'])).toBe('Ana (2)');
    expect(uniqueName('Ana', ['Ana', 'Ana (2)'])).toBe('Ana (3)');
    expect(uniqueName('Ana', ['Ana', 'Ana (3)'])).toBe('Ana (2)');
  });
});
