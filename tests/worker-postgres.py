"""Runs only against the disposable PostgreSQL instance created by the Node runner."""
import importlib.util
import os
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import unittest
from uuid import uuid4

import psycopg
from psycopg.types.json import Jsonb

ROOT = Path(__file__).resolve().parents[1]


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


AsrJobStore = load('services/asr-jobs/pg_store.py', 'asr_store').AsrJobStore
AudioJobReader = load('services/job-broker/pg_store.py', 'audio_store').AudioJobReader


class WorkerPostgresTests(unittest.TestCase):
    def setUp(self):
        self.store = AsrJobStore()
        self.id = str(uuid4())
        self.store.create(self.id, 'en', "audio/'); DROP TABLE asr_jobs; --.wav")

    def sql(self, query, values=()):
        with psycopg.connect() as conn:
            return conn.execute(query, values).fetchall() if query.lstrip().upper().startswith('SELECT') else conn.execute(query, values)

    def test_create_lookup_and_missing_id(self):
        self.store.ping()
        row = self.store.get(self.id)
        self.assertEqual((row['id'], row['state'], row['attempts']), (self.id, 'waiting', 0))
        self.assertIn('DROP TABLE', row['key'])
        self.assertNotIn('_id', row)
        self.assertIsNone(self.store.get(str(uuid4())))
        with self.assertRaises(ValueError):
            self.store.get("' OR TRUE --")

    def test_retry_complete_and_terminal_result(self):
        self.assertTrue(self.store.activate(self.id))
        self.store.retry(self.id, 'first failure')
        self.assertEqual(self.store.get(self.id)['state'], 'retrying')
        self.assertTrue(self.store.activate(self.id))
        self.store.complete(self.id, {'text': 'hello', 'segments': [{'startMs': 0}]})
        self.store.retry(self.id, 'late retry')
        self.store.fail(self.id, 'late failure')
        self.assertFalse(self.store.activate(self.id))
        row = self.store.get(self.id)
        self.assertEqual((row['state'], row['attempts']), ('completed', 2))
        self.assertEqual(row['result']['text'], 'hello')
        self.assertIsNone(row['error'])
        self.assertIn('finishedAt', row)

    def test_atomic_counter_across_connections(self):
        with ThreadPoolExecutor(max_workers=6) as executor:
            results = list(executor.map(self.store.activate, [self.id] * 20))
        self.assertTrue(all(results))
        self.assertEqual(self.store.get(self.id)['attempts'], 20)

    def test_legacy_counter_is_preserved_on_first_native_write(self):
        self.sql("UPDATE asr_jobs SET status='retrying', payload=payload||%s WHERE id=%s",
                 (Jsonb({'_id': self.id, 'state': 'retrying', 'attempts': 4, 'error': 'old'}), self.id))
        self.assertEqual(self.store.get(self.id)['attempts'], 4)
        self.assertEqual(self.store.get(self.id)['error'], 'old')
        self.store.activate(self.id)
        self.assertEqual(self.store.get(self.id)['attempts'], 5)
        self.assertIsNone(self.store.get(self.id)['error'])
        payload = self.sql('SELECT payload FROM asr_jobs WHERE id=%s', (self.id,))[0][0]
        self.assertFalse({'state', 'attempts', 'error'} & payload.keys())

    def test_failure_is_scoped_and_bounded(self):
        other = str(uuid4())
        self.store.create(other, 'vi', 'other.wav')
        self.store.fail(self.id, 'x' * 600)
        row = self.store.get(self.id)
        self.assertEqual(row['state'], 'failed')
        self.assertEqual(len(row['error']), 500)
        self.assertEqual(self.store.get(other)['state'], 'waiting')

    def test_audio_uses_owner_column_instead_of_stale_payload(self):
        reader = AudioJobReader()
        self.sql("INSERT INTO audio_jobs(id,state,payload) VALUES (%s,'completed',%s)",
                 (self.id, Jsonb({'id': 'stale', '_id': 'stale', 'state': 'waiting', 'name': 'vocabulary'})))
        row = reader.get(self.id)
        self.assertEqual((row['id'], row['state'], row['name']), (self.id, 'completed', 'vocabulary'))
        self.assertNotIn('_id', row)
        self.assertIsNone(reader.get(str(uuid4())))
        with self.assertRaises(ValueError):
            reader.get('invalid')


if __name__ == '__main__':
    unittest.main(verbosity=2)
