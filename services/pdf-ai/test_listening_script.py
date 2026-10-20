import unittest
from unittest.mock import patch

import pymupdf

from listening_script import read_listening_script, merge_listening_script, parse_question, normalize_listening_choices, script_lines
from bundle import merge_section


def script_pdf(rotation=0):
    with pymupdf.open() as doc:
        p = doc.new_page(width=600, height=800)
        for x,y,text in [(40,45,'TEST 1'), (40,90,'7'), (40,115,'W-Br Where is the meeting?'),
                         (40,140,'(A) At the office.'), (40,160,'(B) Tomorrow morning.'), (40,180,'(C) Ask the manager.'),
                         (40,205,'|||| Translation and explanation'),
                         (320,90,'32-34'), (320,115,'W-Am Welcome to our office.'), (320,140,'M-Br Thank you for inviting me.'),
                         (320,170,'|||| Translation'), (320,220,'32'), (320,245,'What is discussed?'),
                         (320,270,'(A) An office'), (320,290,'(B) A flight'), (320,310,'(C) A receipt'), (320,330,'(D) A workshop')]:
            p.insert_text((x,y),text,fontsize=9)
        # Rotate the actual content together with the page to emulate a visually
        # upright scan whose underlying coordinates have a 180-degree rotation.
        if rotation:
            p.set_rotation(rotation)
            p.remove_rotation()
            p.set_rotation(rotation)
        return doc.tobytes()


