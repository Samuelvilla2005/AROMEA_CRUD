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

/** Elimina movimientos de caja con más de 4 meses de antigüedad */
async function limpiarMovimientosAntiguos() {
  if (!connectionString) return;
  try {
    const result = await pool.query(`
      DELETE FROM caja_movimientos
      WHERE fecha < (NOW() - INTERVAL '4 months')
    `);
    if (result.rowCount > 0) {
      console.log(`🧹 Se eliminaron ${result.rowCount} movimiento(s) de caja con más de 4 meses.`);
    }
  } catch (err) {
    console.error('Error limpiando movimientos antiguos:', err.message);
  }
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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS caja_saldo (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      saldo NUMERIC(12,2) NOT NULL DEFAULT 0,
      actualizado_en TIMESTAMP DEFAULT NOW()
    );
  `);
  await pool.query(`
    INSERT INTO caja_saldo (id, saldo) VALUES (1, 0)
    ON CONFLICT (id) DO NOTHING;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS caja_movimientos (
      id SERIAL PRIMARY KEY,
      tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'salida')),
      monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
      asunto VARCHAR(255) NOT NULL,
      motivo TEXT,
      saldo_despues NUMERIC(12,2) NOT NULL,
      fecha TIMESTAMP DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_caja_movimientos_fecha
    ON caja_movimientos (fecha DESC);
  `);
  await limpiarMovimientosAntiguos();
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

// Reporte histórico de ventas: solo perfumes completamente pagados.
app.get('/api/reportes/ventas', async (req, res) => {
  if (!requireDB(res)) return;
  try {
    const result = await pool.query(`
      SELECT
        id,
        tipo,
        nombre,
        precio_mayor,
        precio_venta,
        fecha_venta,
        monto_abonado
      FROM perfumes
      WHERE fecha_venta IS NOT NULL
        AND monto_abonado >= precio_venta
      ORDER BY fecha_venta DESC, id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* ===================== ENTRADAS Y SALIDAS (CAJA) ===================== */

