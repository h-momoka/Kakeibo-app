-- CreateEnum
CREATE TYPE "PersonKey" AS ENUM ('personA', 'personB');

-- CreateEnum
CREATE TYPE "Scope" AS ENUM ('personal', 'shared');

-- CreateTable
CREATE TABLE "households" (
    "id" TEXT NOT NULL,
    "invite_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "person_key" "PersonKey" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_profiles" (
    "household_id" TEXT NOT NULL,
    "person_a_name" TEXT NOT NULL DEFAULT 'Aさん',
    "person_b_name" TEXT NOT NULL DEFAULT 'Bさん',
    "person_a_color" TEXT NOT NULL DEFAULT '#184B6C',
    "person_b_color" TEXT NOT NULL DEFAULT '#63390F',
    "person_a_income" INTEGER NOT NULL DEFAULT 0,
    "person_b_income" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "household_profiles_pkey" PRIMARY KEY ("household_id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "scope" "Scope" NOT NULL,
    "owner" "PersonKey",
    "paid_by" "PersonKey",
    "split_percent_a" INTEGER,
    "settled" BOOLEAN NOT NULL DEFAULT false,
    "settled_at" TIMESTAMP(3),
    "amount" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "memo" TEXT NOT NULL DEFAULT '',
    "date" TEXT NOT NULL,
    "receipt_asset_id" TEXT,
    "recurring_id" TEXT,
    "recurring_month" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_costs" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "scope" "Scope" NOT NULL,
    "owner" "PersonKey",
    "paid_by" "PersonKey",
    "split_percent_a" INTEGER,
    "name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_map" (
    "household_id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "category" TEXT NOT NULL,

    CONSTRAINT "merchant_map_pkey" PRIMARY KEY ("household_id","keyword")
);

-- CreateTable
CREATE TABLE "receipt_assets" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "image_bytes" BYTEA NOT NULL,
    "mime_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipt_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_scan_usage" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipt_scan_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "households_invite_code_key" ON "households"("invite_code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_household_id_idx" ON "users"("household_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_household_id_person_key_key" ON "users"("household_id", "person_key");

-- CreateIndex
CREATE INDEX "expenses_household_id_scope_idx" ON "expenses"("household_id", "scope");

-- CreateIndex
CREATE INDEX "recurring_costs_household_id_scope_idx" ON "recurring_costs"("household_id", "scope");

-- CreateIndex
CREATE INDEX "receipt_assets_household_id_idx" ON "receipt_assets"("household_id");

-- CreateIndex
CREATE INDEX "receipt_scan_usage_household_id_created_at_idx" ON "receipt_scan_usage"("household_id", "created_at");

-- CreateIndex
CREATE INDEX "receipt_scan_usage_created_at_idx" ON "receipt_scan_usage"("created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_profiles" ADD CONSTRAINT "household_profiles_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_costs" ADD CONSTRAINT "recurring_costs_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_map" ADD CONSTRAINT "merchant_map_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_assets" ADD CONSTRAINT "receipt_assets_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_scan_usage" ADD CONSTRAINT "receipt_scan_usage_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_scan_usage" ADD CONSTRAINT "receipt_scan_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
