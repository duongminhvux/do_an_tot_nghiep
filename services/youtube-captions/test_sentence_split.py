import unittest
from sentence_split import sentence_segments,json3_cues,align_sentences,model_ends,canonical,preserved_prefix

class SentenceSplitTests(unittest.TestCase):
    def test_carries_original_tail_instead_of_using_model_invented_words(self):
        result=preserved_prefix('Hello everybody I have many',{'sentences':['Hello everybody.','I have many assignments.'],'unfinished':''})
        self.assertEqual(result,{'sentences':['Hello everybody.'],'unfinished':'I have many'})
        self.assertEqual(align_sentences('Hello everybody I have many',result),[2])
        self.assertIsNone(preserved_prefix('Hello everybody',{'sentences':['Goodbye everybody.'],'unfinished':''}))
    def test_does_not_force_a_split_at_twelve_seconds_or_thirty_words(self):
        text=' '.join(['word']*45)+'.'
        result=sentence_segments([{'text':text,'start':0,'duration':28}])
        self.assertEqual(len(result),1)
        self.assertEqual(result[0]['text'],text)
        self.assertEqual(result[0]['endMs'],28000)

    def test_splits_complete_sentences_inside_one_subtitle_cue(self):
        result=sentence_segments([{'text':'Hello everybody. Welcome to the lesson.','start':0,'duration':6}])
        self.assertEqual([s['text'] for s in result],['Hello everybody.','Welcome to the lesson.'])
        self.assertEqual(result[0]['endMs'],result[1]['startMs'])

    def test_keeps_word_timestamps_from_youtube_json3(self):
        cues=json3_cues({'events':[{'tStartMs':0,'dDurationMs':5000,'segs':[{'utf8':'hey'},{'utf8':' everybody','tOffsetMs':450},{'utf8':' welcome','tOffsetMs':960}]},{'tStartMs':1500,'dDurationMs':1000,'segs':[{'utf8':' back.','tOffsetMs':0}]}]})
        result=sentence_segments(cues,restore=True,splitter=lambda text,final:{'sentences':['hey everybody.','welcome back.'],'unfinished':''})
        self.assertEqual(result[0]['startMs'],0)
        self.assertEqual(result[0]['endMs'],960)
        self.assertEqual(result[1]['startMs'],960)
        self.assertEqual(result[1]['endMs'],2500)

    def test_refuses_model_additions_deletions_and_reordering(self):
        for output in [{'sentences':['you are ready.'],'unfinished':''},{'sentences':['you.'],'unfinished':''},{'sentences':['ready you.'],'unfinished':''}]:
            with self.assertRaises(ValueError):align_sentences('you ready',output)
        self.assertEqual(align_sentences('you ready',{'sentences':['You ready?'],'unfinished':''}),[2])

    def test_carries_an_unfinished_sentence_into_the_next_model_window(self):
        words=[{'text':f'w{i}','startMs':i*100,'endMs':(i+1)*100} for i in range(230)]
        batches=[]
        def split(text,final):
            parts=text.split();batches.append(parts)
            if final:return {'sentences':[text],'unfinished':''}
            return {'sentences':[' '.join(parts[:210])],'unfinished':' '.join(parts[210:])}
        self.assertEqual(model_ends(words,split),[210,230])
        self.assertEqual(batches[1][0],'w210')

    def test_does_not_separate_a_dependent_clause_from_its_sentence(self):
        text="this is a topic that I really like because I've always liked going to the zoo I'm from San Diego"
        cues=[{'text':text,'start':0,'duration':18}]
        output=sentence_segments(cues,restore=True,splitter=lambda text,final:{'sentences':["this is a topic that I really like because I've always liked going to the zoo."], 'unfinished':"I'm from San Diego"})
        self.assertTrue(output[0]['text'].endswith('the zoo'))
        self.assertEqual(canonical(' '.join(s['text'] for s in output)),canonical(text))
        repaired=sentence_segments(cues,restore=True,splitter=lambda text,final:{'sentences':["this is a topic that I really like.","because I've always liked going to the zoo."], 'unfinished':"I'm from San Diego"})
        self.assertEqual(repaired[0]['text'],output[0]['text'])

if __name__=='__main__':unittest.main()
