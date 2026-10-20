"""Read English Listening scripts from numbered, two-column ETS workbooks."""
import re
from collections import defaultdict
from pathlib import Path

import pymupdf


VOICE = re.compile(r'\b([MW])\s*[-–]\s*(?:Au|Am|Br|Cn|Ca|US|UK)\b', re.I)
COMMON = set('a an the i you he she it we they this that these those is are was were be been being to of in on at for from with by and or but so if as not no yes have has had do does did will would can could should may might our your my his her their its what when where why who which how about please thanks thank there here all some one two any more most very just now then also well new good next today tomorrow before after want need going work people company meeting time make take get go say let look order'.split())


def clean_text(text):
    text = re.sub(r'\s+', ' ', text).strip()
    text = re.sub(r'\(\s*([A-D])\s*\)', r'(\1)', text)
    text = re.sub(r'\b([MWmw])\s*[-–]\s*(Au|Am|Br|Cn|Ca|US|UK)\b', r'\1-\2', text)
    text = re.sub(r"(\w)\s+(['’])\s+(\w)", r'\1\2\3', text)
    return re.sub(r'\s+([,.?!:;])', r'\1', text)


def english_line(text, allow_numeric=False):
    if allow_numeric and re.fullmatch(r'(?:At\s+)?(?:[01]?\d|2[0-3]):[0-5]\d\s*(?:[AP]\.?M\.?)?', text, re.I):
        return True
    if allow_numeric and re.fullmatch(r'\d+(?:[.,]\d+)?\s*%?', text):
        return True
    if re.fullmatch(r'[$£€]\s*\d+(?:[.,]\d+)?', text):
        return True
    if re.search(r'[\\|^{}<>®°§±«»]|[\uac00-\ud7af\u3000-\u9fff]|[a-z][A-Z]{2}', text):
        return False
    words = re.findall(r"[A-Za-z]+(?:['’-][A-Za-z]+)*", text)
    if not words or sum(len(w) for w in words) < len(text.replace(' ', '')) * .6:
        return False
    if len(words) >= 7 and not any(w.lower() in COMMON for w in words):
        return False
    if len(words) <= 2 and any(len(w) >= 3 and w.isupper() and w not in ('USB', 'CEO', 'DVD', 'ATM', 'USA') for w in words):
        return False
    return True


def is_question_badge(left, right):
    """Keep a numbered heading separate from a distant Korean video badge."""
    number = re.fullmatch(r'\d{1,3}', left['text'])
    return bool(number and 1 <= int(number[0]) <= 100 and
                right['x'] - left['right'] >= 40 and not english_line(right['text']))


def column_ocr_words(page, layout_repair=False):
    """Run OCR on each physical column so Tesseract cannot merge columns."""
    words = []
    width, height = page.rect.width, page.rect.height
    # The printed right column starts slightly left of the page midpoint.
    # Splitting at 50% cuts digits/option markers in otherwise readable PDFs.
    split = width * (.48 if layout_repair else .5)
    for column, (left, right) in enumerate(((0, split), (split, width * .94))):
        clip = pymupdf.Rect(left, height * .025, right, height * .93)
        pixmap = page.get_pixmap(dpi=300, clip=clip)
        with pymupdf.open(stream=pixmap.pdfocr_tobytes(language='eng'), filetype='pdf') as ocr_doc:
            ocr_page = ocr_doc[0]
            sx, sy = clip.width / ocr_page.rect.width, clip.height / ocr_page.rect.height
            for x0, y0, x1, y1, text, block, line, word in ocr_page.get_text('words'):
                words.append((left+x0*sx, clip.y0+y0*sy, left+x1*sx, clip.y0+y1*sy, text, block+column*10000, line, word))
    return words


