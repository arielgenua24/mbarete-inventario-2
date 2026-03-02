// eslint-disable-next-line react/prop-types
function LoadingComponent({isLoading}) {
  console.log(isLoading)

    const modalOverlayStyles = {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      };
      const modalContentStyles = {
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
        textAlign: 'center'
      };
      const spinnerStyles = {
        width: '32px',
        height: '32px',
        margin: '16px auto 0',
        border: '4px solid #f3f3f3',
        borderTop: '4px solid #3498db',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      };
      
      if(isLoading === true) {
        return (
            <div style={modalOverlayStyles}>
              <div style={modalContentStyles}>
                <p style={{ fontSize: '18px', color: '#333' }}>Aguarde un momento...</p>
                <div style={spinnerStyles}></div>
              </div>
            </div>
          )
      }   
}

export default LoadingComponent;