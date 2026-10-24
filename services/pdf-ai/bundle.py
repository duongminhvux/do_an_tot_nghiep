"""Import one TOEIC test from four ETS PDFs; answer keys are read spatially, not guessed."""
import os
import re
from pathlib import Path

import pymupdf
from pipeline import analyze_pages, read_pdf, source_numbers


def extract_answer_key(data: bytes, test_number: int, section: str) -> dict:
    if not 1 <= test_number <= 10:
        raise ValueError("Chọn Test từ 1 đến 10.")
    expected = set(range(1, 101) if section == "LC" else range(101, 201))
    result, references = {}, []
    with pymupdf.open(stream=data, filetype="pdf") as doc:
        if doc.needs_pass or len(doc) > 150:
            raise ValueError(f"PDF đáp án {section} có mật khẩu hoặc quá nhiều trang.")
        for page_index, page in enumerate(doc):
            words = page.get_text("words")
            headers = []
            for word in words:
                if word[4].upper() != "TEST":
                    continue
                following = [w for w in words if w[4].isdigit() and word[2] <= w[0] <= word[2] + 45 and abs(w[1] - word[1]) < 8]
                if following:
                    following.sort(key=lambda w: w[0])
                    headers.append((int(following[0][4]), word))
            for number, header in headers:
                if number != test_number:
                    continue
                left_column = header[0] < page.rect.width / 2
                x0, x1 = (0, page.rect.width / 2) if left_column else (page.rect.width / 2, page.rect.width)
                below = [w[1] for _, w in headers if w[1] > header[3] + 5 and (w[0] < page.rect.width / 2) == left_column]
                bottom = min(below) - 4 if below else page.rect.height
                text = page.get_text("text", clip=pymupdf.Rect(x0, header[3], x1, bottom), sort=True)
                matches = [(int(m[1]), m[2]) for m in re.finditer(r"\b(\d{1,3})\s*\(\s*([A-D])\s*\)", text)]
                if not matches:
                    continue  # Table of contents has TEST headings but no answer rows.
                for q, answer in matches:
                    if q not in expected:
                        continue
                    if q in result and result[q] != answer:
                        raise ValueError(f"Đáp án {section}, Test {test_number}, câu {q} bị mâu thuẫn.")
                    result[q] = answer
                references.append(page_index + 1)
    missing = sorted(expected - result.keys())
    if missing:
        raise ValueError(f"PDF đáp án {section}: không tìm đủ 100 đáp án cho Test {test_number}. Thiếu: {', '.join(map(str, missing[:15]))}. Kiểm tra đúng file và số Test.")
    return {"answers": result, "pages": sorted(set(references)), "testNumber": test_number, "section": section}


def part_for(number):
    for maximum, part in ((6, 1), (31, 2), (70, 3), (100, 4), (130, 5), (146, 6), (200, 7)):
        if number <= maximum:
            return part
    raise ValueError("Số câu TOEIC không hợp lệ.")


