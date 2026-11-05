/** Reviewed Phase 0 catalogue. No wildcard or implicit permission inheritance. */
export const PERMISSION_CATALOGUE = [
  {
    "code": "dashboard.read",
    "description": "View administrative overview"
  },
  {
    "code": "users.read",
    "description": "Read learner records, overview and progress"
  },
  {
    "code": "users.create",
    "description": "Create learner accounts"
  },
  {
    "code": "users.update",
    "description": "Edit learner profile and notes; status needs users.lock"
  },
  {
    "code": "users.lock",
    "description": "Ban or unban learner accounts"
  },
  {
    "code": "users.delete",
    "description": "Soft-delete learner accounts"
  },
  {
    "code": "vocabulary.read",
    "description": "Read words, groups, collections, lessons and relationships"
  },
  {
    "code": "vocabulary.create",
    "description": "Create vocabulary resources and sections"
  },
  {
    "code": "vocabulary.update",
    "description": "Edit, reorder, activate and manage relationships"
  },
  {
    "code": "vocabulary.delete",
    "description": "Delete vocabulary resources or sections"
  },
  {
    "code": "vocabulary.restore",
    "description": "Restore deleted vocabulary resources"
  },
  {
    "code": "toeic.read",
    "description": "Read exams, groups, questions and passages"
  },
  {
    "code": "toeic.create",
    "description": "Create exams, groups, questions and passages"
  },
  {
    "code": "toeic.update",
    "description": "Edit, activate, reorder and manage exam relationships"
  },
  {
    "code": "toeic.delete",
    "description": "Delete TOEIC resources including child questions"
  },
  {
    "code": "toeic.restore",
    "description": "Restore deleted exams"
  },
  {
    "code": "toeic.import",
    "description": "Parse and import question drafts; persisted creation also needs toeic.create"
  },
  {
    "code": "toeic.attempts.read",
    "description": "Read administrative attempts and learner results"
  },
  {
    "code": "toeic.comments.moderate",
    "description": "Delete comments by other authors through shared community route"
  },
  {
    "code": "dictation.read",
    "description": "Read dictation lessons, hierarchy and draft split preview"
  },
  {
    "code": "dictation.create",
    "description": "Create dictation lessons, topics and sections"
  },
  {
    "code": "dictation.update",
    "description": "Edit lessons, segments, topics and sections"
  },
  {
    "code": "dictation.delete",
    "description": "Delete dictation resources"
  },
  {
    "code": "arena.read",
    "description": "Read arena dashboard, matches, players and rooms"
  },
  {
    "code": "arena.rooms.close",
    "description": "Close an arena room"
  },
  {
    "code": "arena.settings.read",
    "description": "Read arena operational settings"
  },
  {
    "code": "arena.settings.update",
    "description": "Change arena operational settings"
  },
  {
    "code": "games.read",
    "description": "Read game catalogue"
  },
  {
    "code": "games.update",
    "description": "Edit or reorder game catalogue"
  },
  {
    "code": "games.settings.read",
    "description": "Read game-specific settings"
  },
  {
    "code": "games.settings.update",
    "description": "Edit game-specific settings"
  },
  {
    "code": "games.results.read",
    "description": "Read game results, statistics and top scores"
  },
  {
    "code": "media_library.read",
    "description": "Use admin media library together with domain.read"
  },
  {
    "code": "media.upload",
    "description": "Upload a standalone managed media object"
  },
  {
    "code": "media.delete",
    "description": "Delete a standalone managed media object"
  },
  {
    "code": "audio.read",
    "description": "Read audio voices and processor metadata"
  },
  {
    "code": "audio.generate",
    "description": "Generate or enqueue audio; domain write needs domain.update"
  },
  {
    "code": "audio.upload",
    "description": "Upload and attach audio; also requires domain.update"
  },
  {
    "code": "audio.jobs.read",
    "description": "Read audio jobs and SSE events across audio module"
  },
  {
    "code": "audio.workers.read",
    "description": "Read global audio worker config and metrics"
  },
  {
    "code": "audio.workers.update",
    "description": "Change global audio worker configuration"
  },
  {
    "code": "asr.read",
    "description": "Read transcription job status and health"
  },
  {
    "code": "asr.create",
    "description": "Create transcription or analyze-audio work"
  },
  {
    "code": "infrastructure.read",
    "description": "Read infrastructure service status"
  },
  {
    "code": "ai_import.read",
    "description": "Read prepared AI import jobs and results"
  },
  {
    "code": "ai_import.create",
    "description": "Start AI PDF parsing/bundle jobs, not final database import"
  },
  {
    "code": "ai_import.learning.read",
    "description": "Read AI correction-learning status"
  },
  {
    "code": "ai_import.learning.review",
    "description": "Review correction samples"
  },
  {
    "code": "ai_import.learning.retry",
    "description": "Retry delivery of correction-learning work"
  },
  {
    "code": "publication.read",
    "description": "Read publication state and preview with domain.read"
  },
  {
    "code": "publication.validate",
    "description": "Run and retain publication validation with domain.update"
  },
  {
    "code": "publication.publish",
    "description": "Publish content with domain.update"
  },
  {
    "code": "publication.unpublish",
    "description": "Unpublish content with domain.update"
  },
  {
    "code": "settings.read",
    "description": "Read site settings and timezone options"
  },
  {
    "code": "settings.update",
    "description": "Edit site settings"
  },
  {
    "code": "settings.landing.read",
    "description": "Read landing page settings"
  },
  {
    "code": "settings.landing.update",
    "description": "Edit landing page settings"
  },
  {
    "code": "settings.recommendations.read",
    "description": "Read or preview recommendation rules"
  },
  {
    "code": "settings.recommendations.update",
    "description": "Save recommendation rules"
  },
  {
    "code": "audit.read",
    "description": "Read administrative activity logs, filters and statistics"
  },
  {
    "code": "content_quality.read",
    "description": "Read cross-domain content quality results"
  },
  {
    "code": "content_quality.scan",
    "description": "Run cross-domain content quality scan"
  },
  {
    "code": "learning_mistakes.read",
    "description": "Read global learning mistake statistics"
  },
  {
    "code": "admins.read",
    "description": "Read administrator accounts (future IAM)"
  },
  {
    "code": "admins.create",
    "description": "Invite an administrator (future IAM)"
  },
  {
    "code": "admins.update",
    "description": "Edit administrator metadata or role assignments (future IAM)"
  },
  {
    "code": "admins.lock",
    "description": "Suspend/disable/unlock administrators (future IAM)"
  },
  {
    "code": "admins.reinvite",
    "description": "Reissue an activation invitation (future IAM)"
  },
  {
    "code": "roles.read",
    "description": "Read roles and permission matrix (future IAM)"
  },
  {
    "code": "roles.manage",
    "description": "Edit ordinary roles and their permissions (future IAM)"
  }
] as const;

export type AdminPermissionCode = (typeof PERMISSION_CATALOGUE)[number]["code"];
export const SUPER_ADMIN_ROLE_CODE = "SUPER_ADMIN";
