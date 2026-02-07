/**
 * Seed Script - Populate database with sample data for testing
 * Usage: npm run db:seed
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Sample target data (based on typical Ted Pella offerings)
const sampleTargets = [
  // 62mm diameter disc targets
  { part_number: '91700', material: 'Gold', purity: '99.99%', diameter_mm: 62, thickness_mm: 0.1, target_type: 'disc' },
  { part_number: '91701', material: 'Gold', purity: '99.99%', diameter_mm: 62, thickness_mm: 0.2, target_type: 'disc' },
  { part_number: '91710', material: 'Silver', purity: '99.99%', diameter_mm: 62, thickness_mm: 0.1, target_type: 'disc' },
  { part_number: '91711', material: 'Silver', purity: '99.99%', diameter_mm: 62, thickness_mm: 0.2, target_type: 'disc' },
  { part_number: '91720', material: 'Platinum', purity: '99.95%', diameter_mm: 62, thickness_mm: 0.1, target_type: 'disc' },
  { part_number: '91730', material: 'Copper', purity: '99.99%', diameter_mm: 62, thickness_mm: 0.2, target_type: 'disc' },
  { part_number: '91740', material: 'Aluminum', purity: '99.99%', diameter_mm: 62, thickness_mm: 0.2, target_type: 'disc' },
  { part_number: '91750', material: 'Titanium', purity: '99.995%', diameter_mm: 62, thickness_mm: 0.2, target_type: 'disc' },
  { part_number: '91760', material: 'Chromium', purity: '99.95%', diameter_mm: 62, thickness_mm: 0.2, target_type: 'disc' },
  
  // 60mm diameter disc targets
  { part_number: '91800', material: 'Gold', purity: '99.99%', diameter_mm: 60, thickness_mm: 0.1, target_type: 'disc' },
  { part_number: '91810', material: 'Silver', purity: '99.99%', diameter_mm: 60, thickness_mm: 0.1, target_type: 'disc' },
  { part_number: '91820', material: 'Palladium', purity: '99.95%', diameter_mm: 60, thickness_mm: 0.1, target_type: 'disc' },
  { part_number: '91830', material: 'Iridium', purity: '99.9%', diameter_mm: 60, thickness_mm: 0.1, target_type: 'disc' },
  
  // 57mm diameter disc targets
  { part_number: '91900', material: 'Gold', purity: '99.999%', diameter_mm: 57, thickness_mm: 0.1, target_type: 'disc' },
  { part_number: '91901', material: 'Gold', purity: '99.99%', diameter_mm: 57, thickness_mm: 0.076, target_type: 'disc' },
  { part_number: '91910', material: 'Silver', purity: '99.99%', diameter_mm: 57, thickness_mm: 0.1, target_type: 'disc' },
  { part_number: '91920', material: 'Platinum', purity: '99.99%', diameter_mm: 57, thickness_mm: 0.1, target_type: 'disc' },
  { part_number: '91930', material: 'Carbon', purity: '99.95%', diameter_mm: 57, thickness_mm: 3.2, target_type: 'disc' },
  
  // 54mm diameter disc targets
  { part_number: '92000', material: 'Gold', purity: '99.99%', diameter_mm: 54, thickness_mm: 0.1, target_type: 'disc' },
  { part_number: '92010', material: 'Copper', purity: '99.999%', diameter_mm: 54, thickness_mm: 0.2, target_type: 'disc' },
  { part_number: '92020', material: 'Aluminum', purity: '99.999%', diameter_mm: 54, thickness_mm: 0.2, target_type: 'disc' },
  
  // 50mm diameter disc targets
  { part_number: '92100', material: 'Gold', purity: '99.99%', diameter_mm: 50, thickness_mm: 0.1, target_type: 'disc' },
  { part_number: '92110', material: 'Silver', purity: '99.99%', diameter_mm: 50, thickness_mm: 0.1, target_type: 'disc' },
  { part_number: '92120', material: 'Titanium', purity: '99.99%', diameter_mm: 50, thickness_mm: 0.2, target_type: 'disc' },
  
  // Annular targets
  { part_number: '93000', material: 'Gold', purity: '99.99%', outer_diameter_mm: 60, inner_diameter_mm: 20, thickness_mm: 0.1, target_type: 'annular' },
  { part_number: '93010', material: 'Silver', purity: '99.99%', outer_diameter_mm: 60, inner_diameter_mm: 20, thickness_mm: 0.1, target_type: 'annular' },
  { part_number: '93020', material: 'Platinum', purity: '99.95%', outer_diameter_mm: 57, inner_diameter_mm: 18, thickness_mm: 0.1, target_type: 'annular' },
  { part_number: '93030', material: 'Copper', purity: '99.99%', outer_diameter_mm: 54, inner_diameter_mm: 16, thickness_mm: 0.2, target_type: 'annular' },
  
  // Alloy targets
  { part_number: '94000', material: 'Gold/Palladium', purity: '80/20', diameter_mm: 57, thickness_mm: 0.1, target_type: 'disc', alloy_ratio: '80% Au / 20% Pd' },
  { part_number: '94010', material: 'Gold/Palladium', purity: '60/40', diameter_mm: 57, thickness_mm: 0.1, target_type: 'disc', alloy_ratio: '60% Au / 40% Pd' },
];

async function seed() {
  console.log('🌱 Starting database seed...');
  
  let client;
  try {
    client = await pool.connect();
    
    // Create source record
    const sourceResult = await client.query(`
      INSERT INTO sources (vendor, source_url, source_page_title)
      VALUES ($1, $2, $3)
      ON CONFLICT (vendor, source_url) DO UPDATE SET last_fetched_at = NOW()
      RETURNING id
    `, ['Ted Pella', 'https://www.tedpella.com/sputter-targets', 'Disc or Annular Sputter Targets (Sample Data)']);
    
    const sourceId = sourceResult.rows[0].id;
    console.log(`📝 Source ID: ${sourceId}`);
    
    // Insert targets
    let inserted = 0;
    for (const target of sampleTargets) {
      await client.query(`
        INSERT INTO targets (
          source_id, part_number, target_type, material, purity,
          diameter_mm, outer_diameter_mm, inner_diameter_mm, thickness_mm, alloy_ratio
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (part_number) DO UPDATE SET
          material = EXCLUDED.material,
          purity = EXCLUDED.purity,
          diameter_mm = EXCLUDED.diameter_mm,
          outer_diameter_mm = EXCLUDED.outer_diameter_mm,
          inner_diameter_mm = EXCLUDED.inner_diameter_mm,
          thickness_mm = EXCLUDED.thickness_mm,
          alloy_ratio = EXCLUDED.alloy_ratio,
          updated_at = NOW()
      `, [
        sourceId,
        target.part_number,
        target.target_type,
        target.material,
        target.purity,
        target.diameter_mm || null,
        target.outer_diameter_mm || null,
        target.inner_diameter_mm || null,
        target.thickness_mm || null,
        target.alloy_ratio || null
      ]);
      inserted++;
    }
    
    console.log(`✅ Seeded ${inserted} targets`);
    
    // Show summary
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT material) as materials,
        COUNT(DISTINCT diameter_mm) as diameters
      FROM targets
    `);
    
    console.log('\\n📊 Catalog Summary:');
    console.log(`   Total targets: ${stats.rows[0].total}`);
    console.log(`   Unique materials: ${stats.rows[0].materials}`);
    console.log(`   Unique diameters: ${stats.rows[0].diameters}`);
    
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

seed();
