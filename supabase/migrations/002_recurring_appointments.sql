-- Add series support to appointments table for recurring bookings
ALTER TABLE public.appointments
  ADD COLUMN series_id uuid DEFAULT NULL,
  ADD COLUMN series_index integer DEFAULT NULL;

-- Partial index for efficient series lookups (only rows with a series_id)
CREATE INDEX idx_appointments_series_id
  ON public.appointments(series_id)
  WHERE series_id IS NOT NULL;

COMMENT ON COLUMN public.appointments.series_id IS
  'Groups appointments created as a recurring series. NULL for single bookings.';
COMMENT ON COLUMN public.appointments.series_index IS
  'Position within the series (1-based). NULL for single bookings.';
