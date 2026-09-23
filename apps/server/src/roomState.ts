/** Estado em memória por sala. Assume uma única instância do server. */
export interface RoomState {
  /** Convidados (não host) com permissão de tela. */
  sharers: Set<string>;
  /** Identities removidas pelo host: não podem voltar com /rejoin. */
  kicked: Set<string>;
}

export class RoomStateStore {
  private readonly rooms = new Map<string, RoomState>();

  get(code: string): RoomState | undefined {
    return this.rooms.get(code);
  }

  set(code: string, state: RoomState): RoomState {
    this.rooms.set(code, state);
    return state;
  }

  delete(code: string): void {
    this.rooms.delete(code);
  }

  has(code: string): boolean {
    return this.rooms.has(code);
  }
}
