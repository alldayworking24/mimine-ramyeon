-- Manual deposit records and reversible hiding; applied with the 2026-11-27 release.
begin;
alter table public.mimine_bank_classifications add column if not exists hidden boolean not null default false;
create table if not exists public.mimine_manual_deposits (
 request_id uuid primary key,event_id uuid not null unique references public.adw_sms_events(id),
 actor text not null,note text not null default '',created_at timestamptz not null default now()
);
alter table public.mimine_manual_deposits enable row level security;
revoke all on public.mimine_manual_deposits from public,anon,authenticated;
grant all on public.mimine_manual_deposits to service_role;
-- Manual classification is chosen by the user before any matching is allowed.
create or replace function public.mimine_on_sms_payer_alias() returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if new.reason='mimine_manual' then return new;end if;
 perform public.mimine_apply_payer_aliases('sms-payer-rule',new.id);
 if new.payment_id is null and exists(select 1 from public.mimine_payer_aliases where active and business='mimine' and payer_key=public.mimine_payer_key(new.payer)) then
  perform public.mimine_bank_auto_match(true,'sms-payer-rule');
 end if;
 return new;
end $$;
revoke all on function public.mimine_on_sms_payer_alias() from public,anon,authenticated;
grant execute on function public.mimine_on_sms_payer_alias() to service_role;
create or replace function public.mimine_manual_deposit(p_request uuid,p_actor text,p_owner uuid,p_payer text,p_amount bigint,p_occurred timestamptz,p_business text,p_note text) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_event uuid;v_device uuid;v_existing public.mimine_manual_deposits;
begin
 if not exists(select 1 from public.mimine_bank_access where email=p_actor and adw_user_id=p_owner) then raise exception '통장 권한이 없습니다.';end if;
 if p_request is null or length(trim(coalesce(p_payer,''))) not between 1 and 100 or p_amount is null or p_amount not between 1 and 10000000000 or p_occurred is null or p_occurred>now() or p_business not in ('mimine','adw','other','unclassified') or length(coalesce(p_note,''))>500 then raise exception '수동 입금 정보를 확인해 주세요.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,719824));
 select * into v_existing from public.mimine_manual_deposits where request_id=p_request;
 if found then if v_existing.actor<>p_actor then raise exception '다른 계정의 요청입니다.';end if;return jsonb_build_object('eventId',v_existing.event_id,'duplicate',true);end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,719825));
 select id into v_device from public.adw_sms_devices where owner_id=p_owner and name='미미네 수동 입력 전용' and not enabled order by created_at limit 1;
 if v_device is null then insert into public.adw_sms_devices(name,owner_id,token_hash,enabled,auto_apply) values('미미네 수동 입력 전용',p_owner,md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text),false,false) returning id into v_device;end if;
 insert into public.adw_sms_events(device_id,dedupe_key,account_suffix,payer,payer_key,amount,occurred_at,status,reason,actor_id)
 values(v_device,md5('mimine-manual:'||p_request::text)||md5(p_actor||p_request::text),'665121',trim(p_payer),public.mimine_payer_key(p_payer),p_amount,p_occurred,'ignored','mimine_manual',p_owner) returning id into v_event;
 insert into public.mimine_bank_classifications(event_id,business,category,note,updated_by,classification_source)
 values(v_event,p_business,'other',coalesce(p_note,''),p_actor,'manual') on conflict(event_id) do update set business=p_business,category='other',note=coalesce(p_note,''),updated_by=p_actor,classification_source='manual',alias_id=null;
 insert into public.mimine_manual_deposits(request_id,event_id,actor,note) values(p_request,v_event,p_actor,coalesce(p_note,''));
 insert into public.mimine_bank_audit(actor,action,detail) values(p_actor,'manual_deposit',jsonb_build_object('event_id',v_event));
 return jsonb_build_object('eventId',v_event,'duplicate',false);
end $$;
create or replace function public.mimine_bank_hide(p_event uuid,p_hidden boolean,p_actor text) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if not exists(select 1 from public.mimine_bank_access where email=p_actor) then raise exception '통장 권한이 없습니다.';end if;
 if p_hidden is null then raise exception '숨김 상태를 확인해 주세요.';end if;
 if exists(select 1 from public.adw_sms_events where id=p_event and (payment_id is not null or customer_id is not null)) then raise exception '하루온종일 연결 내역은 해당 앱에서 먼저 확인해 주세요.';end if;
 if p_hidden then perform public.mimine_bank_exclude(p_event,true,'테스트·잘못 등록한 내역','전체 합계와 매칭에서 숨김',p_actor);end if;
 update public.mimine_bank_classifications set hidden=p_hidden,updated_by=p_actor,updated_at=now() where event_id=p_event;
 if not found then raise exception '입금 내역을 찾을 수 없습니다.';end if;
 insert into public.mimine_bank_audit(actor,action,detail) values(p_actor,'hide_deposit',jsonb_build_object('event_id',p_event,'hidden',p_hidden));
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.mimine_manual_deposit(uuid,text,uuid,text,bigint,timestamptz,text,text),public.mimine_bank_hide(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.mimine_manual_deposit(uuid,text,uuid,text,bigint,timestamptz,text,text),public.mimine_bank_hide(uuid,boolean,text) to service_role;
commit;