def script_lines(page, repair_layer=False, force_ocr=False, layout_repair=False):
    # Text coordinates are unrotated in PyMuPDF. This workbook alternates 180°
    # page rotations; normalize before sorting, otherwise every line is reversed.
    if page.rotation:
        page.remove_rotation()
    native = page.get_text().strip()
    # Some scans carry a damaged hidden layer with individual letters separated
    # by spaces. Re-OCR those pages rather than accepting truncated transcripts.
    ocr = force_ocr or len(native) < 40 or (repair_layer and bool(re.search(r'(?:\b[A-Za-z]\s+){6,}', native)))
    source_words = column_ocr_words(page, layout_repair) if ocr else page.get_text('words')
    # Both hidden PDF text and Tesseract may put words from the left and
    # right columns in the same line. Split by word coordinates before
    # rebuilding lines; assigning a whole line by x0 mixes question numbers.
    rows_by_column = defaultdict(list)
    for word in source_words:
        x0, y0, x1, y1, text, block, line, *_ = word
        if y0 > page.rect.height * .93 or y1 < page.rect.height * .025 or x0 > page.rect.width * .94:
            continue
        column = int(x0 >= page.rect.width * (.48 if layout_repair else .5))
        rows_by_column[(block, line, column)].append(word)
    columns = [[], []]
    for (_, _, column), words in rows_by_column.items():
        words.sort(key=lambda word: word[0])
        if len(words) > 1 and is_question_badge(
                {'text': words[0][4], 'right': words[0][2]},
                {'text': clean_text(' '.join(w[4] for w in words[1:])), 'x': words[1][0]}):
            words = words[:1]
        text = clean_text(' '.join(word[4] for word in words))
        if text:
            columns[column].append({'text': text, 'x': min(w[0] for w in words), 'y': min(w[1] for w in words),
                                    'bottom': max(w[3] for w in words), 'right': max(w[2] for w in words)})
    output = []
    for column in columns:
        if not layout_repair:
            column.sort(key=lambda line: (round(line['y'] / 3), line['x']))
            rows = []
            for line in column:
                if rows and abs(line['y'] - rows[-1]['y']) < 3 and line['x'] >= rows[-1]['right'] - 2:
                    if is_question_badge(rows[-1], line):
                        continue
                    rows[-1]['text'] += ' ' + line['text']
                    rows[-1]['right'] = line['right']
                else:
                    rows.append(dict(line))
            output.extend(rows)
            continue
        column.sort(key=lambda line: (line['y'], line['x']))
        # Speaker labels and their utterance often occupy separate PDF lines.
        rows = []
        for line in column:
            center = (line['y'] + line['bottom']) / 2
            height = line['bottom'] - line['y']
            match = next((row for row in reversed(rows[-5:])
                          if abs(center - (row['y'] + row['bottom']) / 2) <= max(3, min(height, row['bottom']-row['y']) * .4)
                          and (line['x'] >= row['right'] - 2 or line['right'] <= row['x'] + 2)), None)
            if match is None:
                rows.append(dict(line))
            else:
                left, right = sorted([match, line], key=lambda row: row['x'])
                if is_question_badge(left, right):
                    kept = dict(left)
                    match.clear()
                    match.update(kept)
                    continue
                match['text'] = ' '.join(text for _, text in sorted([(match['x'], match['text']), (line['x'], line['text'])]))
                match.update(x=min(match['x'], line['x']), right=max(match['right'], line['right']),
                             y=min(match['y'], line['y']), bottom=max(match['bottom'], line['bottom']))
        rows.sort(key=lambda line: (line['y'], line['x']))
        output.extend(rows)
    return output, ocr


