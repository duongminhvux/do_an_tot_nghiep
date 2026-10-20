import tempfile
import unittest
from pathlib import Path

import pymupdf
from listening_images import crop_listening_graphics, attach_listening_graphics


class ListeningGraphicsTest(unittest.TestCase):
    def test_two_columns_graphics_belong_to_distinct_three_question_groups(self):
        with tempfile.TemporaryDirectory() as directory, pymupdf.open() as doc:
            p=doc.new_page(width=600,height=800)
            p.insert_text((40,780),'56')  # OCR must not treat this footer as a question.
            for offset,first in ((0,65),(300,68)):
                p.draw_rect(pymupdf.Rect(offset+20,50,offset+250,140))
                p.insert_text((offset+30,80),'Original graphic')
                for index in range(3):
                    n=first+index
                    p.insert_text((offset+20,200+index*120),f'{n}. '+('Look at the graphic.' if index==1 else 'A question?'))
            crops=crop_listening_graphics(p,p.get_text('words'),Path(directory),'http://localhost/crops',1)
            self.assertEqual([c['numbers'] for c in crops],[[65,66,67],[68,69,70]])
            self.assertTrue(all(Path(directory,c['imageUrl'].split('/')[-1]).is_file() for c in crops))

    def test_plain_questions_do_not_create_illustrations(self):
        with tempfile.TemporaryDirectory() as directory,pymupdf.open() as doc:
            p=doc.new_page(width=600,height=800)
            for i,n in enumerate((32,33,34)):
                p.insert_text((40,100+i*150),f'{n}. What is discussed?')
            self.assertEqual(crop_listening_graphics(p,p.get_text('words'),Path(directory),'http://localhost/crops',1),[])

    def test_attachment_preserves_transcript_audio_questions_and_key(self):
        passage={'content':'Woman: Hello.\nMan: Welcome.','audioUrl':'http://localhost/audio.wav'}
        questions=[{'order':n,'content':'Look at the graphic.' if n==66 else 'What is discussed?', 'options':[{'key':'A','text':'Text choice'}],'correctAnswer':'A','passageGroupTempId':'g'} for n in (65,66,67)]
        result={'warnings':[],'parts':[{'part':3,'groups':[{'id':'g','passages':[passage]}],'questions':questions}]}
        pages=[{'graphics':[{'numbers':[65,66,67],'imageUrl':'http://localhost/table.jpg'}]}]
        attach_listening_graphics(result,pages)
        self.assertEqual(passage['imageUrl'],'http://localhost/table.jpg')
        self.assertEqual(passage['content'],'Woman: Hello.\nMan: Welcome.')
        self.assertEqual(passage['audioUrl'],'http://localhost/audio.wav')
        self.assertEqual(questions[1]['content'],'Look at the graphic.')
        self.assertEqual(questions[1]['correctAnswer'],'A')
        self.assertFalse(result['warnings'])

    def test_missing_graphic_is_visible_for_review_instead_of_guessed(self):
        result={'warnings':[],'parts':[{'part':4,'groups':[{'id':'g','passages':[{'content':'Original talk'}]}],
                'questions':[{'order':n,'content':'Look at the graphic.','passageGroupTempId':'g'} for n in (98,99,100)]}]}
        attach_listening_graphics(result,[])
        self.assertEqual(len(result['warnings']),1)
        self.assertNotIn('imageUrl',result['parts'][0]['groups'][0]['passages'][0])
        attach_listening_graphics(result,[{'graphics':[{'numbers':[98,99,100],'imageUrl':'http://localhost/graphic.jpg'}]}])
        self.assertEqual(result['warnings'],[])
