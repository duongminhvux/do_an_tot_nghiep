import {
    Injectable,
    OnModuleDestroy,
    OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService
    implements OnModuleInit, OnModuleDestroy {
    constructor(private readonly configService: ConfigService) { }
    private client: RedisClientType;

    async onModuleInit() {
        this.client = createClient({
            url:this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379' });

        this.client.on('error', (error) => {
            console.error('Redis error:', error);
        });

        await this.client.connect();

        console.log('Redis connected');
    }

    getClient() {
        return this.client;
    }

    async onModuleDestroy() {
        if (this.client?.isOpen) {
            await this.client.quit();
        }
    }
}
