-- =============================================================================
-- YD Salon Platform — core schema
-- Multi-tenant: every business row belongs to a salon (tenant). One deployment
-- serves one salon (SALON_SLUG), but the same database can hold many salons.
-- =============================================================================

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('owner', 'manager', 'staff');
exception when duplicate_object then null; end $$;

do $$ begin
  create type appointment_status as enum ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_channel as enum ('email', 'whatsapp');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_type as enum ('confirmation', 'reminder', 'cancellation', 'reschedule');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_status as enum ('queued', 'sent', 'failed', 'skipped');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Generic updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Salons (tenants) + settings
-- Translatable text is stored as jsonb: {"en": "...", "tr": "...", "de": "..."}
-- ---------------------------------------------------------------------------
create table if not exists salons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  tagline jsonb not null default '{}'::jsonb,
  about jsonb not null default '{}'::jsonb,
  email text,
  phone text,
  whatsapp text,               -- E.164 without "+", used for wa.me links
  instagram_url text,
  instagram_handle text,
  facebook_url text,
  tiktok_url text,
  logo_url text,
  hero_image_url text,
  -- Trust indicators shown on the homepage, e.g. {"rating":4.9,"reviews":320,"clients":2500,"years":12}
  trust_stats jsonb not null default '{}'::jsonb,
  currency text not null default 'EUR' check (char_length(currency) = 3),
  timezone text not null default 'Europe/Istanbul',
  phone_country_code text not null default '90' check (phone_country_code ~ '^[0-9]{1,4}$'),
  default_locale text not null default 'tr' check (default_locale in ('tr', 'en', 'de')),
  -- Booking rules
  slot_interval_minutes int not null default 15 check (slot_interval_minutes between 5 and 120),
  min_lead_minutes int not null default 120 check (min_lead_minutes >= 0),
  max_advance_days int not null default 60 check (max_advance_days between 1 and 365),
  cancellation_window_hours int not null default 24 check (cancellation_window_hours >= 0),
  reschedule_window_hours int not null default 24 check (reschedule_window_hours >= 0),
  auto_confirm boolean not null default true,
  booking_policy jsonb not null default '{}'::jsonb,
  cancellation_policy jsonb not null default '{}'::jsonb,
  -- Notifications
  notify_email boolean not null default true,
  notify_whatsapp boolean not null default true,
  reminder_hours_before int not null default 24 check (reminder_hours_before between 1 and 168),
  staff_notification_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create or replace trigger trg_salons_updated before update on salons for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Branches + opening hours
-- ---------------------------------------------------------------------------
create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  address text not null,
  city text not null,
  phone text,
  email text,
  map_url text,
  image_url text,
  description jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, slug)
);
create index if not exists idx_branches_salon on branches(salon_id);
create or replace trigger trg_branches_updated before update on branches for each row execute function set_updated_at();

