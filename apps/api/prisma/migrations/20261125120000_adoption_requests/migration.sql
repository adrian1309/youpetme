-- CreateEnum
CREATE TYPE "AdoptionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "adoption_requests" (
    "id" UUID NOT NULL,
    "animal_id" UUID NOT NULL,
    "applicant_user_id" UUID NOT NULL,
    "message" TEXT,
    "status" "AdoptionRequestStatus" NOT NULL,
    "decided_by_user_id" UUID,
    "decided_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "adoption_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "adoption_requests_message_length_check" CHECK ("message" IS NULL OR char_length("message") <= 1000)
);

-- CreateIndex
CREATE INDEX "adoption_requests_status_created_at_idx" ON "adoption_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "adoption_requests_animal_id_idx" ON "adoption_requests"("animal_id");

-- At most one active (PENDING or APPROVED) request per user and animal, safe under concurrency
-- (SCRUM-14, scenarios 4 and 5). Not expressible in schema.prisma; keep it in future migrations.
CREATE UNIQUE INDEX "adoption_requests_active_per_user_animal_key" ON "adoption_requests"("animal_id", "applicant_user_id") WHERE "status" IN ('PENDING', 'APPROVED');

-- AddForeignKey
ALTER TABLE "adoption_requests" ADD CONSTRAINT "adoption_requests_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adoption_requests" ADD CONSTRAINT "adoption_requests_applicant_user_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adoption_requests" ADD CONSTRAINT "adoption_requests_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;