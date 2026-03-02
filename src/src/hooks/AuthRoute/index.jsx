import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import useFirestoreContext from "../../hooks/useFirestoreContext";

// Rutas públicas que NO requieren autenticación
const PUBLIC_ROUTES = [
    '/login',
    '/mi-compra'  // Página pública para que clientes vean su compra
];

// Función para verificar si una ruta es pública
const isPublicRoute = (pathname) => {
    return PUBLIC_ROUTES.some(route => pathname.startsWith(route));
};

// eslint-disable-next-line react/prop-types
function AuthRoute({ children }) {
    const { user, getAdmin } = useFirestoreContext();
    const [admin, setAdmin] = useState(null); // Inicializamos admin como null o un valor que indique 'cargando'
    const [loadingAdmin, setLoadingAdmin] = useState(true); // Estado para controlar la carga de admin
    const location = useLocation();
    const navigate = useNavigate();


    useEffect(() => {
        const checkAdmin = async () => { // Función asíncrona para manejar la promesa
            setLoadingAdmin(true); // Iniciamos la carga de admin
            const adminData = await getAdmin(); // Esperamos a que la promesa se resuelva
            setAdmin(adminData); // Establecemos el estado admin con el valor resuelto
            setLoadingAdmin(false); // Finaliza la carga de admin
        };

        checkAdmin(); // Llamamos a la función asíncrona

        // Si es ruta pública, no verificar autenticación
        if (isPublicRoute(location.pathname)) {
            return;
        }

        if (!user && location.pathname !== "/login") {
            navigate("/login");
        } else if (user && location.pathname === "/login") {
            navigate("/home");
        }
    }, [user, location.pathname, navigate, getAdmin]); // Añadimos getAdmin a las dependencias

    // Si es ruta pública, renderizar directamente
    if (isPublicRoute(location.pathname)) {
        return children;
    }

    if (!user && location.pathname !== "/login") {
        return null; // No renderiza rutas protegidas si no está autenticado
    }


    if (user !== admin && location.pathname === "/inbox") { // Verificamos que admin no sea null antes de comparar
        console.log("Usuario:", user);
        console.log("Admin:", admin);
        navigate("/home");
    }


    return children;
}

export default AuthRoute;