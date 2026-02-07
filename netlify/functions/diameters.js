/**
 * Netlify Function: /api/diameters
 * Returns available diameters
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
    const result = await pool.query(`
      SELECT DISTINCT diameter_mm
      FROM targets
      WHERE diameter_mm IS NOT NULL
      ORDER BY diameter_mm DESC
    `);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result.rows.map(r => r.diameter_mm))
    };
  } catch (error) {
    console.error('Diameters error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch diameters', details: error.message })
    };
  }
}
