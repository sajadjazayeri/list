-- Run once in Supabase SQL Editor. All changes commit together or roll back.
-- Private household data: only authenticated members can read or modify it.
begin;
create table public.lu_homes (
 id uuid primary key default gen_random_uuid(),
 invite_hash bytea,
 invite_expires timestamptz,
 created_at timestamptz not null default now()
);
create table public.lu_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 home_id uuid not null references public.lu_homes(id) on delete cascade
);
create index lu_members_home on public.lu_members(home_id);
create table public.lu_items (
 id uuid primary key default gen_random_uuid(),
 home_id uuid not null references public.lu_homes(id) on delete cascade,
 kind text not null check(kind in ('shopping','todo')),
 title text not null check(length(trim(title)) between 1 and 160),
 store text not null default '' check(length(store)<=40),
 done boolean not null default false,
 created_at timestamptz not null default now()
);
create index lu_items_home on public.lu_items(home_id,created_at);
alter table public.lu_homes enable row level security;
alter table public.lu_members enable row level security;
alter table public.lu_items enable row level security;
-- This helper avoids recursive membership policies. It returns only the caller's home.
create function public.lu_my_home() returns uuid
language sql stable security definer set search_path = '' as $$
 select home_id from public.lu_members where user_id=auth.uid();
$$;
create policy members_read on public.lu_members for select to authenticated
 using(home_id=public.lu_my_home());
create policy items_read on public.lu_items for select to authenticated
 using(home_id=public.lu_my_home());
create policy items_insert on public.lu_items for insert to authenticated
 with check(home_id=public.lu_my_home());
create policy items_update on public.lu_items for update to authenticated
 using(home_id=public.lu_my_home()) with check(home_id=public.lu_my_home());
create policy items_delete on public.lu_items for delete to authenticated
 using(home_id=public.lu_my_home());
-- Household creation, pairing and invitation secrets are only accessible via these functions.
create function public.lu_create_home() returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select home_id into result from public.lu_members where user_id=auth.uid();
 if result is not null then return result; end if;
 insert into public.lu_homes default values returning id into result;
 insert into public.lu_members values(auth.uid(),result);
 return result;
end;
$$;
create function public.lu_invite() returns text
language plpgsql security definer set search_path = '' as $$
declare h uuid; code text;
begin
 h:=public.lu_my_home();
 if h is null then raise exception 'Create your space first.'; end if;
 perform 1 from public.lu_homes where id=h for update;
 if (select count(*) from public.lu_members where home_id=h)>=2 then raise exception 'Your space already has two people.'; end if;
 code:=upper(replace(gen_random_uuid()::text,'-',''));
 update public.lu_homes set invite_hash=sha256(convert_to(code,'UTF8')),invite_expires=now()+interval '24 hours' where id=h;
 return code;
end;
$$;
create function public.lu_join_home(invitation text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare h uuid; existing uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select id into h from public.lu_homes where invite_hash=sha256(convert_to(upper(trim(invitation)),'UTF8')) and invite_expires>now() for update;
 if h is null then raise exception 'That invitation has expired or already been used.'; end if;
 existing:=public.lu_my_home();
 if existing=h then raise exception 'Send this invitation to your partner.'; end if;
 if existing is not null then raise exception 'This account already belongs to a space. Use a new account to join.'; end if;
 if (select count(*) from public.lu_members where home_id=h)>=2 then raise exception 'Your space already has two people.'; end if;
 insert into public.lu_members values(auth.uid(),h);
 update public.lu_homes set invite_hash=null,invite_expires=null where id=h;
 return h;
end;
$$;
-- Explicit privileges work even when automatic table exposure is disabled.
revoke all on public.lu_homes,public.lu_members,public.lu_items from anon,authenticated;
grant usage on schema public to authenticated;
grant select on public.lu_members to authenticated;
grant select,insert,delete on public.lu_items to authenticated;
grant update(done) on public.lu_items to authenticated;
revoke all on function public.lu_my_home(),public.lu_create_home(),public.lu_invite(),public.lu_join_home(text) from public,anon;
grant execute on function public.lu_my_home(),public.lu_create_home(),public.lu_invite(),public.lu_join_home(text) to authenticated;
commit;
