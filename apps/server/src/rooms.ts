import {
  parseRoomMetadata,
  type CreateRoomResponse,
  type JoinRoomResponse,
  type RejoinRoomResponse,
  type RoomInfoResponse,
  type RoomMetadata,
} from '@telinha/shared';
import type { ParticipantInfo, Room } from 'livekit-server-sdk';
import type { Config } from './config.js';
import { ApiError } from './errors.js';
import { generateIdentity, generateRoomCode, uniqueName } from './ids.js';
import {
  createToken,
  hasScreenPermission,
  serializeMetadata,
  type Role,
  type RoomApi,
} from './livekit.js';
import { RoomStateStore, type RoomState } from './roomState.js';
import { signSessionKey } from './session.js';

interface RoomSnapshot {
  room: Room;
  metadata: RoomMetadata | null;
  participants: ParticipantInfo[];
  state: RoomState;
}

export class RoomManager {
  readonly store = new RoomStateStore();

  constructor(
    private readonly config: Config,
    private readonly api: RoomApi,
    private readonly now: () => number = Date.now,
  ) {}

  // ---------- Consultas ----------

  async findRoom(code: string): Promise<Room | null> {
    const rooms = await this.api.listRooms([code]);
    return rooms.find((r) => r.name === code) ?? null;
  }

  /** Participantes efetivamente na sala (ignora quem já está desconectando). */
  async listParticipants(code: string): Promise<ParticipantInfo[]> {
    return this.api.listParticipants(code);
  }

  /**
   * Carrega sala, metadata, participantes e estado em memória.
   * Se o server não conhece a sala (reiniciou/hibernou), reconstrói o estado a partir
   * da metadata e das permissões atuais dos participantes conectados.
   */
  async snapshot(code: string): Promise<RoomSnapshot> {
    const room = await this.findRoom(code);
    if (!room) throw new ApiError(404, 'ROOM_NOT_FOUND');
    const participants = await this.listParticipants(code);
    const metadata = parseRoomMetadata(room.metadata);
    const state = this.store.get(code) ?? this.store.set(code, this.rebuildState(metadata, participants));
    return { room, metadata, participants, state };
  }

  private rebuildState(metadata: RoomMetadata | null, participants: ParticipantInfo[]): RoomState {
    const sharers = new Set<string>();
    for (const p of participants) {
      if (p.identity !== metadata?.hostIdentity && hasScreenPermission(p.permission)) sharers.add(p.identity);
    }
    // Removidos não podem ser reconstruídos: quem foi removido não está mais conectado.
    return { sharers, kicked: new Set() };
  }

  roleOf(identity: string, metadata: RoomMetadata | null, state: RoomState): Role {
    if (metadata?.hostIdentity === identity) return 'host';
    if (state.sharers.has(identity)) return 'sharer';
    return 'viewer';
  }

  sessionKey(code: string, identity: string): string {
    return signSessionKey(this.config.sessionSecret, code, identity);
  }

  // ---------- Ações ----------

  async createRoom(nickname: string): Promise<CreateRoomResponse> {
    const code = await this.allocateCode();
    const identity = generateIdentity();
    const metadata: RoomMetadata = { hostIdentity: identity, createdAt: this.now() };

    await this.api.createRoom({
      name: code,
      emptyTimeout: this.config.emptyTimeoutSeconds,
      // Sem departureTimeout explícito: o LiveKit usa o padrão (20s) depois que alguém entrou.
      maxParticipants: this.config.maxParticipants,
      metadata: serializeMetadata(metadata),
    });
    this.store.set(code, { sharers: new Set(), kicked: new Set() });

    const token = await createToken(this.config, { room: code, identity, name: nickname, role: 'host' });
    return {
      code,
      token,
      url: this.config.livekit.url,
      identity,
      name: nickname,
      sessionKey: this.sessionKey(code, identity),
    };
  }

  private async allocateCode(): Promise<string> {
    // 31^6 ≈ 887 milhões de códigos: colisão é raríssima, mas conferimos mesmo assim.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateRoomCode();
      if (!this.store.has(code) && !(await this.findRoom(code))) return code;
    }
    throw new ApiError(500, 'INTERNAL', 'Não foi possível gerar um código de sala.');
  }

  async getInfo(code: string): Promise<RoomInfoResponse> {
    const room = await this.findRoom(code);
    if (!room) return { exists: false, participants: 0, full: false };
    const participants = (await this.listParticipants(code)).length;
    return { exists: true, participants, full: participants >= this.config.maxParticipants };
  }

  async join(code: string, nickname: string): Promise<JoinRoomResponse> {
    const { participants } = await this.snapshot(code);
    if (participants.length >= this.config.maxParticipants) throw new ApiError(409, 'ROOM_FULL');

    const identity = generateIdentity();
    const name = uniqueName(
      nickname,
      participants.map((p) => p.name),
    );
    const token = await createToken(this.config, { room: code, identity, name, role: 'viewer' });
    return { token, url: this.config.livekit.url, identity, name, sessionKey: this.sessionKey(code, identity) };
  }

  /** Volta para a sala com a mesma identity (ex: reload), reaplicando os grants que ela tinha. */
  async rejoin(code: string, identity: string, name: string): Promise<RejoinRoomResponse> {
    const { participants, metadata, state } = await this.snapshot(code);
    if (state.kicked.has(identity)) throw new ApiError(403, 'KICKED');

    const alreadyIn = participants.some((p) => p.identity === identity);
    if (!alreadyIn && participants.length >= this.config.maxParticipants) throw new ApiError(409, 'ROOM_FULL');

    const role = this.roleOf(identity, metadata, state);
    const token = await createToken(this.config, { room: code, identity, name, role });
    return { token, url: this.config.livekit.url };
  }
}
