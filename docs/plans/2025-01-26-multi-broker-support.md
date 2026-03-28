# Multi-Broker Support Design

**Date:** 2025-01-26
**Status:** Approved
**Author:** Claude + Yarin

## Overview

Add support for multiple message brokers (ElasticMQ and RabbitMQ) with a unified interface, configurable settings, and seamless switching between brokers.

## Current State Issues

1. **Hardcoded endpoint** - `http://localhost:9324` in `utils/sqs.ts`
2. **Aggressive polling loop** - Continuously retries on connection failure
3. **No configuration UI** - Cannot change broker settings
4. **Single broker only** - No RabbitMQ support

## Design Goals

- Support ElasticMQ (SQS API) and RabbitMQ (Management HTTP API)
- Configurable connection settings per broker
- Visual connection status indicator
- Single connection attempt (no retry loops)
- Persist broker preference across sessions
- Unified interface for all queue operations

---

## Data Models

### BrokerType
```typescript
type BrokerType = 'elasticmq' | 'rabbitmq'
```

### BrokerConfig
```typescript
interface BrokerConfig {
  type: BrokerType
  host: string
  port: number
  username: string
  password: string
  useHttps: boolean
}
```

### BrokerConnectionState
```typescript
interface BrokerConnectionState {
  type: BrokerType
  isConnected: boolean
  lastError?: string
  lastChecked?: number
}
```

### Default Configurations
```typescript
const DEFAULT_BROKER_CONFIGS: Record<BrokerType, BrokerConfig> = {
  elasticmq: {
    type: 'elasticmq',
    host: 'localhost',
    port: 9324,
    username: 'root',
    password: 'root',
    useHttps: false
  },
  rabbitmq: {
    type: 'rabbitmq',
    host: 'localhost',
    port: 15671,
    username: 'user',
    password: 'bitnami',
    useHttps: true
  }
}
```

### Store Schema Additions
```typescript
interface StoreSchema {
  // ... existing fields
  activeBroker: BrokerType
  brokerConfigs: Record<BrokerType, BrokerConfig>
}
```

---

## IPC API

### New Handlers

| Handler | Input | Output | Description |
|---------|-------|--------|-------------|
| `getBrokerConfigs` | - | `BrokerConfig[]` | Get all broker configurations |
| `saveBrokerConfig` | `BrokerConfig` | `void` | Save/update a broker config |
| `getActiveBroker` | - | `BrokerType` | Get currently active broker |
| `setActiveBroker` | `BrokerType` | `void` | Switch active broker |
| `testBrokerConnection` | `BrokerType` | `BrokerConnectionState` | Test connection once |

### New Subscription

| Event | Payload | Description |
|-------|---------|-------------|
| `brokerConnectionState` | `BrokerConnectionState` | Push connection state changes |

---

## Backend Architecture

### File Structure
```
src/electron/
├── brokers/
│   ├── types.ts                 # Shared types and interfaces
│   ├── defaults.ts              # Default configurations
│   ├── broker-manager.ts        # Active broker management
│   ├── elasticmq/
│   │   ├── client.ts            # SQS client factory
│   │   ├── operations.ts        # Queue operations
│   │   └── connection.ts        # Connection testing
│   └── rabbitmq/
│       ├── client.ts            # HTTP client setup
│       ├── operations.ts        # Queue operations
│       └── connection.ts        # Connection testing
```

### BrokerClient Interface
```typescript
interface BrokerClient {
  // Connection
  testConnection(): Promise<BrokerConnectionState>

  // Queue Operations
  listQueues(): Promise<string[]>
  createQueue(name: string, options?: CreateQueueOptions): Promise<string>
  deleteQueue(queueUrl: string): Promise<void>
  purgeQueue(queueUrl: string): Promise<void>

  // Message Operations
  sendMessage(queueUrl: string, message: string): Promise<void>
  receiveMessages(queueUrl: string): Promise<QueueMessage[]>
  getQueueAttributes(queueUrl: string): Promise<QueueAttributes>
}
```

### BrokerManager
- Singleton managing the active broker client
- Handles broker switching
- Emits connection state changes
- Provides unified access to queue operations

---

## UI Components

### BrokerSelector Component
Location: `src/ui/components/BrokerSelector.tsx`

```
┌─────────────────────────────────────┐
│ 🟢 ElasticMQ            ▼     ⚙️   │
└─────────────────────────────────────┘
```

Features:
- Connection status indicator (green/red dot)
- Dropdown to select broker
- Settings gear button

### BrokerSettingsDialog Component
Location: `src/ui/components/BrokerSettingsDialog.tsx`

Fields:
- Host (text input)
- Port (number input)
- Username (text input)
- Password (password input)
- Use HTTPS (checkbox)
- Test Connection button
- Save button

### Empty State (No Connection)
Location: Updated in `QueuesList.tsx`

```
┌─────────────────────────────────────┐
│                                     │
│     ⚠️ Not Connected               │
│                                     │
│  Could not connect to ElasticMQ     │
│  on localhost:9324                  │
│                                     │
│  Check if the service is running    │
│                                     │
│         [Retry Connection]          │
│                                     │
└─────────────────────────────────────┘
```

---

## UI Integration

### QueuesMenu Layout
```
┌─────────────────────────────────────┐
│  🔍 Search...                  ✕    │
├─────────────────────────────────────┤
│  🟢 ElasticMQ            ▼    ⚙️   │  ← BrokerSelector
├─────────────────────────────────────┤
│  queue-list...                      │  ← QueuesList (or Empty State)
├─────────────────────────────────────┤
│  [+ Add Queue]                      │
└─────────────────────────────────────┘
```

### State Flow
1. App starts → Load `activeBroker` from store
2. Test connection → Update `BrokerConnectionState`
3. If connected → Start queue polling
4. If not connected → Show empty state with retry button
5. User switches broker → Save preference → Test new connection → Refresh queues

---

## Migration Plan

### Files to Deprecate
- `src/electron/utils/sqs.ts` → Move to `brokers/elasticmq/client.ts`
- `src/electron/sqs/*` → Refactor into `brokers/elasticmq/operations.ts`

### Breaking Changes
None - existing functionality preserved, new features additive.

---

## RabbitMQ Management API Reference

**Base URL:** `https://localhost:15671/api`

| Operation | Method | Endpoint |
|-----------|--------|----------|
| List queues | GET | `/api/queues` |
| Get queue | GET | `/api/queues/{vhost}/{name}` |
| Create queue | PUT | `/api/queues/{vhost}/{name}` |
| Delete queue | DELETE | `/api/queues/{vhost}/{name}` |
| Purge queue | DELETE | `/api/queues/{vhost}/{name}/contents` |
| Publish message | POST | `/api/exchanges/{vhost}/{exchange}/publish` |
| Get messages | POST | `/api/queues/{vhost}/{name}/get` |

**Authentication:** Basic Auth (user:bitnami)

---

## Testing Checklist

- [ ] ElasticMQ connection works with default settings
- [ ] RabbitMQ connection works with default settings
- [ ] Can switch between brokers
- [ ] Settings are persisted across app restarts
- [ ] Connection failure shows helpful error message
- [ ] Retry button works
- [ ] Queue operations work for both brokers
- [ ] No polling loop on connection failure
