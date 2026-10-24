"""Durable owner-specific projections with transactional inbox, retries and DLQ."""
import json
import os
import time
import uuid
import pika
import psycopg
from handlers import apply_event

NAME = os.getenv('CONSUMER_NAME', 'domain-events')
EXCHANGE = 'domain.events'
ROUTING = os.getenv('EVENT_ROUTING_KEY', '#')
MAX_RETRIES = max(0, min(20, int(os.getenv('DOMAIN_EVENT_MAX_RETRIES', '5'))))

def open_db():
    return psycopg.connect(host=os.getenv('PGHOST','127.0.0.1'),
        port=int(os.getenv('PGPORT','5432')), dbname=os.environ['PGDATABASE'],
        user=os.environ['PGUSER'], password=os.environ['PGPASSWORD'])


def main():
    while True:
        rabbit = None; db = None
        try:
            db = open_db()
            rabbit = pika.BlockingConnection(pika.URLParameters(os.environ['RABBITMQ_URL']))
            ch = rabbit.channel()
            ch.confirm_delivery()
            ch.exchange_declare(exchange=EXCHANGE, exchange_type='topic', durable=True)
            ch.queue_declare(queue=NAME, durable=True)
            ch.queue_bind(queue=NAME, exchange=EXCHANGE, routing_key=ROUTING)
            retry_queue = NAME + '.retry-v2'
            dead_queue = NAME + '.dead-v2'
            ch.queue_declare(queue=retry_queue, durable=True, arguments={
                'x-message-ttl': 10000, 'x-dead-letter-exchange': '',
                'x-dead-letter-routing-key': NAME,
            })
            ch.queue_declare(queue=dead_queue, durable=True)
            ch.basic_qos(prefetch_count=1)

            def receive(channel, delivery, properties, body):
                event = None
                try:
                    event = json.loads(body)
                    if not isinstance(event, dict):
                        raise ValueError('Expected event object')
                    event_id = str(uuid.UUID(event['eventId']))
                    with db.transaction():
                        with db.cursor() as cur:
                            cur.execute('''INSERT INTO public.inbox_events(consumer_name,event_id,event_type)
                                VALUES(%s,%s,%s) ON CONFLICT DO NOTHING RETURNING event_id''',
                                (NAME,event_id,event.get('type')))
                            if cur.fetchone():
                                effect = apply_event(cur, NAME, event)
                                if effect:
                                    print('Applied event', NAME, event.get('type'), event_id, effect, flush=True)
                    channel.basic_ack(delivery.delivery_tag)
                except Exception as exc:
                    # psycopg transaction context rolls back both inbox receipt
                    # and business projection. Never ACK before safe redelivery.
                    attempts = int((properties.headers or {}).get('x-attempts',0)) if properties else 0
                    is_terminal = attempts >= MAX_RETRIES or isinstance(exc,(KeyError,ValueError,TypeError))
                    try:
                        if db and event and event.get('eventId'):
                            with db.transaction():
                                with db.cursor() as cur:
                                    cur.execute('''INSERT INTO public.event_processing_failures
                                        (consumer_name,event_id,event_type,attempts,last_error)
                                        VALUES(%s,%s,%s,%s,%s)
                                        ON CONFLICT(consumer_name,event_id) DO UPDATE
                                        SET attempts=EXCLUDED.attempts,last_error=EXCLUDED.last_error,
                                            updated_at=now()''',
                                        (NAME,str(event['eventId']),event.get('type'),attempts+1,str(exc)[:1000]))
                        target = dead_queue if is_terminal else retry_queue
                        headers = {**(properties.headers or {}), 'x-attempts':attempts+1} if properties else {'x-attempts':attempts+1}
                        channel.basic_publish(exchange='',routing_key=target,body=body,mandatory=True,
                            properties=pika.BasicProperties(delivery_mode=2,content_type='application/json',headers=headers))
                        channel.basic_ack(delivery.delivery_tag)
                        print('Event delivery failed',NAME,target,str(exc),flush=True)
                    except Exception:
                        channel.basic_nack(delivery.delivery_tag,requeue=True)
            ch.basic_consume(queue=NAME, on_message_callback=receive,auto_ack=False)
            ch.start_consuming()
        except Exception as exc:
            print('Inbox consumer reconnect:',str(exc),flush=True)
            time.sleep(5)
        finally:
            if db: db.close()
            if rabbit and rabbit.is_open:
                try: rabbit.close()
                except Exception: pass

if __name__=='__main__': main()
