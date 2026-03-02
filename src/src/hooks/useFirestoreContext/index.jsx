import { useContext } from 'react';
import { FirestoreContext } from '../../context/firestoreContext';

function useFirestoreContext() {
    const context = useContext(FirestoreContext);
    if (!context) {
      throw new Error('useFirestoreProvider must be used within a useFirestoreProvider');
    }
    return context;
}

export default useFirestoreContext;