import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import learning
from learning_cli import export, compare


JOB = '11111111-1111-4111-8111-111111111111'


class LearningTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {'PDF_AI_LEARNING_DIR': self.tmp.name})
        self.env.start()
        self.q = {'order': 7, 'part': 2, 'content': 'Where?\n(A) Here\n(B) Now\n(C) Soon',
                  'options': [{'key': k, 'text': ''} for k in 'ABC'], 'correctAnswer': 'A'}
        self.original = {**self.q, 'content': ''}
        learning.retain_baseline(JOB, {'parts': [{'part': 2, 'questions': [self.original], 'groups': []}]})

    def tearDown(self):
        self.env.stop(); self.tmp.cleanup()

    def event(self):
        return {'kind': 'part', 'jobId': JOB, 'eventId': 'event1', 'after': {'part': 2, 'questions': [self.q], 'groups': []}}

    def test_baseline_immutable_and_pdf_deduplicated(self):
        learning.retain_baseline(JOB, {'parts': []})
        self.assertTrue(learning.baseline(JOB)['result']['parts'])
        learning.retain_sources(JOB, {'lc': b'%PDF-source', 'lc_script': b'%PDF-source'}, 1)
        self.assertEqual(len(list((learning.root() / 'pdfs').glob('*.pdf'))), 1)
        with self.assertRaises(ValueError): learning.job_path('../escape')

    def test_capture_pending_idempotent_and_new_revision_requires_review(self):
        first = learning.capture(self.event())['ids'][0]
        self.assertEqual(learning.capture(self.event())['ids'], [first])
        self.assertEqual(learning.overview()['counts']['pending'], 1)
        learning.review(first, 'gold', 'Compared PDF page 2')
        event = self.event(); event['after']['questions'][0] = {**self.q, 'content': self.q['content'].replace('Where?', 'When?')}; event['eventId'] = 'event2'
        second = learning.capture(event)['ids'][0]
        self.assertEqual(learning.overview()['counts']['pending'], 1)
        learning.review(second, 'gold', 'Verified revised PDF transcription')
        self.assertEqual(learning.overview()['counts']['gold'], 1)
        self.assertEqual(learning.overview()['counts']['superseded'], 1)

    def test_invalid_gold_and_blank_review_rejected(self):
        event = self.event(); event['after']['questions'][0] = {**self.q, 'content': '' , 'correctAnswer': 'D'}
        sample = learning.capture(event)['ids'][0]
        with self.assertRaises(ValueError): learning.review(sample, 'gold', 'Verified')
        with self.assertRaises(ValueError): learning.review(sample, 'rejected', '  ')

    def test_no_change_audio_only_does_not_create_sample(self):
        event = self.event(); event['after']['questions'][0] = {**self.original, 'audioUrl': 'voice.mp3'}
        self.assertEqual(learning.capture(event)['ids'], [])

    def test_export_shared_pdf_never_crosses_splits(self):
        a = {'jobId': 'a', 'provenance': {'sources': {'lc': 'same', 'rc': 'a'}}}
        b = {'jobId': 'b', 'provenance': {'sources': {'lc': 'same', 'rc': 'b'}}}
        out = Path(self.tmp.name) / 'export'
        splits = export([a, b], out)
        self.assertIn(2, splits.values())
        self.assertEqual(sum(splits.values()), 2)

    def test_evaluation_reports_missing_and_ignores_independent_answer_key(self):
        sample = {'kind': 'question', 'number': 7, 'after': self.q}
        self.assertEqual(compare(sample, {'questions': {}})['status'], 'missing')
        parsed = {'questions': {7: {'content': 'Where?', 'options': [
            {'key': 'A', 'text': 'Here'}, {'key': 'B', 'text': 'Now'}, {'key': 'C', 'text': 'Soon'}]}}}
        self.assertEqual(compare(sample, parsed)['status'], 'pass')


if __name__ == '__main__': unittest.main()
