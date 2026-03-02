import { useState } from "react";
import QrReader from "react-qr-scanner";

// eslint-disable-next-line react/prop-types
const QrScanner = ({ onScan }) => {
  const [errorMessage, setErrorMessage] = useState("");

  const handleScan = (data) => {
    if (data) {
      onScan(data.text);
    }
  };

  const handleError = (err) => {
    console.error("Error al escanear el QR:", err);
    setErrorMessage("Error al acceder a la cámara. Revisa los permisos.");
  };

  const previewStyle = {
    height: 600, // Altura del contenedor del video
    width: 330, // Ancho del contenedor del video
    borderRadius: 10, // Opcional: bordes redondeados
    overflow: "hidden",
  };

  return (
    <div>
      {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}
      <QrReader
        delay={300}
        style={previewStyle}
        onError={handleError}
        onScan={handleScan}
        constraints={{
          video: {
            facingMode: "environment", // Sin 'exact' para ser más flexible
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        }}
      />
    </div>
  );
};

export default QrScanner;
