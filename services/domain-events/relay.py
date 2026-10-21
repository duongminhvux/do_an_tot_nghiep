"""MongoDB outbox relay -> RabbitMQ topic exchange (publisher-confirmed)."""
import json
import os
import socket
import time
import uuid
from datetime import datetime, timedelta, timezone
import pika
from pymongo import MongoClient, ReturnDocument

CLIENT = MongoClient(os.environ['MONGO_URI'], serverSelectionTimeoutMS=10000)
COL = CLIENT.get_default_database()['domain_outbox']
OWNER = f'{socket.gethostname()}-{uuid.uuid4()}'


def main():
    while True:
        conn = None
        event = None
        try:
            conn = pika.BlockingConnection(pika.URLParameters(os.environ['RABBITMQ_URL']))
            ch = conn.channel()
            ch.exchange_declare(exchange='domain.events', exchange_type='topic', durable=True)
            ch.confirm_delivery()
            while True:
                now = datetime.now(timezone.utc)
                event = COL.find_one_and_update({
                    '$or': [{'state': 'pending'},
                            {'state': 'publishing', 'claimUntil': {'$lt': now}}],
                }, {'$set': {'state': 'publishing', 'owner': OWNER,
                             'claimUntil': now + timedelta(seconds=90)},
                    '$inc': {'attempts': 1}},
                    sort=[('occurredAt', 1)], return_document=ReturnDocument.AFTER)
                if event is None:
                    time.sleep(1)
                    continue
                payload = {k: event[k] for k in ('eventId', 'type', 'aggregateId', 'payload', 'version', 'source')}
                payload['occurredAt'] = event['occurredAt'].isoformat()
                body = json.dumps(payload, ensure_ascii=False).encode('utf8')
                ok = ch.basic_publish(exchange='domain.events', routing_key=event['type'], body=body,
                    mandatory=True, properties=pika.BasicProperties(delivery_mode=2,
                        content_type='application/json', message_id=event['eventId']))
                if not ok:
                    raise RuntimeError('RabbitMQ publish not confirmed')
                COL.update_one({'_id': event['_id'], 'owner': OWNER, 'state': 'publishing'},
                    {'$set': {'state': 'delivered', 'deliveredAt': datetime.now(timezone.utc)},
                     '$unset': {'owner': '', 'claimUntil': ''}})
                event = None
        except Exception as exc:
            print('Outbox relay reconnecting:', exc, flush=True)
            if event is not None:
                # Lease expires and another relay can publish. Duplicates are
                # intentionally possible; consumers must be idempotent.
                event = None
            time.sleep(5)
        finally:
            if conn and conn.is_open:
                try: conn.close()
                except Exception: pass

if __name__ == '__main__': main()
