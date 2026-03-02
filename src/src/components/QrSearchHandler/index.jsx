import QrScanner from "../QrScanner";
import beep_sound from "../../assets/sounds/beep_sound.mp3";
import { useNavigate, useLocation } from "react-router-dom";
import { useOrder } from "../../hooks/useOrder";
// import QrInputSearch from "./QrInputSearch";

const QrSearchHandler = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const { ordersState } = useOrder()

  //buscamos la ruta de redireccion
  const searchParams = new URLSearchParams(location.search);
  const redirectType = searchParams.get('redirect');

  const handleRedirect = (parsedData) => {
    // Validar que parsedData tiene un id
    if (!parsedData?.id) {
      throw new Error('QR inválido: no se encontró ID');
    }
    console.log(parsedData)

    // Objeto de mapeo de rutas
    if (redirectType === 'select-product') {
      navigate(`/select-product-amount/${parsedData.id}`);
    } else if (redirectType === 'order-data') {
      const order = ordersState.find(order => order.id === parsedData.id);
      if (order) {
        navigate(`/ProductsVerification/${parsedData.id}/?orderEstado=${order.state}`);
      } else {
        alert('la orden no existe')
        navigate('/orders')
      }
    
    } else {
      navigate(`/product/${parsedData.id}`);
    }
  }


  const handleScan = (data) => {
    console.log("Datos escaneados:", data);
    const parsedData = JSON.parse(data);
    const audio = new Audio(beep_sound);  // Ruta de tu archivo de sonido
    audio.play();

    handleRedirect(parsedData);

    // Suponemos que el QR contiene un string como "order:12345" o "product:67890"
  };

  return (
    <div>
      <h1>Escanea un código QR</h1>
      <QrScanner onScan={handleScan} />
    </div>
  );
};

export default QrSearchHandler;