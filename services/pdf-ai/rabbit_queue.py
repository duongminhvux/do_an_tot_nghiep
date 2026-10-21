"""Reliable RabbitMQ job messages; all work payloads live on persistent disk."""
import json
import os
import pika

QUEUE = 'ai.import.jobs'
RETRY = 'ai.import.retry'
DEAD = 'ai.import.dead'


def connect():
    params = pika.URLParameters(os.environ['RABBITMQ_URL'])
    params.heartbeat = 0  # heavy Ollama inference blocks the worker thread
    params.blocked_connection_timeout = 30
    connection = pika.BlockingConnection(params)
    channel = connection.channel()
    channel.queue_declare(queue=DEAD, durable=True, arguments={'x-queue-type': 'quorum'})
    channel.queue_declare(queue=QUEUE, durable=True, arguments={
        'x-queue-type': 'quorum',
        'x-dead-letter-exchange': '', 'x-dead-letter-routing-key': DEAD,
    })
    channel.queue_declare(queue=RETRY, durable=True, arguments={
        'x-message-ttl': int(os.getenv('AI_RETRY_DELAY_MS', '30000')),
        'x-dead-letter-exchange': '', 'x-dead-letter-routing-key': QUEUE,
    })
    channel.confirm_delivery()
    return connection, channel


def publish_job(job_id: str):
    connection, channel = connect()
    try:
        publish(channel, job_id, 0, QUEUE)
    finally:
        connection.close()


def publish(channel, job_id: str, attempt: int, queue: str):
    ok = channel.basic_publish(
        exchange='', routing_key=queue,
        body=json.dumps({'jobId': job_id, 'attempt': attempt}).encode('utf8'),
        properties=pika.BasicProperties(delivery_mode=2, content_type='application/json',
                                        message_id=f'{job_id}:{attempt}'),
        mandatory=True,
    )
    if not ok:
        raise RuntimeError('RabbitMQ message was not confirmed')
