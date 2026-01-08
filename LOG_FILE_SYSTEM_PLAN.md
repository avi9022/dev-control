# Implementation Plan: Optimized Log File System with Virtualization

## Overview

Optimize the log system to handle large log files efficiently by:

1. Limiting in-memory cache to 1000 logs maximum
2. Implementing virtual scrolling to render only visible logs
3. Loading logs on-demand when scrolling (pagination)
4. Implementing file-based search that searches the entire log file
5. Maintaining real-time log streaming for new logs

---

## Step 1: Enhance Log File Manager with Pagination and Search

**Location:** `src/electron/utils/log-file-manager.ts`

**New Functions to Create:**

1. `readLogFileChunk(dirId: string, offset: number, limit: number): Promise<string[]>`

   - Reads a specific chunk of logs from the file
   - `offset`: Starting line number (0-indexed)
   - `limit`: Maximum number of lines to read
   - Returns array of log lines
   - Handles file boundaries gracefully

2. `readLogFileTail(dirId: string, limit: number): Promise<string[]>`

   - Reads the last N lines from the file (for initial load)
   - More efficient than reading entire file and slicing
   - Uses reverse reading or counts total lines first

3. `getLogFileLineCount(dirId: string): Promise<number>`

   - Counts total number of lines in the log file
   - Needed for pagination and scroll position calculations
   - Can be optimized by caching or using file stats

4. `searchLogFile(dirId: string, searchTerm: string): Promise<Array<{ lineNumber: number, line: string }>>`

   - Searches entire log file for matching lines
   - Returns array of objects with line number and content
   - Case-insensitive search
   - Handles large files efficiently (streaming read)

5. `readLogFileRange(dirId: string, startLine: number, endLine: number): Promise<string[]>`
   - Reads a specific range of lines from the file
   - Used for loading logs around a specific line (e.g., search result)

**Considerations:**

- For large files, consider streaming reads instead of loading entire file
- Cache line count per file to avoid repeated counting
- Handle file growth during reads (new logs being written)

---

## Step 2: Add IPC Handlers for Pagination and Search

**Location:** `src/electron/main.ts`

**New IPC Handlers:**

1. `ipcMainHandle('getLogsChunk', async (_event, dirId: string, offset: number, limit: number) => ...)`

   - Calls `readLogFileChunk(dirId, offset, limit)`
   - Returns array of log lines

2. `ipcMainHandle('getLogsTail', async (_event, dirId: string, limit: number) => ...)`

   - Calls `readLogFileTail(dirId, limit)`
   - Returns last N lines

3. `ipcMainHandle('getLogFileLineCount', async (_event, dirId: string) => ...)`

   - Calls `getLogFileLineCount(dirId)`
   - Returns total line count

4. `ipcMainHandle('searchLogs', async (_event, dirId: string, searchTerm: string) => ...)`

   - Calls `searchLogFile(dirId, searchTerm)`
   - Returns array of matching lines with line numbers

5. `ipcMainHandle('getLogsRange', async (_event, dirId: string, startLine: number, endLine: number) => ...)`
   - Calls `readLogFileRange(dirId, startLine, endLine)`
   - Returns array of log lines in range

---

## Step 3: Update Preload Script

**Location:** `src/electron/preload.cts`

**Add to electron API:**

- `getLogsChunk: (dirId: string, offset: number, limit: number) => Promise<string[]>`
- `getLogsTail: (dirId: string, limit: number) => Promise<string[]>`
- `getLogFileLineCount: (dirId: string) => Promise<number>`
- `searchLogs: (dirId: string, searchTerm: string) => Promise<Array<{ lineNumber: number, line: string }>>`
- `getLogsRange: (dirId: string, startLine: number, endLine: number) => Promise<string[]>`

---

## Step 4: Update TypeScript Type Definitions

**Location:** `types.d.ts`

**Add to EventPayloadMapping:**

- `getLogsChunk: { return: string[]; args: [string, number, number] }`
- `getLogsTail: { return: string[]; args: [string, number] }`
- `getLogFileLineCount: { return: number; args: [string] }`
- `searchLogs: { return: Array<{ lineNumber: number, line: string }>; args: [string, string] }`
- `getLogsRange: { return: string[]; args: [string, number, number] }`

**Add to Window.electron interface:**

