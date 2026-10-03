import type { TDocumentDefinitions } from "pdfmake/interfaces";

export type TemplateFormat = "txt" | "pdf" | "docx";

export async function createTemplateBlob(
  text: string,
  format: TemplateFormat,
): Promise<Blob> {
  if (format === "txt")
    return new Blob(["\uFEFF" + text], { type: "text/plain;charset=utf-8" });

  if (format === "docx") {
    const { Document, Paragraph, TextRun, Packer } = await import("docx");
    const document = new Document({
      creator: "Assessment",
      title: "Question import template",
      styles: {
        default: {
          document: {
            run: { font: "Arial", size: 22 },
            paragraph: { spacing: { after: 0, line: 276 } },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margin: { top: 720, right: 720, bottom: 720, left: 720 },
            },
          },
          children: text.split("\n").map(
            (line) =>
              new Paragraph({
                keepNext: /^\d+[.)]\s|^\[(?:EXERCISE|PASSAGE)/.test(line),
                children: [
                  new TextRun({
                    text: line,
                    bold: /^\[(?:EXERCISE|PASSAGE)/.test(line),
                  }),
                ],
              }),
          ),
        },
      ],
    });
    return Packer.toBlob(document);
  }

  // Load generators and embedded Roboto only when a PDF is requested.
  const [pdfModule, fontModule] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  const pdf = pdfModule.default as unknown as {
    addVirtualFileSystem: (fonts: Record<string, string>) => void;
    createPdf: (definition: TDocumentDefinitions) => {
      getBlob: () => Promise<Blob>;
    };
  };
  pdf.addVirtualFileSystem(fontModule.default);
  return pdf
    .createPdf({
      pageSize: "A4",
      pageMargins: [36, 36, 36, 36],
      defaultStyle: { font: "Roboto", fontSize: 11, lineHeight: 1.25 },
      content: text.split("\n").map((line) => ({
        text: line || " ",
        bold: /^\[(?:EXERCISE|PASSAGE)/.test(line),
        margin: [0, 0, 0, 2] as [number, number, number, number],
      })),
    })
    .getBlob();
}

export function downloadTemplateBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Keep the object URL alive long enough for the browser to start downloading.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
