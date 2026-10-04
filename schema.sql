-- Este script es solo de referencia.
-- El servidor (server.js) crea estas tablas automáticamente al iniciar,
-- así que normalmente NO necesitas ejecutar esto a mano.

CREATE TABLE IF NOT EXISTS perfumes (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(20) NOT NULL DEFAULT 'propio',   -- 'propio' o 'mayorista'
    nombre VARCHAR(255) NOT NULL,
    precio_mayor NUMERIC(10,2) DEFAULT 0,
    precio_venta NUMERIC(10,2) DEFAULT 0,
    fecha_venta DATE,
    monto_abonado NUMERIC(10,2) DEFAULT 0,
    creado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS abonos (
    id SERIAL PRIMARY KEY,
    perfume_id INTEGER REFERENCES perfumes(id) ON DELETE CASCADE,
    monto NUMERIC(10,2) NOT NULL,
    fecha TIMESTAMP DEFAULT NOW()
);

-- Caja: saldo actual (una sola fila con id = 1)
CREATE TABLE IF NOT EXISTS caja_saldo (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    saldo NUMERIC(12,2) NOT NULL DEFAULT 0,
    actualizado_en TIMESTAMP DEFAULT NOW()
);

INSERT INTO caja_saldo (id, saldo) VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- Movimientos de entradas y salidas
CREATE TABLE IF NOT EXISTS caja_movimientos (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'salida')),
    monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    asunto VARCHAR(255) NOT NULL,
    motivo TEXT,
    saldo_despues NUMERIC(12,2) NOT NULL,
    fecha TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caja_movimientos_fecha ON caja_movimientos (fecha DESC);
