/* ══════════════════════════════════════════
   MarketList — js.js
   ══════════════════════════════════════════ */

/* ── Service Worker ── */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(r => console.log('SW registrado ✓', r))
    .catch(e => console.error('SW error:', e));
}

/* ══════════════════════════════════════════
   CONSTANTES Y ESTADO
   ══════════════════════════════════════════ */

// Claves de localStorage
const KEY_LISTS  = 'ml_lists';
const KEY_ACTIVE = 'ml_active';
const KEY_ITEMS  = (id) => `ml_items_${id}`;
const KEY_REC1   = 'comprasRecurrentes1';
const KEY_REC2   = 'comprasRecurrentes2';

// Emojis disponibles para nuevas listas
const EMOJIS = ['📝', '🏠', '💊', '💪', '🎉', '🎁', '🧴', '🐾', '🌿', '🍕', '📦', '🎮'];

// Estado global
let activeListId     = localStorage.getItem(KEY_ACTIVE) || 'default';
let seccionActiva    = '';
let contenedorActivo = '';
let badgeActivo      = '';
let elementoEditando = null;
let valorEditando    = '';
let selectedEmoji    = '📝';
let listToDelete     = null;
let celebrateBusy   = false;

/* ══════════════════════════════════════════
   HELPERS: LOCAL STORAGE
   ══════════════════════════════════════════ */
function getLS(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}
function setLS(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

function addLS(key, val) {
  const arr = getLS(key);
  if (!arr.includes(val)) { arr.push(val); setLS(key, arr); }
}
function removeFromLS(key, val) {
  setLS(key, getLS(key).filter(v => v !== val));
}
function editLS(key, oldVal, newVal) {
  const arr = getLS(key);
  const i = arr.indexOf(oldVal);
  if (i !== -1) { arr[i] = newVal; setLS(key, arr); }
}

/* ══════════════════════════════════════════
   HELPERS: UI
   ══════════════════════════════════════════ */
function toast(msg, ms = 2300) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), ms);
}

function openModal(id)  { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

/* ══════════════════════════════════════════
   GESTIÓN DE LISTAS
   ══════════════════════════════════════════ */

/** Devuelve array de metadatos de listas */
function getLists() { return getLS(KEY_LISTS); }
function setLists(lists) { setLS(KEY_LISTS, lists); }

/** Devuelve la lista activa (objeto metadata) */
function getActiveList() {
  const lists = getLists();
  return lists.find(l => l.id === activeListId) || lists[0];
}

/** Inicializa datos si el usuario entra por primera vez */
function initLists() {
  const lists = getLists();
  if (!lists.length) {
    setLists([{ id: 'default', name: 'Lista del super', emoji: '🛒', isDefault: true }]);
  }
  // Si el activeListId guardado ya no existe, volver al default
  const current = getLists().find(l => l.id === activeListId);
  if (!current) {
    activeListId = 'default';
    localStorage.setItem(KEY_ACTIVE, 'default');
  }
  // Migración: si existe data vieja con clave 'listaCompleta', moverla
  const oldData = localStorage.getItem('listaCompleta');
  if (oldData && !localStorage.getItem(KEY_ITEMS('default'))) {
    try {
      const parsed = JSON.parse(oldData);
      setLS(KEY_ITEMS('default'), parsed);
      localStorage.removeItem('listaCompleta');
    } catch (_) { /* ignorar error de migración */ }
  }
}

/** Crea una nueva lista personalizada */
function createList(name, emoji) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const lists = getLists();
  lists.push({ id, name, emoji, isDefault: false });
  setLists(lists);
  setLS(KEY_ITEMS(id), []); // lista vacía inicial
  return id;
}

/** Elimina una lista y su contenido */
function deleteList(id) {
  if (id === 'default') return; // La lista por defecto no se puede eliminar
  setLists(getLists().filter(l => l.id !== id));
  localStorage.removeItem(KEY_ITEMS(id));
  // Si se eliminó la lista activa, regresar al default
  if (activeListId === id) {
    switchList('default');
  } else {
    renderDrawer();
  }
}

