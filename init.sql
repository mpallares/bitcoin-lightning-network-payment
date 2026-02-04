-- Lightning Payment App Schema

DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM('pending', 'succeeded', 'expired');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM('pending', 'succeeded', 'failed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS invoices (
  payment_hash varchar(64) PRIMARY KEY,
  payment_request text NOT NULL,
  amount bigint NOT NULL,
  status invoice_status DEFAULT 'pending' NOT NULL,
  description text,
  preimage varchar(64),
  expires_at timestamp with time zone NOT NULL,
  settled_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  payment_hash varchar(64) PRIMARY KEY,
  payment_request text NOT NULL,
  amount bigint NOT NULL,
  fee bigint DEFAULT 0,
  status payment_status DEFAULT 'pending' NOT NULL,
  description text,
  preimage varchar(64),
  destination varchar(66),
  error_message text,
  retry_count bigint DEFAULT 0,
  idempotency_key varchar(64),
  settled_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency ON payments(idempotency_key) WHERE idempotency_key IS NOT NULL;
