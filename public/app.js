const API = '/api';

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
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
  const d = new Date(`${String(fecha).substring(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
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
