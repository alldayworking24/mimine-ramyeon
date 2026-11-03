-- ADW bank database. Apply only at the later deployment step.
begin;
alter table public.mimine_bank_classifications add column if not exists excluded boolean not null default false;
alter table public.mimine_bank_classifications add column if not exists exclude_reason text not null default '';
alter table public.mimine_bank_classifications add column if not exists exclude_memo text not null default '';
alter table public.mimine_bank_classifications add column if not exists excluded_at timestamptz;
alter table public.mimine_bank_classifications add column if not exists classification_source text not null default 'manual';
alter table public.mimine_bank_classifications add column if not exists alias_id uuid;
create or replace function public.mimine_payer_key(p_value text) returns text language sql immutable parallel safe
 set search_path=pg_catalog as $$select upper(regexp_replace(normalize(trim(coalesce(p_value,'')),NFKC),'\s','','g'))$$;
create table if not exists public.mimine_payer_aliases (
 id uuid primary key default gen_random_uuid(),payer text not null check(length(trim(payer)) between 1 and 100),
 payer_key text generated always as(public.mimine_payer_key(payer)) stored,
 business text not null check(business in ('mimine','adw','other')),
 label text not null default '' check(length(label)<=80), active boolean not null default true,
 updated_by text not null,updated_at timestamptz not null default now()
);
create unique index if not exists mimine_payer_active_key_idx on public.mimine_payer_aliases(payer_key) where active;
alter table public.mimine_payer_aliases enable row level security;
revoke all on public.mimine_payer_aliases from public,anon,authenticated;
grant all on public.mimine_payer_aliases to service_role;

create or replace function public.mimine_apply_payer_aliases(p_actor text,p_event uuid default null)
returns integer language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_count integer;
begin
 perform pg_advisory_xact_lock(7183125);
 insert into public.mimine_bank_classifications(event_id,business,category,note,updated_by,classification_source,alias_id)
 select e.id,a.business,case when a.business='mimine' then 'settlement' else 'other' end,a.label,p_actor,'alias',a.id
 from public.adw_sms_events e join public.mimine_payer_aliases a on a.active and a.payer_key=public.mimine_payer_key(e.payer)
 left join public.mimine_bank_classifications c on c.event_id=e.id
 where (p_event is null or e.id=p_event) and e.payment_id is null and e.customer_id is null
 and (c.event_id is null or (not c.excluded and c.classification_source='alias'))
 and not exists(select 1 from public.mimine_bank_allocations l where l.event_id=e.id)
 and not exists(select 1 from public.adw_sms_aliases aa where aa.active and public.mimine_payer_key(aa.payer)=public.mimine_payer_key(e.payer))
 on conflict(event_id) do update set business=excluded.business,category=excluded.category,note=excluded.note,
 updated_by=excluded.updated_by,updated_at=now(),classification_source='alias',alias_id=excluded.alias_id
 where not mimine_bank_classifications.excluded and mimine_bank_classifications.classification_source='alias';
 get diagnostics v_count=row_count;
 return v_count;
end $$;

