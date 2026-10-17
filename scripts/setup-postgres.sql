-- Run this in PostgreSQL 18 SQL Shell as the superuser (usually "postgres"):
-- Start Menu → PostgreSQL 18 → SQL Shell (psql)
-- Server: localhost  Port: 5432  Database: postgres  Username: postgres
-- Then paste this file:  \i C:/Users/ADMIN/Desktop/CareerBridge/scripts/setup-postgres.sql

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'careerbridge') THEN
    ALTER ROLE careerbridge WITH LOGIN PASSWORD 'careerbridge';
  ELSE
    CREATE ROLE careerbridge LOGIN PASSWORD 'careerbridge';
  END IF;
END
$$;

SELECT 'CREATE DATABASE careerbridge OWNER careerbridge'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'careerbridge')\gexec

GRANT ALL PRIVILEGES ON DATABASE careerbridge TO careerbridge;

\c careerbridge
GRANT ALL ON SCHEMA public TO careerbridge;
ALTER SCHEMA public OWNER TO careerbridge;
