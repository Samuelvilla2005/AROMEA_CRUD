const API = '/api';

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'entradas-salidas') cargarCaja();
    if (btn.dataset.tab === 'reportes-ventas') cargarReporteVentas();
  });
});

function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 });
}
function fmtFecha(f) {
  if (!f) return '—';
  return new Date(f).toLocaleDateString('es-CO');
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* respuesta vacía o no JSON */
  }
  if (!res.ok) {
    const msg = (data && data.error) ? data.error : `Error ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function cargarPerfumes(tipo) {
  try {
    return await api(`${API}/perfumes?tipo=${encodeURIComponent(tipo)}`);
  } catch (err) {
    console.error('Error al cargar perfumes:', err);
    return [];
  }
}

function renderTablaPrincipal(perfumes, tbodyId) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = '';
  if (perfumes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="vacio">Aún no hay perfumes registrados</td></tr>`;
    return;
  }
  perfumes.forEach(p => {
    const debe = Number(p.monto_abonado) < Number(p.precio_venta);
    const tr = document.createElement('tr');
    if (debe) tr.classList.add('fila-pendiente');
    tr.innerHTML = `
      <td>${p.id}</td>
      <td>${escapeHtml(p.nombre)}</td>
      <td>${fmt(p.precio_mayor)}</td>
      <td>${fmt(p.precio_venta)}</td>
      <td>${fmtFecha(p.fecha_venta)}</td>
      <td>${fmt(p.monto_abonado)}</td>
      <td><span class="badge ${debe ? 'badge-pendiente' : 'badge-pagado'}">${debe ? 'Pendiente' : 'Pagado'}</span></td>
      <td class="acciones">
        <button class="icon-btn" title="Editar">✎</button>
        <button class="icon-btn danger" title="Eliminar">✕</button>
      </td>`;
    tr.querySelector('.icon-btn:not(.danger)').addEventListener('click', () => editarPerfume(p));
    tr.querySelector('.icon-btn.danger').addEventListener('click', () => eliminarPerfume(p.id));
    tbody.appendChild(tr);
  });
}

function renderTablaDeben(perfumes, tbodyId) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = '';
  const pendientes = perfumes.filter(p => Number(p.monto_abonado) < Number(p.precio_venta));
  if (pendientes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="vacio">No hay saldos pendientes</td></tr>`;
    return;
  }
  pendientes.forEach(p => {
    const saldo = Number(p.precio_venta) - Number(p.monto_abonado);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.id}</td>
      <td>${escapeHtml(p.nombre)}</td>
      <td>${fmt(p.precio_venta)}</td>
      <td>${fmt(p.monto_abonado)}</td>
      <td class="saldo">${fmt(saldo)}</td>
      <td><button class="btn-abonar">Abonar</button></td>`;
    tr.querySelector('.btn-abonar').addEventListener('click', () => abrirModalAbono(p.id));
    tbody.appendChild(tr);
  });
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function cargarTodo() {
  const propios = await cargarPerfumes('propio');
  const mayoristas = await cargarPerfumes('mayorista');
  renderTablaPrincipal(propios, 'tbody-propios');
  renderTablaDeben(propios, 'tbody-deben-propios');
  renderTablaPrincipal(mayoristas, 'tbody-mayoristas');
  renderTablaDeben(mayoristas, 'tbody-deben-mayoristas');
}

function abrirModalPerfume(tipo, perfume = null) {
  document.getElementById('perfume-tipo').value = tipo;
  document.getElementById('perfume-id').value = perfume ? perfume.id : '';
  document.getElementById('modal-title').textContent = perfume ? 'Editar Perfume' : 'Agregar Perfume';
  document.getElementById('f-nombre').value = perfume ? perfume.nombre : '';
  document.getElementById('f-precio-mayor').value = perfume ? perfume.precio_mayor : '';
  document.getElementById('f-precio-venta').value = perfume ? perfume.precio_venta : '';
  document.getElementById('f-fecha-venta').value = perfume && perfume.fecha_venta ? String(perfume.fecha_venta).substring(0, 10) : '';
  document.getElementById('modal-perfume').classList.add('show');
}
function editarPerfume(p) {
  abrirModalPerfume(p.tipo, p);
}
function cerrarModal(id) {
  document.getElementById(id).classList.remove('show');
}

