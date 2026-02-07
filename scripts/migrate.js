/**
 * Database Migration Script for EmTec Targets
 * Creates the schema for sputter target catalog
 * 
 * Usage: npm run db:migrate
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const schema = `
-- Sources table: tracks where data came from
CREATE TABLE IF NOT EXISTS sources (
  id SERIAL PRIMARY KEY,
  vendor VARCHAR(100) NOT NULL,
  source_url TEXT NOT NULL,
  source_page_title VARCHAR(255),
  last_fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendor, source_url)
);

-- Target types enum
DO $$ BEGIN
  CREATE TYPE target_type AS ENUM ('disc', 'annular', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Main targets table
CREATE TABLE IF NOT EXISTS targets (
  id SERIAL PRIMARY KEY,
  
  -- Source tracking
  source_id INTEGER REFERENCES sources(id),
  part_number VARCHAR(50) NOT NULL,
  
  -- Target specifications
  target_type target_type DEFAULT 'disc',
  material VARCHAR(100) NOT NULL,
  purity VARCHAR(50),
  
  -- Dimensions (in mm)
  diameter_mm DECIMAL(10,3),
  outer_diameter_mm DECIMAL(10,3),  -- For annular targets
  inner_diameter_mm DECIMAL(10,3),  -- For annular targets
  thickness_mm DECIMAL(10,4),
  
  -- Additional info
  backing_plate VARCHAR(100),
  alloy_ratio VARCHAR(100),
  notes TEXT,
  
  -- Pricing (optional, may be volatile)
  price_usd DECIMAL(10,2),
  price_notes VARCHAR(255),
  
  -- Metadata
  raw_excerpt TEXT,  -- Original text for debugging
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint for upserts
  UNIQUE(part_number)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_targets_material ON targets(material);
CREATE INDEX IF NOT EXISTS idx_targets_diameter ON targets(diameter_mm);
CREATE INDEX IF NOT EXISTS idx_targets_thickness ON targets(thickness_mm);
CREATE INDEX IF NOT EXISTS idx_targets_type ON targets(target_type);
CREATE INDEX IF NOT EXISTS idx_targets_source ON targets(source_id);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_targets_updated_at ON targets;
CREATE TRIGGER update_targets_updated_at
  BEFORE UPDATE ON targets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Materials lookup table (optional, for filtering UI)
CREATE TABLE IF NOT EXISTS materials (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50),
  color_gradient VARCHAR(100)
);

-- Seed common materials
INSERT INTO materials (symbol, name, category, color_gradient) VALUES
  ('Au', 'Gold', 'precious', 'linear-gradient(135deg, #FFD700, #FFA500)'),
  ('Ag', 'Silver', 'precious', 'linear-gradient(135deg, #C0C0C0, #A8A8A8)'),
  ('Pt', 'Platinum', 'precious', 'linear-gradient(135deg, #E5E4E2, #BCC6CC)'),
  ('Cu', 'Copper', 'base', 'linear-gradient(135deg, #B87333, #DA8A67)'),
  ('Al', 'Aluminum', 'base', 'linear-gradient(135deg, #A8A9AD, #848789)'),
  ('Ti', 'Titanium', 'refractory', 'linear-gradient(135deg, #878681, #54534D)'),
  ('Cr', 'Chromium', 'refractory', 'linear-gradient(135deg, #DBE4EB, #9BA4AA)'),
  ('Pd', 'Palladium', 'precious', 'linear-gradient(135deg, #CED0DD, #9A9BA3)'),
  ('Ni', 'Nickel', 'base', 'linear-gradient(135deg, #727472, #8F908F)'),
  ('W', 'Tungsten', 'refractory', 'linear-gradient(135deg, #4A4A4A, #7A7A7A)'),
  ('Ta', 'Tantalum', 'refractory', 'linear-gradient(135deg, #4C4C4C, #6D6D6D)'),
  ('Mo', 'Molybdenum', 'refractory', 'linear-gradient(135deg, #54534D, #878681)'),
  ('C', 'Carbon', 'other', 'linear-gradient(135deg, #1C1C1C, #3D3D3D)'),
  ('Si', 'Silicon', 'semiconductor', 'linear-gradient(135deg, #4B5563, #6B7280)'),
  ('Ir', 'Iridium', 'precious', 'linear-gradient(135deg, #E8E8E8, #D0D0D0)')
ON CONFLICT (symbol) DO NOTHING;

-- View for easy querying with source info
CREATE OR REPLACE VIEW targets_with_source AS
SELECT 
  t.*,
  s.vendor,
  s.source_url,
  s.last_fetched_at as source_last_fetched
FROM targets t
LEFT JOIN sources s ON t.source_id = s.id;
`;

async function migrate() {
  console.log('🚀 Starting database migration...');
  console.log('📦 Connecting to Neon Postgres...');
  
  try {
    const client = await pool.connect();
    console.log('✅ Connected to database');
    
    console.log('📝 Running schema migration...');
    await client.query(schema);
    
    console.log('✅ Migration complete!');
    
    // Show table info
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log('\\n📊 Tables created:');
    tables.rows.forEach(row => console.log(`   - ${row.table_name}`));
    
    client.release();
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
