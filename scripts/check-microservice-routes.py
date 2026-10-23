#!/usr/bin/env python3
"""Static Gateway route regression checks (does not require Docker)."""
import re
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
nginx=(ROOT/'infra/gateway/nginx.conf').read_text()
patterns=[]
for exp, service in re.findall(r'location\s+~\s+(\S+)\s*\{\s*proxy_pass\s+http://(\w+);\s*\}',nginx):
    patterns.append((re.compile(exp), service))

cases={
    '/api/auth/login':'identity',
    '/api/admin/auth/login':'identity',
    '/api/users/me':'identity',
    '/api/admin/users':'identity',
    '/api/words':'content',
    '/api/admin/vocabulary-groups':'content',
    '/api/admin/dictation':'content',
    '/api/collections':'content',
    '/api/admin/lessons':'content',
    '/api/upload':'content',
    '/api/exams':'assessment',
    '/api/admin/exams':'assessment',
    '/api/admin/exams/abc/pdf-ai/jobs':'ai_import',
    '/api/admin/pdf-ai':'ai_import',
    '/api/attempts':'assessment',
    '/api/admin/attempts/abc':'assessment',
    '/api/sessions':'learning',
    '/api/learning-activity/home':'learning',
    '/api/learning-activity/recent':'learning',
    '/api/asr':'media_jobs',
    '/api/pdf-ai':'ai_import',
    '/api/admin/questions':'assessment',
    '/api/arena':'arena',
    '/api/admin/arena':'arena',
    '/api/learning/progress':'learning',
    '/api/learning/saved-words':'learning',
    '/api/progress':'learning',
    '/api/reviews':'learning',
    '/api/minigames':'learning',
    '/api/admin/games':'learning',
    '/api/admin/dashboard':'learning',
    '/api/tts':'media_jobs',
    '/api/admin/audio':'media_jobs',
    '/api/admin/asr':'media_jobs',
    '/api/admin/infrastructure':'media_jobs',
    '/api/activity-logs':'notification',
    '/api/admin/activity-logs':'notification',
}
for path, expected in cases.items():
    actual=next((svc for pattern,svc in patterns if pattern.match(path)), None)
    if actual!=expected:raise SystemExit(f'WRONG ROUTE {path}: {actual}, expected {expected}')
assert 'location ^~ /socket.io/' in nginx
assert 'proxy_pass http://arena;' in nginx
assert 'location ^~ /media/' in nginx
assert 'upstream legacy' not in nginx
assert 'location / { return 404; }' in nginx
assert 'location ^~ /api/_internal/ { return 404; }' in nginx
# Internal identity route must not be exposed by public gateway.
assert not any(pat.match('/api/_internal/identity/introspect') for pat,_ in patterns)
role_src='\n'.join((ROOT/'apps/api/src/entrypoints'/f'{name}.ts').read_text() for name in ('identity','content','assessment','arena','learning','media-jobs','ai-import','notification'))
for role in ('identity','content','assessment','arena','learning','media-jobs','ai-import','notification'):
    assert f"bootstrapService('{role}'" in role_src, role
assert 'legacy' not in role_src
print('Gateway route smoke: PASS (%d HTTP routes, Socket.IO, media, no legacy)'%len(cases))
