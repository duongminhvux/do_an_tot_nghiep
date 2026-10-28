"""Bounded, read-only access to the audio job owner state."""
import os
from uuid import UUID

import psycopg
from psycopg.rows import dict_row


class AudioJobReader:
    def get(self, job_id: str):
        with psycopg.connect(
            host=os.getenv('PGHOST', '127.0.0.1'),
            port=int(os.getenv('PGPORT', '5432')),
            dbname=os.getenv('PGDATABASE', 'media_db'),
            user=os.getenv('PGUSER', 'vl_media'),
            password=os.environ['PGPASSWORD'], row_factory=dict_row,
        ) as conn:
            row = conn.execute('''
                SELECT (payload - '_id') || jsonb_build_object(
                    'id', id::text, 'state', state) AS job
                FROM public.audio_jobs WHERE id=%s
            ''', (UUID(job_id),)).fetchone()
            return row['job'] if row else None