create or replace function public.mimine_bank_save_alias(p_id uuid,p_payer text,p_business text,p_label text,p_active boolean,p_actor text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_id uuid:=coalesce(p_id,gen_random_uuid());v_count integer;
begin
 perform pg_advisory_xact_lock(7183125);
 if length(trim(coalesce(p_payer,''))) not between 1 and 100 or p_business not in ('mimine','adw','other') or p_business is null or length(coalesce(p_label,''))>80 then raise exception '입금자명과 사업 구분을 확인해 주세요.';end if;
 if p_id is not null and not exists(select 1 from public.mimine_payer_aliases where id=p_id) then raise exception '입금자명 규칙이 없습니다.';end if;
 if p_active and exists(select 1 from public.mimine_payer_aliases where active and id<>v_id and payer_key=public.mimine_payer_key(p_payer)) then raise exception '이미 사용 중인 입금자명입니다.';end if;
 if p_active and p_business='mimine' and exists(select 1 from public.adw_sms_aliases where active and public.mimine_payer_key(payer)=public.mimine_payer_key(p_payer)) then raise exception '하루온종일 업체에 연결된 입금자명입니다. 해당 연결을 먼저 확인해 주세요.';end if;
 insert into public.mimine_payer_aliases(id,payer,business,label,active,updated_by)
 values(v_id,trim(p_payer),p_business,coalesce(p_label,''),p_active,p_actor)
 on conflict(id) do update set payer=excluded.payer,business=excluded.business,label=excluded.label,active=excluded.active,updated_by=excluded.updated_by,updated_at=now();
 v_count:=case when p_active then public.mimine_apply_payer_aliases(p_actor) else 0 end;
 if p_active then perform public.mimine_bank_auto_match(true,p_actor);end if;
 insert into public.mimine_bank_audit(actor,action,detail) values(p_actor,'payer_alias',jsonb_build_object('alias_id',v_id,'active',p_active,'classified',v_count));
 return jsonb_build_object('id',v_id,'classified',v_count);
end $$;

create or replace function public.mimine_bank_exclude(p_event uuid,p_excluded boolean,p_reason text,p_memo text,p_actor text)
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 perform pg_advisory_xact_lock(7183125);
 perform 1 from public.adw_sms_events where id=p_event for update;
 if not found then raise exception '입금내역이 없습니다.';end if;
 if length(coalesce(p_reason,''))>100 or length(coalesce(p_memo,''))>160 then raise exception '제외 사유 또는 메모를 확인해 주세요.';end if;
 insert into public.mimine_bank_classifications(event_id,business,category,updated_by)
 select id,case when payment_id is not null then 'adw' else 'unclassified' end,'other',p_actor from public.adw_sms_events where id=p_event on conflict(event_id) do nothing;
 if p_excluded then
  delete from public.mimine_bank_allocations where event_id=p_event;
  insert into public.mimine_bank_holds(event_id,updated_by) values(p_event,p_actor) on conflict(event_id) do update set updated_by=excluded.updated_by;
 end if;
 update public.mimine_bank_classifications set excluded=p_excluded,exclude_reason=case when p_excluded then coalesce(p_reason,'') else '' end,
 exclude_memo=case when p_excluded then coalesce(p_memo,'') else '' end,excluded_at=case when p_excluded then now() else null end,updated_by=p_actor,updated_at=now() where event_id=p_event;
 insert into public.mimine_bank_audit(actor,action,detail) values(p_actor,'exclude',jsonb_build_object('event_id',p_event,'excluded',p_excluded));
end $$;

create or replace function public.mimine_bank_exclusion_guard() returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_expected bigint;v_used bigint;
begin
 select card_amount-fee_amount into v_expected from public.mimine_settlements where sale_date=new.sale_date;
 select coalesce(sum(amount),0) into v_used from public.mimine_bank_allocations where sale_date=new.sale_date and event_id<>new.event_id;
 if v_expected is null or new.amount+v_used>v_expected then raise exception '매출일의 남은 정산액을 초과할 수 없습니다.';end if;
 if exists(select 1 from public.mimine_bank_classifications where event_id=new.event_id and excluded) then raise exception '대상 제외한 입금은 연결할 수 없습니다.';end if;
 return new;
end $$;
drop trigger if exists mimine_excluded_allocation_guard on public.mimine_bank_allocations;
create trigger mimine_excluded_allocation_guard before insert or update on public.mimine_bank_allocations for each row execute function public.mimine_bank_exclusion_guard();
revoke all on function public.mimine_apply_payer_aliases(text,uuid),public.mimine_bank_save_alias(uuid,text,text,text,boolean,text),public.mimine_bank_exclude(uuid,boolean,text,text,text),public.mimine_bank_exclusion_guard() from public,anon,authenticated;
grant execute on function public.mimine_apply_payer_aliases(text,uuid),public.mimine_bank_save_alias(uuid,text,text,text,boolean,text),public.mimine_bank_exclude(uuid,boolean,text,text,text),public.mimine_bank_exclusion_guard() to service_role;
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
 where e.amount>0 and e.payment_id is null and e.customer_id is null and s.due_date is not null
 and not exists(select 1 from public.adw_sms_aliases aa where aa.active and public.mimine_payer_key(aa.payer)=public.mimine_payer_key(e.payer))
 and (exists(select 1 from public.mimine_bank_rules r where r.enabled and trim(r.payer)=trim(e.payer) and r.account_suffix=e.account_suffix) or exists(select 1 from public.mimine_payer_aliases a where a.active and a.business='mimine' and a.payer_key=public.mimine_payer_key(e.payer)))
 and not exists(select 1 from public.mimine_bank_classifications c where c.event_id=e.id and c.excluded)
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

create or replace function public.mimine_bank_classify(p_event uuid,p_business text,p_category text,p_note text,p_actor text) returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
declare e public.adw_sms_events;
begin
 perform pg_advisory_xact_lock(7183125);
 select * into e from public.adw_sms_events where id=p_event for update;
 if not found then raise exception '입금내역이 없습니다';end if;
 if e.payment_id is not null and p_business<>'adw' then raise exception '하루온종일 수금에 연결된 입금입니다';end if;
 if exists(select 1 from public.mimine_bank_allocations where event_id=p_event) and (p_business<>'mimine' or p_category<>'settlement') then raise exception '정산 연결을 먼저 해제해 주세요';end if;
 insert into public.mimine_bank_classifications(event_id,business,category,note,updated_by) values(p_event,p_business,p_category,p_note,p_actor)
 on conflict(event_id) do update set business=excluded.business,category=excluded.category,note=excluded.note,updated_by=excluded.updated_by,updated_at=now(),classification_source='manual',alias_id=null;
 insert into public.mimine_bank_audit(actor,action,detail) values(p_actor,'classify',jsonb_build_object('event_id',p_event,'business',p_business,'category',p_category));
end $$;

create or replace function public.mimine_on_sms_payer_alias() returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 perform public.mimine_apply_payer_aliases('sms-payer-rule',new.id);
 if new.payment_id is null and exists(select 1 from public.mimine_payer_aliases where active and business='mimine' and payer_key=public.mimine_payer_key(new.payer)) then
  perform public.mimine_bank_auto_match(true,'sms-payer-rule');
 end if;
 return new;
end $$;
drop trigger if exists mimine_sms_payer_alias on public.adw_sms_events;
create trigger mimine_sms_payer_alias after insert or update of payer,payment_id,customer_id on public.adw_sms_events for each row execute function public.mimine_on_sms_payer_alias();
revoke all on function public.mimine_on_sms_payer_alias() from public,anon,authenticated;
grant execute on function public.mimine_on_sms_payer_alias() to service_role;

create or replace function public.mimine_settlement_amount_guard() returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if new.card_amount-new.fee_amount<(select coalesce(sum(amount),0) from public.mimine_bank_allocations where sale_date=new.sale_date) then raise exception '연결된 입금보다 정산액이 작습니다. 연결을 먼저 해제해 주세요.';end if;
 return new;
end $$;
drop trigger if exists mimine_settlement_amount_guard on public.mimine_settlements;
create trigger mimine_settlement_amount_guard before update on public.mimine_settlements for each row execute function public.mimine_settlement_amount_guard();
revoke all on function public.mimine_settlement_amount_guard() from public,anon,authenticated;
grant execute on function public.mimine_settlement_amount_guard() to service_role;
commit;
