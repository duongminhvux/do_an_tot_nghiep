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

class ActivationHandlerTests(unittest.TestCase):
    def test_activation_job_contains_only_record_id_and_dedupes_logical_invitation(self):
        token_id=str(uuid4())
        for event_id in [str(uuid4()),str(uuid4())]:
            cur=FakeCursor()
            result=apply_event(cur,'notification',{'eventId':event_id,'type':'identity.admin.activation_email_requested.v1',
                'payload':{'tokenId':token_id,'adminId':str(uuid4()),'expiresAt':'2030-01-01T00:00:00Z'}})
            self.assertEqual(result,'admin-activation-email-job')
            self.assertEqual(cur.statements[0][1][0],token_id)
            self.assertEqual(json.loads(cur.statements[0][1][1]),{'tokenId':token_id})
            self.assertIn('ON CONFLICT(id) DO NOTHING',cur.statements[0][0])
    def test_activation_rejects_secrets_or_unknown_contract(self):
        for kind,payload in [('identity.admin.activation_email_requested.v1',{'tokenId':str(uuid4()),'adminId':str(uuid4()),'expiresAt':'2030-01-01T00:00:00Z','rawToken':'must-never-be-stored'}),('identity.admin.activation_unknown.v9',{})]:
            with self.assertRaises(ValueError):
                apply_event(FakeCursor(),'notification',{'eventId':str(uuid4()),'type':kind,'payload':payload})

class AdminAuditTests(unittest.TestCase):
    def test_audit_projection_is_idempotent_and_excludes_nested_secrets(self):
        event_id=str(uuid4());cur=FakeCursor()
        effect=apply_event(cur,'notification',{'eventId':event_id,'type':'identity.admin.authorization_changed.v1','payload':{'actorId':str(uuid4()),'action':'ADMIN_ACTIVATED','targetId':str(uuid4()),'before':{'status':'PENDING_ACTIVATION'},'after':{'status':'ACTIVE','rawToken':'SENSITIVE','nested':{'password':'SENSITIVE'}}}})
        self.assertEqual(effect,'admin-iam-audit');self.assertIn('ON CONFLICT(id) DO NOTHING',cur.statements[0][0]);self.assertEqual(cur.statements[0][1][0],event_id);self.assertNotIn('SENSITIVE',repr(cur.statements))
    def test_operator_bootstrap_is_not_misidentified_as_a_learner(self):
        cur=FakeCursor()
        apply_event(cur,'notification',{'eventId':str(uuid4()),'type':'identity.admin.super_admin_bootstrapped.v1','payload':{'actor':{'type':'OPERATOR'},'targetAdminId':str(uuid4()),'action':'SUPER_ADMIN_BOOTSTRAPPED'}})
        self.assertIsNone(cur.statements[0][1][1]);self.assertEqual(cur.statements[0][1][3],'OPERATOR')

if __name__=='__main__':unittest.main()
