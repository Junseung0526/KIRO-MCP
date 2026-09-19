-- CreateTable
CREATE TABLE "notion_credentials" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "encrypted_token" TEXT NOT NULL,
    "database_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notion_credentials_pkey" PRIMARY KEY ("id")
);
