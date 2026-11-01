-- Deployment step only: daily 09:00 Asia/Seoul (00:00 UTC). No bank-login or POS request.
create extension if not exists pg_cron;
select cron.schedule('mimine-bank-daily-match','0 0 * * *',
 $$select public.mimine_bank_auto_match(true,'system:daily');$$);
-- To stop: select cron.unschedule('mimine-bank-daily-match');
