import type { Server } from 'socket.io';
import { ArenaPresenceService } from './arena-presence.service.js';

function fixture() {
  const sockets = [
    { id: 'tab-a', data: { userId: 'a' } },
    { id: 'tab-a2', data: { userId: 'a' } },
    { id: 'tab-b', data: { userId: 'b' } },
    { id: 'unauthenticated', data: {} },
  ];
  const server = { fetchSockets: vi.fn(async () => [...sockets]) };
  const service = new ArenaPresenceService();
  service.bindServer(server as unknown as Pick<Server, 'fetchSockets'>);
  return { service, server, sockets };
}

describe('Arena live presence', () => {
  it('counts users once across multiple tabs and excludes unauthenticated sockets', async () => {
    const f = fixture();
    expect(await f.service.overview()).toEqual({ onlineCount: 2 });
    expect(await f.service.getSocketIds('a')).toEqual(['tab-a', 'tab-a2']);
  });
  it('does not report disconnected users or legacy Redis entries as online', async () => {
    const f = fixture();
    f.sockets.splice(0, 3);
    expect(await f.service.isOnline('a')).toBe(false);
    expect(await f.service.isOnline('b')).toBe(false);
    expect(await f.service.overview()).toEqual({ onlineCount: 0 });
  });
  it('keeps a user online when another tab remains connected', async () => {
    const f = fixture();
    expect(await f.service.disconnect('a', 'tab-a')).toMatchObject({
      online: true });
  });
  it('marks the last socket offline even during its disconnect callback', async () => {
    const f = fixture();
    expect(await f.service.disconnect('b', 'tab-b')).toMatchObject({
      online: false });
  });
  it('reads the current socket source on every request', async () => {
    const f = fixture();
    expect(await f.service.isOnline('b')).toBe(true);
    f.sockets.splice(2, 1);
    expect(await f.service.isOnline('b')).toBe(false);
  });
});
