require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

/* ============================================================
   PEGA AQUI EL LINK DE TU BASE DE DATOS DE NEON (si quieres)
   Ejemplo: "postgresql://usuario:password@ep-xxx.neon.tech/neondb?sslmode=require"
   Si lo pegas aquí, no necesitas crear el archivo .env
   ============================================================ */
const NEON_URL_MANUAL = "postgresql://neondb_owner:npg_e9WJxtoKp1Gz@ep-icy-shape-b5e0rz1y-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const connectionString = process.env.DATABASE_URL || NEON_URL_MANUAL;

if (!connectionString) {
  console.warn('⚠️  No configuraste ninguna base de datos. Pega tu link de Neon en server.js o en el archivo .env (DATABASE_URL).');
}

const pool = new Pool({
  connectionString: connectionString || undefined,
  ssl: connectionString ? { rejectUnauthorized: false } : false
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function requireDB(res) {
  if (!connectionString) {
    res.status(503).json({
      error: 'Base de datos no configurada. Pega tu DATABASE_URL de Neon en server.js (NEON_URL_MANUAL) o en el archivo .env.'
    });
    return false;
  }
  return true;
}

// Crea las tablas automáticamente si no existen
async function initDB() {
  if (!connectionString) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS perfumes (
      id SERIAL PRIMARY KEY,
      tipo VARCHAR(20) NOT NULL DEFAULT 'propio',
      nombre VARCHAR(255) NOT NULL,
      precio_mayor NUMERIC(10,2) DEFAULT 0,
      precio_venta NUMERIC(10,2) DEFAULT 0,
      fecha_venta DATE,
      monto_abonado NUMERIC(10,2) DEFAULT 0,
      creado_en TIMESTAMP DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS abonos (
      id SERIAL PRIMARY KEY,
      perfume_id INTEGER REFERENCES perfumes(id) ON DELETE CASCADE,
      monto NUMERIC(10,2) NOT NULL,
      fecha TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('✅ Tablas listas en la base de datos.');
}
initDB().catch(err => console.error('❌ Error creando tablas:', err.message));

/* ------------------------- RUTAS API ------------------------- */

// Obtener todos los perfumes de un tipo (propio | mayorista)
app.get('/api/perfumes', async (req, res) => {
  if (!requireDB(res)) return;
  try {
    const { tipo } = req.query;
    const result = await pool.query(
      'SELECT * FROM perfumes WHERE tipo = $1 ORDER BY creado_en DESC',
      [tipo]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Crear un perfume nuevo
app.post('/api/perfumes', async (req, res) => {
  if (!requireDB(res)) return;
  try {
    const { tipo, nombre, precio_mayor, precio_venta, fecha_venta } = req.body;
    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    if (!tipo || !['propio', 'mayorista'].includes(tipo)) {
      return res.status(400).json({ error: 'tipo debe ser "propio" o "mayorista"' });
    }
    const result = await pool.query(
      `INSERT INTO perfumes (tipo, nombre, precio_mayor, precio_venta, fecha_venta)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [tipo, String(nombre).trim(), Number(precio_mayor) || 0, Number(precio_venta) || 0, fecha_venta || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Editar un perfume
app.put('/api/perfumes/:id', async (req, res) => {
  if (!requireDB(res)) return;
  try {
    const { nombre, precio_mayor, precio_venta, fecha_venta } = req.body;
    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    const result = await pool.query(
      `UPDATE perfumes SET nombre=$1, precio_mayor=$2, precio_venta=$3, fecha_venta=$4
       WHERE id=$5 RETURNING *`,
      [String(nombre).trim(), Number(precio_mayor) || 0, Number(precio_venta) || 0, fecha_venta || null, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Perfume no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Eliminar un perfume
app.delete('/api/perfumes/:id', async (req, res) => {
  if (!requireDB(res)) return;
  try {
    await pool.query('DELETE FROM perfumes WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Registrar un abono (pago parcial) a un perfume
app.post('/api/abonos', async (req, res) => {
  if (!requireDB(res)) return;
  const client = await pool.connect();
  try {
    const { perfume_id, monto } = req.body;
    if (!perfume_id || !monto || Number(monto) <= 0) {
      return res.status(400).json({ error: 'perfume_id y monto (>0) son obligatorios' });
    }
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO abonos (perfume_id, monto) VALUES ($1,$2)',
      [perfume_id, Number(monto)]
    );
    const result = await client.query(
      `UPDATE perfumes SET monto_abonado = monto_abonado + $1
       WHERE id = $2 RETURNING *`,
      [Number(monto), perfume_id]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Perfume no encontrado' });
    }
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Historial de abonos de un perfume
app.get('/api/abonos/:perfume_id', async (req, res) => {
  if (!requireDB(res)) return;
  try {
    const result = await pool.query(
      'SELECT * FROM abonos WHERE perfume_id=$1 ORDER BY fecha DESC',
      [req.params.perfume_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Servidor corriendo en el puerto ${PORT}`));