def parse_question(lines, number):
    keys = 'ABC' if 7 <= number <= 31 else 'ABCD'
    stem, options, option_x = [], [], 0
    for line in lines:
        text = VOICE.sub('', line['text']).strip()
        # OCR may leave an underscore after the annotation or read W as N.
        # These are speaker labels, never part of the spoken question.
        text = re.sub(r'^\s*[MWN]\s*[-–]\s*(?:Au|Am|Br|Cn|Ca|US|UK)(?![A-Za-z])_*\s*', '', text, flags=re.I)
        text = text.lstrip('_').strip()
        text = re.sub(r'(?<!\w)\|(?!\w)', 'I', text)
        if not text:
            continue
        marker = re.match(r'^\(([A-D])\)\s*(.*)', text)
        if marker:
            if len(options) == len(keys):
                break  # The next option list is the translation, not more choices.
            if marker[1] != keys[len(options)]:
                return None
            option_text = marker[2]
            # Some ETS PDFs have stray glyphs from the Korean translation
            # layer at the end of an English option (e.g. "fee. H").
            option_text = re.sub(r'([.!?])\s+[A-Za-z]{1,2}\s*[\\|/]?\s*$', r'\1', option_text)
            if not english_line(option_text, allow_numeric=True):
                return None
            options.append({'key': marker[1], 'text': option_text})
            option_x = line['x']
        elif options:
            # Wrapped answer lines in two-column ETS PDFs may indent much
            # farther than 40pt when the first line also contains the speaker
            # label. Keep a wider same-column margin; English filtering still
            # excludes the Korean translation printed beneath the choices.
            if not option_x + 4 < line['x'] < option_x + 90 or not english_line(text):
                break
            # A wrapped line can start more than 40pt in from the option
            # marker; when joining it, remove isolated OCR fragments at the
            # wrap boundary and after its sentence punctuation.
            options[-1]['text'] = re.sub(r'\s+[A-Za-z]$', '', options[-1]['text'])
            text = re.sub(r'([.!?])\s+[A-Za-z]{1,2}\s*$', r'\1', text)
            options[-1]['text'] += ' ' + text
        elif english_line(text) and not re.fullmatch(r'[A-HJ-Za-hj-z]', text):
            stem.append(text)
    if len(options) != len(keys):
        return None
    content = ' '.join(stem) if number > 6 else ''
    content = re.sub(r'^[mH]\s+(?=[A-Z])|\s+H$', '', content)
    if number > 6 and not content:
        return None
    return {'order': number, 'content': content, 'options': options}


def parse_transcript(lines, numbers):
    transcript = []
    for line in lines:
        text = line['text'].replace('®', '')
        text = re.sub(r'(?<!\w)\|(?!\w)', 'I', text)
        voice = VOICE.search(text)
        if voice:
            text = VOICE.sub(lambda m: 'Man:' if m[1].upper() == 'M' else 'Woman:', text)
        # Superscript question references are annotations, not spoken words.
        text = re.sub(r'(?<!\d)(' + '|'.join(map(str, numbers)) + r')\s*(?=[A-Za-z])', '', text).strip()
        if not transcript:
            text = re.sub(r'^(\s*(?:Man:|Woman:)\s*)?\d{1,3}\s*(?=[A-Z][a-z])', lambda m: m[1] or '', text)
        spoken = re.sub(r'^(?:Man|Woman):\s*', '', text)
        if not spoken and voice:
            if len(transcript) == 1 and not re.match(r'^(Man|Woman):', transcript[0]):
                transcript[0] = text + ' ' + transcript[0]
                continue
            transcript.append(text)
            continue
        if not english_line(spoken):
            if not transcript:
                continue
            break
        if voice or not transcript:
            transcript.append(text)
        else:
            transcript[-1] += ' ' + text
    return re.sub(r'[ \t]{2,}', ' ', '\n'.join(transcript)).strip()


