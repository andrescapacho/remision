/* ================================================
   FIREBASE INIT & AUTHENTICATION
   ================================================ */
const firebaseConfig = {
  apiKey: "AIzaSyCZx5nyKnBYxSHH_YFABpmecGdvfmowG8g",
  authDomain: "tuflow.firebaseapp.com",
  projectId: "tuflow",
  storageBucket: "tuflow.firebasestorage.app",
  messagingSenderId: "839261029075",
  appId: "1:839261029075:web:ed9fb0f653a7161ce84a26"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Escuchar cambios en la sesión (Si entra o sale)
auth.onAuthStateChanged(user => {
  if (user) {
    // Usuario logueado: Ocultar login, mostrar app
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-nav').classList.remove('hidden');
    document.getElementById('main-app').classList.remove('hidden');

    // Poner la inicial de su correo en el avatar
    document.querySelector('.navbar-avatar').textContent = user.email.charAt(0).toUpperCase();

    // NUEVO: En lugar de pasar su ID privado, le pasamos su correo para identificar su rol
    DB.load(user.email); 

  } else {
    // Usuario NO logueado: Mostrar login, ocultar app
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('main-nav').classList.add('hidden');
    document.getElementById('main-app').classList.add('hidden');
  }
});

// Función para el botón de Ingresar
function iniciarSesion() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-password').value;

  if (!email || !pass) return toast('Ingresa correo y contraseña', 'error');

  const btn = document.getElementById('btn-login');
  btn.textContent = 'Iniciando...';
  btn.disabled = true;

  auth.signInWithEmailAndPassword(email, pass)
    .then(() => {
      toast('Sesión iniciada correctamente');
      btn.textContent = 'Ingresar al Sistema';
      btn.disabled = false;
      document.getElementById('login-password').value = ''; // Limpiar contraseña
    })
    .catch(err => {
      let msj = 'Credenciales incorrectas';
      if (err.code === 'auth/invalid-email') msj = 'Correo inválido';
      toast(msj, 'error');
      btn.textContent = 'Ingresar al Sistema';
      btn.disabled = false;
    });
}

// Función para el botón de Salir
function cerrarSesion() {
  auth.signOut().then(() => toast('Sesión cerrada'));
}

/* ================================================
   BASE DE DATOS EN LA NUBE (COMPARTIDA Y CON ROLES)
   ================================================ */
const DB = {
  clientes: [],
  remisiones: [],
  nextConsec: 1,
  adminUid: 't5lLRb6ERRRzUnodaTiAkDwAe3R2', // Tu ID Maestro
  adminEmail: 'andres.capacho@kikes.com.co', // Tu Correo Maestro
  currentUserEmail: null,

  async load(email) {
    this.currentUserEmail = email; // Guardamos quién está usando la app
    try {
      // MAGIA: TODOS los usuarios apuntan y leen desde tu carpeta maestra
      const userRef = db.collection('usuarios_data').doc(this.adminUid);
      
      const doc = await userRef.get();
      if (doc.exists) {
        this.nextConsec = doc.data().nextConsec || 1;
      } else {
        await userRef.set({ nextConsec: 1 });
        this.nextConsec = 1;
      }

      const clientesSnap = await userRef.collection('clientes').get();
      this.clientes = clientesSnap.docs.map(d => d.data());

      const remisionesSnap = await userRef.collection('remisiones').orderBy('consecutivo', 'desc').get();
      this.remisiones = remisionesSnap.docs.map(d => d.data());
      
      renderDashboard();
      updateSelects();
      if (document.getElementById('section-remisiones').classList.contains('active')) renderRemisiones();
      if (document.getElementById('section-clientes').classList.contains('active')) renderClientes();

    } catch(e) {
      console.warn('Error cargando datos de Firebase:', e);
      toast('Error al cargar datos desde la nube', 'error');
    }
  },

  async saveClienteToCloud(clienteObj) {
    try {
      await db.collection('usuarios_data').doc(this.adminUid).collection('clientes').doc(clienteObj.id).set(clienteObj, { merge: true });
    } catch(e) { console.error(e); }
  },

  async deleteClienteFromCloud(id) {
    try {
      await db.collection('usuarios_data').doc(this.adminUid).collection('clientes').doc(id).delete();
    } catch(e) { console.error(e); }
  },

  async saveRemisionToCloud(remisionObj) {
    try {
      const batch = db.batch(); 
      const userRef = db.collection('usuarios_data').doc(this.adminUid);
      const remRef = userRef.collection('remisiones').doc(remisionObj.id);
      
      batch.set(remRef, remisionObj, { merge: true });
      batch.update(userRef, { nextConsec: this.nextConsec });
      
      await batch.commit();
    } catch(e) { console.error(e); }
  },

  async deleteRemisionFromCloud(id) {
    try {
      await db.collection('usuarios_data').doc(this.adminUid).collection('remisiones').doc(id).delete();
    } catch(e) { console.error(e); }
  },

  genConsec() {
    const n = String(this.nextConsec).padStart(6, '0');
    return `REM-${n}`;
  },

  getCliente(id) { return this.clientes.find(c => c.id === id); },
  getRemision(id) { return this.remisiones.find(r => r.id === id); }
};

