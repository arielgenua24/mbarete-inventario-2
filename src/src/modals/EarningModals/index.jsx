import { useState, useEffect } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';

const EarningsModals = ({ orders }) => {
  const [showDaily, setShowDaily] = useState(false);
  const [showMonthly, setShowMonthly] = useState(false);
  const [dailyEarnings, setDailyEarnings] = useState([]);
  const [monthlyEarnings, setMonthlyEarnings] = useState([]);

  // Cada vez que orders cambie, calculamos las ganancias diarias y mensuales.
  useEffect(() => {
    if (orders && orders.length) {
      setDailyEarnings(calculateDailyEarnings(orders));
      setMonthlyEarnings(calculateMonthlyEarnings(orders));
    }
  }, [orders]);

  // Función para agrupar ganancias por día
  const calculateDailyEarnings = (orders) => {
    const result = {};
    orders.forEach(order => {
      // Se asume que el formato de fecha es "dd/MM/yyyy, HH:mm"
      const [datePart] = order.fecha.split(',');
      // Acumulamos el total (asegurándonos de convertirlo a número)
      result[datePart] = (result[datePart] || 0) + Number(order.total);
    });
    // Convertimos el objeto en un array de objetos { date, total }
    return Object.entries(result).map(([date, total]) => ({ date, total }));
  };

  // Función para agrupar ganancias por mes
  const calculateMonthlyEarnings = (orders) => {
    const result = {};
    orders.forEach(order => {
      const [datePart] = order.fecha.split(',');
      // Separamos la fecha (asumimos formato "dd/MM/yyyy")
      const [day, month, year] = datePart.trim().split('/');
      const monthYear = `${month}/${year}`;
      result[monthYear] = (result[monthYear] || 0) + Number(order.total);
    });
    return Object.entries(result).map(([monthYear, total]) => ({ monthYear, total }));
  };

  const last5Days = dailyEarnings.slice(0, 5);
  const last3Months = monthlyEarnings.slice(0, 3);
  console.log(last5Days);
    console.log(dailyEarnings);

  // Configuración de datos para el gráfico de ganancias diarias
  const dailyChartData = {
    labels: last5Days.map(item => item.date),
    datasets: [{
      label: 'Ganancias diarias',
      data: last5Days.map(item => item.total),
      backgroundColor: 'rgb(55, 68, 245)',
    }]
  };

  // Configuración de datos para el gráfico de ganancias mensuales
  const monthlyChartData = {
    labels: last3Months.map(item => item.monthYear),
    datasets: [{
      label: 'Ganancias mensuales',
      data: last3Months.map(item => item.total),
      backgroundColor: 'rgba(153, 102, 255, 0.6)',
    }]
  };

  return (
    <div>
      <Button variant="primary" onClick={() => setShowDaily(true)} className="me-2">
        Ver Ganancias Diarias
      </Button>
      <Button variant="secondary" onClick={() => setShowMonthly(true)}>
        Ver Ganancias Mensuales
      </Button>

        <Modal  className="custom-modal" show={showDaily} onHide={() => setShowDaily(false)}>
          <Modal.Header closeButton style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem'}}>
          <Modal.Title style={{
                padding: '15px',
                color: '#2c3e50',
                fontSize: '2rem',
                fontWeight: 'bold',
                textAlign: 'center',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                borderBottom: '2px solid rgb(66, 18, 238)',
                marginBottom: '10px'
                }}>Ganancias Diarias</Modal.Title>
                <span style={{
                display: 'block',
                padding: '10px',
                fontSize: '1.2rem',
                color: 'rgb(18, 29, 238)',
                textAlign: 'center',
                fontWeight: '600',
                backgroundColor: '#F9F9F9',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>¡Muy bien! Estas son tus ganancias diarias.</span>
          </Modal.Header>
          <Modal.Body>
            <div style={{ overflowY: 'auto', maxHeight: '300px',
                  'backgroundColor': '#c2c2ee30',
                  'padding': '20px',
                  'borderRadius': '20px', }}>
            {dailyEarnings.map((item, index) => (
              <p style={{fontSize: '1.6rem'}} key={index}>
                <strong>{item.date}</strong>: Total: ${item.total}
              </p>
            ))}
            </div>
            <p style={{backgroundColor: '#f5f5f5', padding: '20px', margin: '20px 0px 20px 0px', width: '100%', display: 'flex', justifyContent: 'center', border: '2px solid #f1f1f1'}}><strong> GRAFICO DE LOS ULTIMOS 4 DIAS </strong></p>
            <Bar data={dailyChartData} />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowDaily(false)}>
            Cerrar
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Modal de Ganancias Mensuales */}
      <Modal show={showMonthly} onHide={() => setShowMonthly(false)}>
      <Modal.Header closeButton style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem'}}>
          <Modal.Title style={{
                padding: '15px',
                color: '#2c3e50',
                fontSize: '2rem',
                fontWeight: 'bold',
                textAlign: 'center',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                borderBottom: '2px solid rgb(66, 18, 238)',
                marginBottom: '10px'
                }}>Ganancias Mensuales</Modal.Title>
                <span style={{
                display: 'block',
                padding: '10px',
                fontSize: '1.2rem',
                color: 'rgb(18, 29, 238)',
                textAlign: 'center',
                fontWeight: '600',
                backgroundColor: '#F9F9F9',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>¡Muy bien! Estas son tus ganancias mensuales.</span>
          </Modal.Header>
        <Modal.Body>
        <div style={{ overflowY: 'auto', maxHeight: '300px' }}>
          {monthlyEarnings.map((item, index) => (
            <p style={{fontSize: '1.6rem'}} key={index}>
              <strong>{item.monthYear}</strong>: Total: ${item.total}
            </p>
          ))}
         </div>
        <p style={{backgroundColor: '#f5f5f5', padding: '20px', margin: '20px 0px 20px 0px', width: '100%', display: 'flex', justifyContent: 'center', border: '2px solid #f1f1f1'}}><strong> GRAFICO DE LOS ULTIMOS 3 MESES </strong></p>
          <Bar data={monthlyChartData} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowMonthly(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default EarningsModals;
