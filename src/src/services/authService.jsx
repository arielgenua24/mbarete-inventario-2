import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../firebaseSetUp";
// Iniciar sesión
export const login = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log(userCredential.user)
    return userCredential.user;
   
  } catch (error) {
    throw new Error("Error en el inicio de sesión: " + error.message);
  }
};

// Cerrar sesión
export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    throw new Error("Error al cerrar sesión: " + error.message);
  }
};
