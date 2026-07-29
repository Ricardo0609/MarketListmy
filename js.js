/* ══════════════════════════════════════════
   MarketList — js.js
   ══════════════════════════════════════════ */

/* ── Service Worker ── */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(r => console.log('SW ✓', r))
    .catch(e => console.error('SW error:', e));
}

/* ══════════════════════════════════════════
   CONSTANTES
   ══════════════════════════════════════════ */
const KEY_LISTS  = 'ml_lists';
const KEY_ACTIVE = 'ml_active';
const KEY_ITEMS  = (id) => `ml_items_${id}`;
const KEY_REC1   = 'comprasRecurrentes1';
const KEY_REC2   = 'comprasRecurrentes2';

const EMOJIS = ['📝','🏠','💊','💪','🎉','🎁','🧴','🐾','🌿','🍕','📦','🎮'];

const TAG_OPTIONS = [
  { value: '',           label: 'Ninguna',    emoji: '○' },
  { value: 'importante', label: 'Importante', emoji: '⭐' },
  { value: 'urgente',    label: 'Urgente',    emoji: '🔴' },
];

/* ══════════════════════════════════════════
   ESTADO GLOBAL
   ══════════════════════════════════════════ */
let activeListId     = localStorage.getItem(KEY_ACTIVE) || 'default';
let seccionActiva    = '';
let contenedorActivo = '';
let badgeActivo      = '';
let elementoEditando = null;
let valorEditando    = '';
let selectedEmoji    = '📝';
let listToDelete     = null;
let celebrateBusy    = false;

// Tags
let selectedTag      = '';   // tag seleccionado en el tag-strip
let itemEditing      = null; // elemento DOM en edición
let tagEditSelected  = '';   // tag seleccionado en el modal de edición

/* ══════════════════════════════════════════
   HELPERS — LOCAL STORAGE
   ══════════════════════════════════════════ */
function getLS(key)         { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } }
function setLS(key, val)    { localStorage.setItem(key, JSON.stringify(val)); }
function addLS(key, val)    { const a = getLS(key); if (!a.includes(val)) { a.push(val); setLS(key, a); } }
function removeFromLS(k, v) { setLS(k, getLS(k).filter(x => x !== v)); }
function editLS(k, old, nw) { const a = getLS(k); const i = a.indexOf(old); if (i !== -1) { a[i] = nw; setLS(k, a); } }

/* ══════════════════════════════════════════
   HELPERS — UI
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
function getLists()         { return getLS(KEY_LISTS); }
function setLists(lists)    { setLS(KEY_LISTS, lists); }
function getActiveList()    { return getLists().find(l => l.id === activeListId) || getLists()[0]; }

function initLists() {
  if (!getLists().length) {
    setLists([{ id: 'default', name: 'Lista del super', emoji: '🛒', isDefault: true }]);
  }
  // Si el activeListId guardado ya no existe, volver al default
  if (!getLists().find(l => l.id === activeListId)) {
    activeListId = 'default';
    localStorage.setItem(KEY_ACTIVE, 'default');
  }
  // Migración de datos de versión anterior
  const old = localStorage.getItem('listaCompleta');
  if (old && !localStorage.getItem(KEY_ITEMS('default'))) {
    try { setLS(KEY_ITEMS('default'), JSON.parse(old)); localStorage.removeItem('listaCompleta'); } catch (_) {}
  }
}

function createList(name, emoji) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const lists = getLists();
  lists.push({ id, name, emoji, isDefault: false });
  setLists(lists);
  setLS(KEY_ITEMS(id), []);
  return id;
}

function deleteList(id) {
  if (id === 'default') return;
  setLists(getLists().filter(l => l.id !== id));
  localStorage.removeItem(KEY_ITEMS(id));
  if (activeListId === id) switchList('default');
  else renderDrawer();
}

/* ══════════════════════════════════════════
   DRAWER
   ══════════════════════════════════════════ */
