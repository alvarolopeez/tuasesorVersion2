import { initializeApp } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, doc, deleteDoc, updateDoc, serverTimestamp, orderBy, query } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyA78OwJGC3Wt3l8UOBvH4tqEom8W4o3qII",
    authDomain: "web-alvaro-inmo.firebaseapp.com",
    projectId: "web-alvaro-inmo",
    storageBucket: "web-alvaro-inmo.firebasestorage.app", // <-- ESTA ES LA LÍNEA CORRECTA
    messagingSenderId: "380224636452",
    appId: "1:380224636452:web:def2556143a2a0423ffab1"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// GLOBAL UI ELEMENTS
const loginContainer = document.getElementById('login-container');
const adminPanel = document.getElementById('admin-panel');
const loginForm = document.getElementById('login-form');
const logoutButton = document.getElementById('logout-button');
const loginError = document.getElementById('login-error');
const adminEmail = document.getElementById('admin-email');
const sidebarNav = document.getElementById('sidebar-nav');
const sectionTitle = document.getElementById('section-title');
const sections = document.querySelectorAll('.section-content');

// BLOG EDITOR ELEMENTS
const editorRichContainer = document.getElementById('editor-rich-container');
const editorHtmlContainer = document.getElementById('editor-html-container');
const editorModeRichBtn = document.getElementById('editor-mode-rich');
const editorModeHtmlBtn = document.getElementById('editor-mode-html');
const htmlTextArea = document.getElementById('post-html-editor');

// QUILL EDITOR INIT
let propertyQuill, postQuill;
const propertyQuillEditorEl = document.getElementById('property-quill-editor');
if (propertyQuillEditorEl) { propertyQuill = new Quill(propertyQuillEditorEl, { theme: 'snow' }); }
const postQuillEditorEl = document.getElementById('post-quill-editor');
if (postQuillEditorEl) { postQuill = new Quill(postQuillEditorEl, { theme: 'snow' }); }

// === NUEVOS ELEMENTOS GLOBALES DEL EDITOR DE VALORACIÓN ===
const mapEditorEl = document.getElementById('map-editor');
const zoneModal = document.getElementById('zone-modal');
const closeZoneModalBtn = document.getElementById('close-zone-modal-btn');
const zoneForm = document.getElementById('zone-form');
const zoneListContainer = document.getElementById('zone-list-container');

let map;
let drawnItems; // Capa para guardar los dibujos de polígonos

// Coordenadas iniciales centradas en Sevilla (Macarena)
const SEVILLE_COORDS = [37.4045, -5.9873];

function navigateToSection(sectionName) {
    sections.forEach(s => s.classList.add('hidden'));
    const sectionElement = document.getElementById(`${sectionName}-section`);
    if (sectionElement) sectionElement.classList.remove('hidden');
    let title = sectionName.charAt(0).toUpperCase() + sectionName.slice(1);
    if (sectionName === 'valuations') title = 'Solicitudes Valoración';
    if (sectionName === 'buyers') title = 'Contactos Compradores';
    sectionTitle.textContent = title;
    sidebarNav.querySelector('.active')?.classList.remove('active');
    const navLink = sidebarNav.querySelector(`[data-section="${sectionName}"]`);
    if (navLink) navLink.classList.add('active');
    const fetchMap = { properties: fetchProperties, reviews: fetchReviews, blog: fetchPosts, valuations: fetchValuations, buyers: fetchBuyers };
    if (fetchMap[sectionName]) fetchMap[sectionName]();
    // Si la sección es la configuración de valoración, inicializar el mapa
    if (sectionName === 'valuation-config' && mapEditorEl && !map) {
        initMapEditor();
    }
}

