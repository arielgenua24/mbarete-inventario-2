// firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from '../firebaseConfig'; // Importa tu configuración

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Obtener servicios
const auth = getAuth(app);
const db = getFirestore(app);

// Exportar servicios
export { auth, db };