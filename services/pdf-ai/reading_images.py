"""Crop original Reading material; OCR coordinates locate regions, never redraw text."""
import re
from collections import defaultdict

import pymupdf


def crop_reading_page(page, words, target, public, page_number, previous=()):
    lines = defaultdict(list)
    for word in words:
        lines[tuple(word[5:7])].append(word)
    headers, markers = [], []
    for row in lines.values():
        row.sort(key=lambda w: w[0])
        text = ' '.join(w[4] for w in row)
        match = re.search(r'Questions?\s+(\d{3})\s*[-–—]\s*(\d{3})\s+refer', text, re.I)
        if match:
            first, last = map(int, match.groups())
            if 131 <= first <= last <= 200 and last - first <= 4:
                headers.append((row[0], tuple(range(first, last + 1))))
        match = re.fullmatch(r'(1[3-9]\d|200)[.)]?', row[0][4])
        if match and 131 <= int(match[1]) <= 200:
            # A numbered blank inside prose is not a printed question label.
            if row[0][0] < page.rect.width * .16 or page.rect.width * .46 < row[0][0] < page.rect.width * .66:
                markers.append((int(match[1]), row[0]))
    headers.sort(key=lambda h: (h[0][1], h[0][0]))
    regions, questions = [], {}
    width, height = page.rect.width, page.rect.height

    def save(name, rect):
        rect = rect & page.rect
        if rect.width < 20 or rect.height < 4:
            return None
        filename = f'page-{page_number}-{name}.jpg'
        page.get_pixmap(dpi=180, clip=rect).save(str(target / filename), jpg_quality=90)
        return f'{public}/{filename}'

    # Continue a multi-page exercise until the next explicitly printed header.
    entries = list(headers)
    if previous and (not headers or headers[0][0][1] > height * .15):
        if not markers or any(n in previous for n, _ in markers):
            entries.insert(0, (None, previous))
    for index, (header, numbers) in enumerate(entries):
        if not numbers:
            continue
        top = max(0, header[1] - 4) if header else height * .035
        left, right = width * .035, width * .97
        # Separate exercises printed in two columns must not share an image.
        two_columns = len(headers) > 1 and any(h[0][0] > width * .45 for h in headers)
        if two_columns and header:
            left = width * .5 if header[0] > width * .45 else width * .035
            right = width * .97 if left >= width * .5 else width * .5
        bottom = min((h[0][1] - 5 for h in headers if h[0][1] > top + 10 and left <= h[0][0] < right), default=height * .95)
        group_markers = [w for n, w in markers if n in numbers and left <= w[0] < right and top < w[1] < bottom]
        if group_markers:
            # A left-hand passage with right-hand questions occupies full height.
            if all(w[0] > width * .45 for w in group_markers) and not two_columns:
                right = width * .5
            else:
                bottom = min(w[1] for w in group_markers) - 6
        rect = pymupdf.Rect(left, top, right, bottom)
        if rect.height < height * .06:
            continue  # Question-only continuation pages have no shared material.
        probe = page.get_pixmap(dpi=40, clip=rect, colorspace=pymupdf.csGRAY)
        if sum(v < 180 for v in probe.samples) / max(len(probe.samples), 1) < .003:
            continue
        url = save(f'exercise-{numbers[0]}-{numbers[-1]}', rect)
        if url:
            regions.append({'numbers': list(numbers), 'imageUrl': url, 'page': page_number})
    return {'exercises': regions, 'questions': questions}, headers[-1][1] if headers else previous


def recover_source_groups(part, pages, warnings):
    """Recover omitted links only when the printed header and crop prove membership."""
    source_ranges = {tuple(r['numbers']) for page in pages
                     for r in page.get('readingImages', {}).get('exercises', [])}
    lower, upper = (131, 146) if part['part'] == 6 else (147, 200)
    candidates = {ns for ns in source_ranges if ns and lower <= min(ns) <= max(ns) <= upper
                  and list(ns) == list(range(min(ns), max(ns) + 1))
                  and (len(ns) == 4 and ns[0] in (131, 135, 139, 143) if part['part'] == 6 else 2 <= len(ns) <= 5)}
    groups = part['groups']
    for numbers in sorted(candidates):
        expected = set(numbers)
        if any(expected & set(other) for other in source_ranges if other != numbers):
            continue  # Conflicting OCR headers need manual review.
        questions = [q for q in part['questions'] if q['order'] in expected]
        if len(questions) != len(expected) or {q['order'] for q in questions} != expected:
            continue
        def linked_group(q):
            gid, pid = q.get('passageGroupTempId'), q.get('passageTempId')
            matches = [g for g in groups if
                       (gid and gid in (g.get('id'), g.get('tempId'))) or
                       (pid and any(pid in (p.get('id'), p.get('tempId')) for p in g.get('passages', [])))]
            return matches[0] if len(matches) == 1 else None
        linked = [linked_group(q) for q in questions]
        ids = {g['id'] for g in linked if g}
        if len(ids) > 1:
            continue
        group = next((g for g in groups if g['id'] in ids), None)
        if group and any(q['order'] not in expected and linked_group(q) is group for q in part['questions']):
            continue
        if group and group.get('questionNumbers') and set(group['questionNumbers']) != expected:
            continue
        if all(g is group for g in linked) and group:
            continue
        if group is None:
            gid = f"source-p{part['part']}-q{numbers[0]}-{numbers[-1]}"
            group = {'id': gid, 'tempId': gid, 'title': f'Questions {numbers[0]}–{numbers[-1]}',
                     'order': len(groups) + 1, 'questionNumbers': list(numbers), 'passages': []}
            groups.append(group)
        for q in questions:
            q['passageGroupTempId'] = group['id']
            q.pop('passageTempId', None)
        warnings.append(f"Part {part['part']}: đã khôi phục liên kết câu {numbers[0]}–{numbers[-1]} theo tiêu đề nhóm in trên PDF; giữ nguyên các lựa chọn và đáp án.")
    groups.sort(key=lambda g: min(g.get('questionNumbers') or [q['order'] for q in part['questions'] if q.get('passageGroupTempId') == g['id']] or [upper + 1]))
    for i, group in enumerate(groups):
        group['order'] = i + 1


