/**
 * EmTec Targets - API Server
 * Serves the catalog UI and provides API endpoints for target data
 */

import express from 'express';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'EmTec Targets API' });
});

/**
 * GET /api/targets
 * Query parameters:
 *   - material: Filter by material name (partial match)
 *   - diameter: Filter by diameter (exact or range with min/max)
 *   - thickness: Filter by thickness
 *   - type: Filter by target type (disc/annular)
 *   - search: Full-text search across material, part_number
 *   - sort: Sort field (material, diameter, thickness, part_number)
 *   - order: Sort order (asc/desc)
 *   - limit: Number of results (default 100)
 *   - offset: Pagination offset
 */
app.get('/api/targets', async (req, res) => {
  try {
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
      limit = 100,
      offset = 0
    } = req.query;

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
        t.notes,
        s.vendor,
        t.updated_at
      FROM targets t
      LEFT JOIN sources s ON t.source_id = s.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;

    // Material filter
    if (material) {
      query += ` AND LOWER(t.material) LIKE LOWER($${paramIndex})`;
      params.push(`%${material}%`);
      paramIndex++;
    }

    // Diameter filters
    if (diameter) {
      query += ` AND t.diameter_mm = $${paramIndex}`;
      params.push(parseFloat(diameter));
      paramIndex++;
    }
    if (diameter_min) {
      query += ` AND t.diameter_mm >= $${paramIndex}`;
      params.push(parseFloat(diameter_min));
      paramIndex++;
    }
    if (diameter_max) {
      query += ` AND t.diameter_mm <= $${paramIndex}`;
      params.push(parseFloat(diameter_max));
      paramIndex++;
    }

    // Thickness filters
    if (thickness) {
      query += ` AND t.thickness_mm = $${paramIndex}`;
      params.push(parseFloat(thickness));
      paramIndex++;
    }
    if (thickness_min) {
      query += ` AND t.thickness_mm >= $${paramIndex}`;
      params.push(parseFloat(thickness_min));
      paramIndex++;
    }
    if (thickness_max) {
      query += ` AND t.thickness_mm <= $${paramIndex}`;
      params.push(parseFloat(thickness_max));
      paramIndex++;
    }

    // Type filter
    if (type) {
      query += ` AND t.target_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    // Search filter
    if (search) {
      query += ` AND (
        LOWER(t.material) LIKE LOWER($${paramIndex}) OR
        LOWER(t.part_number) LIKE LOWER($${paramIndex}) OR
        LOWER(t.notes) LIKE LOWER($${paramIndex})
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Sorting
    const validSortFields = ['material', 'diameter_mm', 'thickness_mm', 'part_number', 'updated_at'];
    const sortField = validSortFields.includes(sort) ? sort : 'material';
    const sortOrder = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    query += ` ORDER BY t.${sortField} ${sortOrder} NULLS LAST`;

    // Pagination
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get total count for pagination
    let countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
    countQuery = countQuery.replace(/ORDER BY[\s\S]*$/, '');
    const countParams = params.slice(0, -2); // Remove limit/offset
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0]?.total || 0),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Error fetching targets:', error);
    res.status(500).json({ error: 'Failed to fetch targets' });
  }
});

/**
 * GET /api/targets/:id
 * Get a single target by ID
 */
app.get('/api/targets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT t.*, s.vendor, s.source_url
      FROM targets t
      LEFT JOIN sources s ON t.source_id = s.id
      WHERE t.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Target not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching target:', error);
    res.status(500).json({ error: 'Failed to fetch target' });
  }
});

/**
 * GET /api/materials
 * Get list of available materials with counts
 */
app.get('/api/materials', async (req, res) => {
  try {
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
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching materials:', error);
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
});

/**
 * GET /api/diameters
 * Get list of available diameters
 */
app.get('/api/diameters', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT diameter_mm
      FROM targets
      WHERE diameter_mm IS NOT NULL
      ORDER BY diameter_mm DESC
    `);
    res.json(result.rows.map(r => r.diameter_mm));
  } catch (error) {
    console.error('Error fetching diameters:', error);
    res.status(500).json({ error: 'Failed to fetch diameters' });
  }
});

/**
 * GET /api/thicknesses
 * Get list of available thicknesses
 */
app.get('/api/thicknesses', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT thickness_mm
      FROM targets
      WHERE thickness_mm IS NOT NULL
      ORDER BY thickness_mm ASC
    `);
    res.json(result.rows.map(r => r.thickness_mm));
  } catch (error) {
    console.error('Error fetching thicknesses:', error);
    res.status(500).json({ error: 'Failed to fetch thicknesses' });
  }
});

/**
 * GET /api/stats
 * Get catalog statistics
 */
app.get('/api/stats', async (req, res) => {
  try {
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
    
    res.json({
      ...stats.rows[0],
      last_sync: lastUpdate.rows[0]?.last_sync
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Serve the SPA for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 EmTec Targets server running on port ${PORT}`);
  console.log(`📍 Local: http://localhost:${PORT}`);
});

export default app;
