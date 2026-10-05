-- 008 — Hardening from the adversarial code review (Oct 2026).
-- Paste into Supabase → SQL editor → Run. Safe to re-run.

-- 1. Anonymous tables: the server's clock, not the client's, dates every row,
--    and text sizes are bounded (the anon key is public; inserts are open).
create or replace function stamp_created_at() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.created_at = now();
  return new;
end;
$$;

drop trigger if exists guide_logs_stamp on guide_logs;
create trigger guide_logs_stamp before insert on guide_logs
  for each row execute function stamp_created_at();
drop trigger if exists quiz_results_stamp on quiz_results;
create trigger quiz_results_stamp before insert on quiz_results
  for each row execute function stamp_created_at();
drop trigger if exists testimonials_stamp on testimonials;
create trigger testimonials_stamp before insert on testimonials
  for each row execute function stamp_created_at();

alter table guide_logs drop constraint if exists guide_logs_sizes;
alter table guide_logs add constraint guide_logs_sizes check (
  char_length(coalesce(question, '')) <= 1000
  and char_length(coalesce(answer, '')) <= 8000
  and char_length(coalesce(context, '')) <= 200
  and char_length(coalesce(lang, '')) <= 8
  and char_length(coalesce(model, '')) <= 80
  and cardinality(cited_claim_ids) <= 50
) not valid;

alter table quiz_results drop constraint if exists quiz_results_sane;
alter table quiz_results add constraint quiz_results_sane check (
  char_length(journey_slug) <= 80
  and (familiarity is null or familiarity in ('new', 'some', 'good'))
  and (pre_score is null or pre_score between 0 and 20)
  and (post_score is null or post_score between 0 and 20)
  and (total is null or total between 0 and 20)
  and (rating_clarity is null or rating_clarity between 1 and 5)
  and (rating_flow is null or rating_flow between 1 and 5)
) not valid;

alter table testimonials drop constraint if exists testimonials_sizes;
alter table testimonials add constraint testimonials_sizes check (
  char_length(body) between 10 and 1000
  and char_length(coalesce(display_name, '')) <= 80
) not valid;

-- 2. The guide no longer reads a daily cap from a table anyone can write.
drop function if exists guide_calls_since(timestamptz);

-- 3. Reviewer notes stay internal: visitors (anon) get every column but those.
revoke select on claims from anon;
grant select (
  id, place_id, topic, text_ar, text_en, en_reviewed, source_id, vol, page,
  quote_ar, hadith_ref, grading, samarrai_ref, needs_samarrai_check,
  content_level, kind, themes, status, reviewed_at, created_at
) on claims to anon;
