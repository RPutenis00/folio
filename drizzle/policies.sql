-- =====================================================================
-- Folio — RLS policies, triggers, and Storage buckets.
-- Run with `pnpm db:policies` AFTER `pnpm db:push`.
-- Idempotent — safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper: updated_at trigger
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
           and tablename in ('profiles','assets','transactions','properties','rental_scenarios')
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at()', t);
  end loop;
end$$;

-- ---------------------------------------------------------------------
-- Trigger: on auth.users insert → create profile + enforce invite gate
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_invited boolean;
begin
  v_email := lower(new.email);

  select exists(select 1 from public.invited_emails where lower(email) = v_email)
    into v_invited;

  if not v_invited then
    -- Not on the allowlist. Refuse signup. The Supabase auth callback will
    -- bubble this as an error and we redirect to /denied client-side.
    raise exception 'Email not invited' using errcode = '42501';
  end if;

  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- RLS — enable on every table, then add scoped policies.
-- ---------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.invited_emails    enable row level security;
alter table public.assets            enable row level security;
alter table public.transactions      enable row level security;
alter table public.properties        enable row level security;
alter table public.rental_scenarios  enable row level security;
alter table public.price_snapshots   enable row level security;
alter table public.holdings_snapshots enable row level security;
alter table public.fx_rates          enable row level security;
alter table public.attachments       enable row level security;

-- Wipe any prior policies to make this idempotent. ----------------------
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I',
                   r.policyname, r.schemaname, r.tablename);
  end loop;
end$$;

-- profiles ---------------------------------------------------------------
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and is_admin = (select is_admin from public.profiles where id = auth.uid()));

create policy "profiles_admin_select_all" on public.profiles
  for select using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true
  ));

create policy "profiles_admin_update_all" on public.profiles
  for update using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true
  ));

-- invited_emails — all authed users read; admins write -------------------
create policy "invited_select_authed" on public.invited_emails
  for select using (auth.role() = 'authenticated');

create policy "invited_admin_insert" on public.invited_emails
  for insert with check (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true
  ));

create policy "invited_admin_update" on public.invited_emails
  for update using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true
  ));

create policy "invited_admin_delete" on public.invited_emails
  for delete using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true
  ));

-- assets -----------------------------------------------------------------
create policy "assets_owner_all" on public.assets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- transactions -----------------------------------------------------------
create policy "transactions_owner_all" on public.transactions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- properties — join through assets ---------------------------------------
create policy "properties_owner_all" on public.properties
  for all
  using (exists (
    select 1 from public.assets a where a.id = properties.asset_id and a.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.assets a where a.id = properties.asset_id and a.user_id = auth.uid()
  ));

-- rental_scenarios — join through properties → assets --------------------
create policy "rental_scenarios_owner_all" on public.rental_scenarios
  for all
  using (exists (
    select 1 from public.assets a
    where a.id = rental_scenarios.property_id and a.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.assets a
    where a.id = rental_scenarios.property_id and a.user_id = auth.uid()
  ));

-- price_snapshots — readable by all authed; writes via service role only -
create policy "price_snapshots_select_authed" on public.price_snapshots
  for select using (auth.role() = 'authenticated');

-- holdings_snapshots — owner read, service-role write -------------------
create policy "holdings_snapshots_owner_select" on public.holdings_snapshots
  for select using (user_id = auth.uid());

-- fx_rates — readable by all authed --------------------------------------
create policy "fx_rates_select_authed" on public.fx_rates
  for select using (auth.role() = 'authenticated');

-- attachments — owner only ----------------------------------------------
create policy "attachments_owner_all" on public.attachments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Storage buckets + policies
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('properties', 'properties', false),
  ('receipts',   'receipts',   false)
on conflict (id) do nothing;

-- Wipe any prior storage policies for these buckets ---------------------
do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname='storage' and tablename='objects'
    and policyname like 'folio_%'
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end$$;

-- Path convention: {user_id}/{related_id}/{filename}
-- (storage.foldername(path) returns text[] for the path segments)
create policy "folio_storage_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('properties','receipts')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "folio_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('properties','receipts')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "folio_storage_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('properties','receipts')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "folio_storage_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('properties','receipts')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