class ListeningScriptTest(unittest.TestCase):
    def test_graphic_question_accepts_clock_choices(self):
        lines = [{'x':40,'text':'Look at the graphic. When is the train scheduled to arrive?'}]
        choices = ['At 10:45 A.M.', 'At 12:05 P.M.', 'At 1:00 P.M.', 'At 1:30 P.M.']
        lines += [{'x':40,'text':f'({key}) {text}'} for key,text in zip('ABCD',choices)]
        self.assertEqual([o['text'] for o in parse_question(lines,97)['options']],choices)

    def test_video_badge_cannot_merge_into_question_number(self):
        class Page:
            rotation=0
            rect=pymupdf.Rect(0,0,600,800)
            def get_text(self, kind='', **kwargs):
                if kind!='words': return 'A native text layer with English words in the Listening workbook.'
                return [(460,386,520,402,'OXIEIS)',33,0,0), (302,387,315,401,'22',33,1,0),
                        (302,415,520,427,'The battery will be solar powered, right?',34,0,0)]
        for layout in (False,True):
            lines,_=script_lines(Page(),layout_repair=layout)
            self.assertEqual(lines[0]['text'],'22')
        # Answer tables and normal prose must not be reduced to a heading.
        from listening_script import is_question_badge
        self.assertFalse(is_question_badge({'text':'22','right':315},{'text':'(A)','x':320}))
        self.assertFalse(is_question_badge({'text':'22','right':315},{'text':'What should we bring?','x':460}))

    def test_graphic_question_accepts_numeric_choices(self):
        lines = [{'x': 40, 'text': 'Look at the graphic. Which quantity needs to be changed?'}]
        lines += [{'x': 40, 'text': f'({key}) {value}'} for key, value in zip('ABCD', ['20', '35', '15', '10'])]
        self.assertEqual([o['text'] for o in parse_question(lines, 63)['options']], ['20', '35', '15', '10'])

    def test_speaker_annotation_ocr_artifacts_are_not_question_content(self):
        lines = [{'x': 280, 'text': 'N-Br What should I bring?'}]
        lines += [{'x': 280, 'text': 'M-Au_ (A) Just your laptop.'},
                  {'x': 308, 'text': '(B) In the lobby.'}, {'x': 308, 'text': '(C) Tomorrow.'}]
        q = parse_question(lines, 10)
        self.assertEqual(q['content'], 'What should I bring?')
        self.assertEqual(q['options'][0]['text'], 'Just your laptop.')

    def test_right_column_heading_and_option_fragments_near_midpoint_stay_together(self):
        class Page:
            rotation = 0
            rect = pymupdf.Rect(0, 0, 560, 800)
            def get_text(self, kind='', **kwargs):
                if kind != 'words': return 'A valid native text layer with sufficiently many English characters.'
                return [(276,50,289,64,'67',0,0,0),
                        (276,68,292,79,'Look',1,0,0), (298,67,520,78,'at the graphic. Which flowers?',2,0,0),
                        (276,92,289,104,'(A)',3,0,0), (294,89,325,101,'Lilies',4,0,0),
                        (276,115,289,127,'(B)',5,0,0), (294,112,325,124,'Tulips',6,0,0),
                        (276,138,289,150,'(C)',7,0,0), (294,135,325,147,'Roses',8,0,0),
                        (276,161,289,173,'(D)',9,0,0), (294,158,335,170,'Orchids',10,0,0)]
        lines, _ = script_lines(Page(), layout_repair=True)
        self.assertEqual(lines[0]['text'], '67')
        q = parse_question(lines[1:], 67)
        self.assertEqual(q['content'], 'Look at the graphic. Which flowers?')
        self.assertEqual([o['text'] for o in q['options']], ['Lilies', 'Tulips', 'Roses', 'Orchids'])

    def test_words_from_shared_pdf_line_are_split_into_their_actual_columns(self):
        class Page:
            rotation = 0
            rect = pymupdf.Rect(0,0,600,800)
            def get_text(self, kind='', **kwargs):
                if kind != 'words':
                    return 'Native English text layer of a two-column Listening script workbook.'
                words = []
                for i,(left,right) in enumerate(zip(
                    ['17','W-Am Would you reschedule my haircut?','(A) Fully booked.','(B) Open the window.','(C) The grass needs cutting.'],
                    ['20','W-Am Where is the gathering?','(A) By the fountain.','(B) It is cold.','(C) Print in color.'])):
                    words.extend([(40,60+i*25,270,72+i*25,left,0,i,0),(330,60+i*25,550,72+i*25,right,0,i,1)])
                # Marginal noise must not interrupt the choices.
                words.append((590,126,596,138,'m',1,0,0))
                return words
        lines, ocr = script_lines(Page())
        self.assertFalse(ocr)
        boundary = next(i for i,line in enumerate(lines) if line['text']=='20')
        self.assertEqual(parse_question(lines[1:boundary],17)['options'][2]['text'],'The grass needs cutting.')
        self.assertEqual(parse_question(lines[boundary+1:],20)['content'],'Where is the gathering?')

    def test_part_two_options_without_question_stem_remain_missing(self):
        self.assertIsNone(parse_question([{'x':40,'text':f'({k}) A valid response.'} for k in 'ABC'],17))

    def test_alternate_layout_only_fills_missing_scripts(self):
        with pymupdf.open() as doc:
            doc.new_page()
            data = doc.tobytes()
        def lines(page, repair_layer=False, force_ocr=False, layout_repair=False):
            result=[]
            for n in range(1,101):
                if (not layout_repair and n==17) or (layout_repair and n==18): continue
                result.extend([{'x':40,'text':str(n)}, {'x':40,'text':f'{"Alternate" if layout_repair else "Accepted"} question {n}?'}])
                result.extend({'x':40,'text':f'({k}) Response {k}.'} for k in ('ABC' if 7<=n<=31 else 'ABCD'))
            return result,force_ocr
        with patch('listening_script.script_lines',side_effect=lines):
            parsed=read_listening_script(data,8)
        self.assertEqual(len(parsed['questions']),100)
        self.assertEqual(parsed['questions'][17]['content'],'Alternate question 17?')
        self.assertEqual(parsed['questions'][18]['content'],'Accepted question 18?')

    def test_targeted_ocr_recovers_failed_headers_without_replacing_good_native_questions(self):
        with pymupdf.open() as doc:
            doc.new_page(); doc.new_page()
            data = doc.tobytes()
        calls=[]
        def lines(page, repair_layer=False, force_ocr=False, **kwargs):
            calls.append((page.number,force_ocr))
            output=[{'x':40,'text':'TEST 7'}]
            for n in (range(1,32) if page.number==0 else range(32,101)):
                if n==18 and not force_ocr: continue
                output.append({'x':40,'text':str(n)})
                output.append({'x':40,'text':('Repaired' if force_ocr else 'Original')+f' question number {n}?'})
                keys='ABC' if 7<=n<=31 else 'ABCD'
                for k in keys:
                    if n==17 and not force_ocr and k=='C':continue
                    output.append({'x':40,'text':f'({k}) Response {k}.'})
            return output,force_ocr
        with patch('listening_script.script_lines',side_effect=lines):
            result=read_listening_script(data,7)
        self.assertEqual(len(result['questions']),100)
        self.assertEqual(result['questions'][17]['content'],'Repaired question number 17?')
        self.assertEqual(result['questions'][18]['content'],'Repaired question number 18?')
        self.assertEqual(result['questions'][19]['content'],'Original question number 19?')
        self.assertIn((0,True),calls)
        def failing_ocr(page, repair_layer=False, force_ocr=False, **kwargs):
            if force_ocr: raise RuntimeError('OCR unavailable')
            return lines(page, repair_layer, False)
        with patch('listening_script.script_lines',side_effect=failing_ocr):
            partial = read_listening_script(data,7)
        self.assertEqual(len(partial['questions']),98)
        self.assertNotIn(17,partial['questions'])
        self.assertTrue(any('đánh dấu câu còn thiếu' in w for w in partial['warnings']))

    def test_numbered_script_reads_english_and_excludes_translation(self):
        result = read_listening_script(script_pdf(),1)
        self.assertEqual(result['questions'][7]['content'], 'Where is the meeting?')
        self.assertEqual([o['key'] for o in result['questions'][7]['options']],list('ABC'))
        self.assertEqual(result['questions'][7]['options'][-1]['text'], 'Ask the manager.')
        self.assertIn('Woman: Welcome to our office.',result['groups'][32]['content'])
        self.assertIn('Man: Thank you for inviting me.',result['groups'][32]['content'])
        self.assertNotIn('Translation',result['groups'][32]['content'])
        self.assertTrue(result['warnings'])  # Partial fixture must remain visible.

    def test_script_must_match_selected_test(self):
        with self.assertRaisesRegex(ValueError,'Test 1'):
            read_listening_script(script_pdf(),2)

    def test_invalid_pdf_is_rejected(self):
        with self.assertRaises(ValueError):
            read_listening_script(b'not PDF',1)

    def test_option_continuations_do_not_cross_into_translation_column(self):
        lines = [{'text':s,'x':x} for x,s in [(40,'Where do we go?'),(40,'(A) Visit the'),(52,'office tomorrow.'),(40,'(B) Go home.'),(40,'(C) Remain here.'),(320,'English-looking translation')]]
        q = parse_question(lines,7)
        self.assertEqual(q['options'][0]['text'],'Visit the office tomorrow.')
        self.assertEqual(q['options'][-1]['text'],'Remain here.')

    def test_merge_keeps_answer_key_photos_and_shared_links(self):
        script = read_listening_script(script_pdf(),1)
        result={'parts':[],'warnings':[]}
        key={'answers':{n:'B' for n in range(1,101)},'testNumber':1,'pages':[1]}
        merge_section(result,key,[{'number':1,'photos':{'1':'https://example.com/photo.jpg'}}],'LC')
        merge_listening_script(result,script)
        q7=result['parts'][1]['questions'][0]
        self.assertEqual(q7['correctAnswer'],'B')
        self.assertIn('Where is the meeting?\n(A) At the office.',q7['content'])
        self.assertEqual([o['text'] for o in q7['options']],['','',''])
        self.assertEqual(result['parts'][0]['questions'][0]['imageUrl'],'https://example.com/photo.jpg')
        group=result['parts'][2]['groups'][0]
        self.assertIn('Welcome to our office.',group['passages'][0]['content'])
        self.assertEqual(result['parts'][2]['questions'][0]['passageGroupTempId'],group['id'])
        self.assertTrue(result['parts'][1]['questions'][1]['needsSource'])

    def test_part_one_moves_all_statements_to_content_idempotently(self):
        q = {'content':'', 'correctAnswer':'B', 'options':[{'key':k,'text':f'Statement {k}.'} for k in 'ABCD']}
        reading = {'content':'Reading stem','options':[{'key':'A','text':'Reading option'}]}
        result = {'parts':[{'part':1,'questions':[q]}, {'part':5,'questions':[reading]}]}
        normalize_listening_choices(result)
        expected = '\n'.join(f'({k}) Statement {k}.' for k in 'ABCD')
        self.assertEqual(q['content'],expected)
        self.assertTrue(all(o['text']=='' for o in q['options']))
        self.assertEqual(q['correctAnswer'],'B')
        normalize_listening_choices(result)
        self.assertEqual(q['content'],expected)
        self.assertEqual(reading['options'][0]['text'],'Reading option')
