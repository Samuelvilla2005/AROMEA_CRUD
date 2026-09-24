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
