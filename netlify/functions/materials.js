/**
 * Netlify Function: /api/materials
 * Returns available materials with counts
 */

import pg from 'pg';

const { Pool } = pg;

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 10000,
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
    const pool = getPool();
    const result = await pool.query(`
      SELECT 
        t.material,
        m.symbol,
        m.color_gradient,
        COUNT(*) as count
      FROM targets t
      LEFT JOIN materials m ON LOWER(t.material) = LOWER(m.name)
      GROUP BY t.material, m.symbol, m.color_gradient
      ORDER BY count DESC
    `);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result.rows)
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch materials' })
    };
  }
}