- `getLogsChunk: (dirId: string, offset: number, limit: number) => Promise<string[]>`
- `getLogsTail: (dirId: string, limit: number) => Promise<string[]>`
- `getLogFileLineCount: (dirId: string) => Promise<number>`
- `searchLogs: (dirId: string, searchTerm: string) => Promise<Array<{ lineNumber: number, line: string }>>`
- `getLogsRange: (dirId: string, startLine: number, endLine: number) => Promise<string[]>`

---

## Step 5: Refactor Logger Context with Memory Limits

**Location:** `src/ui/contexts/logger.tsx`

**Changes:**

1. **Memory Management:**

   - Limit `logsCacheByDirId` to maximum 1000 logs per directory
   - When cache exceeds limit, remove oldest logs (FIFO)
   - Track which line range is currently cached for each directory
   - Store metadata: `{ logs: string[], startLine: number, endLine: number, totalLines: number }`

2. **Update `getLogsByDirId`:**

   - Change signature to support pagination: `getLogsByDirId(id: string, offset?: number, limit?: number): Promise<string[]>`
   - Load from file if requested range not in cache
   - Update cache with new chunk, respecting 1000 log limit
   - Return requested chunk

3. **Add new methods:**

   - `getLogsTail(id: string, limit: number): Promise<string[]>` - Get last N logs
   - `getTotalLineCount(id: string): Promise<number>` - Get total lines in file
   - `searchLogs(id: string, searchTerm: string): Promise<Array<{ lineNumber: number, line: string }>>` - Search in file
   - `loadLogsChunk(id: string, offset: number, limit: number): Promise<string[]>` - Load specific chunk

4. **Cache Management:**

   - When new logs arrive via subscription, append to cache
   - If cache exceeds 1000 logs, remove oldest entries
   - Update `totalLines` count when new logs arrive
   - Track cache boundaries to know what's loaded

5. **Real-time Updates:**
   - Continue subscribing to new logs
   - Append new logs to cache (respecting 1000 limit)
   - Update total line count
   - Notify components of new logs for scroll-to-bottom functionality

---

## Step 6: Implement Virtual Scrolling in Terminal Component

**Location:** `src/ui/components/Terminal.tsx`

**Changes:**

1. **Install/Use Virtual Scrolling Library:**

   - Consider using `react-window` or `react-virtualized` for virtualization
   - Or implement custom virtual scrolling if preferred
   - Only render visible log lines in viewport

2. **State Management:**

   - `const [logs, setLogs] = useState<string[]>([])` - Currently visible logs
   - `const [totalLines, setTotalLines] = useState<number>(0)` - Total lines in file
   - `const [loadedRange, setLoadedRange] = useState<{ start: number, end: number }>({ start: 0, end: 0 })` - Currently loaded range
   - `const [scrollPosition, setScrollPosition] = useState<number>(0)` - Current scroll position
   - `const [isLoading, setIsLoading] = useState<boolean>(false)` - Loading state

3. **Initial Load:**

   - Load last 1000 lines (or less if file is smaller) using `getLogsTail`
   - Set `totalLines` from `getLogFileLineCount`
   - Position scroll at bottom (newest logs)

4. **Scroll Handling:**

   - Detect when user scrolls near top or bottom of loaded range
   - When scrolling up near top: Load previous chunk (e.g., 500 lines before current start)
   - When scrolling down near bottom: Load next chunk (e.g., 500 lines after current end)
   - Update `loadedRange` and `logs` state
   - Maintain scroll position relative to content

5. **Virtual Scrolling Implementation:**

   - Calculate which lines should be visible based on scroll position
   - Only render visible lines + small buffer (e.g., 50 lines above/below)
   - Use fixed height per line or measure dynamically
   - Handle variable line heights if needed

6. **Search Functionality:**

   - When user searches, call `searchLogs` to get matching lines
   - Display search results (can show all matches or paginate)
   - When clicking a search result, load that line's context (e.g., ±100 lines around it)
   - Highlight search matches in rendered lines
   - Navigate between search results

7. **Real-time Updates:**

   - When new logs arrive via subscription, append to current logs if at bottom
   - If not at bottom, update `totalLines` but don't modify visible logs
   - Show indicator if new logs are available when scrolled up
   - Auto-scroll to bottom only if user was already at bottom

8. **Performance Optimizations:**
   - Debounce scroll events
   - Use `useMemo` for filtered/search results
   - Use `React.memo` for log line components if needed
   - Lazy load chunks only when needed

---

## Step 7: Update Search Functionality

**Location:** `src/ui/components/Terminal.tsx`

**Changes:**

