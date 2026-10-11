import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ArenaService } from './arena.service.js';

@Controller('arena')
export class ArenaController {
    constructor(private readonly arenaService: ArenaService) {}

    @Get("profile/:userId")
    getProfile(@Param('userId') userId: string) {
        return this.arenaService.getOrCreate(userId);
    }
}