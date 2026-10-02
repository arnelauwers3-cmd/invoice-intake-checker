-- Invoice Intake Checker: initial schema
-- Access model: the browser never talks to the database. All reads and writes go
-- through Next.js server code using the secret key. RLS is enabled without any
-- policies, so the public (anon/publishable) key can read or write nothing.

create table suppliers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  name_key      text not null,              -- normalized name, used when there is no VAT number
  vat_number    text,                       -- normalized: country prefix + number, e.g. DE143454214
  country_code  text,
  created_at    timestamptz not null default now()
);
create unique index suppliers_vat_number_key on suppliers (vat_number) where vat_number is not null;
create index suppliers_name_key_idx on suppliers (name_key);

create table invoices (
  id                uuid primary key default gen_random_uuid(),
  supplier_id       uuid not null references suppliers (id) on delete cascade,
  invoice_number    text not null,
  invoice_date      date not null,
  due_date          date,
  currency          char(3) not null,
  subtotal          numeric(14, 2),
  vat_amount        numeric(14, 2),
  total             numeric(14, 2) not null,
  -- currency conversion (ECB via Frankfurter)
  fx_rate           numeric(18, 8),
  fx_rate_date      date,
  total_eur         numeric(14, 2),
  -- VIES result at the time of intake
  vat_status        text not null check (vat_status in ('valid', 'invalid', 'unverified', 'not_applicable')),
  vies_name         text,
  vat_checked_at    timestamptz,
  overall_status    text not null check (overall_status in ('ok', 'warning', 'problem')),
  raw_text          text,
  created_at        timestamptz not null default now()
);
create index invoices_supplier_date_idx on invoices (supplier_id, invoice_date desc);

create table invoice_lines (
  id                uuid primary key default gen_random_uuid(),
  invoice_id        uuid not null references invoices (id) on delete cascade,
  position          int not null,
  description       text not null,
  description_key   text not null,          -- normalized, for price comparisons
  quantity          numeric(14, 4),
  unit_price        numeric(14, 4),
  unit_price_eur    numeric(14, 4)
);
create index invoice_lines_invoice_idx on invoice_lines (invoice_id);

-- Snapshot of every check as it was evaluated at intake time (audit trail).
create table invoice_checks (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references invoices (id) on delete cascade,
  check_type  text not null check (check_type in ('vat', 'fx', 'duplicate', 'price_increase', 'arithmetic')),
  status      text not null check (status in ('ok', 'warning', 'problem')),
  title       text not null,
  message     text not null,
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index invoice_checks_invoice_idx on invoice_checks (invoice_id);

alter table suppliers      enable row level security;
alter table invoices       enable row level security;
alter table invoice_lines  enable row level security;
alter table invoice_checks enable row level security;

-- Atomic insert of an invoice with its lines and check results.
create function save_invoice(inv jsonb, lines jsonb, checks jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into invoices (
    supplier_id, invoice_number, invoice_date, due_date, currency,
    subtotal, vat_amount, total, fx_rate, fx_rate_date, total_eur,
    vat_status, vies_name, vat_checked_at, overall_status, raw_text
  ) values (
    (inv->>'supplier_id')::uuid, inv->>'invoice_number', (inv->>'invoice_date')::date,
    (inv->>'due_date')::date, inv->>'currency',
    (inv->>'subtotal')::numeric, (inv->>'vat_amount')::numeric, (inv->>'total')::numeric,
    (inv->>'fx_rate')::numeric, (inv->>'fx_rate_date')::date, (inv->>'total_eur')::numeric,
    inv->>'vat_status', inv->>'vies_name', (inv->>'vat_checked_at')::timestamptz,
    inv->>'overall_status', inv->>'raw_text'
  ) returning id into new_id;

  insert into invoice_lines (invoice_id, position, description, description_key, quantity, unit_price, unit_price_eur)
  select new_id, (l->>'position')::int, l->>'description', l->>'description_key',
         (l->>'quantity')::numeric, (l->>'unit_price')::numeric, (l->>'unit_price_eur')::numeric
  from jsonb_array_elements(lines) as l;

  insert into invoice_checks (invoice_id, check_type, status, title, message, details)
  select new_id, c->>'type', c->>'status', c->>'title', c->>'message', c->'details'
  from jsonb_array_elements(checks) as c;

  return new_id;
end;
$$;

revoke execute on function save_invoice(jsonb, jsonb, jsonb) from public, anon, authenticated;
