import { initializeApp } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-app.js";
import { getAuth, signInWithPhoneNumber, RecaptchaVerifier } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.16.0/firebase-firestore.js";

// --- CONFIGURACIÓN FIREBASE (Misma que en tu index.js) ---
const firebaseConfig = {
    apiKey: "AIzaSyA78OwJGC3Wt3l8UOBvH4tqEom8W4o3qII",
    authDomain: "web-alvaro-inmo.firebaseapp.com",
    projectId: "web-alvaro-inmo",
    storageBucket: "web-alvaro-inmo.firebasestorage.app",
    messagingSenderId: "380224636452",
    appId: "1:380224636452:web:def2556143a2a0423ffab1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = 'es'; // SMS en español
const db = getFirestore(app);

// --- CONFIGURACIÓN DE PRECIOS LA MACARENA ---
const PRECIOS_ZONA = {
    MACARENA_PREMIUM: 2100, // Zonas top
    MACARENA_STANDARD: 1700, // Media
    MACARENA_BASIC: 1400,    // Económico
};
// Códigos postales donde damos precio automático
const ZONAS_MACARENA = ['41003', '41008', '41009']; 

// Estado del formulario
let formData = {
    type: '',
    address: '',
    zip: '',
    city: 'Sevilla',
    sqm: 0,
    rooms: 2,
    baths: 1,
    elevator: false,
    terrace: false,
    garage: false,
    condition: 'bueno',
    contact: {}
};

window.confirmationResult = null;

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    setupRecaptcha();
});

// --- NAVEGACIÓN ENTRE PASOS ---

// Hacer funciones globales para que el HTML las vea (onclick)
window.selectOption = (field, value, nextStepNum) => {
    formData[field] = value;
    // Feedback visual
    const cards = document.querySelectorAll('.option-card');
    cards.forEach(c => {
        c.classList.remove('border-[#cf1f3e]', 'shadow-lg', 'bg-red-50');
    });
    event.currentTarget.classList.add('border-[#cf1f3e]', 'shadow-lg', 'bg-red-50');
    
    setTimeout(() => showStep(nextStepNum), 300);
};

window.adjustValue = (id, amount) => {
    const input = document.getElementById(id);
    let val = parseInt(input.value) + amount;
    if(val < 0) val = 0;
    input.value = val;
};

window.prevStep = (step) => showStep(step);
window.nextStep = (step) => showStep(step);

window.validateStep2 = () => {
    const address = document.getElementById('val-address').value;
    const zip = document.getElementById('val-zip').value;
    
    if(!address || zip.length < 5) {
        alert('Por favor completa la dirección y el código postal.');
        return;
    }
    formData.address = address;
    formData.zip = zip;
    showStep(3);
};

window.validateStep3 = () => {
    const sqm = document.getElementById('val-sqm').value;
    if(!sqm || sqm < 20) {
        alert('Por favor introduce una superficie válida (mínimo 20m²).');
        return;
    }
    formData.sqm = parseInt(sqm);
    formData.rooms = parseInt(document.getElementById('val-rooms').value);
    formData.baths = parseInt(document.getElementById('val-baths').value);
    showStep(4);
};

function showStep(step) {
    // Si vamos al paso 5 (resumen), recogemos los datos del paso 4
    if(step === 5) {
        formData.elevator = document.getElementById('feat-elevator').checked;
        formData.terrace = document.getElementById('feat-terrace').checked;
        formData.garage = document.getElementById('feat-garage').checked;
        formData.condition = document.getElementById('val-condition').value;
    }

    // Ocultar todos los pasos
    document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));
    // Mostrar el actual con animación
    const currentStepEl = document.querySelector(`.step-content[data-step="${step}"]`);
    currentStepEl.classList.remove('hidden');
    currentStepEl.classList.add('fade-in');
    
    // Actualizar barra progreso
    const progress = (step / 6) * 100;
    document.getElementById('progress-bar').style.width = `${progress}%`;
}

// --- LÓGICA SMS (FIREBASE AUTH) ---

function setupRecaptcha() {
    if(!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier('recaptcha-container', {
            'size': 'invisible',
            'callback': () => { /* Recaptcha resuelto */ }
        }, auth);
    }
}

