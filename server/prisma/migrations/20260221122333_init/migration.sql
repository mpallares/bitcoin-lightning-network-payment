-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('pending', 'succeeded', 'expired');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('pending', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "invoices" (
    "payment_hash" VARCHAR(64) NOT NULL,
    "payment_request" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "status" "invoice_status" NOT NULL DEFAULT 'pending',
    "description" TEXT,
    "preimage" VARCHAR(64),
    "expires_at" TIMESTAMPTZ NOT NULL,
    "settled_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("payment_hash")
);

-- CreateTable
CREATE TABLE "payments" (
    "payment_hash" VARCHAR(64) NOT NULL,
    "payment_request" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "fee" BIGINT DEFAULT 0,
    "status" "payment_status" NOT NULL DEFAULT 'pending',
    "description" TEXT,
    "preimage" VARCHAR(64),
    "destination" VARCHAR(66),
    "error_message" TEXT,
    "retry_count" BIGINT DEFAULT 0,
    "idempotency_key" VARCHAR(64),
    "settled_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("payment_hash")
);

-- CreateIndex
CREATE INDEX "idx_invoices_status" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "idx_invoices_created" ON "invoices"("created_at");

-- CreateIndex
CREATE INDEX "idx_payments_status" ON "payments"("status");

-- CreateIndex
CREATE INDEX "idx_payments_created" ON "payments"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "idx_payments_idempotency" ON "payments"("idempotency_key");
