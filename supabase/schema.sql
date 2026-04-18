-- =====================================================
-- RABAHNI MUJAM — COMPLETE DATABASE SCHEMA
-- Supabase / PostgreSQL
-- Legally compliant: Turkey (skill-based only)
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id                BIGINT PRIMARY KEY,  -- Telegram user_id
  username          TEXT,
  first_name        TEXT,
  last_name         TEXT,
  language_code     TEXT DEFAULT 'ar',
  country_code      TEXT DEFAULT 'TR',
  referral_code     TEXT UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  referred_by       BIGINT REFERENCES users(id),
  referral_count    INT DEFAULT 0,
  total_score       BIGINT DEFAULT 0,
  weekly_score      BIGINT DEFAULT 0,
  monthly_score     BIGINT DEFAULT 0,
  coins             INT DEFAULT 0,
  level             INT DEFAULT 1,
  xp                INT DEFAULT 0,
  ads_watched_today INT DEFAULT 0,
  ads_watched_week  INT DEFAULT 0,
  ads_watched_total INT DEFAULT 0,
  games_played      INT DEFAULT 0,
  missions_completed INT DEFAULT 0,
  is_banned         BOOLEAN DEFAULT FALSE,
  shadow_banned     BOOLEAN DEFAULT FALSE,
  agreed_to_terms   BOOLEAN DEFAULT FALSE,
  agreed_at         TIMESTAMPTZ,
  last_active       TIMESTAMPTZ DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- QUESTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS questions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level         INT NOT NULL CHECK (level BETWEEN 1 AND 10),
  language      TEXT NOT NULL CHECK (language IN ('ar', 'en', 'tr')),
  difficulty    TEXT NOT NULL CHECK (difficulty IN ('beginner','easy','medium','hard','expert','pro')),
  type          TEXT NOT NULL CHECK (type IN ('word_to_meaning','meaning_to_word','context')),
  question_text TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  wrong_answers TEXT[] NOT NULL,  -- array of 3 wrong answers
  explanation   TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  validated     BOOLEAN DEFAULT FALSE,
  validated_by  BIGINT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- GAME SESSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS game_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         BIGINT NOT NULL REFERENCES users(id),
  level           INT NOT NULL,
  language        TEXT NOT NULL,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active','completed','abandoned','cheated')),
  score           INT DEFAULT 0,
  combo           INT DEFAULT 0,
  max_combo       INT DEFAULT 0,
  lives           INT DEFAULT 3,
  questions_total INT DEFAULT 0,
  questions_correct INT DEFAULT 0,
  accuracy        NUMERIC(5,2) DEFAULT 0,
  avg_response_ms INT DEFAULT 0,
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  duration_ms     INT,
  device_fp       TEXT,  -- device fingerprint
  ip_hash         TEXT,  -- hashed IP
  cheat_flags     TEXT[] DEFAULT '{}',
  submitted       BOOLEAN DEFAULT FALSE,  -- idempotency guard
  CONSTRAINT unique_active_session UNIQUE (user_id, status) DEFERRABLE INITIALLY DEFERRED
);

-- =====================================================
-- ANSWERS TABLE (Full audit log)
-- =====================================================
CREATE TABLE IF NOT EXISTS answers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID NOT NULL REFERENCES game_sessions(id),
  user_id         BIGINT NOT NULL REFERENCES users(id),
  question_id     UUID NOT NULL REFERENCES questions(id),
  selected_answer TEXT NOT NULL,
  is_correct      BOOLEAN NOT NULL,
  response_ms     INT NOT NULL,  -- milliseconds to answer
  score_awarded   INT DEFAULT 0,
  combo_at_time   INT DEFAULT 0,
  answered_at     TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- LEADERBOARD SNAPSHOTS (weekly/monthly)
-- =====================================================
CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly','monthly')),
  period_key  TEXT NOT NULL,  -- e.g. '2025-W23' or '2025-06'
  user_id     BIGINT NOT NULL REFERENCES users(id),
  username    TEXT,
  score       BIGINT NOT NULL,
  rank        INT NOT NULL,
  level       INT,
  language    TEXT,
  snapshot_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(period_type, period_key, user_id)
);

-- =====================================================
-- AD EVENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS ad_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     BIGINT NOT NULL REFERENCES users(id),
  session_id  UUID REFERENCES game_sessions(id),
  ad_type     TEXT NOT NULL CHECK (ad_type IN ('rewarded','interstitial','native')),
  zone_id     TEXT NOT NULL,
  reward_type TEXT,  -- 'revive', 'bonus_coins', 'retry'
  reward_amount INT DEFAULT 0,
  verified    BOOLEAN DEFAULT FALSE,
  watched_at  TIMESTAMPTZ DEFAULT NOW(),
  ip_hash     TEXT,
  device_fp   TEXT
);

