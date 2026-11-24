-- Prepared only: apply to the main Mimine database when deployment is authorized.
begin;
create or replace function public.mimine_review_stocktake(p_product_id bigint,p_count integer,p_expected integer,p_memo text) returns bigint
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_book integer;
begin
 if not exists(select 1 from public.app_users where user_id=(select auth.uid()) and is_active) then raise exception '사용 권한이 없습니다.';end if;
 if p_count is null or p_expected is null or p_count<0 or p_count>100000 or length(coalesce(p_memo,''))>500 then raise exception '수량·메모를 확인해 주세요.';end if;
 perform 1 from public.products where id=p_product_id for update;
 if not found then raise exception '상품을 찾을 수 없습니다.';end if;
 perform 1 from public.product_purchase_batches where product_id=p_product_id order by id for update;
 select coalesce(sum(remaining_quantity),0)::integer into v_book from public.product_purchase_batches where product_id=p_product_id;
 if v_book<>p_expected then raise exception '재고가 다른 작업으로 변경되었습니다. 최신 수량을 확인한 뒤 다시 등록해 주세요.';end if;
 return public.stocktake_mimine_inventory(p_product_id,p_count,p_memo);
end $$;
revoke all on function public.mimine_review_stocktake(bigint,integer,integer,text) from public,anon;
grant execute on function public.mimine_review_stocktake(bigint,integer,integer,text) to authenticated;
create or replace function public.mimine_update_batch_expiries(p_product_id bigint,p_batches jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_item jsonb;v_id bigint;v_date date;
begin
 if not exists(select 1 from public.app_users where user_id=(select auth.uid()) and is_active) then raise exception '사용 권한이 없습니다.';end if;
 if p_batches is null or jsonb_typeof(p_batches)<>'array' or jsonb_array_length(p_batches) not between 1 and 100 then raise exception '입고분을 확인해 주세요.';end if;
 for v_item in select value from jsonb_array_elements(p_batches) loop
  v_id:=(v_item->>'id')::bigint;v_date:=nullif(v_item->>'expiry','')::date;
  update public.product_purchase_batches set expiration_date=v_date,updated_at=now() where id=v_id and product_id=p_product_id;
  if not found then raise exception '상품의 입고분을 찾을 수 없습니다.';end if;
 end loop;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.mimine_update_batch_expiries(bigint,jsonb) from public,anon;
grant execute on function public.mimine_update_batch_expiries(bigint,jsonb) to authenticated;
commit;
