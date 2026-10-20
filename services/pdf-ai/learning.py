"""Private, versioned correction corpus. Saving an edit never makes it gold."""
import copy
import hashlib
import json
import os
import re
import threading
import time
import uuid
from pathlib import Path

_lock = threading.RLock()


def root():
    path = Path(os.getenv('PDF_AI_LEARNING_DIR', '/app/learning'))
    path.mkdir(parents=True, exist_ok=True)
    return path


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf8')
    tmp.replace(path)


def job_path(job_id):
    if str(uuid.UUID(job_id)) != job_id:
        raise ValueError('Invalid source job')
    return root() / 'jobs' / job_id


def retain_sources(job_id, files, test_number):
    """Content-addressed PDFs stay outside the publicly served media folder."""
    with _lock:
        target = job_path(job_id)
        manifest_path = target / 'manifest.json'
        manifest = json.loads(manifest_path.read_text('utf8')) if manifest_path.exists() else {
            'schemaVersion': 1, 'jobId': job_id, 'testNumber': test_number, 'sources': {}}
        for role, data in files.items():
            if role not in ('lc', 'rc', 'lc_answers', 'rc_answers', 'lc_script', 'file', 'answers'):
                raise ValueError('Unknown PDF role')
            if not data.startswith(b'%PDF-'):
                raise ValueError('Invalid PDF')
            sha = hashlib.sha256(data).hexdigest()
            blob = root() / 'pdfs' / f'{sha}.pdf'
            blob.parent.mkdir(parents=True, exist_ok=True)
            if not blob.exists():
                blob.write_bytes(data)
            manifest['sources'][role] = sha
        write(manifest_path, manifest)


def retain_baseline(job_id, result, legacy=False):
    with _lock:
        target = job_path(job_id) / 'baseline.json'
        if not target.exists():
            write(target, {'schemaVersion': 1, 'legacy': legacy, 'result': result})


def question_label(q):
    return {'content': (q.get('content') or '').strip(),
            'options': [{'key': o['key'], 'text': (o.get('text') or '').strip()} for o in q.get('options', [])],
            'correctAnswer': q.get('correctAnswer'), 'imageUrl': q.get('imageUrl') or ''}


def group_label(g):
    return {'title': (g.get('title') or '').strip(), 'passages': [
        {key: p.get(key) or '' for key in ('type', 'content', 'imageUrl')} for p in g.get('passages', [])]}


def baseline(job_id):
    path = job_path(job_id) / 'baseline.json'
    if not path.exists():
        # Old jobs are explicitly labelled as a legacy snapshot, never an original run.
        assets = Path(os.getenv('PDF_AI_ASSET_DIR', '/app/assets'))
        job = json.loads((assets / job_id / 'job-state.json').read_text('utf8'))
        retain_baseline(job_id, job['result'], legacy=True)
    return json.loads(path.read_text('utf8'))


def record(job_id, kind, number, part, before, after, context):
    if before == after:
        return None
    manifest_path = job_path(job_id) / 'manifest.json'
    manifest = json.loads(manifest_path.read_text('utf8')) if manifest_path.exists() else {}
    # Repeated delivery of a durable event is idempotent. A later distinct revision
    # stays pending, even if an older revision was confirmed.
    identity = {'jobId': job_id, 'kind': kind, 'number': number, 'before': before, 'after': after,
                'revision': context.get('eventId', '')}
    sample_id = digest(identity)
    path = root() / 'samples' / f'{sample_id}.json'
    with _lock:
        if not path.exists():
            write(path, {**identity, 'id': sample_id, 'schemaVersion': 1, 'part': part,
                         'status': 'pending', 'createdAt': time.time(), 'provenance': {
                             **context, 'sources': manifest.get('sources', {}),
                             'testNumber': manifest.get('testNumber')}})
    return sample_id


