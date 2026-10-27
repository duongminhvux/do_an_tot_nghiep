-- Earlier creates applied defaults only on read, leaving SQL filters blind to
-- waiting rooms and their initial revision. Materialize the existing defaults.
UPDATE public.friendrooms SET
  status = coalesce(status, nullif(payload->>'status',''), 'WAITING'),
  max_players = coalesce(max_players, CASE WHEN jsonb_typeof(payload->'maxPlayers')='number' THEN (payload->>'maxPlayers')::double precision END, 2),
  guest_ready = coalesce(guest_ready, CASE WHEN jsonb_typeof(payload->'guestReady')='boolean' THEN (payload->>'guestReady')::boolean END, false),
  match_count = coalesce(match_count, CASE WHEN jsonb_typeof(payload->'matchCount')='number' THEN (payload->>'matchCount')::double precision END, 0),
  revision = coalesce(revision, CASE WHEN jsonb_typeof(payload->'revision')='number' THEN (payload->>'revision')::double precision END, 0)
WHERE status IS NULL OR max_players IS NULL OR guest_ready IS NULL OR match_count IS NULL OR revision IS NULL;
