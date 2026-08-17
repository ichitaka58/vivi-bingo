-- 抽選実行を1ゲームにつき同時1件に制限しつつ、未出番号からランダムに1つ選んでdrawsに記録する。
-- pg_advisory_xact_lock によりトランザクション内で排他制御し、二重抽選を防止する。
create or replace function draw_next_number(p_game_id uuid)
returns table (number int, draw_order int)
language plpgsql
as $$
declare
  v_number int;
  v_draw_order int;
begin
  perform pg_advisory_xact_lock(hashtext(p_game_id::text));

  select n into v_number
  from generate_series(1, 75) as n
  where n not in (
    select d.number from draws d where d.game_id = p_game_id
  )
  order by random()
  limit 1;

  if v_number is null then
    return;
  end if;

  select coalesce(max(d.draw_order), 0) + 1 into v_draw_order
  from draws d
  where d.game_id = p_game_id;

  insert into draws (game_id, number, draw_order)
  values (p_game_id, v_number, v_draw_order);

  return query select v_number, v_draw_order;
end;
$$;
