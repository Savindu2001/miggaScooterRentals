-- Migga platform schema (Cloudflare D1 / SQLite)
-- Times are Sri Lanka local time strings 'YYYY-MM-DD HH:MM'. Money is whole LKR (integers).

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','staff')),
  pass_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE login_attempts (
  ip TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX idx_login_attempts ON login_attempts(ip, at);

-- Scooters (own and partner-owned). Prices are totals for the package.
CREATE TABLE vehicles (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  plate TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  photo TEXT NOT NULL DEFAULT '',
  rate_day INTEGER NOT NULL,
  rate_3day INTEGER,
  rate_week INTEGER,
  rate_month INTEGER,
  deposit INTEGER NOT NULL DEFAULT 0,
  owner_name TEXT,               -- NULL = Migga owns it
  owner_rate_day INTEGER,        -- what Migga pays a partner owner per day
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','maintenance','retired')),
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE extras (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,          -- 0 = free
  per TEXT NOT NULL DEFAULT 'rental' CHECK (per IN ('rental','day','person')),
  applies_to TEXT NOT NULL DEFAULT 'scooter' CHECK (applies_to IN ('scooter','experience','all')),
  stock INTEGER,                              -- NULL = unlimited
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE damage_items (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE agreement_versions (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Safaris, village tours and other activities
CREATE TABLE experiences (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('safari','tour','activity')),
  summary TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  includes TEXT NOT NULL DEFAULT '',         -- one item per line (e.g. "Free breakfast pack")
  price INTEGER NOT NULL,
  price_per TEXT NOT NULL DEFAULT 'group' CHECK (price_per IN ('group','person')),
  max_pax INTEGER NOT NULL DEFAULT 6,
  cost INTEGER NOT NULL DEFAULT 0,           -- what Migga pays the supplier
  slots TEXT NOT NULL DEFAULT '06:00',       -- comma separated start times
  capacity INTEGER NOT NULL DEFAULT 3,       -- bookings per slot
  photo TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE taxi_routes (
  id INTEGER PRIMARY KEY,
  destination TEXT NOT NULL,
  km INTEGER NOT NULL DEFAULT 0,
  price_car INTEGER NOT NULL,
  price_van INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE drivers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  nic TEXT NOT NULL DEFAULT '',
  licence_no TEXT NOT NULL DEFAULT '',
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('car','van','tuk')),
  vehicle_no TEXT NOT NULL DEFAULT '',
  vehicle_model TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','blocked')),
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One table for all bookings: scooter rentals, experiences, taxi trips
CREATE TABLE bookings (
  id INTEGER PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE,               -- secret for the guest's links
  kind TEXT NOT NULL CHECK (kind IN ('scooter','experience','taxi')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','active','completed','cancelled')),
  -- guest
  guest_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  nationality TEXT NOT NULL DEFAULT '',
  dob TEXT NOT NULL DEFAULT '',
  passport_no TEXT NOT NULL DEFAULT '',
  home_address TEXT NOT NULL DEFAULT '',
  stay_address TEXT NOT NULL DEFAULT '',
  emergency_contact TEXT NOT NULL DEFAULT '',
  licence_no TEXT NOT NULL DEFAULT '',
  licence_country TEXT NOT NULL DEFAULT '',
  idp_no TEXT NOT NULL DEFAULT '',
  permit_option TEXT NOT NULL DEFAULT '',   -- have | arrange | airport
  permit_no TEXT NOT NULL DEFAULT '',
  -- what & when
  vehicle_id INTEGER REFERENCES vehicles(id),
  experience_id INTEGER REFERENCES experiences(id),
  start_at TEXT NOT NULL,
  end_at TEXT,
  actual_return_at TEXT,
  pax INTEGER NOT NULL DEFAULT 1,
  pickup_location TEXT NOT NULL DEFAULT '',
  -- taxi
  destination TEXT NOT NULL DEFAULT '',
  vehicle_type TEXT NOT NULL DEFAULT '',
  driver_id INTEGER REFERENCES drivers(id),
  commission INTEGER NOT NULL DEFAULT 0,
  driver_status TEXT NOT NULL DEFAULT '',   -- offered | accepted | done
  -- money
  rental_price INTEGER NOT NULL DEFAULT 0,
  extras_total INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  deposit INTEGER NOT NULL DEFAULT 0,
  cost INTEGER NOT NULL DEFAULT 0,          -- supplier / partner cost
  payment_pref TEXT NOT NULL DEFAULT 'shop',
  -- agreement
  agreement_version_id INTEGER REFERENCES agreement_versions(id),
  agreement_text TEXT,
  signature_key TEXT,
  signed_at TEXT,
  signed_ip TEXT,
  notes TEXT NOT NULL DEFAULT '',
  staff_notes TEXT NOT NULL DEFAULT '',
  review_sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_bookings_vehicle ON bookings(vehicle_id, status, start_at);
CREATE INDEX idx_bookings_start ON bookings(start_at);
CREATE INDEX idx_bookings_kind ON bookings(kind, status);

CREATE TABLE booking_extras (
  id INTEGER PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  extra_id INTEGER,
  name TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_booking_extras ON booking_extras(booking_id);

CREATE TABLE documents (
  id INTEGER PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  type TEXT NOT NULL,          -- passport | licence | idp | permit | slip | other
  r2_key TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_documents ON documents(booking_id);

CREATE TABLE inspections (
  id INTEGER PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('pickup','return')),
  km INTEGER,
  fuel TEXT NOT NULL DEFAULT '',
  items TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  staff_id INTEGER REFERENCES users(id),
  guest_signature_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_inspections ON inspections(booking_id);

CREATE TABLE inspection_photos (
  id INTEGER PRIMARY KEY,
  inspection_id INTEGER NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  angle TEXT NOT NULL,
  r2_key TEXT NOT NULL
);
CREATE INDEX idx_inspection_photos ON inspection_photos(inspection_id);

CREATE TABLE charges (
  id INTEGER PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('damage','late','fuel','extension','other')),
  description TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_charges ON charges(booking_id);

-- Money in (positive) and out (negative, e.g. deposit refunds)
CREATE TABLE payments (
  id INTEGER PRIMARY KEY,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  business TEXT NOT NULL CHECK (business IN ('scooter','experience','taxi','other')),
  kind TEXT NOT NULL CHECK (kind IN ('rental','deposit','deposit_refund','charge','extension','commission','other')),
  method TEXT NOT NULL CHECK (method IN ('cash','card','bank','online')),
  amount INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  slip_key TEXT,
  staff_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_on TEXT NOT NULL                    -- local date YYYY-MM-DD
);
CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_payments_date ON payments(paid_on);

CREATE TABLE extensions (
  id INTEGER PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  new_end_at TEXT NOT NULL,
  amount INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Taxi drivers: amount > 0 = driver owes Migga (commission); amount < 0 = driver paid Migga
CREATE TABLE driver_ledger (
  id INTEGER PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES drivers(id),
  booking_id INTEGER REFERENCES bookings(id),
  amount INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  slip_key TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending','confirmed','rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_driver_ledger ON driver_ledger(driver_id);

CREATE TABLE expenses (
  id INTEGER PRIMARY KEY,
  business TEXT NOT NULL CHECK (business IN ('scooter','experience','taxi','other')),
  category TEXT NOT NULL,
  amount INTEGER NOT NULL,
  spent_on TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  vehicle_id INTEGER REFERENCES vehicles(id),
  receipt_key TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_expenses_date ON expenses(spent_on);

CREATE TABLE counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
