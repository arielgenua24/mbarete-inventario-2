import React from 'react';
import useFirestore from '../hooks/useFirestore';


// Crear el contexto del carrito
const FirestoreContext = React.createContext();

// eslint-disable-next-line react/prop-types
function FirestoreProvider({children}) {
    // Llama al hook y obtén el objeto completo con todas las funciones y estados
    const firestoreData = useFirestore();

    // Pasa el objeto completo directamente al value del Provider
    return (
        <FirestoreContext.Provider value={firestoreData}>
          {children}
        </FirestoreContext.Provider>
    );
    // Ya no es necesario el try/catch aquí, el manejo de errores debe estar dentro de las funciones del hook o en los componentes que las usan.
}

export { FirestoreContext, FirestoreProvider }