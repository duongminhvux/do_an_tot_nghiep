"""Outbox-like MongoDB change stream relay and RabbitMQ projector.

Every source relay reads ONLY its own database; every consumer writes ONLY its
own database. Source change events (including deletes) are durable RabbitMQ
messages. Reliable requires replica set, publisher confirms and persisted
resume tokens. A db-init schema checkpoint is mandatory; never tail from 'now'.
"""
import json
import hashlib
import os
import sys
import time
import logging
from pathlib import Path

import pika
from bson import json_util
from pymongo import MongoClient
from pymongo.errors import PyMongoError

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("projections")
SCHEMA_BYTES = Path("/app/collections.json").read_bytes()
OWNERSHIP_BYTES = Path("/app/ownership.json").read_bytes()
SCHEMA_HASH = hashlib.sha256(SCHEMA_BYTES).hexdigest()
OWNERSHIP = json.loads(OWNERSHIP_BYTES)
MODE = os.getenv("PROJECTION_MODE", "").lower()
ROLE = os.getenv("SERVICE_ROLE", "")
assert ROLE in OWNERSHIP["databases"], "Invalid SERVICE_ROLE"
assert MODE in ("relay", "consume"), "Invalid PROJECTION_MODE"
TARGETS = OWNERSHIP["projections"]
OWNERS = {c: role for role, cols in OWNERSHIP["collections"].items() for c in cols}
URL = os.environ["RABBITMQ_URL"]
DB_URL = os.environ["MONGO_URI"]
DB_NAME = OWNERSHIP["databases"][ROLE]


def rabbit():
    params = pika.URLParameters(URL)
    # Do not let a broker-side resource alarm block a publisher indefinitely.
    params.blocked_connection_timeout = 120
    conn = pika.BlockingConnection(params)
    ch = conn.channel()
    ch.exchange_declare(exchange="projection.events.v1", exchange_type="topic", durable=True)
    ch.confirm_delivery()
    return conn, ch


def project(collection, target, document):
    fields = TARGETS[collection][target]
    if fields == "*":
        return document
    return {key: document[key] for key in fields if key in document}


def bson_body(data):
    return json_util.dumps(data).encode("utf-8")


def consume():
    mongo = MongoClient(DB_URL, serverSelectionTimeoutMS=12000)
    db = mongo[DB_NAME]
    if not db["database_versions"].find_one({"_id": "schema_manifest_current", "schemaChecksum": SCHEMA_HASH}):
        raise RuntimeError("Database schema not initialized by db-init")
    conn, ch = rabbit()
    queue = f"projection.{ROLE}.v1"
    dead = f"projection.{ROLE}.dead.v1"
    ch.queue_declare(queue=dead, durable=True, arguments={"x-queue-type": "quorum"})
    ch.queue_declare(queue=queue, durable=True, arguments={"x-queue-type": "quorum", "x-single-active-consumer": True,
            "x-dead-letter-exchange": "", "x-dead-letter-routing-key": dead})
    ch.queue_bind(exchange="projection.events.v1", queue=queue, routing_key=f"target.{ROLE}.*")
    ch.basic_qos(prefetch_count=1)

    def handle(channel, delivery, properties, body):
        try:
            event = json_util.loads(body.decode("utf-8"))
            collection = event["collection"]
            if ROLE not in TARGETS.get(collection, {}):
                raise ValueError(f"Unexpected projection {collection}")
            key = event["documentId"]
            # MongoDB change-stream versions are totally ordered for each
            # collection/document. Retries must never overwrite newer state.
            version = event.get("clusterTime")
            if version is None:
                raise ValueError("Projection event missing clusterTime")
            revision = (version.time, version.inc)
            position = f"{collection}:{str(key)}"
            with mongo.start_session() as session:
                with session.start_transaction():
                    last = db["projection_versions"].find_one({"_id": position}, session=session)
                    last_revision = (last["sec"], last["inc"]) if last else None
                    if last_revision is None or revision > last_revision:
                        if event["operation"] == "delete":
                            db[collection].delete_one({"_id": key}, session=session)
                        elif event["operation"] in ("insert", "replace", "update"):
                            doc = project(collection, ROLE, event["document"])
                            if doc.get("_id") != key:
                                raise ValueError("Invalid projection document ID")
                            db[collection].replace_one({"_id": key}, doc, upsert=True, session=session)
                        else:
                            raise ValueError("Unsupported change stream operation")
                        db["projection_versions"].replace_one({"_id":position},
                            {"_id":position,"sec":revision[0],"inc":revision[1]}, upsert=True, session=session)
            channel.basic_ack(delivery.delivery_tag)
        except Exception as exc:
            # Never ACK a failed write; move poison event to a durable dead queue
            # only after repeated attempts, and alert operations to reconcile.
            log.exception("projection write failed: %s", exc)
            retry = int((properties.headers or {}).get("x-attempt", 0))
            if retry >= 5:
                channel.basic_reject(delivery.delivery_tag, requeue=False)
                log.error("Projection message parked in %s. RECONCILIATION REQUIRED", dead)
            else:
                time.sleep(min(2 ** retry, 10))
                channel.basic_publish(exchange="", routing_key=queue, body=body,
                        properties=pika.BasicProperties(content_type="application/json", delivery_mode=2,
                                headers={"x-attempt": retry + 1}), mandatory=True)
                channel.basic_ack(delivery.delivery_tag)
    log.info("Consuming role=%s database=%s queue=%s", ROLE, DB_NAME, queue)
    ch.basic_consume(queue=queue, on_message_callback=handle, auto_ack=False)
    try:
        ch.start_consuming()
    finally:
        if conn.is_open:
            conn.close()
        mongo.close()


