import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AttemptsService } from './attempts.service.js';
import { CreateAttemptDto } from './dto/create-attempt.dto.js';
import { UpdateAttemptDto } from './dto/update-attempt.dto.js';

@Controller('attempts')
export class AttemptsController {
  constructor(private readonly attemptsService: AttemptsService) {}

  @Post()
  create(@Body() createAttemptDto: CreateAttemptDto) {
    return this.attemptsService.create(createAttemptDto);
  }

  @Get()
  findAll() {
    return this.attemptsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.attemptsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAttemptDto: UpdateAttemptDto) {
    return this.attemptsService.update(+id, updateAttemptDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.attemptsService.remove(+id);
  }
}