/* ================================================
   UTILS & VALIDACIONES
   ================================================ */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' });
}

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0,10);
}

function validarCorreo(correo) {
  if (!correo) return true; 
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(correo);
}

function validarTelefono(telefono) {
  if (!telefono) return true; 
  const regex = /^[0-9\s\-\+\(\)]+$/; 
  return regex.test(telefono);
}

function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ================================================
   TOAST
   ================================================ */
function toast(msg, type='success') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icon = type === 'success'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
  t.innerHTML = icon + msg;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(100%)'; t.style.transition='.3s'; setTimeout(()=>t.remove(), 300); }, 3000);
}

/* ================================================
   NAV / SECTIONS
   ================================================ */
function showSection(name, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('section-' + name).classList.add('active');
  
  document.querySelectorAll('.nav-item').forEach(btn => {
    if (btn.textContent.toLowerCase().includes(name === 'remisiones' ? 'remisiones' : name === 'clientes' ? 'clientes' : 'dashboard')) {
      btn.classList.add('active');
    }
  });
  if (name === 'remisiones') renderRemisiones();
  if (name === 'clientes') renderClientes();
  if (name === 'dashboard') renderDashboard();
}

/* ================================================
   MODALS
   ================================================ */
function openModal(name) {
  if (name === 'remision') prepareRemisionModal();
  if (name === 'cliente') prepareClienteModal();
  document.getElementById('modal-' + name).classList.add('open');
}

function closeModal(name) {
  document.getElementById('modal-' + name).classList.remove('open');
}

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', function(e) {
    if (e.target === this) {
      if (this.id === 'modal-remision') {
        const items = document.querySelectorAll('#items-container .item-row').length;
        if (items > 0) {
          const confirmar = window.confirm("¿Seguro que deseas salir? Perderás los datos no guardados.");
          if (!confirmar) return; 
        }
      }
      this.classList.remove('open');
    }
  });
});

/* ================================================
   CONFIRM DIALOG
   ================================================ */
let confirmCallback = null;
function confirmDialog(msg, cb) {
  document.getElementById('confirm-msg').textContent = msg;
  confirmCallback = cb;
  document.getElementById('modal-confirm').classList.add('open');
}
document.getElementById('btn-confirm-ok').addEventListener('click', () => {
  if (confirmCallback) confirmCallback();
  closeModal('confirm');
  confirmCallback = null;
});

/* ================================================
   CLIENTES MODULE
   ================================================ */
function prepareClienteModal(id) {
  document.getElementById('cli-id').value = id || '';
  document.getElementById('modal-cliente-title').textContent = id ? 'Editar Cliente' : 'Nuevo Cliente';
  if (id) {
    const c = DB.getCliente(id);
    document.getElementById('cli-nombre').value = c.nombre || '';
    document.getElementById('cli-telefono').value = c.telefono || '';
    document.getElementById('cli-direccion').value = c.direccion || '';
    document.getElementById('cli-ciudad').value = c.ciudad || '';
    document.getElementById('cli-correo').value = c.correo || '';
    document.getElementById('cli-conductor').value = c.conductor || '';
  } else {
    ['cli-nombre','cli-telefono','cli-direccion','cli-ciudad','cli-correo','cli-conductor'].forEach(id => document.getElementById(id).value = '');
  }
}

