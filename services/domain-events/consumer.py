"""Idempotent domain event receipt, using service-owned PostgreSQL inbox."""
import json
import os
import time
import pika
import psycopg

NAME=os.getenv('CONSUMER_NAME','domain-events')
EXCHANGE='domain.events'
ROUTING=os.getenv('EVENT_ROUTING_KEY','#')

def open_db():
    return psycopg.connect(host=os.getenv('PGHOST','127.0.0.1'),port=int(os.getenv('PGPORT','5432')),
        dbname=os.environ['PGDATABASE'],user=os.environ['PGUSER'],password=os.environ['PGPASSWORD'])

def main():
    while True:
        conn=None;db=None
        try:
            db=open_db()
            conn=pika.BlockingConnection(pika.URLParameters(os.environ['RABBITMQ_URL']))
            ch=conn.channel();ch.exchange_declare(exchange=EXCHANGE,exchange_type='topic',durable=True)
            ch.queue_declare(queue=NAME,durable=True)
            ch.queue_bind(queue=NAME,exchange=EXCHANGE,routing_key=ROUTING)
            ch.basic_qos(prefetch_count=10)
            def on_message(channel,delivery,properties,body):
                event=json.loads(body)
                with db.transaction():
                    with db.cursor() as cur:
                        cur.execute('''INSERT INTO public.inbox_events(consumer_name,event_id) VALUES(%s,%s)
                            ON CONFLICT DO NOTHING RETURNING event_id''',(NAME,event['eventId']))
                        applied=cur.fetchone() is not None
                        if applied:
                            # Business-specific projections belong in dedicated handlers.
                            print('Event received',NAME,event.get('type'),event['eventId'],flush=True)
                channel.basic_ack(delivery.delivery_tag)
            ch.basic_consume(queue=NAME,on_message_callback=on_message,auto_ack=False)
            ch.start_consuming()
        except Exception as exc:
            print('Inbox consumer reconnect:',str(exc),flush=True);time.sleep(5)
        finally:
            if db:db.close()
            if conn and conn.is_open:
                try:conn.close()
                except Exception:pass
if __name__=='__main__':main()
