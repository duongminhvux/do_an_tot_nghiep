-- Frozen V8 baseline, idempotently adopted for existing installations.
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- arenainvitations: arena owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."arenainvitations" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "mode" TEXT,
  "rematch_of" UUID,
  "sender_id" UUID NOT NULL,
  "receiver_id" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "room_id" UUID,
  "status" TEXT,
  "expires_at" TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_arenainvitations_updated_at ON public."arenainvitations";
CREATE TRIGGER trg_arenainvitations_updated_at BEFORE UPDATE ON public."arenainvitations"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_arenainvitations_1" ON public."arenainvitations" ("sender_id");
CREATE INDEX IF NOT EXISTS "idx_arenainvitations_2" ON public."arenainvitations" ("receiver_id");
CREATE INDEX IF NOT EXISTS "idx_arenainvitations_3" ON public."arenainvitations" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_arenainvitations_4" ON public."arenainvitations" ("sender_id", "type") WHERE "status" = 'PENDING' AND "type" = 'DUEL';
CREATE INDEX IF NOT EXISTS "idx_arenainvitations_5" ON public."arenainvitations" ("expires_at") WHERE "status" = 'EXPIRED';

-- arenamatches: arena owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."arenamatches" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "runtime_policy" JSONB,
  "friend_mode" TEXT,
  "next_match_id" UUID,
  "lobby_starting" BOOLEAN,
  "host_id" UUID,
  "current_turn_user_id" UUID,
  "current_word" TEXT,
  "required_letter" TEXT,
  "turn_started_at" TIMESTAMPTZ,
  "turn_deadline" TIMESTAMPTZ,
  "chain_paused_at" TIMESTAMPTZ,
  "used_words" TEXT,
  "word_guess_answer" TEXT,
  "word_guess_attempts" JSONB,
  "word_guess_revision" DOUBLE PRECISION,
  "word_guess_solved_by" TEXT,
  "turn_count" DOUBLE PRECISION,
  "type" TEXT NOT NULL,
  "room_id" UUID,
  "status" TEXT,
  "question_mode" JSONB,
  "question_count" DOUBLE PRECISION,
  "eliminated_user_ids" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "room_revision" DOUBLE PRECISION,
  "current_question_index" DOUBLE PRECISION,
  "seconds_per_question" DOUBLE PRECISION,
  "started_at" TIMESTAMPTZ,
  "finished_at" TIMESTAMPTZ,
  "winner_id" UUID,
  "is_draw" BOOLEAN,
  "cancel_reason" TEXT,
  "finish_reason" JSONB,
  "room_code_snapshot" TEXT,
  "settings_snapshot" JSONB,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_arenamatches_updated_at ON public."arenamatches";
CREATE TRIGGER trg_arenamatches_updated_at BEFORE UPDATE ON public."arenamatches"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_arenamatches_1" ON public."arenamatches" ("type");
CREATE INDEX IF NOT EXISTS "idx_arenamatches_2" ON public."arenamatches" ("room_id");
CREATE INDEX IF NOT EXISTS "idx_arenamatches_3" ON public."arenamatches" ("status");
CREATE INDEX IF NOT EXISTS "idx_arenamatches_4" ON public."arenamatches" ("winner_id");
CREATE INDEX IF NOT EXISTS "idx_arenamatches_5" ON public."arenamatches" ("status", "type", "finished_at");

-- arenamatchplayers: arena owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."arenamatchplayers" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ready_mode" JSONB,
  "match_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "returned_to_lobby" BOOLEAN,
  "left_lobby" BOOLEAN,
  "score" DOUBLE PRECISION,
  "correct_answers" DOUBLE PRECISION,
  "wrong_answers" DOUBLE PRECISION,
  "unanswered" DOUBLE PRECISION,
  "longest_streak" DOUBLE PRECISION,
  "current_streak" DOUBLE PRECISION,
  "total_response_time_ms" DOUBLE PRECISION,
  "scored_question_ids" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "rating_before" DOUBLE PRECISION,
  "rating_after" DOUBLE PRECISION,
  "rating_change" DOUBLE PRECISION,
  "is_ready" BOOLEAN,
  "ready_at" TIMESTAMPTZ,
  "disconnected_at" TIMESTAMPTZ,
  "status" TEXT,
  "finished_at" TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_arenamatchplayers_updated_at ON public."arenamatchplayers";
