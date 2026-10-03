import type { ExamPartConfig } from "./import-parts-config";

export function buildImportTemplate(
  part: ExamPartConfig,
  blank = false,
  locale = "vi",
) {
  const en = locale === "en";
  const numbers = [1, 7, 32, 71, 101, 131, 147];
  const start = numbers[part.id - 1] || 1;
  const count = part.id === 6 ? 4 : part.hasPassage ? 3 : 2;
  const text = (vi: string, english: string) => (en ? english : vi);
  const lines: string[] = [];
  if (part.hasPassage) {
    lines.push("[EXERCISE 1]", "[PASSAGE]");
    if (part.hasAudio)
      lines.push(
        "Audio: https://example.com/listening.mp3",
        `Content: ${blank ? text("[Nhập transcript bài nghe]", "[Enter the listening transcript]") : part.id === 4 ? "Good morning, everyone. The meeting has moved to Friday at 10 A.M. in room 204. Please bring your report. Thank you." : "W: The meeting has moved to Friday at 10 A.M. in room 204. Please bring your report.\nM: Thanks. I will notify the team."}`,
      );
    else
      lines.push(
        `Content: ${blank ? text("[Nhập nội dung bài đọc; nếu dùng ảnh, thay dòng Content bằng Image: https://...]", "[Enter passage text; for an image replace Content with Image: https://...]") : part.id === 6 ? "The annual meeting will take place on Friday. Please [1] ______ your report. The event will [2] ______ at 10 A.M. in room 204. [3] ______. Contact the organizer [4] ______ you have questions." : "To: All staff\nSubject: Annual meeting\nThe annual meeting will take place on Friday at 10 A.M. in room 204. All staff should bring their reports. Contact the organizer if you have questions."}`,
      );
    lines.push("");
  }
  for (let i = 0; i < count; i++) {
    const readingQuestions = [
      "When will the meeting take place?",
      "Where will the meeting take place?",
      "What should the staff bring?",
    ];
    lines.push(
      `${start + i}. ${blank ? text("[Nhập nội dung câu hỏi]", "[Enter question content]") : part.id === 6 ? `[${i + 1}] ______` : part.id === 5 ? "The meeting will ______ on Friday." : part.id === 1 ? "Look at the picture and choose the correct description." : part.hasPassage ? readingQuestions[i] : "When will the meeting take place?"}`,
    );
    if (!part.hasPassage && part.hasAudio)
      lines.push("Audio: https://example.com/question.mp3");
    if (!part.hasPassage && part.hasImage)
      lines.push("Image: https://example.com/question.jpg");
    const values =
      part.id === 1
        ? [
            "A man is opening a door.",
            "A man is painting a wall.",
            "A man is washing a window.",
            "A man is carrying a chair.",
          ]
        : part.id === 2
          ? ["On Friday.", "In room 204.", "Ms. Chen will lead it."]
          : part.id === 5
            ? ["take place", "taking place", "taken place", "takes place"]
            : part.id === 6
              ? [
                  ["bring", "brings", "bringing", "brought"],
                  ["begin", "begins", "began", "begun"],
                  [
                    "We look forward to seeing you.",
                    "It was cancelled yesterday.",
                    "No staff work here.",
                    "The building has closed.",
                  ],
                  ["if", "unless", "although", "until"],
                ][i]!
              : [
                  ["On Friday", "On Monday", "On Wednesday", "On Sunday"],
                  [
                    "In room 204",
                    "In the cafeteria",
                    "At the town hall",
                    "At the airport",
                  ],
                  [
                    "Their reports",
                    "Their lunch",
                    "A new computer",
                    "An identity card",
                  ],
                ][i]!;
    ["A", "B", "C", "D"]
      .slice(0, part.optionsCount)
      .forEach((key, index) =>
        lines.push(
          `${key}. ${blank ? text(`[Nhập lựa chọn ${key}]`, `[Enter option ${key}]`) : values[index]}`,
        ),
      );
    lines.push(
      `Answer: ${blank ? `[${["A", "B", "C", "D"].slice(0, part.optionsCount).join("/")}]` : "A"}`,
    );
    lines.push(
      `Explanation: ${blank ? "" : part.id === 1 ? "The audio describes the man opening a door." : part.id === 5 || part.id === 6 ? "This choice fits the grammar and meaning of the sentence." : part.hasPassage ? ["The meeting is scheduled for Friday.", "The meeting will take place in room 204.", "The staff should bring their reports."][i] : "The response directly answers the question about time."}`,
      "",
    );
  }
  return lines.join("\n");
}
