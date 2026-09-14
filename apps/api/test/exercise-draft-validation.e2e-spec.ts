import "reflect-metadata";
import {
  Body,
  Controller,
  INestApplication,
  Module,
  Put,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AudioSegmentType,
  Difficulty,
  ExerciseType,
  ToeicPart,
} from "../src/generated/prisma/client";
import { SaveExerciseDraftDto } from "../src/modules/exercises/dto/exercises.dto";

@Controller()
class DraftValidationController {
  @Put("exercise-draft")
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      // Vitest transpiles this controller without TypeScript's emitted
      // design:paramtypes metadata, so declare the same DTO type explicitly.
      expectedType: SaveExerciseDraftDto,
    }),
  )
  save(@Body() body: SaveExerciseDraftDto): SaveExerciseDraftDto {
    return body;
  }
}

@Module({ controllers: [DraftValidationController] })
class DraftValidationModule {}

const validPayload = {
  type: ExerciseType.TOEIC,
  title: "TOEIC conversation",
  instruction: "Choose the best answer.",
  orderIndex: 0,
  dictationMode: null,
  toeicPart: ToeicPart.PART_3,
  difficulty: Difficulty.INTERMEDIATE,
  sourceScript: "Questions 1 through 3 refer to the following conversation.",
  passThreshold: 80,
  maxPlays: 3,
  maxAttempts: 3,
  ignoreCapitalization: true,
  ignorePunctuation: true,
  ignoreExtraSpaces: true,
  allowMinorTypo: false,
  showTranscript: false,
  showAnswerAfterSubmit: true,
  groups: [
    {
      id: "group-local-1",
      title: "Conversation 1",
      questions: [
        {
          id: "question-local-1",
          text: "What are the speakers discussing?",
          options: [
            { id: "option-local-a", text: "A delivery", correct: true },
            { id: "option-local-b", text: "A meeting", correct: false },
          ],
        },
      ],
    },
  ],
  audioSegments: [
    {
      id: "segment-local-1",
      groupId: "group-local-1",
      questionId: "question-local-1",
      segmentType: AudioSegmentType.SPEAKER,
      speakerLabel: "Woman",
      text: "Has the delivery arrived?",
      language: "en-US",
      speed: 1,
      pauseAfterMs: 300,
    },
  ],
};

describe("SaveExerciseDraftDto nested validation", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DraftValidationModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("accepts a valid nested TOEIC draft with client-local keys", async () => {
    const response = await request(app.getHttpServer())
      .put("/exercise-draft")
      .send(validPayload)
      .expect(200);

    expect(response.body.groups[0].questions[0].options).toHaveLength(2);
    expect(response.body.audioSegments[0].segmentType).toBe(
      AudioSegmentType.SPEAKER,
    );
  });

  it("rejects malformed nested question and option values with HTTP 400", async () => {
    const response = await request(app.getHttpServer())
      .put("/exercise-draft")
      .send({
        ...validPayload,
        groups: [
          {
            id: "group-local-1",
            title: "Conversation 1",
            questions: [
              {
                id: "question-local-1",
                text: 123,
                options: [{ text: "", correct: "yes" }],
              },
            ],
          },
        ],
      })
      .expect(400);

    expect(response.body.message).toEqual(
      expect.arrayContaining([expect.any(String)]),
    );
    expect(JSON.stringify(response.body.message)).toMatch(/text|correct/u);
  });

  it("rejects unknown nested properties instead of silently accepting them", async () => {
    await request(app.getHttpServer())
      .put("/exercise-draft")
      .send({
        ...validPayload,
        groups: [
          {
            ...validPayload.groups[0],
            questions: [
              {
                ...validPayload.groups[0].questions[0],
                leakedCorrectAnswer: true,
              },
            ],
          },
        ],
      })
      .expect(400);
  });
});
