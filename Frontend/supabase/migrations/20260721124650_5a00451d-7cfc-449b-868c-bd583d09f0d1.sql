
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.session_source AS ENUM ('webcam', 'dashcam', 'video', 'image');
CREATE TYPE public.session_status AS ENUM ('active', 'completed', 'processing', 'failed');
CREATE TYPE public.driver_state AS ENUM ('awake', 'drowsy', 'sleeping', 'yawning', 'unknown');
CREATE TYPE public.alert_level AS ENUM ('none', 'low', 'medium', 'high');
CREATE TYPE public.alert_channel AS ENUM ('sound', 'email', 'whatsapp');
CREATE TYPE public.delivery_status AS ENUM ('pending', 'sent', 'failed');

-- =========================================================
-- UPDATED_AT HELPER
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- USER_ROLES + has_role()
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- HANDLE NEW USER TRIGGER (profile + default role)
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- UPLOADED_MEDIA
-- =========================================================
CREATE TABLE public.uploaded_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  duration_seconds NUMERIC,
  kind TEXT NOT NULL CHECK (kind IN ('video','image')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.uploaded_media TO authenticated;
GRANT ALL ON public.uploaded_media TO service_role;

ALTER TABLE public.uploaded_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own media"
  ON public.uploaded_media FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read all media"
  ON public.uploaded_media FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- DETECTION_SESSIONS
-- =========================================================
CREATE TABLE public.detection_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source public.session_source NOT NULL,
  status public.session_status NOT NULL DEFAULT 'active',
  media_id UUID REFERENCES public.uploaded_media(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds NUMERIC,
  total_events INTEGER NOT NULL DEFAULT 0,
  total_alerts INTEGER NOT NULL DEFAULT 0,
  yawn_count INTEGER NOT NULL DEFAULT 0,
  eye_closure_seconds NUMERIC NOT NULL DEFAULT 0,
  max_fatigue_score NUMERIC,
  final_state public.driver_state,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_user_started ON public.detection_sessions(user_id, started_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.detection_sessions TO authenticated;
GRANT ALL ON public.detection_sessions TO service_role;

ALTER TABLE public.detection_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sessions"
  ON public.detection_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read all sessions"
  ON public.detection_sessions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON public.detection_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- DETECTION_EVENTS (time-series)
-- =========================================================
CREATE TABLE public.detection_events (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.detection_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  ear NUMERIC,
  mar NUMERIC,
  head_pitch NUMERIC,
  head_yaw NUMERIC,
  head_roll NUMERIC,
  eye_closed BOOLEAN,
  yawning BOOLEAN,
  state public.driver_state NOT NULL DEFAULT 'unknown',
  fatigue_score NUMERIC,
  alert_level public.alert_level NOT NULL DEFAULT 'none',
  metadata JSONB
);

CREATE INDEX idx_events_session_ts ON public.detection_events(session_id, ts DESC);
CREATE INDEX idx_events_user_ts ON public.detection_events(user_id, ts DESC);

GRANT SELECT, INSERT ON public.detection_events TO authenticated;
GRANT ALL ON public.detection_events TO service_role;

ALTER TABLE public.detection_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own events"
  ON public.detection_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own events"
  ON public.detection_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read all events"
  ON public.detection_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- ALERTS
-- =========================================================
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.detection_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel public.alert_channel NOT NULL,
  level public.alert_level NOT NULL,
  recipient TEXT,
  payload JSONB,
  delivery_status public.delivery_status NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ
);

CREATE INDEX idx_alerts_user_created ON public.alerts(user_id, created_at DESC);

GRANT SELECT, INSERT ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own alerts"
  ON public.alerts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all alerts"
  ON public.alerts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- NOTIFICATION_SETTINGS
-- =========================================================
CREATE TABLE public.notification_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sound_enabled BOOLEAN NOT NULL DEFAULT true,
  email_enabled BOOLEAN NOT NULL DEFAULT false,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
  email_recipient TEXT,
  whatsapp_recipient TEXT,
  min_alert_level public.alert_level NOT NULL DEFAULT 'medium',
  cooldown_seconds INTEGER NOT NULL DEFAULT 60,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_settings TO authenticated;
GRANT ALL ON public.notification_settings TO service_role;

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notif settings"
  ON public.notification_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_notif_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- MODEL_SETTINGS (admin-tunable, single row)
-- =========================================================
CREATE TABLE public.model_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ear_threshold NUMERIC NOT NULL DEFAULT 0.22,
  mar_threshold NUMERIC NOT NULL DEFAULT 0.60,
  eye_closure_seconds_threshold NUMERIC NOT NULL DEFAULT 1.5,
  yawn_window_seconds INTEGER NOT NULL DEFAULT 60,
  yawn_count_threshold INTEGER NOT NULL DEFAULT 3,
  fatigue_high_threshold NUMERIC NOT NULL DEFAULT 0.75,
  model_version TEXT NOT NULL DEFAULT 'best.pt',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

INSERT INTO public.model_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

GRANT SELECT ON public.model_settings TO authenticated;
GRANT ALL ON public.model_settings TO service_role;

ALTER TABLE public.model_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read model settings"
  ON public.model_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins update model settings"
  ON public.model_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_model_settings_updated_at
  BEFORE UPDATE ON public.model_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- AUDIT_LOGS
-- =========================================================
CREATE TABLE public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- STATISTICS_DAILY
-- =========================================================
CREATE TABLE public.statistics_daily (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  sessions_count INTEGER NOT NULL DEFAULT 0,
  total_duration_seconds NUMERIC NOT NULL DEFAULT 0,
  total_alerts INTEGER NOT NULL DEFAULT 0,
  total_yawns INTEGER NOT NULL DEFAULT 0,
  avg_fatigue_score NUMERIC,
  UNIQUE (user_id, day)
);

CREATE INDEX idx_stats_user_day ON public.statistics_daily(user_id, day DESC);

GRANT SELECT ON public.statistics_daily TO authenticated;
GRANT ALL ON public.statistics_daily TO service_role;

ALTER TABLE public.statistics_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own stats"
  ON public.statistics_daily FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all stats"
  ON public.statistics_daily FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
