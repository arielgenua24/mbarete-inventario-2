import useFirestoreContext from '../../hooks/useFirestoreContext'
import LoadingComponent from '../../components/Loading'
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar } from 'react-chartjs-2'
import 'chart.js/auto'
import './styles.css'

function Inbox() {
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const { filterOrdersByDate, getProductsByOrder } = useFirestoreContext()
  const navigate = useNavigate()

  // Fetch all orders on mount
  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true)
      try {
        const ordersList = await filterOrdersByDate()
        const ordersWithDetails = await Promise.all(
          ordersList.map(async (order) => {
            const products = await getProductsByOrder(order.id)
            const total = products.reduce((acc, item) => {
              const price = parseFloat(item.productData?.price) || 0
              return acc + (item.stock * price)
            }, 0)
            
            return {
              ...order,
              total,
              products: products
            }
          })
        )
        setOrders(ordersWithDetails)
      } catch (error) {
        console.error("Error fetching orders:", error)
      }
      setIsLoading(false)
    }
    
    fetchOrders()
  }, [filterOrdersByDate, getProductsByOrder])

  // Get today's date at midnight for comparison
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  // Helper function to get date from order
  function getOrderDate(order) {
    if (order.createdAt) {
      if (order.createdAt.toDate) {
        return order.createdAt.toDate()
      }
      if (order.createdAt instanceof Date) {
        return order.createdAt
      }
      return new Date(order.createdAt)
    }
    if (order.fecha) {
      const [datePart, timePart] = order.fecha.split(', ')
      const [day, month, year] = datePart.split('/')
      return new Date(`${year}-${month}-${day}T${timePart}`)
    }
    return null
  }

  // Calculate daily earnings (today)
  const dailyEarnings = useMemo(() => {
    return orders.filter(order => {
      const orderDate = getOrderDate(order)
      if (!orderDate) return false
      const orderDay = new Date(orderDate)
      orderDay.setHours(0, 0, 0, 0)
      return orderDay.getTime() === today.getTime()
    }).reduce((sum, order) => sum + order.total, 0)
  }, [orders, today])

  // Calculate weekly earnings (current week - last 7 days)
  const weeklyEarnings = useMemo(() => {
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)
    return orders.filter(order => {
      const orderDate = getOrderDate(order)
      if (!orderDate) return false
      return orderDate >= weekAgo
    }).reduce((sum, order) => sum + order.total, 0)
  }, [orders, today])

  // Calculate monthly earnings (current month)
  const monthlyEarnings = useMemo(() => {
    const monthAgo = new Date(today)
    monthAgo.setDate(monthAgo.getDate() - 30)
    return orders.filter(order => {
      const orderDate = getOrderDate(order)
      if (!orderDate) return false
      return orderDate >= monthAgo
    }).reduce((sum, order) => sum + order.total, 0)
  }, [orders, today])

  // Get last 6 weeks data for chart
  const weeklyChartData = useMemo(() => {
    const weeks = []
    const labels = []
    
    for (let i = 5; i >= 0; i--) {
      const weekEnd = new Date(today)
      weekEnd.setDate(weekEnd.getDate() - (i * 7))
      const weekStart = new Date(weekEnd)
      weekStart.setDate(weekStart.getDate() - 7)
      
      const weekTotal = orders.filter(order => {
        const orderDate = getOrderDate(order)
        if (!orderDate) return false
        return orderDate >= weekStart && orderDate < weekEnd
      }).reduce((sum, order) => sum + order.total, 0)
      
      weeks.push(weekTotal)
      labels.push(`Sem ${6 - i}`)
    }
    
    return {
      labels,
      datasets: [{
        label: 'Ingresos',
        data: weeks,
        backgroundColor: '#007AFF',
        borderRadius: 8,
        barThickness: 20,
      }]
    }
  }, [orders, today])

  // Get top 5 products of the week
  const topProducts = useMemo(() => {
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)
    
    const productCounts = {}
    
    orders.forEach(order => {
      const orderDate = getOrderDate(order)
      if (!orderDate || orderDate < weekAgo) return
      
      order.products?.forEach(item => {
        const productName = item.productData?.name || 'Producto desconocido'
        productCounts[productName] = (productCounts[productName] || 0) + (item.stock || 0)
      })
    })
    
    return Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [orders, today])

  // Format currency
  const formatCurrency = (amount) => {
    return `$${amount.toLocaleString('es-ES')}`
  }

  // Navigate to earnings detail page
  const navigateToEarnings = (period) => {
    navigate(`/inbox/earnings/${period}`)
  }

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        titleColor: '#000',
        bodyColor: '#000',
        borderColor: '#eee',
        borderWidth: 1,
        padding: 10,
        displayColors: false,
        callbacks: {
          label: (context) => formatCurrency(context.raw)
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          display: true,
          color: '#f0f0f0',
          drawBorder: false
        },
        ticks: {
          color: '#8e8e93',
          font: { size: 10 },
          callback: (value) => `$${value / 1000}k`
        }
      },
      x: {
        grid: { display: false },
        ticks: {
          color: '#8e8e93',
          font: { size: 10 }
        }
      }
    }
  }

  return (
    <div className="apple-inbox">
      <LoadingComponent isLoading={isLoading} />
      
      {!isLoading && (
        <div className="apple-inbox-content">
          <header className="apple-header">
            <h1 className="apple-greeting">Hola! lista para revisar tus ingresos?</h1>
          </header>

          {/* Horizontal Scrollable Cards */}
          <div className="apple-cards-scroll">
            <button
              type="button"
              className="apple-card apple-card-button"
              onClick={() => navigateToEarnings('daily')}
              aria-label="Ver ingresos del día"
            >
              <span className="apple-card-label">Ingresos del día {today.getDate()}/{today.getMonth() + 1}</span>
              <span className="apple-card-amount">{formatCurrency(dailyEarnings)}</span>
              <span className="apple-card-cta">Ver detalle</span>
            </button>
            
            <button
              type="button"
              className="apple-card apple-card-button"
              onClick={() => navigateToEarnings('weekly')}
              aria-label="Ver ingresos de la semana"
            >
              <span className="apple-card-label">Ingresos de la semana</span>
              <span className="apple-card-amount">{formatCurrency(weeklyEarnings)}</span>
              <span className="apple-card-cta">Ver detalle</span>
            </button>
            
            <button
              type="button"
              className="apple-card apple-card-button"
              onClick={() => navigateToEarnings('monthly')}
              aria-label="Ver ingresos del mes"
            >
              <span className="apple-card-label">Ingresos del mes</span>
              <span className="apple-card-amount">{formatCurrency(monthlyEarnings)}</span>
              <span className="apple-card-cta">Ver detalle</span>
            </button>
          </div>

          {/* Chart Section */}
          <section className="apple-section">
            <h2 className="apple-section-title">Gráficos Semanales</h2>
            <p className="apple-section-hint">Siempre se mostrarán las últimas 6 semanas</p>
            <div className="apple-chart-container">
              <Bar data={weeklyChartData} options={chartOptions} />
            </div>
          </section>

          {/* Top Products Section */}
          <section className="apple-section">
            <div className="apple-section-header">
              <h2 className="apple-section-title">Resumen de Elementos</h2>
              <span className="apple-section-badge">5 más comprados de la semana</span>
            </div>
            
            <div className="apple-list">
              {topProducts.length > 0 ? (
                topProducts.map(([name, count]) => {
                  const maxCount = topProducts[0][1]
                  const percentage = (count / maxCount) * 100
                  
                  return (
                    <div key={name} className="apple-list-item">
                      <div className="apple-item-info">
                        <span className="apple-item-name">{name}</span>
                        <span className="apple-item-count">{count}</span>
                      </div>
                      <div className="apple-progress-bg">
                        <div 
                          className="apple-progress-fill"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="apple-empty-state">No hay ventas esta semana</div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default Inbox
