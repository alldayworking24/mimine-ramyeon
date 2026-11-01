-- Apply after mimine-finance.sql, in ADW bank database. Not applied to production.
begin;
create table if not exists public.mimine_bank_rules (
 id uuid primary key default gen_random_uuid(), payer text not null check(length(trim(payer)) between 1 and 100),
 account_suffix text not null check(account_suffix ~ '^[0-9]{2,8}$'), enabled boolean not null default false,
 updated_by text not null, updated_at timestamptz not null default now(), unique(payer,account_suffix)
);
create table if not exists public.mimine_bank_holds (
 event_id uuid primary key references public.adw_sms_events(id), updated_by text not null,created_at timestamptz not null default now()
);
alter table public.mimine_bank_rules enable row level security;
alter table public.mimine_bank_holds enable row level security;
revoke all on public.mimine_bank_rules,public.mimine_bank_holds from public,anon,authenticated;
grant all on public.mimine_bank_rules,public.mimine_bank_holds to service_role;
alter table public.mimine_bank_allocations add column if not exists match_source text not null default 'manual';
alter table public.mimine_bank_allocations add column if not exists match_reason text not null default '';
-- Database serializes automatic and manual writes. Prevents races and repeated allocation.
create or replace function public.mimine_bank_write_lock() returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin perform pg_advisory_xact_lock(7183125);return null;end $$;
drop trigger if exists mimine_matching_lock on public.mimine_bank_allocations;
create trigger mimine_matching_lock before insert or update or delete on public.mimine_bank_allocations for each statement execute function public.mimine_bank_write_lock();
drop trigger if exists mimine_matching_lock on public.mimine_settlements;
create trigger mimine_matching_lock before insert or update or delete on public.mimine_settlements for each statement execute function public.mimine_bank_write_lock();
drop trigger if exists mimine_matching_lock on public.mimine_bank_classifications;
create trigger mimine_matching_lock before insert or update or delete on public.mimine_bank_classifications for each statement execute function public.mimine_bank_write_lock();
create or replace function public.mimine_bank_auto_match(p_apply boolean,p_actor text) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare item record; results jsonb := '[]'; choices jsonb; n integer:=0;
begin
 perform pg_advisory_xact_lock(7183125);
 -- Materialize complete bipartite candidates BEFORE choosing. Do not greedily consume ambiguous deposits.
 select coalesce(jsonb_agg(to_jsonb(q)),'[]') into choices from (
 select e.id event_id,e.payer,e.amount,s.sale_date,
 count(*) over(partition by e.id) event_options,count(*) over(partition by s.sale_date) sale_options
 from public.adw_sms_events e join public.mimine_settlements s
 on (e.occurred_at at time zone 'Asia/Seoul')::date=s.due_date and e.amount=s.card_amount-s.fee_amount
 where e.amount>0 and e.payment_id is null and s.due_date is not null
 and exists(select 1 from public.mimine_bank_rules r where r.enabled and trim(r.payer)=trim(e.payer) and r.account_suffix=e.account_suffix)
 and not exists(select 1 from public.mimine_bank_holds h where h.event_id=e.id)
 and not exists(select 1 from public.mimine_bank_allocations a where a.event_id=e.id or a.sale_date=s.sale_date)
 and not exists(select 1 from public.mimine_bank_classifications c where c.event_id=e.id and (c.business not in ('unclassified','mimine') or (c.business='mimine' and c.category<>'settlement')))
 ) q;
 for item in select * from jsonb_to_recordset(choices) as x(event_id uuid,payer text,amount bigint,sale_date date,event_options bigint,sale_options bigint) order by sale_date,event_id loop
 if item.event_options=1 and item.sale_options=1 then
 if p_apply then
 perform public.mimine_bank_classify(item.event_id,'mimine','settlement','자동 매칭: 등록 입금자·계좌·예정일·정산액 일치',p_actor);
 perform public.mimine_bank_allocate(item.event_id,item.sale_date,item.amount,p_actor);
 update public.mimine_bank_allocations set match_source='auto',match_reason='등록 입금자·계좌·예정일·정산액 일치 / 양방향 단일 후보' where event_id=item.event_id and sale_date=item.sale_date;
 end if;
 n:=n+1;
 results:=results||jsonb_build_array(jsonb_build_object('event_id',item.event_id,'sale_date',item.sale_date,'amount',item.amount,'payer',item.payer,'status',case when p_apply then 'matched' else 'ready' end));
 else
 results:=results||jsonb_build_array(jsonb_build_object('event_id',item.event_id,'sale_date',item.sale_date,'amount',item.amount,'payer',item.payer,'status','ambiguous'));
 end if;
 end loop;
 if p_apply then insert into public.mimine_bank_audit(actor,action,detail) values(p_actor,'auto_match',jsonb_build_object('matched',n));end if;
 return jsonb_build_object('matched',case when p_apply then n else 0 end,'ready',n,'results',results,'checked_at',now());
end $$;
create or replace function public.mimine_bank_unlink(p_event uuid,p_date date,p_actor text) returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 perform pg_advisory_xact_lock(7183125);
 insert into public.mimine_bank_holds(event_id,updated_by) values(p_event,p_actor) on conflict(event_id) do update set updated_by=excluded.updated_by;
 perform public.mimine_bank_allocate(p_event,p_date,0,p_actor);
end $$;
-- Shared source must never be assigned to both businesses.
create or replace function public.mimine_bank_protect_assignment() returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 perform pg_advisory_xact_lock(7183125);
 if new.payment_id is not null and exists(select 1 from public.mimine_bank_allocations where event_id=new.id) then
 raise exception '미미네 정산에 연결된 입금입니다. 연결을 먼저 해제해 주세요';
 end if;
 return new;
end $$;
drop trigger if exists mimine_protect_shared_assignment on public.adw_sms_events;
create trigger mimine_protect_shared_assignment before update of payment_id on public.adw_sms_events for each row execute function public.mimine_bank_protect_assignment();
revoke all on function public.mimine_bank_protect_assignment() from public,anon,authenticated;
grant execute on function public.mimine_bank_protect_assignment() to service_role;
revoke all on function public.mimine_bank_auto_match(boolean,text),public.mimine_bank_unlink(uuid,date,text),public.mimine_bank_write_lock() from public,anon,authenticated;
grant execute on function public.mimine_bank_auto_match(boolean,text),public.mimine_bank_unlink(uuid,date,text),public.mimine_bank_write_lock() to service_role;
commit;
