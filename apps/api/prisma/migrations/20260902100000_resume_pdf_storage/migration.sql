-- AlterTable
ALTER TABLE "resumes" ADD COLUMN "pdf_storage_path" TEXT,
ADD COLUMN "pdf_storage_uri" TEXT,
ADD COLUMN "pdf_public_url" TEXT,
ADD COLUMN "pdf_uploaded_at" TIMESTAMP(3);