async function guardarPerfume() {
  const id = document.getElementById('perfume-id').value;
  const body = {
    tipo: document.getElementById('perfume-tipo').value,
    nombre: document.getElementById('f-nombre').value.trim(),
    precio_mayor: parseFloat(document.getElementById('f-precio-mayor').value) || 0,
    precio_venta: parseFloat(document.getElementById('f-precio-venta').value) || 0,
    fecha_venta: document.getElementById('f-fecha-venta').value || null
  };
  if (!body.nombre) {
    alert('El nombre es obligatorio');
    return;
  }
  const url = id ? `${API}/perfumes/${id}` : `${API}/perfumes`;
  const method = id ? 'PUT' : 'POST';
  try {
    await api(url, { method, body: JSON.stringify(body) });
    cerrarModal('modal-perfume');
    await cargarTodo();
  } catch (err) {
    console.error(err);
    alert('No se pudo guardar el perfume:\n' + err.message);
  }
}

async function eliminarPerfume(id) {
  if (!confirm('¿Eliminar este perfume?')) return;
  try {
    await api(`${API}/perfumes/${id}`, { method: 'DELETE' });
    await cargarTodo();
  } catch (err) {
    console.error(err);
    alert('No se pudo eliminar:\n' + err.message);
  }
}

function abrirModalAbono(perfumeId) {
  document.getElementById('abono-perfume-id').value = perfumeId;
  document.getElementById('f-monto-abono').value = '';
  document.getElementById('modal-abono').classList.add('show');
}

async function guardarAbono() {
  const perfume_id = document.getElementById('abono-perfume-id').value;
  const monto = Number(document.getElementById('f-monto-abono').value);
  if (!monto || monto <= 0) {
    alert('Ingresa un monto válido');
    return;
  }
  try {
    await api(`${API}/abonos`, {
      method: 'POST',
      body: JSON.stringify({ perfume_id: Number(perfume_id), monto })
    });
    cerrarModal('modal-abono');
    await cargarTodo();
  } catch (err) {
    console.error(err);
    alert('No se pudo registrar el abono:\n' + err.message);
  }
}

cargarTodo();


/* ================= REPORTE DE VENTAS ================= */
let reporteVentas = [];
let reporteMesSeleccionado = '';

async function cargarReporteVentas() {
  try {
    reporteVentas = await api(`${API}/reportes/ventas`);
    prepararSelectorMeses();
    renderReporte();
  } catch (err) {
    console.error('Error al cargar reporte:', err);
    reporteVentas = [];
    prepararSelectorMeses();
    renderReporte();
  }
}

