import { HashRouter, Navigate, useParams, useRoutes } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';


import BackNav from './components/navbar';
import QrSearchHandler from './components/QrSearchHandler';
import AuthRoute from './hooks/AuthRoute';
import LazyLoadErrorBoundary from './components/LazyLoadErrorBoundary';
import LazyLoadingFallback from './components/LazyLoadingFallback';

import { FirestoreProvider } from './context/firestoreContext';
import { OrderProvider } from './context/OrderContext';
import { initializeDB } from './db/indexedDB';
import { initializeSyncScheduler } from './services/syncScheduler';
import { startSyncWorker } from './services/syncWorker';

// Lazy load de páginas
const Inventory = lazy(() => import('./pages/Inventory'));
const Cart = lazy(() => import('./pages/Cart'));
const Orders = lazy(() => import('./pages/Orders'));
const NewOrder = lazy(() => import('./pages/NewOrder'));
const SelectProducts = lazy(() => import('./pages/Select-products'));
const SelectProductAmount = lazy(() => import('./modals/SelectProductAmount'));
const SuccededOrder = lazy(() => import('./pages/Succeded-order'));
const ProductVerification = lazy(() => import('./pages/ProductsVerification'));
const LocalOrderVerification = lazy(() => import('./pages/LocalOrderVerification'));
const Inbox = lazy(() => import('./pages/inbox'));
const EarningsDetails = lazy(() => import('./pages/inbox/EarningsDetails'));
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Product = lazy(() => import('./pages/Products'));
const MigrationRunner = lazy(() => import('./pages/MigrationRunner'));
const SyncDebug = lazy(() => import('./pages/SyncDebug'));
const SearchPage = lazy(() => import('./pages/Search'));
const TeamNotesPage = lazy(() => import('./pages/TeamNotesPage'));
const MiCompra = lazy(() => import('./pages/MiCompra'));

function AppRouter() {
  let router = useRoutes([
    { path: '/', element: <Home /> },
    { path: '/home', element: <Home /> },
    { path: '/inventory', element: <Inventory /> },
    { path: '/cart', element: <Cart /> },
    { path: '/product/:id', element: <Product /> },
    { path: '/orders', element: <Orders /> },
    { path: '/ProductsVerification/:orderId', element: <ProductVerification /> },
    { path: '/local-order-verification/:orderId', element: <LocalOrderVerification /> },
    { path: '/new-order', element: <NewOrder /> },
    { path: '/Select-products', element: <SelectProducts /> },
    { path: '/select-product-amount/:id', element: <SelectProductAmount /> },
    { path: '/qrsearch', element: <QrSearchHandler /> },
    { path: '/succeeded-order/:id', element: <SuccededOrder /> },
    { path: '/inbox', element: <Inbox /> },
    { path: '/inbox/earnings/:scope/:period', element: <EarningsDetails /> },
    { path: '/inbox/earnings/:period', element: <LegacyEarningsRedirect /> },
    { path: '/login', element: <Login /> },
    { path: '/migration-runner', element: <MigrationRunner /> },
    { path: '/sync-debug', element: <SyncDebug /> },
    { path: '/search', element: <SearchPage /> },
    { path: '/team-notes', element: <TeamNotesPage /> },
    // Ruta PÚBLICA - para que clientes vean su compra (no requiere login)
    { path: '/mi-compra/:orderId', element: <MiCompra /> },
  ]);
  return router;
}

function LegacyEarningsRedirect() {
  const { period } = useParams();
  return <Navigate replace to={`/inbox/earnings/total/${period}`} />;
}

export default function App() {
  // Initialize IndexedDB and sync services when app loads (non-blocking)
  useEffect(() => {
    // Run in background, don't block rendering
    const initServices = async () => {
      try {
        // Step 1: Initialize IndexedDB
        await initializeDB();
        console.log('✅ IndexedDB initialized');

        // Step 2: Initialize sync scheduler (handles automatic sync triggers)
        await initializeSyncScheduler();
        console.log('✅ Sync scheduler initialized');

        // Step 3: Start sync worker (processes background sync queue)
        startSyncWorker();
        console.log('✅ Sync worker started');
      } catch (error) {
        console.error('Failed to initialize services:', error);
      }
    };

    // Defer initialization slightly to not block initial render
    const timer = setTimeout(() => {
      initServices();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <HashRouter>
      <FirestoreProvider>
        <OrderProvider>
          <BackNav />
          <AuthRoute>
            <LazyLoadErrorBoundary>
              <Suspense fallback={<LazyLoadingFallback />}>
                <AppRouter />
              </Suspense>
            </LazyLoadErrorBoundary>
          </AuthRoute>
        </OrderProvider>
      </FirestoreProvider>
    </HashRouter>
  );
}
