import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import useFirestoreContext from '../../hooks/useFirestoreContext'
import LoadingComponent from '../../components/Loading'
import ImageModal from '../../components/ImageModal'
import './EarningsDetails.css'

function EarningsDetails() {
  const { period } = useParams()
  const navigate = useNavigate()
  const { filterOrdersByDate, getProductsByOrder } = useFirestoreContext()
  
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState(null)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [modalImage, setModalImage] = useState(null)

  // Fetch orders
  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true)
      try {
        const ordersList = await filterOrdersByDate()
        // We need to fetch details for all orders to calculate totals correctly
        // In a real large app, we might want to optimize this, but for now we follow the pattern
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

  // Helper: Get Date Object
  const getOrderDate = (order) => {
    if (order.createdAt) {
      if (order.createdAt.toDate) return order.createdAt.toDate()
      if (order.createdAt instanceof Date) return order.createdAt
      return new Date(order.createdAt)
    }
    if (order.fecha) {
      const [datePart, timePart] = order.fecha.split(', ')
      const [day, month, year] = datePart.split('/')
      return new Date(`${year}-${month}-${day}T${timePart}`)
    }
    return null
  }

  // Helper: Format Currency
  const formatCurrency = (amount) => `$${amount.toLocaleString('es-ES')}`

  // Helper: Format Date
  const formatDate = (date) => {
    return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  // Filter Data based on Period
  const filteredData = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (period === 'daily') {
      return orders.filter(order => {
        const d = getOrderDate(order)
        if (!d) return false
        const orderDay = new Date(d)
        orderDay.setHours(0, 0, 0, 0)
        return orderDay.getTime() === today.getTime()
      })
    } else if (period === 'weekly') {
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)
      return orders.filter(order => {
        const d = getOrderDate(order)
        return d && d >= weekAgo
      })
    } else if (period === 'monthly') {
      const monthAgo = new Date(today)
      monthAgo.setDate(monthAgo.getDate() - 30)
      return orders.filter(order => {
        const d = getOrderDate(order)
        return d && d >= monthAgo
      })
    }
    return []
  }, [orders, period])

  // Group by Day for Weekly/Monthly
  const groupedByDay = useMemo(() => {
    if (period === 'daily') return null

    const groups = {}
    filteredData.forEach(order => {
      const d = getOrderDate(order)
      if (!d) return
      const dayKey = d.toLocaleDateString('es-ES') // Simple key
      if (!groups[dayKey]) {
        groups[dayKey] = {
          date: d,
          orders: [],
          total: 0
        }
      }
      groups[dayKey].orders.push(order)
      groups[dayKey].total += order.total
    })

    return Object.values(groups).sort((a, b) => b.date - a.date)
  }, [filteredData, period])

  // Render Logic
  const renderContent = () => {
    // 1. Detail View: Selected Order (Products)
    if (selectedOrder) {
      return (
        <div className="ed-detail-view">
          <div className="ed-header-row">
            <button className="ed-back-btn" onClick={() => setSelectedOrder(null)}>
              ← Volver
            </button>
            <h2 className="ed-title">Detalle de Venta</h2>
          </div>
          
          <div className="ed-order-summary">
            <span className="ed-order-id">ID: {selectedOrder.id.slice(0, 8)}...</span>
            <span className="ed-order-total">{formatCurrency(selectedOrder.total)}</span>
          </div>

          <div className="ed-customer-details">
            <h3 className="ed-section-title">Datos del Cliente</h3>
            <div className="ed-detail-row">
              <span className="ed-detail-label">Comprador:</span>
              <span className="ed-detail-value">{selectedOrder.cliente || 'N/A'}</span>
            </div>
            <div className="ed-detail-row">
              <span className="ed-detail-label">Domicilio:</span>
              <span className="ed-detail-value">{selectedOrder.direccion || 'N/A'}</span>
            </div>
            <div className="ed-detail-row">
              <span className="ed-detail-label">Teléfono:</span>
              <span className="ed-detail-value">{selectedOrder.telefono || 'N/A'}</span>
            </div>
          </div>

          <h3 className="ed-section-title" style={{marginTop: '24px', marginBottom: '12px'}}>Productos</h3>
          <div className="ed-list">
            {selectedOrder.products?.map((item, idx) => (
              <div key={idx} className="ed-list-item product">
                {item.productData?.imageUrl && (
                  <img 
                    src={item.productData.imageUrl} 
                    alt={item.productData.name} 
                    className="ed-product-image"
                    loading="lazy"
                    onClick={(e) => {
                      e.stopPropagation()
                      setModalImage(item.productData.imageUrl)
                    }}
                  />
                )}
                <div className="ed-item-info">
                  <span className="ed-item-name">{item.productData?.name || 'Producto'}</span>
                  <span className="ed-item-sub">{item.stock} x {formatCurrency(item.productData?.price || 0)}</span>
                </div>
                <span className="ed-item-amount">
                  {formatCurrency((item.stock || 0) * (item.productData?.price || 0))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    // 2. Detail View: Selected Day (Orders)
    if (selectedDay) {
      return (
        <div className="ed-detail-view">
          <div className="ed-header-row">
            <button className="ed-back-btn" onClick={() => setSelectedDay(null)}>
              ← Volver
            </button>
            <h2 className="ed-title">{formatDate(selectedDay.date)}</h2>
          </div>
          <div className="ed-list">
            {selectedDay.orders.map(order => (
              <div key={order.id} className="ed-list-item" onClick={() => setSelectedOrder(order)}>
                <div className="ed-item-info">
                  <span className="ed-item-name">Venta {getOrderDate(order).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})}</span>
                  <span className="ed-item-sub">{order.products?.length || 0} productos</span>
                </div>
                <span className="ed-item-amount">{formatCurrency(order.total)}</span>
                <span className="ed-chevron">›</span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    // 3. Main View: Daily (Orders)
    if (period === 'daily') {
      return (
        <div className="ed-main-view">
          <div className="ed-header-row">
            <button className="ed-back-btn" onClick={() => navigate('/inbox')}>
              ← Inbox
            </button>
            <h2 className="ed-title">Ventas de Hoy</h2>
          </div>
          <div className="ed-total-banner">
            <span className="ed-banner-label">Total del día</span>
            <span className="ed-banner-amount">
              {formatCurrency(filteredData.reduce((sum, o) => sum + o.total, 0))}
            </span>
          </div>
          <div className="ed-list">
            {filteredData.length > 0 ? filteredData.map(order => (
              <div key={order.id} className="ed-list-item" onClick={() => setSelectedOrder(order)}>
                <div className="ed-item-info">
                  <span className="ed-item-name">Venta {getOrderDate(order).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})}</span>
                  <span className="ed-item-sub">{order.products?.length || 0} productos</span>
                </div>
                <span className="ed-item-amount">{formatCurrency(order.total)}</span>
                <span className="ed-chevron">›</span>
              </div>
            )) : (
              <div className="ed-empty">No hay ventas hoy</div>
            )}
          </div>
        </div>
      )
    }

    // 4. Main View: Weekly/Monthly (Days)
    return (
      <div className="ed-main-view">
        <div className="ed-header-row">
          <button className="ed-back-btn" onClick={() => navigate('/inbox')}>
            ← Inbox
          </button>
          <h2 className="ed-title">
            {period === 'weekly' ? 'Esta Semana' : 'Este Mes'}
          </h2>
        </div>
        <div className="ed-total-banner">
          <span className="ed-banner-label">Total acumulado</span>
          <span className="ed-banner-amount">
            {formatCurrency(filteredData.reduce((sum, o) => sum + o.total, 0))}
          </span>
        </div>
        <div className="ed-list">
          {groupedByDay && groupedByDay.length > 0 ? groupedByDay.map(dayGroup => (
            <div key={dayGroup.date.toISOString()} className="ed-list-item" onClick={() => setSelectedDay(dayGroup)}>
              <div className="ed-item-info">
                <span className="ed-item-name">{formatDate(dayGroup.date)}</span>
                <span className="ed-item-sub">{dayGroup.orders.length} ventas</span>
              </div>
              <span className="ed-item-amount">{formatCurrency(dayGroup.total)}</span>
              <span className="ed-chevron">›</span>
            </div>
          )) : (
            <div className="ed-empty">No hay datos para este periodo</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="ed-container">
      <LoadingComponent isLoading={isLoading} />
      {!isLoading && renderContent()}
      
      <ImageModal 
        isOpen={!!modalImage}
        imageSrc={modalImage}
        onClose={() => setModalImage(null)}
      />
    </div>
  )
}

export default EarningsDetails