function saveCliente() {
  const nombre = document.getElementById('cli-nombre').value.trim();
  const ciudad = document.getElementById('cli-ciudad').value.trim();
  const correo = document.getElementById('cli-correo').value.trim();
  const telefono = document.getElementById('cli-telefono').value.trim();

  if (!nombre) { toast('El nombre es requerido', 'error'); return; }
  if (!ciudad) { toast('La ciudad es requerida', 'error'); return; }
  if (!validarCorreo(correo)) { toast('El formato del correo es inválido', 'error'); return; }
  if (!validarTelefono(telefono)) { toast('El teléfono contiene caracteres inválidos', 'error'); return; }

  const id = document.getElementById('cli-id').value;
  const obj = {
    id: id || uid(),
    nombre,
    telefono,
    direccion: document.getElementById('cli-direccion').value.trim(),
    ciudad,
    correo,
    conductor: document.getElementById('cli-conductor').value.trim(),
    creadoEn: id ? (DB.getCliente(id)?.creadoEn || todayISO()) : todayISO()
  };

  if (id) {
    const idx = DB.clientes.findIndex(c => c.id === id);
    DB.clientes[idx] = obj;
    toast('Cliente actualizado correctamente');
  } else {
    DB.clientes.unshift(obj);
    toast('Cliente registrado exitosamente');
  }
  DB.saveClienteToCloud(obj);
  closeModal('cliente');
  renderClientes();
  renderDashboard();
  updateSelects();
}

function editCliente(id) { prepareClienteModal(id); openModal('cliente'); }

function deleteCliente(id) {
  const c = DB.getCliente(id);
  confirmDialog(`¿Eliminar cliente "${c.nombre}"? También se mantendrán sus remisiones.`, () => {
    DB.clientes = DB.clientes.filter(x => x.id !== id);
    DB.deleteClienteFromCloud(id);
    renderClientes();
    renderDashboard();
    updateSelects();
    toast('Cliente eliminado');
  });
}

