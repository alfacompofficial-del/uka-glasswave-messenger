
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_conversation_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.conversation_type_of(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_or_create_direct(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conversation_type_of(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_direct(UUID) TO authenticated;
