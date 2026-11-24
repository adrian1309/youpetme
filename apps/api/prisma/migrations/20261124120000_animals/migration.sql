-- CreateEnum
CREATE TYPE "Species" AS ENUM ('DOG', 'CAT', 'OTHER');

-- CreateEnum
CREATE TYPE "AnimalSize" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');

-- CreateEnum
CREATE TYPE "AgeGroup" AS ENUM ('PUPPY_KITTEN', 'YOUNG', 'ADULT', 'SENIOR');

-- CreateEnum
CREATE TYPE "Temperament" AS ENUM ('CALM', 'PLAYFUL', 'ENERGETIC', 'SHY', 'AFFECTIONATE', 'INDEPENDENT');

-- CreateEnum
CREATE TYPE "AnimalStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'ADOPTED');

-- CreateTable
CREATE TABLE "shelters" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "shelters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animals" (
    "id" UUID NOT NULL,
    "shelter_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "species" "Species" NOT NULL,
    "size" "AnimalSize" NOT NULL,
    "age_group" "AgeGroup" NOT NULL,
    "breed" TEXT,
    "temperament" "Temperament"[],
    "compatible_with_children" BOOLEAN,
    "compatible_with_other_animals" BOOLEAN,
    "care_notes" TEXT,
    "photo_urls" TEXT[],
    "status" "AnimalStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "animals_pkey" PRIMARY KEY ("id"),
    -- Integrity safeguards in addition to application validation (AGENTS.md).
    CONSTRAINT "animals_name_length_check" CHECK (char_length(btrim("name")) BETWEEN 1 AND 100),
    CONSTRAINT "animals_photo_urls_count_check" CHECK (cardinality("photo_urls") BETWEEN 1 AND 5)
);

-- CreateIndex
CREATE INDEX "animals_status_created_at_idx" ON "animals"("status", "created_at");

-- AddForeignKey
ALTER TABLE "animals" ADD CONSTRAINT "animals_shelter_id_fkey" FOREIGN KEY ("shelter_id") REFERENCES "shelters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The single MVP shelter (Domain Model — Shelter). Its id is fixed and known to the API.
INSERT INTO "shelters" ("id", "name", "description", "updated_at")
VALUES ('00000000-0000-4000-8000-000000000001', 'YouPetMe', 'Catálogo propio de YouPetMe.', CURRENT_TIMESTAMP);