def recover_part_six_layout(part, pages, warnings):
    """Printed headers/crops override malformed LLM groups only with full proof."""
    expected = [tuple(range(first, first + 4)) for first in (131, 135, 139, 143)]
    ranges = {tuple(crop['numbers']) for page in pages for crop in page.get('readingImages', {}).get('exercises', [])
              if crop.get('imageUrl') and crop.get('numbers') and 131 <= min(crop['numbers']) <= max(crop['numbers']) <= 146}
    questions = part['questions']
    if ranges != set(expected) or len(questions) != 16 or {q['order'] for q in questions} != set(range(131, 147)):
        return False
    if any(len({crop['imageUrl'] for page in pages for crop in page.get('readingImages', {}).get('exercises', [])
                if tuple(crop.get('numbers', [])) == numbers and crop.get('imageUrl')}) != 1 for numbers in expected):
        return False
    groups = part['groups']
    valid = len(groups) == 4 and all(
        any({q['order'] for q in questions if q.get('passageGroupTempId') == g.get('id')} == set(numbers)
            and len(g.get('passages', [])) == 1 for g in groups) for numbers in expected)
    if valid:
        return False
    # All four ranges are independently confirmed by original PDF crops.
    # Keep every question/choice/key; replace only exercise grouping.
    part['groups'] = []
    for index, numbers in enumerate(expected):
        gid = f'source-p6-q{numbers[0]}-{numbers[-1]}'
        part['groups'].append({'id': gid, 'tempId': gid, 'title': f'Questions {numbers[0]}–{numbers[-1]}',
                               'order': index + 1, 'questionNumbers': list(numbers), 'passages': []})
        for question in questions:
            if question['order'] in numbers:
                question['passageGroupTempId'] = gid
                question.pop('passageTempId', None)
    warnings.append('Part 6: đã tách lại 4 bài đọc theo đủ 4 tiêu đề nhóm trên PDF nguồn; giữ nguyên câu hỏi, lựa chọn và đáp án.')
    return True


def apply_reading_images(result, pages):
    """Keep options/key untouched; only replace source material with verified crops."""
    for part in result['parts']:
        if part['part'] not in (6, 7):
            continue
        if part['part'] == 6:
            recover_part_six_layout(part, pages, result['warnings'])
        recover_source_groups(part, pages, result['warnings'])
        for group in part['groups']:
            numbers = {q['order'] for q in part['questions'] if q.get('passageGroupTempId') in (group.get('id'), group.get('tempId'))}
            crops = [r for page in pages for r in page.get('readingImages', {}).get('exercises', []) if set(r['numbers']) == numbers]
            if crops:
                group['passages'] = [dict(id=f"{group['id']}-image-{i}", tempId=f"{group['id']}-image-{i}", type='TEXT', content='', imageUrl=r['imageUrl'], inputMode='IMAGE', order=i + 1) for i, r in enumerate(crops)]
                for q in part['questions']:
                    if q['order'] in numbers:
                        q.pop('passageTempId', None)
                        if part['part'] == 6:
                            q['content'] = f"({q['order']}) ______"
                            source_pages = sorted({r['page'] for r in crops if 'page' in r})
                            if source_pages:
                                q['sourcePages'] = source_pages
            else:
                result['warnings'].append(f"Part {part['part']}, câu {', '.join(map(str, sorted(numbers)))}: chưa xác định chắc vùng ảnh bài đọc; giữ bản chữ để kiểm tra và thay ảnh thủ công.")
        part['passages'] = [p for g in part['groups'] for p in g['passages']]
