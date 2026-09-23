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
  isNotFoundError,
  permissionFor,
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

  /**
   * Convidados com permissão de tela que estão conectados agora. Quem saiu continua no conjunto
   * (para não perder a permissão num reload), mas não ocupa vaga enquanto estiver fora.
   */
  private activeSharers(state: RoomState, participants: ParticipantInfo[], except?: string): string[] {
    const connected = new Set(participants.map((p) => p.identity));
    return [...state.sharers].filter((id) => id !== except && connected.has(id));
  }

  /** Vagas de tela para convidados: MAX_SHARERS conta o host. */
  private get guestSharerSlots(): number {
    return this.config.maxSharers - 1;
  }

  /** Ações de host: sessionKey já validado na rota; aqui confere a metadata atual. */
  private async requireHost(code: string, identity: string): Promise<RoomSnapshot> {
    const snap = await this.snapshot(code);
    if (snap.metadata?.hostIdentity !== identity) throw new ApiError(403, 'NOT_HOST');
    return snap;
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

    let role = this.roleOf(identity, metadata, state);
    // Enquanto a pessoa estava fora, a vaga de tela pode ter sido ocupada: volta sem permissão.
    if (role === 'sharer' && this.activeSharers(state, participants, identity).length >= this.guestSharerSlots) {
      state.sharers.delete(identity);
      role = 'viewer';
    }
    const token = await createToken(this.config, { room: code, identity, name, role });
    return { token, url: this.config.livekit.url };
  }

  /** Concede ou revoga a permissão de tela de um convidado, com efeito imediato no LiveKit. */
  async setPermission(code: string, hostIdentity: string, targetIdentity: string, canShare: boolean): Promise<void> {
    const { participants, state } = await this.requireHost(code, hostIdentity);
    if (targetIdentity === hostIdentity) {
      throw new ApiError(400, 'INVALID_INPUT', 'O host sempre pode compartilhar a tela.');
    }
    if (!participants.some((p) => p.identity === targetIdentity)) throw new ApiError(404, 'PARTICIPANT_NOT_FOUND');

    if (canShare && this.activeSharers(state, participants, targetIdentity).length >= this.guestSharerSlots) {
      throw new ApiError(
        409,
        'SCREEN_LIMIT',
        `No máximo ${this.config.maxSharers} pessoas podem ter permissão de tela, contando o host.`,
      );
    }

    try {
      await this.api.updateParticipant(code, targetIdentity, { permission: permissionFor(canShare) });
    } catch (err) {
      if (isNotFoundError(err)) throw new ApiError(404, 'PARTICIPANT_NOT_FOUND');
      throw err;
    }
    if (canShare) state.sharers.add(targetIdentity);
    else state.sharers.delete(targetIdentity);
  }

  /** Remove alguém da sala e impede que volte com a mesma sessão. */
  async kick(code: string, hostIdentity: string, targetIdentity: string): Promise<void> {
    const { participants, state } = await this.requireHost(code, hostIdentity);
    if (targetIdentity === hostIdentity) {
      throw new ApiError(400, 'INVALID_INPUT', 'O host não pode remover a si mesmo.');
    }
    const connected = participants.some((p) => p.identity === targetIdentity);
    if (!connected && !state.sharers.has(targetIdentity)) throw new ApiError(404, 'PARTICIPANT_NOT_FOUND');

    // Marca antes de remover: um /rejoin concorrente já é barrado.
    state.kicked.add(targetIdentity);
    state.sharers.delete(targetIdentity);
    if (connected) {
      try {
        await this.api.removeParticipant(code, targetIdentity);
      } catch (err) {
        // Saiu entre a listagem e a remoção: o bloqueio já está registrado.
        if (!isNotFoundError(err)) throw err;
      }
    }
  }
}
