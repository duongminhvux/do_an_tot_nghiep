"""No network required; fake S3 smoke tests for backup/restore."""
from importlib.util import spec_from_file_location, module_from_spec
import tempfile
from pathlib import Path
from io import BytesIO
from datetime import datetime

module_path = Path(__file__).with_name('s3-backup-restore.py')
spec = spec_from_file_location('backup_module', module_path)
a = module_from_spec(spec)
spec.loader.exec_module(a)

from botocore.exceptions import ClientError

def not_found():
    return ClientError({'Error': {'Code': '404'}, 'ResponseMetadata': {'HTTPStatusCode':404}}, 'HeadObject')
class FakeBody:
    def __init__(self,data):self.data=data
    def iter_chunks(self, size):
        for i in range(0,len(self.data),size):yield self.data[i:i+size]
class Pager:
    def __init__(self,items):self.items=items
    def paginate(self,Bucket):yield {'Contents':[{'Key':k,'Size':len(v)} for k,v in self.items.items()]}
class FakeS3:
    def __init__(self,items=None):self.items=items or {}
    def get_paginator(self,name):return Pager(self.items)
    def get_object(self,Bucket,Key):return {'Body':FakeBody(self.items[Key]), 'ContentType':'audio/wav'}
    def head_object(self,Bucket,Key):
        if Key not in self.items: raise not_found()
        return {'ContentLength':len(self.items[Key])}
    def put_object(self,Bucket,Key,Body,ContentType):self.items[Key]=Body.read()

with tempfile.TemporaryDirectory() as d:
    path=Path(d)
    before=FakeS3({'hello.wav':b'hello audio','../bad':b'bad key does not escape'})
    a.backup(before,'bucket1',path)
    folder=next(path.iterdir())
    assert (folder/'BACKUP_COMPLETE').is_file()
    import os
    os.environ['S3_BUCKET']='bucket1'
    target=FakeS3({'hello.wav':b'existing unaffected'})
    a.restore(target,folder,True)
    assert target.items['hello.wav']==b'existing unaffected'
    assert target.items['../bad']==b'bad key does not escape'
    assert not (path/'bad').exists()
    target2=FakeS3()
    a.restore(target2,folder,True)
    assert target2.items==before.items
print('S3 backup/restore fake smoke: PASS')
