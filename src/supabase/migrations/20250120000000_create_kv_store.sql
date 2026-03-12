-- Create the KV store table for Figma Make integration
CREATE TABLE IF NOT EXISTS kv_store_201cacde (
  key TEXT NOT NULL PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create an index for faster JSON queries
CREATE INDEX IF NOT EXISTS idx_kv_store_value ON kv_store_201cacde USING gin(value);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger to automatically update the updated_at column
DROP TRIGGER IF EXISTS update_kv_store_updated_at ON kv_store_201cacde;
CREATE TRIGGER update_kv_store_updated_at
    BEFORE UPDATE ON kv_store_201cacde
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE kv_store_201cacde ENABLE ROW LEVEL SECURITY;

-- Create policies for the service role
CREATE POLICY IF NOT EXISTS "Enable full access for service role" ON kv_store_201cacde
  FOR ALL USING (auth.role() = 'service_role');

-- Allow authenticated users to read their own data (optional)
CREATE POLICY IF NOT EXISTS "Enable select for authenticated users" ON kv_store_201cacde
  FOR SELECT USING (auth.role() = 'authenticated');