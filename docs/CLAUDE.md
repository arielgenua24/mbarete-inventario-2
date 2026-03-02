# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

The project uses Vite as the build tool with the following npm scripts:

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build locally

## Architecture Overview

This is a React SPA (Single Page Application) for "Reina Chura" - an inventory and order management system. The app uses HashRouter for routing and is designed to be deployed via Firebase Hosting.

### Key Technologies

- **React 18** with Vite for development
- **Firebase** for backend services (Firestore, Auth, Hosting)
- **React Router v7** for navigation
- **React Bootstrap** for UI components
- **QR Code functionality** for product verification and ordering

### Project Structure

The source code is located in `src/src/` (note the nested src directory). Key architectural components:

#### Context Providers
- `OrderContext` - Shopping cart and customer order state management using localStorage
- `firestoreContext` - Firebase/Firestore operations and user authentication

#### Core Features
- **Inventory Management** - Product CRUD operations
- **Order Processing** - Customer orders with cart functionality
- **QR Code Integration** - Product verification and QR-based ordering
- **Product Verification** - Status tracking for order items
- **Admin Dashboard** - Administrative functions and reporting

#### Routing Structure
- `/` - Home dashboard
- `/inventory` - Product inventory management
- `/orders` - Order listing and management
- `/cart` - Shopping cart
- `/new-order` - Create new order
- `/ProductsVerification/:orderId` - Verify products in order
- `/login` - Authentication

#### Component Organization
- `components/` - Reusable UI components (each with index.jsx + styles.css)
- `pages/` - Route-level page components
- `modals/` - Modal dialogs
- `hooks/` - Custom React hooks for data fetching and state
- `services/` - External service integrations
- `utils/` - Utility functions

### Firebase Configuration

The app uses environment variables for Firebase config (stored in `.env` files):
- `VITE_FIREBASE_*` variables for all Firebase service keys
- Firebase Hosting configured to serve from `dist/` directory

### State Management Pattern

The app uses React Context for global state:
- localStorage persistence for cart data (`cart-r-v1.1`) and customer data (`customer-reina-v1.2`)
- Firestore for persistent data storage
- Custom hooks abstract Firebase operations

### Development Notes

- Uses lazy loading for all page components to improve initial load performance
- Component files follow the pattern: `ComponentName/index.jsx` + `styles.css`
- Spanish language is used throughout the UI
- QR scanning and generation capabilities integrated throughout the app