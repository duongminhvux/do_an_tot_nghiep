"use client";

import { ArrowRight, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { demoQuestions } from "../arena-data";

import type { ArenaController } from "../hooks/use-arena-controller";

type Props = Pick<
  ArenaController,
  | "text"
  | "panel"
  | "opponent"
  | "question"
  | "setQuestion"
  | "answer"
  | "setAnswer"
  | "score"
  | "finished"
  | "setFinished"
  | "startGame"
  | "chooseAnswer"
>;

export function DemoGamePanel({
  text,
  panel,
  opponent,
  question,
  setQuestion,
  answer,
  setAnswer,
  score,
  finished,
  setFinished,
  startGame,
  chooseAnswer,
}: Props) {
  return (
    <>
      {panel === "game" && (
        <div className="mt-5">
          {finished ? (
            <div className="py-4 text-center">
              <Trophy className="mx-auto size-14 text-amber-500" />
              <h3 className="mt-4 text-xl font-bold text-slate-900">
                {text("Hoàn thành trận đấu!", "Match complete!")}
              </h3>
              <p className="mt-3 text-3xl font-bold text-blue-600">
                {score} / {demoQuestions.length}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {text(
                  "câu trả lời đúng · Kết quả thử không lưu vào xếp hạng",
                  "correct answers · Demo results do not affect your rating",
                )}
              </p>
              <Button type="button" onClick={startGame} className="mt-6 w-full">
                {text("Chơi lại", "Play again")}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {text("Bạn", "You")}{" "}
                  <strong className="text-blue-600">{score}</strong>
                </span>
                <span>
                  {text("Câu", "Question")} {question + 1}/
                  {demoQuestions.length}
                </span>
                <span className="max-w-32 truncate">{opponent}</span>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{
                    width: `${((question + 1) / demoQuestions.length) * 100}%`,
                  }}
                />
              </div>
              <p className="mt-6 text-center text-xs text-slate-500">
                {text(
                  "Chọn nghĩa tiếng Việt của từ",
                  "Choose the Vietnamese meaning",
                )}
              </p>
              <h3 className="my-3 text-center text-3xl font-bold text-slate-900">
                {demoQuestions[question]!.word}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {demoQuestions[question]!.options.map((option, index) => (
                  <button
                    key={option}
                    type="button"
                    disabled={answer !== null}
                    onClick={() => chooseAnswer(index)}
                    className={cn(
                      "min-h-14 cursor-pointer rounded-lg border px-3 text-sm font-medium transition-colors disabled:cursor-default",
                      answer === null
                        ? "border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50"
                        : index === demoQuestions[question]!.answer
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : index === answer
                            ? "border-red-300 bg-red-50 text-red-600"
                            : "border-slate-100 text-slate-400",
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {answer !== null && (
                <div className="mt-4" role="status">
                  <p className="text-center text-xs text-slate-500">
                    {answer === demoQuestions[question]!.answer
                      ? text("Chính xác! Làm tốt lắm.", "Correct! Well done.")
                      : text(
                          "Đáp án đúng được tô màu xanh.",
                          "The correct answer is highlighted in green.",
                        )}
                  </p>
                  <Button
                    type="button"
                    onClick={() => {
                      if (question === demoQuestions.length - 1)
                        setFinished(true);
                      else {
                        setQuestion(question + 1);
                        setAnswer(null);
                      }
                    }}
                    className="mt-3 w-full"
                  >
                    {question === demoQuestions.length - 1
                      ? text("Xem kết quả", "See results")
                      : text("Câu tiếp theo", "Next question")}
                    <ArrowRight />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
