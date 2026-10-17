-- CreateTable
CREATE TABLE "ResumeParse" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "structured" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeParse_pkey" PRIMARY KEY ("id")
);