/* ══════════════════════════════════════════
   DRAWER (MENÚ HAMBURGUESA)
   ══════════════════════════════════════════ */
function openDrawer() {
  renderDrawer();
  document.getElementById('drawerOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeDrawer() {
  document.getElementById('drawerOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function renderDrawer() {
  const lists = getLists();
  const container = document.getElementById('drawerLists');
  container.innerHTML = '';

  lists.forEach(list => {
    const isActive = list.id === activeListId;
    const item = document.createElement('div');
    item.className = 'drawer-list-item' + (isActive ? ' active' : '');
    item.dataset.id = list.id;

    // Botón de borrado (solo para listas personalizadas no activas)
    const canDelete = !list.isDefault && !isActive;
    const deleteBtn = canDelete
      ? `<button class="drawer-item-del" data-id="${list.id}" aria-label="Eliminar ${list.name}">
           <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <polyline points="3 6 5 6 21 6"/>
             <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
             <path d="M10 11v6M14 11v6"/>
           </svg>
         </button>`
      : '';

    // Check de activo
    const checkMark = isActive
      ? `<span class="drawer-item-check">
           <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
             <path d="M3 8L6.5 11.5L13 5" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round"/>
           </svg>
         </span>`
      : '';

    item.innerHTML = `
      <span class="drawer-item-emoji">${list.emoji}</span>
      <span class="drawer-item-name">${list.name}</span>
      ${checkMark}
      ${deleteBtn}
    `;

    // Tap en el item → cambiar lista
    item.addEventListener('click', (e) => {
      if (e.target.closest('.drawer-item-del')) return;
      if (list.id !== activeListId) switchList(list.id);
      closeDrawer();
    });

    // Tap en botón eliminar
    const delBtn = item.querySelector('.drawer-item-del');
    if (delBtn) {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        listToDelete = list;
        document.getElementById('deleteListDesc').textContent =
          `Se eliminará "${list.name}" y todos sus elementos. Esta acción no se puede deshacer.`;
        closeDrawer();
        openModal('modalDeleteList');
      });
    }

    container.appendChild(item);
  });

  // Hint si solo existe la lista default
  if (lists.length === 1) {
    const hint = document.createElement('p');
    hint.className = 'drawer-empty-hint';
    hint.textContent = 'No tienes otras listas aún';
    container.appendChild(hint);
  }
}

/* ══════════════════════════════════════════
   CAMBIAR DE LISTA ACTIVA
   ══════════════════════════════════════════ */
function switchList(id) {
  activeListId = id;
  localStorage.setItem(KEY_ACTIVE, id);

  const list = getActiveList();
  const isDefault = !!list.isDefault;

  // Actualizar header
  document.getElementById('headerEmoji').textContent = list.emoji;
  document.getElementById('headerTitle').textContent = list.name;

  // Actualizar título de sección
  document.getElementById('listTitle').textContent = list.name;

  // Mostrar/ocultar sección de productos guardados
  const savedSection = document.getElementById('savedSection');
  const divider      = document.getElementById('mainDivider');
  savedSection.style.display = isDefault ? '' : 'none';
  divider.style.display      = isDefault ? '' : 'none';

  // Actualizar empty state
  document.getElementById('emptyIcon').textContent = isDefault ? '🛒' : list.emoji;
  document.getElementById('emptyDesc').textContent = isDefault
    ? 'Agrega productos de tus listas guardadas o escríbelos abajo'
    : 'Añade elementos usando el campo de abajo';

  // Limpiar UI de lista y cargar la nueva
  clearListUI();
  loadList(id);
  updateProgress();
  renderDrawer();
}

/* ══════════════════════════════════════════
   MODAL: CREAR NUEVA LISTA
   ══════════════════════════════════════════ */
function openCreateListModal() {
  selectedEmoji = '📝';
  document.getElementById('inputListName').value = '';
  renderEmojiPicker();
  openModal('modalCreateList');
  setTimeout(() => document.getElementById('inputListName').focus(), 340);
}

