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
