import { Injectable } from '@nestjs/common';

@Injectable()
export class ArenaRoomService {
  createRoom(roomId: string, metadata: Record<string, unknown> = {}) {
    return { roomId, metadata };
  }
}
