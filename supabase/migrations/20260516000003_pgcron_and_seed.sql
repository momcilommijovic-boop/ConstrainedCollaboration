-- ============================================================
-- Migration 003: pg_cron job + seed strategy_templates
-- ============================================================

-- ============================================================
-- Seed: EZINE_V1 strategy template
-- ============================================================
insert into strategy_templates (id, name, description, default_config, schema)
values (
  'EZINE_V1',
  'E-Zine',
  'A collaborative journalism and publishing flow. Members form a group, elect an editor, submit articles to a brief, and publish a collective e-zine each cycle.',
  '{
    "forming_timeout_days": 14,
    "briefing_window_days": 3,
    "submission_window_days": 7,
    "editing_window_days": 4,
    "promotion_window_days": 5,
    "min_submissions_required": 3,
    "max_submissions_per_writer": 1,
    "editor_election_method": "random",
    "illustrator_required": false,
    "illustrator_dedicated": false,
    "word_count_min": 400,
    "word_count_max": 1200,
    "penalty_rules": {
      "missed_brief": { "action": "warn", "merit_delta": -5 },
      "missed_submission": { "action": "kick", "merit_delta": -10 },
      "missed_promotion": { "action": "warn", "merit_delta": -15 },
      "second_offense": { "action": "kick", "merit_delta": -20 },
      "merit_kick_threshold": 60
    },
    "promotion_requirement": "social_link",
    "min_merit_to_join": 50,
    "recur_on_completion": true
  }'::jsonb,
  '{
    "type": "object",
    "required": [
      "forming_timeout_days",
      "briefing_window_days",
      "submission_window_days",
      "editing_window_days",
      "promotion_window_days",
      "min_submissions_required",
      "max_submissions_per_writer",
      "editor_election_method",
      "word_count_min",
      "word_count_max",
      "penalty_rules",
      "min_merit_to_join"
    ],
    "properties": {
      "forming_timeout_days":      { "type": "integer", "minimum": 1, "maximum": 60 },
      "briefing_window_days":      { "type": "integer", "minimum": 1, "maximum": 14 },
      "submission_window_days":    { "type": "integer", "minimum": 1, "maximum": 30 },
      "editing_window_days":       { "type": "integer", "minimum": 1, "maximum": 14 },
      "promotion_window_days":     { "type": "integer", "minimum": 1, "maximum": 14 },
      "min_submissions_required":  { "type": "integer", "minimum": 1 },
      "max_submissions_per_writer":{ "type": "integer", "minimum": 1 },
      "editor_election_method":    { "type": "string", "enum": ["random", "merit_weighted", "vote"] },
      "illustrator_required":      { "type": "boolean" },
      "illustrator_dedicated":     { "type": "boolean" },
      "word_count_min":            { "type": "integer", "minimum": 50 },
      "word_count_max":            { "type": "integer", "minimum": 100 },
      "penalty_rules": {
        "type": "object",
        "properties": {
          "missed_brief":      { "type": "object" },
          "missed_submission": { "type": "object" },
          "missed_promotion":  { "type": "object" },
          "second_offense":    { "type": "object" },
          "merit_kick_threshold": { "type": "integer" }
        }
      },
      "promotion_requirement": { "type": "string", "enum": ["social_link", "none"] },
      "min_merit_to_join":     { "type": "integer", "minimum": 0, "maximum": 100 },
      "recur_on_completion":   { "type": "boolean" }
    }
  }'::jsonb
) on conflict (id) do nothing;

-- ============================================================
-- pg_cron: check cell deadlines every 30 minutes
-- NOTE: Replace [PROJECT_REF] and [SERVICE_ROLE_KEY] with your
--       actual Supabase project values before running in production.
--       These are stored as secrets in the Supabase dashboard.
-- ============================================================
select cron.schedule(
  'check-cell-deadlines',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/process-deadlines',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
