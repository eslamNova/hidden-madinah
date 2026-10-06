-- 007 — The knowledge journeys from the submitted plan, wired to existing places.
-- Stop scripts, human moments, reflections and quizzes are generated from
-- VERIFIED claims afterwards (drafted into content/journeys/*.json, imported with scripts/import-journeys.ts) and reviewed
-- before a journey is published. Journeys start unpublished.
-- Re-runnable: journeys upsert by slug; their stops are rebuilt.

insert into journeys (slug, title_ar, title_en, subtitle_ar, subtitle_en, theme_ar, theme_en, duration_min, mode, tags, sort_order) values
  ('hijra', 'أول يوم في المدينة', 'First Day in Madinah',
   'من قباء إلى موضع بروك الناقة: كيف بنى النبي ﷺ مجتمعًا من الصفر',
   'From Quba to where the camel knelt: how the Prophet ﷺ built a community from nothing',
   'التواضع والزيارة والمؤاخاة', 'Humility, visiting, brotherhood', 120, 'car', '{first-time}', 1),
  ('quba-wells', 'على خطاه كل سبت', 'In His Footsteps Every Saturday',
   'جولة هادئة بين قباء والآبار والبساتين التي مرّ بها ﷺ',
   'A quiet walk through Quba, the wells and the gardens he passed',
   'الحياة اليومية للنبي ﷺ', 'The Prophet''s daily life', 90, 'walk', '{family,evening}', 2),
  ('uhud', 'يوم اهتزت الأرض', 'The Day the Earth Shook',
   'عند أحد: الثبات والحزن والعفو في يوم واحد',
   'At Uhud: steadfastness, grief and forgiveness in a single day',
   'الثبات والرحمة والعفو', 'Steadfastness, mercy, forgiveness', 60, 'walk', '{}', 3),
  ('khandaq', 'حين حفر النبي ﷺ بيديه', 'When He Dug with His Own Hands',
   'الخندق ومسجد الفتح: القائد الذي يشارك أصحابه الجوع والتعب',
   'The Trench and Masjid al-Fath: a leader who shared his companions'' hunger and toil',
   'التواضع والصبر', 'Humility and patience', 75, 'mixed', '{}', 4),
  ('ancient-mosques', 'حيث صلّى', 'Where He Prayed',
   'مساجد أثرية صلّى فيها النبي ﷺ داخل المدينة وحولها',
   'Historic mosques where the Prophet ﷺ prayed, in and around Madinah',
   'العبادة والجوار', 'Worship and neighbourliness', 120, 'car', '{evening}', 5)
on conflict (slug) do update set
  title_ar = excluded.title_ar, title_en = excluded.title_en,
  subtitle_ar = excluded.subtitle_ar, subtitle_en = excluded.subtitle_en,
  theme_ar = excluded.theme_ar, theme_en = excluded.theme_en,
  duration_min = excluded.duration_min, mode = excluded.mode,
  tags = excluded.tags, sort_order = excluded.sort_order;

delete from journey_stops where journey_id in (select id from journeys where slug in
  ('hijra', 'quba-wells', 'uhud', 'khandaq', 'ancient-mosques'));

-- (journey, order, place slug or null, own title ar/en or null, own lat/lng or null)
insert into journey_stops (journey_id, sort_order, place_id, title_ar, title_en, lat, lng)
select j.id, v.ord, p.id, v.title_ar, v.title_en, v.lat, v.lng
from (values
  ('hijra', 1, 'masjid-quba', null, null, null::numeric, null::numeric),
  ('hijra', 2, 'masjid-al-jumuah', null, null, null, null),
  ('hijra', 3, 'masjid-bani-anif', null, null, null, null),
  ('hijra', 4, null, 'المسجد النبوي — موضع بروك الناقة', 'The Prophet''s Mosque — where the camel knelt', 24.4672, 39.6111),

  ('quba-wells', 1, 'masjid-quba', null, null, null, null),
  ('quba-wells', 2, 'bir-ghars', null, null, null, null),
  ('quba-wells', 3, 'bustan-al-mustazal', null, null, null, null),

  ('uhud', 1, 'jabal-al-rumah', 'سفح جبل أحد', 'The foot of Mount Uhud', null, null),
  ('uhud', 2, 'jabal-al-rumah', 'جبل الرماة', 'The Archers'' Hill', null, null),
  ('uhud', 3, 'jabal-al-rumah', 'مقبرة شهداء أحد', 'The Martyrs of Uhud', null, null),

  ('khandaq', 1, 'al-masajid-al-sabaa', 'موقع الخندق غرب جبل سلع', 'The Trench, west of Mount Sal''', null, null),
  ('khandaq', 2, 'al-masajid-al-sabaa', 'مسجد الفتح', 'Masjid al-Fath', null, null),
  ('khandaq', 3, 'al-masajid-al-sabaa', 'بقية المساجد السبعة', 'The other Seven Mosques', null, null),

  ('ancient-mosques', 1, 'masjid-abu-bakr-al-siddiq', null, null, null, null),
  ('ancient-mosques', 2, 'masjid-bani-anif', null, null, null, null),
  ('ancient-mosques', 3, 'masjid-al-usba', null, null, null, null),
  ('ancient-mosques', 4, 'masjid-al-qiblatayn', null, null, null, null)
) as v(journey, ord, place_slug, title_ar, title_en, lat, lng)
join journeys j on j.slug = v.journey
left join places p on p.slug = v.place_slug;
