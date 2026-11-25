-- Phone/password UI logins use a non-deliverable email alias when no SMS/OTP provider is configured.
-- Keep the merchant's actual phone in the profile for owner management and account lookup.
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(user_id, phone, display_name)
  values (
    new.id,
    coalesce(nullif(new.phone,''), nullif(new.raw_user_meta_data->>'phone','')),
    coalesce(new.raw_user_meta_data->>'owner_name','')
  )
  on conflict (user_id) do update
    set phone = coalesce(excluded.phone, public.profiles.phone),
        display_name = coalesce(nullif(excluded.display_name,''), public.profiles.display_name),
        updated_at = now();
  return new;
end;
$$;
