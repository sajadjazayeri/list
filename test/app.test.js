import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('Postgres schema enforces private membership, pairing, and item permissions',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
 await db.exec(readFileSync(new URL('../supabase/setup.sql',import.meta.url),'utf8'));
 const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
 for(const id of ids)await db.query('insert into auth.users values ($1)',[id]);
 const as=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
 const scalar=async sql=>(await db.query(sql)).rows[0].value;
 await as(ids[0]);const home=await scalar('select public.lu_create_home() as value');
 assert.equal(await scalar('select public.lu_create_home() as value'),home);
 await db.query("insert into public.lu_items(home_id,kind,title) values($1,'shopping','Milk')",[home]);
 await db.exec('reset role');
 const upgrade=readFileSync(new URL('../supabase/migrations/002_family_lists.sql',import.meta.url),'utf8');
 await db.exec(upgrade);await db.exec(upgrade);
 const restaurantsUpgrade=readFileSync(new URL('../supabase/migrations/003_restaurants.sql',import.meta.url),'utf8');
 await db.exec(restaurantsUpgrade);await db.exec(restaurantsUpgrade);
 const organizingUpgrade=readFileSync(new URL('../supabase/migrations/004_store_order_and_categories.sql',import.meta.url),'utf8');
 await db.exec(organizingUpgrade);await db.exec(organizingUpgrade);

 await as(ids[0]);
 assert.equal((await db.query('select title from public.lu_items')).rows[0].title,'Milk');
 await db.query("insert into public.lu_items(home_id,kind,title,cuisine,address,notes) values($1,'restaurants','Little Table','Italian','Pittsburgh','Try the gnocchi')",[home]);
 await assert.rejects(db.query("insert into public.lu_items(home_id,kind,title,cuisine) values($1,'restaurants','Bad',$2)",[home,'x'.repeat(61)]),/check constraint/);

 await db.query("insert into public.lu_stores(home_id,name) values($1,'Local Market')",[home]);
 await db.query("update public.lu_items set store='Costco',category='' where kind='shopping'");
 assert.equal((await db.query("select store from public.lu_items where kind='shopping'")).rows[0].store,'Costco');
 await db.query('select public.lu_set_store_order($1::text[])',[['Local Market','Costco','Aldi']]);
 await db.query('select public.lu_set_store_order($1::text[])',[['Aldi','Local Market','Costco']]);
 assert.deepEqual((await db.query('select store_order from public.lu_preferences')).rows[0].store_order,['Aldi','Local Market','Costco']);
 await assert.rejects(db.query('select public.lu_set_store_order($1::text[])',[Array(201).fill('Store')]),/check constraint/);

 await assert.rejects(db.query("insert into public.lu_stores(home_id,name) values($1,' local market ')",[home]),/duplicate key/);
 for(const [kind,title] of [['watch','The Bear'],['places','Kyoto'],['todo','Book appointment']])await db.query('insert into public.lu_items(home_id,kind,title) values($1,$2,$3)',[home,kind,title]);
 await assert.rejects(db.query("insert into public.lu_items(home_id,kind,title) values($1,'invalid','Invalid')",[home]),/check constraint/);
 const code=await scalar('select public.lu_invite() as value');assert.match(code,/^[A-F0-9]{32}$/);
 await assert.rejects(db.query('select public.lu_join_home($1)',[code]),/partner/);
 await assert.rejects(db.query('select * from public.lu_homes'),/permission denied/);
 await as(ids[2]);await scalar('select public.lu_create_home() as value');
 assert.equal((await db.query('select * from public.lu_items')).rows.length,0);
 assert.equal((await db.query('select * from public.lu_stores')).rows.length,0);
 assert.equal((await db.query('select * from public.lu_preferences')).rows.length,0);
 await assert.rejects(db.query('insert into public.lu_preferences values($1,$2::text[])',[home,['Intruder']]),/row-level security/);
 await db.query("update public.lu_items set category='Intruder',store='Intruder' where home_id=$1",[home]);
 await assert.rejects(db.query('update public.lu_preferences set home_id=gen_random_uuid()'),/permission denied/);

 await assert.rejects(db.query("insert into public.lu_stores(home_id,name) values($1,'Sneaky')",[home]),/row-level security/);
 assert.equal((await db.query('select * from public.lu_members')).rows.length,1);
 await assert.rejects(db.query("insert into public.lu_items(home_id,kind,title) values($1,'shopping','Bad')",[home]),/row-level security/);
 await db.query('update public.lu_items set done=true where home_id=$1',[home]);
 await db.query('delete from public.lu_items where home_id=$1',[home]);
 await db.query("update public.lu_items set notes='not allowed' where home_id=$1",[home]);
 await assert.rejects(db.query("insert into public.lu_items(home_id,kind,title) values($1,'restaurants','Intruder')",[home]),/row-level security/);

 await as(ids[1]);await db.query('select public.lu_join_home($1)',[code.toLowerCase()]);
 assert.equal((await db.query('select * from public.lu_members')).rows.length,2);
 assert.deepEqual((await db.query('select store_order from public.lu_preferences')).rows[0].store_order,['Aldi','Local Market','Costco']);
 assert.equal((await db.query("select store from public.lu_items where kind='shopping'")).rows[0].store,'Costco');
 await db.query("update public.lu_items set category='Family' where kind='todo'");
 assert.equal((await db.query("select category from public.lu_items where kind='todo'")).rows[0].category,'Family');
 await assert.rejects(db.query('update public.lu_items set category=$1',['x'.repeat(61)]),/check constraint/);
 await db.query('select public.lu_set_store_order($1::text[])',[['Costco','Aldi','Local Market']]);

 assert.equal((await db.query('select * from public.lu_items')).rows.length,5);
 assert.equal((await db.query('select * from public.lu_stores')).rows[0].name,'Local Market');
 await db.query("insert into public.lu_stores(home_id,name) values($1,'Partner Store')",[home]);
 assert.equal((await db.query('select * from public.lu_items')).rows[0].done,false);
 await db.query('update public.lu_items set done=true where home_id=$1',[home]);
 await db.query("update public.lu_items set title='Little Table Updated',cuisine='Italian',address='Downtown',notes='Book ahead' where kind='restaurants'");
 assert.equal((await db.query("select notes from public.lu_items where kind='restaurants'")).rows[0].notes,'Book ahead');
 await assert.rejects(db.query("update public.lu_items set home_id=gen_random_uuid()"),/permission denied/);

 await assert.rejects(db.query('select public.lu_invite()'),/already has two/);
 await as(ids[0]);assert.equal((await db.query('select * from public.lu_stores')).rows.length,2);assert.equal((await db.query('select * from public.lu_items')).rows[0].done,true);
 await as(ids[2]);await assert.rejects(db.query('select public.lu_join_home($1)',[code]),/expired or already/);
 await db.exec('reset role; set role anon');await assert.rejects(db.query('select * from public.lu_items'),/permission denied/);await assert.rejects(db.query('select public.lu_create_home()'),/permission denied/);await assert.rejects(db.query('select * from public.lu_stores'),/permission denied/);await assert.rejects(db.query('select * from public.lu_preferences'),/permission denied/);await assert.rejects(db.query("select public.lu_set_store_order(array['Aldi'])"),/permission denied/);
 }finally{await db.close();}
});
