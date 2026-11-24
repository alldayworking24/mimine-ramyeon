begin;
create or replace function public.mimine_save_expense(p_request_id uuid,p_expense jsonb) returns jsonb
 language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_id bigint;v_amount bigint;v_date date;v_existing public.mimine_finance_requests;
begin
 if not exists(select 1 from public.app_users u where u.user_id=(select auth.uid()) and u.is_active) then raise exception '사용 권한이 없습니다.';end if;
 if p_request_id is null then raise exception '저장 요청을 확인해 주세요.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,7183127));
 select * into v_existing from public.mimine_finance_requests where id=p_request_id;
 if found then return jsonb_build_object('id',v_existing.expense_id,'duplicate',true);end if;
 v_amount:=(p_expense->>'amount')::bigint;v_date:=(p_expense->>'date')::date;
 if v_amount is null or v_amount not between 1 and 10000000000 or v_date is null or length(trim(coalesce(p_expense->>'vendor','')))=0 then raise exception '날짜·금액·사용처를 확인해 주세요.';end if;
 if nullif(p_expense->>'id','') is not null then
  update public.expenses set expense_date=v_date,category=coalesce(nullif(p_expense->>'category',''),'기타'),amount=v_amount,vendor=p_expense->>'vendor',memo=nullif(p_expense->>'note',''),updated_at=now() where id=(p_expense->>'id')::bigint returning id into v_id;
  if not found then raise exception '수정할 비용 내역이 없습니다.';end if;
 else
  insert into public.expenses(expense_date,category,amount,vendor,memo) values(v_date,coalesce(nullif(p_expense->>'category',''),'기타'),v_amount,p_expense->>'vendor',nullif(p_expense->>'note','')) returning id into v_id;
 end if;
 insert into public.mimine_finance_requests(id,created_by,expense_id) values(p_request_id,(select auth.uid()),v_id);
 return jsonb_build_object('id',v_id,'duplicate',false);
end $$;
revoke all on function public.mimine_save_expense(uuid,jsonb) from public,anon;
grant execute on function public.mimine_save_expense(uuid,jsonb) to authenticated;
commit;
