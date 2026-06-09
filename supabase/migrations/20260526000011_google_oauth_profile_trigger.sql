-- ============================================================
-- Migration 011: Improve handle_new_user trigger for OAuth providers
-- Handles username conflicts, pulls Google display name and avatar
-- ============================================================

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_username text;
  final_username text;
  counter integer := 0;
begin
  -- Sanitise base username: explicit username field > email prefix > 'user'
  base_username := lower(regexp_replace(
    coalesce(
      nullif(new.raw_user_meta_data->>'username', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    '[^a-z0-9_-]', '_', 'g'
  ));

  if base_username = '' or base_username is null then
    base_username := 'user';
  end if;

  -- Find a unique username by appending _N if needed
  final_username := base_username;
  while exists(select 1 from profiles where username = final_username) loop
    counter := counter + 1;
    final_username := base_username || '_' || counter;
  end loop;

  insert into profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    final_username,
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url'
  );

  return new;
end;
$$;
