-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "email" TYPE VARCHAR(100);
ALTER TABLE "User" ALTER COLUMN "name" TYPE VARCHAR(100);
ALTER TABLE "User" ADD COLUMN "passwordHash" VARCHAR(255);
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill existing users with initial credentials and roles.
WITH ranked_users AS (
  SELECT
    "id",
    row_number() OVER (
      ORDER BY
        CASE WHEN "email" = 'alvaro@melt.local' THEN 0 ELSE 1 END,
        "id"
    ) AS rn
  FROM "User"
)
UPDATE "User" AS u
SET
  "passwordHash" = CASE WHEN ranked_users.rn = 1
    THEN '$2b$10$ECzDwSh4OP8vUgdIWz/dbuLEHz9gIlajlJpTb3wtb93FRjiCTTUBi'
    ELSE '$2b$10$WG.KY3lVEejWAB6a2TwcKOtBfyv8pRk/0m0iUHtkQvnS5peItMQqq'
  END,
  "role" = CASE WHEN ranked_users.rn = 1 THEN 'ADMIN'::"UserRole" ELSE 'USER'::"UserRole" END,
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP
FROM ranked_users
WHERE u."id" = ranked_users."id";

ALTER TABLE "User" ALTER COLUMN "passwordHash" SET NOT NULL;

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" VARCHAR(191) NOT NULL,
    "userId" INTEGER NOT NULL,
    "refreshTokenHash" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auth_sessions_userId_idx" ON "auth_sessions"("userId");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