CREATE TRIGGER trg_arenamatchplayers_updated_at BEFORE UPDATE ON public."arenamatchplayers"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_arenamatchplayers_1" ON public."arenamatchplayers" ("match_id");
CREATE INDEX IF NOT EXISTS "idx_arenamatchplayers_2" ON public."arenamatchplayers" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_arenamatchplayers_3" ON public."arenamatchplayers" ("match_id", "user_id");

-- arenamatchquestions: arena owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."arenamatchquestions" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" TEXT,
  "text" TEXT,
  "match_id" UUID NOT NULL,
  "vocabulary_id" UUID,
  "order" DOUBLE PRECISION NOT NULL,
  "type" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "audio_url" TEXT,
  "image_url" TEXT,
  "options" JSONB,
  "correct_answer" TEXT NOT NULL,
  "explanation" TEXT,
  "example" TEXT,
  "translation" TEXT,
  "word_type" TEXT,
  "started_at" TIMESTAMPTZ,
  "resolved_at" TIMESTAMPTZ,
  "winner_id" UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_arenamatchquestions_updated_at ON public."arenamatchquestions";
CREATE TRIGGER trg_arenamatchquestions_updated_at BEFORE UPDATE ON public."arenamatchquestions"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_arenamatchquestions_1" ON public."arenamatchquestions" ("match_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_arenamatchquestions_2" ON public."arenamatchquestions" ("match_id", "order");

-- arenaplayeranswers: arena owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."arenaplayeranswers" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "match_id" UUID NOT NULL,
  "match_question_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "selected_answer" TEXT,
  "attempts" DOUBLE PRECISION,
  "is_correct" BOOLEAN,
  "timed_out" BOOLEAN,
  "response_time_ms" DOUBLE PRECISION,
  "earned_score" DOUBLE PRECISION,
  "streak_at_answer" DOUBLE PRECISION,
  "answered_at" TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_arenaplayeranswers_updated_at ON public."arenaplayeranswers";
CREATE TRIGGER trg_arenaplayeranswers_updated_at BEFORE UPDATE ON public."arenaplayeranswers"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_arenaplayeranswers_1" ON public."arenaplayeranswers" ("match_id");
CREATE INDEX IF NOT EXISTS "idx_arenaplayeranswers_2" ON public."arenaplayeranswers" ("match_question_id");
CREATE INDEX IF NOT EXISTS "idx_arenaplayeranswers_3" ON public."arenaplayeranswers" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_arenaplayeranswers_4" ON public."arenaplayeranswers" ("match_id", "match_question_id", "user_id");

-- arenaprofiles: arena owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."arenaprofiles" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "rating" DOUBLE PRECISION,
  "ranked_matches" DOUBLE PRECISION,
  "ranked_wins" DOUBLE PRECISION,
  "ranked_losses" DOUBLE PRECISION,
  "ranked_draws" DOUBLE PRECISION,
  "current_win_streak" DOUBLE PRECISION,
  "best_win_streak" DOUBLE PRECISION,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_arenaprofiles_updated_at ON public."arenaprofiles";
CREATE TRIGGER trg_arenaprofiles_updated_at BEFORE UPDATE ON public."arenaprofiles"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE UNIQUE INDEX IF NOT EXISTS "idx_arenaprofiles_1" ON public."arenaprofiles" ("user_id");

-- arenaratinghistories: arena owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."arenaratinghistories" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "match_id" UUID NOT NULL,
  "before" DOUBLE PRECISION NOT NULL,
  "after" DOUBLE PRECISION NOT NULL,
  "change" DOUBLE PRECISION NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_arenaratinghistories_updated_at ON public."arenaratinghistories";
