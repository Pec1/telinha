import { describe, expect, it } from 'vitest';
import { pickFocusedIdentity } from './focus';

const me = { identity: 'u_me', isLocal: true };
const a = { identity: 'u_a', isLocal: false };
const b = { identity: 'u_b', isLocal: false };

describe('pickFocusedIdentity', () => {
  it('sem telas, nada em destaque', () => {
    expect(pickFocusedIdentity([], null)).toBeNull();
    expect(pickFocusedIdentity([], 'u_a')).toBeNull();
  });
  it('respeita a escolha do espectador', () => {
    expect(pickFocusedIdentity([a, b], 'u_b')).toBe('u_b');
    expect(pickFocusedIdentity([me, a], 'u_me')).toBe('u_me');
  });
  it('prefere a tela de outra pessoa à própria', () => {
    expect(pickFocusedIdentity([me, a], null)).toBe('u_a');
    expect(pickFocusedIdentity([me], null)).toBe('u_me');
  });
  it('se a escolhida parou, cai para a próxima', () => {
    expect(pickFocusedIdentity([a], 'u_b')).toBe('u_a');
  });
});
