import { AdminController } from "../../auth/decorators/admin-controller.decorator.js";import { Body, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CreateWordDto } from "./dto/create-word.dto.js";
import { UpdateWordDto } from "./dto/update-word.dto.js";
import { QueryWordDto } from "./dto/query-word.dto.js";
import { WordsService } from "./words.service.js";

@AdminController("words")
export class AdminWordsController {
  constructor(private readonly wordsService: WordsService) {}

  @Post()
  create(@Body() createWordDto: CreateWordDto) {
    return this.wordsService.create(createWordDto);
  }

  @Get()
  findAll(@Query() query: QueryWordDto) {
    return this.wordsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.wordsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateWordDto: UpdateWordDto) {
    return this.wordsService.update(id, updateWordDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.wordsService.remove(id);
  }

  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.wordsService.restore(id);
  }
}
