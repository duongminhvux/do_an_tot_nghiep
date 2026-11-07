"""Build the editable report from the adjacent Markdown file.

Requires python-docx. From the repository root, with the task-local dependencies:
    python docs/bao-cao/tao_ban_word.py --deps .tmp/report-deps
"""

from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import sys
from zipfile import ZipFile
from xml.etree import ElementTree as ET


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--deps", type=Path, help="Optional directory containing python-docx")
    args = parser.parse_args()
    if args.deps:
        sys.path.insert(0, str(args.deps.resolve()))

    from docx import Document
    from docx.enum.section import WD_SECTION_START
    from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Cm, Pt, RGBColor
    from docx.opc.constants import RELATIONSHIP_TYPE

    root = Path(__file__).resolve().parent
    source = root / "BAO_CAO_TOT_NGHIEP_VOCALEARN.md"
    output = source.with_suffix(".docx")
    content = source.read_text(encoding="utf-8")
    doc = Document()
    doc.core_properties.title = "Báo cáo đồ án tốt nghiệp — VocaLearn"
    doc.core_properties.subject = "Theo khung báo cáo Version 3; thông tin bìa để trống"
    doc.core_properties.author = ""
    doc.core_properties.last_modified_by = ""
    doc.core_properties.keywords = "VocaLearn, PostgreSQL, Dictation, TOEIC, Arena"

    for name in ["Normal", "Title", "Subtitle", "Heading 1", "Heading 2", "Heading 3", "List Bullet", "List Number"]:
        style = doc.styles[name]
        style.font.name = "Times New Roman"
        style.font.color.rgb = RGBColor(0, 0, 0)
        style.element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), "Times New Roman")
        lang = OxmlElement("w:lang")
        lang.set(qn("w:val"), "vi-VN")
        style.element.get_or_add_rPr().append(lang)

    normal = doc.styles["Normal"]
    normal.font.size = Pt(13)
    normal.paragraph_format.line_spacing = 1.5
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.first_line_indent = Cm(0.8)
    normal.paragraph_format.widow_control = True
    for level, size in [(1, 16), (2, 14), (3, 13)]:
        style = doc.styles[f"Heading {level}"]
        style.font.size = Pt(size)
        style.font.bold = True
        style.paragraph_format.first_line_indent = Cm(0)
        style.paragraph_format.space_before = Pt(12)
        style.paragraph_format.space_after = Pt(8)
        style.paragraph_format.keep_with_next = True
    for name in ["List Bullet", "List Number"]:
        doc.styles[name].font.size = Pt(13)
        doc.styles[name].paragraph_format.first_line_indent = Cm(0)

    def element(tag: str, **attrs):
        item = OxmlElement(f"w:{tag}")
        for key, value in attrs.items():
            item.set(qn(f"w:{key}"), str(value))
        return item

    def field(paragraph, instruction: str, placeholder: str = ""):
        begin = paragraph.add_run()
        begin._r.append(element("fldChar", fldCharType="begin", dirty="true"))
        code = OxmlElement("w:instrText")
        code.set(qn("xml:space"), "preserve")
        code.text = f" {instruction} "
        paragraph.add_run()._r.append(code)
        paragraph.add_run()._r.append(element("fldChar", fldCharType="separate"))
        paragraph.add_run(placeholder)
        paragraph.add_run()._r.append(element("fldChar", fldCharType="end"))

    def setup_section(section, number_format: str, first: bool):
        section.page_width, section.page_height = Cm(21), Cm(29.7)
        section.left_margin, section.right_margin = Cm(3.5), Cm(2)
        section.top_margin, section.bottom_margin = Cm(2.5), Cm(2.5)
        section.header_distance, section.footer_distance = Cm(1.2), Cm(1.2)
        section.different_first_page_header_footer = first
        section.header.is_linked_to_previous = False
        section.footer.is_linked_to_previous = False
        header = section.header.paragraphs[0]
        header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        header.paragraph_format.first_line_indent = Cm(0)
        run = header.add_run("VocaLearn | Báo cáo đồ án tốt nghiệp")
        run.font.size = Pt(10)
        run.italic = True
        footer = section.footer.paragraphs[0]
        footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
        footer.paragraph_format.first_line_indent = Cm(0)
        field(footer, "PAGE", "")
        page_number_type = section._sectPr.find(qn("w:pgNumType"))
        if page_number_type is None:
            page_number_type = element("pgNumType")
            section._sectPr.append(page_number_type)
        page_number_type.set(qn("w:fmt"), number_format)
        page_number_type.set(qn("w:start"), "1")

    setup_section(doc.sections[0], "lowerRoman", True)
    doc.settings.element.append(element("updateFields", val="true"))

    def inline(paragraph, text: str, table_text: bool = False):
        pattern = r"(\*\*[^*]+\*\*|`[^`]+`|https?://[^\s]+)"
        for token in re.split(pattern, text):
            if not token:
                continue
            if re.fullmatch(r"https?://[^\s]+", token):
                url = token.rstrip(".,;。")
                trailing = token[len(url):]
                hyperlink = OxmlElement("w:hyperlink")
                hyperlink.set(qn("r:id"), paragraph.part.relate_to(url, RELATIONSHIP_TYPE.HYPERLINK, is_external=True))
                run = OxmlElement("w:r")
                props = OxmlElement("w:rPr")
                props.append(element("color", val="0563C1"))
                props.append(element("u", val="single"))
                run.append(props)
                value = OxmlElement("w:t")
                value.text = url
                run.append(value)
                hyperlink.append(run)
                paragraph._p.append(hyperlink)
                if trailing:
                    paragraph.add_run(trailing)
                continue
            bold = token.startswith("**") and token.endswith("**")
            code = token.startswith("`") and token.endswith("`")
            value = token[2:-2] if bold else token[1:-1] if code else token
            if table_text:
                value = value.replace("/", "/\u200b")
            run = paragraph.add_run(value)
            run.bold = bold

    def add_table(rows: list[list[str]]):
        cols = len(rows[0])
        table = doc.add_table(rows=1, cols=cols)
        table.style = "Table Grid"
        table.autofit = False
        widths = {
            2: [4.0, 11.5],
            3: [3.0, 5.8, 6.7],
            4: [2.8, 3.6, 4.3, 4.8],
            5: [4.7, 1.1, 1.1, 4.2, 4.4],
        }.get(cols, [15.5 / cols] * cols)
        for column, width in zip(table.columns, widths):
            column.width = Cm(width)
        for index, row_data in enumerate(rows):
            row = table.rows[0] if index == 0 else table.add_row()
            row._tr.get_or_add_trPr().append(element("cantSplit"))
            if index == 0:
                row._tr.get_or_add_trPr().append(element("tblHeader", val="true"))
            for col, cell in enumerate(row.cells):
                cell.width = Cm(widths[col])
                cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.TOP
                paragraph = cell.paragraphs[0]
                paragraph.paragraph_format.first_line_indent = Cm(0)
                paragraph.paragraph_format.line_spacing = 1.05
                paragraph.paragraph_format.space_after = Pt(4)
                paragraph.paragraph_format.space_before = Pt(4)
                inline(paragraph, row_data[col], table_text=True)
                for run in paragraph.runs:
                    run.font.size = Pt(10.5)
                    if index == 0:
                        run.bold = True
                if index == 0:
                    cell._tc.get_or_add_tcPr().append(element("shd", fill="E8EDF3"))
        doc.add_paragraph().paragraph_format.space_after = Pt(0)

    def add_note(text: str):
        paragraph = doc.add_paragraph()
        paragraph.paragraph_format.first_line_indent = Cm(0)
        paragraph.paragraph_format.left_indent = Cm(0.35)
        paragraph.paragraph_format.right_indent = Cm(0.15)
        paragraph.paragraph_format.line_spacing = 1.15
        paragraph.paragraph_format.space_before = Pt(8)
        paragraph.paragraph_format.space_after = Pt(10)
        paragraph._p.get_or_add_pPr().append(element("shd", fill="FFF2CC"))
        inline(paragraph, text)
        for run in paragraph.runs:
            run.font.size = Pt(11)
            run.italic = True

    lines = content.splitlines()
    index = 0
    cover = True
    toc = False
    main_section_added = False
    table_count = 0
    code_count = 0
    while index < len(lines):
        line = lines[index].strip()
        index += 1
        if not line or line.startswith("<!--"):
            continue
        if line.startswith("# "):
            title = line[2:]
            if title == "ĐẶT VẤN ĐỀ" and not main_section_added:
                setup_section(doc.add_section(WD_SECTION_START.NEW_PAGE), "decimal", False)
                main_section_added = True
            if title == "BÁO CÁO ĐỒ ÁN TỐT NGHIỆP":
                paragraph = doc.add_paragraph()
                paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
                paragraph.paragraph_format.first_line_indent = Cm(0)
                paragraph.paragraph_format.space_before = Pt(80)
                paragraph.paragraph_format.space_after = Pt(40)
                run = paragraph.add_run(title)
                run.bold = True
                run.font.size = Pt(21)
                continue
            cover = False
            toc = title == "MỤC LỤC"
            if toc:
                paragraph = doc.add_paragraph(style="Title")
                paragraph.add_run(title).bold = True
                paragraph.paragraph_format.page_break_before = True
                paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
                paragraph.paragraph_format.first_line_indent = Cm(0)
                field(doc.add_paragraph(), 'TOC \\o "1-3" \\h \\z \\u', "Mở bằng Word và cập nhật mục lục: Ctrl+A → F9.")
                continue
            paragraph = doc.add_paragraph(title, style="Heading 1")
            paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
            paragraph.paragraph_format.page_break_before = title != "ĐẶT VẤN ĐỀ"
            continue
        if toc:
            continue
        if line.startswith("### ") or line.startswith("## "):
            level = 3 if line.startswith("### ") else 2
            doc.add_paragraph(line[level + 1:], style=f"Heading {level}")
            continue
        if line.startswith("```"):
            code_count += 1
            while index < len(lines) and not lines[index].startswith("```"):
                paragraph = doc.add_paragraph()
                paragraph.paragraph_format.first_line_indent = Cm(0)
                paragraph.paragraph_format.line_spacing = 1
                paragraph.paragraph_format.space_after = Pt(2)
                paragraph._p.get_or_add_pPr().append(element("shd", fill="F2F2F2"))
                run = paragraph.add_run(lines[index])
                run.font.name = "Consolas"
                run.font.size = Pt(9)
                index += 1
            index += 1
            continue
        if line.startswith("|"):
            rows = [[part.strip() for part in line.strip("|").split("|")]]
            while index < len(lines) and lines[index].strip().startswith("|"):
                row = [part.strip() for part in lines[index].strip().strip("|").split("|")]
                index += 1
                if not all(re.fullmatch(r":?-{3,}:?", part) for part in row):
                    rows.append(row)
            if len({len(row) for row in rows}) != 1:
                raise ValueError("Inconsistent Markdown table widths")
            add_table(rows)
            table_count += 1
            continue
        if line.startswith("> "):
            add_note(line[2:])
            continue
        paragraph = doc.add_paragraph()
        inline(paragraph, line)
        if cover:
            paragraph.paragraph_format.first_line_indent = Cm(0)
            paragraph.paragraph_format.space_after = Pt(14)
        elif line.startswith("Bảng "):
            paragraph.paragraph_format.first_line_indent = Cm(0)
            paragraph.paragraph_format.keep_with_next = True
            paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in paragraph.runs:
                run.bold = True
                run.font.size = Pt(12)
        elif line.startswith("[") and re.match(r"\[\d+\]", line):
            paragraph.paragraph_format.first_line_indent = Cm(-0.7)
            paragraph.paragraph_format.left_indent = Cm(0.7)
            paragraph.paragraph_format.line_spacing = 1.15
        else:
            paragraph.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

    doc.save(output)
    with ZipFile(output) as package:
        corrupt = package.testzip()
        if corrupt:
            raise ValueError(f"Invalid DOCX member: {corrupt}")
        namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        document_xml = ET.fromstring(package.read("word/document.xml"))
        text = "".join(node.text or "" for node in document_xml.findall(".//w:t", namespace))
        word_tables = len(document_xml.findall(".//w:tbl", namespace))
        fields = [node.text or "" for node in document_xml.findall(".//w:instrText", namespace)]
        sections = document_xml.findall(".//w:sectPr", namespace)
    diagram_ids = re.findall(r"> \[CẦN VẼ — Hình ([\d.]+)\]", content)
    photo_ids = re.findall(r"> \[CẦN CHỤP — Hình ([B.\d]+)\]", content)
    figure_list = content.split("# DANH MỤC CÁC HÌNH VẼ\n", 1)[1].split("<!-- PAGEBREAK -->", 1)[0]
    declared_figures = re.findall(r"^\| ([\dB]+\.\d+) \|", figure_list, flags=re.M)
    captions = re.findall(r"^Bảng ([\dAC]+\.\d+)\.", content, flags=re.M)
    table_list = content.split("# DANH MỤC CÁC BẢNG\n", 1)[1].split("<!-- PAGEBREAK -->", 1)[0]
    declared_tables = re.findall(r"^\| ([\dAC]+\.\d+) \|", table_list, flags=re.M)
    checks = {
        "docx_zip_valid": corrupt is None,
        "docx_reopens": len(Document(output).tables) == table_count,
        "all_diagram_notes_preserved": all(f"[CẦN VẼ — Hình {x}]" in text for x in diagram_ids),
        "all_photo_notes_preserved": all(f"[CẦN CHỤP — Hình {x}]" in text for x in photo_ids),
        "unique_figure_note_ids": all(n == 1 for n in Counter(diagram_ids + photo_ids).values()),
        "figure_list_matches_notes": set(declared_figures) == set(diagram_ids + photo_ids),
        "table_list_matches_captions": set(captions) == set(declared_tables),
        "markdown_tables_preserved": word_tables == table_count,
        "toc_field_present": any("TOC" in value for value in fields),
        "front_and_main_sections": len(sections) == 2,
        "page_number_formats": [section.find("w:pgNumType", namespace).get(qn("w:fmt")) for section in sections] == ["lowerRoman", "decimal"],
        "single_page_number_type_per_section": all(len(section.findall("w:pgNumType", namespace)) == 1 for section in sections),
        "unicode_preserved": "LỜI CẢM ƠN" in text and "Ôn từ đến hạn" in text and "\ufffd" not in text,
        "three_chapters": len(re.findall(r"^# CHƯƠNG \d\.", content, flags=re.M)) == 3,
        "cover_blank": bool(re.search(r"Tên đề tài: \.{10,}", content)),
        "bibliography_entries": len(re.findall(r"^\[\d+\] ", content, flags=re.M)) == 15,
    }
    audit = {
        "compiledOn": "2026-11-07",
        "source": source.name,
        "output": output.name,
        "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "docxSha256": hashlib.sha256(output.read_bytes()).hexdigest(),
        "sourceWhitespaceTokensVietnamese": len(content.split()),
        "sourceCharacters": len(content),
        "diagramNotes": len(diagram_ids),
        "screenshotNotes": len(photo_ids),
        "namedTableCaptions": len(captions),
        "wordTablesIncludingLists": word_tables,
        "codeBlocks": code_count,
        "checks": checks,
        "allChecksPassed": all(checks.values()),
        "limitations": [
            "DOCX structural validation; no Word/LibreOffice layout rendering performed.",
            "TOC fields and final pagination need updating in Word after adding figures.",
            "Application tests quoted from repository evidence were not rerun for report writing.",
        ],
    }
    (root / "KIEM_TRA_BAO_CAO.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(audit, ensure_ascii=True, indent=2))
    if not all(checks.values()):
        raise SystemExit("Report validation failed")


if __name__ == "__main__":
    main()
