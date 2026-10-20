import tempfile
import unittest
from pathlib import Path

import pymupdf

from reading_images import apply_reading_images, crop_reading_page, recover_source_groups


class ReadingImagesTest(unittest.TestCase):
    def test_full_part_six_source_headers_split_malformed_ai_group_without_changing_answers(self):
        qs = [{'order': n, 'content': 'Original stem', 'passageGroupTempId': 'merged',
               'options': [{'key': k, 'text': 'Choice ' + k} for k in 'ABCD'], 'correctAnswer': 'C'} for n in range(131,147)]
        original = [(q['order'], q['options'].copy(), q['correctAnswer']) for q in qs]
        result = {'warnings': [], 'parts': [{'part':6, 'questions':qs, 'groups':[{'id':'merged', 'passages':[{'content':'First'}, {'content':'Second'}, {'content':'Third'}]}]}]}
        pages = [{'readingImages': {'exercises':[{'numbers':list(range(first,first+4)), 'imageUrl':f'http://localhost/{first}.jpg'}]}} for first in (131,135,139,143)]
        apply_reading_images(result, pages)
        groups = result['parts'][0]['groups']
        self.assertEqual(len(groups),4)
        for group in groups:
            self.assertEqual(len(group['passages']),1)
            self.assertEqual(len([q for q in qs if q['passageGroupTempId']==group['id']]),4)
        self.assertEqual(original, [(q['order'],q['options'],q['correctAnswer']) for q in qs])
        warnings = result['warnings'].copy()
        apply_reading_images(result, pages)
        self.assertEqual(result['warnings'],warnings)

    def test_part_six_regrouping_requires_all_source_ranges_and_unique_images(self):
        from reading_images import recover_part_six_layout
        for extra in ([], [{'numbers':[134,135,136,137],'imageUrl':'http://localhost/conflict.jpg'}], [{'numbers':[131,132,133,134],'imageUrl':'http://localhost/another.jpg'}]):
            part = {'part':6,'questions':[{'order':n,'passageGroupTempId':'keep'} for n in range(131,147)],'groups':[{'id':'keep','passages':[]}]}
            crops = [{'numbers':list(range(n,n+4)),'imageUrl':f'http://localhost/{n}.jpg'} for n in (131,135,139,143)]
            crops = crops[:-1] if not extra else crops + extra
            self.assertFalse(recover_part_six_layout(part,[{'readingImages':{'exercises':crops}}],[]))
            self.assertEqual(part['groups'][0]['id'],'keep')

    def test_only_shared_passage_is_cropped_above_questions_and_choices(self):
        with tempfile.TemporaryDirectory() as directory, pymupdf.open() as doc:
            page = doc.new_page(width=600, height=800)
            page.insert_text((40, 60), 'Questions 161-164 refer to the following e-mail.')
            page.insert_text((40, 120), 'Original email with preserved layout.')
            page.insert_text((40, 400), '161. What is the purpose?')
            page.insert_text((60, 430), '(A) First choice')
            page.insert_text((60, 450), '(B) Second choice')
            layout, previous = crop_reading_page(page, page.get_text('words'), Path(directory), 'http://localhost/crops', 1)
            self.assertEqual(previous, (161, 162, 163, 164))
            self.assertEqual(len(layout['exercises']), 1)
            self.assertEqual(layout['questions'], {})
            passage = pymupdf.Pixmap(str(Path(directory) / layout['exercises'][0]['imageUrl'].split('/')[-1]))
            self.assertLess(passage.height, 900)  # Stops above the question at y=400.

    def test_question_only_continuation_has_no_blank_passage_image(self):
        with tempfile.TemporaryDirectory() as directory, pymupdf.open() as doc:
            page = doc.new_page(width=600, height=800)
            page.insert_text((40, 42), '181. Which item?')
            page.insert_text((60, 70), '(A) First choice')
            layout, _ = crop_reading_page(page, page.get_text('words'), Path(directory), 'http://localhost/crops', 2, tuple(range(181, 186)))
            self.assertEqual(layout['exercises'], [])
            self.assertEqual(layout['questions'], {})

    def test_conversion_preserves_choices_key_and_group_links(self):
        options = [{'key': k, 'text': f'Choice {k}'} for k in 'ABCD']
        question = {'order': 161, 'content': 'OCR stem', 'options': options, 'correctAnswer': 'C', 'passageGroupTempId': 'g', 'passageTempId': 'old'}
        result = {'warnings': [], 'parts': [{'part': 7, 'groups': [{'id': 'g', 'tempId': 'g', 'passages': [{'id': 'old', 'content': 'OCR email'}]}], 'questions': [question]}]}
        pages = [{'readingImages': {'exercises': [{'numbers': [161], 'imageUrl': 'http://localhost/passage.jpg'}], 'questions': {'161': 'http://localhost/stem.jpg'}}}]
        apply_reading_images(result, pages)
        self.assertEqual(question['options'], options)
        self.assertEqual(question['correctAnswer'], 'C')
        self.assertEqual(question['content'], 'OCR stem')
        self.assertNotIn('imageUrl', question)
        self.assertEqual(question['passageGroupTempId'], 'g')
        self.assertNotIn('passageTempId', question)
        passage = result['parts'][0]['groups'][0]['passages'][0]
        self.assertEqual(passage['inputMode'], 'IMAGE')
        self.assertEqual(passage['content'], '')

    def test_uncertain_group_mapping_keeps_source_text_and_warns(self):
        result = {'warnings': [], 'parts': [{'part': 6, 'groups': [{'id': 'g', 'passages': [{'content': 'Keep me'}]}], 'questions': [{'order': 131, 'passageGroupTempId': 'g'}]}]}
        apply_reading_images(result, [])
        self.assertEqual(result['parts'][0]['passages'][0]['content'], 'Keep me')
        self.assertTrue(result['warnings'])

    def test_missing_part_six_group_recovered_from_printed_header_image(self):
        questions = [{'order': n, 'content': 'OCR body', 'options': [{'key': k, 'text': k} for k in 'ABCD'], 'correctAnswer': 'D'} for n in range(135, 139)]
        pages = [{'readingImages': {'exercises': [{'numbers': list(range(135, 139)), 'imageUrl': 'http://localhost/exercise.jpg'}], 'questions': {}}}]
        result = {'warnings': [], 'parts': [{'part': 6, 'groups': [], 'questions': questions}]}
        apply_reading_images(result, pages)
        group = result['parts'][0]['groups'][0]
        self.assertEqual(group['questionNumbers'], list(range(135, 139)))
        self.assertTrue(all(q['passageGroupTempId'] == group['id'] for q in questions))
        self.assertEqual(group['passages'][0]['imageUrl'], 'http://localhost/exercise.jpg')
        self.assertTrue(all(q['correctAnswer'] == 'D' and len(q['options']) == 4 for q in questions))
        self.assertEqual(questions[0]['content'], '(135) ______')
        apply_reading_images(result, pages)
        self.assertEqual(len(result['parts'][0]['groups']), 1)
        self.assertEqual(len(result['warnings']), 1)

    def test_partial_group_is_completed_without_creating_duplicate(self):
        group = {'id': 'g', 'questionNumbers': [135,136,137,138], 'passages': []}
        questions = [{'order': n, **({'passageGroupTempId': 'g'} if n != 135 else {})} for n in range(135,139)]
        part = {'part': 6, 'groups': [group], 'questions': questions}
        pages = [{'readingImages': {'exercises': [{'numbers': [135,136,137,138]}]}}]
        recover_source_groups(part, pages, [])
        self.assertEqual(len(part['groups']), 1)
        self.assertTrue(all(q['passageGroupTempId'] == 'g' for q in questions))

    def test_recovery_refuses_absent_incomplete_or_ambiguous_source_evidence(self):
        for ranges in ([], [[135,136,137]], [[135,136,137,138], [134,135,136,137]], [[135,136,137,138]]):
            with self.subTest(ranges=ranges):
                numbers = range(135,138) if ranges == [[135,136,137,138]] else range(135,139)
                part = {'part': 6, 'groups': [], 'questions': [{'order': n} for n in numbers]}
                pages = [{'readingImages': {'exercises': [{'numbers': ns} for ns in ranges]}}]
                recover_source_groups(part, pages, [])
                self.assertEqual(part['groups'], [])

    def test_recovery_does_not_overwrite_conflicting_existing_links(self):
        part = {'part': 6, 'groups': [{'id': 'a', 'passages': []}, {'id': 'b', 'passages': []}],
                'questions': [{'order': n, 'passageGroupTempId': 'a' if n < 137 else 'b'} for n in range(135,139)]}
        pages = [{'readingImages': {'exercises': [{'numbers': [135,136,137,138]}]}}]
        recover_source_groups(part, pages, [])
        self.assertEqual([q['passageGroupTempId'] for q in part['questions']], ['a','a','b','b'])
