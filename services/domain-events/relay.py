"""PostgreSQL transactional outbox -> RabbitMQ topic exchange.

Publisher confirms + FOR UPDATE SKIP LOCKED prevent lost events and avoid
concurrent relays claiming the same row. Duplicate delivery after crashes is
normal; consumers use inbox_events for idempotency.
"""
import json
import os
import time
from datetime import datetime
import pika
import psycopg
from psycopg.rows import dict_row

EXCHANGE='domain.events'

def open_db():
    return psycopg.connect(host=os.getenv('PGHOST','127.0.0.1'),port=int(os.getenv('PGPORT','5432')),
        dbname=os.environ['PGDATABASE'],user=os.environ['PGUSER'],password=os.environ['PGPASSWORD'],
        row_factory=dict_row)

def send_one(conn,ch):
    with conn.transaction():
        with conn.cursor() as cur:
            cur.execute('''SELECT event_id,event_type,aggregate_type,aggregate_id,payload,created_at
                FROM public.outbox_events WHERE published_at IS NULL
                ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1''')
            event=cur.fetchone()
            if event is None:return False
            msg={'eventId':str(event['event_id']),'type':event['event_type'],
                'aggregateType':event['aggregate_type'],'aggregateId':str(event['aggregate_id']) if event['aggregate_id'] else '',
                'payload':event['payload'],'occurredAt':event['created_at'].isoformat()}
            body=json.dumps(msg,ensure_ascii=False).encode('utf-8')
            ch.basic_publish(exchange=EXCHANGE,routing_key=event['event_type'],body=body,mandatory=True,
                properties=pika.BasicProperties(delivery_mode=2,content_type='application/json',message_id=msg['eventId']))
            cur.execute('''UPDATE public.outbox_events SET published_at=now(),delivery_attempts=delivery_attempts+1
                WHERE event_id=%s''',(event['event_id'],))
            return True

def main():
    while True:
        rabbit=None;db=None
        try:
            db=open_db()
            rabbit=pika.BlockingConnection(pika.URLParameters(os.environ['RABBITMQ_URL']))
            channel=rabbit.channel()
            channel.exchange_declare(exchange=EXCHANGE,exchange_type='topic',durable=True)
            channel.confirm_delivery()
            print('PostgreSQL outbox connected',os.environ['PGDATABASE'],flush=True)
            while True:
                if not send_one(db,channel):rabbit.sleep(0.5)
        except Exception as exc:
            print('PostgreSQL outbox relay reconnect:',str(exc),flush=True)
            time.sleep(5)
        finally:
            if db:db.close()
            if rabbit and rabbit.is_open:
                try:rabbit.close()
                except Exception:pass

if __name__=='__main__':main()
