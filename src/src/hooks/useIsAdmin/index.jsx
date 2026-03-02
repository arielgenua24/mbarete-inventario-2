import { useState, useEffect } from 'react';
import useFirestoreContext from '../useFirestoreContext';

/**
 * Custom hook to check if current user is admin
 *
 * @returns {Object} - { isAdmin: boolean, isLoading: boolean }
 */
const useIsAdmin = () => {
  const { user, getAdmin } = useFirestoreContext();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      setIsLoading(true);
      try {
        const adminEmail = await getAdmin();

        // Compare current user email with admin email
        setIsAdmin(user === adminEmail);
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      checkAdmin();
    } else {
      setIsAdmin(false);
      setIsLoading(false);
    }
  }, [user, getAdmin]);

  return { isAdmin, isLoading };
};

export default useIsAdmin;
