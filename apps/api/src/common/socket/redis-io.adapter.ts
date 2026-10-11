import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplicationContext } from '@nestjs/common';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { ConfigService } from '@nestjs/config';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  constructor(app: INestApplicationContext, private readonly configService: ConfigService) {
    super(app);
  }

  async connectToRedis() {
    const pubClient = createClient({
      url: this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379',
    });

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
    const server = super.createIOServer(
      port,
      options,
    );

    server.adapter(this.adapterConstructor);

    return server;
  }
}
