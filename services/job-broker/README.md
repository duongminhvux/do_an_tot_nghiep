# RabbitMQ Audio Broker

Media Jobs owns audio job status in **MongoDB `media_db.audio_jobs`**, never Redis Lists or BullMQ. Private HTTP publisher validates a persisted waiting job, then sends persistent RabbitMQ message. One separate consumer receives, POSTs to the isolated Nest Audio Worker, and ACKs only after processing. Retry queue and DLQ are durable. Redis remains Arena-specific. No GPU autoscaler is deployed in this phase.
