/**
 * Netlify Function: /api/thicknesses
 * Returns available thicknesses
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
      SELECT DISTINCT thickness_mm
      FROM targets
      WHERE thickness_mm IS NOT NULL
      ORDER BY thickness_mm ASC
    `);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result.rows.map(r => r.thickness_mm))
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch thicknesses' })
    };
  }
}
