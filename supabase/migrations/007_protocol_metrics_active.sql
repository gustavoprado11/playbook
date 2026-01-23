-- Add is_active column to protocol_metrics table
ALTER TABLE "public"."protocol_metrics"
ADD COLUMN "is_active" boolean NOT NULL DEFAULT true;

-- Update RLS to ensure active metrics are visible (though typically we want to see history too)
-- Existing policies likely cover "select", but we might want to filter active metrics in specific queries.
-- No RLS change needed for "viewing", just for filtering in UI/Queries.