-- weekday: 0 = Sunday ... 6 = Saturday (matches JS Date#getDay)
create table if not exists branch_hours (
  branch_id uuid not null references branches(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  is_closed boolean not null default false,
  open_time time,
  close_time time,
  primary key (branch_id, weekday),
  check (is_closed or (open_time is not null and close_time is not null and open_time < close_time))
);

-- One-off closures (holidays) per branch
create table if not exists branch_closures (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id) on delete cascade,
  date date not null,
  reason text,
  unique (branch_id, date)
);

-- ---------------------------------------------------------------------------
-- Services
-- ---------------------------------------------------------------------------
create table if not exists service_categories (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  name jsonb not null,
  description jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  unique (salon_id, slug)
);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  category_id uuid not null references service_categories(id) on delete restrict,
  name jsonb not null,
  description jsonb not null default '{}'::jsonb,
  price_cents int not null check (price_cents >= 0),
  price_is_from boolean not null default true,
  duration_minutes int not null check (duration_minutes between 5 and 600),
  buffer_minutes int not null default 0 check (buffer_minutes between 0 and 120),
  image_url text,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_services_salon on services(salon_id);
create index if not exists idx_services_category on services(category_id);
create or replace trigger trg_services_updated before update on services for each row execute function set_updated_at();

-- Which services each branch offers
create table if not exists branch_services (
  branch_id uuid not null references branches(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  primary key (branch_id, service_id)
);

-- ---------------------------------------------------------------------------
-- Employees, skills, schedules
-- ---------------------------------------------------------------------------
create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete restrict,
  first_name text not null,
  last_name text not null,
  title jsonb not null default '{}'::jsonb,
  bio jsonb not null default '{}'::jsonb,
  photo_url text,
  email text,
  phone text,
  is_active boolean not null default true,
  is_bookable boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_employees_branch on employees(branch_id);
create or replace trigger trg_employees_updated before update on employees for each row execute function set_updated_at();

create table if not exists employee_services (
  employee_id uuid not null references employees(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  primary key (employee_id, service_id)
);

-- Weekly working pattern; a missing weekday row = day off
create table if not exists employee_working_hours (
  employee_id uuid not null references employees(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  break_start time,
  break_end time,
  primary key (employee_id, weekday),
  check (start_time < end_time),
  check ((break_start is null and break_end is null) or
         (break_start is not null and break_end is not null and break_start < break_end
          and break_start >= start_time and break_end <= end_time))
);

-- Holidays, sick days, blocked hours
create table if not exists employee_time_off (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  check (starts_at < ends_at)
);
create index if not exists idx_time_off_employee on employee_time_off(employee_id, starts_at);

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  phone text not null,          -- normalised E.164 ("+905...")
  email text,
  locale text not null default 'tr',
  notes text,                   -- internal notes, never shown to customers
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, phone)
);
create index if not exists idx_customers_name on customers(salon_id, lower(last_name), lower(first_name));
create or replace trigger trg_customers_updated before update on customers for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Appointments
-- ---------------------------------------------------------------------------
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete restrict,
  employee_id uuid not null references employees(id) on delete restrict,
  customer_id uuid not null references customers(id) on delete restrict,
  reference text not null unique,
  manage_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  starts_at timestamptz not null,
  ends_at timestamptz not null,           -- includes service buffers
  status appointment_status not null default 'confirmed',
  total_price_cents int not null check (total_price_cents >= 0),
  total_duration_minutes int not null check (total_duration_minutes > 0),
  customer_notes text,
  internal_notes text,
  source text not null default 'online' check (source in ('online', 'admin', 'phone', 'walk_in')),
  locale text not null default 'tr',
  employee_was_requested boolean not null default false,
  cancelled_at timestamptz,
  cancel_reason text,
  cancelled_by text check (cancelled_by in ('customer', 'salon')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at),
  -- DATABASE-LEVEL DOUBLE BOOKING PROTECTION:
  -- no two active appointments for the same professional may overlap in time.
  constraint appointments_no_overlap exclude using gist (
    employee_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending', 'confirmed', 'completed'))
);
create index if not exists idx_appointments_salon_time on appointments(salon_id, starts_at);
create index if not exists idx_appointments_employee_time on appointments(employee_id, starts_at);
create index if not exists idx_appointments_customer on appointments(customer_id);
create or replace trigger trg_appointments_updated before update on appointments for each row execute function set_updated_at();

create table if not exists appointment_services (
  appointment_id uuid not null references appointments(id) on delete cascade,
  service_id uuid references services(id) on delete set null,
  position smallint not null,
  name_snapshot jsonb not null,
  price_cents int not null,
  duration_minutes int not null,
  primary key (appointment_id, position)
);
create index if not exists idx_appt_services_service on appointment_services(service_id);

-- Audit trail of status changes / reschedules
create table if not exists appointment_events (
  id bigint generated always as identity primary key,
  appointment_id uuid not null references appointments(id) on delete cascade,
  event text not null,
  details jsonb not null default '{}'::jsonb,
  actor text not null,  -- 'customer' | 'system' | user id
  created_at timestamptz not null default now()
);
create index if not exists idx_appt_events on appointment_events(appointment_id);

-- ---------------------------------------------------------------------------
-- Notifications (outbox + delivery log)
-- ---------------------------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  appointment_id uuid references appointments(id) on delete cascade,
  channel notification_channel not null,
  type notification_type not null,
  recipient text not null,
  locale text not null default 'tr',
  status notification_status not null default 'queued',
  dedupe_key text unique,
  provider_message_id text,
  error text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists idx_notifications_status on notifications(status, created_at);
create index if not exists idx_notifications_appt on notifications(appointment_id);

-- ---------------------------------------------------------------------------
-- Marketing content (editable)
-- ---------------------------------------------------------------------------
create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  title jsonb not null,
  description jsonb not null default '{}'::jsonb,
  badge jsonb not null default '{}'::jsonb,
  image_url text,
  valid_until date,
  is_active boolean not null default true,
  sort_order int not null default 0
);

create table if not exists testimonials (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  author text not null,
  body jsonb not null,
  rating smallint not null default 5 check (rating between 1 and 5),
  service_label jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order int not null default 0
);

create table if not exists gallery_items (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  kind text not null default 'gallery' check (kind in ('gallery', 'before_after')),
  image_url text not null,
  before_image_url text,
  caption jsonb not null default '{}'::jsonb,
  sort_order int not null default 0
);

-- ---------------------------------------------------------------------------
-- Dashboard users & sessions
-- ---------------------------------------------------------------------------
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  email text not null unique check (email = lower(email)),
  password_hash text not null,
  full_name text not null,
  role user_role not null default 'staff',
  employee_id uuid references employees(id) on delete set null,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (role <> 'staff' or employee_id is not null)
);
create or replace trigger trg_users_updated before update on users for each row execute function set_updated_at();

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists idx_sessions_user on sessions(user_id);

create table if not exists login_attempts (
  id bigint generated always as identity primary key,
  email text not null,
  ip text,
  success boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_login_attempts on login_attempts(email, created_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- The application talks to Postgres only from the server (never from the
-- browser). RLS is enabled on every table with NO policies for the Supabase
-- `anon` / `authenticated` roles, so even if the public anon key leaks, the
-- REST API exposes nothing. The server connects with a privileged role.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'salons','branches','branch_hours','branch_closures','service_categories','services',
    'branch_services','employees','employee_services','employee_working_hours','employee_time_off',
    'customers','appointments','appointment_services','appointment_events','notifications',
    'offers','testimonials','gallery_items','users','sessions','login_attempts'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
