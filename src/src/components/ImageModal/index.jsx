import React from 'react';
import { X } from 'lucide-react';
import './styles.css';

const ImageModal = ({ isOpen, imageSrc, onClose, altText }) => {
    if (!isOpen || !imageSrc) return null;

    return (
        <div className="image-modal-overlay" onClick={onClose}>
            <div className="image-modal-container" onClick={(e) => e.stopPropagation()}>
                <button className="image-modal-close" onClick={onClose} aria-label="Cerrar">
                    X
                </button>
                <img src={imageSrc} alt={altText || 'Imagen ampliada'} className="image-modal-content" />
            </div>
        </div>
    );
};

export default ImageModal;