function renderEmojiPicker() {
  const picker = document.getElementById('emojiPicker');
  picker.innerHTML = '';
  EMOJIS.forEach(emoji => {
    const btn = document.createElement('button');
    btn.className = 'emoji-option' + (emoji === selectedEmoji ? ' selected' : '');
    btn.textContent = emoji;
    btn.type = 'button';
    btn.addEventListener('click', () => {
      selectedEmoji = emoji;
      picker.querySelectorAll('.emoji-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
    picker.appendChild(btn);
  });
}

/* ══════════════════════════════════════════
   PRODUCTOS GUARDADOS (CHIPS)
   ══════════════════════════════════════════ */
function updateBadge(seccion, badgeId) {
  const el = document.getElementById(badgeId);
  if (el) el.textContent = getLS(seccion).length;
}

function createChip(seccion, valor) {
  const chip = document.createElement('div');
  chip.className = 'chip';
  chip.dataset.valor = valor;
  chip.tabIndex = 0;
  chip.innerHTML = `<span class="chip-text">${valor}</span><span class="chip-check">✓</span>`;

  let pressTimer, isLong = false, moved = false;

  chip.addEventListener('touchstart', () => {
    isLong = false; moved = false;
    pressTimer = setTimeout(() => {
      isLong = true;
      openEditModal(seccion, chip, chip.dataset.valor);
    }, 520);
  }, { passive: true });

  chip.addEventListener('touchmove', () => {
    moved = true; clearTimeout(pressTimer);
  }, { passive: true });

  chip.addEventListener('touchend', (e) => {
    clearTimeout(pressTimer);
    if (!isLong && !moved) {
      e.preventDefault();
      tapChip(chip);
    }
  });

  // Desktop
  chip.addEventListener('click', () => tapChip(chip));
  chip.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    openEditModal(seccion, chip, chip.dataset.valor);
  });
  chip.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') tapChip(chip);
    if (e.key === 'Delete') openEditModal(seccion, chip, chip.dataset.valor);
  });

  return chip;
}

function tapChip(chip) {
  chip.classList.add('adding');
  setTimeout(() => chip.classList.remove('adding'), 480);
  agregarALista(chip.dataset.valor);
}

function loadSaved(seccion, contenedorId, badgeId) {
  const wrap = document.getElementById(contenedorId);
  if (!wrap) return;
  const arr = getLS(seccion);

  wrap.querySelectorAll('.chip, .items-empty').forEach(el => el.remove());

  if (!arr.length) {
    const em = document.createElement('span');
    em.className = 'items-empty';
    em.textContent = 'Sin productos guardados';
    wrap.appendChild(em);
  } else {
    arr.forEach(v => wrap.appendChild(createChip(seccion, v)));
  }
  updateBadge(seccion, badgeId);
}

function appendChip(seccion, contenedorId, badgeId, valor) {
  const wrap = document.getElementById(contenedorId);
  if (!wrap) return;
  wrap.querySelector('.items-empty')?.remove();
  wrap.appendChild(createChip(seccion, valor));
  updateBadge(seccion, badgeId);
}

/* ══════════════════════════════════════════
   MODAL: AÑADIR PRODUCTO GUARDADO
   ══════════════════════════════════════════ */
[
  ['agrm1', KEY_REC1, 'articulos1', 'badge1'],
  ['agrm2', KEY_REC2, 'articulos2', 'badge2']
].forEach(([btnId, sec, cont, badge]) => {
  document.getElementById(btnId).addEventListener('click', () => {
    seccionActiva = sec;
    contenedorActivo = cont;
    badgeActivo = badge;
    const inp = document.getElementById('inputAgregar');
    inp.value = '';
    openModal('modalAgregar');
    setTimeout(() => inp.focus(), 340);
  });
});

document.getElementById('cancelAgregar').addEventListener('click', () => closeModal('modalAgregar'));

document.getElementById('guardarElem').addEventListener('click', () => {
  const inp = document.getElementById('inputAgregar');
  const val = inp.value.trim();
  if (!val) return;
  if (getLS(seccionActiva).includes(val)) { toast(`"${val}" ya existe`); return; }

  appendChip(seccionActiva, contenedorActivo, badgeActivo, val);
  addLS(seccionActiva, val);
  inp.value = '';
  closeModal('modalAgregar');
  toast(`"${val}" guardado ✓`);
});

