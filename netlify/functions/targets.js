/**
 * Netlify Function: /api/targets
 * Returns filtered sputter targets from Neon Postgres
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
    const params = event.queryStringParameters || {};
    const {
      material,
      diameter,
      diameter_min,
      diameter_max,
      thickness,
      thickness_min,
      thickness_max,
      type,
      search,
      sort = 'material',
      order = 'asc',
      limit = '100',
      offset = '0'
    } = params;

    let query = `
      SELECT 
        t.id,
        t.part_number,
        t.target_type,
        t.material,
        t.purity,
        t.diameter_mm,
        t.outer_diameter_mm,
        t.inner_diameter_mm,
        t.thickness_mm,
        t.backing_plate,
        t.alloy_ratio,
        t.notes,
        s.vendor,
        t.updated_at
      FROM targets t
      LEFT JOIN sources s ON t.source_id = s.id
      WHERE 1=1
    `;

    const values = [];
    let paramIndex = 1;

    if (material) {
      query += ` AND LOWER(t.material) LIKE LOWER($${paramIndex})`;
      values.push(`%${material}%`);
      paramIndex++;
    }

    if (diameter) {
      query += ` AND t.diameter_mm = $${paramIndex}`;
      values.push(parseFloat(diameter));
      paramIndex++;
    }
    if (diameter_min) {
      query += ` AND t.diameter_mm >= $${paramIndex}`;
      values.push(parseFloat(diameter_min));
      paramIndex++;
    }
    if (diameter_max) {
      query += ` AND t.diameter_mm <= $${paramIndex}`;
      values.push(parseFloat(diameter_max));
      paramIndex++;
    }

    if (thickness) {
      query += ` AND t.thickness_mm = $${paramIndex}`;
      values.push(parseFloat(thickness));
      paramIndex++;
    }
    if (thickness_min) {
      query += ` AND t.thickness_mm >= $${paramIndex}`;
      values.push(parseFloat(thickness_min));
      paramIndex++;
    }
    if (thickness_max) {
      query += ` AND t.thickness_mm <= $${paramIndex}`;
      values.push(parseFloat(thickness_max));
      paramIndex++;
    }

    if (type) {
      query += ` AND t.target_type = $${paramIndex}`;
      values.push(type);
      paramIndex++;
    }

    if (search) {
      query += ` AND (
        LOWER(t.material) LIKE LOWER($${paramIndex}) OR
        LOWER(t.part_number) LIKE LOWER($${paramIndex}) OR
        LOWER(t.notes) LIKE LOWER($${paramIndex})
      )`;
      values.push(`%${search}%`);
      paramIndex++;
    }

    // Sorting
    const validSortFields = ['material', 'diameter_mm', 'thickness_mm', 'part_number', 'updated_at'];
    const sortField = validSortFields.includes(sort) ? sort : 'material';
    const sortOrder = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    query += ` ORDER BY t.${sortField} ${sortOrder} NULLS LAST`;

    // Pagination
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(parseInt(limit), parseInt(offset));

    const pool = getPool();
    const result = await pool.query(query, values);

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM targets t WHERE 1=1`;
    const countValues = [];
    let countIndex = 1;

    if (material) {
      countQuery += ` AND LOWER(t.material) LIKE LOWER($${countIndex})`;
      countValues.push(`%${material}%`);
      countIndex++;
    }
    if (type) {
      countQuery += ` AND t.target_type = $${countIndex}`;
      countValues.push(type);
      countIndex++;
    }
    if (search) {
      countQuery += ` AND (LOWER(t.material) LIKE LOWER($${countIndex}) OR LOWER(t.part_number) LIKE LOWER($${countIndex}))`;
      countValues.push(`%${search}%`);
      countIndex++;
    }

    const countResult = await pool.query(countQuery, countValues);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        data: result.rows,
        pagination: {
          total: parseInt(countResult.rows[0]?.total || 0),
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch targets' })
    };
  }
}
