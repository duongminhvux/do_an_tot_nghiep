"""Offline corpus export and Listening script regression. No model training."""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

import learning


def normalized(text):
    return re.sub(r'\s+', ' ', (text or '').replace('’', "'").replace('‘', "'")).strip()


def script_label(parsed, number):
    if not parsed:
        return None
    label = {'content': parsed['content'], 'options': parsed['options']}
    if number <= 31:
        holder = {'parts': [{'part': 1 if number <= 6 else 2, 'questions': [label]}]}
        from listening_script import normalize_listening_choices
        normalize_listening_choices(holder)
    return label


def compare(sample, parsed):
    if sample['kind'] == 'question':
        expected = sample['after']
        actual = script_label(parsed['questions'].get(sample['number']), sample['number'])
        canonical = lambda x: {'content': normalized(x['content']), 'options': [
            {'key': o['key'], 'text': normalized(o['text'])} for o in x['options']]}
        # The answer key and PDF image are independent sources, not script labels.
        wanted = canonical(expected)
        got = canonical(actual) if actual else None
    elif sample['kind'] == 'group':
        passages = sample['after']['passages']
        if len(passages) != 1 or not passages[0]['content']:
            return {'status': 'unsupported', 'reason': 'Image-only or multi-passage label; not a Listening script test.'}
        wanted = normalized(passages[0]['content'])
        item = parsed['groups'].get(sample['number'])
        got = normalized(item['content']) if item else None
    else:
        return {'status': 'unsupported', 'reason': 'Structural grouping label; needs a layout evaluator.'}
    return {'status': 'pass' if got == wanted else 'missing' if got is None else 'mismatch',
            'expected': wanted, 'actual': got}


def evaluate(items):
    from listening_script import read_listening_script
    parsed_sources = {}
    details = []
    for item in items:
        row = {'id': item['id'], 'jobId': item['jobId'], 'number': item['number'], 'kind': item['kind']}
        sha = item['provenance'].get('sources', {}).get('lc_script')
        if not sha or item['part'] > 4:
            details.append({**row, 'status': 'unsupported', 'reason': 'Requires retained lc_script PDF and a Part 1–4 label.'})
            continue
        if sha not in parsed_sources:
            try:
                parsed_sources[sha] = read_listening_script((learning.root() / 'pdfs' / f'{sha}.pdf').read_bytes(), item['provenance']['testNumber'])
            except Exception as exc:
                parsed_sources[sha] = {'error': str(exc)}
        parsed = parsed_sources[sha]
        details.append({**row, **({'status': 'error', 'reason': parsed['error']} if 'error' in parsed else compare(item, parsed))})
    counts = {status: sum(d['status'] == status for d in details) for status in ('pass', 'missing', 'mismatch', 'error', 'unsupported')}
    return {'schemaVersion': 1, 'goldSamples': len(items), 'counts': counts, 'details': details,
            'scope': 'Part 1–4 script content/options and single transcript. Does not score answer keys, images or Reading.'}


def export(items, output):
    output.mkdir(parents=True, exist_ok=True)
    # Connected source sets form one split unit: a shared PDF cannot leak across
    # train/eval even when several jobs reuse it with different companion PDFs.
    parents = {}
    def find(x):
        parents.setdefault(x, x)
        if parents[x] != x: parents[x] = find(parents[x])
        return parents[x]
    for item in items:
        hashes = sorted(item['provenance'].get('sources', {}).values()) or [item['jobId']]
        for sha in hashes[1:]: parents[find(sha)] = find(hashes[0])
    splits = {'train': [], 'eval': []}
    for item in items:
        hashes = sorted(item['provenance'].get('sources', {}).values()) or [item['jobId']]
        unit = find(hashes[0])
        split = 'eval' if int(hashlib.sha256(unit.encode()).hexdigest()[:8], 16) % 5 == 0 else 'train'
        splits[split].append({**item, 'split': split})
    for name, rows in {**splits, 'gold': items}.items():
        (output / f'{name}.jsonl').write_text(''.join(json.dumps(x, ensure_ascii=False) + '\n' for x in rows), encoding='utf8')
    return {k: len(v) for k, v in splits.items()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['export', 'evaluate'])
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    gold = [s for s in learning.samples() if s['status'] == 'gold']
    if not gold:
        parser.error('No verified gold samples; review corrections before evaluation/export.')
    output = Path(args.output)
    if args.command == 'export':
        print(json.dumps(export(gold, output)))
    else:
        report = evaluate(gold)
        learning.write(output, report)
        print(json.dumps({k: v for k, v in report.items() if k != 'details'}, ensure_ascii=False))
        if any(report['counts'][s] for s in ('missing', 'mismatch', 'error')):
            sys.exit(1)


if __name__ == '__main__':
    main()
