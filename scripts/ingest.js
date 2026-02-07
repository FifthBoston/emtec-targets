/**
 * Data Ingestion Script for EmTec Targets
 * Fetches and parses sputter target catalog from Ted Pella
 * 
 * Usage: npm run ingest
 */

import pg from 'pg';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const SOURCE_URL = process.env.TED_PELLA_SOURCE_URL || 'https://www.tedpella.com/cressington_html/Cressington-Targets.aspx';
const VENDOR = 'Ted Pella';

/**
 * Fetch the source HTML
 */
async function fetchSourceHTML() {
  const cacheFile = path.join(process.cwd(), '.cache', 'source-page.html');
  
  // Check for cached version in development
  if (process.env.USE_CACHE === 'true' && fs.existsSync(cacheFile)) {
    console.log('📦 Using cached HTML from', cacheFile);
    return fs.readFileSync(cacheFile, 'utf8');
  }
  
  console.log('🌐 Fetching from:', SOURCE_URL);
  
  const response = await fetch(SOURCE_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; EmTec-Targets/1.0)'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch source: ${response.status} ${response.statusText}`);
  }
  
  const html = await response.text();
  
  // Cache for development
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, html);
  console.log('💾 Cached HTML to', cacheFile);
  
  return html;
}

/**
 * Parse product description to extract details
 * Format: "Gold Target, 99.99% Au (Ø57mm x 0.1mm)"
 */
function parseDescription(desc) {
  const result = {
    material: null,
    purity: null,
    diameter_mm: null,
    thickness_mm: null,
    outer_diameter_mm: null,
    inner_diameter_mm: null,
    target_type: 'disc',
    alloy_ratio: null,
    backing_plate: null,
    notes: null
  };
  
  if (!desc) return result;
  
  // Extract material (before "Target")
  const materialMatch = desc.match(/^(.+?)\s*Target/i);
  if (materialMatch) {
    result.material = materialMatch[1].trim();
  }
  
  // Extract purity (e.g., "99.99% Au" or "99.99% Au:Pd 60/40 ratio")
  const purityMatch = desc.match(/(\d+\.?\d*%)\s*(\w+)/);
  if (purityMatch) {
    result.purity = purityMatch[1];
  }
  
  // Check for alloy ratio
  const alloyMatch = desc.match(/(\d+)[:/](\d+)\s*ratio/i);
  if (alloyMatch) {
    result.alloy_ratio = `${alloyMatch[1]}/${alloyMatch[2]}`;
  }
  
  // Extract diameter (Ø62mm or Ø54mm)
  const diameterMatch = desc.match(/[ØO](\d+(?:\.\d+)?)\s*(?:mm)?/i);
  if (diameterMatch) {
    result.diameter_mm = parseFloat(diameterMatch[1]);
  }
  
  // Extract thickness (x 0.1mm or x 3.2mm)
  const thicknessMatch = desc.match(/x\s*(\d+\.?\d*)\s*mm/i);
  if (thicknessMatch) {
    result.thickness_mm = parseFloat(thicknessMatch[1]);
  }
  
  // Check for annular targets (OD/ID)
  const annularODMatch = desc.match(/(\d+\.?\d*)\s*mm\s*O\.?D/i);
  const annularIDMatch = desc.match(/(\d+\.?\d*)\s*mm\s*I\.?D/i);
  if (annularODMatch && annularIDMatch) {
    result.target_type = 'annular';
    result.outer_diameter_mm = parseFloat(annularODMatch[1]);
    result.inner_diameter_mm = parseFloat(annularIDMatch[1]);
    result.diameter_mm = null; // Use OD/ID instead
  }
  
  // Check for backing plate
  if (desc.toLowerCase().includes('backing plate') || desc.toLowerCase().includes('copper backing')) {
    result.backing_plate = 'Copper';
  }
  
  // Notes for special items
  if (desc.includes('NEW')) {
    result.notes = 'New product';
  }
  if (desc.includes('ITO') || desc.includes('Indium Tin Oxide')) {
    result.notes = (result.notes ? result.notes + '; ' : '') + 'Indium Tin Oxide compound';
  }
  
  return result;
}

