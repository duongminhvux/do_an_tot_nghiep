import unittest
from app import segments,parse_subtitles,Preview,preview

class CaptionsTests(unittest.TestCase):
    def test_srt_vtt_and_html(self):
        for header in ['', 'WEBVTT\n\n']:
            text=header+'1\n00:00:01.200 --> 00:00:03.400\nHello &amp; <b>welcome.</b>\n\n2\n00:00:04,000 --> 00:00:05,500\n[Music]\n'
            result=segments(parse_subtitles(text));self.assertEqual(result,[{'order':0,'text':'Hello & welcome.','startMs':1200,'endMs':3400}])
    def test_merge_fragments_and_clip(self):
        cues=[{'start':1,'duration':1,'text':'Welcome to'},{'start':2,'duration':2,'text':'the lesson.'},{'start':5,'duration':1,'text':'Listen carefully.'}]
        self.assertEqual(len(segments(cues)),2)
        self.assertEqual(segments(cues,5,6)[0]['startMs'],5000)
    def test_bad_timestamp_and_limits(self):
        with self.assertRaises(ValueError):parse_subtitles('00:00:04,000 --> 00:00:01,000\nWrong\n')
        with self.assertRaises(ValueError):segments([{'start':i*3,'duration':1,'text':'Sentence.'} for i in range(201)])
        with self.assertRaises(ValueError):segments([],0)
    def test_youtube_display_durations_do_not_overlap_speech_segments(self):
        result=segments([{'start':0,'duration':8,'text':'First sentence.'},{'start':4,'duration':8,'text':'Second sentence.'},{'start':9,'duration':3,'text':'Third sentence.'}])
        self.assertEqual(result[0]['endMs'],4000)
        self.assertTrue(all(a['endMs']<=b['startMs'] for a,b in zip(result,result[1:])))
    def test_manual_fallback_without_network(self):
        result=preview(Preview(videoId='2Yk1M6URsCU',subtitleText='00:00:01,000 --> 00:00:02,000\nGood morning.\n'))
        self.assertEqual(result['source'],'uploaded_subtitles');self.assertEqual(result['segments'][0]['text'],'Good morning.')

if __name__=='__main__':unittest.main()