// Obtener saldo actual + movimientos (últimos 4 meses)
app.get('/api/caja', async (req, res) => {
  if (!requireDB(res)) return;
  try {
    await limpiarMovimientosAntiguos();
    const saldoRes = await pool.query('SELECT saldo, actualizado_en FROM caja_saldo WHERE id = 1');
    const saldo = saldoRes.rows[0] ? Number(saldoRes.rows[0].saldo) : 0;
    const actualizado_en = saldoRes.rows[0] ? saldoRes.rows[0].actualizado_en : null;

    const movRes = await pool.query(`
      SELECT
        id,
        tipo,
        monto::float8 AS monto,
        asunto,
        motivo,
        saldo_despues::float8 AS saldo_despues,
        to_char(fecha AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS fecha
      FROM caja_movimientos
      WHERE fecha >= (NOW() - INTERVAL '4 months')
      ORDER BY fecha DESC, id DESC
    `);

    res.json({
      saldo,
      actualizado_en,
      movimientos: movRes.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Establecer / ajustar el saldo inicial (sin registrar movimiento, o con ajuste)
app.put('/api/caja/saldo', async (req, res) => {
  if (!requireDB(res)) return;
  const client = await pool.connect();
  try {
    const nuevoSaldo = Number(req.body.saldo);
    if (Number.isNaN(nuevoSaldo) || nuevoSaldo < 0) {
      return res.status(400).json({ error: 'El saldo debe ser un número mayor o igual a 0' });
    }
    await client.query('BEGIN');
    const actual = await client.query('SELECT saldo FROM caja_saldo WHERE id = 1 FOR UPDATE');
    const saldoAnterior = actual.rows[0] ? Number(actual.rows[0].saldo) : 0;
    const diferencia = nuevoSaldo - saldoAnterior;

    await client.query(
      `UPDATE caja_saldo SET saldo = $1, actualizado_en = NOW() WHERE id = 1`,
      [nuevoSaldo]
    );

    // Si hay diferencia, registrar un movimiento de ajuste para el historial
    if (diferencia !== 0) {
      const tipo = diferencia > 0 ? 'entrada' : 'salida';
      const monto = Math.abs(diferencia);
      await client.query(
        `INSERT INTO caja_movimientos (tipo, monto, asunto, motivo, saldo_despues)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          tipo,
          monto,
          'Ajuste de saldo',
          diferencia > 0
            ? 'Se aumentó el saldo manualmente'
            : 'Se redujo el saldo manualmente',
          nuevoSaldo
        ]
      );
    }

    await client.query('COMMIT');
    res.json({ saldo: nuevoSaldo });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Registrar entrada o salida
app.post('/api/caja/movimientos', async (req, res) => {
  if (!requireDB(res)) return;
  const client = await pool.connect();
  try {
    const { tipo, monto, asunto, motivo } = req.body;
    const tipoNorm = String(tipo || '').toLowerCase().trim();
    const montoNum = Number(monto);
    const asuntoStr = String(asunto || '').trim();
    const motivoStr = motivo != null ? String(motivo).trim() : '';

    if (!['entrada', 'salida'].includes(tipoNorm)) {
      return res.status(400).json({ error: 'tipo debe ser "entrada" o "salida"' });
    }
    if (!montoNum || montoNum <= 0) {
      return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    }
    if (!asuntoStr) {
      return res.status(400).json({ error: 'El asunto es obligatorio' });
    }
    if (tipoNorm === 'salida' && !motivoStr) {
      return res.status(400).json({
        error: 'Para sacar dinero es obligatorio explicar el motivo'
      });
    }

    await client.query('BEGIN');
    const actual = await client.query('SELECT saldo FROM caja_saldo WHERE id = 1 FOR UPDATE');
    let saldo = actual.rows[0] ? Number(actual.rows[0].saldo) : 0;

    if (tipoNorm === 'salida' && montoNum > saldo) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Saldo insuficiente. Disponible: ${saldo.toFixed(2)}`
      });
    }

    const nuevoSaldo = tipoNorm === 'entrada'
      ? saldo + montoNum
      : saldo - montoNum;

    await client.query(
      `UPDATE caja_saldo SET saldo = $1, actualizado_en = NOW() WHERE id = 1`,
      [nuevoSaldo]
    );

    const mov = await client.query(
      `INSERT INTO caja_movimientos (tipo, monto, asunto, motivo, saldo_despues)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING
         id,
         tipo,
         monto::float8 AS monto,
         asunto,
         motivo,
         saldo_despues::float8 AS saldo_despues,
         to_char(fecha AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS fecha`,
      [tipoNorm, montoNum, asuntoStr, tipoNorm === 'salida' ? motivoStr : (motivoStr || null), nuevoSaldo]
    );

    await client.query('COMMIT');
    res.status(201).json({ movimiento: mov.rows[0], saldo: nuevoSaldo });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Extracto de un mes concreto (dentro de los últimos 4 meses)
app.get('/api/caja/extracto', async (req, res) => {
  if (!requireDB(res)) return;
  try {
    await limpiarMovimientosAntiguos();
    const { mes } = req.query; // formato YYYY-MM
    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
      return res.status(400).json({ error: 'Parámetro mes requerido (YYYY-MM)' });
    }

    // Validar que el mes esté dentro de los últimos 4 meses
    const [y, m] = mes.split('-').map(Number);
    const inicioMes = new Date(y, m - 1, 1);
    const ahora = new Date();
    const limite = new Date(ahora.getFullYear(), ahora.getMonth() - 3, 1); // mes actual + 3 anteriores = 4 meses
    if (inicioMes < limite) {
      return res.status(400).json({
        error: 'Solo están disponibles extractos de los últimos 4 meses'
      });
    }

    const result = await pool.query(
      `SELECT
         id,
         tipo,
         monto::float8 AS monto,
         asunto,
         motivo,
         saldo_despues::float8 AS saldo_despues,
         to_char(fecha AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS fecha
       FROM caja_movimientos
       WHERE fecha >= $1::date
         AND fecha < ($1::date + INTERVAL '1 month')
       ORDER BY fecha ASC, id ASC`,
      [`${mes}-01`]
    );

    const entradas = result.rows
      .filter(r => r.tipo === 'entrada')
      .reduce((s, r) => s + Number(r.monto), 0);
    const salidas = result.rows
      .filter(r => r.tipo === 'salida')
      .reduce((s, r) => s + Number(r.monto), 0);

    res.json({
      mes,
      movimientos: result.rows,
      total_entradas: entradas,
      total_salidas: salidas,
      neto: entradas - salidas
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Servidor corriendo en el puerto ${PORT}`));
