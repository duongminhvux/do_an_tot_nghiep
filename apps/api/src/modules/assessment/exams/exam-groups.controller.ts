import { Controller,Get,Header,Param,Query,Req } from '@nestjs/common';
import { QueryExamGroupDto } from './dto/query-exam-group.dto.js';
import { ExamGroupsService } from './exam-groups.service.js';

@Controller('exam-groups')
export class ExamGroupsController {
  constructor(private readonly examGroupsService: ExamGroupsService) {}

  @Get()
  findAll(@Query() query: QueryExamGroupDto) {
    return this.examGroupsService.findAll({ ...query, isActive: true });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.examGroupsService.findOne(id);
  }

  @Get(':id/exams')
  getExams(@Param('id') id: string, @Query() query: any) {
    return this.examGroupsService.getExams(id, query);
  }
  @Get(':id/progress')
  @Header('Cache-Control','private, no-store')
  progress(@Param('id') id:string,@Req() req:{user:{_id:string}}){
    return this.examGroupsService.getProgress(id,String(req.user._id));
  }
}