document.getElementById('inputAgregar').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('guardarElem').click();
});

/* ══════════════════════════════════════════
   MODAL: EDITAR PRODUCTO GUARDADO
   ══════════════════════════════════════════ */
function openEditModal(seccion, chip, valor) {
  seccionActiva    = seccion;
  elementoEditando = chip;
  valorEditando    = valor;
  const inp = document.getElementById('inputEditar');
  inp.value = valor;
  openModal('modalEditar');
  setTimeout(() => inp.focus(), 340);
}

document.getElementById('guardarEdicion').addEventListener('click', () => {
  const inp    = document.getElementById('inputEditar');
  const newVal = inp.value.trim();
  if (!newVal || !elementoEditando) return;

  // Actualizar texto del chip
  const chipText = elementoEditando.querySelector('.chip-text');
  if (chipText) chipText.textContent = newVal;
  elementoEditando.dataset.valor = newVal;

  editLS(seccionActiva, valorEditando, newVal);
  const badgeId = seccionActiva === KEY_REC1 ? 'badge1' : 'badge2';
  updateBadge(seccionActiva, badgeId);

  closeModal('modalEditar');
  toast('Producto actualizado');
  elementoEditando = null;
  valorEditando    = '';
});

document.getElementById('eliminarEdicion').addEventListener('click', () => {
  if (!elementoEditando) { closeModal('modalEditar'); return; }

  const wrap = elementoEditando.parentNode;
  elementoEditando.remove();
  removeFromLS(seccionActiva, valorEditando);

  if (wrap && !wrap.querySelectorAll('.chip').length) {
    const em = document.createElement('span');
    em.className = 'items-empty';
    em.textContent = 'Sin productos guardados';
    wrap.appendChild(em);
  }

  const badgeId = seccionActiva === KEY_REC1 ? 'badge1' : 'badge2';
  updateBadge(seccionActiva, badgeId);

  closeModal('modalEditar');
  toast('Producto eliminado');
  elementoEditando = null;
  valorEditando    = '';
});

document.getElementById('inputEditar').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('guardarEdicion').click();
});

/* ══════════════════════════════════════════
   LISTA DE COMPRAS
   ══════════════════════════════════════════ */

/** Guarda el estado actual de la lista activa en localStorage */
function saveList() {
  const items = [...document.querySelectorAll('#listaCompl .list-item')].map(el => ({
    nombre: el.dataset.valor,
    done: el.classList.contains('done')
  }));
  setLS(KEY_ITEMS(activeListId), items);
  updateProgress();
}

/** Limpia los items del DOM sin tocar localStorage */
function clearListUI() {
  document.querySelectorAll('#listaCompl .list-item').forEach(el => el.remove());
  document.getElementById('emptyState').style.display = 'flex';
}

/** Crea el elemento DOM de un item de lista */
function createListItem(valor, done = false) {
  const el = document.createElement('div');
  el.className = 'list-item' + (done ? ' done' : '');
  el.dataset.valor = valor;

  el.innerHTML = `
    <div class="item-check"><span class="check-tick">✓</span></div>
    <span class="item-name">${valor}</span>
    <button class="item-del" aria-label="Eliminar ${valor}">✕</button>
  `;

  // Toggle check
  el.querySelector('.item-check').addEventListener('click', () => {
    el.classList.toggle('done');
    saveList();
  });

  // Eliminar
  el.querySelector('.item-del').addEventListener('click', () => removeListItem(el));

  // Swipe izquierdo para eliminar
  let sx = 0, dragging = false;
  el.addEventListener('touchstart', e => {
    sx = e.touches[0].clientX; dragging = false;
  }, { passive: true });
  el.addEventListener('touchmove', e => {
    const dx = e.touches[0].clientX - sx;
    if (Math.abs(dx) > 10) dragging = true;
    if (dx < 0 && dragging) {
      const clamp = Math.max(dx, -90);
      el.style.transform = `translateX(${clamp}px)`;
      el.classList.toggle('swiping', clamp < -30);
    }
  }, { passive: true });
  el.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx;
    if (dx < -72 && dragging) {
      removeListItem(el);
    } else {
      el.style.transition = 'transform 0.2s ease';
      el.style.transform  = '';
      el.classList.remove('swiping');
      setTimeout(() => { el.style.transition = ''; }, 210);
    }
  }, { passive: true });

  return el;
}

