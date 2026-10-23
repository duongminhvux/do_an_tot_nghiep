"""PostgreSQL ASR job persistence. JSONB documents with first-class UUID/status columns."""
from __future__ import annotations
import os
import json
from datetime import datetime
from uuid import UUID
import psycopg
from psycopg.rows import dict_row

class JobStore:
    def __init__(self, table='asr_jobs'):
        assert table in ('asr_jobs', 'audio_jobs')
        self.table = table
    def _conn(self):
        return psycopg.connect(
            host=os.getenv('PGHOST','127.0.0.1'),
            port=int(os.getenv('PGPORT','5432')),
            dbname=os.getenv('PGDATABASE','media_db'),
            user=os.getenv('PGUSER','vl_media'),
            password=os.environ['PGPASSWORD'],
            row_factory=dict_row,
        )
    def ping(self):
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute('SELECT 1')
                return cur.fetchone()
    def _find(self, data, filter):
        return all(str(data.get(k) if k != '_id' else data.get('_id')) == str(v)
                   for k,v in filter.items())
    def find_one(self, filter, projection=None):
        with self._conn() as conn:
            with conn.cursor() as cur:
                # Use SQL indexed PK for the normal queue lookup.
                key=filter.get('_id') or filter.get('id')
                if key:
                    cur.execute(f'SELECT id, payload FROM {self.table} WHERE id=%s',(str(key),))
                else:
                    cur.execute(f'SELECT id, payload FROM {self.table}')
                for row in cur.fetchall():
                    doc={**row['payload'],'_id':str(row['id']),'id':str(row['id'])}
                    if self._find(doc,filter):
                        if projection and projection.get('_id')==0:doc.pop('_id',None)
                        return doc
        return None
    def insert_one(self,doc):
        id=str(doc.get('_id') or doc.get('id'))
        UUID(id)
        normalized=json.dumps(doc,default=self._json)
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(f'''INSERT INTO {self.table}(id,payload,status)
                    VALUES(%s,%s::jsonb,%s)''',(id,normalized,doc.get('state','PENDING')))
        return id
    def update_one(self,filter,update):
        key=filter.get('_id') or filter.get('id')
        if not key:raise ValueError('Job writes require a UUID filter')
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(f'SELECT payload FROM {self.table} WHERE id=%s FOR UPDATE',(str(key),))
                row=cur.fetchone()
                if not row:return 0
                doc=row['payload']
                for k,v in update.get('$set',{}).items():doc[k]=v
                for k,v in update.get('$inc',{}).items():doc[k]=doc.get(k,0)+v
                for k in update.get('$unset',{}):doc.pop(k,None)
                cur.execute(f'''UPDATE {self.table} SET payload=%s::jsonb,status=%s,updated_at=now() WHERE id=%s''',
                    (json.dumps(doc,default=self._json),doc.get('state','PENDING'),str(key)))
                return 1
    @staticmethod
    def _json(obj):
        if isinstance(obj,datetime):return obj.isoformat()
        raise TypeError(f'Unsupported JSON value {type(obj)}')
