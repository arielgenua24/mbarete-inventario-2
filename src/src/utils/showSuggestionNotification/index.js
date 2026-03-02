// Función para mostrar la notificación
const showSuggestionNotification = () => {
    // Crear el elemento de notificación si no existe
    let notification = document.querySelector('.suggestion-input--notification');
    
    if (!notification) {
      notification = document.createElement('div');
      notification.className = 'suggestion-input--notification';
      notification.textContent = 'Completado con Motor de predicción textual';
      document.body.appendChild(notification);
    }
    
    // Mostrar la notificación
    setTimeout(() => {
      notification.classList.add('active');
    }, 100);
    
    // Ocultar después de 2 segundos y eliminar inmediatamente después
    setTimeout(() => {
      notification.classList.remove('active');
      
      // Eliminar el elemento del DOM inmediatamente después de ocultar
      if (notification && notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 2100);
  };

export default showSuggestionNotification