1. **Search Flow:**

   - User enters search term
   - Call `searchLogs(dirId, searchTerm)` - searches entire file
   - Display search results with line numbers
   - Allow user to click result to jump to that line
   - Load context around selected line (e.g., ±50 lines)

2. **Search Results Display:**

   - Show list of matching lines (can be virtualized if many results)
   - Display line number and preview of line
   - Clicking result loads that section of logs
   - Highlight matches in rendered logs

3. **Search Navigation:**
   - Previous/Next buttons to navigate between matches
   - Show "X of Y matches" indicator
   - Scroll to match when navigating

---

## Step 8: Handle Edge Cases

**Considerations:**

1. **File Growth During Read:**

   - Log file may grow while reading chunks
   - Handle race conditions gracefully
   - Consider locking or versioning

2. **Very Large Files:**

   - Files with millions of lines
   - Optimize line counting (cache result, update on append)
   - Consider log rotation if files get too large

3. **Concurrent Access:**

   - Multiple reads happening simultaneously
   - File being written while reading
   - Use read streams for safety

4. **Memory Management:**

   - Ensure cache never exceeds 1000 logs per directory
   - Clean up old cache entries when switching directories
   - Monitor memory usage

5. **Scroll Position Preservation:**

   - When loading new chunks, maintain user's relative position
   - Handle edge cases (top/bottom of file)
   - Smooth scrolling experience

6. **Performance:**

   - Large search results (thousands of matches)
   - Virtualize search results list if needed
   - Debounce search input

7. **Error Handling:**
   - File read errors
   - Network/IPC errors
   - Graceful degradation

---

## Step 9: Testing Considerations

**Test Scenarios:**

1. **Memory Limits:**

   - Verify cache never exceeds 1000 logs
   - Test with files larger than 1000 lines
   - Verify old logs are removed when limit reached

2. **Virtual Scrolling:**

   - Test scrolling through large files (10k+ lines)
   - Verify only visible lines are rendered
   - Test scroll performance

3. **Pagination:**

   - Test loading chunks when scrolling
   - Verify correct chunks are loaded
   - Test edge cases (top/bottom of file)

4. **Search:**

   - Test searching large files
   - Test with many matches
   - Test jumping to search results
   - Test search while scrolling

5. **Real-time Updates:**

   - Test new logs arriving while scrolled up
   - Test new logs arriving while at bottom
   - Verify total line count updates

6. **Performance:**
   - Test with very large files (100k+ lines)
   - Monitor memory usage
   - Test scroll smoothness

---

## Implementation Order

1. Step 1: Enhance log file manager with pagination and search functions
2. Step 2: Add IPC handlers for new functions
3. Step 3: Update preload script
4. Step 4: Update type definitions
5. Step 5: Refactor logger context with memory limits
6. Step 6: Implement virtual scrolling in Terminal component
7. Step 7: Update search functionality
8. Step 8: Handle edge cases
9. Step 9: Test thoroughly

---

## File Structure Summary

**Modified files:**

- `src/electron/utils/log-file-manager.ts` - Add pagination and search functions
- `src/electron/main.ts` - Add IPC handlers
- `src/electron/preload.cts` - Expose new functions
- `types.d.ts` - Add type definitions
- `src/ui/contexts/logger.tsx` - Refactor with memory limits
- `src/ui/components/Terminal.tsx` - Implement virtualization and search

**New dependencies (if needed):**

- `react-window` or `react-virtualized` for virtualization (or custom implementation)

---

## Key Design Decisions

1. **1000 Log Limit:** Maximum logs in memory cache per directory. When exceeded, oldest logs are removed (FIFO).

2. **Chunk Size:** Load 500-1000 lines per chunk for good balance between memory and performance.

3. **Initial Load:** Load last 1000 lines (most recent) by default, positioned at bottom.

4. **Virtual Scrolling:** Only render visible lines + small buffer for smooth scrolling.

5. **Search Strategy:** Search entire file, return all matches with line numbers, then load context around selected match.

6. **Real-time Updates:** Append new logs to cache if at bottom, otherwise just update total count.

---

This plan maintains backward compatibility while adding efficient handling of large log files through virtualization and pagination.

---

## Implementation Status

- [x] Step 1: Enhance Log File Manager with Pagination and Search
- [x] Step 2: Add IPC Handlers for Pagination and Search
- [x] Step 3: Update Preload Script
- [x] Step 4: Update TypeScript Type Definitions
- [x] Step 5: Refactor Logger Context with Memory Limits
- [x] Step 6: Implement Virtual Scrolling in Terminal Component
- [x] Step 7: Update Search Functionality
- [x] Step 8: Handle Edge Cases
- [x] Step 9: Testing Considerations

