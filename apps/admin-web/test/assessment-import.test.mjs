import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import {
  parseImportText,
  serializeImportDraft,
  validateImportDraft,
} from "../../../packages/shared-types/src/assessment-import.mjs";

const source = await readFile(
  new URL("../components/assessment/import-template.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
});
const { buildImportTemplate } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
const config = (id) => ({
  id,
  hasPassage: [3, 4, 6, 7].includes(id),
  hasAudio: id <= 4,
  hasImage: [1, 6, 7].includes(id),
  optionsCount: id === 2 ? 3 : 4,
});

for (const locale of ["vi", "en"])
  for (let id = 1; id <= 7; id++) {
    test(`Part ${id} ${locale} example parses without blocking errors`, () => {
      const text = buildImportTemplate(config(id), false, locale);
      const draft = parseImportText(text, id);
      assert.ok(draft.questions.length >= 2);
      assert.deepEqual(draft.warnings, []);
      assert.deepEqual(
        validateImportDraft(draft, id, locale).filter(
          (i) => i.severity === "error",
        ),
        [],
      );
    });
    test(`Part ${id} ${locale} blank template cannot be saved unchanged`, () => {
      const draft = parseImportText(
        buildImportTemplate(config(id), true, locale),
        id,
      );
      assert.ok(
        validateImportDraft(draft, id, locale).some(
          (i) => i.severity === "error",
        ),
      );
    });
  }

const question =
  "101. What day?\nA. Friday\nB. Monday\nC. Sunday\nD. Tuesday\nAnswer: A";
test("missing answer and incomplete question remain visible, with no guessed answer", () => {
  const draft = parseImportText(
    "101. Missing answer\nA. One\nB. Two\n102. Missing options",
    5,
  );
  assert.equal(draft.questions.length, 2);
  assert.equal(draft.questions[0].correctAnswer, "");
  assert.equal(draft.questions[1].options.length, 0);
  assert.ok(
    validateImportDraft(draft, 5).filter((i) => i.severity === "error")
      .length >= 4,
  );
});
test("numbered exercise markers group double/triple passages and preserve custom titles", () => {
  const draft = parseImportText(
    `[BÀI TẬP 1] - Meeting\n[EMAIL]\nContent: Friday\n[NOTICE]\nContent: Meeting room\n${question}\n[EXERCISE 2]\nPassage:\nImage: https://example.com/test.jpg\n${question.replace("101.", "102.")}`,
    7,
  );
  assert.equal(draft.groups.length, 2);
  assert.equal(draft.groups[0].passages.length, 2);
  assert.equal(draft.groups[0].title, "Meeting");
  assert.equal(draft.questions[0].passageGroupTempId, draft.groups[0].id);
  assert.equal(draft.questions[1].passageGroupTempId, draft.groups[1].id);
});
test("BOM, CRLF, comments, blank paragraphs and multiline options are supported", () => {
  const draft = parseImportText(
    "\uFEFF# guide\r\n[PASSAGE]\r\nContent: First paragraph\r\n\r\nSecond paragraph\r\n" +
      question
        .replace(/\n/g, "\r\n")
        .replace("A. Friday", "A. Friday\r\n  afternoon"),
    7,
  );
  assert.equal(
    draft.groups[0].passages[0].content,
    "First paragraph\n\nSecond paragraph",
  );
  assert.equal(draft.questions[0].options[0].text, "Friday\nafternoon");
  assert.equal(draft.questions[0].sourceLine, 6);
});
test("duplicate numbering, option keys and invalid answers block import", () => {
  const draft = parseImportText(
    question +
      "\n" +
      question
        .replace("B. Monday", "A. Monday")
        .replace("Answer: A", "Answer: Z"),
    5,
  );
  const errors = validateImportDraft(draft, 5).filter(
    (i) => i.severity === "error",
  );
  assert.ok(errors.some((i) => i.message.includes("trùng số câu")));
  assert.ok(errors.some((i) => i.message.includes("trùng lựa chọn")));
  assert.ok(errors.some((i) => i.message.includes("đáp án đúng")));
});
test("Part 2 rejects option D; dangling passage references and mixed text/image are rejected", () => {
  assert.ok(
    validateImportDraft(parseImportText(question, 2), 2).some(
      (i) => i.severity === "error",
    ),
  );
  const draft = parseImportText(
    "[PASSAGE]\nContent: Test\nImage: https://example.com/test.png\n" +
      question,
    7,
  );
  draft.questions[0].passageTempId = "missing";
  const errors = validateImportDraft(draft, 7).filter(
    (i) => i.severity === "error",
  );
  assert.ok(errors.some((i) => i.message.includes("không dùng cả hai")));
  assert.ok(errors.some((i) => i.message.includes("liên kết đoạn")));
});
test("unrecognized source lines are reported rather than silently lost", () => {
  const draft = parseImportText("Random heading\n" + question, 5);
  assert.equal(draft.warnings[0].line, 1);
});
test("returning to source preserves edited passage, answers, options and explanation", () => {
  const draft = parseImportText(buildImportTemplate(config(7)), 7);
  draft.groups[0].title = "Edited title";
  draft.groups[0].passages[0].content = "Edited passage\n\nSecond paragraph";
  draft.questions[0].correctAnswer = "B";
  draft.questions[0].options[1].text = "Edited option";
  draft.questions[0].explanation = "Edited explanation";
  const reparsed = parseImportText(serializeImportDraft(draft), 7);
  assert.equal(reparsed.groups[0].title, "Edited title");
  assert.equal(
    reparsed.groups[0].passages[0].content,
    draft.groups[0].passages[0].content,
  );
  assert.equal(reparsed.questions[0].correctAnswer, "B");
  assert.equal(reparsed.questions[0].options[1].text, "Edited option");
  assert.equal(reparsed.questions[0].explanation, "Edited explanation");
});
test("option E stays visible and blocks a four-choice question", () => {
  const draft = parseImportText(
    question.replace("Answer: A", "E. Extra choice\nAnswer: A"),
    5,
  );
  assert.equal(draft.questions[0].options.length, 5);
  assert.ok(validateImportDraft(draft, 5).some((i) => i.severity === "error"));
});
