
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

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

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  username TEXT UNIQUE,
  phone TEXT,
  country TEXT,
  email TEXT,
  avatar_url TEXT,
  language TEXT NOT NULL DEFAULT 'ru',
  status_text TEXT,
  status_emoji TEXT,
  onboarded BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles readable by authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Admin assignment function
CREATE OR REPLACE FUNCTION public.assign_admin_if_eligible(_user_id UUID, _email TEXT, _phone TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF _phone = '+998994902629'
     OR _email = ANY (ARRAY['akbarovabdulloh2012@gmail.com','alfacompofficial@gmail.com'])
  THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'given_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', NEW.raw_user_meta_data->>'family_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  PERFORM public.assign_admin_if_eligible(NEW.id, NEW.email, NULL);
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Re-check admin when profile phone changes
CREATE OR REPLACE FUNCTION public.tg_profile_admin_check()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.assign_admin_if_eligible(NEW.id, NEW.email, NEW.phone);
  RETURN NEW;
END $$;

CREATE TRIGGER profiles_admin_check
  AFTER INSERT OR UPDATE OF phone, email ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_profile_admin_check();

-- Conversations
CREATE TYPE public.conversation_type AS ENUM ('direct','group','channel');

CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.conversation_type NOT NULL,
  name TEXT,
  description TEXT,
  avatar_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.conversation_members (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_members TO authenticated;
GRANT ALL ON public.conversation_members TO service_role;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_conversation_member(_conv UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = _conv AND user_id = _user)
$$;

CREATE OR REPLACE FUNCTION public.conversation_type_of(_conv UUID)
RETURNS public.conversation_type LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT type FROM public.conversations WHERE id = _conv
$$;

-- Conversations policies
CREATE POLICY "members see conversations" ON public.conversations
  FOR SELECT TO authenticated USING (public.is_conversation_member(id, auth.uid()));
CREATE POLICY "admins see groups and channels" ON public.conversations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND type IN ('group','channel'));
CREATE POLICY "authenticated create conversations" ON public.conversations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "creator updates conversation" ON public.conversations
  FOR UPDATE TO authenticated USING (auth.uid() = created_by);

-- Members policies
CREATE POLICY "members see member rows" ON public.conversation_members
  FOR SELECT TO authenticated USING (public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "admins see group/channel members" ON public.conversation_members
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND public.conversation_type_of(conversation_id) IN ('group','channel'));
CREATE POLICY "user inserts self as member" ON public.conversation_members
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "user removes self" ON public.conversation_members
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Messages — admins CANNOT read
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'text',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX messages_conv_idx ON public.messages(conversation_id, created_at DESC);

-- Members can read messages in groups/channels; admins do NOT get a broader policy here
CREATE POLICY "members read messages" ON public.messages
  FOR SELECT TO authenticated USING (public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "members send messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "sender edits own message" ON public.messages
  FOR UPDATE TO authenticated USING (auth.uid() = sender_id);
CREATE POLICY "sender deletes own message" ON public.messages
  FOR DELETE TO authenticated USING (auth.uid() = sender_id);

-- Contacts
CREATE TABLE public.contacts (
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  custom_first_name TEXT,
  custom_last_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, contact_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages contacts" ON public.contacts
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Helper RPC: find or create direct conversation between two users
CREATE OR REPLACE FUNCTION public.get_or_create_direct(_other UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me UUID := auth.uid(); _conv UUID;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _me = _other THEN RAISE EXCEPTION 'cannot dm self'; END IF;

  SELECT c.id INTO _conv
  FROM public.conversations c
  JOIN public.conversation_members m1 ON m1.conversation_id = c.id AND m1.user_id = _me
  JOIN public.conversation_members m2 ON m2.conversation_id = c.id AND m2.user_id = _other
  WHERE c.type = 'direct'
  LIMIT 1;

  IF _conv IS NOT NULL THEN RETURN _conv; END IF;

  INSERT INTO public.conversations (type, created_by) VALUES ('direct', _me) RETURNING id INTO _conv;
  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (_conv, _me), (_conv, _other);
  RETURN _conv;
END $$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;

-- Avatars storage bucket created via tool below
