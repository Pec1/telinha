import { ParticipantInfo, ParticipantPermission, Room } from 'livekit-server-sdk';
import { loadConfig, type Config } from './config.js';
import { SCREEN_SOURCES, type RoomApi } from './livekit.js';

export function testConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({
    LIVEKIT_URL: 'wss://exemplo.livekit.cloud',
    LIVEKIT_API_KEY: 'devkey',
    LIVEKIT_API_SECRET: 'devsecret-devsecret-devsecret-00',
    SESSION_SECRET: 'segredo-de-teste-com-32-caracteres!',
    ...overrides,
  });
}

interface FakeParticipant {
  identity: string;
  name: string;
  joinedAt: number;
  permission: ParticipantPermission;
}

/** Implementação em memória do subconjunto do RoomServiceClient usado pelo app. */
export class FakeRoomApi implements RoomApi {
  rooms = new Map<string, { room: Room; participants: Map<string, FakeParticipant> }>();
  private clock = 1000;

  async createRoom(opts: Parameters<RoomApi['createRoom']>[0]): Promise<Room> {
    const room = new Room({
      name: opts.name,
      metadata: opts.metadata ?? '',
      emptyTimeout: opts.emptyTimeout ?? 0,
      maxParticipants: opts.maxParticipants ?? 0,
    });
    this.rooms.set(opts.name, { room, participants: new Map() });
    return room;
  }

  async listRooms(names?: string[]): Promise<Room[]> {
    return [...this.rooms.values()].map((r) => r.room).filter((r) => !names || names.includes(r.name));
  }

  async listParticipants(room: string): Promise<ParticipantInfo[]> {
    const r = this.rooms.get(room);
    if (!r) return [];
    return [...r.participants.values()].map(
      (p) =>
        new ParticipantInfo({
          identity: p.identity,
          name: p.name,
          joinedAt: BigInt(p.joinedAt),
          permission: p.permission,
        }),
    );
  }

  async updateParticipant(room: string, identity: string, opts: unknown): Promise<ParticipantInfo> {
    const p = this.rooms.get(room)?.participants.get(identity);
    if (!p) throw Object.assign(new Error('participant not found'), { status: 404, code: 'not_found' });
    const { permission } = opts as { permission?: Partial<ParticipantPermission> };
    if (permission) p.permission = new ParticipantPermission(permission);
    return new ParticipantInfo({ identity: p.identity, name: p.name, permission: p.permission });
  }

  async updateRoomMetadata(room: string, metadata: string): Promise<Room> {
    const r = this.rooms.get(room);
    if (!r) throw new Error('room not found');
    r.room.metadata = metadata;
    return r.room;
  }

  async removeParticipant(room: string, identity: string): Promise<void> {
    const r = this.rooms.get(room);
    if (!r?.participants.delete(identity)) {
      throw Object.assign(new Error('participant not found'), { status: 404, code: 'not_found' });
    }
  }

  // ---- helpers de teste ----

  connect(room: string, identity: string, name: string, canShare = false) {
    const r = this.rooms.get(room);
    if (!r) throw new Error('sala inexistente');
    r.participants.set(identity, {
      identity,
      name,
      joinedAt: this.clock++,
      permission: new ParticipantPermission({
        canSubscribe: true,
        canPublishData: true,
        canPublish: canShare,
        canPublishSources: canShare ? SCREEN_SOURCES : [],
      }),
    });
  }

  disconnect(room: string, identity: string) {
    this.rooms.get(room)?.participants.delete(identity);
  }

  permissionOf(room: string, identity: string) {
    return this.rooms.get(room)?.participants.get(identity)?.permission;
  }
}
