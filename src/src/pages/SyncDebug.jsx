/**
 * Sync Debug Page
 *
 * UI for testing and monitoring the sync system
 * Shows real-time sync status, scheduler status, worker status
 */

import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Badge, Alert, Table } from 'react-bootstrap';
import useSync from '../hooks/useSync';
import { getSchedulerStatus, forceSync as forceSyncScheduler } from '../services/syncScheduler';
import { getWorkerStatus, forceProcessQueue } from '../services/syncWorker';
import { getDBStats, clearAllData } from '../db/indexedDB';
import { getPendingSyncTasks, getPendingOrders } from '../services/cacheService';
import { fullSync, fixMetadataCount } from '../services/syncService';

export default function SyncDebug() {
  const {
    syncStatus,
    lastSynced,
    totalProducts,
    error,
    isSyncing,
    triggerSync,
    getTimeSinceSync
  } = useSync();

  const [schedulerStatus, setSchedulerStatus] = useState(null);
  const [workerStatus, setWorkerStatus] = useState(null);
  const [dbStats, setDbStats] = useState(null);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load all status information
  useEffect(() => {
    const loadStatus = async () => {
      try {
        // Get scheduler status
        const scheduler = getSchedulerStatus();
        setSchedulerStatus(scheduler);

        // Get worker status
        const worker = getWorkerStatus();
        setWorkerStatus(worker);

        // Get DB stats
        const stats = await getDBStats();
        setDbStats(stats);

        // Get pending tasks
        const tasks = await getPendingSyncTasks(10);
        setPendingTasks(tasks);

        // Get pending orders
        const orders = await getPendingOrders();
        setPendingOrders(orders);
      } catch (err) {
        console.error('Failed to load status:', err);
      }
    };

    loadStatus();

    // Refresh every 5 seconds
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, [refreshKey]);

  const handleManualSync = async () => {
    await triggerSync();
    setRefreshKey(k => k + 1);
  };

  const handleForceSync = async () => {
    await forceSyncScheduler();
    setRefreshKey(k => k + 1);
  };

  const handleForceProcessQueue = async () => {
    await forceProcessQueue();
    setRefreshKey(k => k + 1);
  };

  const handleResetAndFullSync = async () => {
    if (!confirm('⚠️ This will delete ALL local data and re-download from Firestore. Continue?')) {
      return;
    }
    try {
      console.log('🗑️ Clearing IndexedDB...');
      await clearAllData();
      console.log('🔄 Starting full sync...');
      await fullSync();
      setRefreshKey(k => k + 1);
      alert('✅ Full sync completed!');
    } catch (error) {
      console.error('❌ Reset failed:', error);
      alert('❌ Reset failed: ' + error.message);
    }
  };

  const handleFixMetadata = async () => {
    const result = await fixMetadataCount();
    if (result.success) {
      alert(`✅ Metadata fixed: ${result.totalProducts} products`);
      setRefreshKey(k => k + 1);
    } else {
      alert('❌ Failed to fix metadata: ' + result.error);
    }
  };

  const getSyncStatusBadge = () => {
    switch (syncStatus) {
      case 'syncing':
        return <Badge bg="primary">Syncing...</Badge>;
      case 'synced':
        return <Badge bg="success">Synced</Badge>;
      case 'error':
        return <Badge bg="danger">Error</Badge>;
      case 'idle':
        return <Badge bg="secondary">Idle</Badge>;
      default:
        return <Badge bg="secondary">{syncStatus}</Badge>;
    }
  };

  return (
    <Container className="py-4">
      <h2 className="mb-4">🔧 Sync System Debug</h2>

      {/* Sync Status Overview */}
      <Row className="mb-4">
        <Col md={6}>
          <Card>
            <Card.Body>
              <Card.Title>Sync Status</Card.Title>
              <div className="mb-3">
                <strong>Status:</strong> {getSyncStatusBadge()}
                {isSyncing && <span className="ms-2">⏳</span>}
              </div>
              <div className="mb-2">
                <strong>Last Synced:</strong> {getTimeSinceSync()}
                {lastSynced && (
                  <small className="d-block text-muted">
                    {new Date(lastSynced).toLocaleString()}
                  </small>
                )}
              </div>
              <div className="mb-3">
                <strong>Total Products:</strong> {totalProducts}
              </div>
              {error && (
                <Alert variant="danger" className="mb-3">
                  <strong>Error:</strong> {error}
                </Alert>
              )}
              <div className="d-flex gap-2 flex-wrap">
                <Button
                  variant="primary"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  size="sm"
                >
                  {isSyncing ? 'Syncing...' : 'Manual Sync'}
                </Button>
                <Button
                  variant="warning"
                  onClick={handleForceSync}
                  disabled={isSyncing}
                  size="sm"
                >
                  Force Sync
                </Button>
                <Button
                  variant="danger"
                  onClick={handleResetAndFullSync}
                  disabled={isSyncing}
                  size="sm"
                >
                  Reset & Full Sync
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleFixMetadata}
                  size="sm"
                >
                  Fix Metadata Count
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card>
            <Card.Body>
              <Card.Title>Network & Scheduler</Card.Title>
              {schedulerStatus && (
                <>
                  <div className="mb-2">
                    <strong>Online:</strong>{' '}
                    {schedulerStatus.isOnline ? (
                      <Badge bg="success">Online</Badge>
                    ) : (
                      <Badge bg="danger">Offline</Badge>
                    )}
                  </div>
                  <div className="mb-2">
                    <strong>Scheduler:</strong>{' '}
                    {schedulerStatus.isInitialized ? (
                      <Badge bg="success">Running</Badge>
                    ) : (
                      <Badge bg="secondary">Stopped</Badge>
                    )}
                  </div>
                  <div className="mb-2">
                    <strong>Periodic Sync:</strong>{' '}
                    {schedulerStatus.periodicSyncActive ? (
                      <Badge bg="success">Active</Badge>
                    ) : (
                      <Badge bg="secondary">Inactive</Badge>
                    )}
                  </div>
                  {schedulerStatus.lastSyncAttempt && (
                    <div className="mb-2">
                      <strong>Last Attempt:</strong>{' '}
                      <small className="text-muted">
                        {Math.floor(schedulerStatus.timeSinceLastSync / 1000)}s ago
                      </small>
                    </div>
                  )}
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Worker & Database Stats */}
      <Row className="mb-4">
        <Col md={6}>
          <Card>
            <Card.Body>
              <Card.Title>Sync Worker</Card.Title>
              {workerStatus && (
                <>
                  <div className="mb-2">
                    <strong>Status:</strong>{' '}
                    {workerStatus.isRunning ? (
                      <Badge bg="success">Running</Badge>
                    ) : (
                      <Badge bg="secondary">Stopped</Badge>
                    )}
                  </div>
                  <div className="mb-2">
                    <strong>Check Interval:</strong> {workerStatus.processingInterval / 1000}s
                  </div>
                  <div className="mb-2">
                    <strong>Max Retries:</strong> {workerStatus.maxRetries}
                  </div>
                  <div className="mb-3">
                    <strong>Pending Tasks:</strong>{' '}
                    <Badge bg={pendingTasks.length > 0 ? 'warning' : 'success'}>
                      {pendingTasks.length}
                    </Badge>
                  </div>
                  <Button
                    variant="info"
                    size="sm"
                    onClick={handleForceProcessQueue}
                    disabled={!navigator.onLine}
                  >
                    Force Process Queue
                  </Button>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card>
            <Card.Body>
              <Card.Title>IndexedDB Stats</Card.Title>
              {dbStats && (
                <>
                  <div className="mb-2">
                    <strong>Products:</strong> {dbStats.products}
                  </div>
                  <div className="mb-2">
                    <strong>Pending Orders:</strong>{' '}
                    <Badge bg={dbStats.pendingOrders > 0 ? 'warning' : 'success'}>
                      {dbStats.pendingOrders}
                    </Badge>
                  </div>
                  <div className="mb-2">
                    <strong>Sync Queue:</strong>{' '}
                    <Badge bg={dbStats.syncQueue > 0 ? 'warning' : 'success'}>
                      {dbStats.syncQueue}
                    </Badge>
                  </div>
                  <div className="mb-2">
                    <strong>Order History:</strong> {dbStats.orderHistory}
                  </div>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Pending Sync Tasks */}
      {pendingTasks.length > 0 && (
        <Row className="mb-4">
          <Col>
            <Card>
              <Card.Body>
                <Card.Title>Pending Sync Tasks</Card.Title>
                <Table striped bordered hover size="sm">
                  <thead>
                    <tr>
                      <th>Task ID</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Attempts</th>
                      <th>Next Retry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingTasks.map(task => (
                      <tr key={task.taskId}>
                        <td>
                          <small>{task.taskId.slice(0, 8)}...</small>
                        </td>
                        <td>{task.type}</td>
                        <td>
                          <Badge bg={task.status === 'pending' ? 'warning' : 'info'}>
                            {task.status}
                          </Badge>
                        </td>
                        <td>{task.priority}</td>
                        <td>{task.attempts || 0}</td>
                        <td>
                          <small>
                            {task.nextRetryAt
                              ? new Date(task.nextRetryAt).toLocaleTimeString()
                              : 'Now'}
                          </small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Pending Orders */}
      {pendingOrders.length > 0 && (
        <Row>
          <Col>
            <Card>
              <Card.Body>
                <Card.Title>Pending Orders</Card.Title>
                <Table striped bordered hover size="sm">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Status</th>
                      <th>Attempts</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingOrders.map(order => (
                      <tr key={order.orderId}>
                        <td>
                          <small>{order.orderId.slice(0, 8)}...</small>
                        </td>
                        <td>
                          <Badge bg={order.status === 'pending' ? 'warning' : 'success'}>
                            {order.status}
                          </Badge>
                        </td>
                        <td>{order.attempts || 0}</td>
                        <td>
                          <small>{new Date(order.createdAt).toLocaleString()}</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Info */}
      <Alert variant="info" className="mt-4">
        <strong>ℹ️ Debug Info:</strong>
        <ul className="mb-0 mt-2">
          <li><strong>Manual Sync:</strong> Rate-limited (30s minimum between syncs)</li>
          <li><strong>Force Sync:</strong> Bypasses rate limiting</li>
          <li><strong>Scheduler:</strong> Auto-syncs every 5 minutes when online</li>
          <li><strong>Worker:</strong> Processes sync queue every 10 seconds</li>
        </ul>
      </Alert>
    </Container>
  );
}
