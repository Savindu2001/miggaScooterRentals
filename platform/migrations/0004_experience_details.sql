-- Rich detail pages for safaris and tours (all editable in Admin → Safari & tours)
ALTER TABLE experiences ADD COLUMN duration TEXT NOT NULL DEFAULT '';
ALTER TABLE experiences ADD COLUMN highlights TEXT NOT NULL DEFAULT '';   -- one per line
ALTER TABLE experiences ADD COLUMN best_time TEXT NOT NULL DEFAULT '';
ALTER TABLE experiences ADD COLUMN itinerary TEXT NOT NULL DEFAULT '';    -- one step per line: "05:30 | Pickup from your hotel"
ALTER TABLE experiences ADD COLUMN excludes TEXT NOT NULL DEFAULT '';     -- one per line
ALTER TABLE experiences ADD COLUMN bring TEXT NOT NULL DEFAULT '';        -- one per line
ALTER TABLE experiences ADD COLUMN faq TEXT NOT NULL DEFAULT '';          -- one per line: "Question? | Answer"
ALTER TABLE experiences ADD COLUMN gallery TEXT NOT NULL DEFAULT '';      -- one per line: "/media/... | photo credit"

UPDATE experiences SET
  duration = 'About 3–4 hours',
  summary = 'See wild elephants gather on the grasslands of the ancient Minneriya tank, about 45 minutes from Sigiriya. Private jeep with hotel pickup.',
  description = 'Minneriya National Park surrounds the ancient Minneriya tank, a reservoir built in the 3rd century. In the dry season, as the water level drops, fresh grass grows on the exposed lake bed and elephants come from the surrounding forests to feed and drink. This is the famous "Gathering", when you can see large herds with young calves in one place. Besides elephants, look out for deer, water buffalo, crocodiles, monitor lizards and many water birds such as painted storks, pelicans and cormorants.',
  highlights = 'Large herds of wild Asian elephants with calves
The ancient 3rd-century Minneriya tank
Deer, crocodiles, water buffalo and monitor lizards
Pelicans, painted storks, eagles and many other birds
Private jeep: your group only, stop whenever you like',
  best_time = 'Elephants can be seen all year, but the famous Gathering is in the dry season, roughly July to October, when the tank shrinks and herds feed on the lake bed. In the rainy months your driver may suggest Kaudulla or Hurulu Eco Park instead, depending on where the herds are that week.',
  itinerary = 'Hotel pickup | Your jeep picks you up at your hotel in Sigiriya
Drive to the park | About 45 minutes to the Minneriya park entrance
Tickets | Buy park tickets at the counter (your driver helps)
Safari | Around 3 hours on the park tracks, stopping for elephants and birds
Back to your hotel | Drop-off at your hotel in Sigiriya',
  excludes = 'Park entrance tickets (paid at the park counter)
Tips for the driver (optional)',
  bring = 'Hat and sunglasses
Sunscreen and water
Binoculars and a camera with zoom
A light jacket for early mornings
Cash for park tickets',
  faq = 'When is the best time to see elephants at Minneriya? | The Gathering is usually strongest in the dry season, roughly July to October. Outside those months your driver takes you to the park where the elephants are that week.
Morning or afternoon safari? | Afternoon safaris usually see more elephants on the grasslands. Morning safaris are cooler, quieter and good for birds.
Are park tickets included? | No. You buy them at the park counter on the day. Your driver helps you.
Is the jeep private? | Yes. The jeep and driver are only for your group.
Is it safe for children? | Yes, families with children are welcome. Stay seated and keep quiet near the elephants.'
WHERE slug = 'minneriya-jeep-safari';

UPDATE experiences SET
  duration = 'About 3–4 hours',
  summary = 'Elephant herds on the grasslands of the ancient Kaudulla tank, often the best park later in the year. Private jeep with hotel pickup.',
  description = 'Kaudulla National Park was opened in 2002 around the ancient Kaudulla tank and is part of the elephant corridor that links Minneriya with Somawathiya National Park. When the water at Minneriya rises later in the year, many herds move to Kaudulla, so it is often the best park from around August to December. The park is generally quieter than Minneriya. Along the water you can also see crocodiles, deer and birds such as cormorants, herons and teals.',
  highlights = 'Elephant herds with young calves, sometimes over 200 elephants
