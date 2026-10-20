import unittest
import pymupdf
from bundle import extract_answer_key, merge_section
from pipeline import canonical_toeic_parts, normalize_batches


def key_pdf(section='LC', incomplete=False):
    first = 1 if section == 'LC' else 101
    with pymupdf.open() as doc:
        p = doc.new_page(width=595, height=800)
        for test, x, y, answer in ((1, 40, 60, 'A'), (2, 335, 60, 'B'), (3, 40, 420, 'C'), (4, 335, 420, 'D')):
            p.insert_text((x+40,y),f'TEST {test}',fontsize=14)
            for row in range(20):
                numbers = range(first + row*5, first + row*5+5)
                text = '   '.join(f'{n} ({answer})' for n in numbers if not incomplete or n != first+99)
                p.insert_text((x, y+20+row*14),text,fontsize=8)
        return doc.tobytes()


class BundleTest(unittest.TestCase):
    def test_reading_page_footer_is_not_a_part_two_question(self):
        batches=[{'pages':[18], 'groups':[], 'questions':[
            {'part':2,'order':30,'content':'Page footer','options':[{'key':k,'text':k} for k in 'ABCD']},
            {'part':2,'order':151,'content':'Real Reading question','options':[{'key':k,'text':k} for k in 'ABCD']},
        ]}]
        draft=normalize_batches(canonical_toeic_parts(batches,(101,200)), '')
        self.assertEqual([q['order'] for p in draft['parts'] for q in p['questions']], [151])
        self.assertTrue(batches[0]['warnings'])

    def test_standard_ranges_override_model_part_labels(self):
        numbers = (1, 6, 7, 31, 32, 70, 71, 100, 101, 130, 131, 146, 147, 200)
        batches = [{'questions': [{'order': n, 'part': 2} for n in numbers], 'groups': []}]
        canonical_toeic_parts(batches)
        self.assertEqual([q['part'] for q in batches[0]['questions']], [1,1,2,2,3,3,4,4,5,5,6,6,7,7])

    def test_invalid_numbers_and_cross_part_groups_remain_visible_as_warnings(self):
        batches = [{'questions': [{'order': 201}, {'order': 151}], 'groups': [
            {'questionNumbers': [130, 131]}, {'questionNumbers': [201]},
            {'questionNumbers': []}, {'questionNumbers': [151, 152], 'part': 3},
        ]}]
        canonical_toeic_parts(batches)
        self.assertEqual([q['order'] for q in batches[0]['questions']], [151])
        self.assertEqual(len(batches[0]['warnings']), 4)
        self.assertEqual(batches[0]['groups'], [{'questionNumbers': [151, 152], 'part': 7}])

    def test_reading_question_cannot_be_misclassified_as_three_option_part_two(self):
        batches=[{'pages':[1], 'groups':[], 'questions':[{'part':2,'order':151,'content':'A printed Reading question','correctAnswer':'','answerEvidence':'','explanation':'','options':[{'key':key,'text':key} for key in 'ABCD']}]}]
        draft=normalize_batches(canonical_toeic_parts(batches),'')
        self.assertEqual(draft['parts'][0]['part'],7)
        self.assertEqual(len(draft['parts'][0]['questions'][0]['options']),4)
    def test_spatial_keys_do_not_mix_adjacent_tests_or_quadrants(self):
        pdf = key_pdf()
        for test, answer in ((1,'A'),(2,'B'),(3,'C'),(4,'D')):
            with self.subTest(test=test):
                key=extract_answer_key(pdf,test,'LC')
                self.assertEqual(len(key['answers']),100)
                self.assertEqual(set(key['answers'].values()),{answer})
                self.assertEqual(key['pages'],[1])

    def test_reading_uses_101_through_200(self):
        key=extract_answer_key(key_pdf('RC'),1,'RC')
        self.assertEqual(set(key['answers']),set(range(101,201)))

    def test_missing_test_or_incomplete_key_blocks_import(self):
        for pdf,test in ((key_pdf(),10),(key_pdf(incomplete=True),1)):
            with self.assertRaises(ValueError):
                extract_answer_key(pdf,test,'LC')

    def test_selected_key_overrides_ai_answers_and_retains_missing_source_slots(self):
        result={'parts':[{'part':3,'groups':[{'passages':[{'content':'Invented dialogue must not survive'}]}],'passages':[],'questions':[{'order':32,'content':'Printed question','correctAnswer':'D'}]}]}
        key=extract_answer_key(key_pdf(),1,'LC')
        summary=merge_section(result,key,[{'number':1,'ocr':True,'photos':{'1':'http://localhost/photo-1.jpg'}}],'LC')
        self.assertEqual(summary['detected'],1)
        self.assertEqual(result['total'],100)
        q32=next(q for p in result['parts'] for q in p['questions'] if q['order']==32)
        self.assertEqual(q32['correctAnswer'],'A')
        self.assertTrue(all(not p['content'] for part in result['parts'] for g in part['groups'] for p in g['passages']))
        q1=result['parts'][0]['questions'][0]
        self.assertEqual(q1['imageUrl'],'http://localhost/photo-1.jpg')
        self.assertTrue(q1['needsSource'])
        self.assertEqual(q1['content'],'')

    def test_wrong_section_does_not_silently_mix_questions(self):
        with self.assertRaises(ValueError):
            merge_section({'parts':[{'part':5,'questions':[]}]},extract_answer_key(key_pdf(),1,'LC'),[],'LC')

    def test_overlapping_ai_windows_produce_one_slot_per_source_number(self):
        result={'parts':[{'part':3,'groups':[],'passages':[],'questions':[
            {'order':32,'content':'A question','correctAnswer':'D','options':[],'sourcePages':[1]},
            {'order':32,'content':'A longer recognized question','correctAnswer':'D','options':[],'sourcePages':[2]},
        ]}], 'warnings':[]}
        summary=merge_section(result,extract_answer_key(key_pdf(),1,'LC'),[],'LC')
        self.assertEqual(result['total'],100)
        self.assertEqual(summary['detected'],1)
        self.assertEqual(summary['conflicts'],[32])
        q=next(q for p in result['parts'] for q in p['questions'] if q['order']==32)
        self.assertEqual(q['sourcePages'],[1,2])


if __name__=='__main__':
    unittest.main()
