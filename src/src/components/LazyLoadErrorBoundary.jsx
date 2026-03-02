import { Component } from 'react';

/**
 * Error Boundary for catching lazy loading failures
 *
 * When offline, React lazy() fails to fetch dynamic imports from Vite dev server.
 * This boundary catches those errors and shows a user-friendly message.
 */
class LazyLoadErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error) {
    // Check if this is a lazy loading error
    const isChunkError =
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('error loading dynamically imported module') ||
      error?.message?.includes('Importing a module script failed') ||
      error?.name === 'ChunkLoadError';

    if (isChunkError) {
      return {
        hasError: true,
        error: error
      };
    }

    // Re-throw other errors
    throw error;
  }

  componentDidCatch(error, errorInfo) {
    console.error('LazyLoadErrorBoundary caught error:', error, errorInfo);
  }

  handleReload = () => {
    // Clear error state and force reload
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleGoBack = () => {
    // Clear error and go back
    this.setState({ hasError: false, error: null });
    window.history.back();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '20px',
          textAlign: 'center',
          backgroundColor: '#f5f5f5'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '20px',
            padding: '40px',
            maxWidth: '500px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <h1 style={{
              color: '#FF6B6B',
              fontSize: '24px',
              marginBottom: '20px'
            }}>
              ⚠️ Error de Carga
            </h1>

            <p style={{
              color: '#666',
              fontSize: '16px',
              marginBottom: '30px',
              lineHeight: '1.5'
            }}>
              No se pudo cargar esta página. Esto puede ocurrir cuando estás sin conexión.
            </p>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <button
                onClick={this.handleReload}
                style={{
                  backgroundColor: '#0E6FFF',
                  color: 'white',
                  border: 'none',
                  padding: '15px 30px',
                  borderRadius: '20px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Intentar de Nuevo
              </button>

              <button
                onClick={this.handleGoBack}
                style={{
                  backgroundColor: '#f1f1f1',
                  color: '#333',
                  border: 'none',
                  padding: '15px 30px',
                  borderRadius: '20px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Volver Atrás
              </button>
            </div>

            {!navigator.onLine && (
              <p style={{
                marginTop: '20px',
                color: '#FF6B6B',
                fontSize: '14px',
                fontWeight: 'bold'
              }}>
                📴 Sin conexión a internet
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default LazyLoadErrorBoundary;