def relay():
    mongo = MongoClient(DB_URL, serverSelectionTimeoutMS=12000)
    conn = None
    try:
        db = mongo[DB_NAME]
        marker = db["database_versions"].find_one({"_id": "initial_schema_v1"})
        current = db["database_versions"].find_one({"_id": "schema_manifest_current", "schemaChecksum": SCHEMA_HASH})
        if not marker or not marker.get("projectionStartTime") or not current:
            raise RuntimeError("db-init schema not reconciled or immutable projectionStartTime missing")
        source_names = {c for c, targets in TARGETS.items() if OWNERS[c] == ROLE and targets}
        if not source_names:
            log.info("No projections for role=%s", ROLE)
            return
        checkpoint = db["projection_resume"].find_one({"_id": "source-v1"})
        opts = {"full_document": "updateLookup", "max_await_time_ms": 2500}
        if checkpoint:
            opts["resume_after"] = checkpoint["token"]
        else:
            opts["start_at_operation_time"] = marker["projectionStartTime"]
        conn, ch = rabbit()
        log.info("Relaying %s collections from role=%s", len(source_names), ROLE)
        pipeline = [{"$match": {"ns.coll": {"$in": sorted(source_names)},
                                 "operationType": {"$in": ["insert", "update", "replace", "delete"]}}}]
        with db.watch(pipeline, **opts) as stream:
            while True:
                # A 'for change in stream' can block for minutes and starve Pika
                # of AMQP heartbeats. try_next() returns after max_await_time_ms.
                change = stream.try_next()
                conn.process_data_events(time_limit=0)
                if change is None:
                    conn.sleep(0.05)
                    continue
                coll = change["ns"]["coll"]
                operation = change["operationType"]
                full = change.get("fullDocument")
                if operation != "delete" and full is None:
                    raise RuntimeError(f"Cannot fetch full document for {coll}; intervention required")
                for target in TARGETS[coll]:
                    event = {"schema": 1, "source": ROLE, "target": target, "collection": coll,
                             "operation": operation, "documentId": change["documentKey"]["_id"],
                             "document": project(coll, target, full) if full else None,
                             "clusterTime": change["clusterTime"]}
                    # BlockingChannel.basic_publish returns None on SUCCESS;
                    # with confirm_delivery() failures raise UnroutableError /
                    # NackError (or a connection exception). Never check its return value.
                    ch.basic_publish(exchange="projection.events.v1", routing_key=f"target.{target}.{coll}",
                            body=bson_body(event), mandatory=True,
                            properties=pika.BasicProperties(delivery_mode=2, content_type="application/json"))
                # Persist ONLY after every target was confirmed by RabbitMQ.
                # On a disconnect, the same change may be replayed (at least once).
                db["projection_resume"].replace_one({"_id": "source-v1"},
                        {"_id": "source-v1", "token": change["_id"],
                         "updatedAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc)},
                        upsert=True)
    finally:
        if conn is not None and conn.is_open:
            try:
                conn.close()
            except Exception:
                log.warning("Failed to close RabbitMQ connection cleanly", exc_info=True)
        mongo.close()


if __name__ == "__main__":
    # Fail CLOSED. Container restarts for transient infrastructure faults, but
    # always retains checkpoints; do not silently reset after invalid resume token.
    try:
        relay() if MODE == "relay" else consume()
    except (Exception, KeyboardInterrupt) as error:
        log.exception("projection process stopped: %s", error)
        sys.exit(1)