Usually fewer jeeps than Minneriya
Part of the elephant corridor between Minneriya and Somawathiya
Water birds, crocodiles and deer
Private jeep with hotel pickup from Sigiriya',
  best_time = 'Usually best from around August to December, with the most elephants around September and October, after the herds leave Minneriya. Your driver checks where the herds are and suggests the best park for your date.',
  itinerary = 'Hotel pickup | Your jeep picks you up at your hotel in Sigiriya
Drive to the park | About 45 minutes to the Kaudulla park entrance
Tickets | Buy park tickets at the counter (your driver helps)
Safari | Around 3 hours on the park tracks around the tank
Back to your hotel | Drop-off at your hotel in Sigiriya',
  excludes = 'Park entrance tickets (paid at the park counter)
Tips for the driver (optional)',
  bring = 'Hat and sunglasses
Sunscreen and water
Binoculars and a camera with zoom
Cash for park tickets',
  faq = 'Minneriya or Kaudulla? | It depends on the season. The herds move between the parks, so your driver suggests the one where elephants are being seen that week.
Are park tickets included? | No. You buy them at the park counter on the day. Your driver helps you.
Is the jeep private? | Yes. The jeep and driver are only for your group.'
WHERE slug = 'kaudulla-jeep-safari';

UPDATE experiences SET
  duration = 'About 3–4 hours',
  summary = 'A quieter safari in the forests and grasslands of the Hurulu biosphere reserve near Habarana. Private jeep with hotel pickup.',
  description = 'Hurulu Eco Park is part of the Hurulu Forest Reserve near Habarana, a UNESCO biosphere reserve since 1977. It is a mix of dry evergreen forest, scrubland and open grassland around small tanks. Elephants are seen here often, and the park is usually less busy than Minneriya and Kaudulla, so it is a good choice for a calmer safari. Look out for deer, wild boar, peacocks, eagles and other birds.',
  highlights = 'Wild elephants in a quieter park
Part of a UNESCO biosphere reserve
Forest, scrubland and grassland around small tanks
Peacocks, eagles, deer and wild boar
Private jeep with hotel pickup from Sigiriya',
  best_time = 'Elephants can be seen through the year. Many guides find it best around December to March, when herds move in after Minneriya and Kaudulla. Your driver suggests the best park for your date.',
  itinerary = 'Hotel pickup | Your jeep picks you up at your hotel in Sigiriya
Drive to the park | About 30–45 minutes to the Hurulu Eco Park entrance near Habarana
Tickets | Buy park tickets at the counter (your driver helps)
Safari | Around 3 hours in the park
Back to your hotel | Drop-off at your hotel in Sigiriya',
  excludes = 'Park entrance tickets (paid at the park counter)
Tips for the driver (optional)',
  bring = 'Hat and sunglasses
Sunscreen, insect repellent and water
Binoculars and a camera with zoom
Cash for park tickets',
  faq = 'Why choose Hurulu Eco Park? | It is usually quieter, with fewer jeeps, and elephants are often seen here, especially around the end and start of the year.
Are park tickets included? | No. You buy them at the park counter on the day. Your driver helps you.'
WHERE slug = 'eco-park-jeep-safari';

UPDATE experiences SET
  duration = 'About 3 hours',
  description = 'Spend a few hours with a local family and see how people around Sigiriya live and farm. Walk or ride through paddy fields and village tracks, learn how the ancient tank irrigation system still feeds the rice fields, and finish with a home-cooked Sri Lankan meal.',
  highlights = 'Paddy fields and village life around Sigiriya
Local guide from the village
Traditional home-cooked Sri Lankan meal
Great views of Sigiriya Rock from the fields',
  best_time = 'All year. Early morning and late afternoon are cooler and have the best light.',
  itinerary = 'Hotel pickup | Pickup from your hotel in Sigiriya
Village walk | Paddy fields, home gardens and the village tank
Cooking | See how a traditional meal is prepared
Meal | Enjoy the meal with your hosts
Back to your hotel | Drop-off at your hotel in Sigiriya',
  bring = 'Comfortable shoes
Hat and sunscreen
Water',
  faq = 'Is it suitable for children? | Yes, it is an easy, family-friendly tour.
Is food included? | Yes, a traditional meal is included. Tell us about allergies or diet needs when you book.'
WHERE slug = 'sigiriya-village-tour';

-- Remove placeholder scooter photos from safari/tour pages until real photos are uploaded.
UPDATE experiences SET photo = '' WHERE photo IN ('/img/sigiriya-road.webp', '/img/scooter-field.webp');
