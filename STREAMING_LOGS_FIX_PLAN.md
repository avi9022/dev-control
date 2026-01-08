# Plan: Fix Streaming Logs Rendering Issues

## Problem Analysis

When logs stream in rapidly (services running), we see:
1. **Logs rendering on top of each other** - Multiple DOM nodes with same `top` position
2. **Duplicate rendering** - Same log line appears multiple times
3. **Flickering** - Logs appear/disappear rapidly during scrolling

### Root Causes

1. **No Batching**: Each incoming log triggers `setWindow()` immediately, causing multiple rapid re-renders
2. **State Race Conditions**: When logs arrive faster than React can render, `visibleLogs` may calculate with stale `window` state
3. **React Key Instability**: Using only `lineNumber` as key means React might incorrectly reuse DOM nodes when the same lineNumber appears in different render cycles
4. **Non-Atomic Window Updates**: `startLine`, `endLine`, and `logs` array might be out of sync during rapid updates

## Solution Strategy

### Phase 1: Batch Incoming Logs (Critical)
- **Goal**: Accumulate incoming logs and flush them in batches instead of updating on every single log
- **Implementation**:
  - Use a `useRef` to accumulate incoming logs: `pendingLogsRef = useRef<string[]>([])`
  - Use `requestAnimationFrame` or `setTimeout` to flush accumulated logs periodically
  - Flush when:
    - Batch reaches 10 logs (configurable)
    - OR 50ms has passed since last flush
    - OR user scrolls away from bottom (stop auto-scrolling)
- **Benefits**: Reduces re-renders from N per second to ~20 per second max

### Phase 2: Stabilize React Keys
- **Goal**: Ensure React keys are unique and stable across renders
- **Implementation**:
  - Change key from `key={lineNumber}` to `key={`log-${lineNumber}-${window.startLine}`}`
  - This ensures keys are unique even if the same lineNumber appears in different window positions
  - Alternative: Use a hash of line content + lineNumber for true uniqueness
- **Benefits**: Prevents React from incorrectly reusing DOM nodes

### Phase 3: Atomic Window Updates
- **Goal**: Ensure `startLine`, `endLine`, and `logs` are always updated together atomically
- **Implementation**:
  - Create a helper function `updateWindowAtomically(newWindow: LogWindow)` that:
    - Updates `windowRef.current` immediately
    - Calls `setWindow(newWindow)` in a single state update
  - Use this helper in all places that modify the window (live logs, expandWindowUp, expandWindowDown)
- **Benefits**: Prevents intermediate states where window bounds don't match the logs array

### Phase 4: Optimize Visible Logs Calculation
- **Goal**: Prevent `visibleLogs` from calculating with stale window state
- **Implementation**:
  - Add a check: if `window.logs.length !== (window.endLine - window.startLine + 1)`, return empty array
  - This detects when window state is inconsistent and prevents rendering bad data
  - Log a warning in development to catch these cases
- **Benefits**: Fails gracefully instead of rendering incorrect/overlapping logs

### Phase 5: Debounce Scroll Updates During Streaming
- **Goal**: Prevent flickering when scrolling while logs are streaming
- **Implementation**:
  - When `autoScroll` is true and logs are streaming, throttle viewport updates
  - Only update viewport every 100ms during active streaming
  - This prevents rapid recalculations of `visibleLogs` while scrolling
- **Benefits**: Smoother scrolling experience during high log volume

## Implementation Order

1. **Phase 1 (Batching)** - Highest priority, fixes the core issue
2. **Phase 2 (Stable Keys)** - Prevents React DOM reuse bugs
3. **Phase 3 (Atomic Updates)** - Ensures data consistency
4. **Phase 4 (Validation)** - Safety net for edge cases
5. **Phase 5 (Debouncing)** - Polish for smooth UX

## Testing Checklist

After implementation, verify:
- [ ] Logs stream in smoothly without overlapping
- [ ] No duplicate log lines appear
- [ ] Scrolling works smoothly while logs are streaming
- [ ] No flickering when scrolling up/down during streaming
- [ ] Auto-scroll to bottom works correctly
- [ ] Manual scrolling (away from bottom) stops auto-scroll correctly
- [ ] Window expansion (loading older logs) still works
- [ ] Window expansion (loading newer logs) still works
- [ ] Search functionality still works
- [ ] Performance is acceptable with high log volume (100+ logs/sec)

## Rollback Plan

If issues persist:
1. Keep Phase 1 (batching) - this is always beneficial
2. Revert Phase 2 if key changes cause issues
3. Keep Phase 3 (atomic updates) - this is a best practice
4. Phase 4 and 5 are optional optimizations