---

# Infinite Scroll Implementation Plan

## Problem Statement

The current scroll-based loading implementation gets stuck when scrolling fast to the top. The reactive loading approach cannot keep up with fast scrolling, causing the UI to freeze or get stuck.

## New Approach: Window-Based Infinite Scroll

Instead of reactively loading chunks based on scroll position, we'll implement a **window-based** approach where we maintain a "window" of loaded logs around the current viewport, and proactively load more as the user scrolls.

---

## Step 1: Redesign Log Loading Strategy

**Concept:** Maintain a sliding window of logs

**Key Changes:**

1. **Window Size:** Keep a fixed window of logs (e.g., 2000 lines) centered around the viewport
2. **Preload Zones:** Define "preload zones" - when user scrolls within X% of window edges, preload more
3. **Window Sliding:** When window needs to shift, load new data and unload old data
4. **Virtual Rendering:** Only render visible lines + buffer (e.g., 50 lines above/below viewport)

**Window Management:**

- Track: `windowStart`, `windowEnd`, `viewportStart`, `viewportEnd`
- When viewport approaches window boundaries, expand window by loading more
- When window exceeds max size, trim from the opposite end

---

## Step 2: Implement Window Manager

**Location:** `src/ui/components/Terminal.tsx` (or new hook: `useLogWindow.ts`)

**Functions to Create:**

1. `calculateWindow(currentScrollTop, scrollHeight, totalLines, windowSize)`

   - Calculates which lines should be in the current window
   - Returns: `{ windowStart, windowEnd, viewportStart, viewportEnd }`

2. `shouldPreload(windowStart, windowEnd, viewportStart, viewportEnd, preloadThreshold)`

   - Determines if we need to load more logs
   - Returns: `{ loadUp: boolean, loadDown: boolean, amount: number }`

3. `loadWindow(dirId, windowStart, windowEnd)`
   - Loads logs for the specified window range
   - Returns: `{ logs: string[], startLine: number, endLine: number }`

**State Management:**

- `windowStart`: First line number in current window
- `windowEnd`: Last line number in current window
- `viewportStart`: First visible line in viewport
- `viewportEnd`: Last visible line in viewport
- `totalLines`: Total lines in file
- `loadedLogs`: Array of logs currently in window (indexed by line number relative to windowStart)

---

## Step 3: Implement Virtual Scrolling with Fixed Line Heights

**Approach:** Use fixed line height for simpler calculations

**Implementation:**

1. **Calculate visible range:**

   - `lineHeight = 20px` (or measure dynamically)
   - `visibleStart = Math.floor(scrollTop / lineHeight)`
   - `visibleEnd = Math.ceil((scrollTop + containerHeight) / lineHeight)`
   - `buffer = 50` lines
   - `renderStart = Math.max(0, visibleStart - buffer)`
   - `renderEnd = Math.min(totalLines, visibleEnd + buffer)`

2. **Render only visible lines:**

   - Create a spacer div for lines above viewport
   - Render only lines in `[renderStart, renderEnd]` range
   - Create a spacer div for lines below viewport

3. **Maintain scroll position:**
   - Use `transform: translateY()` or absolute positioning
   - Or use a library like `react-window` or `react-virtualized`

---

## Step 4: Implement Proactive Loading

**Strategy:** Load before user reaches window boundaries

**Implementation:**

1. **Preload Zones:**

   - When viewport is within 20% of window top → preload above
   - When viewport is within 20% of window bottom → preload below

2. **Loading Logic:**

   ```
   if (viewportStart < windowStart + (windowSize * 0.2)) {
     // Preload more lines above
     loadWindow(dirId, windowStart - CHUNK_SIZE, windowStart - 1)
   }

   if (viewportEnd > windowEnd - (windowSize * 0.2)) {
     // Preload more lines below
     loadWindow(dirId, windowEnd + 1, windowEnd + CHUNK_SIZE)
   }
   ```

3. **Window Trimming:**
   - When window exceeds MAX_WINDOW_SIZE (e.g., 2000 lines)
   - Trim from the end furthest from viewport
   - Keep at least WINDOW_SIZE lines around viewport

---

## Step 5: Optimize Scroll Event Handling

**Improvements:**

1. **Use `requestAnimationFrame` for scroll handling:**

   - Batch scroll calculations
   - Only process scroll events on animation frames

