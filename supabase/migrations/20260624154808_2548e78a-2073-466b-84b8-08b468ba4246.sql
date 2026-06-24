
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invite_slug text UNIQUE;

UPDATE public.conversation_members cm
SET role = 'owner'
FROM public.conversations c
WHERE cm.conversation_id = c.id
  AND cm.user_id = c.created_by
  AND cm.role <> 'owner';

CREATE OR REPLACE FUNCTION public.member_role(_conv uuid, _user uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.conversation_members WHERE conversation_id = _conv AND user_id = _user
$$;

CREATE OR REPLACE FUNCTION public.can_view_members(_conv uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN (SELECT type FROM public.conversations WHERE id = _conv) = 'channel'
      THEN public.member_role(_conv, _user) IN ('owner','admin')
    ELSE public.is_conversation_member(_conv, _user)
  END
$$;

DROP POLICY IF EXISTS "members see member rows" ON public.conversation_members;
CREATE POLICY "members see member rows" ON public.conversation_members
FOR SELECT USING (
  auth.uid() = user_id OR public.can_view_members(conversation_id, auth.uid())
);

DROP POLICY IF EXISTS "public conversations discoverable" ON public.conversations;
CREATE POLICY "public conversations discoverable" ON public.conversations
FOR SELECT USING (is_public = true);

CREATE OR REPLACE FUNCTION public.create_group_or_channel(
  _type conversation_type, _name text, _avatar_url text,
  _is_public boolean, _member_ids uuid[]
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _conv uuid; _slug text; _u uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _type NOT IN ('group','channel') THEN RAISE EXCEPTION 'invalid type'; END IF;
  IF coalesce(btrim(_name),'') = '' THEN RAISE EXCEPTION 'name required'; END IF;
  _slug := lower(substr(md5(random()::text || clock_timestamp()::text), 1, 10));
  INSERT INTO public.conversations (type, name, avatar_url, is_public, invite_slug, created_by)
  VALUES (_type, _name, _avatar_url, coalesce(_is_public, false), _slug, _me)
  RETURNING id INTO _conv;
  INSERT INTO public.conversation_members (conversation_id, user_id, role)
  VALUES (_conv, _me, 'owner');
  IF _member_ids IS NOT NULL THEN
    FOREACH _u IN ARRAY _member_ids LOOP
      IF _u <> _me THEN
        INSERT INTO public.conversation_members (conversation_id, user_id, role)
        VALUES (_conv, _u, 'member') ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;
  RETURN _conv;
END $$;

CREATE OR REPLACE FUNCTION public.set_member_role(_conv uuid, _user uuid, _role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _my_role text; _target_role text;
BEGIN
  _my_role := public.member_role(_conv, _me);
  IF _my_role <> 'owner' THEN RAISE EXCEPTION 'only owner can change roles'; END IF;
  IF _role NOT IN ('admin','member') THEN RAISE EXCEPTION 'invalid role'; END IF;
  _target_role := public.member_role(_conv, _user);
  IF _target_role IS NULL THEN RAISE EXCEPTION 'not a member'; END IF;
  IF _target_role = 'owner' THEN RAISE EXCEPTION 'cannot change owner'; END IF;
  UPDATE public.conversation_members SET role = _role
    WHERE conversation_id = _conv AND user_id = _user;
END $$;

CREATE OR REPLACE FUNCTION public.remove_member(_conv uuid, _user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _my_role text; _target_role text;
BEGIN
  _my_role := public.member_role(_conv, _me);
  _target_role := public.member_role(_conv, _user);
  IF _target_role IS NULL THEN RETURN; END IF;
  IF _target_role = 'owner' THEN RAISE EXCEPTION 'cannot remove owner'; END IF;
  IF _my_role = 'owner' THEN NULL;
  ELSIF _my_role = 'admin' AND _target_role = 'member' THEN NULL;
  ELSE RAISE EXCEPTION 'not allowed';
  END IF;
  DELETE FROM public.conversation_members WHERE conversation_id = _conv AND user_id = _user;
END $$;

CREATE OR REPLACE FUNCTION public.add_members(_conv uuid, _user_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _my_role text; _u uuid;
BEGIN
  _my_role := public.member_role(_conv, _me);
  IF _my_role NOT IN ('owner','admin') THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF _user_ids IS NULL THEN RETURN; END IF;
  FOREACH _u IN ARRAY _user_ids LOOP
    INSERT INTO public.conversation_members (conversation_id, user_id, role)
    VALUES (_conv, _u, 'member') ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.update_conversation(
  _conv uuid, _name text, _avatar_url text, _description text,
  _is_public boolean, _invite_slug text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _my_role text;
BEGIN
  _my_role := public.member_role(_conv, _me);
  IF _my_role NOT IN ('owner','admin') THEN RAISE EXCEPTION 'not allowed'; END IF;
  UPDATE public.conversations SET
    name = COALESCE(_name, name),
    avatar_url = COALESCE(_avatar_url, avatar_url),
    description = COALESCE(_description, description),
    is_public = COALESCE(_is_public, is_public),
    invite_slug = COALESCE(_invite_slug, invite_slug),
    updated_at = now()
  WHERE id = _conv;
END $$;

CREATE OR REPLACE FUNCTION public.join_by_slug(_slug text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _conv uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT id INTO _conv FROM public.conversations WHERE invite_slug = _slug AND is_public = true;
  IF _conv IS NULL THEN RAISE EXCEPTION 'invite not found'; END IF;
  INSERT INTO public.conversation_members (conversation_id, user_id, role)
  VALUES (_conv, _me, 'member') ON CONFLICT DO NOTHING;
  RETURN _conv;
END $$;
