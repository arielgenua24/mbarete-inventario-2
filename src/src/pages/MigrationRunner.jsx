/**
 * Migration Runner Page
 *
 * Use this page ONCE to run the Firestore migration
 * After migration is complete, you can delete this file
 *
 * Access at: /migration-runner
 */

import { useState } from 'react';
import { Container, Button, Alert, Card, ProgressBar, Badge } from 'react-bootstrap';
import migrationService from '../services/migrationService';

const MigrationRunner = () => {
  const [status, setStatus] = useState('idle'); // 'idle' | 'running' | 'success' | 'error'
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [verifyResults, setVerifyResults] = useState(null);

  const runMigration = async () => {
    setStatus('running');
    setError(null);
    setResults(null);

    try {
      const migrationResults = await migrationService.runFullMigration();
      setResults(migrationResults);
      setStatus('success');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  };

  const verifyMigration = async () => {
    try {
      const verification = await migrationService.verifyMigration();
      setVerifyResults(verification);
    } catch (err) {
      setError(err.message);
    }
  };

  const cleanFlags = async () => {
    if (!window.confirm('Remove _migrated flags from all products?')) {
      return;
    }
    try {
      await migrationService.cleanMigrationFlags();
      alert('✅ Migration flags cleaned successfully!');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Container className="mt-5">
      <h1>🔧 Firestore Migration Runner</h1>
      <p className="text-muted">Phase 1: Add serverTimestamp to products</p>

      <Alert variant="warning" className="mt-4">
        <Alert.Heading>⚠️ Important</Alert.Heading>
        <ul>
          <li>Run this migration <strong>only once</strong></li>
          <li>Do not interrupt the process once started</li>
          <li>This will update all products in Firestore</li>
          <li>After successful migration, you can delete this page</li>
        </ul>
      </Alert>

      <Card className="mt-4">
        <Card.Body>
          <Card.Title>Migration Status</Card.Title>

          {status === 'idle' && (
            <div>
              <p>Ready to start migration</p>
              <Button variant="primary" onClick={runMigration} size="lg">
                🚀 Start Migration
              </Button>
            </div>
          )}

          {status === 'running' && (
            <div>
              <h5>Migration in progress...</h5>
              <ProgressBar animated now={100} label="Processing..." className="mt-3" />
              <p className="text-muted mt-2">This may take a few minutes. Please wait...</p>
            </div>
          )}

          {status === 'success' && results && (
            <div>
              <Alert variant="success">
                <Alert.Heading>✅ Migration Successful!</Alert.Heading>
                <hr />
                <p><strong>Products migrated:</strong> {results.products?.productsUpdated || 0}</p>
                <p><strong>Metadata created:</strong> {results.metadata ? 'Yes ✓' : 'No ✗'}</p>
              </Alert>

              <div className="mt-3">
                <Button variant="info" onClick={verifyMigration} className="me-2">
                  🔍 Verify Migration
                </Button>
                <Button variant="secondary" onClick={cleanFlags}>
                  🧹 Clean Migration Flags
                </Button>
              </div>

              {verifyResults && (
                <Alert variant={verifyResults.success ? 'success' : 'warning'} className="mt-3">
                  <p><strong>Verification Results:</strong></p>
                  <p>Total products: {verifyResults.total}</p>
                  <p>With timestamp: {verifyResults.withTimestamp} <Badge bg="success">✓</Badge></p>
                  <p>Without timestamp: {verifyResults.withoutTimestamp} {verifyResults.withoutTimestamp > 0 ? <Badge bg="danger">!</Badge> : <Badge bg="success">✓</Badge>}</p>
                </Alert>
              )}
            </div>
          )}

          {status === 'error' && (
            <Alert variant="danger">
              <Alert.Heading>❌ Migration Failed</Alert.Heading>
              <p>{error}</p>
              <Button variant="warning" onClick={runMigration} className="mt-2">
                🔄 Retry Migration
              </Button>
            </Alert>
          )}
        </Card.Body>
      </Card>

      <Card className="mt-4">
        <Card.Body>
          <Card.Title>📝 What this migration does</Card.Title>
          <ol>
            <li>Reads all products from Firestore</li>
            <li>Updates each product with <code>updatedAt: serverTimestamp()</code></li>
            <li>Creates <code>metadata/catalog</code> document with <code>lastUpdated</code> timestamp</li>
            <li>Processes in batches of 500 for efficiency</li>
          </ol>

          <Card.Title className="mt-4">🔍 After Migration</Card.Title>
          <ul>
            <li>All products will have proper Firestore timestamps</li>
            <li>Delta sync will be able to detect changes</li>
            <li>You can proceed to Phase 2 (Sync System)</li>
            <li><strong>You can delete this page and file</strong></li>
          </ul>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default MigrationRunner;
