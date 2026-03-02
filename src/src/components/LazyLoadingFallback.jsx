/**
 * Loading fallback for lazy-loaded routes
 *
 * Shows a friendly loading indicator while React lazy() loads the component
 */
function LazyLoadingFallback() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px'
      }}>
        {/* Loading spinner */}
        <div style={{
          width: '50px',
          height: '50px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #0E6FFF',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />

        <p style={{
          color: '#666',
          fontSize: '16px',
          fontWeight: '500'
        }}>
          Cargando...
        </p>
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}

export default LazyLoadingFallback;
