# Essence Finanzas — Gestión de Perfumes

Sitio simple para manejar las finanzas de tu negocio de perfumes: perfumes propios, perfumes de mayoristas, y control de abonos/deudas.

## ¿Qué incluye?

- **Perfumes Propios**: tabla con ID, Nombre, Precio Mayor, Precio Venta, Fecha Venta y Abonado. Las filas de perfumes que aún no se han pagado completo aparecen **en gris**; cuando se terminan de pagar, vuelven a blanco automáticamente.
- **Nos Deben**: solo los perfumes propios con saldo pendiente, con botón para ir abonando.
- **Mayoristas**: la misma lógica, pero para lo que le compramos/vendemos a mayoristas.
- **Debemos a Mayoristas**: saldos pendientes con mayoristas.

Todo se guarda en una base de datos Postgres (recomendado: [Neon](https://neon.tech), tiene plan gratuito).

---

## Paso 1 — Consigue tu link de Neon

1. Entra a [neon.tech](https://neon.tech) y crea una cuenta gratis.
2. Crea un proyecto nuevo.
3. En el dashboard, copia el **Connection String** (empieza con `postgresql://...`).

## Paso 2 — Pega tu link de Neon en el proyecto

Tienes dos formas, elige la que prefieras:

**Opción A (más simple):** abre el archivo `server.js`, busca esta línea cerca del principio:

```js
const NEON_URL_MANUAL = "";
```

y pega tu link ahí adentro, entre las comillas:

```js
const NEON_URL_MANUAL = "postgresql://usuario:password@ep-xxxxx.neon.tech/neondb?sslmode=require";
```

**Opción B (más segura, recomendada si vas a subir el código a un repositorio público):** copia el archivo `.env.example`, renómbralo a `.env`, y pega tu link ahí:

```
DATABASE_URL=postgresql://usuario:password@ep-xxxxx.neon.tech/neondb?sslmode=require
```

Con la Opción B, **no subas el archivo `.env` a GitHub** (ya está ignorado en `.gitignore`), y en su lugar configuras esa misma variable en el panel de tu servicio de despliegue (ver Paso 4).

No necesitas crear las tablas a mano: el servidor las crea solo la primera vez que se conecta.

## Paso 3 — Probar en tu computador (opcional)

```bash
npm install
npm start
```

Abre `http://localhost:3000` en tu navegador.

## Paso 4 — Subir a GitHub

```bash
git init
git add .
git commit -m "Primer commit - Essence Finanzas"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPOSITORIO.git
git push -u origin main
```

## Paso 5 — Desplegar (gratis) en Render

GitHub Pages **no sirve** para este proyecto porque necesita un servidor (backend) para hablar con la base de datos. Por eso usamos **Render**, que es gratis y se conecta directo a tu repositorio de GitHub:

1. Entra a [render.com](https://render.com) y crea una cuenta (puedes usar tu cuenta de GitHub).
2. Clic en **New +** → **Web Service**.
3. Conecta tu repositorio de GitHub.
4. Configura:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Si usaste la Opción B del Paso 2, agrega la variable de entorno `DATABASE_URL` en la sección **Environment** con tu link de Neon.
6. Clic en **Create Web Service**. En unos minutos tendrás tu link público (algo como `https://essence-finanzas.onrender.com`).

Cada vez que hagas `git push`, Render vuelve a desplegar automáticamente.

---

## Estructura del proyecto

```
perfumes-finanzas/
├── server.js          → backend (Express + conexión a Postgres)
├── schema.sql          → estructura de las tablas (referencia)
├── package.json
├── .env.example
└── public/
    ├── index.html      → estructura del sitio
    ├── style.css        → diseño
    └── app.js           → lógica del frontend (llama a la API)
```

## Tablas en la base de datos

**perfumes**: `id, tipo (propio/mayorista), nombre, precio_mayor, precio_venta, fecha_venta, monto_abonado, creado_en`

**abonos**: `id, perfume_id, monto, fecha`

Un perfume se considera **pagado** cuando `monto_abonado >= precio_venta`.