/**
 * Parse price string
 */
function parsePrice(priceStr) {
  if (!priceStr) return null;
  if (priceStr.includes('P.O.R.')) return null; // Price on Request
  
  const match = priceStr.replace(/[$,]/g, '').match(/(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Parse the Ted Pella HTML for target data
 */
function parseTargetsFromHTML(html) {
  const $ = cheerio.load(html);
  const allTargets = [];
  
  console.log('📝 Parsing HTML for target data...');
  
  // Find all product rows
  // The pattern is: Prod # | Description | Unit | Price
  // Each row with a numeric product number
  
  // Look for text patterns in the page content
  const pageText = $('body').text();
  
  // Parse product entries using regex on the text content
  // Pattern: 5-digit number followed by description with dimensions
  const productPattern = /\b(\d{4,5}(?:-\w)?)\s+(?:NEW\s+)?(.+?Target.*?(?:Ø\d+.*?mm|O\.D\..*?I\.D\.).*?)\s+each\s+\$?([\d,]+\.?\d*|P\.O\.R\.)/gi;
  
  let match;
  while ((match = productPattern.exec(pageText)) !== null) {
    const partNumber = match[1];
    const description = match[2].trim();
    const price = match[3];
    
    const parsed = parseDescription(description);
    
    if (parsed.material) {
      allTargets.push({
        part_number: partNumber,
        ...parsed,
        price_usd: parsePrice(price),
        raw_excerpt: description.substring(0, 500)
      });
    }
  }
  
  // Also parse using DOM structure for better accuracy
  $('table tr, .product-row, [class*="product"]').each((i, row) => {
    const text = $(row).text();
    
    // Look for product number pattern
    const prodMatch = text.match(/^\s*(\d{4,5}(?:-\w)?)\s+/);
    if (!prodMatch) return;
    
    const partNumber = prodMatch[1];
    
    // Skip if already found
    if (allTargets.find(t => t.part_number === partNumber)) return;
    
    // Extract description (contains Target and dimensions)
    const descMatch = text.match(/(\w+(?:\/\w+)?\s+Target[^$]+?)(?:each|\$|P\.O\.R)/i);
    if (!descMatch) return;
    
    const description = descMatch[1].trim();
    const parsed = parseDescription(description);
    
    // Extract price
    const priceMatch = text.match(/\$\s*([\d,]+\.?\d*)|P\.O\.R\./);
    const price = priceMatch ? priceMatch[0] : null;
    
    if (parsed.material) {
      allTargets.push({
        part_number: partNumber,
        ...parsed,
        price_usd: parsePrice(price),
        raw_excerpt: description.substring(0, 500)
      });
    }
  });
  
  // Deduplicate by part number
  const seen = new Set();
  const unique = allTargets.filter(t => {
    if (seen.has(t.part_number)) return false;
    seen.add(t.part_number);
    return true;
  });
  
  return unique;
}

/**
 * Upsert source record
 */
async function upsertSource(client) {
  const result = await client.query(`
    INSERT INTO sources (vendor, source_url, source_page_title, last_fetched_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (vendor, source_url) 
    DO UPDATE SET 
      last_fetched_at = NOW(),
      source_page_title = EXCLUDED.source_page_title
    RETURNING id
  `, [VENDOR, SOURCE_URL, 'Disk or Annular Sputter Targets']);
  
  return result.rows[0].id;
}

/**
 * Upsert a single target
 */
async function upsertTarget(client, target, sourceId) {
  const query = `
    INSERT INTO targets (
      source_id, part_number, target_type, material, purity,
      diameter_mm, outer_diameter_mm, inner_diameter_mm, thickness_mm,
      backing_plate, alloy_ratio, notes, raw_excerpt
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (part_number) DO UPDATE SET
      source_id = EXCLUDED.source_id,
      target_type = EXCLUDED.target_type,
      material = EXCLUDED.material,
      purity = EXCLUDED.purity,
      diameter_mm = EXCLUDED.diameter_mm,
      outer_diameter_mm = EXCLUDED.outer_diameter_mm,
      inner_diameter_mm = EXCLUDED.inner_diameter_mm,
      thickness_mm = EXCLUDED.thickness_mm,
      backing_plate = EXCLUDED.backing_plate,
      alloy_ratio = EXCLUDED.alloy_ratio,
      notes = EXCLUDED.notes,
      raw_excerpt = EXCLUDED.raw_excerpt,
      updated_at = NOW()
    RETURNING id, (xmax = 0) as is_insert
  `;
  
  const values = [
    sourceId,
    target.part_number,
    target.target_type || 'disc',
    target.material,
    target.purity || null,
    target.diameter_mm || null,
    target.outer_diameter_mm || null,
    target.inner_diameter_mm || null,
    target.thickness_mm || null,
    target.backing_plate || null,
    target.alloy_ratio || null,
    target.notes || null,
    target.raw_excerpt || null
  ];
  
  return client.query(query, values);
}

/**
 * Main ingestion function
 */
async function ingest() {
  console.log('🚀 Starting EmTec Targets data ingestion...');
  console.log(`📍 Source: ${VENDOR}`);
  console.log(`🔗 URL: ${SOURCE_URL}`);
  console.log('');
  
  let client;
  
  try {
    // Fetch HTML
    const html = await fetchSourceHTML();
    console.log(`📄 Fetched ${(html.length / 1024).toFixed(1)} KB of HTML`);
    
    // Parse targets
    const targets = parseTargetsFromHTML(html);
    console.log(`\n✅ Parsed ${targets.length} total targets`);
    
    if (targets.length === 0) {
      console.log('⚠️  No targets found - check parsing logic');
      process.exit(1);
    }
    
    // Show sample
    console.log('\n📋 Sample parsed targets:');
    targets.slice(0, 5).forEach(t => {
      console.log(`   ${t.part_number}: ${t.material} ${t.diameter_mm || t.outer_diameter_mm}mm ${t.target_type}`);
    });
    
    // Connect to database
    console.log('\n📦 Connecting to Neon Postgres...');
    client = await pool.connect();
    
    // Upsert source
    const sourceId = await upsertSource(client);
    console.log(`📝 Source record ID: ${sourceId}`);
    
    // Upsert all targets
    console.log('\n💾 Upserting targets...');
    let inserted = 0, updated = 0, errors = 0;
    
    for (const target of targets) {
      try {
        const result = await upsertTarget(client, target, sourceId);
        if (result.rows[0].is_insert) {
          inserted++;
        } else {
          updated++;
        }
      } catch (err) {
        console.error(`   ❌ Failed to upsert ${target.part_number}:`, err.message);
        errors++;
      }
    }
    
    console.log(`\n✅ Ingestion complete!`);
    console.log(`   📥 Inserted: ${inserted}`);
    console.log(`   🔄 Updated: ${updated}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📊 Total: ${targets.length}`);
    
    // Show stats
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT material) as materials,
        COUNT(DISTINCT diameter_mm) as diameters,
        COUNT(*) FILTER (WHERE target_type = 'disc') as disc_count,
        COUNT(*) FILTER (WHERE target_type = 'annular') as annular_count
      FROM targets
    `);
    
    console.log('\n📊 Catalog Summary:');
    console.log(`   Total targets: ${stats.rows[0].total}`);
    console.log(`   Unique materials: ${stats.rows[0].materials}`);
    console.log(`   Disc targets: ${stats.rows[0].disc_count}`);
    console.log(`   Annular targets: ${stats.rows[0].annular_count}`);
    
  } catch (error) {
    console.error('❌ Ingestion failed:', error.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

// Run if called directly
ingest();
