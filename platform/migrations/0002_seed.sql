-- Starter data. Safe to edit later from the admin panel.
INSERT OR IGNORE INTO settings (key, value) VALUES
 ('late_grace_min', '60'),
 ('late_fee_hour', '500'),
 ('late_full_day_hours', '4'),
 ('fuel_charge', '500'),
 ('key_fee', '3000'),
 ('cancel_hours', '24'),
 ('retention_days', '90'),
 ('permit_service_price', '0'),
 ('delivery_fee', '0'),
 ('taxi_rate_km_car', '0'),
 ('taxi_rate_km_van', '0'),
 ('taxi_min_fare', '0'),
 ('taxi_commission_pct', '10'),
 ('shop_address', 'Migga Scooter Rental, Sigiriya, Sri Lanka'),
 ('maps_url', '');

INSERT OR IGNORE INTO counters (name, value) VALUES ('MS', 0), ('MX', 0), ('MT', 0);

INSERT OR IGNORE INTO vehicles (id, name, plate, description, photo, rate_day, deposit, sort) VALUES
 (1, 'Honda Dio 110cc', 'BJK-1850', 'Automatic · easy to ride · 2 helmets included', '/img/scooter-sigiriya.webp', 3500, 0, 1),
 (2, 'Scooter 2', 'XXX-0000', 'Automatic · 2 helmets included', '/img/scooter-red.webp', 3500, 0, 2);

INSERT OR IGNORE INTO extras (id, name, price, per, applies_to, stock, sort) VALUES
 (1, 'Helmet (x2)', 0, 'rental', 'scooter', NULL, 1),
 (2, 'Rain poncho', 0, 'rental', 'scooter', NULL, 2),
 (3, 'Phone holder', 0, 'day', 'scooter', 2, 3),
 (4, 'Hotel delivery & collection (Sigiriya)', 0, 'rental', 'scooter', NULL, 4),
 (5, 'Breakfast pack', 0, 'person', 'experience', NULL, 5);

INSERT OR IGNORE INTO damage_items (id, name, price) VALUES
 (1, 'Helmet lost or damaged', 6000),
 (2, 'Key lost', 3000),
 (3, 'Mirror (each)', 0),
 (4, 'Indicator / light (each)', 0),
 (5, 'Side panel scratch', 0),
 (6, 'Side panel crack / broken', 0),
 (7, 'Brake or clutch lever', 0),
 (8, 'Cleaning (very dirty / muddy)', 0);

