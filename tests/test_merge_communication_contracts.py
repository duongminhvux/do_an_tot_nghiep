"""Dependency-free static regressions for the Oct 23 Git merge and API graph.

These are source-contract checks, NOT Docker end-to-end integration tests.
Run: python -m unittest discover -s tests -p 'test_*.py' -v
"""
import json
from pathlib import Path
import re
import unittest
import yaml

ROOT=Path(__file__).resolve().parents[1]

def read(name):return (ROOT/name).read_text(encoding='utf8')

class MergeCommunicationContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.compose=yaml.safe_load(read('docker-compose.yml'))['services']
        cls.schema=json.loads(read('database/schema/collections.json'))
        cls.ownership=json.loads(read('database/import/ownership.json'))

    def test_four_conflict_files_exist_without_conflict_markers(self):
        for f in ('apps/api/package.json','apps/api/src/app.module.ts',
                  'apps/api/src/modules/assessment/attempts/schemas/attempt.schema.ts',
                  'apps/api/src/modules/learning/sessions/sessions.service.ts'):
            s=read(f)
            for marker in ('<<<<<<<','>>>>>>>','======='):
                self.assertNotIn('\n'+marker,s,f)

    def test_api_manifest_matches_frozen_lockfile(self):
        import yaml
        manifest=json.loads(read('apps/api/package.json'))
        lock=yaml.safe_load(read('pnpm-lock.yaml'))['importers']['apps/api']
        for section in ('dependencies','devDependencies'):
            self.assertEqual(set(manifest[section]),set(lock[section]))
            for package,version in manifest[section].items():
                self.assertEqual(version,lock[section][package]['specifier'])

    def test_no_phantom_legacy_controller_or_service_imports(self):
        app=read('apps/api/src/app.module.ts')
        self.assertNotIn('app.controller.js',app)
        self.assertNotIn('app.service.js',app)
        self.assertIn('NOT a production composition root',app)

    def test_attempt_legacy_completed_status_is_allowed(self):
        s=read('apps/api/src/modules/assessment/attempts/schemas/attempt.schema.ts')
        self.assertIn("enum: [...Object.values(ToeicAttemptStatus), 'COMPLETED']",s)
        self.assertIn("status: ToeicAttemptStatus | 'COMPLETED'",s)

    def test_session_xp_and_notification_provider_wiring(self):
        s=read('apps/api/src/modules/learning/sessions/sessions.service.ts')
        self.assertIn('private readonly learningActivity: LearningActivityService',s)
        self.assertIn('private readonly activityLogsService: NotificationClient',s)
        self.assertNotIn('ActivityLogsService',s)
        module=read('apps/api/src/modules/learning/learning.module.ts')
        self.assertIn('LearningActivityModule',module)

    def test_activity_uses_learning_owner_and_idempotent_unique_index(self):
        self.assertIn('learning_activities',self.schema['collections']['learning'])
        for role,collections in self.schema['collections'].items():
            if role!='learning': self.assertNotIn('learning_activities',collections)
        self.assertEqual(sum('learning_activities' in cols for cols in self.ownership['collections'].values()),1)
        self.assertIn('learning_activities',self.ownership['collections']['learning'])
        indexes=self.schema['collections']['learning']['learning_activities']['indexes']
        self.assertTrue(any(idx['key']=={'userId':1,'sourceKey':1} and idx['options'].get('unique') for idx in indexes))

    def test_learning_activity_is_registered_only_in_learning_role(self):
        entry=read('apps/api/src/entrypoints/learning.ts')
        module=read('apps/api/src/modules/learning/learning.module.ts')
        activity=read('apps/api/src/modules/learning-activity/learning-activity.module.ts')
        self.assertIn('LearningModule',entry)
        self.assertIn('LearningActivityModule',module)
        self.assertIn('InternalLearningActivityController',activity)
        self.assertIn('LearningActivityController',activity)

    def test_service_to_service_xp_client_not_cross_database_mongoose(self):
        platform=read('apps/api/src/platform/platform.module.ts')
        self.assertIn('LearningActivityClientModule',platform)
        for f in ('modules/assessment/attempts/attempts.service.ts',
                  'modules/dictation/dictation.service.ts',
                  'modules/arena/matches/arena-match.service.ts'):
            s=read('apps/api/src/'+f)
            self.assertIn('@Inject(LearningActivityClient)',s,f)
            self.assertNotIn('private readonly learningActivity?: LearningActivityService',s,f)

    def test_gateway_routing_learning_activity_and_internal_denial(self):
        nginx=read('infra/gateway/nginx.conf')
        self.assertIn('learning-activity',nginx)
        self.assertIn('location ^~ /api/_internal/ { return 404; }',nginx)
        self.assertRegex(nginx,r'location ~ \^/api/\(\?:learning\|learning-activity.+proxy_pass http://learning;')

    def test_internal_learning_route_is_token_protected(self):
        internal=read('apps/api/src/modules/learning-activity/internal-learning-activity.controller.ts')
        self.assertIn("@Controller('_internal/learning')",internal)
        self.assertIn("@Post('activity')",internal)
        self.assertIn('timingSafeEqual',internal)
        self.assertIn('INTERNAL_SERVICE_TOKEN',internal)

    def test_internal_service_docker_hosts_resolve(self):
        import urllib.parse
        services=set(self.compose)
        for name,svc in self.compose.items():
            for key,val in svc.get('environment',{}).items():
                if not isinstance(val,str) or not val.startswith(('http://','https://','mongodb://','redis://','amqp://')): continue
                host=urllib.parse.urlsplit(val).hostname
                if host and host not in ('localhost','127.0.0.1') and not host.startswith('$') and not host.endswith('.com'):
                    self.assertIn(host,services,(name,key,host))

    def test_learning_urls_and_tokens_on_all_nest_services(self):
        for role in self.schema['databases']:
            env=self.compose[role+'-service']['environment']
            self.assertIn('LEARNING_INTERNAL_URL',env)
            self.assertIn('INTERNAL_SERVICE_TOKEN',env)
            self.assertIn('IDENTITY_INTERNAL_TOKEN',env)
            self.assertIn('db-init',self.compose[role+'-service']['depends_on'])

    def test_mongo_owner_names_unique(self):
        names=list(self.schema['databases'].values())
        self.assertEqual(len(names),len(set(names)))
        for role, db in self.schema['databases'].items():
            self.assertEqual(self.compose[role+'-service']['environment']['MONGO_DB_NAME'],db)

    def test_projection_relay_ack_and_checkpoint_sequence(self):
        s=read('services/projections/projection.py')
        self.assertIn('ch.confirm_delivery()',s)
        self.assertIn('stream.try_next()',s)
        self.assertLess(s.index('ch.basic_publish(exchange="projection.events.v1"'), s.index('db["projection_resume"].replace_one'))

if __name__=='__main__':unittest.main()
