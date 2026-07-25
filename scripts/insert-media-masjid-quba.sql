with p as (select id from places where slug = 'masjid-quba')
insert into media (place_id, type, provider, url, thumb_url, width, height, sort_order)
values
  ((select id from p), 'photo', 'storage', '/media/places/masjid-quba/fe100570bc-1600.webp', '/media/places/masjid-quba/fe100570bc-400.webp', 1600, 2138, 0),
  ((select id from p), 'photo', 'storage', '/media/places/masjid-quba/6c59a88abe-1600.webp', '/media/places/masjid-quba/6c59a88abe-400.webp', 1600, 2138, 1),
  ((select id from p), 'photo', 'storage', '/media/places/masjid-quba/f6ea57bede-1600.webp', '/media/places/masjid-quba/f6ea57bede-400.webp', 1600, 2130, 2),
  ((select id from p), 'photo', 'storage', '/media/places/masjid-quba/e8101fd3f6-1600.webp', '/media/places/masjid-quba/e8101fd3f6-400.webp', 1600, 2133, 3),
  ((select id from p), 'photo', 'storage', '/media/places/masjid-quba/f109e05346-1600.webp', '/media/places/masjid-quba/f109e05346-400.webp', 1600, 2133, 4),
  ((select id from p), 'photo', 'storage', '/media/places/masjid-quba/a57348aaf4-1600.webp', '/media/places/masjid-quba/a57348aaf4-400.webp', 1600, 2133, 5),
  ((select id from p), 'photo', 'storage', '/media/places/masjid-quba/95cb715095-1600.webp', '/media/places/masjid-quba/95cb715095-400.webp', 1600, 2133, 6),
  ((select id from p), 'photo', 'storage', '/media/places/masjid-quba/6cc75def88-1600.webp', '/media/places/masjid-quba/6cc75def88-400.webp', 1600, 2133, 7),
  ((select id from p), 'photo', 'storage', '/media/places/masjid-quba/c6f84fd732-1600.webp', '/media/places/masjid-quba/c6f84fd732-400.webp', 1600, 1200, 8),
  ((select id from p), 'photo', 'storage', '/media/places/masjid-quba/cab870afb1-1600.webp', '/media/places/masjid-quba/cab870afb1-400.webp', 1600, 2133, 9),
  ((select id from p), 'photo', 'storage', '/media/places/masjid-quba/7ae0b163b8-1600.webp', '/media/places/masjid-quba/7ae0b163b8-400.webp', 1600, 2133, 10),
  ((select id from p), 'photo', 'storage', '/media/places/masjid-quba/765a41a16e-1600.webp', '/media/places/masjid-quba/765a41a16e-400.webp', 1600, 2133, 11),
  ((select id from p), 'photo', 'storage', '/media/places/masjid-quba/39ac0a9819-1600.webp', '/media/places/masjid-quba/39ac0a9819-400.webp', 1600, 2133, 12),
  ((select id from p), 'photo', 'storage', '/media/places/masjid-quba/640b0f3df5-1600.webp', '/media/places/masjid-quba/640b0f3df5-400.webp', 1600, 2133, 13),
  ((select id from p), 'photo', 'storage', '/media/places/masjid-quba/ad94122458-1600.webp', '/media/places/masjid-quba/ad94122458-400.webp', 1600, 1200, 14),
  ((select id from p), 'photo', 'storage', '/media/places/masjid-quba/971c9ba47f-1600.webp', '/media/places/masjid-quba/971c9ba47f-400.webp', 1600, 2133, 15),
  ((select id from p), 'photo', 'storage', '/media/places/masjid-quba/e73213b95c-1600.webp', '/media/places/masjid-quba/e73213b95c-400.webp', 1600, 2133, 16),
  ((select id from p), 'photo', 'storage', '/media/places/masjid-quba/69662a8856-1600.webp', '/media/places/masjid-quba/69662a8856-400.webp', 1600, 2133, 17)
on conflict (url) do update set width = excluded.width, height = excluded.height, sort_order = excluded.sort_order;