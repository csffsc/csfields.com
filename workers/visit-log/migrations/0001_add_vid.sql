ALTER TABLE visits ADD COLUMN vid TEXT;
CREATE INDEX IF NOT EXISTS idx_visits_vid ON visits(vid);
