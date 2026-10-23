"""Dependency-free regression tests for relay acknowledgments and checkpoints.

Run from repository root: python tests/test_projection_publish_regression.py
Mocks Pika/MongoDB interfaces; does not test a live RabbitMQ broker.
"""
from __future__ import annotations

import ast
from pathlib import Path
from types import SimpleNamespace
import unittest

SOURCE = Path(__file__).resolve().parents[1] / 'services/projections/projection.py'


class StopFlow(Exception):
    pass


class PublishFailed(Exception):
    pass


class FakeCollection:
    def __init__(self, docs=None):
        self.docs = docs or {}
        self.writes = []

    def find_one(self, query):
        row = self.docs.get(query['_id'])
        if row and query.get('schemaChecksum') is not None:
            return row if row.get('schemaChecksum') == query['schemaChecksum'] else None
        return row

    def replace_one(self, selector, data, upsert=False):
        self.writes.append((selector, data, upsert))


class FakeStream:
    def __init__(self, events):
        self.events = iter(events)

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def try_next(self):
        next_event = next(self.events, StopFlow())
        if isinstance(next_event, BaseException):
            raise next_event
        return next_event


class FakeDb:
    def __init__(self, events, marker=True):
        versions = {'schema_manifest_current': {'schemaChecksum': 'test-checksum'}}
        if marker:
            versions['initial_schema_v1'] = {'projectionStartTime': 'start-timestamp'}
        self.tables = {
            'database_versions': FakeCollection(versions),
            'projection_resume': FakeCollection(),
        }
        self.events = events
        self.watch_params = None

    def __getitem__(self, key):
        return self.tables[key]

    def watch(self, pipeline, **opts):
        self.watch_params = opts
        return FakeStream(self.events)


class FakeMongo:
    def __init__(self, db):
        self.db = db
        self.closed = False

    def __getitem__(self, name):
        assert name == 'identity_db'
        return self.db

    def close(self):
        self.closed = True


class FakeConnection:
    def __init__(self):
        self.is_open = True
        self.pumped = 0
        self.slept = 0
        self.closed = False

    def process_data_events(self, time_limit=0):
        self.pumped += 1

    def sleep(self, time_limit):
        self.slept += 1

    def close(self):
        if not self.is_open:
            raise AssertionError('close() invoked after connection loss')
        self.closed = True
        self.is_open = False


class FakeChannel:
    def __init__(self, fail_at=None):
        self.calls = []
        self.fail_at = fail_at

    def basic_publish(self, **kwargs):
        self.calls.append(kwargs)
        if self.fail_at == len(self.calls):
            raise PublishFailed('NACK or unroutable')
        return None  # Pika real behavior on CONFIRMED successful publication.


def event(num):
    return {
        '_id': f'token-{num}', 'ns': {'coll': 'users'},
        'operationType': 'insert', 'fullDocument': {'_id': num},
        'documentKey': {'_id': num}, 'clusterTime': num,
    }


def load_relay_with_fakes(events, fail_at=None, marker=True):
    tree = ast.parse(SOURCE.read_text())
    fn = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'relay')
    # Execute the actual production function body, with real dependencies replaced by fakes.
    compiled = compile(ast.Module(body=[fn], type_ignores=[]), str(SOURCE), 'exec')
    db = FakeDb(events, marker)
    mongo = FakeMongo(db)
    conn = FakeConnection()
    ch = FakeChannel(fail_at=fail_at)
    fake_pika = SimpleNamespace(BasicProperties=lambda **kwargs: kwargs)
    ns = {
        'MongoClient': lambda *a, **kw: mongo, 'DB_URL': 'fake://',
        'DB_NAME': 'identity_db', 'SCHEMA_HASH': 'test-checksum',
        'ROLE': 'identity', 'OWNERS': {'users': 'identity'},
        'TARGETS': {'users': {'arena': '*', 'learning': '*'}},
        'rabbit': lambda: (conn, ch), 'pika': fake_pika,
        'bson_body': lambda data: b'event',
        'project': lambda coll, role, full: full,
        'log': SimpleNamespace(info=lambda *args: None, warning=lambda *args, **kwargs: None),
    }
    exec(compiled, ns)
    return ns['relay'], db, mongo, conn, ch


class TestProjectionRelay(unittest.TestCase):
    def test_successful_publish_returns_none_and_checkpoint_advances(self):
        relay, db, mongo, conn, ch = load_relay_with_fakes([None, event(1), StopFlow()])
        with self.assertRaises(StopFlow):
            relay()
        self.assertEqual(len(ch.calls), 2)
        self.assertEqual(len(db['projection_resume'].writes), 1)
        self.assertEqual(db['projection_resume'].writes[0][1]['token'], 'token-1')
        self.assertEqual(conn.pumped, 2)
        self.assertEqual(conn.slept, 1)
        self.assertTrue(conn.closed)
        self.assertTrue(mongo.closed)
        self.assertEqual(db.watch_params['max_await_time_ms'], 2500)

    def test_publisher_failure_never_advances_checkpoint(self):
        relay, db, mongo, conn, ch = load_relay_with_fakes([event(1)], fail_at=2)
        with self.assertRaises(PublishFailed):
            relay()
        self.assertEqual(len(ch.calls), 2)
        self.assertEqual(db['projection_resume'].writes, [])
        self.assertTrue(conn.closed)
        self.assertTrue(mongo.closed)

    def test_resume_token_only_advances_after_all_targets(self):
        relay, db, mongo, conn, ch = load_relay_with_fakes([event(1), event(2)], fail_at=3)
        with self.assertRaises(PublishFailed):
            relay()
        self.assertEqual(len(db['projection_resume'].writes), 1)
        self.assertEqual(db['projection_resume'].writes[0][1]['token'], 'token-1')

    def test_no_schema_marker_fails_closed(self):
        relay, db, mongo, conn, ch = load_relay_with_fakes([event(1)], marker=False)
        with self.assertRaises(RuntimeError):
            relay()
        self.assertEqual(db['projection_resume'].writes, [])
        self.assertFalse(conn.closed)
        self.assertTrue(mongo.closed)

    def test_original_error_not_masked_on_already_closed_connection(self):
        relay, db, mongo, conn, ch = load_relay_with_fakes([event(1)], fail_at=1)
        conn.is_open = False
        with self.assertRaises(PublishFailed):
            relay()
        self.assertEqual(db['projection_resume'].writes, [])
        self.assertTrue(mongo.closed)

    def test_no_legacy_boolean_checks_across_publishers(self):
        root = SOURCE.parents[2]
        paths = [
            'services/projections/projection.py',
            'services/domain-events/relay.py',
            'services/job-broker/app.py',
            'services/job-broker/runner.py',
            'services/asr-jobs/common.py',
            'services/pdf-ai/rabbit_queue.py',
        ]
        for relpath in paths:
            tree = ast.parse((root / relpath).read_text())
            for node in ast.walk(tree):
                if isinstance(node, ast.Assign) and isinstance(node.value, ast.Call):
                    self.assertNotEqual(getattr(node.value.func, 'attr', None), 'basic_publish', relpath)
                if isinstance(node, ast.If) and isinstance(node.test, ast.UnaryOp):
                    operand = node.test.operand
                    if isinstance(operand, ast.Call):
                        self.assertNotEqual(getattr(operand.func, 'attr', None), 'basic_publish', relpath)


if __name__ == '__main__':
    unittest.main(verbosity=2)
