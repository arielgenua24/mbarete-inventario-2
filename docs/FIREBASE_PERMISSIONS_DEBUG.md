# Firebase Permissions Debug Guide

## The Error

```
POST https://firestore.googleapis.com/v1/projects/mbarete-inventario/databases/(default)/documents:commit
403 (Forbidden)
FirebaseError: Missing or insufficient permissions.
```

This error appears in the browser console when `syncWorker.js` tries to commit a Firestore transaction (create an order + update product stock) and the request is rejected by Firebase's servers.

---

## What Is Actually Happening

The `syncWorker` runs in the background and processes a queue of pending orders stored in IndexedDB. When it picks up a task, it runs a Firestore transaction that:

1. Reads the order doc to check it doesn't already exist
2. Reads each product doc to validate stock
3. Writes the new order document
4. Updates stock on each affected product

A **403 / permission-denied** error means Firebase's Firestore Security Rules evaluated the request and denied it. This is **not** a bug in the transaction logic — the request is well-formed. The problem is the security rules rejecting the caller.

---

## Root Cause Analysis

The app uses real Firebase Auth (`signInWithEmailAndPassword` in `authService.jsx`). When a user logs in, Firebase issues a short-lived auth token (1 hour TTL) that the Firestore SDK attaches automatically to every request. The SDK is supposed to auto-refresh this token using a longer-lived refresh token stored in the browser.

### Most Likely Cause: Stale IndexedDB data with an expired or missing auth context

The sync queue and pending orders are stored in **IndexedDB** (via Dexie). If the IndexedDB contains tasks or orders from a previous session — before the server was restarted or before the user logged out and back in — those tasks will be retried in the new session but the Firestore SDK may not yet have a valid, refreshed auth token attached when the worker fires immediately on startup.

The sequence that triggers the bug:

1. Order is created and saved to IndexedDB with status `pending`
2. Server restarts, or browser tab is refreshed
3. `SyncWorker.start()` fires immediately and picks up the stale task from IndexedDB
4. At that exact moment, Firebase Auth hasn't finished loading/refreshing the token from localStorage
5. Firestore receives the write request with no valid auth token → **403**

### Secondary Cause: Firebase Auth token expired

Firebase Auth tokens expire every **1 hour**. The SDK auto-refreshes them using a refresh token, but the refresh can silently fail if:

- The user's network dropped during the refresh window
- The browser tab was backgrounded/sleeping and the refresh wasn't triggered in time
- The Firebase Auth session was invalidated server-side (e.g., from the Firebase Console)

When the token is stale, the Firestore SDK still tries to write, but the server rejects it with `permission-denied`.

### Third Possibility: Firestore Rules Were Changed

There is no `firestore.rules` file in this project — rules live only in the **Firebase Console** (`Firestore Database → Rules`). If someone updated the rules to add stricter conditions (email checks, location checks, admin-only writes), previously-working users may suddenly get denied.

---

## How to Diagnose

### 1. Check Firestore rules in the Firebase Console

Go to: `Firebase Console → Firestore Database → Rules`

Look at the `orders` and `products` write rules. Common patterns to check:

```js
// Does it require authentication?
allow write: if request.auth != null;

// Does it check the user's email?
allow write: if request.auth.token.email == someExpectedEmail;

// Does it check a user's location or role?
allow write: if request.auth.token.email in get(/databases/$(database)/documents/users/config).data.allowedUsers;
```

If rules were recently changed, that's the culprit. Roll them back or update them to allow the affected users.

### 2. Check auth state at sync time

Open DevTools → Application → IndexedDB. Look for the `syncQueue` and `pendingOrders` stores. If you see tasks with many failed attempts but `status: pending` or `status: failed`, stale data from a previous session is accumulating.

### 3. Look at the attempt count

In the console you'll see something like:
```
❌ Task task_1776081017092_du103o failed after 19 attempts
```

`maxRetries` in `syncWorker.js` is `3`. If attempts far exceed that, the task was re-queued multiple times (manually or across sessions) without the underlying auth issue being resolved.

---

## How It Was Solved

**The fix was simple: clear the stale IndexedDB data.**

1. Open Chrome DevTools → **Application** tab → **Storage** → **IndexedDB**
2. Find the app's database (e.g., `mbarete-db` or similar)
3. Delete the stale entries in `syncQueue` and/or `pendingOrders` that were stuck in `failed` or looping `pending` state
4. Restart the dev server
5. Log in again — Firebase Auth issues a fresh token
6. Place the order again — the sync completes successfully

The stale tasks were created in a previous session before proper auth was in place. Once cleared, new tasks went through cleanly with a valid auth token.

---

## How to Prevent This

The `syncWorker` currently starts immediately and fires without checking whether Firebase Auth has finished initializing. A safer approach is to delay the first sync until the auth state is confirmed:

```js
// In the component that starts the worker (e.g., App.jsx or a provider)
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebaseSetUp';

onAuthStateChanged(auth, (firebaseUser) => {
  if (firebaseUser) {
    syncWorker.start(); // Only start syncing once auth is confirmed
  } else {
    syncWorker.stop();
  }
});
```

And inside `syncOrder`, you can add a fast-fail guard:

```js
import { auth } from '../firebaseSetUp';

async syncOrder(payload) {
  // Guard: don't attempt to sync if not authenticated
  if (!auth.currentUser) {
    return { success: false, error: 'Not authenticated — skipping sync until login' };
  }
  // ... rest of sync logic
}
```

This way, if auth isn't ready, the task stays in the queue and will be retried after the auth state resolves, rather than burning all retries immediately with 403 errors.

---

## Related Files

| File | Role |
|---|---|
| `src/services/syncWorker.js` | Background sync queue processor |
| `src/services/cacheService.js` | IndexedDB read/write (Dexie) |
| `src/services/authService.jsx` | Firebase Auth sign in/out |
| `src/firebaseSetUp/index.js` | Firebase app + `auth` + `db` initialization |
| `src/hooks/useLocalOrders/index.jsx` | Creates orders locally and queues sync tasks |
