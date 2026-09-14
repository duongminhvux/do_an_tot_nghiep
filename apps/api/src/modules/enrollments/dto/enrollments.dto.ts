import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsUUID } from "class-validator";
import { EnrollmentStatus } from "../../../generated/prisma/client";

export class EnrollStudentDto {
  @ApiProperty()
  @IsUUID()
  studentId!: string;
}

export class UpdateEnrollmentDto {
  @ApiProperty({ enum: EnrollmentStatus })
  @IsEnum(EnrollmentStatus)
  status!: EnrollmentStatus;
}