def merge_section(result: dict, key: dict, pages: list[dict], section: str) -> dict:
    allowed = range(1, 5) if section == "LC" else range(5, 8)
    if any(p['part'] not in allowed for p in result['parts']):
        raise ValueError(f"AI nhận diện Part không khớp file {section}. Hãy kiểm tra file đề đã tải.")
    if section == 'LC':
        # No transcript exists in these source files. Never retain a model-invented
        # dialogue, or turn unprinted Parts 1/2 into guessed question text.
        printed = [q for p in result['parts'] for q in p['questions'] if 32 <= q['order'] <= 100]
        grouped = {}
        for q in printed:
            part = part_for(q['order'])
            grouped.setdefault(part, {'part': part, 'groups': [], 'passages': [], 'questions': []})['questions'].append(q)
        result['parts'] = list(grouped.values())
    parts = {p["part"]: p for p in result["parts"]}
    if any(p not in allowed for p in parts):
        raise ValueError(f"AI nhận diện Part không khớp file {section}. Hãy kiểm tra file đề đã tải.")
    conflicts = set()
    for entry in parts.values():
        unique = {}
        for q in entry['questions']:
            previous = unique.get(q['order'])
            if previous:
                signature = lambda item: (" ".join(item.get('content','').split()), sorted((o['key'], " ".join(o['text'].split())) for o in item.get('options', [])))
                if signature(previous) != signature(q):
                    conflicts.add(q['order'])
                score = lambda item: (sum(bool(o.get('text','').strip()) for o in item.get('options', [])), len(item.get('content','')))
                chosen = q if score(q) > score(previous) else previous
                chosen['sourcePages'] = sorted(set(previous.get('sourcePages',[]) + q.get('sourcePages',[])))
                unique[q['order']] = chosen
            else:
                unique[q['order']] = q
        entry['questions'] = list(unique.values())
    if conflicts:
        result['warnings'].append(f"{section}: câu nhận diện khác nhau giữa các lượt đọc, cần đối chiếu PDF: " + ', '.join(map(str, sorted(conflicts))))
    photos = {int(n): url for page in pages for n, url in page.get("photos", {}).items()} if section == "LC" else {}
    detected = set()
    for part in parts.values():
        for q in part["questions"]:
            if q["order"] not in key["answers"]:
                raise ValueError(f"File {section}: câu {q['order']} không nằm trong phạm vi đáp án của phần này.")
            detected.add(q["order"])
            q["correctAnswer"] = key["answers"][q["order"]]
            q["answerEvidence"] = f"ETS · Test {key['testNumber']} · {section} · trang {', '.join(map(str, key['pages']))} · {q['order']} ({q['correctAnswer']})"
            if q["order"] in photos:
                q["imageUrl"] = photos[q["order"]]
    missing = sorted(key["answers"].keys() - detected)
    for number in missing:
        part = part_for(number)
        entry = parts.setdefault(part, {"part": part, "groups": [], "passages": [], "questions": []})
        entry["questions"].append({"order": number, "content": "", "options": [{"key": letter, "text": ""} for letter in ("ABC" if part == 2 else "ABCD")], "correctAnswer": key["answers"][number], "imageUrl": photos.get(number, ""), "answerEvidence": f"ETS · Test {key['testNumber']} · {section} · {number} ({key['answers'][number]})", "needsSource": True})
    for entry in parts.values():
        entry["questions"].sort(key=lambda q: q["order"])
    if section == 'LC':
        for part, start, stop in ((3, 32, 71), (4, 71, 101)):
            entry = parts[part]
            entry['groups'] = []
            for first in range(start, stop, 3):
                gid = f'lc-part-{part}-{first}'
                pid = gid + '-transcript'
                passage = {'id': pid, 'tempId': pid, 'type': 'TEXT', 'content': '', 'order': 1}
                entry['groups'].append({'id': gid, 'tempId': gid, 'title': f'Questions {first}–{first+2}', 'order': len(entry['groups'])+1, 'passages': [passage]})
                for q in entry['questions']:
                    if first <= q['order'] <= first+2:
                        q['passageGroupTempId'] = gid
                        q.pop('passageTempId', None)
            entry['passages'] = [p for g in entry['groups'] for p in g['passages']]
    result["parts"] = [parts[p] for p in sorted(parts)]
    result["total"] = sum(len(p["questions"]) for p in parts.values())
    return {"section": section, "detected": len(detected), "expected": 100, "missing": missing,
            "answers": len(key["answers"]), "answerPages": key["pages"], "pages": len(pages),
            "ocrPages": sum(bool(p.get("ocr")) for p in pages), "photos": len(photos), "conflicts": sorted(conflicts)}


