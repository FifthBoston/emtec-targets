/**
 * Netlify Function: /api/stats
 * Returns catalog statistics
 */

import pg from 'pg';

const { Pool } = pg;

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: true,
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
}

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  try {
    if (!process.env.DATABASE_URL) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'DATABASE_URL not configured' })
      };
    }

    const pool = getPool();
    
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_targets,
        COUNT(DISTINCT material) as unique_materials,
        COUNT(DISTINCT diameter_mm) as unique_diameters,
        COUNT(*) FILTER (WHERE target_type = 'disc') as disc_targets,
        COUNT(*) FILTER (WHERE target_type = 'annular') as annular_targets
      FROM targets
    `);

    const lastUpdate = await pool.query(`
      SELECT MAX(last_fetched_at) as last_sync FROM sources
    `);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ...stats.rows[0],
        last_sync: lastUpdate.rows[0]?.last_sync
      })
    };
  } catch (error) {
    console.error('Stats error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch stats', details: error.message })
    };
  }
}