function claveMes(fecha) {
  if (!fecha) return '';
  const s = String(fecha);
  // Formatos ISO / Postgres: "2026-09-30T17:00:00.000Z" o "2026-09-30 17:00:00"
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}`;
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return '';
  // Usar componentes locales para no cambiar de mes por UTC
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nombreMes(clave) {
  if (!clave) return '—';
  const [y, m] = clave.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-CO', {
    month: 'long',
    year: 'numeric'
  }).replace(/^./, c => c.toUpperCase());
}

function prepararSelectorMeses() {
  const select = document.getElementById('reporte-mes');
  if (!select) return;

  const meses = [...new Set(reporteVentas.map(v => claveMes(v.fecha_venta)).filter(Boolean))];
  const ahora = new Date();
  const mesActual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
  if (!meses.includes(mesActual)) meses.push(mesActual);
  meses.sort((a, b) => b.localeCompare(a));

  const anterior = reporteMesSeleccionado;
  select.innerHTML = meses.map(m => `<option value="${m}">${nombreMes(m)}</option>`).join('');
  reporteMesSeleccionado = meses.includes(anterior) ? anterior : mesActual;
  select.value = reporteMesSeleccionado;
}

function ventasFiltradas() {
  const tipo = document.getElementById('reporte-tipo')?.value || 'todos';
  return reporteVentas.filter(v => {
    return claveMes(v.fecha_venta) === reporteMesSeleccionado &&
      (tipo === 'todos' || v.tipo === tipo);
  });
}

function agruparPorMes() {
  const tipo = document.getElementById('reporte-tipo')?.value || 'todos';
  const grupos = {};
  reporteVentas.forEach(v => {
    if (tipo !== 'todos' && v.tipo !== tipo) return;
    const mes = claveMes(v.fecha_venta);
    if (!mes) return;
    if (!grupos[mes]) grupos[mes] = { unidades: 0, total: 0 };
    grupos[mes].unidades += 1;
    grupos[mes].total += Number(v.precio_venta) || 0;
  });

  // Mantiene también el mes actual aunque todavía tenga 0 ventas.
  const ahora = new Date();
  const actual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
  if (!grupos[actual]) grupos[actual] = { unidades: 0, total: 0 };
  return grupos;
}

function renderReporte() {
  const ventas = ventasFiltradas();
  const total = ventas.reduce((sum, v) => sum + (Number(v.precio_venta) || 0), 0);
  const unidades = ventas.length;
  const promedio = unidades ? total / unidades : 0;

  document.getElementById('kpi-unidades').textContent = unidades.toLocaleString('es-CO');
  document.getElementById('kpi-ventas').textContent = fmt(total);
  document.getElementById('kpi-promedio').textContent = fmt(promedio);
  document.getElementById('kpi-mes').textContent = nombreMes(reporteMesSeleccionado);
  document.getElementById('extracto-descripcion').textContent =
    `${unidades} ${unidades === 1 ? 'perfume pagado' : 'perfumes pagados'} en ${nombreMes(reporteMesSeleccionado)}`;

  renderGraficaVentas();
  renderTablaReporte(ventas);
}

function renderGraficaVentas() {
  const chart = document.getElementById('ventas-chart');
  const grupos = agruparPorMes();
  const meses = Object.keys(grupos).sort();

  if (!meses.length) {
    chart.innerHTML = '<div class="report-empty">Todavía no hay ventas pagadas para mostrar.</div>';
    return;
  }

  const max = Math.max(1, ...meses.map(m => grupos[m].unidades));
  chart.innerHTML = meses.map(m => {
    const unidades = grupos[m].unidades;
    const altura = unidades ? Math.max(5, (unidades / max) * 205) : 2;
    const seleccionado = m === reporteMesSeleccionado ? ' selected' : '';
    const etiqueta = new Date(Number(m.slice(0,4)), Number(m.slice(5,7)) - 1, 1)
      .toLocaleDateString('es-CO', { month: 'short' })
      .replace('.', '');
    return `
      <div class="bar-item${seleccionado}" title="${escapeHtml(nombreMes(m))}: ${unidades} perfumes">
        <span class="bar-value">${unidades}</span>
        <div class="bar" style="height:${altura}px"></div>
        <span class="bar-label">${etiqueta} ${m.slice(2,4)}</span>
      </div>`;
  }).join('');
}

function renderTablaReporte(ventas) {
  const tbody = document.getElementById('tbody-reporte');
  if (!ventas.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="report-empty">No hay perfumes pagados en este mes.</td></tr>`;
    return;
  }

  const ordenadas = [...ventas].sort((a, b) =>
    String(b.fecha_venta).localeCompare(String(a.fecha_venta))
  );
  tbody.innerHTML = ordenadas.map(v => `
    <tr>
      <td>${fmtFecha(v.fecha_venta)}</td>
      <td>${escapeHtml(v.nombre)}</td>
      <td><span class="report-type">${v.tipo === 'mayorista' ? 'Mayorista' : 'Propio'}</span></td>
      <td>${fmt(v.precio_venta)}</td>
    </tr>`).join('');
}