function renderClientes() {
  const tbody = document.getElementById('clientes-tbody');
  const q = (document.getElementById('search-cli')?.value || '').toLowerCase();
  const list = DB.clientes.filter(c =>
    !q || c.nombre.toLowerCase().includes(q) || (c.ciudad||'').toLowerCase().includes(q) || (c.correo||'').toLowerCase().includes(q)
  );
  document.getElementById('badge-clientes').textContent = DB.clientes.length;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      <h3>Sin clientes registrados</h3>
      <p>Crea tu primer cliente para comenzar</p>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(c => {
    const remCount = DB.remisiones.filter(r => r.clienteId === c.id).length;
    
    // VALIDACIÓN DE ROL: Si no es el admin, el botón rojo se queda vacío ('')
    const isAdmin = DB.currentUserEmail === DB.adminEmail;
    const deleteBtn = isAdmin ? `
      <button class="btn btn-danger btn-sm btn-icon" onclick="deleteCliente('${c.id}')" title="Eliminar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
      </button>` : '';

    return `<tr>
      <td><div class="fw-600">${esc(c.nombre)}</div><div class="text-xs text-muted">${esc(c.direccion||'')}</div></td>
      <td>${esc(c.telefono||'—')}</td>
      <td><span class="badge badge-gray">${esc(c.ciudad)}</span></td>
      <td style="color:var(--gray-600)">${esc(c.correo||'—')}</td>
      <td>${esc(c.conductor||'—')}</td>
      <td><span class="badge badge-green">${remCount} rem.</span></td>
      <td>
        <div class="flex gap-8">
          <button class="btn btn-ghost btn-sm btn-icon" onclick="editCliente('${c.id}')" title="Editar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          ${deleteBtn}
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filterClientes() { renderClientes(); }

/* ================================================
   REMISIONES MODULE — ITEMS
   ================================================ */
let itemCounter = 0;

function addItemRow(data) {
  const c = document.getElementById('items-container');
  const id = ++itemCounter;
  const row = document.createElement('div');
  row.className = 'item-row';
  row.id = `item-row-${id}`;
  row.dataset.itemId = id;
  row.innerHTML = `
    <div class="form-group">
      <div class="item-col-label">Descripción *</div>
      <input type="text" class="form-control" id="item-desc-${id}" placeholder="Equipo o material..." value="${esc(data?.descripcion||'')}"/>
    </div>
    <div class="form-group">
      <div class="item-col-label">Cantidad</div>
      <input type="number" class="form-control" id="item-qty-${id}" min="1" value="${data?.cantidad||1}" style="text-align:center"/>
    </div>
    <div class="form-group">
      <div class="item-col-label">Serial / Referencia</div>
      <input type="text" class="form-control" id="item-serial-${id}" placeholder="SN-XXXX" value="${esc(data?.serial||'')}"/>
    </div>
    <div class="form-group">
      <div class="item-col-label">Observaciones</div>
      <input type="text" class="form-control" id="item-obs-${id}" placeholder="Notas del ítem..." value="${esc(data?.observaciones||'')}"/>
    </div>
    <button class="btn-delete-item" onclick="removeItemRow(${id})" title="Eliminar ítem">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
    </button>`;
  c.appendChild(row);
  updateItemCount();
  row.querySelector('input').focus();
}

function removeItemRow(id) {
  const row = document.getElementById(`item-row-${id}`);
  if (row) row.remove();
  updateItemCount();
}

function updateItemCount() {
  const n = document.querySelectorAll('#items-container .item-row').length;
  document.getElementById('items-count').textContent = `${n} ítem${n!==1?'s':''}`;
}

function getItemsFromForm() {
  const rows = document.querySelectorAll('#items-container .item-row');
  return Array.from(rows).map(row => {
    const id = row.dataset.itemId;
    let cantidad = parseInt(document.getElementById(`item-qty-${id}`)?.value);
    
    if (isNaN(cantidad) || cantidad < 1) cantidad = 1;

    return {
      id: uid(),
      descripcion: document.getElementById(`item-desc-${id}`)?.value.trim() || '',
      cantidad: cantidad,
      serial: document.getElementById(`item-serial-${id}`)?.value.trim() || '',
      observaciones: document.getElementById(`item-obs-${id}`)?.value.trim() || ''
    };
  }).filter(i => i.descripcion);
}

/* ================================================
   REMISIONES MODULE — CRUD
   ================================================ */
function prepareRemisionModal(id) {
  itemCounter = 0;
  document.getElementById('items-container').innerHTML = '';
  document.getElementById('rem-id').value = id || '';
  
  const qf = document.getElementById('quick-cliente-form');
  if (qf) qf.style.display = 'none';
  document.getElementById('modal-rem-title').textContent = id ? 'Editar Remisión' : 'Nueva Remisión';
  document.getElementById('rem-observaciones').value = '';
  updateSelects();

  if (id) {
    const r = DB.getRemision(id);
    document.getElementById('rem-consecutivo-display').textContent = r.consecutivo;
    document.getElementById('rem-fecha-display').textContent = fmtDate(r.fecha);
    document.getElementById('rem-cliente-id').value = r.clienteId || '';
    document.getElementById('rem-observaciones').value = r.observaciones || '';
    (r.items || []).forEach(item => addItemRow(item));
  } else {
    const consec = DB.genConsec();
    document.getElementById('rem-consecutivo-display').textContent = consec;
    document.getElementById('rem-fecha-display').textContent = fmtDate(todayISO());
    document.getElementById('rem-cliente-id').value = '';
    addItemRow();
  }
  updateItemCount();
}

function onClienteSelect() { }

function saveRemision() {
  const clienteId = document.getElementById('rem-cliente-id').value;
  if (!clienteId) { toast('Selecciona un cliente', 'error'); return; }
  const items = getItemsFromForm();
  if (!items.length) { toast('Agrega al menos un ítem con descripción', 'error'); return; }

  const id = document.getElementById('rem-id').value;
  const obj = {
    id: id || uid(),
    consecutivo: id ? DB.getRemision(id).consecutivo : DB.genConsec(),
    fecha: id ? DB.getRemision(id).fecha : todayISO(),
    clienteId,
    observaciones: document.getElementById('rem-observaciones').value.trim(),
    items,
    creadoEn: id ? DB.getRemision(id).creadoEn : new Date().toISOString()
  };

  if (id) {
    const idx = DB.remisiones.findIndex(r => r.id === id);
    DB.remisiones[idx] = obj;
    toast('Remisión actualizada correctamente');
  } else {
    DB.remisiones.unshift(obj);
    DB.nextConsec++;
    toast('Remisión creada exitosamente');
  }
  DB.saveRemisionToCloud(obj);
  closeModal('remision');
  renderRemisiones();
  renderDashboard();
}

function editRemision(id) { prepareRemisionModal(id); openModal('remision'); }

function deleteRemision(id) {
  const r = DB.getRemision(id);
  confirmDialog(`¿Eliminar remisión "${r.consecutivo}"?`, () => {
    DB.remisiones = DB.remisiones.filter(x => x.id !== id);
    DB.deleteRemisionFromCloud(id);
    renderRemisiones();
    renderDashboard();
    toast('Remisión eliminada');
  });
}

function renderRemisiones() {
  const tbody = document.getElementById('remisiones-tbody');
  const q = (document.getElementById('search-rem')?.value || '').toLowerCase();
  const fd = document.getElementById('filter-fecha')?.value || '';
  document.getElementById('badge-remisiones').textContent = DB.remisiones.length;

  let list = DB.remisiones.filter(r => {
    const c = DB.getCliente(r.clienteId);
    const nomCli = c?.nombre?.toLowerCase() || '';
    const consec = r.consecutivo.toLowerCase();
    const seriales = (r.items||[]).map(i => (i.serial||'').toLowerCase()).join(' ');
    const matchQ = !q || nomCli.includes(q) || consec.includes(q) || seriales.includes(q);
    const matchF = !fd || r.fecha === fd;
    return matchQ && matchF;
  });

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <h3>Sin remisiones</h3><p>Crea tu primera remisión con el botón superior</p>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(r => {
    const c = DB.getCliente(r.clienteId);
    
    // VALIDACIÓN DE ROL: Solo el admin ve el botón rojo
    const isAdmin = DB.currentUserEmail === DB.adminEmail;
    const deleteBtn = isAdmin ? `
      <button class="btn btn-danger btn-sm btn-icon" onclick="deleteRemision('${r.id}')" title="Eliminar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
      </button>` : '';

    return `<tr>
      <td><span class="cons-code">${esc(r.consecutivo)}</span></td>
      <td>
        <div class="fw-600">${esc(c?.nombre||'Cliente no encontrado')}</div>
        ${c?.conductor ? `<div class="text-xs text-muted">🚗 ${esc(c.conductor)}</div>` : ''}
      </td>
      <td><span class="badge badge-gray">${esc(c?.ciudad||'—')}</span></td>
      <td>${fmtDate(r.fecha)}</td>
      <td><span class="badge badge-blue">${r.items?.length||0} ítems</span></td>
      <td>
        <div class="flex gap-8">
          <button class="btn btn-outline btn-sm" onclick="viewRemision('${r.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Ver
          </button>
          <button class="btn btn-ghost btn-sm btn-icon" onclick="editRemision('${r.id}')" title="Editar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          ${deleteBtn}
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filterRemisiones() { renderRemisiones(); }
function clearFiltersRem() {
  document.getElementById('search-rem').value = '';
  document.getElementById('filter-fecha').value = '';
  renderRemisiones();
}

/* ================================================
   VIEW REMISION DETAIL
   ================================================ */
let currentViewId = null;

function viewRemision(id) {
  currentViewId = id;
  const r = DB.getRemision(id);
  const c = DB.getCliente(r.clienteId);

  document.getElementById('view-rem-title').textContent = r.consecutivo;

  const itemsHTML = (r.items||[]).map((item, i) => `
    <tr>
      <td style="padding:10px 12px; font-size:13px; font-weight:600; color:var(--gray-500)">${i+1}</td>
      <td style="padding:10px 12px; font-size:13px; font-weight:600">${esc(item.descripcion)}</td>
      <td style="padding:10px 12px; font-size:13px; text-align:center">${item.cantidad}</td>
      <td style="padding:10px 12px; font-size:13px"><span class="cons-code" style="font-size:11px">${esc(item.serial||'—')}</span></td>
      <td style="padding:10px 12px; font-size:13px; color:var(--gray-500)">${esc(item.observaciones||'—')}</td>
    </tr>`).join('');

  document.getElementById('view-rem-body').innerHTML = `
    <div class="rem-meta">
      <div class="rem-meta-item">
        <span class="rem-meta-label">Consecutivo</span>
        <span class="rem-meta-value">${esc(r.consecutivo)}</span>
      </div>
      <div class="rem-meta-item">
        <span class="rem-meta-label">Fecha</span>
        <span class="rem-meta-value">${fmtDate(r.fecha)}</span>
      </div>
      <div class="rem-meta-item">
        <span class="rem-meta-label">Ítems</span>
        <span class="rem-meta-value">${r.items?.length||0} equipos</span>
      </div>
    </div>

    <div class="detail-grid" style="margin-bottom:20px">
      <div class="detail-item">
        <div class="detail-label">Cliente</div>
        <div class="detail-value">${esc(c?.nombre||'—')}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Ciudad</div>
        <div class="detail-value">${esc(c?.ciudad||'—')}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Teléfono</div>
        <div class="detail-value">${esc(c?.telefono||'—')}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Conductor</div>
        <div class="detail-value">${esc(c?.conductor||'—')}</div>
      </div>
      <div class="detail-item" style="grid-column:1/-1">
        <div class="detail-label">Dirección</div>
        <div class="detail-value">${esc(c?.direccion||'—')}</div>
      </div>
      ${r.observaciones ? `<div class="detail-item" style="grid-column:1/-1">
        <div class="detail-label">Observaciones</div>
        <div class="detail-value">${esc(r.observaciones)}</div>
      </div>` : ''}
    </div>

    <div class="fw-600" style="font-size:14px; margin-bottom:10px; color:var(--gray-700)">Equipos / Materiales</div>
    <div class="table-wrapper" style="border:1px solid var(--gray-200); border-radius:var(--radius-md); overflow:hidden">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:40px">#</th>
            <th>Descripción</th>
            <th style="width:80px; text-align:center">Cant.</th>
            <th>Serial / Ref.</th>
            <th>Observaciones</th>
          </tr>
        </thead>
        <tbody>${itemsHTML}</tbody>
      </table>
    </div>

    <div class="divider" style="margin:24px 0 16px"></div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:32px; margin-top:8px">
      <div style="border-top:2px solid var(--gray-300); padding-top:8px; text-align:center">
        <div style="font-size:12px; color:var(--gray-500); margin-top:6px">Firma Entregado por</div>
      </div>
      <div style="border-top:2px solid var(--gray-300); padding-top:8px; text-align:center">
        <div style="font-size:12px; color:var(--gray-500); margin-top:6px">Firma Recibido por: ${esc(c?.conductor||'_____________')}</div>
      </div>
    </div>`;

  openModal('view-rem');
}

/* ================================================
   NUEVA GENERACIÓN DE PDF PROFESIONAL (Gemelo de tu diseño)
   ================================================ */
function generatePDF(action = 'download') {
  const r = DB.getRemision(currentViewId);
  const c = DB.getCliente(r.clienteId);
  const { jsPDF } = window.jspdf;

  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4'
  });

  const pageW = 210;
  const pageH = 297;
  const margin = 18; 
  const contentW = pageW - margin * 2;
  let y = 18; 

  // --- ENCABEZADO (ZONA VERDE CON CURVA) ---
  const headerHeight = 38;
  doc.setFillColor(50, 168, 23); // NUEVO VERDE #ffffff
  doc.rect(0, 0, pageW, headerHeight, 'F');

  const logoX = margin + 10;
  doc.setFillColor(255, 255, 255);
  doc.circle(logoX, 19, 8, 'F');

  doc.setTextColor(50, 168, 23); // NUEVO VERDE #32A817
  doc.setFontSize(9);
  doc.setFont('Helvetica', 'bold');
  doc.text('Kikes', logoX, 20.5, { align: 'center' });

  doc.setTextColor(225, 245, 219); 
  doc.setFontSize(7);
  doc.setFont('Helvetica', 'normal');
  doc.text('RemisionPro', logoX + 11, 19);
  doc.setFontSize(6);
  doc.text('Sistema de Remisiones', logoX + 11, 21.5);

  // CONSECUTIVO Y FECHA
  const numBoxW = 42;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pageW - margin - numBoxW, 10, numBoxW, 18, 3, 3, 'F');

  doc.setTextColor(50, 168, 23); // NUEVO VERDE #32A817
  doc.setFontSize(10);
  doc.setFont('Helvetica', 'bold');
  doc.text(r.consecutivo, pageW - margin - numBoxW / 2, 17, { align: 'center' });

  const fechaObj = new Date(r.fecha + 'T00:00:00');
  const day = String(fechaObj.getDate()).padStart(2, '0');
  const monthNames = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const month = monthNames[fechaObj.getMonth()];
  const year = fechaObj.getFullYear();

  doc.setFontSize(7);
  doc.setFont('Helvetica', 'normal');
  doc.text(`Fecha: ${day} / ${month} / ${year}`, pageW - margin - numBoxW / 2, 23, { align: 'center' });

  y = headerHeight + 12;

  // --- INFORMACIÓN DEL CLIENTE (GRILLA) ---
  doc.setFillColor(243, 251, 241); 
  doc.roundedRect(margin, y, contentW, 30, 3, 3, 'F');
  
  doc.setDrawColor(194, 234, 183); 
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentW, 30, 3, 3, 'S');

  const col1L = margin + 4;
  const col1V = margin + 26; 
  const col2L = margin + contentW / 2 + 4;
  const col2V = col2L + 22; 

  doc.setTextColor(50, 168, 23); // NUEVO VERDE #32A817
  doc.setFontSize(8);
  doc.setFont('Helvetica', 'bold');
  
  doc.text('NOMBRE:', col1L, y + 6);
  doc.line(col1L, y + 7, col1L + 16, y + 7);
  doc.text('TELEFONO:', col2L, y + 6);
  doc.line(col2L, y + 7, col2L + 18, y + 7);
  doc.text('DIRECCION:', col1L, y + 16);
  doc.line(col1L, y + 17, col1L + 19, y + 17);
  doc.text('CIUDAD:', col2L, y + 16);
  doc.line(col2L, y + 17, col2L + 14, y + 17);
  doc.text('OBSERVACIONES:', col1L, y + 26);
  doc.line(col1L, y + 27, col1L + 28, y + 27);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(40, 50, 40);
  doc.text(c?.nombre || '—', col1V, y + 6);
  doc.text(c?.telefono || '—', col2V, y + 6);
  doc.text(c?.direccion || '—', col1V + 3, y + 16);
  doc.text(c?.ciudad || '—', col2V - 4, y + 16);
  doc.text(r.observaciones ? r.observaciones.substring(0, 120) : '—', col1V + 12, y + 26);

  y += 36;

  // --- TABLA DE ÍTEMS ---
  const itemsSectionY = y;

  doc.setFillColor(50, 168, 23); // NUEVO VERDE #32A817
  doc.roundedRect(margin + 1, y + 1, contentW - 2, 9, 3, 3, 'F'); 
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('Helvetica', 'bold');
  
  const cols = {
    n: margin+2, 
    desc: margin+10, 
    qty: margin+85, 
    serial: margin+105, 
    obs: margin+145
  };
  
  doc.text('#', cols.n, y + 6);
  doc.text('DESCRIPCIÓN', cols.desc, y + 6);
  doc.text('CANT.', cols.qty, y + 6);
  doc.text('SERIAL / REF.', cols.serial, y + 6);
  doc.text('OBSERVACIONES', cols.obs, y + 6);
  
  y += 9;

  const itemRowHeight = 8;
  (r.items || []).forEach((item, i) => {
    const bg = i % 2 === 0 ? [255, 255, 255] : [250, 252, 249];
    doc.setFillColor(...bg);
    doc.rect(margin + 1, y + 1, contentW - 2, itemRowHeight, 'F');
    
    doc.setTextColor(50, 60, 50);
    doc.setFontSize(8.5);
    doc.setFont('Helvetica', 'normal');
    
    doc.setDrawColor(220, 230, 220);
    doc.setLineWidth(0.2);
    doc.line(margin + 1, y + itemRowHeight, margin + contentW - 1, y + itemRowHeight); 
    doc.line(cols.desc - 1, y, cols.desc - 1, y + itemRowHeight); 
    doc.line(cols.qty - 1, y, cols.qty - 1, y + itemRowHeight);
    doc.line(cols.serial - 1, y, cols.serial - 1, y + itemRowHeight);
    doc.line(cols.obs - 1, y, cols.obs - 1, y + itemRowHeight);

    doc.text(String(i + 1), cols.n + 2, y + 5.5, { align: 'center' });
    doc.setFont('Helvetica', 'bold'); 
    doc.text(item.descripcion.substring(0,38), cols.desc, y + 5.5);
    doc.setFont('Helvetica', 'normal');
    doc.text(String(item.cantidad), cols.qty + 5, y + 5.5, { align: 'center' });
    doc.setTextColor(50, 168, 23); // NUEVO VERDE #32A817
    doc.setFont('Helvetica', 'bold');
    doc.text((item.serial || '—').substring(0,18), cols.serial, y + 5.5);
    doc.setTextColor(80, 90, 80); 
    doc.setFont('Helvetica', 'normal');
    doc.text((item.observaciones || '—').substring(0,28), cols.obs, y + 5.5);
    
    y += itemRowHeight;
  });

  doc.setDrawColor(194, 234, 183);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, itemsSectionY, contentW, y - itemsSectionY, 3, 3, 'S');

  // --- FIRMAS ---
  y += 24;
  const sigW = (contentW - 16) / 2;
  const sigX2 = margin + sigW + 16;

  doc.setDrawColor(120, 150, 120);
  doc.setLineWidth(0.5);
  doc.line(margin, y + 14, margin + sigW, y + 14); 
  doc.line(sigX2, y + 14, sigX2 + sigW, y + 14); 

  doc.setTextColor(50, 168, 23); // NUEVO VERDE #32A817
  doc.setFontSize(8);
  doc.setFont('Helvetica', 'bold');


  doc.setTextColor(80, 90, 80);
  doc.setFontSize(8);
  doc.setFont('Helvetica', 'normal');
  doc.text('Entrega', margin + sigW / 2, y + 20, { align: 'center' });
  doc.text('Recibe', sigX2 + sigW / 2, y + 20, { align: 'center' });

