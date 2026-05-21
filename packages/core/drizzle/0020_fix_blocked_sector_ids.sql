-- Fix: Add blocked_sector_ids column to roles table
-- This column was supposed to be added in migration 0019 but the file was modified after it was already applied
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "blocked_sector_ids" uuid[] DEFAULT '{}' NOT NULL;