function descargarExtracto() {
  const ventas = ventasFiltradas();
  const encabezado = ['Fecha', 'ID', 'Perfume', 'Tipo', 'Precio mayor', 'Precio venta', 'Estado'];
  const filas = ventas.map(v => [
    String(v.fecha_venta || '').substring(0, 10),
    v.id,
    v.nombre,
    v.tipo === 'mayorista' ? 'Mayorista' : 'Propio',
    Number(v.precio_mayor || 0).toFixed(2),
    Number(v.precio_venta || 0).toFixed(2),
    'Pagado'
  ]);

  const csv = [encabezado, ...filas]
    .map(row => row.map(valor => `"${String(valor ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');

  // BOM para que Excel reconozca correctamente tildes y caracteres en español.
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `extracto-ventas-${reporteMesSeleccionado}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

document.getElementById('reporte-mes')?.addEventListener('change', e => {
  reporteMesSeleccionado = e.target.value;
  renderReporte();
});
document.getElementById('reporte-tipo')?.addEventListener('change', renderReporte);
document.getElementById('btn-descargar-reporte')?.addEventListener('click', descargarExtracto);

cargarReporteVentas();


/* ================= ENTRADAS Y SALIDAS (CAJA) ================= */
let cajaData = { saldo: 0, movimientos: [], actualizado_en: null };
let cajaMesSeleccionado = '';

function mesesDisponiblesCaja() {
  const ahora = new Date();
  const lista = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    lista.push(clave);
  }
  return lista;
}

function fmtFechaHora(f) {
  if (!f) return '—';
  const d = new Date(f);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function cargarCaja() {
  try {
    cajaData = await api(`${API}/caja`);
  } catch (err) {
    console.error('Error al cargar caja:', err);
    cajaData = { saldo: 0, movimientos: [], actualizado_en: null };
  }
  renderCaja();
}

function renderCaja() {
  const saldoEl = document.getElementById('caja-saldo-actual');
  const fechaEl = document.getElementById('caja-saldo-fecha');
  if (!saldoEl) return;

  saldoEl.textContent = fmt(cajaData.saldo);
  fechaEl.textContent = cajaData.actualizado_en
    ? `Actualizado: ${fmtFechaHora(cajaData.actualizado_en)}`
    : 'Sin movimientos aún';

  prepararSelectorMesesCaja();
  renderHistorialCaja();
  actualizarResumenMesCaja();
}

function prepararSelectorMesesCaja() {
  const select = document.getElementById('caja-mes-extracto');
  if (!select) return;
  const meses = mesesDisponiblesCaja();
  const anterior = cajaMesSeleccionado;
  select.innerHTML = meses.map(m =>
    `<option value="${m}">${nombreMes(m)}</option>`
  ).join('');
  const ahora = new Date();
  const actual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
  cajaMesSeleccionado = meses.includes(anterior) ? anterior : actual;
  select.value = cajaMesSeleccionado;
}

function movimientosDelMes(mes) {
  return (cajaData.movimientos || []).filter(m => claveMes(m.fecha) === mes);
}

function actualizarResumenMesCaja() {
  const movs = movimientosDelMes(cajaMesSeleccionado);
  const entradas = movs.filter(m => m.tipo === 'entrada').reduce((s, m) => s + Number(m.monto), 0);
  const salidas = movs.filter(m => m.tipo === 'salida').reduce((s, m) => s + Number(m.monto), 0);
  const neto = entradas - salidas;

  document.getElementById('caja-mes-entradas').textContent = fmt(entradas);
  document.getElementById('caja-mes-salidas').textContent = fmt(salidas);
  const netoEl = document.getElementById('caja-mes-neto');
  netoEl.textContent = fmt(neto);
  netoEl.className = neto >= 0 ? 'neto-positivo' : 'neto-negativo';
}

function renderHistorialCaja() {
  const cont = document.getElementById('caja-historial');
  if (!cont) return;
  let movs = movimientosDelMes(cajaMesSeleccionado);

  // El historial respeta siempre el mes seleccionado. Las fechas que entrega
  // el servidor usan un formato ISO consistente, por lo que no necesitamos
  // mezclar movimientos de otros meses como respaldo.
  if (!movs.length) {
    cont.innerHTML = '<div class="caja-historial-vacio">No hay movimientos en este mes</div>';
    return;
  }

  // Más recientes primero
  const ordenados = [...movs].sort((a, b) =>
    String(b.fecha).localeCompare(String(a.fecha)) || (Number(b.id) - Number(a.id))
  );

  cont.innerHTML = ordenados.map(m => {
    const esEntrada = m.tipo === 'entrada';
    const signo = esEntrada ? '+' : '−';
    const clase = esEntrada ? 'mov-entrada' : 'mov-salida';
    const motivoHtml = m.motivo
      ? `<div class="mov-motivo">${escapeHtml(m.motivo)}</div>`
      : '';
    return `
      <div class="mov-item ${clase}">
        <div class="mov-left">
          <span class="mov-dot"></span>
          <div class="mov-info">
            <div class="mov-asunto">${escapeHtml(m.asunto)}</div>
            ${motivoHtml}
            <div class="mov-fecha">${fmtFechaHora(m.fecha)}</div>
          </div>
        </div>
        <div class="mov-right">
          <div class="mov-monto">${signo}${fmt(m.monto)}</div>
          <div class="mov-saldo">Saldo: ${fmt(m.saldo_despues)}</div>
        </div>
      </div>`;
  }).join('');
}

function abrirModalCaja(tipo) {
  document.getElementById('caja-tipo').value = tipo;
  document.getElementById('modal-caja-title').textContent =
    tipo === 'entrada' ? 'Registrar entrada de dinero' : 'Registrar salida de dinero';
  document.getElementById('f-caja-monto').value = '';
  document.getElementById('f-caja-asunto').value = '';
  document.getElementById('f-caja-motivo').value = '';
  const wrap = document.getElementById('caja-motivo-wrap');
  wrap.style.display = tipo === 'salida' ? 'block' : 'none';
  const btn = document.getElementById('btn-guardar-caja');
  btn.className = tipo === 'salida' ? 'btn-primary btn-salida' : 'btn-primary btn-entrada';
  btn.textContent = tipo === 'salida' ? 'Sacar dinero' : 'Ingresar dinero';
  document.getElementById('modal-caja').classList.add('show');
}

async function guardarMovimientoCaja() {
  const tipo = document.getElementById('caja-tipo').value;
  const monto = Number(document.getElementById('f-caja-monto').value);
  const asunto = document.getElementById('f-caja-asunto').value.trim();
  const motivo = document.getElementById('f-caja-motivo').value.trim();

  if (!monto || monto <= 0) {
    alert('Ingresa un monto válido mayor a 0');
    return;
  }
  if (!asunto) {
    alert('El asunto es obligatorio');
    return;
  }
  if (tipo === 'salida' && !motivo) {
    alert('Para sacar dinero es obligatorio explicar el motivo');
    return;
  }

  const btnGuardar = document.getElementById('btn-guardar-caja');
  const textoOriginal = btnGuardar.textContent;
  btnGuardar.disabled = true;
  btnGuardar.textContent = 'Guardando…';

  try {
    // El servidor devuelve el movimiento ya insertado en PostgreSQL.
    // Lo usamos directamente para que el historial se actualice sin depender
    // de una segunda consulta o de un desfase de fechas/zona horaria.
    const respuesta = await api(`${API}/caja/movimientos`, {
      method: 'POST',
      body: JSON.stringify({ tipo, monto, asunto, motivo: motivo || null })
    });

    const movimiento = respuesta && respuesta.movimiento;
    if (!movimiento) {
      throw new Error('El servidor confirmó la operación, pero no devolvió el movimiento registrado.');
    }

    const ahora = new Date();
    cajaMesSeleccionado =
      `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;

    // Actualización inmediata de la interfaz con el registro confirmado.
    cajaData.saldo = Number(respuesta.saldo ?? cajaData.saldo);
    cajaData.actualizado_en = movimiento.fecha || new Date().toISOString();
    cajaData.movimientos = Array.isArray(cajaData.movimientos)
      ? cajaData.movimientos.filter(m => Number(m.id) !== Number(movimiento.id))
      : [];
    cajaData.movimientos.unshift(movimiento);

    cerrarModal('modal-caja');
    renderCaja();

    // Sincronización final con PostgreSQL. Si esta segunda lectura falla,
    // conservamos el movimiento confirmado que ya está visible en pantalla.
    try {
      await cargarCaja();
    } catch (syncError) {
      console.warn('Movimiento guardado; no se pudo sincronizar el historial:', syncError);
    }
  } catch (err) {
    console.error(err);
    alert('No se pudo registrar el movimiento:\n' + err.message);
  } finally {
    btnGuardar.disabled = false;
    btnGuardar.textContent = textoOriginal;
  }
}

function abrirModalAjusteSaldo() {
  document.getElementById('f-nuevo-saldo').value = Number(cajaData.saldo || 0);
  document.getElementById('modal-ajustar-saldo').classList.add('show');
}

async function guardarAjusteSaldo() {
  const saldo = Number(document.getElementById('f-nuevo-saldo').value);
  if (Number.isNaN(saldo) || saldo < 0) {
    alert('Ingresa un saldo válido (0 o mayor)');
    return;
  }
  try {
    await api(`${API}/caja/saldo`, {
      method: 'PUT',
      body: JSON.stringify({ saldo })
    });
    cerrarModal('modal-ajustar-saldo');
    await cargarCaja();
  } catch (err) {
    console.error(err);
    alert('No se pudo ajustar el saldo:\n' + err.message);
  }
}

async function descargarExtractoCaja() {
  try {
    const data = await api(`${API}/caja/extracto?mes=${encodeURIComponent(cajaMesSeleccionado)}`);
    const encabezado = ['Fecha', 'Tipo', 'Asunto', 'Motivo', 'Monto', 'Saldo después'];
    const filas = data.movimientos.map(m => [
      fmtFechaHora(m.fecha),
      m.tipo === 'entrada' ? 'Entrada' : 'Salida',
      m.asunto || '',
      m.motivo || '',
      Number(m.monto).toFixed(2),
      Number(m.saldo_despues).toFixed(2)
    ]);
    filas.push([]);
    filas.push(['Total entradas', '', '', '', Number(data.total_entradas).toFixed(2), '']);
    filas.push(['Total salidas', '', '', '', Number(data.total_salidas).toFixed(2), '']);
    filas.push(['Neto del mes', '', '', '', Number(data.neto).toFixed(2), '']);

    const csv = [encabezado, ...filas]
      .map(row => row.map(valor => `"${String(valor ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extracto-caja-${cajaMesSeleccionado}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    alert('No se pudo descargar el extracto:\n' + err.message);
  }
}

document.getElementById('btn-entrada')?.addEventListener('click', () => abrirModalCaja('entrada'));
document.getElementById('btn-salida')?.addEventListener('click', () => abrirModalCaja('salida'));
document.getElementById('btn-ajustar-saldo')?.addEventListener('click', abrirModalAjusteSaldo);
document.getElementById('btn-descargar-caja')?.addEventListener('click', descargarExtractoCaja);
document.getElementById('caja-mes-extracto')?.addEventListener('change', e => {
  cajaMesSeleccionado = e.target.value;
  renderHistorialCaja();
  actualizarResumenMesCaja();
});