// Lógica inteligente: Descargar o Abrir Vista Previa
  if (action === 'print') {
    // 1. Creamos un archivo temporal seguro en la memoria (Blob)
    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);

    // 2. Abrimos el PDF directamente en una nueva pestaña
    window.open(blobUrl, '_blank');

  } else {
    doc.save(`${r.consecutivo}.pdf`);
    toast(`PDF generado: ${r.consecutivo}.pdf`);
  }
}

// Nombramos la función que tu botón HTML está buscando
function printCurrentRemision() {
  generatePDF('print');
}

/* ================================================
   DASHBOARD
   ================================================ */
function renderDashboard() {
  const total = DB.remisiones.length;
  const totalCli = DB.clientes.length;
  const totalItems = DB.remisiones.reduce((a,r)=>a+(r.items?.length||0),0);
  const today = todayISO();
  const hoy = DB.remisiones.filter(r=>r.fecha===today).length;

  document.getElementById('stat-total-rem').textContent = total;
  document.getElementById('stat-total-cli').textContent = totalCli;
  document.getElementById('stat-total-items').textContent = totalItems;
  document.getElementById('stat-hoy').textContent = hoy;
  document.getElementById('badge-remisiones').textContent = total;
  document.getElementById('badge-clientes').textContent = totalCli;

  const tbody = document.getElementById('recent-tbody');
  const recent = DB.remisiones.slice(0, 5);
  if (!recent.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state" style="padding:32px">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <p>No hay remisiones creadas aún</p>
    </div></td></tr>`;
    return;
  }
  tbody.innerHTML = recent.map(r => {
    const c = DB.getCliente(r.clienteId);
    return `<tr>
      <td><span class="cons-code">${esc(r.consecutivo)}</span></td>
      <td class="fw-600">${esc(c?.nombre||'—')}</td>
      <td>${fmtDate(r.fecha)}</td>
      <td><span class="badge badge-blue">${r.items?.length||0}</span></td>
      <td>
        <div class="flex gap-8">
          <button class="btn btn-outline btn-sm" onclick="viewRemision('${r.id}')">Ver PDF</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ================================================
   QUICK CLIENT (inline inside remision modal)
   ================================================ */
function toggleQuickCliente() {
  const form = document.getElementById('quick-cliente-form');
  const isHidden = form.style.display === 'none';
  form.style.display = isHidden ? 'block' : 'none';
  if (isHidden) {
    ['qcli-nombre','qcli-telefono','qcli-ciudad','qcli-conductor','qcli-direccion','qcli-correo']
      .forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    setTimeout(() => document.getElementById('qcli-nombre')?.focus(), 60);
  }
}

function saveQuickCliente() {
  const nombre = document.getElementById('qcli-nombre').value.trim();
  const ciudad = document.getElementById('qcli-ciudad').value.trim();
  const correo = document.getElementById('qcli-correo').value.trim();
  const telefono = document.getElementById('qcli-telefono').value.trim();

  if (!nombre) { toast('El nombre del cliente es requerido', 'error'); return; }
  if (!ciudad) { toast('La ciudad es requerida', 'error'); return; }
  if (!validarCorreo(correo)) { toast('El formato del correo es inválido', 'error'); return; }
  if (!validarTelefono(telefono)) { toast('El teléfono contiene caracteres inválidos', 'error'); return; }

  const obj = {
    id: uid(),
    nombre,
    telefono,
    direccion: document.getElementById('qcli-direccion').value.trim(),
    ciudad,
    correo,
    conductor: document.getElementById('qcli-conductor').value.trim(),
    creadoEn: todayISO()
  };

  DB.clientes.unshift(obj);
  DB.saveClienteToCloud(obj);
  updateSelects();
  document.getElementById('rem-cliente-id').value = obj.id;
  document.getElementById('quick-cliente-form').style.display = 'none';
  document.getElementById('badge-clientes').textContent = DB.clientes.length;
  document.getElementById('stat-total-cli').textContent = DB.clientes.length;

  toast(`✓ Cliente "${obj.nombre}" creado y seleccionado`);
}

/* ================================================
   UPDATE SELECTS
   ================================================ */
function updateSelects() {
  const sel = document.getElementById('rem-cliente-id');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Seleccionar cliente —</option>' +
    DB.clientes.map(c => `<option value="${c.id}" ${c.id===cur?'selected':''}>${esc(c.nombre)} — ${esc(c.ciudad)}</option>`).join('');
}

/* ================================================
   INIT - LISTENERS
   ================================================ */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => {
      // Ignorar si es el modal de confirmación
      if (m.id === 'modal-confirm') {
        m.classList.remove('open');
        return;
      }
      
      // Chequeo especial para el modal de remisión
      if (m.id === 'modal-remision') {
        const items = document.querySelectorAll('#items-container .item-row').length;
        if (items > 0) {
          const confirmar = window.confirm("¿Seguro que deseas salir? Perderás los datos no guardados.");
          if (!confirmar) return; 
        }
      }
      m.classList.remove('open');
    });
  }
});