import { Injectable } from '@nestjs/common';
import { CreateAttemptDto } from './dto/create-attempt.dto.js';
import { UpdateAttemptDto } from './dto/update-attempt.dto.js';

@Injectable()
export class AttemptsService {
  create(createAttemptDto: CreateAttemptDto) {
    return 'This action adds a new attempt';
  }

  findAll() {
    return `This action returns all attempts`;
  }

  findOne(id: number) {
    return `This action returns a #${id} attempt`;
  }

  update(id: number, updateAttemptDto: UpdateAttemptDto) {
    return `This action updates a #${id} attempt`;
  }

  remove(id: number) {
    return `This action removes a #${id} attempt`;
  }
}
