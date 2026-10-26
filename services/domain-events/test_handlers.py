import sys
import json
import unittest
from pathlib import Path
from uuid import uuid4
sys.path.insert(0,str(Path(__file__).parent))
from handlers import apply_event

class FakeCursor:
    def __init__(self, result=True):self.statements=[];self.result=result
    def execute(self,sql,args):self.statements.append((sql,args))
    def fetchone(self):return (uuid4(),) if self.result else None

class HandlerTests(unittest.TestCase):
    def test_credit_ledger_same_transaction_and_idempotent_insert(self):
        cursor=FakeCursor()
        user=str(uuid4());event=str(uuid4())
        result=apply_event(cursor,'learning',{'eventId':event,'type':'learning.activity.recorded.v1','payload':
            {'userId':user,'module':'TOEIC','type':'TOEIC_ATTEMPT','sourceKey':'toeic:'+event,'xp':15}})
        self.assertEqual(result,'learning-credit')
        self.assertEqual(len(cursor.statements),2)
        self.assertIn('ON CONFLICT(user_id,source_key) DO NOTHING',cursor.statements[0][0])
        self.assertIn('learning_credit_ledger',cursor.statements[1][0])
        self.assertEqual(cursor.statements[1][1][3],event)
        cursor=FakeCursor(result=False)
        self.assertEqual(apply_event(cursor,'learning',{'eventId':event,'type':'learning.activity.recorded.v1','payload':
            {'userId':user,'module':'TOEIC','type':'TOEIC_ATTEMPT','sourceKey':'toeic:'+event,'xp':15}}),'already-credited')
        self.assertEqual(len(cursor.statements),1)

    def test_profile_contract_rejects_sensitive_payload(self):
        cursor=FakeCursor()
        apply_event(cursor,'arena',{'type':'identity.user.created.v1','payload':
            {'userId':str(uuid4()),'username':'demo','passwordHash':'SENSITIVE'}})
        self.assertEqual(len(cursor.statements),1)
        self.assertNotIn('SENSITIVE',repr(cursor.statements[0]))

    def test_notebook_projection_runs_for_duplicate_credit_with_stable_source_key(self):
        user = str(uuid4())
        item = str(uuid4())
        payload = {'userId': user, 'module': 'TOEIC', 'type': 'TOEIC_ATTEMPT',
                   'sourceKey': 'toeic:stable-attempt', 'xp': 15,
                   'outcomes': [{'sourceType': 'TOEIC', 'sourceItemId': item,
                                 'sourceRefId': str(uuid4()), 'title': 'Part 2',
                                 'samples': 1, 'wrongCount': 1}]}
        for receipt in [str(uuid4()), str(uuid4())]:
            cursor = FakeCursor(result=False)
            self.assertEqual(apply_event(cursor, 'learning', {
                'eventId': receipt, 'type': 'learning.activity.recorded.v1',
                'payload': payload}), 'already-credited')
            self.assertIn('record_learning_outcomes', cursor.statements[-1][0])
            self.assertEqual(cursor.statements[-1][1][0:2], (user, payload['sourceKey']))
            self.assertNotIn('outcomes', json.loads(cursor.statements[0][1][-1]))

    def test_notebook_payload_is_bounded(self):
        for outcomes in [{}, [None] * 1001]:
            with self.assertRaises(ValueError):
                apply_event(FakeCursor(), 'learning', {
                    'eventId': str(uuid4()), 'type': 'learning.activity.recorded.v1',
                    'payload': {'userId': str(uuid4()), 'module': 'TOEIC',
                                'type': 'TOEIC_ATTEMPT', 'sourceKey': 'test',
                                'xp': 0, 'outcomes': outcomes}})

if __name__=='__main__':unittest.main()