-- =====================================================
-- ECONOMY SETTINGS (Admin-controlled, global)
-- =====================================================
CREATE TABLE IF NOT EXISTS economy_settings (
  id                      INT PRIMARY KEY DEFAULT 1,
  weekly_ads_threshold    INT DEFAULT 5000,
  high_ads_threshold      INT DEFAULT 10000,
  min_user_points         INT DEFAULT 300,
  daily_ads_limit         INT DEFAULT 20,
  reset_day               TEXT DEFAULT 'Sunday',
  reset_time              TEXT DEFAULT '00:00',
  reward_level            TEXT DEFAULT 'locked' CHECK (reward_level IN ('locked','medium','high')),
  current_week_ads        INT DEFAULT 0,
  current_week_users      INT DEFAULT 0,
  rewards_active          BOOLEAN DEFAULT FALSE,
  weekly_winners_count    INT DEFAULT 5,
  medium_prize_1          INT DEFAULT 50,
  medium_prize_2          INT DEFAULT 30,
  medium_prize_3          INT DEFAULT 20,
  high_prize_1            INT DEFAULT 200,
  high_prize_2            INT DEFAULT 100,
  high_prize_3            INT DEFAULT 50,
  high_prize_4            INT DEFAULT 30,
  high_prize_5            INT DEFAULT 20,
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO economy_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- =====================================================
-- REWARDS / PRIZES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS prizes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_type     TEXT NOT NULL CHECK (period_type IN ('weekly','monthly')),
  period_key      TEXT NOT NULL,
  user_id         BIGINT NOT NULL REFERENCES users(id),
  username        TEXT,
  rank            INT NOT NULL,
  prize_type      TEXT NOT NULL,  -- 'hepsiburada','trendyol','digital'
  prize_value_tl  INT NOT NULL,
  prize_code      TEXT,  -- gift card code
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','confirmed','failed')),
  message_sent_at TIMESTAMPTZ,
  resend_count    INT DEFAULT 0,
  resend_max      INT DEFAULT 1,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(period_type, period_key, user_id)
);

-- =====================================================
-- MISSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS missions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title_ar    TEXT NOT NULL,
  title_tr    TEXT,
  title_en    TEXT,
  type        TEXT NOT NULL CHECK (type IN ('daily','weekly','one_time')),
  target      INT NOT NULL,
  metric      TEXT NOT NULL,  -- 'games','score','ads','referrals','streak'
  reward_coins INT DEFAULT 0,
  reward_xp   INT DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_missions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     BIGINT NOT NULL REFERENCES users(id),
  mission_id  UUID NOT NULL REFERENCES missions(id),
  progress    INT DEFAULT 0,
  completed   BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  period_key  TEXT,  -- for daily/weekly reset
  UNIQUE(user_id, mission_id, period_key)
);

-- =====================================================
-- AUDIT LOG — Everything logged
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     BIGINT,
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   TEXT,
  data        JSONB,
  ip_hash     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- BOT MESSAGE LOG
-- =====================================================
CREATE TABLE IF NOT EXISTS bot_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     BIGINT NOT NULL,
  message_type TEXT NOT NULL,
  content_preview TEXT,
  status      TEXT DEFAULT 'sent' CHECK (status IN ('sent','failed','pending')),
  sent_at     TIMESTAMPTZ DEFAULT NOW(),
  error       TEXT
);

