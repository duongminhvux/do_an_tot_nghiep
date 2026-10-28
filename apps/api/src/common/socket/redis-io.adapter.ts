import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { ServerOptions } from 'socket.io';
import { httpPolicy } from '../../platform/http-policy.js';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  constructor(app: INestApplicationContext, private readonly configService: ConfigService) {
    super(app);
  }

  async connectToRedis() {
    const pubClient = createClient({
      url: this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379' });

    const subClient = pubClient.duplicate();

    await Promise.all([
      pubClient.connect(),
      subClient.connect(),
    ]);

    this.adapterConstructor = createAdapter(
      pubClient,
      subClient,
    );
  }

  createIOServer(
    port: number,
    options?: ServerOptions,
  ) {
    const policy = httpPolicy(this.configService);
    const server = super.createIOServer(port, {
      ...options,
      cors: { origin: policy.origins, credentials: true },
      // WebSocket upgrades need their own origin gate; CORS covers HTTP polling.
      allowRequest: (req, callback) => callback(null, policy.allowsOrigin(req.headers.origin)),
    } as ServerOptions);

    server.adapter(this.adapterConstructor);

    return server;
  }
}
