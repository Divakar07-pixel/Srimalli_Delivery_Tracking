-- FIRST ADMIN SETUP
--
-- 1. Create an email/password user in Supabase Dashboard:
--    Authentication > Users > Add user.
--    Alternatively, create the user through a trusted server using the
--    Supabase Admin API. Do not place a service-role key in this web app.
--
-- 2. Replace the two placeholder values below and run this in SQL Editor.
--    This assigns the explicit application role used by migration 0005.
--
-- This SQL intentionally does NOT insert directly into auth.users. Supabase
-- Auth owns that schema and the Dashboard/Admin API correctly handles the
-- password hash, identity row, confirmation state, and session lifecycle.

do $$
declare
  v_email text := 'admin@example.com'; -- replace before executing
  v_name text := 'Srimalli Administrator'; -- replace before executing
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where email = v_email;

  if v_user_id is null then
    raise exception 'No auth user exists for %. Create it in Authentication > Users first.', v_email;
  end if;

  insert into public.profiles (id, name, email, role)
  values (v_user_id, v_name, v_email, 'admin')
  on conflict (id) do update
    set name = excluded.name,
        email = excluded.email,
        role = 'admin';
end;
$$;
