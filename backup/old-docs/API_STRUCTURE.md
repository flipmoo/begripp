# API Structure Analysis

This document provides an analysis of the current API structure in the codebase. It identifies the different API server implementations, their endpoints, and their usage.

## API Server Implementations

### 1. `src/api/gripp/api-server.ts`

**Description**: Original API server implementation.

**Key Features**:
- Express-based API server
- Connects to SQLite database
- Provides endpoints for accessing Gripp data
- Includes caching mechanism

**Endpoints**:
- `/health` - Health check endpoint
- `/api/v1/health` - Health check endpoint under v1 prefix
- `/api/v1/*` - Unified API endpoints (mounted dynamically)
- `/api/sync` - Sync data with Gripp
- `/api/sync/projects` - Sync projects with Gripp
- `/api/sync/employees` - Sync employees with Gripp
- `/api/sync/hours` - Sync hours with Gripp
- `/api/sync/invoices` - Sync invoices with Gripp
- `/api/sync/absence` - Sync absence data with Gripp
- `/api/clear-cache` - Clear API cache

### 2. `src/api/gripp/api-server-v2.ts`

**Description**: Updated API server with improved structure.

**Key Features**:
- Express-based API server
- Improved error handling
- Rate limiting
- Consistent API structure
- Better logging

**Endpoints**:
- `/api/v1/*` - All API endpoints under v1 prefix
- `/api/clear-cache` - Clear API cache

### 3. `src/api/gripp/simple-api-server.ts`

**Description**: Simplified API server implementation.

**Key Features**:
- Express-based API server
- Minimal dependencies
- Basic error handling

**Endpoints**:
- `/api/v1/*` - All API endpoints under v1 prefix
- `/api/*` - Legacy API endpoints

### 4. `src/api/gateway.js`

**Description**: API gateway for domain-specific routes.

**Key Features**:
- Express-based API gateway
- Routes requests to domain-specific handlers
- Includes CORS handling
- Includes logging

**Endpoints**:
- `/api/employees` - Employee-related endpoints
- `/api/projects` - Project-related endpoints
- `/api/absences` - Absence-related endpoints
- `/api/holidays` - Holiday-related endpoints
- `/api/health` - Health check endpoint
- `/api/docs` - API documentation endpoint

## API Client Implementations

### 1. `src/api/gripp/client.ts`

**Description**: Original API client implementation.

**Key Features**:
- Axios-based HTTP client
- Basic error handling
- Request queuing

**Methods**:
- `executeRequest` - Execute a request to the Gripp API
- `createRequest` - Create a request object for the Gripp API

### 2. `src/db/unified/api/gripp/client.ts`

**Description**: Unified API client with improved error handling.

**Key Features**:
- Axios-based HTTP client
- Advanced error handling
- Rate limiting
- Request retries
- Request queuing

**Methods**:
- `request` - Make a request to the Gripp API
- `get` - Make a GET request to the Gripp API
- `post` - Make a POST request to the Gripp API
- `put` - Make a PUT request to the Gripp API
- `delete` - Make a DELETE request to the Gripp API

### 3. `src/db/unified/api.ts` (GrippApiClient class)

**Description**: Simplified API client.

**Key Features**:
- Fetch-based HTTP client
- Basic error handling

**Methods**:
- `request` - Make a request to the Gripp API

## API Routes

### 1. `src/api/routes/index.ts`

**Description**: Main API routes file.

**Routes**:
- `/api/v1/projects` - Project-related endpoints
- `/api/v1/employees` - Employee-related endpoints
- `/api/v1/invoices` - Invoice-related endpoints
- `/api/v1/sync` - Sync-related endpoints
- `/api/v1/health` - Health check endpoint
- `/api/v1/cache` - Cache-related endpoints
- `/api/v1/debug` - Debug endpoints
- `/api/v1/dashboard` - Dashboard-related endpoints

## Recommended Consolidation

Based on the analysis, we recommend the following consolidation:

### API Server

Standardize on `src/api/gripp/api-server-v2.ts` as the primary API server. This server has the most advanced features, including:
- Improved error handling
- Rate limiting
- Consistent API structure
- Better logging

### API Client

Standardize on `src/db/unified/api/gripp/client.ts` as the primary API client. This client has the most advanced features, including:
- Advanced error handling
- Rate limiting
- Request retries
- Request queuing

### API Routes

Keep the current API routes structure in `src/api/routes/index.ts`. This provides a clean and organized way to manage API endpoints.

## Implementation Steps

1. Update all imports to use the recommended API server and client
2. Remove or archive the unused API server and client implementations
3. Update package.json scripts to use only the recommended API server
4. Test all API endpoints to ensure they work correctly
