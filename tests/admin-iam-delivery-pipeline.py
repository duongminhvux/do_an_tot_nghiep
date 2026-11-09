"""Integration-only confirmed-channel adapter: real relay + consumer code, real two-owner PostgreSQL.
No RabbitMQ network or SMTP; deliberately inject publisher/consumer failures without real recipients.
"""
import os,sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services'/'domain-events'))
import psycopg
from psycopg.rows import dict_row
from relay import send_one
from consumer import receive_event

port=int(os.environ['ADMIN_IAM_TEST_PORT']);assert port!=5432 and port>1024
password=os.environ['ADMIN_IAM_TEST_PASSWORD']
identity=psycopg.connect(host='127.0.0.1',port=port,user='vl_identity',password=password,dbname='identity_db',row_factory=dict_row,autocommit=True)
notification=psycopg.connect(host='127.0.0.1',port=port,user='vl_notification',password=password,dbname='notification_db',autocommit=True)
for db in [identity,notification]:
    assert db.execute('SHOW cluster_name').fetchone()[0 if db==notification else 'cluster_name']=='admin-iam-phase1-test'
class ConfirmedChannel:
    def basic_publish(self,**kwargs):
        if sys.argv[1]=='fail':raise OSError('Simulated broker unavailable before confirm')
        event=json.loads(kwargs['body'])
        receive_event(notification,'notification',event)
        receive_event(notification,'notification',event)
        if event['type']=='identity.admin.activation_email_requested.v1':
            from uuid import uuid4
            receive_event(notification,'notification',{**event,'eventId':str(uuid4())})
        return True
try:
    count=0
    while send_one(identity,ConfirmedChannel()):count+=1
    print(json.dumps({'published':count,'mode':sys.argv[1]}))
except Exception:
    print(json.dumps({'simulatedFailure':True,'mode':sys.argv[1]}));sys.exit(2)
finally:
    identity.close();notification.close()
