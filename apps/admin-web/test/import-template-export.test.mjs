import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import ts from "typescript";
import { OfficeParser } from "../../api/node_modules/officeparser/dist/index.mjs";

const source = await readFile(
  new URL(
    "../components/assessment/import-template-export.ts",
    import.meta.url,
  ),
  "utf8",
);
let { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
});
outputText = outputText.replace(
  /import\(["'](docx|pdfmake\/build\/pdfmake|pdfmake\/build\/vfs_fonts)["']\)/g,
  (_, name) =>
    `import(${JSON.stringify(import.meta.resolve(name === "docx" ? name : name + ".js"))})`,
);
const { createTemplateBlob } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
const text =
  "[EXERCISE 1] - Bài đọc tiếng Việt\n[PASSAGE]\nContent: Thông báo cuộc họp\nNhân viên vui lòng đến phòng 204 vào thứ Sáu.\n\n147. Cuộc họp diễn ra khi nào?\nA. Thứ Sáu\nB. Thứ Hai\nC. Thứ Tư\nD. Chủ nhật\nAnswer: A\nExplanation: Thông báo ghi rõ cuộc họp vào thứ Sáu.";

for (const format of ["pdf", "docx", "txt"]) {
  test(`template ${format} is a real file and preserves Vietnamese and import syntax`, async () => {
    const blob = await createTemplateBlob(text, format);
    const buffer = Buffer.from(await blob.arrayBuffer());
    if (format === "pdf")
      assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
    if (format === "docx") assert.equal(buffer.subarray(0, 2).toString(), "PK");
    let extracted = buffer.toString("utf8").replace(/^\uFEFF/, "");
    if (format !== "txt") {
      const ast = await OfficeParser.parseOffice(buffer, { fileType: format });
      extracted = (
        await ast.to("text", {
          includeImages: false,
          textConfig: { preserveLayout: false },
        })
      ).value;
    }
    assert.ok(extracted.includes("Cuộc họp diễn ra khi nào?"));
    assert.ok(extracted.includes("Thứ Sáu"));
    assert.ok(extracted.includes("[PASSAGE]"));
    assert.ok(extracted.includes("Answer: A"));
    if (process.env.IMPORT_EXPORT_QA === "1") {
      const output = new URL("../../../tmp/import-export-qa/", import.meta.url);
      await mkdir(output, { recursive: true });
      await writeFile(new URL(`template.${format}`, output), buffer);
    }
  });
}