-- =====================================================
-- CHANNEL POSTS (affiliate channel scheduler)
-- =====================================================
CREATE TABLE IF NOT EXISTS channel_posts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id  TEXT NOT NULL,
  post_type   TEXT NOT NULL CHECK (post_type IN ('winner','tip','affiliate','invite','custom')),
  content     TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ,
  sent_at     TIMESTAMPTZ,
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_users_weekly_score ON users(weekly_score DESC);
CREATE INDEX IF NOT EXISTS idx_users_total_score ON users(total_score DESC);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON game_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON game_sessions(status);
CREATE INDEX IF NOT EXISTS idx_answers_session ON answers(session_id);
CREATE INDEX IF NOT EXISTS idx_answers_user ON answers(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_events_user ON ad_events(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_events_watched ON ad_events(watched_at);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_leaderboard_period ON leaderboard_snapshots(period_type, period_key, rank);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Users can only read their own data
CREATE POLICY "users_own_data" ON users FOR ALL USING (id = current_setting('app.user_id', true)::bigint);
CREATE POLICY "sessions_own_data" ON game_sessions FOR ALL USING (user_id = current_setting('app.user_id', true)::bigint);
CREATE POLICY "answers_own_data" ON answers FOR ALL USING (user_id = current_setting('app.user_id', true)::bigint);
CREATE POLICY "ad_events_own" ON ad_events FOR ALL USING (user_id = current_setting('app.user_id', true)::bigint);
-- Prizes: user can read their own
CREATE POLICY "prizes_own" ON prizes FOR SELECT USING (user_id = current_setting('app.user_id', true)::bigint);
-- Audit log: service role only
CREATE POLICY "audit_service_only" ON audit_log FOR ALL USING (FALSE);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Reset weekly scores (runs via cron every Sunday 00:00 UTC+3)
CREATE OR REPLACE FUNCTION reset_weekly_scores()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Snapshot leaderboard before reset
  INSERT INTO leaderboard_snapshots (period_type, period_key, user_id, username, score, rank)
  SELECT
    'weekly',
    TO_CHAR(NOW() AT TIME ZONE 'Europe/Istanbul', 'IYYY-IW'),
    u.id, u.username, u.weekly_score,
    ROW_NUMBER() OVER (ORDER BY u.weekly_score DESC)
  FROM users u
  WHERE u.weekly_score > 0 AND NOT u.is_banned;

  -- Reset weekly counters
  UPDATE users SET weekly_score = 0, ads_watched_week = 0;
  UPDATE economy_settings SET current_week_ads = 0, current_week_users = 0, rewards_active = FALSE, reward_level = 'locked';

  INSERT INTO audit_log (action, data) VALUES ('weekly_reset', jsonb_build_object('reset_at', NOW()));
END;
$$;

-- Update economy reward level based on ad count
CREATE OR REPLACE FUNCTION update_reward_level()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.current_week_ads >= NEW.high_ads_threshold AND NEW.current_week_users >= 200 THEN
    NEW.reward_level := 'high';
    NEW.rewards_active := TRUE;
  ELSIF NEW.current_week_ads >= NEW.weekly_ads_threshold AND NEW.current_week_users >= 100 THEN
    NEW.reward_level := 'medium';
    NEW.rewards_active := TRUE;
  ELSE
    NEW.reward_level := 'locked';
    NEW.rewards_active := FALSE;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_reward_level
BEFORE UPDATE OF current_week_ads, current_week_users ON economy_settings
FOR EACH ROW EXECUTE FUNCTION update_reward_level();

-- Idempotent score submission
CREATE OR REPLACE FUNCTION submit_session_score(
  p_session_id UUID,
  p_user_id BIGINT,
  p_score INT,
  p_accuracy NUMERIC,
  p_duration_ms INT,
  p_cheat_flags TEXT[]
)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_session game_sessions;
  v_result JSONB;
BEGIN
  -- Lock the session row
  SELECT * INTO v_session FROM game_sessions
  WHERE id = p_session_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'session_not_found');
  END IF;

  IF v_session.submitted THEN
    RETURN jsonb_build_object('error', 'already_submitted', 'score', v_session.score);
  END IF;

  IF array_length(p_cheat_flags, 1) > 0 THEN
    UPDATE game_sessions SET status = 'cheated', submitted = TRUE, cheat_flags = p_cheat_flags WHERE id = p_session_id;
    RETURN jsonb_build_object('error', 'cheat_detected');
  END IF;

  -- Update session
  UPDATE game_sessions SET
    score = p_score,
    accuracy = p_accuracy,
    duration_ms = p_duration_ms,
    status = 'completed',
    completed_at = NOW(),
    submitted = TRUE
  WHERE id = p_session_id;

  -- Update user scores
  UPDATE users SET
    weekly_score = weekly_score + p_score,
    monthly_score = monthly_score + p_score,
    total_score = total_score + p_score,
    games_played = games_played + 1,
    last_active = NOW()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', TRUE, 'score', p_score);
END;
$$;

-- =====================================================
-- SEED MISSIONS
-- =====================================================
INSERT INTO missions (title_ar, title_tr, title_en, type, target, metric, reward_coins, reward_xp) VALUES
('العب 3 جولات اليوم', 'Bugün 3 oyun oyna', 'Play 3 games today', 'daily', 3, 'games', 30, 50),
('احصل على 100 نقطة', '100 puan kazan', 'Score 100 points', 'daily', 100, 'score', 20, 30),
('شاهد إعلاناً مكافئاً', 'Ödüllü reklam izle', 'Watch a rewarded ad', 'daily', 1, 'ads', 10, 15),
('اكسب 500 نقطة هذا الأسبوع', 'Bu hafta 500 puan kazan', 'Score 500 points this week', 'weekly', 500, 'score', 100, 150),
('العب 10 جولات هذا الأسبوع', 'Bu hafta 10 oyun oyna', 'Play 10 games this week', 'weekly', 10, 'games', 80, 100),
('ادعُ صديقاً', 'Bir arkadaş davet et', 'Invite a friend', 'one_time', 1, 'referrals', 200, 300)
ON CONFLICT DO NOTHING;