def analyze_bundle(files: dict[str, bytes], test_number: int, job_id: str, progress) -> dict:
    progress(0, 100, f"Đang tách đúng bảng đáp án Test {test_number}")
    lc_key = extract_answer_key(files["lc_answers"], test_number, "LC")
    rc_key = extract_answer_key(files["rc_answers"], test_number, "RC")
    base = Path(os.getenv("PDF_AI_ASSET_DIR", "/app/assets")) / job_id
    public = os.getenv("PDF_AI_PUBLIC_BASE_URL", "http://localhost:5000/media/pdf-ai").rstrip('/') + '/' + job_id
    lc_pages = read_pdf(files["lc"], "Listening", ocr=True, progress=lambda n, t, m: progress(1 + int(14 * n / t), 100, m), asset_dir=base / "lc", asset_url=public + "/lc")
    rc_pages = read_pdf(files["rc"], "Reading", ocr=True, progress=lambda n, t, m: progress(16 + int(29 * n / t), 100, m), asset_dir=base / "rc", asset_url=public + "/rc")
    # OCR results and page previews survive a failed inference attempt for inspection.
    import json
    (base / "ocr.json").write_text(json.dumps({"lc": lc_pages, "rc": rc_pages}, ensure_ascii=False), encoding="utf8")
    script = None
    if files.get('lc_script'):
        from listening_script import read_listening_script
        script = read_listening_script(files['lc_script'], test_number,
            progress=lambda n,t,m: progress(45 + int(5*n/max(t,1)),100,m),
            asset_dir=base / 'lc-script', asset_url=public + '/lc-script')
        (base / 'script.json').write_text(json.dumps(script,ensure_ascii=False),encoding='utf8')
    # Parts 1/2 often have no printed question text; printed pictures and answer keys are retained separately.
    results, summaries = [], []
    for section, pages, key, offset in (("LC", lc_pages, lc_key, 46), ("RC", rc_pages, rc_key, 71)):
        target_range = set(range(32, 101) if section == 'LC' else range(101, 201))
        first = next((i for i, p in enumerate(pages) if source_numbers(p["text"]) & target_range), None)
        if first is None:
            opening = '\n'.join(p['text'] for p in pages[:3]).upper()
            if section == 'LC' and 'READING TEST' in opening:
                raise ValueError('File trong ô Listening (LC) là đề Reading (RC). Hãy chọn lại đúng file LC; đây không phải lỗi chất lượng PDF.')
            if section == 'RC' and 'LISTENING TEST' in opening:
                raise ValueError('File trong ô Reading (RC) là đề Listening (LC). Hãy chọn lại đúng file RC; đây không phải lỗi chất lượng PDF.')
            raise ValueError(f"OCR file {section} chưa nhận diện được số câu. Kiểm tra chất lượng PDF.")
        content_pages = pages[first:]
        if script:
            offset = 51 if section == 'LC' else 75
        if section == 'LC' and script and set(range(32,101)) <= script['questions'].keys():
            result = {'parts': [], 'warnings': [], 'model': os.getenv('OLLAMA_MODEL','qwen2.5:7b')}
        else:
            result = analyze_pages(content_pages, [], lambda n, t, m: progress(offset + int(23 * n / max(t, 1)), 100, f"{section}: {m}"), collect_groups=section != 'LC', standard_toeic=True, checkpoint=base / f'{section.lower()}-batches.json', question_range=(32,100) if section == 'LC' else (101,200))
        summary = merge_section(result, key, pages, section)
        if section == 'LC' and script:
            from listening_script import merge_listening_script
            merge_listening_script(result, script)
            summary['missing'] = [q['order'] for p in result['parts'] for q in p['questions'] if q.get('needsSource')]
            summary['detected'] = 100 - len(summary['missing'])
        summaries.append(summary)
        if section == 'RC':
            from reading_images import apply_reading_images
            apply_reading_images(result, pages)
        else:
            from listening_images import attach_listening_graphics
            attach_listening_graphics(result, pages)
        results.append(result)
    parts = sorted([p for r in results for p in r["parts"]], key=lambda p: p["part"])
    warnings = list(dict.fromkeys(w for r in results for w in r["warnings"] if not w.startswith("Đây là bản nhận diện AI:")))
    warnings.insert(0, "Part 6–7 dùng ảnh cắt từ PDF cho bài đọc/email chung; từng câu hỏi và các lựa chọn bên dưới vẫn là chữ để chỉnh sửa. Hãy đối chiếu câu hỏi và lựa chọn với PDF nguồn trước khi lưu; 200 đáp án được lấy từ đúng bảng Test đã chọn.")
    warnings.insert(0, "Đã nhập script Listening tiếng Anh từ PDF. Kiểm tra câu hỏi, lựa chọn và lời thoại trước khi lưu. PDF script không tự tạo audio; có thể dùng nội dung này để tạo TTS hoặc bổ sung audio sau." if script else "Bốn PDF không chứa audio hoặc transcript Listening. Part 1–2 có thể chỉ có ảnh/phiếu chọn; các trường còn thiếu được đánh dấu để bổ sung, không tự tạo lời thoại.")
    from media_assets import publish_pdf_images
    publish_pdf_images(job_id)
    progress(100, 100, "Đã ghép đề Listening + Reading và 200 đáp án")
    return {"parts": parts, "warnings": warnings, "total": sum(len(p["questions"]) for p in parts),
            "pages": len(lc_pages) + len(rc_pages) + (len(script['pages']) if script else 0), "model": results[0]["model"], "testNumber": test_number,
            "listeningScript": {'questions': len(script['questions']), 'missingQuestions': sorted(set(range(1, 101)) - script['questions'].keys()), 'transcripts': len(script['groups']), 'pages': len(script['pages']), 'ocrPages': sum(p['ocr'] for p in script['pages'])} if script else None,
            "sections": summaries, "sourcePages": [{"section": role, "page": p["number"], "imageUrl": p["imageUrl"]} for role, pages in (("LC", lc_pages), ("RC", rc_pages), ("SCRIPT", script['pages'] if script else [])) for p in pages]}
