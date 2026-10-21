"""Durable event receipt projection; demonstrates versioned idempotent consumers."""
import json
import os
import time
import pika
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError

NAME = os.environ.get('EVENT_CONSUMER', 'learning')
if NAME not in ('learning', 'notification'):
    raise RuntimeError('Unsupported event consumer')
MONGO = MongoClient(os.environ['MONGO_URI'])
COL = MONGO.get_default_database()['processed_domain_events']


def main():
    while True:
        connection = None
        try:
            connection = pika.BlockingConnection(pika.URLParameters(os.environ['RABBITMQ_URL']))
            ch = connection.channel()
            ch.exchange_declare(exchange='domain.events', exchange_type='topic', durable=True)
            queue = NAME + '.domain.events'
            ch.queue_declare(queue=queue, durable=True, arguments={'x-queue-type':'quorum'})
            ch.queue_bind(exchange='domain.events', queue=queue, routing_key='#')
            ch.basic_qos(prefetch_count=10)
            def handle(ch, method, props, body):
                try:
                    data = json.loads(body)
                    key = NAME + ':' + str(data['eventId'])
                    COL.insert_one({'_id': key, 'consumer': NAME,
                        'eventId': data['eventId'], 'type': data['type'],
                        'receivedAt': time.time(), 'payload': data.get('payload',{})})
                    ch.basic_ack(method.delivery_tag)
                except DuplicateKeyError:
                    ch.basic_ack(method.delivery_tag)
                except Exception:
                    ch.basic_nack(method.delivery_tag, requeue=True)
            ch.basic_consume(queue=queue, on_message_callback=handle, auto_ack=False)
            ch.start_consuming()
        except Exception as exc:
            print('Event consumer reconnecting:', exc, flush=True)
            time.sleep(5)
        finally:
            if connection and connection.is_open:
                try: connection.close()
                except Exception: pass

if __name__ == '__main__': main()
