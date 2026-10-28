"""ASR job commands backed by parameterized PostgreSQL statements."""
from __future__ import annotations

import os
from uuid import UUID

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb


class AsrJobStore:
    def _conn(self):
        return psycopg.connect(
            host=os.getenv('PGHOST', '127.0.0.1'),
            port=int(os.getenv('PGPORT', '5432')),
            dbname=os.getenv('PGDATABASE', 'media_db'),
            user=os.getenv('PGUSER', 'vl_media'),
            password=os.environ['PGPASSWORD'], row_factory=dict_row,
        )

    def ping(self):
        with self._conn() as conn:
            conn.execute('SELECT 1')

    def get(self, job_id: str):
        with self._conn() as conn:
            row = conn.execute('''
                SELECT (payload - '_id') || jsonb_build_object(
                    'id', id::text, 'state', lower(status),
                    'attempts', GREATEST(COALESCE(attempts,0), COALESCE((payload->>'attempts')::integer,0)),
                    'error', COALESCE(error,payload->>'error'), 'createdAt', created_at) AS job
                FROM public.asr_jobs WHERE id=%s
            ''', (UUID(job_id),)).fetchone()
            return row['job'] if row else None

    def create(self, job_id: str, language: str, key: str):
        with self._conn() as conn:
            conn.execute('''
                INSERT INTO public.asr_jobs (id, status, attempts, payload)
                VALUES (%s, 'WAITING', 0, %s)
            ''', (UUID(job_id), Jsonb({'language': language, 'key': key, 'result': None})))

    def activate(self, job_id: str):
        with self._conn() as conn:
            row = conn.execute('''
                UPDATE public.asr_jobs
                SET status='ACTIVE', attempts=GREATEST(COALESCE(attempts,0), COALESCE((payload->>'attempts')::integer,0))+1, error=NULL,
                    payload=payload - ARRAY['state','attempts','error','finishedAt']::text[]
                WHERE id=%s AND upper(status)<>'COMPLETED'
                RETURNING id
            ''', (UUID(job_id),)).fetchone()
            return row is not None

    def complete(self, job_id: str, result: dict):
        with self._conn() as conn:
            conn.execute('''
                UPDATE public.asr_jobs SET status='COMPLETED', error=NULL,
                    payload=(payload - ARRAY['state','attempts','error']::text[])
                        || jsonb_build_object('result',%s::jsonb,'finishedAt',now())
                WHERE id=%s AND upper(status)='ACTIVE'
            ''', (Jsonb(result), UUID(job_id)))

    def retry(self, job_id: str, error: str):
        with self._conn() as conn:
            conn.execute('''
                UPDATE public.asr_jobs SET status='RETRYING', error=%s,
                    attempts=GREATEST(COALESCE(attempts,0), COALESCE((payload->>'attempts')::integer,0)),
                    payload=payload - ARRAY['state','attempts','error','finishedAt']::text[]
                WHERE id=%s AND upper(status)<>'COMPLETED'
            ''', (error[:500], UUID(job_id)))

    def fail(self, job_id: str, error: str):
        with self._conn() as conn:
            conn.execute('''
                UPDATE public.asr_jobs SET status='FAILED', error=%s,
                    attempts=GREATEST(COALESCE(attempts,0), COALESCE((payload->>'attempts')::integer,0)),
                    payload=(payload - ARRAY['state','attempts','error']::text[])
                        || jsonb_build_object('finishedAt',now())
                WHERE id=%s AND upper(status)<>'COMPLETED'
            ''', (error[:500], UUID(job_id)))
