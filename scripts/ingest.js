/**
 * Data Ingestion Script for EmTec Targets
 * Fetches and parses sputter target catalog from Ted Pella
 * 
 * Usage: npm run ingest
 * 
 * Features:
 * - Fetches HTML from source URL
 * - Parses product tables for disc and annular targets
 * - Upserts data to Neon Postgres (idempotent)
 * - Tracks source attribution
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

const SOURCE_URL = process.env.TED_PELLA_SOURCE_URL || 'https://www.tedpella.com/example-sputter-targets';
const VENDOR = 'Ted Pella';

/**
 * Fetch the source HTML (with caching for development)
 */
async function fetchSourceHTML() {
  const cacheFile = path.join(process.cwd(), '.cache', 'source-page.html');
  
  // Check for cached version in development
  if (process.env.NODE_ENV === 'development' && fs.existsSync(cacheFile)) {
    console.log('📦 Using cached HTML from', cacheFile);
    return fs.readFileSync(cacheFile, 'utf8');
  }
  
  console.log('🌐 Fetching from:', SOURCE_URL);
  
  const response = await fetch(SOURCE_URL, {
    headers: {
      'User-Agent': 'EmTec-Targets-Ingestion/1.0 (catalog sync)'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch source: ${response.status} ${response.statusText}`);
  }
  
  const html = await response.text();
  
  // Cache for development
  if (process.env.NODE_ENV === 'development') {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, html);
    console.log('💾 Cached HTML to', cacheFile);
  }
  
  return html;
}

/**
 * Parse diameter from text (handles various formats)
 */
function parseDiameter(text) {
  if (!text) return null;
  
  // Match patterns like "62mm", "62 mm", "2.4"", "2.4 inch"
  const mmMatch = text.match(/(\d+(?:\.\d+)?)\s*mm/i);
  if (mmMatch) return parseFloat(mmMatch[1]);
  
  const inchMatch = text.match(/(\d+(?:\.\d+)?)\s*["″]?(?:\s*inch)?/i);
  if (inchMatch) return parseFloat(inchMatch[1]) * 25.4; // Convert to mm
  
  // Just a number
  const numMatch = text.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) return parseFloat(numMatch[1]);
  
  return null;
}

/**
 * Parse thickness from text
 */
function parseThickness(text) {
  if (!text) return null;
  
  const mmMatch = text.match(/(\d+(?:\.\d+)?)\s*mm/i);
  if (mmMatch) return parseFloat(mmMatch[1]);
  
  // Sometimes thickness is in microns
  const umMatch = text.match(/(\d+(?:\.\d+)?)\s*[μu]m/i);
  if (umMatch) return parseFloat(umMatch[1]) / 1000;
  
  const numMatch = text.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) return parseFloat(numMatch[1]);
  
  return null;
}

/**
 * Parse purity from text (e.g., "99.99%", "99.999%")
 */
function parsePurity(text) {
  if (!text) return null;
  
  const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (match) return match[0];
  
  // Handle formats like "4N" (99.99%) or "5N" (99.999%)
  const nMatch = text.match(/(\d)N/i);
  if (nMatch) {
    const nines = parseInt(nMatch[1]);
    return '99.' + '9'.repeat(nines - 2) + '%';
  }
  
  return null;
}

/**
 * Parse a table of disc targets
 */
function parseDiscTargets($, table, diameterMm) {
  const targets = [];
  
  $(table).find('tr').each((i, row) => {
    // Skip header rows
    if ($(row).find('th').length > 0) return;
    
    const cells = $(row).find('td');
    if (cells.length < 3) return;
    
    const partNumber = $(cells[0]).text().trim();
    const material = $(cells[1]).text().trim();
    const purity = parsePurity($(cells[2]).text());
    const thickness = parseThickness($(cells[3]).text());
    
    if (!partNumber || !material) return;
    
    targets.push({
      part_number: partNumber,
      target_type: 'disc',
      material: material,
      purity: purity,
      diameter_mm: diameterMm,
      thickness_mm: thickness,
      raw_excerpt: $(row).text().trim().substring(0, 500)
    });
  });
  
  return targets;
}

/**
 * Parse annular targets (have OD and ID)
 */
function parseAnnularTargets($, table) {
  const targets = [];
  
  $(table).find('tr').each((i, row) => {
    if ($(row).find('th').length > 0) return;
    
    const cells = $(row).find('td');
    if (cells.length < 4) return;
    
    const partNumber = $(cells[0]).text().trim();
    const material = $(cells[1]).text().trim();
    const od = parseDiameter($(cells[2]).text());
    const id = parseDiameter($(cells[3]).text());
    const thickness = parseThickness($(cells[4]).text());
    
    if (!partNumber || !material) return;
    
    targets.push({
      part_number: partNumber,
      target_type: 'annular',
      material: material,
      outer_diameter_mm: od,
      inner_diameter_mm: id,
      thickness_mm: thickness,
      raw_excerpt: $(row).text().trim().substring(0, 500)
    });
  });
  
  return targets;
}

/**
 * Main parsing function - customize based on actual page structure
 */
function parseTargetsFromHTML(html) {
  const $ = cheerio.load(html);
  const allTargets = [];
  
  console.log('📝 Parsing HTML for target data...');
  
  // Strategy: Look for tables with product data
  // This needs to be customized based on actual Ted Pella page structure
  
  // Example: Find all tables
  $('table').each((i, table) => {
    const tableText = $(table).text().toLowerCase();
    
    // Look for diameter indicators in nearby headings
    const prevHeading = $(table).prevAll('h2, h3, h4, strong').first().text();
    const diameterMatch = prevHeading.match(/(\d+(?:\.\d+)?)\s*mm/i);
    
    if (diameterMatch) {
      const diameter = parseFloat(diameterMatch[1]);
      const discTargets = parseDiscTargets($, table, diameter);
      allTargets.push(...discTargets);
      console.log(`   Found ${discTargets.length} targets for ${diameter}mm diameter`);
    }
    
    // Check for annular targets
    if (tableText.includes('annular') || tableText.includes('od') && tableText.includes('id')) {
      const annularTargets = parseAnnularTargets($, table);
      allTargets.push(...annularTargets);
      console.log(`   Found ${annularTargets.length} annular targets`);
    }
  });
  
  // Fallback: If no tables found, try parsing other structures
  if (allTargets.length === 0) {
    console.log('⚠️  No tables found - trying alternative parsing...');
    
    // Look for product rows/divs with part numbers
    $('[class*="product"], [class*="item"], tr, .row').each((i, el) => {
      const text = $(el).text();
      const partMatch = text.match(/\b(\d{5})\b/); // 5-digit part numbers
      
      if (partMatch) {
        allTargets.push({
          part_number: partMatch[1],
          target_type: 'disc',
          material: 'Unknown',
          raw_excerpt: text.trim().substring(0, 500)
        });
      }
    });
  }
  
  return allTargets;
}

/**
 * Upsert source record
 */
async function upsertSource(client) {
  const result = await client.query(`
    INSERT INTO sources (vendor, source_url, last_fetched_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (vendor, source_url) 
    DO UPDATE SET last_fetched_at = NOW()
    RETURNING id
  `, [VENDOR, SOURCE_URL]);
  
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
    console.log(`\\n✅ Parsed ${targets.length} total targets`);
    
    if (targets.length === 0) {
      console.log('⚠️  No targets found - check parsing logic');
      console.log('💡 You may need to customize the parsing for the actual page structure');
      process.exit(1);
    }
    
    // Connect to database
    console.log('\\n📦 Connecting to Neon Postgres...');
    client = await pool.connect();
    
    // Upsert source
    const sourceId = await upsertSource(client);
    console.log(`📝 Source record ID: ${sourceId}`);
    
    // Upsert all targets
    console.log('\\n💾 Upserting targets...');
    let inserted = 0, updated = 0;
    
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
      }
    }
    
    console.log(`\\n✅ Ingestion complete!`);
    console.log(`   📥 Inserted: ${inserted}`);
    console.log(`   🔄 Updated: ${updated}`);
    console.log(`   📊 Total: ${targets.length}`);
    
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