def capture(event):
    job_id = event['jobId']
    source = baseline(job_id)
    original_parts = source['result']['parts']
    context = {key: event.get(key) for key in ('eventId', 'examId', 'questionId', 'reason')}
    context['legacyBaseline'] = source.get('legacy', False)
    context['sourceImages'] = source['result'].get('sourcePages', [])
    ids = []
    if event['kind'] == 'part':
        after_part = event['after']
        original = next(p for p in original_parts if p['part'] == after_part['part'])
        old_questions = {q['order']: q for q in original['questions']}
        for q in after_part['questions']:
            n = q['order']
            old = old_questions.get(n)
            if old is None:
                raise ValueError('Question not found in source baseline')
            meta = {**context, 'sourcePages': old.get('sourcePages', []), 'scriptPages': old.get('scriptPages', [])}
            ids.append(record(job_id, 'question', n, original['part'], question_label(old), question_label(q), meta))
        # Match groups by linked question orders rather than mutable temporary IDs.
        def members(p, g):
            return sorted(q['order'] for q in p['questions'] if q.get('passageGroupTempId') in (g.get('id'), g.get('tempId')))
        for g in after_part.get('groups', []):
            numbers = members(after_part, g)
            old = next((x for x in original['groups'] if members(original, x) == numbers), None)
            if old and numbers:
                ids.append(record(job_id, 'group', numbers[0], original['part'], group_label(old), group_label(g), {**context, 'numbers': numbers}))
        def layout(p):
            return [{'numbers': members(p, g), **group_label(g)} for g in p.get('groups', [])]
        if sorted(members(original, g) for g in original.get('groups', [])) != sorted(members(after_part, g) for g in after_part.get('groups', [])):
            ids.append(record(job_id, 'layout', min(old_questions), original['part'],
                              {'groups': layout(original)}, {'groups': layout(after_part)}, context))
    elif event['kind'] == 'question':
        q = event['after']
        n = event['number']
        old = next(q for p in original_parts for q in p['questions'] if q['order'] == n)
        meta = {**context, 'sourcePages': old.get('sourcePages', []), 'scriptPages': old.get('scriptPages', [])}
        ids.append(record(job_id, 'question', n, q['part'], question_label(event['before']), question_label(q), meta))
    elif event['kind'] == 'group':
        ids.append(record(job_id, 'group', event['number'], event['part'],
                          group_label(event['before']), group_label(event['after']), context))
    else:
        raise ValueError('Unknown correction kind')
    return {'ids': [x for x in ids if x]}


def samples():
    return [json.loads(p.read_text('utf8')) for p in (root() / 'samples').glob('*.json')]


def overview():
    values = samples()
    values.sort(key=lambda x: x['createdAt'], reverse=True)
    counts = {s: sum(x['status'] == s for x in values) for s in ('pending', 'gold', 'rejected', 'superseded')}
    return {'counts': counts, 'samples': values[:300], 'total': len(values)}


def review(sample_id, status, note):
    if not re.fullmatch('[a-f0-9]{64}', sample_id) or status not in ('gold', 'rejected') or not note.strip():
        raise ValueError('A review decision and PDF verification note are required')
    with _lock:
        path = root() / 'samples' / f'{sample_id}.json'
        item = json.loads(path.read_text('utf8'))
        if status == 'gold':
            label = item['after']
            if item['kind'] == 'question':
                keys = [o['key'] for o in label['options']]
                expected = list('ABC' if item['part'] == 2 else 'ABCD')
                if keys != expected or label.get('correctAnswer') not in keys:
                    raise ValueError('Invalid answer labels')
                if not label['content'] and not (item['part'] in (6, 7) and label['imageUrl']):
                    raise ValueError('Missing question/script')
                if item['part'] in (1, 2) and any(not re.search(r'\(' + k + r'\)\s*\S', label['content']) for k in expected):
                    raise ValueError('Missing spoken choices in script')
                if item['part'] >= 3 and any(not o['text'] for o in label['options']):
                    raise ValueError('Missing choice text')
            # Exactly one active gold revision for a source item.
            for other in samples():
                if (other['id'] != sample_id and other['status'] == 'gold' and
                    all(other[k] == item[k] for k in ('jobId', 'kind', 'number'))):
                    other['status'] = 'superseded'
                    write(root() / 'samples' / f"{other['id']}.json", other)
        item.update(status=status, reviewedAt=time.time(), reviewNote=note.strip())
        write(path, item)
        return item
