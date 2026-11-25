-- AlterTable
ALTER TABLE "employer_payments" ADD COLUMN IF NOT EXISTS "taxable_paise" INTEGER;
ALTER TABLE "employer_payments" ADD COLUMN IF NOT EXISTS "gst_paise" INTEGER;

-- CreateTable
CREATE TABLE IF NOT EXISTS "employer_invoices" (
    "id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "employer_id" TEXT NOT NULL,
    "plan_id" TEXT,
    "sac_code" TEXT NOT NULL DEFAULT '998591',
    "seller_name" TEXT NOT NULL,
    "seller_gstin" TEXT NOT NULL,
    "seller_address" TEXT NOT NULL,
    "seller_email" TEXT,
    "seller_phone" TEXT,
    "buyer_name" TEXT NOT NULL,
    "buyer_gstin" TEXT,
    "buyer_state_code" TEXT,
    "buyer_address" TEXT,
    "place_of_supply" TEXT NOT NULL,
    "tax_mode" TEXT NOT NULL,
    "line_description" TEXT NOT NULL,
    "taxable_paise" INTEGER NOT NULL,
    "cgst_paise" INTEGER NOT NULL DEFAULT 0,
    "sgst_paise" INTEGER NOT NULL DEFAULT 0,
    "igst_paise" INTEGER NOT NULL DEFAULT 0,
    "gst_rate_percent" INTEGER NOT NULL DEFAULT 18,
    "total_paise" INTEGER NOT NULL,
    "amount_in_words" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "issued_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employer_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "employer_invoices_invoice_number_key" ON "employer_invoices"("invoice_number");
CREATE UNIQUE INDEX IF NOT EXISTS "employer_invoices_payment_id_key" ON "employer_invoices"("payment_id");
CREATE INDEX IF NOT EXISTS "employer_invoices_employer_id_issued_at_idx" ON "employer_invoices"("employer_id", "issued_at");
CREATE INDEX IF NOT EXISTS "employer_invoices_status_idx" ON "employer_invoices"("status");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "employer_invoices" ADD CONSTRAINT "employer_invoices_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "employer_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "employer_invoices" ADD CONSTRAINT "employer_invoices_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "employers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
