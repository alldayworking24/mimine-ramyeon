-- Main Mimine database. Additive schema; existing finance and inventory stay authoritative.
begin;
alter table public.expenses add column if not exists vendor text;
alter table public.product_purchase_batches add column if not exists sale_price bigint check (sale_price >= 0);
create table if not exists public.mimine_stock_documents (
 id uuid primary key,
 fingerprint text unique,
 document_type text not null check(document_type in ('receipt','inbound','product')),
 purchase_date date not null,
 supplier text not null default '',
 total bigint not null check(total between 0 and 10000000000),
 item_subtotal bigint not null check(item_subtotal between 0 and 10000000000),
 items jsonb not null check(jsonb_typeof(items)='array'),
 image_data text not null default '' check(octet_length(image_data)<=500000),
 raw_text text not null default '' check(length(raw_text)<=60000),
 expense_id bigint references public.expenses(id) on delete set null,
 created_by uuid not null default auth.uid(),
 created_at timestamptz not null default now()
);
create index if not exists mimine_stock_documents_date_idx on public.mimine_stock_documents(purchase_date desc,created_at desc);
create index if not exists mimine_stock_documents_expense_idx on public.mimine_stock_documents(expense_id) where expense_id is not null;
alter table public.mimine_stock_documents enable row level security;
drop policy if exists active_users_read_stock_documents on public.mimine_stock_documents;
create policy active_users_read_stock_documents on public.mimine_stock_documents for select to authenticated
 using(exists(select 1 from public.app_users u where u.user_id=(select auth.uid()) and u.is_active));
drop policy if exists active_users_insert_stock_documents on public.mimine_stock_documents;
create policy active_users_insert_stock_documents on public.mimine_stock_documents for insert to authenticated
 with check(created_by=(select auth.uid()) and exists(select 1 from public.app_users u where u.user_id=(select auth.uid()) and u.is_active));
revoke all on public.mimine_stock_documents from public,anon,authenticated;
grant select,insert on public.mimine_stock_documents to authenticated;
grant all on public.mimine_stock_documents to service_role;