const sendSmsBtn = document.getElementById('send-sms-btn');
if(sendSmsBtn) {
    sendSmsBtn.addEventListener('click', () => {
        const phoneInput = document.getElementById('contact-phone').value;
        const name = document.getElementById('contact-name').value;
        const email = document.getElementById('contact-email').value;
        const surname = document.getElementById('contact-surname').value;

        if(!phoneInput || !name || !email) {
            alert("Por favor completa nombre, email y teléfono.");
            return;
        }

        // Formatear teléfono para Firebase (+34...)
        const phoneNumber = "+34" + phoneInput.replace(/\s/g, '');
        const appVerifier = window.recaptchaVerifier;
        
        sendSmsBtn.disabled = true;
        sendSmsBtn.innerText = "Enviando SMS...";
        sendSmsBtn.classList.add('opacity-50');

        signInWithPhoneNumber(auth, phoneNumber, appVerifier)
            .then((confirmationResult) => {
                window.confirmationResult = confirmationResult;
                
                // UI Update
                document.getElementById('sms-code-container').classList.remove('hidden');
                sendSmsBtn.classList.add('hidden');
                document.getElementById('verify-code-btn').classList.remove('hidden');
                
                // Guardar datos contacto temporalmente
                formData.contact = { name, surname, email, phone: phoneNumber };
                
                alert("SMS enviado correctamente. Revisa tu móvil.");
            }).catch((error) => {
                console.error("Error SMS", error);
                sendSmsBtn.disabled = false;
                sendSmsBtn.innerText = "Intentar de nuevo";
                sendSmsBtn.classList.remove('opacity-50');
                alert("Error al enviar SMS. Asegúrate de que has añadido tu dominio en Firebase Console > Auth > Settings.");
            });
    });
}

const verifyCodeBtn = document.getElementById('verify-code-btn');
if(verifyCodeBtn) {
    verifyCodeBtn.addEventListener('click', () => {
        const code = document.getElementById('sms-code').value;
        if(!code) return;

        verifyCodeBtn.innerText = "Verificando...";

        window.confirmationResult.confirm(code).then((result) => {
            // Éxito: Usuario verificado
            finishProcess(true);
        }).catch((error) => {
            alert("Código incorrecto. Inténtalo de nuevo.");
            verifyCodeBtn.innerText = "VERIFICAR Y VER PRECIO";
        });
    });
}

// --- CÁLCULO Y GUARDADO ---

async function finishProcess(isVerified) {
    if(!isVerified) return;

    // 1. Calcular Precio (Algoritmo Macarena)
    const isMacarena = ZONAS_MACARENA.includes(formData.zip);
    let estimatedPriceMin = 0;
    let estimatedPriceMax = 0;

    if (isMacarena) {
        let basePrice = PRECIOS_ZONA.MACARENA_STANDARD; 
        
        // Lógica de zona (Barrios)
        if(formData.zip === '41003') basePrice = PRECIOS_ZONA.MACARENA_PREMIUM;
        
        // Lógica de Estado
        let multiplier = 1.0;
        if(formData.condition === 'reformar') multiplier = 0.75; // -25%
        if(formData.condition === 'reformado') multiplier = 1.15; // +15%

        // Lógica de Extras
        if(formData.elevator) multiplier += 0.12; // Ascensor es clave (+12%)
        if(formData.terrace) multiplier += 0.05;
        if(formData.garage) multiplier += 0.08;
        if(formData.type === 'casa') multiplier += 0.20; // Casas valen más

        const totalValue = formData.sqm * basePrice * multiplier;
        
        // Redondear a millares
        estimatedPriceMin = Math.round((totalValue * 0.95) / 1000) * 1000;
        estimatedPriceMax = Math.round((totalValue * 1.05) / 1000) * 1000;
    }

    // 2. Guardar en Firebase (Base de datos separada)
    try {
        await addDoc(collection(db, "valoraciones"), {
            ...formData,
            precioEstimado: isMacarena ? { min: estimatedPriceMin, max: estimatedPriceMax } : "Manual",
            zonaMacarena: isMacarena,
            fecha: serverTimestamp(),
            verificado: true,
            origen: "Landing Page Valoración"
        });
    } catch (e) {
        console.error("Error guardando lead", e);
    }

    // 3. Mostrar Resultado Final
    showStep(6);
    if(isMacarena) {
        document.getElementById('result-macarena').classList.remove('hidden');
        document.getElementById('price-range-display').innerText = `${estimatedPriceMin.toLocaleString('es-ES')} € - ${estimatedPriceMax.toLocaleString('es-ES')} €`;
        document.getElementById('res-email').innerText = formData.contact.email;
    } else {
        document.getElementById('result-manual').classList.remove('hidden');
    }
}