function openDrawer()  { renderDrawer(); document.getElementById('drawerOverlay').classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeDrawer() { document.getElementById('drawerOverlay').classList.remove('open'); document.body.style.overflow = ''; }

function renderDrawer() {
  const lists = getLists();
  const container = document.getElementById('drawerLists');
  container.innerHTML = '';

  lists.forEach(list => {
    const isActive = list.id === activeListId;
    const canDelete = !list.isDefault && !isActive;
    const item = document.createElement('div');
    item.className = 'drawer-list-item' + (isActive ? ' active' : '');
    item.dataset.id = list.id;
    item.innerHTML = `
      <span class="drawer-item-emoji">${list.emoji}</span>
      <span class="drawer-item-name">${list.name}</span>
      ${isActive
        ? `<span class="drawer-item-check"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8L6.5 11.5L13 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`
        : ''}
      ${canDelete
        ? `<button class="drawer-item-del" data-id="${list.id}" aria-label="Eliminar ${list.name}">
             <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
               <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>
             </svg>
           </button>`
        : ''}
    `;

    item.addEventListener('click', (e) => {
      if (e.target.closest('.drawer-item-del')) return;
      if (list.id !== activeListId) switchList(list.id);
      closeDrawer();
    });

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

  if (lists.length === 1) {
    const hint = document.createElement('p');
    hint.className = 'drawer-empty-hint';
    hint.textContent = 'No tienes otras listas aún';
    container.appendChild(hint);
  }
}

/* ══════════════════════════════════════════
   CAMBIAR LISTA ACTIVA
   ══════════════════════════════════════════ */
function switchList(id) {
  activeListId = id;
  localStorage.setItem(KEY_ACTIVE, id);

  const list = getActiveList();
  const isDefault = !!list.isDefault;

  // Header y título
  document.getElementById('headerEmoji').textContent = list.emoji;
  document.getElementById('headerTitle').textContent = list.name;
  document.getElementById('listTitle').textContent   = list.name;

  // Mostrar/ocultar sección de productos guardados
  document.getElementById('savedSection').style.display = isDefault ? '' : 'none';
  document.getElementById('mainDivider').style.display  = isDefault ? '' : 'none';

  // Tag strip y hint de edición
  const tagStrip = document.getElementById('tagStrip');
  const editHint = document.getElementById('editHint');
  if (isDefault) {
    tagStrip.classList.remove('visible');
    editHint.classList.remove('visible');
  } else {
    tagStrip.classList.add('visible');
    // El hint se muestra dinámicamente según si hay items
  }

  // Resetear tag seleccionado
  resetTagStrip();

  // Empty state
  document.getElementById('emptyIcon').textContent = isDefault ? '🛒' : list.emoji;
  document.getElementById('emptyDesc').textContent = isDefault
    ? 'Agrega productos de tus listas guardadas o escríbelos abajo'
    : 'Añade elementos usando el campo de abajo';

  // Recargar items
  clearListUI();
  loadList(id);
  updateProgress();
  renderDrawer();
}

/* ══════════════════════════════════════════
   TAG STRIP
   ══════════════════════════════════════════ */
function initTagStrip() {
  document.querySelectorAll('.tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedTag = btn.dataset.tag;
      document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function resetTagStrip() {
  selectedTag = '';
  document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
  const neutral = document.querySelector('.tag-btn[data-tag=""]');
  if (neutral) neutral.classList.add('active');
}

/* ══════════════════════════════════════════
   MODAL: CREAR LISTA
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
    btn.type = 'button';
    btn.className = 'emoji-option' + (emoji === selectedEmoji ? ' selected' : '');
    btn.textContent = emoji;
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
  chip.addEventListener('touchstart', () => { isLong = false; moved = false; pressTimer = setTimeout(() => { isLong = true; openEditModal(seccion, chip, chip.dataset.valor); }, 520); }, { passive: true });
  chip.addEventListener('touchmove',  () => { moved = true; clearTimeout(pressTimer); }, { passive: true });
  chip.addEventListener('touchend',   (e) => { clearTimeout(pressTimer); if (!isLong && !moved) { e.preventDefault(); tapChip(chip); } });
  chip.addEventListener('click',         () => tapChip(chip));
  chip.addEventListener('contextmenu',   (e) => { e.preventDefault(); openEditModal(seccion, chip, chip.dataset.valor); });
  chip.addEventListener('keydown',       (e) => { if (e.key === 'Enter' || e.key === ' ') tapChip(chip); if (e.key === 'Delete') openEditModal(seccion, chip, chip.dataset.valor); });
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
  wrap.querySelectorAll('.chip, .items-empty').forEach(el => el.remove());
  const arr = getLS(seccion);
  if (!arr.length) {
    const em = document.createElement('span'); em.className = 'items-empty'; em.textContent = 'Sin productos guardados'; wrap.appendChild(em);
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
[['agrm1', KEY_REC1, 'articulos1', 'badge1'], ['agrm2', KEY_REC2, 'articulos2', 'badge2']].forEach(([btnId, sec, cont, badge]) => {
  document.getElementById(btnId).addEventListener('click', () => {
    seccionActiva = sec; contenedorActivo = cont; badgeActivo = badge;
    document.getElementById('inputAgregar').value = '';
    openModal('modalAgregar');
    setTimeout(() => document.getElementById('inputAgregar').focus(), 340);
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

document.getElementById('inputAgregar').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('guardarElem').click(); });

/* ══════════════════════════════════════════
   MODAL: EDITAR PRODUCTO GUARDADO (CHIPS)
   ══════════════════════════════════════════ */
function openEditModal(seccion, chip, valor) {
  seccionActiva = seccion; elementoEditando = chip; valorEditando = valor;
  document.getElementById('inputEditar').value = valor;
  openModal('modalEditar');
  setTimeout(() => document.getElementById('inputEditar').focus(), 340);
}

document.getElementById('guardarEdicion').addEventListener('click', () => {
  const newVal = document.getElementById('inputEditar').value.trim();
  if (!newVal || !elementoEditando) return;
  const chipText = elementoEditando.querySelector('.chip-text');
  if (chipText) chipText.textContent = newVal;
  elementoEditando.dataset.valor = newVal;
  editLS(seccionActiva, valorEditando, newVal);
  updateBadge(seccionActiva, seccionActiva === KEY_REC1 ? 'badge1' : 'badge2');
  closeModal('modalEditar');
  toast('Producto actualizado');
  elementoEditando = null; valorEditando = '';
});

document.getElementById('eliminarEdicion').addEventListener('click', () => {
  if (!elementoEditando) { closeModal('modalEditar'); return; }
  const wrap = elementoEditando.parentNode;
  elementoEditando.remove();
  removeFromLS(seccionActiva, valorEditando);
  if (wrap && !wrap.querySelectorAll('.chip').length) {
    const em = document.createElement('span'); em.className = 'items-empty'; em.textContent = 'Sin productos guardados'; wrap.appendChild(em);
  }
  updateBadge(seccionActiva, seccionActiva === KEY_REC1 ? 'badge1' : 'badge2');
  closeModal('modalEditar');
  toast('Producto eliminado');
  elementoEditando = null; valorEditando = '';
});

document.getElementById('inputEditar').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('guardarEdicion').click(); });

/* ══════════════════════════════════════════
   LISTA DE COMPRAS — items
   ══════════════════════════════════════════ */
function saveList() {
  const items = [...document.querySelectorAll('#listaCompl .list-item')].map(el => ({
    nombre: el.dataset.valor,
    done:   el.classList.contains('done'),
    tag:    el.dataset.tag || null,
  }));
  setLS(KEY_ITEMS(activeListId), items);
  updateProgress();
}

function clearListUI() {
  document.querySelectorAll('#listaCompl .list-item').forEach(el => el.remove());
  document.getElementById('emptyState').style.display = 'flex';
  document.getElementById('editHint').classList.remove('visible');
}

/**
 * Crea un elemento DOM para la lista.
 * canEdit: true en listas personalizadas (permite editar y muestra etiqueta)
 */
function createListItem(valor, done = false, tag = null, canEdit = false) {
  const el = document.createElement('div');
  el.className = 'list-item' + (done ? ' done' : '') + (canEdit ? ' editable' : '');
  el.dataset.valor = valor;
  el.dataset.tag   = tag || '';

  // Badge de etiqueta
  const tagHTML = tag
    ? `<span class="item-tag ${tag}">${tag === 'importante' ? 'Importante' : 'Urgente'}</span>`
    : '';

  // El botón de eliminar solo aparece en la lista default (canEdit = false)
  const delBtnHTML = !canEdit
    ? `<button class="item-del" aria-label="Eliminar">✕</button>`
    : '';

  el.innerHTML = `
    <div class="item-check"><span class="check-tick">✓</span></div>
    <span class="item-name">${valor}</span>
    ${tagHTML}
    ${delBtnHTML}
  `;

  // Toggle completado
  el.querySelector('.item-check').addEventListener('click', (e) => {
    e.stopPropagation();
    el.classList.toggle('done');
    saveList();
  });

  // Eliminar (solo lista default)
  const delBtn = el.querySelector('.item-del');
  if (delBtn) {
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeListItem(el);
    });
  }

  // Tap para editar (listas personalizadas)
  if (canEdit) {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.item-check')) return;
      openItemEditModal(el);
    });
  }

  // Swipe izquierdo para eliminar (ambos tipos de lista)
  let sx = 0, dragging = false;
  el.addEventListener('touchstart', e => { sx = e.touches[0].clientX; dragging = false; }, { passive: true });
  el.addEventListener('touchmove', e => {
    const dx = e.touches[0].clientX - sx;
    if (Math.abs(dx) > 10) dragging = true;
    if (dx < 0 && dragging) {
      const c = Math.max(dx, -90);
      el.style.transform = `translateX(${c}px)`;
      el.classList.toggle('swiping', c < -30);
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

function removeListItem(el) {
  // Cerrar modal de edición si está abierto para este elemento
  if (itemEditing === el) { closeModal('modalEditItem'); itemEditing = null; }
  el.classList.add('removing');
  setTimeout(() => {
    el.remove();
    const remaining = document.querySelectorAll('#listaCompl .list-item').length;
    if (!remaining) {
      document.getElementById('emptyState').style.display = 'flex';
      document.getElementById('editHint').classList.remove('visible');
    }
    saveList();
  }, 200);
}

function agregarALista(valor, guardar = true, done = false, tag = null) {
  const lista  = document.getElementById('listaCompl');
  const empty  = document.getElementById('emptyState');
  const hint   = document.getElementById('editHint');
  const canEdit = !getActiveList().isDefault;

  // Duplicados
  const dup = [...lista.querySelectorAll('.list-item')].find(
    el => el.dataset.valor?.toLowerCase().trim() === valor.toLowerCase().trim()
  );
  if (dup) { toast(`"${valor}" ya está en la lista`); return; }

  empty.style.display = 'none';
  if (canEdit) hint.classList.add('visible');
  lista.appendChild(createListItem(valor, done, tag, canEdit));
  if (guardar) saveList();
  else updateProgress();
}

function loadList(id) {
  const items = getLS(KEY_ITEMS(id));
  if (items.length) document.getElementById('emptyState').style.display = 'none';
  const canEdit = !getActiveList().isDefault;
  if (items.length && canEdit) document.getElementById('editHint').classList.add('visible');
  items.forEach(({ nombre, done, tag }) => agregarALista(nombre, false, done, tag || null));
  updateProgress();
}

/* ══════════════════════════════════════════
   MODAL: EDITAR ITEM DE LISTA PERSONALIZADA
   ══════════════════════════════════════════ */
function openItemEditModal(el) {
  itemEditing     = el;
  tagEditSelected = el.dataset.tag || '';
  document.getElementById('inputEditItem').value = el.dataset.valor;
  renderTagSelectorRow(tagEditSelected);
  openModal('modalEditItem');
  setTimeout(() => document.getElementById('inputEditItem').focus(), 340);
}

function renderTagSelectorRow(currentTag) {
  const row = document.getElementById('tagSelectorRow');
  row.innerHTML = '';
  TAG_OPTIONS.forEach(opt => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tag-selector-btn'
      + (opt.value === currentTag ? ' selected' : '')
      + (opt.value ? ` ${opt.value}` : '');
    btn.innerHTML = `<span class="tag-emoji">${opt.emoji}</span>${opt.label}`;
    btn.addEventListener('click', () => {
      tagEditSelected = opt.value;
      row.querySelectorAll('.tag-selector-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
    row.appendChild(btn);
  });
}

document.getElementById('saveEditItem').addEventListener('click', () => {
  if (!itemEditing) return;
  const newName = document.getElementById('inputEditItem').value.trim();
  if (!newName) { toast('Escribe un nombre'); return; }

  // Actualizar nombre en DOM
  const nameEl = itemEditing.querySelector('.item-name');
  if (nameEl) nameEl.textContent = newName;
  itemEditing.dataset.valor = newName;
  itemEditing.dataset.tag   = tagEditSelected;

  // Actualizar badge de etiqueta
  let badge = itemEditing.querySelector('.item-tag');
  if (tagEditSelected) {
    if (!badge) {
      badge = document.createElement('span');
      // Insertar antes del final (no hay item-del en custom lists, así que al final)
      itemEditing.appendChild(badge);
    }
    badge.className = `item-tag ${tagEditSelected}`;
    badge.textContent = tagEditSelected === 'importante' ? 'Importante' : 'Urgente';
  } else {
    badge?.remove();
  }

  saveList();
  closeModal('modalEditItem');
  toast('Elemento actualizado ✓');
  itemEditing = null; tagEditSelected = '';
});

document.getElementById('deleteEditItem').addEventListener('click', () => {
  if (!itemEditing) { closeModal('modalEditItem'); return; }
  const el = itemEditing;
  itemEditing = null; tagEditSelected = '';
  closeModal('modalEditItem');
  setTimeout(() => removeListItem(el), 80); // pequeño delay para que el modal cierre primero
});

document.getElementById('inputEditItem').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('saveEditItem').click();
});

/* ══════════════════════════════════════════
   PROGRESO
   ══════════════════════════════════════════ */
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
(function() {
  const days   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const d = new Date();
  document.getElementById('headerDate').textContent =
    `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
})();

/* ══════════════════════════════════════════
   EVENT LISTENERS
   ══════════════════════════════════════════ */

// Drawer
document.getElementById('btnHamburger').addEventListener('click', openDrawer);
document.getElementById('drawerClose').addEventListener('click', closeDrawer);
document.getElementById('drawerBackdrop').addEventListener('click', closeDrawer);

// Crear lista
document.getElementById('btnCreateList').addEventListener('click', () => { closeDrawer(); openCreateListModal(); });
document.getElementById('cancelCreateList').addEventListener('click', () => closeModal('modalCreateList'));
document.getElementById('inputListName').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('confirmCreateList').click(); });
document.getElementById('confirmCreateList').addEventListener('click', () => {
  const name = document.getElementById('inputListName').value.trim();
  if (!name) { toast('Escribe un nombre para la lista'); return; }
  const id = createList(name, selectedEmoji);
  closeModal('modalCreateList');
  toast(`"${name}" creada ✓`);
  switchList(id);
});

// Eliminar lista
document.getElementById('cancelDeleteList').addEventListener('click', () => { listToDelete = null; closeModal('modalDeleteList'); });
document.getElementById('confirmDeleteList').addEventListener('click', () => {
  if (!listToDelete) return;
  const name = listToDelete.name;
  deleteList(listToDelete.id);
  listToDelete = null;
  closeModal('modalDeleteList');
  toast(`"${name}" eliminada`);
});

// Añadir item al list
document.getElementById('btnagrmasinpt').addEventListener('click', () => {
  const inp = document.getElementById('inptagrmas');
  const val = inp.value.trim();
  if (!val) return;
  agregarALista(val, true, false, selectedTag || null);
  inp.value = '';
  resetTagStrip(); // Resetear etiqueta después de añadir
  toast(`"${val}" añadido`);
});
document.getElementById('inptagrmas').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('btnagrmasinpt').click(); });

// Limpiar lista
document.getElementById('btnClear').addEventListener('click', () => openModal('modalConfirm'));
document.getElementById('cancelClear').addEventListener('click', () => closeModal('modalConfirm'));
document.getElementById('confirmClear').addEventListener('click', () => {
  document.querySelectorAll('#listaCompl .list-item').forEach(el => el.remove());
  setLS(KEY_ITEMS(activeListId), []);
  document.getElementById('emptyState').style.display = 'flex';
  document.getElementById('editHint').classList.remove('visible');
  updateProgress();
  closeModal('modalConfirm');
  toast('Lista terminada 🎉');
});

// Copiar lista
document.getElementById('btnCopy').addEventListener('click', () => {
  const items = [...document.querySelectorAll('#listaCompl .list-item')];
  if (!items.length) { toast('La lista está vacía'); return; }
  const list = getActiveList();
  const text = `${list.emoji} ${list.name}\n\n`
    + items.map(el => {
        const tag = el.dataset.tag ? ` [${el.dataset.tag === 'importante' ? '⭐' : '🔴'}]` : '';
        return (el.classList.contains('done') ? '✓ ' : '☐ ') + el.dataset.valor + tag;
      }).join('\n');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => toast('Lista copiada 📋')).catch(() => fallbackCopy(text));
  } else { fallbackCopy(text); }
});

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;pointer-events:none';
  document.body.appendChild(ta);
  ta.focus(); ta.select();
  try { document.execCommand('copy'); toast('Lista copiada 📋'); } catch { toast('No se pudo copiar'); }
  ta.remove();
}

// Cerrar modales al tocar el backdrop
['modalAgregar','modalEditar','modalEditItem','modalConfirm','modalCreateList','modalDeleteList'].forEach(id => {
  document.getElementById(id).addEventListener('click', e => { if (e.target.id === id) closeModal(id); });
});

/* ══════════════════════════════════════════
   INIT
   ══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initLists();
  initTagStrip();

  const list = getActiveList();
  const isDefault = !!list.isDefault;

  document.getElementById('headerEmoji').textContent = list.emoji;
  document.getElementById('headerTitle').textContent = list.name;
  document.getElementById('listTitle').textContent   = list.name;

  document.getElementById('savedSection').style.display = isDefault ? '' : 'none';
  document.getElementById('mainDivider').style.display  = isDefault ? '' : 'none';

  if (!isDefault) {
    document.getElementById('tagStrip').classList.add('visible');
    document.getElementById('emptyIcon').textContent = list.emoji;
    document.getElementById('emptyDesc').textContent = 'Añade elementos usando el campo de abajo';
  }

  setupAccordion('acc1');
  setupAccordion('acc2');
  loadSaved(KEY_REC1, 'articulos1', 'badge1');
  loadSaved(KEY_REC2, 'articulos2', 'badge2');
  loadList(activeListId);
});
