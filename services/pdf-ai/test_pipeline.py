import copy
import json
import re
import unittest
from unittest.mock import patch
from pipeline import analyze, chunks, normalize_batches, read_pdf, extract_bounded, OutputLimitError, ollama_extract, source_numbers, structured_part6, extract_source_exercises
try:
    import pymupdf
except ImportError:
    pymupdf = None


def question(part=5, order=101, answer="A", evidence="101. A"):
    return {"part": part, "order": order, "content": "The meeting ___ at noon.",
            "options": [{"key": key, "text": key + " option"} for key in ("ABC" if part == 2 else "ABCD")],
            "correctAnswer": answer, "answerEvidence": evidence, "explanation": ""}


def batch(questions, groups=None):
    return {"questions": questions, "groups": groups or [], "pages": [1, 2]}


class PipelineTest(unittest.TestCase):
    def test_ollama_schema_bounds_the_requested_questions_and_keeps_group_numbers_flexible(self):
        from io import BytesIO
        response=BytesIO(json.dumps({'message':{'content':'{"questions":[],"groups":[]}'}}).encode())
        with patch('pipeline.urllib.request.urlopen',return_value=response) as request:
            extract_bounded('Source data with another question 199.',{161,162},ollama_extract,lambda:None)
        payload=json.loads(request.call_args.args[0].data)
        schema=payload['format']['properties']
        self.assertEqual(schema['questions']['maxItems'],2)
        self.assertEqual(schema['questions']['items']['properties']['order']['enum'],[161,162])
        self.assertEqual(schema['questions']['items']['properties']['options']['maxItems'],4)
        self.assertEqual(schema['groups']['maxItems'],2)
        self.assertNotIn('enum',schema['groups']['items']['properties']['questionNumbers']['items'])
        self.assertEqual(payload['keep_alive'],'5m')
        self.assertNotIn('maxItems',__import__('pipeline').SCHEMA['properties']['questions'])

    def test_temporary_ollama_500_retries_without_returning_partial_json(self):
        from io import BytesIO
        from urllib.error import HTTPError
        error=HTTPError('http://ollama/api/chat',500,'Internal error',{},BytesIO(b'{"error":"runner disconnected"}'))
        result={'questions':[question()], 'groups':[]}
        response=BytesIO(json.dumps({'done_reason':'stop','message':{'content':json.dumps(result)}}).encode())
        with patch('pipeline.urllib.request.urlopen',side_effect=[error,response]) as request, patch('pipeline.time.sleep') as pause:
            self.assertEqual(ollama_extract('Source'),result)
        self.assertEqual(request.call_count,2)
        pause.assert_called_once_with(1)

    def test_persistent_500_has_bounded_retries_and_preserves_server_reason(self):
        from io import BytesIO
        from urllib.error import HTTPError
        errors=[HTTPError('http://ollama/api/chat',500,'Internal error',{},BytesIO(b'{"error":"runner disconnected"}')) for _ in range(3)]
        with patch('pipeline.urllib.request.urlopen',side_effect=errors) as request, patch('pipeline.time.sleep'):
            with self.assertRaisesRegex(ValueError,'runner disconnected.*3'):
                ollama_extract('Source')
        self.assertEqual(request.call_count,3)

    def test_invalid_request_is_not_retried(self):
        from io import BytesIO
        from urllib.error import HTTPError
        error=HTTPError('http://ollama/api/chat',400,'Invalid request',{},BytesIO(b'{"error":"invalid schema"}'))
        with patch('pipeline.urllib.request.urlopen',side_effect=error) as request, patch('pipeline.time.sleep') as pause:
            with self.assertRaisesRegex(ValueError,'invalid schema'):
                ollama_extract('Source')
        self.assertEqual(request.call_count,1)
        pause.assert_not_called()

    def test_part_seven_printed_exercises_are_extracted_as_separate_groups(self):
        source = 'Questions 151-152 refer to the following notice.\nNotice text.\nQuestions 153-155 refer to the following e-mail.\nEmail text.'
        calls = []
        def extract(text):
            group = json.loads(re.search(r'ONE SOURCE EXERCISE: (\[[^\n]+?\])', text)[1])
            calls.append(group)
            self.assertIn('Notice text.' if group[0]==151 else 'Email text.', text)
            self.assertNotIn('Email text.' if group[0]==151 else 'Notice text.', text)
            return {'questions':[question(7,n) for n in group], 'groups':[{
                'part':7, 'questionNumbers':group, 'passages':[{'type':'TEXT','content':'Source exercise'}]
            }]}
        result = extract_source_exercises(source, set(range(151,156)), source, extract, lambda: None, standard_toeic=True)
        self.assertEqual(calls, [[151,152],[153,154,155]])
        self.assertEqual([g['questionNumbers'] for g in result['groups']], calls)
        wrong = extract_source_exercises(source, {151,152}, source, lambda text: {
            'questions':[], 'groups':[{'part':7,'questionNumbers':list(range(151,156)),'passages':[]}]
        }, lambda: None, standard_toeic=True)
        self.assertEqual(wrong['groups'], [])
        self.assertTrue(wrong['warnings'])

    def test_structured_part_six_copies_options_and_keeps_one_source_passage(self):
        text = 'PART 6\n[SHARED PASSAGE]\nQuestions 143-146 refer to the following letter.\nOriginal full-width letter with four blanks.\n[LEFT COLUMN]\n'
        for n in (143,144):
            text += f'{n}.\n(A) First\n(B) Second\n(C) Third\n(D) Fourth\n'
        text += '[RIGHT COLUMN]\n145.\n(A) If not\n(B) By comparison\n(C) Otherwise\n(D) Indeed\n446.\n(A) receives\n(B) is receiving\n(C) had received\n(D) had to receive\nGO ON TO THE NEXT PAGE\nTEST 1\n26\n'
        page = {'number':8, 'text':text}
        parsed = structured_part6(page)
        self.assertEqual([q['order'] for q in parsed['questions']], [143,144,145,146])
        self.assertEqual(parsed['groups'][0]['passages'][0]['content'], 'Original full-width letter with four blanks.')
        self.assertEqual(parsed['questions'][-1]['options'][-1]['text'], 'had to receive')
        self.assertTrue(all(q['correctAnswer'] == '' for q in parsed['questions']))
        self.assertTrue(any('446' in w for w in parsed['warnings']))
        self.assertIsNone(structured_part6({'number':8,'text':text.replace('145.','143.')}))
        self.assertIsNone(structured_part6({'number':8,'text':text.replace('(D) Indeed','Indeed')}))

    def test_part_six_standalone_labels_and_group_headers_are_not_omitted(self):
        text = 'Questions 139-142 refer to the following e-mail.\n139.\n(A) It\n140.\n(A) A complete sentence.\n141.\n(A) Also\n142.\n(A) specifically\n'
        self.assertEqual(source_numbers(text), {139,140,141,142})
        self.assertEqual(source_numbers('Questions 143–146 refer to the following letter.'), {143,144,145,146})
        self.assertEqual(source_numbers('Questions 200-101 refer to the following text.'), set())

    def test_truncated_ollama_json_is_signalled_for_automatic_retry(self):
        from io import BytesIO
        response = BytesIO(json.dumps({'done_reason': 'length', 'message': {'content': '{incomplete'}}).encode())
        with patch('pipeline.urllib.request.urlopen', return_value=response):
            with self.assertRaises(OutputLimitError):
                ollama_extract('Source question text')

    def test_large_windows_use_small_output_scopes_without_losing_source(self):
        calls = []
        def extract(text):
            numbers = json.loads(re.search(r'ACTIVE QUESTION NUMBERS: (\[[^\n]+?\])', text)[1])
            calls.append((text, numbers))
            return {'questions': [question(order=n) for n in numbers], 'groups': []}
        result = extract_bounded('FULL SHARED PASSAGE AND SOURCE', range(101, 131), extract, lambda: None)
        self.assertEqual([q['order'] for q in result['questions']], list(range(101, 131)))
        self.assertTrue(all(len(numbers) <= 8 and 'FULL SHARED PASSAGE AND SOURCE' in text for text, numbers in calls))

    def test_output_limit_splits_again_and_preserves_complete_shared_group(self):
        calls = []
        group = {'part': 7, 'questionNumbers': [147,148,149,150], 'passages': [{'type': 'TEXT', 'content': 'Full original passage'}]}
        def extract(text):
            numbers = json.loads(re.search(r'ACTIVE QUESTION NUMBERS: (\[[^\n]+?\])', text)[1])
            calls.append(numbers)
            if len(numbers) > 2:
                raise OutputLimitError('length')
            # Simulate a model that also returns a question outside its scope.
            return {'questions': [question(7, n) for n in numbers + [199]], 'groups': [copy.deepcopy(group)]}
        result = extract_bounded('Full original passage', range(147,151), extract, lambda: None)
        self.assertEqual(calls, [[147,148,149,150],[147,148],[149,150]])
        self.assertEqual([q['order'] for q in result['questions']], [147,148,149,150])
        self.assertTrue(all(g['questionNumbers'] == [147,148,149,150] for g in result['groups']))
        self.assertEqual(normalize_batches([{**result, 'pages':[1]}], '')['total'], 4)

    def test_single_question_limit_returns_visible_omission_and_other_errors_propagate(self):
        def limit(text):
            raise OutputLimitError('length')
        result = extract_bounded('Original source', [101], limit, lambda: None)
        self.assertEqual(result['questions'], [])
        self.assertIn('101', result['warnings'][0])
        with self.assertRaisesRegex(ValueError, 'offline'):
            extract_bounded('Original source', [101], lambda text: (_ for _ in ()).throw(ValueError('offline')), lambda: None)

    def test_passage_only_retries_do_not_add_model_generated_questions(self):
        result = extract_bounded('Original source', [147], lambda text: {
            'questions': [question(7,147)], 'groups': [{'part':7,'questionNumbers':[147,148], 'passages':[]}]
        }, lambda: None, groups_only=True)
        self.assertEqual(result['questions'], [])
        self.assertEqual(result['groups'][0]['questionNumbers'], [147,148])

    @unittest.skipUnless(pymupdf, "PyMuPDF required for real PDF tests")
    def test_real_pdf_text_extraction_and_original_page_numbers(self):
        with pymupdf.open() as doc:
            for number in (1, 2):
                page = doc.new_page()
                page.insert_text((50, 50), f"Part 5. Page {number}. 101. The meeting starts at noon. A. starts B. start C. starting D. started")
            data = doc.tobytes()
        pages = read_pdf(data, "Exam")
        self.assertEqual([p["number"] for p in pages], [1, 2])
        self.assertIn("The meeting starts", pages[0]["text"])

    @unittest.skipUnless(pymupdf, "PyMuPDF required for real PDF tests")
    def test_blank_pdf_and_fake_file_are_rejected(self):
        with pymupdf.open() as doc:
            doc.new_page()
            blank = doc.tobytes()
        for data in (b"fake.pdf", blank):
            with self.assertRaises(ValueError):
                read_pdf(data, "Exam")

    def test_only_source_backed_answers_are_kept(self):
        result = normalize_batches([batch([question()])], "101. A")
        self.assertEqual(result["parts"][0]["questions"][0]["correctAnswer"], "A")
        for evidence in ("", "101. A", "102. A"):
            with self.subTest(evidence=evidence):
                result = normalize_batches([batch([question(evidence=evidence)])], "102. A")
                self.assertEqual(result["parts"][0]["questions"][0]["correctAnswer"], "")

    def test_overlapping_questions_are_deduplicated_and_answer_completed(self):
        first = question(answer="", evidence="")
        result = normalize_batches([batch([first]), batch([question()])], "101. A")
        self.assertEqual(result["total"], 1)
        self.assertEqual(result["parts"][0]["questions"][0]["correctAnswer"], "A")

    def test_conflicting_question_text_is_visible_for_review(self):
        second = question()
        second["content"] = "Different text"
        result = normalize_batches([batch([question()]), batch([second])], "101. A")
        self.assertEqual(result["total"], 2)
        self.assertTrue(result["warnings"])

    def test_conflicting_answer_is_cleared(self):
        result = normalize_batches([batch([question()]), batch([question(answer="B", evidence="101. B")])], "101. A\n101. B")
        self.assertEqual(result["parts"][0]["questions"][0]["correctAnswer"], "")
        self.assertTrue(result["warnings"])

    def test_shared_passage_across_batches_and_three_options_part2(self):
        group = {"part": 7, "questionNumbers": [147, 148], "title": "Notice",
                 "passages": [{"type": "NOTICE", "content": "Office closed Friday."}]}
        result = normalize_batches([
            batch([question(7, 147)], [copy.deepcopy(group)]),
            batch([question(7, 148), question(2, 7)], [copy.deepcopy(group)]),
        ], "")
        part2, part7 = result["parts"]
        self.assertEqual(len(part2["questions"][0]["options"]), 3)
        self.assertEqual(len(part7["groups"]), 1)
        self.assertEqual(part7["questions"][0]["passageGroupTempId"], part7["questions"][1]["passageGroupTempId"])

    def test_missing_options_are_not_invented(self):
        q = question()
        q["options"] = q["options"][:1]
        result = normalize_batches([batch([q])], "")
        self.assertEqual(result["parts"][0]["questions"][0]["options"][1], {"key": "B", "text": ""})

    def test_bad_part_or_no_questions_fails(self):
        for questions in ([], [question(part=8)]):
            with self.assertRaises(ValueError):
                normalize_batches([batch(questions)], "")

    def test_windows_cover_all_pages_and_overlap(self):
        pages = [{"number": n, "text": "x" * 100} for n in range(1, 12)]
        windows = list(chunks(pages))
        self.assertEqual({p["number"] for w in windows for p in w}, set(range(1, 12)))
        for a, b in zip(windows, windows[1:]):
            self.assertEqual(a[-1], b[0])

    def test_answer_pdf_reaches_each_model_call(self):
        pages = [{"number": n, "text": "Exam text " * 10} for n in range(1, 7)]
        calls = []
        def extract(text):
            calls.append(text)
            return {"questions": [question()], "groups": []}
        with patch("pipeline.read_pdf", side_effect=[pages, [{"number": 1, "text": "101. A"}]]):
            result = analyze(b"pdf", b"key", lambda *args: None, extract)
        self.assertEqual(result["total"], 1)
        self.assertTrue(all("101. A" in text for text in calls))
        self.assertGreater(len(calls), 1)

    def test_missing_source_question_is_reported_and_key_rows_are_excluded(self):
        pages = [{"number": 1, "text": "101. The meeting starts at noon.\n102. Another question missing from output.\nANSWER KEY\n103. A"}]
        with patch("pipeline.read_pdf", return_value=pages):
            result = analyze(b"pdf", None, lambda *args: None, lambda text: {"questions": [question()], "groups": []})
        warning = next(w for w in result["warnings"] if "102" in w)
        self.assertNotIn("103", warning)

    def test_missing_questions_are_retried_with_the_original_source(self):
        pages = [{"number": 1, "text": "101. The meeting starts at noon.\n102. Please send the report by Friday."}]
        calls = []
        def extract(text):
            calls.append(text)
            return {"questions": [question(order=101 if len(calls) == 1 else 102)], "groups": []}
        with patch("pipeline.read_pdf", return_value=pages):
            result = analyze(b"pdf", None, lambda *args: None, extract)
        self.assertEqual(result["total"], 2)
        self.assertIn("previous pass missed", calls[1])
        self.assertIn("Please send the report", calls[1])

    def test_missing_passage_groups_trigger_a_focused_pass(self):
        pages = [{"number": 1, "text": "Questions 147-148 refer to the following notice.\nLibrary closed Friday.\n147. Why is the library closed?"}]
        calls = []
        def extract(text):
            calls.append(text)
            if len(calls) == 1:
                return {"questions": [question(7, 147), question(7, 148)], "groups": []}
            return {"questions": [], "groups": [{"part": 7, "questionNumbers": [147, 148], "title": "Notice", "passages": [{"type": "NOTICE", "content": "Library closed Friday."}]}]}
        with patch("pipeline.read_pdf", return_value=pages):
            result = analyze(b"pdf", None, lambda *args: None, extract)
        self.assertIn("PASSAGE GROUP EXTRACTION ONLY", calls[1])
        self.assertTrue(result["parts"][0]["questions"][0]["passageGroupTempId"])


if __name__ == "__main__":
    unittest.main()
