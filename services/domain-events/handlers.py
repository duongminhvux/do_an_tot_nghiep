"""Transactional service-owned domain event projections (no cross-DB reads).

Called inside the SAME destination PostgreSQL transaction as inbox receipt.
Unknown event types are deliberately ignored; no unrelated business rows are
copied across service boundaries. Producers and projections use stable event IDs.
"""
import json
from datetime import datetime, timezone
from uuid import UUID, uuid4

ACTIVITY_TYPES = {
    'WORD_LEARNED', 'WORD_REVIEWED', 'VOCAB_SESSION', 'DICTATION_LESSON',
    'TOEIC_ATTEMPT', 'ARENA_MATCH', 'MINIGAME_PLAY',
}
MODULES = {'VOCABULARY', 'DICTATION', 'TOEIC', 'ARENA', 'MINIGAME'}


def _uuid(value):
    return str(UUID(str(value)))


def apply_event(cur, consumer, event):
    event_type = event.get('type')
    payload = event.get('payload')
    if not isinstance(payload, dict):
        raise ValueError('Event payload must be an object')
    if event_type in ('identity.user.created.v1', 'identity.user.updated.v1') and consumer in ('learning', 'arena', 'notification'):
        user_id = _uuid(payload['userId'])
        username = payload.get('username')
        avatar = payload.get('avatarUrl')
        if username is not None and not isinstance(username, str):
            raise ValueError('Invalid profile username')
        if avatar is not None and not isinstance(avatar, str):
            raise ValueError('Invalid profile avatar')
        version = payload.get('sourceVersion', 0)
        if isinstance(version,bool) or not isinstance(version,int) or version < 0:
            raise ValueError('Invalid profile source version')
        cur.execute('''INSERT INTO public.identity_profiles(id,username,avatar_url,is_banned,source_version,payload,updated_at)
            VALUES(%s,%s,%s,%s,%s,%s::jsonb,now())
            ON CONFLICT(id) DO UPDATE SET
              username=EXCLUDED.username, avatar_url=EXCLUDED.avatar_url,
              is_banned=EXCLUDED.is_banned, source_version=EXCLUDED.source_version,
              payload=EXCLUDED.payload,updated_at=now()
            WHERE identity_profiles.source_version < EXCLUDED.source_version''',
            (user_id,username,avatar,bool(payload.get('isBanned',False)),version,
             json.dumps({'username':username,'avatarUrl':avatar})))
        return 'identity-profile'
    if event_type == 'learning.activity.recorded.v1' and consumer == 'learning':
        user_id = _uuid(payload['userId'])
        event_id = _uuid(event['eventId'])
        source_key = payload['sourceKey']
        module = payload['module']
        kind = payload['type']
        xp = payload['xp']
        if not isinstance(source_key,str) or not 0 < len(source_key) <= 250:
            raise ValueError('Invalid learning source key')
        if module not in MODULES or kind not in ACTIVITY_TYPES:
            raise ValueError('Invalid learning activity category')
        if isinstance(xp,bool) or not isinstance(xp,(int,float)) or xp < 0 or xp > 10000:
            raise ValueError('Invalid learning XP')
        xp = round(xp)
        raw_time = payload.get('occurredAt')
        occurred = datetime.fromisoformat(raw_time.replace('Z','+00:00')) if raw_time else datetime.now(timezone.utc)
        if occurred.tzinfo is None:
            occurred = occurred.replace(tzinfo=timezone.utc)
        activity_id = str(uuid4())
        document = {**payload,'userId':user_id,'occurredAt':occurred.isoformat(),'xp':xp}
        cur.execute('''INSERT INTO public.learning_activities
            (id,user_id,module,type,source_key,xp,occurred_at,title,ref_id,link,correct,total,score,duration_sec,metadata,payload)
            VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s::jsonb)
            ON CONFLICT(user_id,source_key) DO NOTHING RETURNING id''',
            (activity_id,user_id,module,kind,source_key,xp,occurred,
             payload.get('title'),payload.get('refId'),payload.get('link'),
             payload.get('correct'),payload.get('total'),payload.get('score'),
             payload.get('durationSec'),json.dumps(payload.get('metadata') or {}),json.dumps(document)))
        inserted = cur.fetchone()
        if inserted:
            cur.execute('''INSERT INTO public.learning_credit_ledger
                (id,user_id,source_key,event_id,source_service,xp,activity_id,occurred_at)
                VALUES(%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(user_id,source_key) DO NOTHING''',
                (str(uuid4()),user_id,source_key,event_id,payload.get('sourceService') or event.get('source') or 'domain-event',xp,activity_id,occurred))
        return 'learning-credit' if inserted else 'already-credited'
    return None