-- A single transaction writes products, price, batches, document, and optional expense.
-- The request ID/fingerprint also makes a network retry safe.
create or replace function public.mimine_receive_stock(p_request_id uuid,p_document jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare
 v_existing public.mimine_stock_documents; v_product public.products;
 v_type text:=p_document->>'type'; v_date date; v_supplier text:=trim(coalesce(p_document->>'supplier',''));
 v_fingerprint text:=nullif(p_document->>'fingerprint',''); v_items jsonb:=p_document->'items';
 v_item jsonb; v_saved jsonb:='[]'; v_pid bigint; v_batch bigint; v_qty integer; v_cost bigint; v_price bigint;
 v_name text; v_sku text; v_category text; v_min integer; v_expiry date;
 v_subtotal bigint:=0; v_total bigint; v_expense bigint; v_image text:=coalesce(p_document->>'imageData','');
 v_raw text:=coalesce(p_document->>'rawText','');
begin
 if not exists(select 1 from public.app_users u where u.user_id=(select auth.uid()) and u.is_active) then
  raise exception '활성 사용자만 입고를 저장할 수 있습니다.';
 end if;
 if p_request_id is null or v_type not in ('receipt','inbound','product') or v_type is null then raise exception '입고 요청을 확인해 주세요.';end if;
 if jsonb_typeof(v_items) is distinct from 'array' or jsonb_array_length(v_items) not between 1 and 100 then raise exception '입고할 품목은 1~100개입니다.';end if;
 v_date:=(p_document->>'date')::date;
 if v_date is null or v_date>(now() at time zone 'Asia/Seoul')::date then raise exception '입고일을 확인해 주세요.';end if;
 if length(v_supplier)>80 or length(v_raw)>60000 or octet_length(v_image)>500000 then raise exception '영수증 크기 또는 구매처를 확인해 주세요.';end if;
 if v_image<>'' and v_image !~ '^data:image/(jpeg|png);base64,[A-Za-z0-9+/=]+$' then raise exception '지원하는 영수증 사진이 아닙니다.';end if;
 if v_fingerprint is not null and length(v_fingerprint)>200 then raise exception '영수증 정보를 확인해 주세요.';end if;
 perform pg_advisory_xact_lock(7183126);
 select * into v_existing from public.mimine_stock_documents where id=p_request_id or (v_fingerprint is not null and fingerprint=v_fingerprint) limit 1;
 if found then return jsonb_build_object('id',v_existing.id,'duplicate',true,'total',v_existing.total);end if;
 for v_item in select value from jsonb_array_elements(v_items) loop
  if coalesce(v_item->>'qty','') !~ '^\d+$' or coalesce(v_item->>'cost','') !~ '^\d+$' or coalesce(v_item->>'price','') !~ '^\d+$' then raise exception '수량·원가·판매가를 확인해 주세요.';end if;
  v_qty:=(v_item->>'qty')::integer;v_cost:=(v_item->>'cost')::bigint;v_price:=(v_item->>'price')::bigint;
  if v_qty not between 0 and 100000 or (v_type<>'product' and v_qty=0) or v_cost not between 0 and 1000000000 or v_price not between 1 and 1000000000 then raise exception '수량·원가·판매가 범위를 확인해 주세요.';end if;
  v_expiry:=nullif(v_item->>'expiry','')::date;
  v_pid:=nullif(v_item->>'productId','')::bigint;
  v_name:=trim(coalesce(v_item->>'name',''));v_sku:=nullif(trim(coalesce(v_item->>'barcode','')),'');
  v_category:=coalesce(nullif(trim(v_item->>'category'),''),'기타');v_min:=coalesce(nullif(v_item->>'min','')::integer,10);
  if length(v_name)>80 or length(v_sku)>48 or length(v_category)>80 or v_min not between 0 and 100000 then raise exception '상품 정보를 확인해 주세요.';end if;
  if v_pid is not null then
   select * into v_product from public.products where id=v_pid for update;
   if not found then raise exception '연결한 상품이 없습니다. 상품을 다시 선택해 주세요.';end if;
  end if;
  if v_pid is null or v_type='product' then
   if v_name='' then raise exception '상품명을 입력해 주세요.';end if;
   if exists(select 1 from public.products p where (v_pid is null or p.id<>v_pid) and (p.name=v_name or (v_sku is not null and p.sku=v_sku))) then raise exception '같은 상품명 또는 바코드가 있습니다. 기존 상품을 선택해 주세요.';end if;
   if v_pid is null then
    insert into public.products(name,category,sku,purchase_price,sale_price,low_stock_threshold)
    values(v_name,v_category,v_sku,v_cost,v_price,v_min) returning id into v_pid;
   else
    update public.products set name=v_name,category=v_category,category_id=(select c.id from public.product_categories c where c.name=v_category and c.is_active order by c.id limit 1),sku=v_sku,low_stock_threshold=v_min,purchase_price=v_cost,sale_price=v_price,updated_at=now() where id=v_pid;
   end if;
  else
   v_name:=v_product.name;
   update public.products set purchase_price=v_cost,sale_price=v_price,updated_at=now() where id=v_pid;
  end if;
  v_batch:=null;
  if v_qty>0 then
   insert into public.product_purchase_batches(product_id,purchase_date,expiration_date,quantity,remaining_quantity,unit_cost,sale_price,supplier,memo)
   values(v_pid,v_date,v_expiry,v_qty,v_qty,v_cost,v_price,nullif(v_supplier,''),'입고 문서 '||p_request_id::text) returning id into v_batch;
  end if;
  v_subtotal:=v_subtotal+v_qty*v_cost;
  if v_subtotal>10000000000 then raise exception '입고 합계가 너무 큽니다.';end if;
  v_saved:=v_saved||jsonb_build_array(jsonb_build_object('productId',v_pid::text,'name',v_name,'qty',v_qty,'unitCost',v_cost,'salePrice',v_price,'expiry',coalesce(v_expiry::text,''),'batchId',v_batch));
 end loop;
 v_total:=coalesce(nullif(p_document->>'total','')::bigint,v_subtotal);
 if v_total not between 0 and 10000000000 then raise exception '영수증 합계를 확인해 주세요.';end if;
 if v_total<>v_subtotal and coalesce((p_document->>'adjustmentConfirmed')::boolean,false)=false then raise exception '상품 합계와 영수증 합계 차이를 확인해 주세요.';end if;
 if coalesce((p_document->>'addExpense')::boolean,false) then
  if v_total<=0 then raise exception '비용 합계는 1원 이상이어야 합니다.';end if;
  insert into public.expenses(expense_date,category,amount,vendor,memo)
  values(v_date,'상품매입',v_total,nullif(v_supplier,''),coalesce(nullif(v_supplier,''),'상품 입고')||' · '||jsonb_array_length(v_items)||'종 · '||case when v_type='receipt' then '영수증' else '입고' end) returning id into v_expense;
 end if;
 insert into public.mimine_stock_documents(id,fingerprint,document_type,purchase_date,supplier,total,item_subtotal,items,image_data,raw_text,expense_id,created_by)
 values(p_request_id,v_fingerprint,v_type,v_date,v_supplier,v_total,v_subtotal,v_saved,v_image,v_raw,v_expense,(select auth.uid()));
 return jsonb_build_object('id',p_request_id,'duplicate',false,'total',v_total,'expenseId',v_expense,'items',v_saved);
end $$;
revoke all on function public.mimine_receive_stock(uuid,jsonb) from public,anon;
grant execute on function public.mimine_receive_stock(uuid,jsonb) to authenticated;

create table if not exists public.mimine_finance_requests(
 id uuid primary key,created_by uuid not null default auth.uid(),expense_id bigint references public.expenses(id) on delete set null,created_at timestamptz not null default now()
);
alter table public.mimine_finance_requests enable row level security;
drop policy if exists active_users_finance_requests on public.mimine_finance_requests;
create policy active_users_finance_requests on public.mimine_finance_requests for all to authenticated
 using(created_by=(select auth.uid()) and exists(select 1 from public.app_users u where u.user_id=(select auth.uid()) and u.is_active))
 with check(created_by=(select auth.uid()) and exists(select 1 from public.app_users u where u.user_id=(select auth.uid()) and u.is_active));
revoke all on public.mimine_finance_requests from public,anon,authenticated;
grant select,insert on public.mimine_finance_requests to authenticated;
grant all on public.mimine_finance_requests to service_role;
create index if not exists mimine_finance_requests_expense_idx on public.mimine_finance_requests(expense_id);
create index if not exists mimine_finance_requests_actor_idx on public.mimine_finance_requests(created_by);
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
 if v_amount is null or v_amount not between 1 and 10000000000 or v_date is null or v_date>(now() at time zone 'Asia/Seoul')::date or length(trim(coalesce(p_expense->>'vendor','')))=0 then raise exception '날짜·금액·사용처를 확인해 주세요.';end if;
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
