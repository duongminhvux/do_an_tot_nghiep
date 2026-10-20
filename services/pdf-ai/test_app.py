import json
import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi import HTTPException
import app


class JobPersistenceTest(unittest.TestCase):
    def setUp(self):
        self.directory=tempfile.TemporaryDirectory()
        self.environment=patch.dict(os.environ,{'PDF_AI_ASSET_DIR':self.directory.name})
        self.environment.start()
        self.job={'id':'70d419fd-3545-4032-afe4-8075b736b958','examId':'bundle','state':'completed','finishedAt':time.time(),'result':{'total':200}}
        app.jobs.clear()

    def tearDown(self):
        self.environment.stop()
        self.directory.cleanup()

    def test_completed_result_survives_a_service_restart(self):
        app.persist_job(self.job)
        self.assertEqual(app.get_job(self.job['id'],'bundle'),self.job)

    def test_saved_job_still_checks_exam_scope(self):
        app.persist_job(self.job)
        with self.assertRaises(HTTPException) as error:
            app.get_job(self.job['id'],'another-exam')
        self.assertEqual(error.exception.status_code,404)

    def test_existing_script_draft_returns_letter_only_choices_without_mutating_snapshot(self):
        self.job['result'].update(listeningScript={'questions':100},parts=[{'part':1,'questions':[{'content':'','correctAnswer':'B','options':[{'key':k,'text':f'Statement {k}'} for k in 'ABCD']}]}])
        app.jobs[self.job['id']]=self.job
        result=app.get_job(self.job['id'],'bundle')['result']
        q=result['parts'][0]['questions'][0]
        self.assertIn('(A) Statement A',q['content'])
        self.assertTrue(all(o['text']=='' for o in q['options']))
        self.assertEqual(q['correctAnswer'],'B')
        self.assertEqual(self.job['result']['parts'][0]['questions'][0]['content'],'')

    def test_expired_results_and_corrupt_files_are_not_loaded(self):
        self.job['finishedAt']=time.time()-app.TTL-1
        app.persist_job(self.job)
        with self.assertRaises(HTTPException):
            app.get_job(self.job['id'],'bundle')
        Path(self.directory.name,self.job['id'],'job-state.json').write_text('{bad json',encoding='utf8')
        with self.assertRaises(HTTPException):
            app.get_job(self.job['id'],'bundle')

    def test_legacy_script_summary_lists_exact_missing_numbers_without_mutating_job(self):
        missing = {57, 81, 88, 94}
        self.job['result'].update(listeningScript={'questions':96}, parts=[{'part':3,'questions':[
            {'order':n,'scriptPages':[1] if n not in missing else [],'options':[]} for n in range(1,101)
        ]}])
        app.jobs[self.job['id']] = self.job
        response = app.get_job(self.job['id'],'bundle')
        self.assertEqual(response['result']['listeningScript']['missingQuestions'], sorted(missing))
        self.assertNotIn('missingQuestions', self.job['result']['listeningScript'])

    def test_unfinished_or_invalid_ids_do_not_restore_stale_running_jobs(self):
        self.job['state']='running'
        app.persist_job(self.job)
        with self.assertRaises(HTTPException):
            app.get_job(self.job['id'],'bundle')
        with self.assertRaises(HTTPException):
            app.get_job('../job-state','bundle')


if __name__=='__main__':
    unittest.main()
