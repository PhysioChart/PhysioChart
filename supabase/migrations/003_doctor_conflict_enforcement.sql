-- Step 1: add the new blocking-capable status in its own migration transaction.
ALTER TYPE public.appointment_status
  ADD VALUE IF NOT EXISTS 'checked_in';