/** Elimina un item con animación */
function removeListItem(el) {
  el.classList.add('removing');
  setTimeout(() => {
    el.remove();
    if (!document.querySelectorAll('#listaCompl .list-item').length) {
      document.getElementById('emptyState').style.display = 'flex';
    }
    saveList();
  }, 200);
}

/** Añade un item a la lista actual */
function agregarALista(valor, guardar = true, done = false) {
  const lista = document.getElementById('listaCompl');
  const empty = document.getElementById('emptyState');

  // Evitar duplicados
  const dup = [...lista.querySelectorAll('.list-item')].find(
    el => el.dataset.valor?.toLowerCase().trim() === valor.toLowerCase().trim()
  );
  if (dup) { toast(`"${valor}" ya está en la lista`); return; }

  empty.style.display = 'none';
  lista.appendChild(createListItem(valor, done));
  if (guardar) saveList();
  else updateProgress();
}

/** Carga los items guardados de una lista específica */
function loadList(id) {
  const items = getLS(KEY_ITEMS(id));
  if (items.length) document.getElementById('emptyState').style.display = 'none';
  items.forEach(({ nombre, done }) => agregarALista(nombre, false, done));
  updateProgress();
}

/* ── Barra de progreso ── */
function updateProgress() {
  const all   = document.querySelectorAll('#listaCompl .list-item');
  const done  = document.querySelectorAll('#listaCompl .list-item.done');
  const total = all.length;
  const doneN = done.length;
  const fill  = document.getElementById('progressFill');
  const sub   = document.getElementById('listSub');

  if (!total) {
    fill.style.width = '0%';
    sub.textContent  = 'Empieza añadiendo productos';
    sub.classList.remove('all-done');
    return;
  }

  const pct = Math.round((doneN / total) * 100);
  fill.style.width = pct + '%';

  if (doneN === total) {
    sub.textContent = `¡Todo listo! ${total} producto${total !== 1 ? 's' : ''}`;
    sub.classList.add('all-done');
    celebrate();
  } else {
    sub.textContent = `${doneN} de ${total} producto${total !== 1 ? 's' : ''}`;
    sub.classList.remove('all-done');
  }
}

