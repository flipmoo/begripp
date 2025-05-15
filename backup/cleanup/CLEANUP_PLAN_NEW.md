# Comprehensive Cleanup Plan

## Current State Analysis

After a thorough analysis of the codebase, we've identified several areas that need to be cleaned up to ensure a solid foundation for merging with another project. This document outlines the current state and provides a detailed plan for cleanup.

### Database Structure

We currently have two database files:
1. `./database.sqlite` - Contains the unified schema with entities, projects, invoices, etc.
2. `./src/db/database.sqlite` - Contains the original schema with employees, contracts, hours, etc.

The codebase has references to both database files, which can lead to confusion and potential data inconsistencies.

### API Structure

Multiple API server implementations exist:
1. `src/api/gripp/api-server.ts` - Original API server
2. `src/api/gripp/api-server-v2.ts` - Updated API server with improved structure
3. `src/api/gripp/simple-api-server.ts` - Simplified API server
4. `src/api/gateway.js` - API gateway for domain-specific routes

### API Clients

Multiple API client implementations:
1. `src/api/gripp/client.ts` - Original client
2. `src/db/unified/api/gripp/client.ts` - Unified client with improved error handling
3. `src/db/unified/api.ts` (GrippApiClient class) - Simplified client

### Backup and Debug Files

- `backup/` directory contains old versions of files
- `debug-scripts/` directory contains debugging scripts
- Various test files scattered throughout the codebase

## Cleanup Plan

### 1. Database Consolidation

**Goal**: Consolidate to a single database file with a clear schema.

**Actions**:
- [ ] Determine which database schema is the current production version
- [ ] Migrate any necessary data from the old database to the new one
- [ ] Update all database references to point to a single database file
- [ ] Remove or archive the unused database file
- [ ] Update documentation to reflect the current database structure

### 2. API Server Consolidation

**Goal**: Standardize on a single API server implementation.

**Actions**:
- [ ] Identify the primary API server currently in use (likely `api-server-v2.ts`)
- [ ] Ensure all necessary endpoints are implemented in the primary server
- [ ] Update scripts in package.json to use only the primary server
- [ ] Archive or remove unused API server implementations
- [ ] Update documentation to reflect the current API structure

### 3. API Client Consolidation

**Goal**: Standardize on a single API client implementation.

**Actions**:
- [ ] Identify the primary API client currently in use
- [ ] Ensure all necessary functionality is implemented in the primary client
- [ ] Update all references to use only the primary client
- [ ] Archive or remove unused client implementations
- [ ] Update documentation to reflect the current client structure

### 4. Cleanup Backup and Debug Files

**Goal**: Remove unnecessary files that could cause confusion.

**Actions**:
- [ ] Review backup files to ensure no unique functionality is lost
- [ ] Archive or remove backup files
- [ ] Review debug scripts to ensure no unique functionality is lost
- [ ] Archive or remove debug scripts
- [ ] Remove any test data or test-specific code

### 5. Documentation Update

**Goal**: Ensure documentation accurately reflects the current state of the project.

**Actions**:
- [ ] Update README.md with clear instructions
- [ ] Create or update API documentation
- [ ] Document database structure
- [ ] Create a migration guide for future developers

## Implementation Plan

We'll implement this cleanup plan in the following order:

1. Database consolidation
2. API server consolidation
3. API client consolidation
4. Backup and debug file cleanup
5. Documentation update

Each step will be carefully executed to ensure no functionality is lost and the application continues to work as expected.
