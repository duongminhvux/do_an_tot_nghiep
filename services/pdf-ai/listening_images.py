"""Source graphic crops for shared TOEIC Part 3/4 Listening exercises."""
import re
from collections import defaultdict

import pymupdf


def crop_listening_graphics(page, words, target, public, page_number):
    rows = defaultdict(list)
    for word in words:
        rows[tuple(word[5:7])].append(word)
    markers = []
    for row in rows.values():
        row.sort(key=lambda w: w[0])
        label = re.fullmatch(r'(\d{2,3})[.)]?', row[0][4])
        if label and 32 <= int(label[1]) <= 100:
            word = row[0]
            if word[1] > page.rect.height * .93 or word[3] < page.rect.height * .025:
                continue  # Page numbers such as 56 are not question labels.
            column = int(word[0] >= page.rect.width / 2)
            if word[0] - column * page.rect.width / 2 < page.rect.width * .16:
                markers.append((int(label[1]), word, column))
    groups = set(range(32, 71, 3)) | set(range(71, 101, 3))
    graphics = []
    for column in (0, 1):
        labels = [(n,w) for n,w,c in markers if c == column]
        if not labels:
            continue
        first, marker = min(labels, key=lambda pair: pair[1][1])
        numbers = set(range(first, first + 3))
        # Only the standard one-exercise-per-column layout is safe to crop
        # automatically. Never include a preceding exercise's printed choices.
        if first not in groups or {n for n,_ in labels} != numbers:
            continue
        x0, x1 = column * page.rect.width / 2, (column + 1) * page.rect.width / 2
        body = ' '.join(w[4] for w in words if x0 <= w[0] < x1 and w[1] >= marker[1])
        if not re.search(r'\bgraphic\b', body, re.I):
            continue
        clip = pymupdf.Rect(x0 + page.rect.width * .002, page.rect.height * .025,
                            x1 - page.rect.width * .015, marker[1] - 6) & page.rect
        if clip.height < page.rect.height * .07:
            continue
        probe = page.get_pixmap(dpi=40, clip=clip, colorspace=pymupdf.csGRAY)
        if sum(v < 180 for v in probe.samples) / max(len(probe.samples),1) < .006:
            continue
        filename = f'page-{page_number}-graphic-{first}-{first+2}.jpg'
        page.get_pixmap(dpi=180, clip=clip).save(str(target / filename),jpg_quality=90)
        graphics.append({'numbers': sorted(numbers), 'imageUrl': f'{public}/{filename}', 'page': page_number})
    return graphics


def attach_listening_graphics(result, pages):
    """Share one illustration with its three questions without replacing audio/text."""
    for part in result['parts']:
        if part['part'] not in (3,4):
            continue
        for group in part['groups']:
            questions = [q for q in part['questions'] if q.get('passageGroupTempId') == group['id']]
            numbers = {q['order'] for q in questions}
            crops = [g for page in pages for g in page.get('graphics',[]) if set(g['numbers']) == numbers]
            warning = f"Part {part['part']}, nhóm {min(numbers)}–{max(numbers)}: câu hỏi yêu cầu xem hình nhưng chưa cắt chắc được hình; hãy thêm ảnh minh họa từ PDF nguồn." if numbers else ''
            if len(crops) == 1 and group.get('passages'):
                group['passages'][0]['imageUrl'] = crops[0]['imageUrl']
                result['warnings'] = [w for w in result['warnings'] if w != warning]
            elif any(re.search(r'\bgraphic\b',q.get('content',''),re.I) for q in questions):
                if warning not in result['warnings']:
                    result['warnings'].append(warning)
        part['passages'] = [p for group in part['groups'] for p in group['passages']]