2. **Throttle scroll events:**

   - Use `requestAnimationFrame` throttling instead of timeout debouncing
   - More responsive for fast scrolling

3. **Separate scroll detection from loading:**
   - Scroll handler only calculates viewport position
   - Separate effect watches viewport position and triggers loading
   - Prevents blocking scroll performance

---

## Step 6: Implement Smooth Window Transitions

**When window shifts:**

1. **Calculate new window position**
2. **Load new data** (async)
3. **Update window state** (triggers re-render)
4. **Adjust scroll position** to maintain user's relative position

**Scroll Position Maintenance:**

- Store: `scrollRatio = scrollTop / scrollHeight` before load
- After load: `newScrollTop = scrollRatio * newScrollHeight`
- Use `requestAnimationFrame` to apply scroll smoothly

---

## Step 7: Handle Edge Cases

**Considerations:**

1. **Very fast scrolling:**

   - Queue multiple load requests
   - Process sequentially
   - Cancel outdated requests

2. **Window at file boundaries:**

   - Top of file: `windowStart === 0`
   - Bottom of file: `windowEnd === totalLines - 1`
   - Don't try to load beyond boundaries

3. **File growth during scroll:**

   - New logs arrive → update `totalLines`
   - If at bottom, expand window down
   - If scrolled up, just update total count

4. **Memory management:**
   - Keep window size reasonable (2000-3000 lines max)
   - Trim aggressively when window gets too large
   - Clear window when switching directories

---

## Step 8: Consider Using a Virtual Scrolling Library

**Option A: Use `react-window`**

- Pros: Battle-tested, performant, handles edge cases
- Cons: Additional dependency, might need customization

**Option B: Custom implementation**

- Pros: Full control, no dependencies
- Cons: More code to maintain, need to handle edge cases

**Recommendation:** Start with custom implementation, migrate to `react-window` if needed

---

## Step 9: Testing Strategy

**Test Scenarios:**

1. **Fast scrolling to top:**

   - Scroll wheel fast to top
   - Should load smoothly without getting stuck
   - Should maintain scroll position

2. **Fast scrolling to bottom:**

   - Scroll wheel fast to bottom
   - Should load new logs smoothly

3. **Jump scrolling:**

   - Click scrollbar and drag quickly
   - Should load appropriate window

4. **Large files:**

   - Test with 100k+ line files
   - Should remain performant
   - Memory should stay reasonable

5. **Real-time updates:**
   - New logs arriving while scrolled up
   - Should update total count
   - Should not disrupt scroll position

---

## Implementation Order

1. Step 1: Redesign log loading strategy (window-based approach)
2. Step 2: Implement window manager functions
3. Step 3: Implement virtual scrolling with fixed heights
4. Step 4: Implement proactive loading with preload zones
5. Step 5: Optimize scroll event handling
6. Step 6: Implement smooth window transitions
7. Step 7: Handle edge cases
8. Step 8: Consider virtual scrolling library (optional)
9. Step 9: Test thoroughly

---

## Key Design Decisions

1. **Window Size:** 2000 lines (configurable)

   - Large enough to handle fast scrolling
   - Small enough to keep memory reasonable

2. **Preload Threshold:** 20% of window size

   - Start loading when viewport is 400 lines from window edge
   - Gives enough time for async loading

3. **Chunk Size:** 500 lines per load

   - Balance between load time and memory

4. **Render Buffer:** 50 lines above/below viewport

   - Smooth scrolling without gaps
   - Not too large to impact performance

5. **Fixed Line Height:** Use estimated or measured height
   - Simplifies calculations
   - Can measure dynamically if needed

---

## Alternative Approach: Use react-window

If custom implementation proves difficult, consider:

1. Install `react-window`: `npm install react-window @types/react-window`
2. Use `VariableSizeList` or `FixedSizeList` component
3. Implement `itemData` with log lines
4. Handle loading in `onItemsRendered` callback
5. Load chunks when items near boundaries

This would simplify the implementation significantly but adds a dependency.

---

## Implementation Status

- [x] Step 1: Redesign log loading strategy
- [x] Step 2: Implement window manager functions
- [x] Step 3: Implement virtual scrolling with fixed heights
- [x] Step 4: Implement proactive loading with preload zones
- [x] Step 5: Optimize scroll event handling
- [x] Step 6: Implement smooth window transitions
- [x] Step 7: Handle edge cases
- [ ] Step 8: Consider virtual scrolling library (optional)
- [ ] Step 9: Test thoroughly
