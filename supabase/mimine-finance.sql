create table if not exists public.mimine_bank_access (
 email text primary key, adw_user_id uuid not null references auth.users(id), created_at timestamptz not null default now()
);
insert into public.mimine_bank_access(email,adw_user_id)
select lower(u.email),u.id from auth.users u join public.app_users a on a.user_id=u.id
where lower(u.email)='alldayworking24@gmail.com' and a.is_active and a.role in ('system_admin','admin') on conflict(email) do nothing;
create table if not exists public.mimine_bank_classifications (
 event_id uuid primary key references public.adw_sms_events(id),
 business text not null check(business in ('mimine','adw','other','unclassified')),
 category text not null default 'other' check(category in ('settlement','customer','owner','refund','other')),
 note text not null default '' check(length(note)<=500), updated_by text not null, updated_at timestamptz not null default now()
);
create table if not exists public.mimine_settlements (
 sale_date date primary key, card_amount bigint not null check(card_amount>=0),cash_amount bigint not null check(cash_amount>=0),other_amount bigint not null check(other_amount>=0),
 fee_amount bigint not null check(fee_amount>=0 and fee_amount<=card_amount),due_date date,
 note text not null default '' check(length(note)<=500),source text not null default 'manual' check(source in ('manual','pos')),updated_by text not null,updated_at timestamptz not null default now()
);
create table if not exists public.mimine_bank_allocations (
 event_id uuid references public.adw_sms_events(id),sale_date date references public.mimine_settlements(sale_date),
 amount bigint not null check(amount>0),updated_by text not null,updated_at timestamptz not null default now(),primary key(event_id,sale_date)
);
create table if not exists public.mimine_bank_audit (
 id bigint generated always as identity primary key, actor text not null,action text not null,detail jsonb not null default '{}',created_at timestamptz not null default now()
);
alter table public.mimine_bank_access enable row level security;
alter table public.mimine_bank_classifications enable row level security;
alter table public.mimine_settlements enable row level security;
alter table public.mimine_bank_allocations enable row level security;
alter table public.mimine_bank_audit enable row level security;
revoke all on public.mimine_bank_access,public.mimine_bank_classifications,public.mimine_settlements,public.mimine_bank_allocations,public.mimine_bank_audit from anon,authenticated;
grant all on public.mimine_bank_access,public.mimine_bank_classifications,public.mimine_settlements,public.mimine_bank_allocations,public.mimine_bank_audit to service_role;
grant usage,select on sequence public.mimine_bank_audit_id_seq to service_role;
create or replace function public.mimine_bank_classify(p_event uuid,p_business text,p_category text,p_note text,p_actor text) returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
declare e public.adw_sms_events;
begin
 select * into e from public.adw_sms_events where id=p_event for update;
 if not found then raise exception '입금내역이 없습니다';end if;
 if e.payment_id is not null and p_business<>'adw' then raise exception '하루온종일 수금에 연결된 입금입니다';end if;
 if exists(select 1 from public.mimine_bank_allocations where event_id=p_event) and (p_business<>'mimine' or p_category<>'settlement') then raise exception '정산 연결을 먼저 해제해 주세요';end if;
 insert into public.mimine_bank_classifications(event_id,business,category,note,updated_by) values(p_event,p_business,p_category,p_note,p_actor)
 on conflict(event_id) do update set business=excluded.business,category=excluded.category,note=excluded.note,updated_by=excluded.updated_by,updated_at=now();
 insert into public.mimine_bank_audit(actor,action,detail) values(p_actor,'classify',jsonb_build_object('event_id',p_event,'business',p_business,'category',p_category));
end $$;
create or replace function public.mimine_bank_allocate(p_event uuid,p_date date,p_amount bigint,p_actor text) returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
declare e public.adw_sms_events; c public.mimine_bank_classifications; used numeric; expected numeric;
begin
 select * into e from public.adw_sms_events where id=p_event for update;if not found then raise exception '입금내역이 없습니다';end if;
 perform 1 from public.mimine_settlements where sale_date=p_date for update;if not found then raise exception '매출 정산정보를 먼저 입력해 주세요';end if;
 if p_amount=0 then
 delete from public.mimine_bank_allocations where event_id=p_event and sale_date=p_date;
 else
 if p_amount<0 then raise exception '금액을 확인해 주세요';end if;
 select * into c from public.mimine_bank_classifications where event_id=p_event;
 if c.business is distinct from 'mimine' or c.category is distinct from 'settlement' or e.payment_id is not null then raise exception '미미네 카드정산 입금만 연결할 수 있습니다';end if;
 select coalesce(sum(amount),0) into used from public.mimine_bank_allocations where event_id=p_event and sale_date<>p_date;
 if used+p_amount>e.amount then raise exception '입금액을 초과해 연결할 수 없습니다';end if;
 insert into public.mimine_bank_allocations(event_id,sale_date,amount,updated_by) values(p_event,p_date,p_amount,p_actor)
 on conflict(event_id,sale_date) do update set amount=excluded.amount,updated_by=excluded.updated_by,updated_at=now();
 end if;
 insert into public.mimine_bank_audit(actor,action,detail) values(p_actor,'allocate',jsonb_build_object('event_id',p_event,'sale_date',p_date,'amount',p_amount));
end $$;
revoke all on function public.mimine_bank_classify(uuid,text,text,text,text),public.mimine_bank_allocate(uuid,date,bigint,text) from public,anon,authenticated;
grant execute on function public.mimine_bank_classify(uuid,text,text,text,text),public.mimine_bank_allocate(uuid,date,bigint,text) to service_role;