def read_listening_script(data, test_number, progress=None, asset_dir=None, asset_url='', _repair=False, _force_pages=(), _layout=False):
    if not data.startswith(b'%PDF-'):
        raise ValueError('Script Listening phải là PDF hợp lệ.')
    questions, groups, warnings, pages = {}, {}, [], []
    segment, active = [], None
    question_pages, group_pages = {}, {}

    def finish():
        if active is None:
            return
        if isinstance(active, tuple):
            text = parse_transcript(segment, range(active[0], active[1] + 1))
            if text:
                groups[active[0]] = {'numbers': list(range(active[0], active[1]+1)), 'content': text, 'sourcePages': sorted({l['page'] for l in segment})}
        else:
            parsed = parse_question(segment, active)
            if parsed:
                parsed['scriptPages'] = sorted({l['page'] for l in segment})
                if active in questions and questions[active] != parsed:
                    raise ValueError(f'Script có nhiều nội dung cho câu {active}; hãy chọn PDF chỉ chứa một Test.')
                questions[active] = parsed

    with pymupdf.open(stream=data, filetype='pdf') as doc:
        if doc.needs_pass or not 1 <= len(doc) <= 150:
            raise ValueError('Script có mật khẩu hoặc quá 150 trang.')
        named_tests = set()
        for i, page in enumerate(doc):
            if progress:
                progress(i, len(doc), f'Đọc script Listening: trang {i+1}/{len(doc)}')
            kwargs = {'layout_repair': True} if _layout else {}
            lines, ocr = script_lines(page, repair_layer=_repair, force_ocr=i+1 in _force_pages, **kwargs)
            named_tests.update(int(m[1]) for l in lines for m in re.finditer(r'\bTEST\s*0*(\d+)\b', l['text'], re.I))
            preview = {'number': i+1, 'ocr': ocr}
            if asset_dir:
                Path(asset_dir).mkdir(parents=True, exist_ok=True)
                filename = f'page-{i+1}.jpg'
                page.get_pixmap(dpi=110).save(str(Path(asset_dir) / filename), jpg_quality=80)
                preview['imageUrl'] = f'{asset_url}/{filename}'
            pages.append(preview)
            for line in lines:
                text = line['text']
                group = re.match(r'^(\d{2,3})\s*[-–—]\s*(\d{2,3})\b', text)
                question = re.fullmatch(r'(\d{1,3})(?:\s+(?:[MW][-–][A-Za-z]+|H))?', text, re.I)
                new = None
                if group:
                    first, last = map(int, group.groups())
                    if first in list(range(32,71,3)) + list(range(71,101,3)) and last == first+2:
                        new = (first,last)
                        group_pages[first] = i+1
                elif question and 1 <= int(question[1]) <= 100:
                    new = int(question[1])
                    question_pages[new] = i+1
                if new is not None:
                    finish()
                    active, segment = new, []
                elif active is not None:
                    segment.append({**line, 'page': i+1})
        finish()
    if named_tests and named_tests != {test_number}:
        raise ValueError(f'Script thuộc Test {", ".join(map(str, sorted(named_tests)))}; bạn đang chọn Test {test_number}.')
    if not questions:
        raise ValueError('Không nhận diện được câu hỏi trong script. Cần PDF có số câu và lựa chọn A/B/C/D rõ ràng.')
    damaged_groups = [n for n,g in groups.items() if len(g['content'].split()) < 55 or re.search(r'(?:\b[A-Za-z]\s+){6,}',g['content'])]
    missing_questions = set(range(1,101)) - questions.keys()
    missing_group_numbers = (set(range(32,71,3)) | set(range(71,101,3))) - groups.keys()
    # Hidden text layers can mix two columns even when their English words
    # look valid. Re-OCR only pages around failed headings in full workbooks.
    force_pages = set()
    if len(questions) >= 50:
        for number in missing_questions:
            if number in question_pages:
                force_pages.add(question_pages[number])
            else:
                force_pages.update(page for n,page in question_pages.items() if abs(n-number) <= 1)
        for number in missing_group_numbers:
            if number in group_pages:
                force_pages.add(group_pages[number])
            else:
                force_pages.update(question_pages[n] for n in range(number,number+3) if n in question_pages)
        for number in damaged_groups:
            force_pages.update(groups[number]['sourcePages'])
    if (damaged_groups or force_pages) and not _repair:
        if progress:
            progress(len(pages),len(pages),'Đang đọc lại các trang script bị lỗi lớp chữ')
        try:
            repaired = read_listening_script(data, test_number, _repair=True, _force_pages=force_pages)
        except RuntimeError:
            # OCR repair is optional: preserve the successfully read native
            # script and keep unresolved questions visible if OCR fails.
            repaired = {'questions': {}, 'groups': {}, 'pages': []}
            warnings.append('Không đọc lại được một số trang script; giữ nội dung đã đọc và đánh dấu câu còn thiếu để kiểm tra.')
        for number in missing_questions:
            if number in repaired['questions']:
                questions[number] = repaired['questions'][number]
        for number in set(damaged_groups) | missing_group_numbers:
            candidate = repaired['groups'].get(number)
            if candidate and len(candidate['content']) > len(groups.get(number, {}).get('content','')):
                groups[number] = candidate
            else:
                warnings.append(f'Script nhóm {number}–{number+2}: lời thoại có thể chưa đủ; đối chiếu PDF nguồn trước khi lưu.')
        for page, candidate in zip(pages, repaired['pages']):
            page['ocr'] = page['ocr'] or candidate['ocr']
    # A different gutter/row clustering can recover clipped headings but can
    # harm other pages. Use it only to fill gaps, keeping all accepted scripts
    # and transcripts from the established native + column OCR passes intact.
    if not _repair and len(questions) >= 50 and set(range(1,101)) - questions.keys():
        try:
            alternate = read_listening_script(data, test_number, _repair=True, _layout=True)
            for number, candidate in alternate['questions'].items():
                if number not in questions:
                    questions[number] = candidate
            for number, candidate in alternate['groups'].items():
                if number not in groups:
                    groups[number] = candidate
            for page, candidate in zip(pages, alternate['pages']):
                page['ocr'] = page['ocr'] or candidate['ocr']
        except RuntimeError:
            warnings.append('Không đọc lại được bố cục script; giữ dữ liệu đã nhận diện để kiểm tra.')
    missing = sorted(set(range(1,101)) - questions.keys())
    if missing:
        warnings.append('Script chưa đọc đủ câu ' + ', '.join(map(str, missing)) + '; giữ dữ liệu đề gốc để kiểm tra, không tự tạo lời thoại.')
    missing_groups = sorted((set(range(32,71,3)) | set(range(71,101,3))) - groups.keys())
    if missing_groups:
        warnings.append('Script chưa đọc đủ lời thoại nhóm bắt đầu ở câu ' + ', '.join(map(str, missing_groups)) + '.')
    return {'questions': questions, 'groups': groups, 'pages': pages, 'warnings': warnings}