CREATE TRIGGER trg_arenaratinghistories_updated_at BEFORE UPDATE ON public."arenaratinghistories"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS "idx_arenaratinghistories_1" ON public."arenaratinghistories" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_arenaratinghistories_2" ON public."arenaratinghistories" ("match_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_arenaratinghistories_3" ON public."arenaratinghistories" ("match_id", "user_id");

-- arenarooms: arena owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."arenarooms" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "role" TEXT,
  "is_ready" BOOLEAN,
  "joined_at" TIMESTAMPTZ,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "owner_id" UUID NOT NULL,
  "status" TEXT,
  "visibility" TEXT,
  "question_mode" TEXT,
  "question_count" DOUBLE PRECISION,
  "seconds_per_question" DOUBLE PRECISION,
  "max_players" DOUBLE PRECISION,
  "vocabulary_source" TEXT,
  "collection_id" UUID,
  "members" JSONB,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_arenarooms_updated_at ON public."arenarooms";
CREATE TRIGGER trg_arenarooms_updated_at BEFORE UPDATE ON public."arenarooms"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE UNIQUE INDEX IF NOT EXISTS "idx_arenarooms_1" ON public."arenarooms" ("code");
CREATE INDEX IF NOT EXISTS "idx_arenarooms_2" ON public."arenarooms" ("owner_id");
CREATE INDEX IF NOT EXISTS "idx_arenarooms_3" ON public."arenarooms" ("status");

-- arenasettings: arena owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."arenasettings" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" TEXT NOT NULL,
  "revision" DOUBLE PRECISION,
  "config" JSONB,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_arenasettings_updated_at ON public."arenasettings";
CREATE TRIGGER trg_arenasettings_updated_at BEFORE UPDATE ON public."arenasettings"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE UNIQUE INDEX IF NOT EXISTS "idx_arenasettings_1" ON public."arenasettings" ("key");

-- friendrooms: arena owned business table. JSONB payload stores unmodeled nested data.
CREATE TABLE IF NOT EXISTS public."friendrooms" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "is_ready" BOOLEAN,
  "disconnected_at" TIMESTAMPTZ,
  "runtime_policy" DOUBLE PRECISION,
  "code" TEXT NOT NULL,
  "host_id" UUID NOT NULL,
  "guest_id" UUID,
  "mode" TEXT NOT NULL,
  "status" TEXT,
  "max_players" DOUBLE PRECISION,
  "members" JSONB,
  "guest_ready" BOOLEAN,
  "settings" JSONB NOT NULL,
  "current_match_id" UUID,
  "match_count" DOUBLE PRECISION,
  "revision" DOUBLE PRECISION,
  "host_disconnected_at" TIMESTAMPTZ,
  "guest_disconnected_at" TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_friendrooms_updated_at ON public."friendrooms";
CREATE TRIGGER trg_friendrooms_updated_at BEFORE UPDATE ON public."friendrooms"
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE UNIQUE INDEX IF NOT EXISTS "idx_friendrooms_1" ON public."friendrooms" ("code");
CREATE INDEX IF NOT EXISTS "idx_friendrooms_2" ON public."friendrooms" ("host_id");
CREATE INDEX IF NOT EXISTS "idx_friendrooms_3" ON public."friendrooms" ("guest_id");

-- Transactional outbox: insert in the SAME transaction as business writes.
CREATE TABLE IF NOT EXISTS public.outbox_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID,
  payload JSONB NOT NULL,
  published_at TIMESTAMPTZ,
  delivery_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON public.outbox_events (created_at) WHERE published_at IS NULL;

-- Idempotent consumer records to tolerate RabbitMQ at-least-once delivery.
CREATE TABLE IF NOT EXISTS public.inbox_events (
  consumer_name TEXT NOT NULL,
  event_id UUID NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer_name, event_id)
);