INSERT OR IGNORE INTO experiences (id, slug, name, category, summary, includes, price, price_per, max_pax, slots, capacity, photo, sort) VALUES
 (1, 'minneriya-jeep-safari', 'Minneriya National Park Jeep Safari', 'safari', 'Wild elephants at Minneriya tank, with hotel pickup from Sigiriya.', 'Private jeep and driver
Hotel pickup and drop-off in Sigiriya
Free breakfast pack on morning safaris
Free evening snack pack on afternoon safaris', 0, 'group', 6, '06:00,14:00', 3, '/img/sigiriya-road.webp', 1),
 (2, 'kaudulla-jeep-safari', 'Kaudulla National Park Jeep Safari', 'safari', 'Elephant herds around Kaudulla reservoir.', 'Private jeep and driver
Hotel pickup and drop-off in Sigiriya
Free breakfast pack on morning safaris', 0, 'group', 6, '06:00,14:00', 3, '/img/sigiriya-road.webp', 2),
 (3, 'eco-park-jeep-safari', 'Hurulu Eco Park Jeep Safari', 'safari', 'A quieter safari in the Hurulu Eco Park forest.', 'Private jeep and driver
Hotel pickup and drop-off in Sigiriya', 0, 'group', 6, '06:00,14:00', 3, '/img/sigiriya-road.webp', 3),
 (4, 'sigiriya-village-tour', 'Sigiriya Village Tour', 'tour', 'Village life around Sigiriya with a local guide.', 'Local guide
Traditional lunch', 0, 'person', 10, '09:00,15:00', 3, '/img/scooter-field.webp', 4);

INSERT OR IGNORE INTO taxi_routes (id, destination, km, price_car, price_van, sort) VALUES
 (1, 'Bandaranaike International Airport (BIA)', 160, 0, 0, 1),
 (2, 'Colombo', 175, 0, 0, 2),
 (3, 'Kandy', 90, 0, 0, 3),
 (4, 'Ella', 200, 0, 0, 4),
 (5, 'Galle / Mirissa', 290, 0, 0, 5),
 (6, 'Trincomalee', 105, 0, 0, 6),
 (7, 'Anuradhapura', 75, 0, 0, 7),
 (8, 'Polonnaruwa', 65, 0, 0, 8),
 (9, 'Dambulla', 20, 0, 0, 9);

INSERT OR IGNORE INTO agreement_versions (id, title, active, body) VALUES (1, 'Scooter Rental Agreement v2', 1,
'This agreement is between Migga Scooter Rental, Sigiriya, Sri Lanka ("Owner") and {guest_name} ("Renter"), booking {ref}.

## Rental details
Scooter: {vehicle} ({plate}). Pickup: {start}. Return: {end} ({days} day(s), 1 day = 24 hours). Rental fee: LKR {rental_price}. Extras: {extras}. Total: LKR {total}. Security deposit (refundable): LKR {deposit}.

## Renter
Name: {guest_name}. Nationality: {nationality}. Date of birth: {dob}. Passport: {passport_no}. Phone: {phone}. Email: {email}. Staying at: {stay_address}. Emergency contact: {emergency_contact}. Licence: {licence_no} ({licence_country}). IDP: {idp_no}. Sri Lankan permit: {permit}.

## Rules and terms
1. Eligibility and documents. The Renter must be 18 or older and hold, for the whole rental, a valid home licence with a motorcycle category, a physical International Driving Permit (1949 Convention) and a Sri Lankan recognition permit (AAC) or DMT temporary licence, and carry them while riding. Riding without them is at the Renter''s own risk, including all fines.
2. Rental day and rates. One rental day is 24 hours from pickup. The price is fixed at booking. Returning early does not give a refund for unused days.
3. Payment. The rental must be paid in full before the scooter is handed over, in LKR, by cash, bank transfer, card or online payment.
4. Security deposit. The deposit is refunded at return after inspection, minus any charges under these terms. Passports are never kept as a deposit.
5. Extensions. Extensions must be requested before the return time and are confirmed only if the scooter is free. Extra days are charged at the daily rate.
6. Late return. A grace period of {late_grace_min} minutes applies. After that each started hour costs LKR {late_fee_hour}, and more than {late_full_day_hours} hours late is charged as a full extra day. A scooter not returned within 24 hours of the return time without contact may be reported to the police as stolen.
7. Cancellation. Cancellation more than {cancel_hours} hours before pickup: full refund of any advance. Later cancellation or no-show: the advance is not refunded.
8. Fuel. The scooter must be returned with the same fuel level. A shortage is charged at LKR {fuel_charge}.
9. Use. Personal transport only. No racing, towing, off-road riding, delivery or paid passenger work, or illegal activity. Maximum one passenger. Rider and passenger must wear helmets at all times. No riding under the influence of alcohol or drugs. Only the Renter may ride unless the Owner approves another rider in writing.
10. Security. Lock the steering and remove the key when parked. Lost key: LKR {key_fee}.
11. Damage, loss and theft. The Renter is responsible for any damage, theft or loss during the rental. Repairs are charged using the Owner''s damage price list shown at pickup; other damage is charged at the actual repair cost. If the scooter is beyond repair or stolen, the Renter pays its market value less any insurance payout. Lost or damaged helmet: LKR 6,000 each.
12. Accidents and breakdowns. In an accident, make everyone safe, call the police (119) if anyone is hurt or another vehicle is involved, take photos and call the Owner immediately. Do not admit liability or settle privately. For a breakdown, call the Owner and do not repair the scooter without approval.
13. Traffic fines. All fines and legal issues during the rental are the Renter''s responsibility. Fines received by the Owner later are charged to the Renter.
14. Insurance. The scooter has third-party insurance as required in Sri Lanka. It does not cover the Renter''s injuries, medical costs, belongings or damage to the scooter. Personal travel insurance that covers motorcycle riding is strongly advised.
15. Termination. The Owner may end the rental and take back the scooter, without refund, if the Renter breaks traffic laws or these terms, misuses the scooter or gave false information.
16. Personal data. Passport, licence and permit images are used only to verify identity for this rental, stored privately and deleted {retention_days} days after the rental ends unless needed for an open claim.
17. Electronic signature. The Renter may sign electronically. An electronic signature has the same effect as a handwritten one under Sri Lanka''s Electronic Transactions Act No. 19 of 2006. A signed copy is emailed to the Renter.
18. Governing law. This agreement is governed by the laws of Sri Lanka.

## Declaration
I have read and understood this agreement. My documents are genuine and valid. I accept full responsibility for the scooter and for any damage, loss, fines or incidents while it is in my possession.');