def merge_listening_script(result, script):
    """Fill source text, retaining photos, exam links and the selected answer key."""
    for part in result['parts']:
        for question in part['questions']:
            parsed = script['questions'].get(question['order'])
            if parsed:
                question.update(content=parsed['content'], options=parsed['options'], scriptPages=parsed['scriptPages'])
                question.pop('needsSource', None)
        for group in part['groups']:
            linked = [q for q in part['questions'] if q.get('passageGroupTempId') == group['id']]
            first = min((q['order'] for q in linked), default=0)
            parsed = script['groups'].get(first)
            if parsed and set(parsed['numbers']) == {q['order'] for q in linked}:
                group['passages'][0]['content'] = parsed['content']
        part['passages'] = [p for g in part['groups'] for p in g['passages']]
    result['warnings'].extend(script['warnings'])
    normalize_listening_choices(result)


def normalize_listening_choices(result):
    """Part 1/2 spoken choices belong to the script, answer controls are letters."""
    for part in result.get('parts', []):
        if part.get('part') not in (1, 2):
            continue
        for question in part.get('questions', []):
            choices = question.get('options', [])
            if not any(isinstance(o.get('text'), str) and o['text'].strip() for o in choices):
                continue
            lines = [question.get('content', '').strip()]
            for option in choices:
                text = option.get('text', '').strip()
                if text:
                    entry = f"({option['key']}) {text}"
                    if entry not in lines[0]:
                        lines.append(entry)
                    option['text'] = ''
            question['content'] = '\n'.join(line for line in lines if line)
