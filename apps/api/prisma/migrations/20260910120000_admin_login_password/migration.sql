-- Super Admin can view platform staff login passwords after create.
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "login_password" TEXT;
