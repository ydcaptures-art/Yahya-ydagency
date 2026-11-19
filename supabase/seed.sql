-- =============================================================================
-- Demo salon: "Maison Aurelle" — used for presentations and local development.
-- Safe to re-run: it removes and re-creates the demo tenant only.
-- Replace photography URLs with the salon's own images before going live.
-- =============================================================================
do $$
declare
  s uuid;
  b_nis uuid; b_beb uuid;
  c_cut uuid; c_col uuid; c_trt uuid; c_mku uuid; c_fac uuid; c_nai uuid; c_ped uuid; c_brw uuid; c_wax uuid;
  e1 uuid; e2 uuid; e3 uuid; e4 uuid; e5 uuid; e6 uuid;
  img text := 'https://images.unsplash.com/';
  q text := '?auto=format&fit=crop&w=1200&q=80';
  r record;
begin
  delete from users where salon_id in (select id from salons where slug = 'maison-aurelle');
  delete from appointments where salon_id in (select id from salons where slug = 'maison-aurelle');
  delete from customers where salon_id in (select id from salons where slug = 'maison-aurelle');
  delete from employees where salon_id in (select id from salons where slug = 'maison-aurelle');
  delete from services where salon_id in (select id from salons where slug = 'maison-aurelle');
  delete from salons where slug = 'maison-aurelle';

  insert into salons (slug, name, tagline, about, email, phone, whatsapp, instagram_url, instagram_handle,
                      facebook_url, tiktok_url, trust_stats, currency, timezone, default_locale, hero_image_url,
                      booking_policy, cancellation_policy, staff_notification_email)
  values ('maison-aurelle', 'Maison Aurelle',
    '{"en":"Hair & Beauty Atelier","tr":"Saç & Güzellik Atölyesi","de":"Hair & Beauty Atelier"}',
    '{"en":"An intimate atelier where precision cutting, couture colour and advanced skincare meet quiet luxury. Every appointment begins with a private consultation and ends with you feeling entirely yourself.","tr":"Hassas kesim, kişiye özel renk ve ileri cilt bakımının sessiz lüksle buluştuğu samimi bir atölye. Her randevu özel bir danışmanlıkla başlar ve kendinizi tamamen kendiniz gibi hissetmenizle sona erer.","de":"Ein intimes Atelier, in dem Präzisionsschnitte, Couture-Coloration und moderne Hautpflege auf stillen Luxus treffen. Jeder Termin beginnt mit einer persönlichen Beratung und endet damit, dass Sie sich ganz wie Sie selbst fühlen."}',
    'hello@maisonaurelle.com', '+90 212 555 01 20', '902125550120',
    'https://instagram.com/maisonaurelle', 'maisonaurelle',
    'https://facebook.com/maisonaurelle', 'https://tiktok.com/@maisonaurelle',
    '{"rating":4.9,"reviews":320,"clients":2500,"years":12}',
    'TRY', 'Europe/Istanbul', 'tr',
    img || 'photo-1560066984-138dadb4c035' || q,
    '{"en":"Please arrive 5 minutes before your appointment. Prices shown are starting prices; your stylist confirms the final price during consultation.","tr":"Lütfen randevunuzdan 5 dakika önce gelin. Gösterilen fiyatlar başlangıç fiyatlarıdır; nihai fiyat danışmanlık sırasında uzmanınız tarafından onaylanır.","de":"Bitte erscheinen Sie 5 Minuten vor Ihrem Termin. Die angezeigten Preise sind Ab-Preise; der endgültige Preis wird bei der Beratung bestätigt."}',
    '{"en":"Appointments can be cancelled or rescheduled free of charge up to 24 hours in advance. For later changes please call the salon.","tr":"Randevular 24 saat öncesine kadar ücretsiz olarak iptal edilebilir veya ertelenebilir. Daha geç değişiklikler için lütfen salonu arayın.","de":"Termine können bis 24 Stunden vorher kostenlos storniert oder verschoben werden. Für spätere Änderungen rufen Sie bitte den Salon an."}',
    'team@maisonaurelle.com')
  returning id into s;

  -- Branches -----------------------------------------------------------------
  insert into branches (salon_id, slug, name, address, city, phone, email, map_url, image_url, description, sort_order)
  values (s, 'nisantasi', 'Nişantaşı', 'Abdi İpekçi Cad. No: 24', 'İstanbul', '+90 212 555 01 20', 'nisantasi@maisonaurelle.com',
          'https://maps.google.com/?q=Abdi+Ipekci+Caddesi+Nisantasi+Istanbul',
          img || 'photo-1521590832167-7bcbfaa6381f' || q,
          '{"en":"Our flagship atelier on Istanbul''s most elegant avenue.","tr":"İstanbul''un en zarif caddesindeki amiral atölyemiz.","de":"Unser Flagship-Atelier an Istanbuls elegantester Allee."}', 0)
  returning id into b_nis;
  insert into branches (salon_id, slug, name, address, city, phone, email, map_url, image_url, description, sort_order)
  values (s, 'bebek', 'Bebek', 'Cevdet Paşa Cad. No: 58', 'İstanbul', '+90 212 555 01 40', 'bebek@maisonaurelle.com',
          'https://maps.google.com/?q=Cevdet+Pasa+Caddesi+Bebek+Istanbul',
          img || 'photo-1633681926022-84c23e8cb2d6' || q,
          '{"en":"A light-filled Bosphorus studio for colour, skin and nails.","tr":"Renk, cilt ve tırnak için Boğaz kıyısında ışıl ışıl bir stüdyo.","de":"Ein lichtdurchflutetes Bosporus-Studio für Farbe, Haut und Nägel."}', 1)
  returning id into b_beb;

  -- Opening hours: Mon–Sat 09:30–20:00 (Sat 09:00–19:00), Sunday closed at Nişantaşı, 11:00–18:00 at Bebek
  insert into branch_hours (branch_id, weekday, is_closed, open_time, close_time)
  select b, d,
    case when b = b_nis and d = 0 then true else false end,
    case when d = 0 then '11:00'::time when d = 6 then '09:00'::time else '09:30'::time end,
    case when d = 0 then '18:00'::time when d = 6 then '19:00'::time else '20:00'::time end
  from unnest(array[b_nis, b_beb]) b, generate_series(0, 6) d;
  update branch_hours set open_time = null, close_time = null where is_closed;

  -- Categories ----------------------------------------------------------------
  insert into service_categories (salon_id, slug, name, sort_order) values
    (s, 'hair-styling', '{"en":"Hair Styling & Haircuts","tr":"Saç Tasarımı & Kesim","de":"Styling & Haarschnitte"}', 1) returning id into c_cut;
  insert into service_categories (salon_id, slug, name, sort_order) values
    (s, 'hair-coloring', '{"en":"Hair Colouring","tr":"Saç Boyama","de":"Coloration"}', 2) returning id into c_col;
  insert into service_categories (salon_id, slug, name, sort_order) values
    (s, 'hair-treatments', '{"en":"Hair Treatments","tr":"Saç Bakımları","de":"Haarbehandlungen"}', 3) returning id into c_trt;
  insert into service_categories (salon_id, slug, name, sort_order) values
    (s, 'makeup', '{"en":"Makeup","tr":"Makyaj","de":"Make-up"}', 4) returning id into c_mku;
  insert into service_categories (salon_id, slug, name, sort_order) values
    (s, 'facial-skincare', '{"en":"Facial & Skincare","tr":"Yüz & Cilt Bakımı","de":"Gesicht & Hautpflege"}', 5) returning id into c_fac;
  insert into service_categories (salon_id, slug, name, sort_order) values
    (s, 'nails-manicure', '{"en":"Nails & Manicure","tr":"Tırnak & Manikür","de":"Nägel & Maniküre"}', 6) returning id into c_nai;
  insert into service_categories (salon_id, slug, name, sort_order) values
    (s, 'pedicure', '{"en":"Pedicure","tr":"Pedikür","de":"Pediküre"}', 7) returning id into c_ped;
  insert into service_categories (salon_id, slug, name, sort_order) values
    (s, 'brows-lashes', '{"en":"Eyebrow & Eyelash","tr":"Kaş & Kirpik","de":"Augenbrauen & Wimpern"}', 8) returning id into c_brw;
  insert into service_categories (salon_id, slug, name, sort_order) values
    (s, 'waxing-beauty', '{"en":"Waxing & Beauty Treatments","tr":"Ağda & Güzellik Uygulamaları","de":"Waxing & Beauty-Behandlungen"}', 9) returning id into c_wax;

  -- Services (price in minor units) --------------------------------------------
  insert into services (salon_id, category_id, name, description, price_cents, duration_minutes, buffer_minutes, image_url, is_featured, sort_order) values
  (s, c_cut, '{"en":"Signature Cut & Blow-dry","tr":"İmza Kesim & Fön","de":"Signature Schnitt & Föhnen"}',
     '{"en":"Consultation, precision cut tailored to your face shape, luxury wash and a long-lasting blow-dry.","tr":"Danışmanlık, yüz hatlarınıza özel hassas kesim, lüks yıkama ve uzun süre kalıcı fön.","de":"Beratung, präziser Schnitt passend zu Ihrer Gesichtsform, Luxus-Haarwäsche und langanhaltendes Föhnen."}',
     180000, 60, 0, img || 'photo-1522337360788-8b13dee7a37e' || q, true, 1),
  (s, c_cut, '{"en":"Blow-dry & Styling","tr":"Fön & Şekillendirme","de":"Föhnen & Styling"}',
     '{"en":"Smooth, voluminous or beach waves — a polished finish for any occasion.","tr":"Düz, hacimli ya da dalgalı — her davet için kusursuz bir görünüm.","de":"Glatt, voluminös oder Beach Waves — ein perfektes Finish für jeden Anlass."}',
     90000, 45, 0, img || 'photo-1562322140-8baeececf3df' || q, false, 2),
  (s, c_cut, '{"en":"Bridal & Event Updo","tr":"Gelin & Davet Topuzu","de":"Braut- & Event-Hochsteckfrisur"}',
     '{"en":"An elegant updo designed with you, including a preview consultation.","tr":"Sizinle birlikte tasarlanan, ön danışmanlık dahil zarif bir topuz.","de":"Eine elegante Hochsteckfrisur, gemeinsam mit Ihnen entworfen, inklusive Vorgespräch."}',
     250000, 90, 15, img || 'photo-1595476108010-b4d1f102b1b1' || q, false, 3),
  (s, c_col, '{"en":"Balayage","tr":"Balyaj","de":"Balayage"}',
     '{"en":"Hand-painted, sun-kissed dimension with toner and gloss for a soft, natural grow-out.","tr":"Doğal bir uzama için tonlayıcı ve parlatıcı ile elde boyanan, güneşte açılmış görünüm.","de":"Handgemalte, sonnengeküsste Dimension mit Toner und Glossing für einen weichen, natürlichen Herauswuchs."}',
     550000, 180, 15, img || 'photo-1560869713-7d0a29430803' || q, true, 1),
  (s, c_col, '{"en":"Root Colour","tr":"Dip Boya","de":"Ansatzfarbe"}',
     '{"en":"Seamless regrowth coverage with premium, ammonia-free colour.","tr":"Amonyaksız premium boyalarla kusursuz dip kapatma.","de":"Nahtlose Ansatzabdeckung mit ammoniakfreier Premium-Farbe."}',
     160000, 75, 0, img || 'photo-1605497788044-5a32c7078486' || q, false, 2),
  (s, c_col, '{"en":"Full Highlights","tr":"Komple Röfle","de":"Komplette Strähnen"}',
     '{"en":"Brightening foils from root to tip, finished with a bespoke toner.","tr":"Dipten uca aydınlatıcı folyolar ve kişiye özel tonlama.","de":"Aufhellende Folien vom Ansatz bis zur Spitze, abgerundet mit individuellem Toner."}',
     420000, 150, 15, img || 'photo-1580618672591-eb180b1a973f' || q, false, 3),
  (s, c_trt, '{"en":"Keratin Smoothing","tr":"Keratin Bakımı","de":"Keratin-Glättung"}',
     '{"en":"Frizz-free, glossy hair for up to four months.","tr":"Dört aya kadar elektriklenmeyen, parlak saçlar.","de":"Bis zu vier Monate glänzendes Haar ohne Frizz."}',
     480000, 150, 0, img || 'photo-1519699047748-de8e457a634e' || q, false, 1),
  (s, c_trt, '{"en":"Olaplex Repair Ritual","tr":"Olaplex Onarım Ritüeli","de":"Olaplex Reparatur-Ritual"}',
     '{"en":"Bond-building treatment with scalp massage to restore strength and shine.","tr":"Saç tellerini güçlendiren ve parlaklık kazandıran bağ onarımı, kafa derisi masajı ile.","de":"Bond-Building-Behandlung mit Kopfhautmassage für Kraft und Glanz."}',
     120000, 45, 0, img || 'photo-1527799820374-dcf8d9d4a388' || q, true, 2),
  (s, c_mku, '{"en":"Evening Makeup","tr":"Gece Makyajı","de":"Abend-Make-up"}',
     '{"en":"Luminous, long-wear makeup with lashes included.","tr":"Kirpik dahil, ışıltılı ve uzun süre kalıcı makyaj.","de":"Strahlendes, langhaftendes Make-up inklusive Wimpern."}',
     200000, 60, 0, img || 'photo-1487412947147-5cebf100ffc2' || q, true, 1),
  (s, c_mku, '{"en":"Bridal Makeup","tr":"Gelin Makyajı","de":"Braut-Make-up"}',
     '{"en":"Your wedding look, perfected with a trial and premium long-wear products.","tr":"Prova ve premium kalıcı ürünlerle kusursuzlaşan düğün görünümünüz.","de":"Ihr Hochzeitslook, perfektioniert mit Probetermin und Premium-Produkten."}',
     450000, 120, 15, img || 'photo-1457972729786-0411a3b2b626' || q, false, 2),
  (s, c_fac, '{"en":"Hydrafacial Deluxe","tr":"Hydrafacial Deluxe","de":"Hydrafacial Deluxe"}',
     '{"en":"Deep cleanse, extraction and hydration for instantly radiant skin.","tr":"Anında ışıltılı bir cilt için derin temizlik, arındırma ve nem.","de":"Tiefenreinigung, Extraktion und Feuchtigkeit für sofort strahlende Haut."}',
     260000, 60, 10, img || 'photo-1570172619644-dfd03ed5d881' || q, true, 1),
  (s, c_fac, '{"en":"Signature Glow Facial","tr":"İmza Işıltı Bakımı","de":"Signature Glow Facial"}',
     '{"en":"A relaxing, results-driven facial with lymphatic massage.","tr":"Lenf drenaj masajı ile rahatlatıcı ve sonuç odaklı yüz bakımı.","de":"Eine entspannende, ergebnisorientierte Gesichtsbehandlung mit Lymphmassage."}',
     190000, 75, 10, img || 'photo-1512290923902-8a9f81dc236c' || q, false, 2),
  (s, c_nai, '{"en":"Gel Manicure","tr":"Kalıcı Oje Manikür","de":"Gel-Maniküre"}',
     '{"en":"Cuticle care, shaping and a flawless, chip-free gel finish.","tr":"Kütikül bakımı, şekillendirme ve kusursuz kalıcı oje.","de":"Nagelhautpflege, Formen und ein makelloses, splitterfreies Gel-Finish."}',
     70000, 50, 0, img || 'photo-1604654894610-df63bc536371' || q, true, 1),
  (s, c_nai, '{"en":"Spa Manicure","tr":"Spa Manikür","de":"Spa-Maniküre"}',
     '{"en":"Exfoliation, mask and massage with classic polish.","tr":"Peeling, maske ve masaj ile klasik oje.","de":"Peeling, Maske und Massage mit klassischem Lack."}',
     55000, 45, 0, img || 'photo-1519014816548-bf5fe059798b' || q, false, 2),
  (s, c_ped, '{"en":"Spa Pedicure","tr":"Spa Pedikür","de":"Spa-Pediküre"}',
     '{"en":"Warm soak, exfoliation, callus care and a relaxing massage.","tr":"Ilık banyo, peeling, nasır bakımı ve rahatlatıcı masaj.","de":"Warmes Fußbad, Peeling, Hornhautpflege und entspannende Massage."}',
     80000, 60, 0, img || 'photo-1519415510236-718bdfcd89c8' || q, false, 1),
  (s, c_ped, '{"en":"Gel Pedicure","tr":"Kalıcı Oje Pedikür","de":"Gel-Pediküre"}',
     '{"en":"Complete pedicure finished with long-lasting gel colour.","tr":"Uzun süre kalıcı oje ile tamamlanan komple pedikür.","de":"Komplette Pediküre mit langanhaltender Gel-Farbe."}',
     95000, 70, 0, img || 'photo-1632345031435-8727f6897d53' || q, false, 2),
  (s, c_brw, '{"en":"Brow Lamination & Tint","tr":"Kaş Laminasyonu & Boyama","de":"Brow Lamination & Färben"}',
     '{"en":"Fuller, groomed brows that last up to eight weeks.","tr":"Sekiz haftaya kadar kalıcı, dolgun ve düzenli kaşlar.","de":"Vollere, gepflegte Brauen, die bis zu acht Wochen halten."}',
     65000, 45, 0, img || 'photo-1594359151829-da0a7bc28d8e' || q, true, 1),
  (s, c_brw, '{"en":"Lash Lift & Tint","tr":"Kirpik Lifting & Boyama","de":"Wimpernlifting & Färben"}',
     '{"en":"Naturally curled, defined lashes — no extensions needed.","tr":"Takma kirpiğe gerek kalmadan doğal kıvrımlı, belirgin kirpikler.","de":"Natürlich geschwungene, definierte Wimpern — ganz ohne Extensions."}',
     75000, 50, 0, img || 'photo-1583001931096-959e9a1a6223' || q, false, 2),
  (s, c_wax, '{"en":"Full Leg Wax","tr":"Tüm Bacak Ağda","de":"Waxing Beine komplett"}',
     '{"en":"Gentle, low-temperature wax for smooth skin.","tr":"Pürüzsüz bir cilt için düşük ısılı, nazik ağda.","de":"Sanftes Niedrigtemperatur-Wachs für glatte Haut."}',
     60000, 45, 0, img || 'photo-1598300042247-d088f8ab3a91' || q, false, 1),
  (s, c_wax, '{"en":"Face Wax","tr":"Yüz Ağdası","de":"Gesichtswaxing"}',
     '{"en":"Upper lip, chin and cheeks, finished with a soothing balm.","tr":"Üst dudak, çene ve yanaklar; yatıştırıcı balm ile.","de":"Oberlippe, Kinn und Wangen, mit beruhigendem Balsam."}',
     35000, 20, 0, img || 'photo-1616394584738-fc6e612e71b9' || q, false, 2);

  -- Branch availability: Nişantaşı offers everything; Bebek has no bridal hair or full highlights
  insert into branch_services (branch_id, service_id) select b_nis, id from services where salon_id = s;
  insert into branch_services (branch_id, service_id) select b_beb, id from services where salon_id = s
    and name->>'en' not in ('Bridal & Event Updo', 'Full Highlights');

  -- Team -------------------------------------------------------------------------
  insert into employees (salon_id, branch_id, first_name, last_name, title, bio, photo_url, sort_order) values
    (s, b_nis, 'Elif', 'Aydın', '{"en":"Creative Director","tr":"Kreatif Direktör","de":"Creative Director"}',
     '{"en":"Precision cuts and editorial styling, 14 years in Paris and Istanbul.","tr":"Paris ve İstanbul''da 14 yıllık deneyimle hassas kesim ve editoryal stil.","de":"Präzisionsschnitte und Editorial-Styling, 14 Jahre in Paris und Istanbul."}',
     img || 'photo-1580489944761-15a19d654956' || '?auto=format&fit=crop&w=600&q=80', 1) returning id into e1;
  insert into employees (salon_id, branch_id, first_name, last_name, title, bio, photo_url, sort_order) values
    (s, b_nis, 'Can', 'Demir', '{"en":"Senior Colourist","tr":"Kıdemli Renk Uzmanı","de":"Senior Colorist"}',
     '{"en":"Balayage and lived-in blondes specialist.","tr":"Balyaj ve doğal sarı tonlar uzmanı.","de":"Spezialist für Balayage und natürliche Blondtöne."}',
     img || 'photo-1507003211169-0a1dd7228f2d' || '?auto=format&fit=crop&w=600&q=80', 2) returning id into e2;
  insert into employees (salon_id, branch_id, first_name, last_name, title, bio, photo_url, sort_order) values
    (s, b_nis, 'Selin', 'Kaya', '{"en":"Makeup & Brow Artist","tr":"Makyaj & Kaş Sanatçısı","de":"Make-up- & Brow-Artist"}',
     '{"en":"Bridal makeup, brow design and lash lifts.","tr":"Gelin makyajı, kaş tasarımı ve kirpik lifting.","de":"Braut-Make-up, Brow-Design und Wimpernlifting."}',
     img || 'photo-1534528741775-53994a69daeb' || '?auto=format&fit=crop&w=600&q=80', 3) returning id into e3;
  insert into employees (salon_id, branch_id, first_name, last_name, title, bio, photo_url, sort_order) values
    (s, b_beb, 'Deniz', 'Yıldız', '{"en":"Stylist & Colourist","tr":"Stilist & Renk Uzmanı","de":"Stylistin & Coloristin"}',
     '{"en":"Effortless cuts and glossy brunettes.","tr":"Zahmetsiz kesimler ve parlak kumral tonlar.","de":"Mühelose Schnitte und glänzende Brünetttöne."}',
     img || 'photo-1544005313-94ddf0286df2' || '?auto=format&fit=crop&w=600&q=80', 4) returning id into e4;
  insert into employees (salon_id, branch_id, first_name, last_name, title, bio, photo_url, sort_order) values
    (s, b_beb, 'Merve', 'Şahin', '{"en":"Skin Therapist","tr":"Cilt Bakım Uzmanı","de":"Hauttherapeutin"}',
     '{"en":"Medical-grade facials and skin health.","tr":"Medikal düzeyde yüz bakımı ve cilt sağlığı.","de":"Medizinische Gesichtsbehandlungen und Hautgesundheit."}',
     img || 'photo-1438761681033-6461ffad8d80' || '?auto=format&fit=crop&w=600&q=80', 5) returning id into e5;
  insert into employees (salon_id, branch_id, first_name, last_name, title, bio, photo_url, sort_order) values
    (s, b_beb, 'Ayşe', 'Koç', '{"en":"Nail Artist","tr":"Tırnak Sanatçısı","de":"Nageldesignerin"}',
     '{"en":"Gel, nail art and spa rituals for hands and feet.","tr":"Eller ve ayaklar için kalıcı oje, nail art ve spa ritüelleri.","de":"Gel, Nail Art und Spa-Rituale für Hände und Füße."}',
     img || 'photo-1487412720507-e7ab37603c6f' || '?auto=format&fit=crop&w=600&q=80', 6) returning id into e6;

  -- Skills
  insert into employee_services (employee_id, service_id)
  select e1, id from services where salon_id = s and category_id in (c_cut, c_trt)
  union all select e2, id from services where salon_id = s and category_id in (c_col, c_trt, c_cut)
  union all select e3, id from services where salon_id = s and category_id in (c_mku, c_brw, c_wax)
  union all select e4, id from services where salon_id = s and category_id in (c_cut, c_col, c_trt)
  union all select e5, id from services where salon_id = s and category_id in (c_fac, c_brw, c_wax)
  union all select e6, id from services where salon_id = s and category_id in (c_nai, c_ped);
  -- Nişantaşı has no dedicated nail/skin artist: Selin also covers manicure & facials there
  insert into employee_services (employee_id, service_id)
  select e3, id from services where salon_id = s and category_id in (c_nai, c_fac, c_ped)
  on conflict do nothing;

  -- Working hours: weekdays, with lunch breaks; staggered days off
  for r in select * from (values
      (e1, array[1,2,3,4,6]), (e2, array[2,3,4,5,6]), (e3, array[1,2,3,5,6]),
      (e4, array[0,1,3,4,5,6]), (e5, array[0,2,3,4,5]), (e6, array[0,1,2,4,5,6])
    ) as t(emp, days) loop
    insert into employee_working_hours (employee_id, weekday, start_time, end_time, break_start, break_end)
    select r.emp, d,
      case when d = 0 then '11:00'::time when d = 6 then '09:00'::time else '09:30'::time end,
      case when d = 0 then '18:00'::time when d = 6 then '19:00'::time else '20:00'::time end,
      '13:00'::time, '13:45'::time
    from unnest(r.days) d;
  end loop;

  -- Marketing content -------------------------------------------------------------
  insert into offers (salon_id, title, description, badge, image_url, valid_until, sort_order) values
    (s, '{"en":"The Bridal Atelier","tr":"Gelin Atölyesi","de":"Das Braut-Atelier"}',
        '{"en":"Hair, makeup and a full trial session — curated as one seamless experience.","tr":"Saç, makyaj ve tam prova — tek bir kusursuz deneyim olarak.","de":"Haare, Make-up und ein kompletter Probetermin — als ein nahtloses Erlebnis."}',
        '{"en":"Save 15%","tr":"%15 avantaj","de":"15 % sparen"}', img || 'photo-1457972729786-0411a3b2b626' || q, null, 1),
    (s, '{"en":"First Visit Ritual","tr":"İlk Ziyaret Ritüeli","de":"Erstbesuch-Ritual"}',
        '{"en":"Complimentary Olaplex treatment with any colour service on your first visit.","tr":"İlk ziyaretinizde her renk hizmetine Olaplex bakımı hediye.","de":"Kostenlose Olaplex-Behandlung zu jeder Colorations-Leistung bei Ihrem ersten Besuch."}',
        '{"en":"Complimentary","tr":"Hediye","de":"Gratis"}', img || 'photo-1527799820374-dcf8d9d4a388' || q, null, 2),
    (s, '{"en":"Weekday Glow","tr":"Hafta İçi Işıltısı","de":"Weekday Glow"}',
        '{"en":"Hydrafacial + gel manicure, Monday to Thursday before 2 pm.","tr":"Hydrafacial + kalıcı oje manikür, Pazartesi–Perşembe 14:00''ten önce.","de":"Hydrafacial + Gel-Maniküre, Montag bis Donnerstag vor 14 Uhr."}',
        '{"en":"Save 20%","tr":"%20 avantaj","de":"20 % sparen"}', img || 'photo-1570172619644-dfd03ed5d881' || q, null, 3);

  insert into testimonials (salon_id, author, body, rating, service_label, sort_order) values
    (s, 'Zeynep A.', '{"en":"The most beautiful balayage I have ever had. Can listened to every detail and the result looks completely natural.","tr":"Hayatımda yaptırdığım en güzel balyaj. Can her detayı dinledi ve sonuç tamamen doğal görünüyor.","de":"Das schönste Balayage, das ich je hatte. Can hat auf jedes Detail gehört und das Ergebnis wirkt völlig natürlich."}', 5,
       '{"en":"Balayage","tr":"Balyaj","de":"Balayage"}', 1),
    (s, 'Laura M.', '{"en":"Booking took less than a minute and the whole experience felt like a private retreat. My skin has never looked better.","tr":"Randevu almak bir dakikadan kısa sürdü ve tüm deneyim özel bir kaçamak gibiydi. Cildim hiç bu kadar iyi görünmemişti.","de":"Die Buchung dauerte weniger als eine Minute und alles fühlte sich wie ein privates Retreat an. Meine Haut sah nie besser aus."}', 5,
       '{"en":"Hydrafacial Deluxe","tr":"Hydrafacial Deluxe","de":"Hydrafacial Deluxe"}', 2),
    (s, 'Ece K.', '{"en":"Selin did my bridal makeup and it lasted all night through tears and dancing. Calm, professional and so talented.","tr":"Gelin makyajımı Selin yaptı; gözyaşlarına ve dansa rağmen bütün gece kaldı. Sakin, profesyonel ve çok yetenekli.","de":"Selin hat mein Braut-Make-up gemacht und es hielt die ganze Nacht — trotz Tränen und Tanzen. Ruhig, professionell und so talentiert."}', 5,
       '{"en":"Bridal Makeup","tr":"Gelin Makyajı","de":"Braut-Make-up"}', 3),
    (s, 'Hannah S.', '{"en":"Impeccable attention to detail. The gel manicure still looks perfect after three weeks.","tr":"Kusursuz bir detay anlayışı. Kalıcı ojem üç hafta sonra hâlâ mükemmel görünüyor.","de":"Makellose Liebe zum Detail. Die Gel-Maniküre sieht nach drei Wochen noch perfekt aus."}', 5,
       '{"en":"Gel Manicure","tr":"Kalıcı Oje Manikür","de":"Gel-Maniküre"}', 4);

  insert into gallery_items (salon_id, kind, image_url, before_image_url, caption, sort_order) values
    (s, 'gallery', img || 'photo-1560066984-138dadb4c035' || q, null, '{"en":"The Nişantaşı atelier","tr":"Nişantaşı atölyesi","de":"Das Atelier in Nişantaşı"}', 1),
    (s, 'gallery', img || 'photo-1522337360788-8b13dee7a37e' || q, null, '{"en":"Precision cutting","tr":"Hassas kesim","de":"Präzisionsschnitt"}', 2),
    (s, 'gallery', img || 'photo-1487412947147-5cebf100ffc2' || q, null, '{"en":"Evening makeup","tr":"Gece makyajı","de":"Abend-Make-up"}', 3),
    (s, 'gallery', img || 'photo-1604654894610-df63bc536371' || q, null, '{"en":"Gel manicure","tr":"Kalıcı oje","de":"Gel-Maniküre"}', 4),
    (s, 'gallery', img || 'photo-1570172619644-dfd03ed5d881' || q, null, '{"en":"Skin rituals","tr":"Cilt ritüelleri","de":"Hautrituale"}', 5),
    (s, 'gallery', img || 'photo-1633681926022-84c23e8cb2d6' || q, null, '{"en":"The Bebek studio","tr":"Bebek stüdyosu","de":"Das Studio in Bebek"}', 6),
    (s, 'before_after', img || 'photo-1560869713-7d0a29430803' || q, img || 'photo-1605497788044-5a32c7078486' || q,
       '{"en":"Brunette to soft balayage","tr":"Kumraldan yumuşak balyaja","de":"Von Brünett zu sanftem Balayage"}', 1),
    (s, 'before_after', img || 'photo-1519699047748-de8e457a634e' || q, img || 'photo-1580618672591-eb180b1a973f' || q,
       '{"en":"Keratin smoothing","tr":"Keratin bakımı","de":"Keratin-Glättung"}', 2);
end $$;