// FETCH FUNCTIONS
const fetchProperties = async () => {
    const tableBody = document.getElementById('properties-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center">Cargando...</td></tr>';
    try {
        const q = query(collection(db, "properties"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        tableBody.innerHTML = '';
        if (snapshot.empty) { tableBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center">No hay inmuebles.</td></tr>'; return; }
        snapshot.forEach((docSnap) => {
            const p = { id: docSnap.id, ...docSnap.data() };
            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-gray-50';
            row.innerHTML = `<td class="p-2 font-semibold">${p.title || 'Sin título'}</td>
											 <td class="p-2">${p.price?.toLocaleString?.('es-ES') || p.price || ''} €</td>
											 <td class="p-2 capitalize">${p.operation || ''}</td>
											 <td class="p-2 space-x-2">
												 <button class="edit-btn text-sm text-blue-600 hover:underline">Editar</button>
												 <button class="delete-btn text-sm text-red-600 hover:underline">Borrar</button>
											 </td>`;
            row.querySelector('.edit-btn').onclick = () => openPropertyModal(p);
            row.querySelector('.delete-btn').onclick = () => deleteProperty(p);
            tableBody.appendChild(row);
        });
    } catch (err) {
        console.error("Error cargando inmuebles:", err);
        tableBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-red-500">Error cargando inmuebles.</td></tr>';
    }
};

const fetchReviews = async () => {
    const tableBody = document.getElementById('reviews-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="5" class="p-4 text-center">Cargando...</td></tr>';
    function renderStars(rating) { let stars = ''; for (let i = 1; i <= 5; i++) { stars += `<span class="star ${i <= rating ? 'filled' : ''}">★</span>`; } return `<div class="star-rating">${stars}</div>`; }
    try {
        const q = query(collection(db, "reviews"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        tableBody.innerHTML = '';
        if (snapshot.empty) { tableBody.innerHTML = '<tr><td colspan="5" class="p-4 text-center">No hay reseñas.</td></tr>'; return; }
        snapshot.forEach(docSnap => {
            const r = { id: docSnap.id, ...docSnap.data() };
            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-gray-50';
            row.innerHTML = `<td class="p-2 font-semibold">${r.name}</td>
											<td class="p-2">${renderStars(r.rating)}</td>
											<td class="p-2 text-sm text-gray-600 max-w-sm truncate">${r.text}</td>
											<td class="p-2"><label class="switch"><input type="checkbox" class="approved-toggle" data-id="${r.id}" ${r.approved ? 'checked' : ''}><span class="slider"></span></label></td>
											<td class="p-2 space-x-2"><button class="edit-btn text-sm text-blue-600 hover:underline">Editar</button><button class="delete-btn text-sm text-red-600 hover:underline">Borrar</button></td>`;
            row.querySelector('.edit-btn').onclick = () => openReviewModal(r);
            row.querySelector('.delete-btn').onclick = () => deleteReview(r);
            row.querySelector('.approved-toggle').onchange = (e) => toggleApproved(r.id, e.target.checked);
            tableBody.appendChild(row);
        });
    } catch (err) { console.error(err); tableBody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-red-500">Error cargando reseñas.</td></tr>'; }
};

const fetchPosts = async () => {
    const tableBody = document.getElementById('posts-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="3" class="p-4 text-center">Cargando...</td></tr>';
    try {
        const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        tableBody.innerHTML = '';
        if (snapshot.empty) { tableBody.innerHTML = '<tr><td colspan="3" class="p-4 text-center">No hay entradas.</td></tr>'; return; }
        snapshot.forEach((docSnap) => {
            const p = { id: docSnap.id, ...docSnap.data() };
            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-gray-50';
            const date = p.createdAt?.toDate?.().toLocaleDateString('es-ES') || 'N/A';
            row.innerHTML = `<td class="p-2 font-semibold">${p.title}</td><td class="p-2">${date}</td><td class="p-2 space-x-2"><button class="edit-btn text-sm text-blue-600 hover:underline">Editar</button><button class="delete-btn text-sm text-red-600 hover:underline">Borrar</button></td>`;
            row.querySelector('.edit-btn').onclick = () => openPostModal(p);
            row.querySelector('.delete-btn').onclick = () => deletePost(p);
            tableBody.appendChild(row);
        });
    } catch (err) { console.error(err); tableBody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-red-500">Error cargando entradas.</td></tr>'; }
};

const fetchValuations = async () => {
    const tableBody = document.querySelector('#valuations-table tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center">Cargando...</td></tr>';
    try {
        const q = query(collection(db, "solicitudesValoracion"), orderBy("fechaSolicitud", "desc"));
        const snapshot = await getDocs(q);
        tableBody.innerHTML = '';
        if (snapshot.empty) { tableBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center">No hay solicitudes de valoración.</td></tr>'; return; }
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const row = document.createElement('tr');
            row.className = 'border-b';
            const date = data.fechaSolicitud?.toDate?.().toLocaleString('es-ES') || 'N/A';
            const messageHtml = `<p><strong>Dirección:</strong> ${data.direccion || 'N/A'}</p><p><strong>Ciudad:</strong> ${data.ciudad || ''} (${data.codigoPostal || ''})</p><p class="mt-2 text-gray-600">${data.descripcion || 'N/A'}</p>`;
            row.innerHTML = `<td class="p-2 font-semibold align-top">${data.nombre || '—'}</td>
											 <td class="p-2 align-top">${data.email || ''}<br>${data.telefono || ''}</td>
											 <td class="p-2 align-top">${messageHtml}</td>
											 <td class="p-2 align-top">${date}</td>`;
            tableBody.appendChild(row);
        });
    } catch (err) { console.error("Error cargando valoraciones:", err); tableBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-red-500">Error cargando las solicitudes.</td></tr>'; }
};

const fetchBuyers = async () => {
    const tableBody = document.querySelector('#buyers-table tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="3" class="p-4 text-center">Cargando...</td></tr>';
    try {
        const q = query(collection(db, "contactosCompradores"), orderBy("fechaRegistro", "desc"));
        const snapshot = await getDocs(q);
        tableBody.innerHTML = '';
        const tableHead = document.querySelector('#buyers-table thead tr');
        if (tableHead) { tableHead.innerHTML = `<th class="p-2 font-semibold text-left">Nombre</th><th class="p-2 font-semibold text-left">Email / Teléfono</th><th class="p-2 font-semibold text-left">Fecha de Registro</th>`; }
        if (snapshot.empty) { tableBody.innerHTML = '<tr><td colspan="3" class="p-4 text-center">No hay contactos de compradores.</td></tr>'; return; }
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const row = document.createElement('tr');
            row.className = 'border-b';
            const date = data.fechaRegistro?.toDate?.().toLocaleString('es-ES') || 'N/A';
            row.innerHTML = `<td class="p-2 font-semibold">${data.nombre || '—'}</td>
											 <td class="p-2">${data.email || ''}<br>${data.telefono || ''}</td>
											 <td class="p-2">${date}</td>`;
            tableBody.appendChild(row);
        });
    } catch (err) { console.error("Error cargando compradores:", err); tableBody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-red-500">Error cargando los contactos.</td></tr>'; }
};

// AUTH STATE
onAuthStateChanged(auth, (user) => {
    if (user) {
        if (user.email === 'alvarodrop65@gmail.com') {
            loginContainer.style.display = 'none';
            adminPanel.style.display = 'block';
            adminEmail.textContent = user.email || '';
            navigateToSection('dashboard');
        } else {
            alert("Acceso denegado. No tienes permisos para acceder a este panel.");
            signOut(auth);
        }
    } else {
        loginContainer.style.display = 'flex';
        adminPanel.style.display = 'none';
    }
});

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    loginError.textContent = '';
    signInWithEmailAndPassword(auth, email, password).catch((err) => {
        console.error(err); loginError.textContent = 'Error: Email o contraseña incorrectos.';
    });
});

logoutButton.addEventListener('click', () => signOut(auth));

sidebarNav.addEventListener('click', (e) => {
    if (e.target.tagName === 'A' && e.target.dataset.section) { e.preventDefault(); navigateToSection(e.target.dataset.section); }
});

// ======================================================
// === LÓGICA DEL EDITOR DE ZONAS DE VALORACIÓN (VMS) ===
// ======================================================

function initMapEditor() {
    if (!mapEditorEl) return;
    
    // 1. Inicializar Mapa Leaflet
    map = L.map('map-editor').setView(SEVILLE_COORDS, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    // 2. Inicializar Dibujo (Leaflet.draw)
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
        edit: {
            featureGroup: drawnItems
        },
        draw: {
            polygon: {
                allowIntersection: false,
                drawError: {
                    color: '#e11d48',
                    message: '¡Error! No puedes cruzar las líneas del polígono.'
                },
                shapeOptions: {
                    color: '#22c55e' // Verde de zona
                }
            },
            marker: false,
            polyline: false,
            circle: false,
            rectangle: false,
            circlemarker: false
        }
    });
    map.addControl(drawControl);
    
    // 3. EVENTOS DE DIBUJO
    
    // Cuando el usuario ha terminado de dibujar un polígono
    map.on(L.Draw.Event.CREATED, (e) => {
        const layer = e.layer;
        drawnItems.addLayer(layer);
        
        // Convertir la geometría del polígono a formato GeoJSON para guardar
        const geoJson = layer.toGeoJSON();
        
        // Abrir modal de configuración
        openZoneModal(null, geoJson);
    });
    
    // Cuando se borra un polígono (desde el mapa)
    map.on(L.Draw.Event.DELETED, (e) => {
        e.layers.eachLayer(async (layer) => {
            const zoneId = layer.options.zoneId;
            if (zoneId) {
                if (confirm(`¿Seguro que quieres borrar la zona ${layer.options.zoneName}?`)) {
                    await deleteZone(zoneId);
                } else {
                    // Si cancela, volvemos a añadir la capa (es un truco, ya que Leaflet la borra automáticamente)
                    drawnItems.addLayer(layer); 
                }
            }
        });
    });

    // Cargar las zonas existentes
    fetchValuationZones(true);
}

// -------------------------------------------------------------------
// FIREBASE CRUD ZONAS
// -------------------------------------------------------------------

const openZoneModal = (zone = null, geoJson = null) => {
    zoneForm.reset();
    document.getElementById('zone-modal-title').textContent = zone ? 'Editar Zona: ' + zone.name : 'Nueva Zona';
    
    if (zone) {
        document.getElementById('zone-id').value = zone.id;
        document.getElementById('zone-name').value = zone.name;
        document.getElementById('base-price').value = zone.basePrice;
        document.getElementById('avg-sqm').value = zone.avgSqm || '';
        document.getElementById('corr-elevator').value = zone.modifiers.elevator || '';
        document.getElementById('corr-garage').value = zone.modifiers.garage || '';
        document.getElementById('corr-reformar').value = zone.modifiers.reformar || '';
        document.getElementById('corr-reformado').value = zone.modifiers.reformado || '';
        document.getElementById('zone-geometry').value = JSON.stringify(zone.geometry);
    } else if (geoJson) {
        // Nueva zona dibujada
        document.getElementById('zone-id').value = '';
        document.getElementById('zone-geometry').value = JSON.stringify(geoJson);
    }

    zoneModal.classList.remove('hidden');
};

const closeZoneModal = () => {
    zoneModal.classList.add('hidden');
    // Eliminar el polígono de la capa dibujada si el usuario cancela una nueva creación
    if (!document.getElementById('zone-id').value) {
        drawnItems.eachLayer(layer => {
            // Buscamos la capa sin ID (la que acaba de dibujar) y la borramos
            if (!layer.options.zoneId) {
                drawnItems.removeLayer(layer);
            }
        });
    }
    fetchValuationZones(true);
};

closeZoneModalBtn?.addEventListener('click', closeZoneModal);
document.getElementById('cancel-zone-btn')?.addEventListener('click', closeZoneModal);

zoneForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveButton = document.getElementById('save-zone-btn');
    saveButton.disabled = true; saveButton.textContent = 'Guardando...';

    try {
        const id = document.getElementById('zone-id').value;
        const geometry = JSON.parse(document.getElementById('zone-geometry').value);

        const zoneData = {
            name: document.getElementById('zone-name').value,
            basePrice: parseFloat(document.getElementById('base-price').value) || 0,
            avgSqm: parseInt(document.getElementById('avg-sqm').value) || 0,
            geometry: geometry,
            modifiers: {
                elevator: parseFloat(document.getElementById('corr-elevator').value) || 0,
                garage: parseFloat(document.getElementById('corr-garage').value) || 0,
                reformar: parseFloat(document.getElementById('corr-reformar').value) || 0,
                reformado: parseFloat(document.getElementById('corr-reformado').value) || 0
            },
            updatedAt: serverTimestamp()
        };

        if (id) {
            await updateDoc(doc(db, "zonas_valoracion", id), zoneData);
        } else {
            zoneData.createdAt = serverTimestamp();
            await addDoc(collection(db, "zonas_valoracion"), zoneData);
        }

        closeZoneModal();
        alert('Zona guardada correctamente.');
    } catch (error) {
        console.error("Error al guardar zona:", error);
        alert("Error al guardar zona: " + (error.message || error));
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Guardar Zona';
    }
});

const deleteZone = async (id) => {
    try {
        await deleteDoc(doc(db, "zonas_valoracion", id));
        alert('Zona borrada correctamente.');
        fetchValuationZones(true);
    } catch (err) {
        console.error("Error borrando zona:", err);
        alert('Error borrando zona: ' + err.message);
    }
};

const fetchValuationZones = async (isMapInit = false) => {
    zoneListContainer.innerHTML = '<p id="loading-zones" class="text-center text-gray-500">Cargando zonas...</p>';
    if (isMapInit && drawnItems) {
        drawnItems.clearLayers();
    }
    
    try {
        const q = query(collection(db, "zonas_valoracion"), orderBy("basePrice", "desc"));
        const snapshot = await getDocs(q);
        
        zoneListContainer.innerHTML = '';
        if (snapshot.empty) {
            zoneListContainer.innerHTML = '<p class="text-center text-gray-500">Aún no hay zonas creadas.</p>';
            return;
        }

        const listDiv = document.createElement('div');
        listDiv.className = 'space-y-3';

        snapshot.forEach((docSnap) => {
            const z = { id: docSnap.id, ...docSnap.data() };
            const geometry = z.geometry.geometry.coordinates[0];
            
            // 1. DIBUJAR EN EL MAPA
            const polygon = L.polygon(geometry.map(coord => [coord[1], coord[0]]), {
                color: '#22c55e',
                weight: 3,
                opacity: 0.7,
                fillOpacity: 0.3,
                zoneId: z.id, // Guardamos el ID de Firebase en la capa
                zoneName: z.name
            }).addTo(drawnItems);
            
            // Permitir edición/borrado de la capa dibujada
            polygon.editing.enable();
            
            // 2. CREAR LISTA VISUAL
            const item = document.createElement('div');
            item.className = 'flex justify-between items-center p-3 bg-gray-50 rounded-md border';
            item.innerHTML = `
                <div>
                    <p class="font-semibold text-gray-800">${z.name}</p>
                    <p class="text-sm text-gray-600">${z.basePrice.toLocaleString('es-ES')} €/m² | Modificadores: ${Object.keys(z.modifiers).length}</p>
                </div>
                <div class="space-x-2">
                    <button data-id="${z.id}" data-action="edit" class="text-sm text-blue-600 hover:underline">Editar</button>
                    <button data-id="${z.id}" data-action="delete" class="text-sm text-red-600 hover:underline">Borrar</button>
                </div>
            `;
            
            item.querySelector('[data-action="edit"]').onclick = () => openZoneModal(z);
            item.querySelector('[data-action="delete"]').onclick = () => {
                if(confirm(`¿Seguro que quieres borrar la zona "${z.name}"?`)) {
                    deleteZone(z.id);
                }
            };
            
            listDiv.appendChild(item);
        });

        zoneListContainer.appendChild(listDiv);
    } catch (err) {
        console.error("Error cargando zonas de valoración:", err);
        zoneListContainer.innerHTML = '<p class="text-center text-red-500">Error cargando zonas.</p>';
    }
};

// MODALS & CRUD
const propertyModal = document.getElementById('property-modal');
const propertyForm = document.getElementById('property-form');
const addPropertyBtn = document.getElementById('add-property-btn');
let currentImageFiles = [];
let originalImageUrls = [];

const openPropertyModal = (property = null) => {
    if (!propertyForm) return;
    propertyForm.reset();
    if (propertyQuill) propertyQuill.root.innerHTML = '';
    const imagePreviews = document.getElementById('image-previews');
    if (imagePreviews) imagePreviews.innerHTML = '';
    currentImageFiles = [];
    originalImageUrls = [];
    const imagesInput = document.getElementById('images');
    if (imagesInput) imagesInput.value = '';
    if (property) {
        document.getElementById('modal-title').textContent = 'Editar Inmueble';
        document.getElementById('property-id').value = property.id;
        ['title', 'price', 'sqm', 'beds', 'baths', 'tag', 'operation', 'type'].forEach(f => { const el = document.getElementById(f); if (el) el.value = property[f] || ''; });
        if (propertyQuill) propertyQuill.root.innerHTML = property.description || '';
        if (property.images) {
            originalImageUrls = [...property.images];
            currentImageFiles = property.images.map(url => ({ isUrl: true, content: url }));
            renderImagePreviews();
        }
    } else {
        document.getElementById('modal-title').textContent = 'Añadir Nuevo Inmueble';
        document.getElementById('property-id').value = '';
    }
    propertyModal.classList.remove('hidden');
};
const closePropertyModal = () => propertyModal.classList.add('hidden');
addPropertyBtn?.addEventListener('click', () => openPropertyModal());
document.getElementById('close-modal-btn')?.addEventListener('click', closePropertyModal);
document.getElementById('cancel-btn')?.addEventListener('click', closePropertyModal);

document.getElementById('images')?.addEventListener('change', (e) => {
    for (const file of e.target.files) currentImageFiles.push({ isUrl: false, content: file });
    e.target.value = '';
    renderImagePreviews();
});

function renderImagePreviews() {
    const container = document.getElementById('image-previews');
    if (!container) return;
    container.innerHTML = '';
    currentImageFiles.forEach((fileInfo, index) => {
        const item = document.createElement('div');
        item.className = 'preview-item border rounded-md p-1 bg-gray-100';
        const img = document.createElement('img');
        img.className = 'w-full h-24 object-cover rounded';
        const delBtn = document.createElement('span');
        delBtn.className = 'delete-img-btn';
        delBtn.innerHTML = '&times;';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            if (currentImageFiles[index].isUrl) { originalImageUrls = originalImageUrls.filter(u => u !== currentImageFiles[index].content); }
            currentImageFiles.splice(index, 1);
            renderImagePreviews();
        };
        item.append(img, delBtn);
        container.appendChild(item);
        if (fileInfo.isUrl) { img.src = fileInfo.content; } else { const reader = new FileReader(); reader.onload = e => img.src = e.target.result; reader.readAsDataURL(fileInfo.content); }
    });
}

const imagePreviewsEl = document.getElementById('image-previews');
if (imagePreviewsEl) { new Sortable(imagePreviewsEl, { animation: 150, onEnd: (evt) => { const [reorderedItem] = currentImageFiles.splice(evt.oldIndex, 1); currentImageFiles.splice(evt.newIndex, 0, reorderedItem); renderImagePreviews(); } }); }

propertyForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveButton = document.getElementById('save-property-btn');
    saveButton.disabled = true; saveButton.textContent = 'Guardando...';
    try {
        const id = document.getElementById('property-id').value;
        const uploadedImageUrls = [];
        for (const fileInfo of currentImageFiles) {
            if (fileInfo.isUrl) { uploadedImageUrls.push(fileInfo.content); }
            else { const storageRef = ref(storage, `properties/${Date.now()}_${fileInfo.content.name}`); await uploadBytes(storageRef, fileInfo.content); const url = await getDownloadURL(storageRef); uploadedImageUrls.push(url); }
        }
        const imagesToDelete = (originalImageUrls || []).filter(url => !uploadedImageUrls.includes(url));
        for (const url of imagesToDelete) { try { await deleteObject(ref(storage, url)); } catch (err) { console.warn("No se pudo borrar imagen antigua:", err); } }
        const propertyData = { title: document.getElementById('title').value, price: parseFloat(document.getElementById('price').value) || 0, sqm: parseInt(document.getElementById('sqm').value) || 0, beds: parseInt(document.getElementById('beds').value) || 0, baths: parseInt(document.getElementById('baths').value) || 0, tag: document.getElementById('tag').value || '', operation: document.getElementById('operation').value, type: document.getElementById('type').value, description: propertyQuill.root.innerHTML, images: uploadedImageUrls, updatedAt: serverTimestamp() };
        if (id) { await updateDoc(doc(db, "properties", id), propertyData); } else { propertyData.createdAt = serverTimestamp(); await addDoc(collection(db, "properties"), propertyData); }
        closePropertyModal(); await fetchProperties();
    } catch (error) { console.error(error); alert("Error al guardar: " + (error.message || error)); }
    finally { saveButton.disabled = false; saveButton.textContent = 'Guardar'; }
});

const deleteProperty = async (property) => {
    if (!confirm(`¿Seguro que quieres borrar "${property.title}"?`)) return;
    try {
        if (property.images) { for (const url of property.images) { try { await deleteObject(ref(storage, url)); } catch (err) { console.warn("No se pudo borrar imagen:", err); } } }
        await deleteDoc(doc(db, "properties", property.id)); await fetchProperties();
    } catch (err) { console.error(err); alert('Error borrando propiedad: ' + (err.message || err)); }
};

// Reviews Modal
const reviewModal = document.getElementById('review-modal');
const reviewFormCms = document.getElementById('review-form-cms');
const addReviewBtnCms = document.getElementById('add-review-btn-cms');
const openReviewModal = (review = null) => { reviewFormCms.reset(); if (review) { document.getElementById('review-modal-title').textContent = 'Editar Reseña'; document.getElementById('review-id').value = review.id; document.getElementById('review-name-cms').value = review.name; document.getElementById('review-rating-cms').value = review.rating; document.getElementById('review-text-cms').value = review.text; document.getElementById('review-approved-cms').checked = review.approved; } else { document.getElementById('review-modal-title').textContent = 'Añadir Nueva Reseña'; document.getElementById('review-id').value = ''; document.getElementById('review-approved-cms').checked = true; } reviewModal.classList.remove('hidden'); };
const closeReviewModal = () => reviewModal.classList.add('hidden');
addReviewBtnCms?.addEventListener('click', () => openReviewModal());
document.getElementById('close-review-modal-btn')?.addEventListener('click', closeReviewModal);
document.getElementById('cancel-review-btn')?.addEventListener('click', closeReviewModal);

reviewFormCms?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveButton = document.getElementById('save-review-btn');
    saveButton.disabled = true; saveButton.textContent = 'Guardando...';
    try {
        const id = document.getElementById('review-id').value;
        const reviewData = { name: document.getElementById('review-name-cms').value, rating: parseInt(document.getElementById('review-rating-cms').value), text: document.getElementById('review-text-cms').value, approved: document.getElementById('review-approved-cms').checked, updatedAt: serverTimestamp() };
        if (id) { await updateDoc(doc(db, "reviews", id), reviewData); } else { reviewData.createdAt = serverTimestamp(); await addDoc(collection(db, "reviews"), reviewData); }
        closeReviewModal(); await fetchReviews();
    } catch (error) { console.error("Error guardando reseña:", error); alert("Error al guardar la reseña: " + error.message); }
    finally { saveButton.disabled = false; saveButton.textContent = 'Guardar'; }
});

const deleteReview = async (review) => { if (!confirm(`¿Seguro que quieres borrar la reseña de "${review.name}"?`)) return; try { await deleteDoc(doc(db, "reviews", review.id)); await fetchReviews(); } catch (err) { console.error(err); alert('Error borrando reseña: ' + err.message); } };
const toggleApproved = async (id, isApproved) => { try { await updateDoc(doc(db, "reviews", id), { approved: isApproved }); } catch (err) { console.error("Error al cambiar estado:", err); alert("No se pudo actualizar el estado."); fetchReviews(); } };

// Blog Post Modal
const postModal = document.getElementById('post-modal');
const postForm = document.getElementById('post-form');
const addPostBtn = document.getElementById('add-post-btn');
let postImageFile = null; let originalPostImageUrl = null;
const openPostModal = (post = null) => { if (!postForm) return; postForm.reset(); if (postQuill) postQuill.root.innerHTML = ''; const htmlEditor = document.getElementById('post-html-editor'); if (htmlEditor) htmlEditor.value = ''; const imagePreview = document.getElementById('post-image-preview'); if (imagePreview) imagePreview.innerHTML = ''; postImageFile = null; originalPostImageUrl = null; const postImageInput = document.getElementById('post-image-input'); if (postImageInput) postImageInput.value = ''; if (post) { document.getElementById('post-modal-title').textContent = 'Editar Entrada'; document.getElementById('post-id').value = post.id; document.getElementById('post-title-input').value = post.title; const content = post.contentHtml || ''; if (postQuill) postQuill.root.innerHTML = content; if (htmlEditor) htmlEditor.value = content; if (post.featuredImage) { originalPostImageUrl = post.featuredImage; if (imagePreview) imagePreview.innerHTML = `<img src="${post.featuredImage}" class="w-48 h-auto mt-2 rounded">`; } } else { document.getElementById('post-modal-title').textContent = 'Nueva Entrada de Blog'; document.getElementById('post-id').value = ''; } postModal.classList.remove('hidden'); };
const closePostModal = () => postModal.classList.add('hidden');

if (editorModeRichBtn && editorModeHtmlBtn) {
    editorModeRichBtn.addEventListener('click', () => { editorRichContainer.classList.remove('hidden'); editorHtmlContainer.classList.add('hidden'); editorModeRichBtn.classList.replace('bg-gray-200', 'bg-blue-600'); editorModeRichBtn.classList.replace('text-gray-700', 'text-white'); editorModeHtmlBtn.classList.replace('bg-blue-600', 'bg-gray-200'); editorModeHtmlBtn.classList.replace('text-white', 'text-gray-700'); if (postQuill && htmlTextArea) postQuill.root.innerHTML = htmlTextArea.value; });
    editorModeHtmlBtn.addEventListener('click', () => { editorHtmlContainer.classList.remove('hidden'); editorRichContainer.classList.add('hidden'); editorModeHtmlBtn.classList.replace('bg-gray-200', 'bg-blue-600'); editorModeHtmlBtn.classList.replace('text-gray-700', 'text-white'); editorModeRichBtn.classList.replace('bg-blue-600', 'bg-gray-200'); editorModeRichBtn.classList.replace('text-white', 'text-gray-700'); if (postQuill && htmlTextArea) htmlTextArea.value = postQuill.root.innerHTML; });
}
addPostBtn?.addEventListener('click', () => openPostModal());
document.getElementById('close-post-modal-btn')?.addEventListener('click', closePostModal);
document.getElementById('cancel-post-btn')?.addEventListener('click', closePostModal);

document.getElementById('post-image-input')?.addEventListener('change', (e) => { postImageFile = e.target.files[0]; const previewContainer = document.getElementById('post-image-preview'); previewContainer.innerHTML = ''; if (postImageFile) { const reader = new FileReader(); reader.onload = (event) => { previewContainer.innerHTML = `<img src="${event.target.result}" class="w-48 h-auto mt-2 rounded">`; }; reader.readAsDataURL(postImageFile); } });

postForm?.addEventListener('submit', async (e) => { e.preventDefault(); const saveButton = document.getElementById('save-post-btn'); saveButton.disabled = true; saveButton.textContent = 'Guardando...'; try { const id = document.getElementById('post-id').value; let imageUrl = originalPostImageUrl; if (postImageFile) { if (originalPostImageUrl) { try { await deleteObject(ref(storage, originalPostImageUrl)); } catch (err) { console.warn("Imagen antigua no encontrada:", err); } } const storageRef = ref(storage, `blog/${Date.now()}_${postImageFile.name}`); await uploadBytes(storageRef, postImageFile); imageUrl = await getDownloadURL(storageRef); } const isHtmlMode = !document.getElementById('editor-html-container').classList.contains('hidden'); const finalHtmlContent = isHtmlMode ? document.getElementById('post-html-editor').value : postQuill.root.innerHTML; const postData = { title: document.getElementById('post-title-input').value, contentHtml: finalHtmlContent, featuredImage: imageUrl || null, updatedAt: serverTimestamp() }; if (id) { await updateDoc(doc(db, "posts", id), postData); } else { postData.createdAt = serverTimestamp(); await addDoc(collection(db, "posts"), postData); } closePostModal(); await fetchPosts(); } catch (error) { console.error(error); alert("Error al guardar entrada: " + (error.message || error)); } finally { saveButton.disabled = false; saveButton.textContent = 'Guardar Entrada'; } });

const deletePost = async (post) => { if (!confirm(`¿Seguro que quieres borrar "${post.title}"?`)) return; try { if (post.featuredImage) { try { await deleteObject(ref(storage, post.featuredImage)); } catch (err) { console.warn("No se pudo borrar imagen:", err); } } await deleteDoc(doc(db, "posts", post.id)); await fetchPosts(); } catch (err) { console.error(err); alert('Error borrando entrada: ' + (err.message || err)); } };