/* ── Animación de celebración ── */
function celebrate() {
  if (celebrateBusy) return;
  celebrateBusy = true;
  setTimeout(() => { celebrateBusy = false; }, 1100);
  const el = document.createElement('div');
  el.className = 'celebration';
  el.innerHTML = '<div class="celebrate-emoji">🎉</div>';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

/* ══════════════════════════════════════════
   ACORDEONES
   ══════════════════════════════════════════ */
function setupAccordion(accId) {
  const acc = document.getElementById(accId);
  const btn = acc.querySelector('.acc-btn');
  btn.addEventListener('click', () => {
    const open = acc.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });
}

/* ══════════════════════════════════════════
   FECHA EN HEADER
   ══════════════════════════════════════════ */
(function setHeaderDate() {
  const days   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const d = new Date();
  document.getElementById('headerDate').textContent =
    `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
})();

/* ══════════════════════════════════════════
   EVENT LISTENERS
   ══════════════════════════════════════════ */

// ── Drawer ──
document.getElementById('btnHamburger').addEventListener('click', openDrawer);
document.getElementById('drawerClose').addEventListener('click', closeDrawer);
document.getElementById('drawerBackdrop').addEventListener('click', closeDrawer);

// ── Crear lista ──
document.getElementById('btnCreateList').addEventListener('click', () => {
  closeDrawer();
  openCreateListModal();
});

document.getElementById('cancelCreateList').addEventListener('click', () => closeModal('modalCreateList'));

document.getElementById('inputListName').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('confirmCreateList').click();
});

document.getElementById('confirmCreateList').addEventListener('click', () => {
  const name = document.getElementById('inputListName').value.trim();
  if (!name) { toast('Escribe un nombre para la lista'); return; }

  const id = createList(name, selectedEmoji);
  closeModal('modalCreateList');
  toast(`"${name}" creada ✓`);
  switchList(id); // Ir directo a la nueva lista
});

// ── Eliminar lista ──
document.getElementById('cancelDeleteList').addEventListener('click', () => {
  listToDelete = null;
  closeModal('modalDeleteList');
});

document.getElementById('confirmDeleteList').addEventListener('click', () => {
  if (!listToDelete) return;
  const name = listToDelete.name;
  deleteList(listToDelete.id);
  listToDelete = null;
  closeModal('modalDeleteList');
  toast(`"${name}" eliminada`);
});

// ── Añadir a lista desde input ──
document.getElementById('btnagrmasinpt').addEventListener('click', () => {
  const inp = document.getElementById('inptagrmas');
  const val = inp.value.trim();
  if (!val) return;
  agregarALista(val);
  inp.value = '';
  toast(`"${val}" añadido`);
});

document.getElementById('inptagrmas').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btnagrmasinpt').click();
});

// ── Limpiar lista ──
document.getElementById('btnClear').addEventListener('click', () => openModal('modalConfirm'));
document.getElementById('cancelClear').addEventListener('click', () => closeModal('modalConfirm'));

document.getElementById('confirmClear').addEventListener('click', () => {
  document.querySelectorAll('#listaCompl .list-item').forEach(el => el.remove());
  setLS(KEY_ITEMS(activeListId), []);
  document.getElementById('emptyState').style.display = 'flex';
  updateProgress();
  closeModal('modalConfirm');
  toast('Lista terminada 🎉');
});

// ── Copiar lista ──
document.getElementById('btnCopy').addEventListener('click', () => {
  const items = [...document.querySelectorAll('#listaCompl .list-item')];
  if (!items.length) { toast('La lista está vacía'); return; }

  const list = getActiveList();
  const text = `${list.emoji} ${list.name}\n\n` +
    items.map(el =>
      (el.classList.contains('done') ? '✓ ' : '☐ ') + el.dataset.valor
    ).join('\n');

  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
      .then(() => toast('Lista copiada 📋'))
      .catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
});

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;pointer-events:none';
  document.body.appendChild(ta);
  ta.focus(); ta.select();
  try { document.execCommand('copy'); toast('Lista copiada 📋'); }
  catch { toast('No se pudo copiar'); }
  ta.remove();
}

// ── Cerrar modales al tocar el fondo ──
['modalAgregar', 'modalEditar', 'modalConfirm', 'modalCreateList', 'modalDeleteList']
  .forEach(id => {
    document.getElementById(id).addEventListener('click', e => {
      if (e.target.id === id) closeModal(id);
    });
  });

/* ══════════════════════════════════════════
   INICIALIZACIÓN
   ══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initLists();

  // Aplicar estado de la lista activa al arrancar
  const list = getActiveList();
  document.getElementById('headerEmoji').textContent  = list.emoji;
  document.getElementById('headerTitle').textContent  = list.name;
  document.getElementById('listTitle').textContent    = list.name;

  const isDefault = !!list.isDefault;
  document.getElementById('savedSection').style.display = isDefault ? '' : 'none';
  document.getElementById('mainDivider').style.display  = isDefault ? '' : 'none';

  if (!isDefault) {
    document.getElementById('emptyIcon').textContent = list.emoji;
    document.getElementById('emptyDesc').textContent = 'Añade elementos usando el campo de abajo';
  }

  // Inicializar acordeones
  setupAccordion('acc1');
  setupAccordion('acc2');

  // Cargar productos guardados (recurrentes y variables)
  loadSaved(KEY_REC1, 'articulos1', 'badge1');
  loadSaved(KEY_REC2, 'articulos2', 'badge2');

  // Cargar items de la lista activa
  loadList(activeListId);
});