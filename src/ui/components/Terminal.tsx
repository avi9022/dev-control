import { useEffect, useRef, useState, useMemo, useCallback, type FC } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronLeft, ChevronRight, CircleX, Trash2 } from "lucide-react";
import { useLogger } from "../contexts/logger";
import { Tooltip, TooltipContent } from "@/components/ui/tooltip";
import { TooltipTrigger } from "@radix-ui/react-tooltip";

interface TerminalProps {
  id: string
  height?: string | number;
}

interface HighlightToken {
  regex: RegExp;
  className: string;
}

const LEVEL_PREFIXES: Record<string, string> = {
  ERROR: "text-red-500 font-semibold",
  WARN: "text-yellow-500 font-semibold",
  INFO: "text-green-500 font-semibold",
  DEBUG: "text-blue-400 font-semibold",
  TRACE: "text-gray-400 italic",
};

const IN_LINE_TOKENS: HighlightToken[] = [
  { regex: /\berror\b/i, className: "text-red-400" },
  { regex: /\bfail(?:ed)?\b/i, className: "text-red-400" },
  { regex: /\bexception\b/i, className: "text-red-400 italic" },
  { regex: /\bwarn(?:ing)?\b/i, className: "text-yellow-400" },
  { regex: /\bdeprecated\b/i, className: "text-yellow-400 italic" },
  { regex: /\binfo\b/i, className: "text-green-400" },
  { regex: /\bdebug\b/i, className: "text-yellow-400" },
  { regex: /\bstarted?\b/i, className: "text-green-400" },
];

// Window-based infinite scroll constants
const WINDOW_SIZE = 2000; // Lines to keep in memory
const CHUNK_SIZE = 500; // Lines to load per chunk
const PRELOAD_THRESHOLD = 0.2; // Preload when within 20% of window edge
const RENDER_BUFFER = 50; // Lines to render above/below viewport
const ESTIMATED_LINE_HEIGHT = 20; // Estimated height per line in pixels

interface LogWindow {
  startLine: number; // First line number in window (0-indexed)
  endLine: number; // Last line number in window (0-indexed)
  logs: string[]; // Log lines in window (indexed 0 = startLine)
}

export const Terminal: FC<TerminalProps> = ({ id }) => {
  const { getLogsTail, getTotalLineCount, loadLogsChunk, clearTerminal, searchLogs } = useLogger()
  const [totalLines, setTotalLines] = useState<number>(0);
  const [window, setWindow] = useState<LogWindow>({ startLine: 0, endLine: 0, logs: [] });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [viewport, setViewport] = useState<{ start: number; end: number; scrollTop: number; clientHeight: number }>({
    start: 0,
    end: 0,
    scrollTop: 0,
    clientHeight: 0
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ lineNumber: number, line: string }>>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const [heightUpdateTrigger, setHeightUpdateTrigger] = useState(0);

  // Refs for latest values
  const windowRef = useRef<LogWindow>({ startLine: 0, endLine: 0, logs: [] });
  const totalLinesRef = useRef<number>(0);
  const isLoadingRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const autoScrollRef = useRef<boolean>(true);
  const lastAutoScrollDropLogAtRef = useRef<number>(0);
  const lastScrollSetLogAtRef = useRef<number>(0);

  // Phase 1: Batching refs for streaming logs
  const pendingLogsRef = useRef<string[]>([]);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFlushTimeRef = useRef<number>(Date.now());

  // Dynamic height tracking for wrapped logs
  const lineHeightsRef = useRef<Map<number, number>>(new Map());
  const cumulativeHeightsRef = useRef<Map<number, number>>(new Map());

  // Keep refs in sync
  useEffect(() => {
    windowRef.current = window;
  }, [window]);

  useEffect(() => {
    totalLinesRef.current = totalLines;
  }, [totalLines]);

  useEffect(() => {
    autoScrollRef.current = autoScroll;
  }, [autoScroll]);

  // Phase 3: Atomic window update helper
  const updateWindowAtomically = useCallback((newWindow: LogWindow) => {
    windowRef.current = newWindow;
    setWindow(newWindow);
  }, []);

  const updateViewportFromEl = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const scrollTop = el.scrollTop;
    const clientHeight = el.clientHeight;
    const lineHeight = ESTIMATED_LINE_HEIGHT;

    const visibleStart = Math.floor(scrollTop / lineHeight);
    const visibleEnd = Math.ceil((scrollTop + clientHeight) / lineHeight);

    const start = Math.max(0, visibleStart - RENDER_BUFFER);
    const end = Math.min(totalLinesRef.current - 1, visibleEnd + RENDER_BUFFER);

    setViewport((prev) => {
      if (
        prev.start === start &&
        prev.end === end &&
        prev.scrollTop === scrollTop &&
        prev.clientHeight === clientHeight
      ) {
        return prev;
      }
      return { start, end, scrollTop, clientHeight };
    });
  }, []);

  // Check if we need to preload more logs
  const shouldPreload = useCallback((viewportStart: number, viewportEnd: number) => {
    const currentWindow = windowRef.current;
    const currentTotal = totalLinesRef.current;

    const windowSize = currentWindow.endLine - currentWindow.startLine + 1;
    const preloadZone = Math.floor(windowSize * PRELOAD_THRESHOLD);

    const viewportOutsideUp = viewportStart < currentWindow.startLine;
    const viewportOutsideDown = viewportEnd > currentWindow.endLine;

    // Load if viewport is outside the window OR if we're getting close to the edge
    const needsLoadUp =
      (viewportOutsideUp || viewportStart < currentWindow.startLine + preloadZone) &&
      currentWindow.startLine > 0;
    const needsLoadDown =
      (viewportOutsideDown || viewportEnd > currentWindow.endLine - preloadZone) &&
      currentWindow.endLine < currentTotal - 1;

    return {
      loadUp: needsLoadUp,
      loadDown: needsLoadDown,
      amount: CHUNK_SIZE
    };
  }, []);

  // Load window range from file
  const loadWindowRange = useCallback(async (startLine: number, endLine: number): Promise<string[]> => {
    try {
      const lineCount = endLine - startLine + 1;
      const logs = await loadLogsChunk(id, startLine, lineCount);
      return logs;
    } catch (error) {
      console.error('Failed to load window range:', error);
      return [];
    }
  }, [id, loadLogsChunk]);

  // Expand window upward
  const expandWindowUp = useCallback(async () => {
    if (isLoadingRef.current) return;

    const currentWindow = windowRef.current;

    if (currentWindow.startLine === 0) return; // Already at top

    isLoadingRef.current = true;
    try {
      const loadStart = Math.max(0, currentWindow.startLine - CHUNK_SIZE);
      const loadEnd = currentWindow.startLine - 1;

      const newLogs = await loadWindowRange(loadStart, loadEnd);

      if (newLogs.length > 0) {
        const newStart = loadStart;
        const allLogs = [...newLogs, ...currentWindow.logs];

        // Trim if window exceeds max size
        // When scrolling UP, keep the FIRST portion (earlier logs) so we don't lose what we just loaded
        const trimmedLogs = allLogs.length > WINDOW_SIZE
          ? allLogs.slice(0, WINDOW_SIZE)
          : allLogs;

        // Calculate the actual start and end lines of trimmed logs
        // trimmedLogs starts at newStart and has trimmedLogs.length logs
        const trimmedStart = newStart;
        const trimmedEnd = newStart + trimmedLogs.length - 1;

        const updatedWindow = {
          startLine: trimmedStart,
          endLine: trimmedEnd,
          logs: trimmedLogs
        };

        // Phase 3: Atomic update
        updateWindowAtomically(updatedWindow);

        // Maintain scroll position
        const el = scrollRef.current;
        if (el) {
          const oldScrollHeight = el.scrollHeight;
          requestAnimationFrame(() => {
            if (el) {
              const newScrollHeight = el.scrollHeight;
              const scrollDiff = newScrollHeight - oldScrollHeight;
              el.scrollTop += scrollDiff;
            }
          });
        }
      }
    } catch (error) {
      console.error('Failed to expand window up:', error);
    } finally {
      isLoadingRef.current = false;
    }
  }, [loadWindowRange, updateWindowAtomically]);

  // Expand window downward
  const expandWindowDown = useCallback(async () => {
    if (isLoadingRef.current) return;

    const currentWindow = windowRef.current;
    const currentTotal = totalLinesRef.current;

    if (currentWindow.endLine >= currentTotal - 1) return; // Already at bottom

    isLoadingRef.current = true;
    try {
      const loadStart = currentWindow.endLine + 1;
      const loadEnd = Math.min(currentTotal - 1, currentWindow.endLine + CHUNK_SIZE);

      const newLogs = await loadWindowRange(loadStart, loadEnd);

      if (newLogs.length > 0) {
        const allLogs = [...currentWindow.logs, ...newLogs];

        // Trim if window exceeds max size - keep the END portion (most recent logs)
        const trimmedLogs = allLogs.length > WINDOW_SIZE
          ? allLogs.slice(-WINDOW_SIZE)
          : allLogs;

        // Calculate the actual start line of trimmed logs.
        // If trimming happened, we dropped items from the beginning, so startLine MUST move forward.
        // If no trimming happened, this formula evaluates to currentWindow.startLine.
        const trimmedStart = loadEnd - trimmedLogs.length + 1;

        const updatedWindow = {
          startLine: trimmedStart,
          endLine: loadEnd,
          logs: trimmedLogs
        };

        // Phase 3: Atomic update
        updateWindowAtomically(updatedWindow);
      }
    } catch (error) {
      console.error('Failed to expand window down:', error);
    } finally {
      isLoadingRef.current = false;
    }
  }, [loadWindowRange, updateWindowAtomically]);

  // Initial load: get last WINDOW_SIZE lines
  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const loadInitialLogs = async () => {
      setIsLoading(true);
      try {
        const [loadedLogs, total] = await Promise.all([
          getLogsTail(id, WINDOW_SIZE),
          getTotalLineCount(id)
        ]);

        if (cancelled) return;

        // Handle empty file case
        if (total === 0 || loadedLogs.length === 0) {
          setWindow({
            startLine: 0,
            endLine: 0,
            logs: []
          });
          setTotalLines(total);
        } else {
          const startLine = Math.max(0, total - loadedLogs.length);
          const newWindow = {
            startLine,
            endLine: total - 1,
            logs: loadedLogs
          };

          // Phase 3: Atomic update
          updateWindowAtomically(newWindow);
          setTotalLines(total);
          totalLinesRef.current = total;
        }

        // Scroll to bottom after initial load - use multiple attempts to ensure it works
        const scrollToBottom = () => {
          if (!cancelled && scrollRef.current) {
            const el = scrollRef.current;
            const targetScroll = el.scrollHeight - el.clientHeight;
            if (targetScroll > 0) {
              el.scrollTop = targetScroll;
              updateViewportFromEl(el);

              // If scroll didn't work, try again
              if (el.scrollTop < targetScroll - 10) {
                setTimeout(scrollToBottom, 50);
              }
            }
          }
        };

        // Try scrolling after delays to ensure DOM is updated
        setTimeout(scrollToBottom, 100);
        setTimeout(scrollToBottom, 300);
      } catch (error) {
        console.error('Failed to load initial logs:', error);
        if (!cancelled) {
          setWindow({ startLine: 0, endLine: 0, logs: [] });
          setTotalLines(0);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadInitialLogs();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Phase 1: Flush accumulated logs
  const flushPendingLogs = useCallback(() => {
    const logsToFlush = pendingLogsRef.current;
    if (logsToFlush.length === 0) return;

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b6e440b3-7db2-4485-b87e-91079e337688', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'debug-session', runId: 'run2', hypothesisId: 'H2', location: 'Terminal.tsx:flushPendingLogs', message: 'flushPendingLogs entry', data: { logsToFlush: logsToFlush.length, autoScroll: autoScrollRef.current, totalLines: totalLinesRef.current, searchTermLen: searchTerm.length, hasSearchResults: searchResults.length > 0 }, timestamp: Date.now() }) }).catch(() => { });
    // #endregion

    // Clear pending logs immediately
    pendingLogsRef.current = [];
    lastFlushTimeRef.current = Date.now();

    // Update totalLines for all flushed logs
    const newTotal = totalLinesRef.current + logsToFlush.length;
    totalLinesRef.current = newTotal;
    setTotalLines(newTotal);

    // If at bottom (auto-scrolling), append to window
    if (autoScroll) {
      const currentWindow = windowRef.current;
      const newEndLine = newTotal - 1;

      // Append all flushed logs at once
      const newLogs = [...currentWindow.logs, ...logsToFlush];

      // Trim if exceeds window size - keep the END portion (most recent logs)
      const trimmedLogs = newLogs.length > WINDOW_SIZE
        ? newLogs.slice(-WINDOW_SIZE)
        : newLogs;

      // Calculate start line for trimmed logs
      const trimmedStart = newEndLine - trimmedLogs.length + 1;

      const updatedWindow: LogWindow = {
        startLine: trimmedStart,
        endLine: newEndLine,
        logs: trimmedLogs
      };

      // Phase 3: Atomic update
      updateWindowAtomically(updatedWindow);

      // Auto-scroll to bottom
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          const el = scrollRef.current;
          const before = { top: el.scrollTop, h: el.scrollHeight, ch: el.clientHeight };
          el.scrollTop = el.scrollHeight;
          const after = { top: el.scrollTop, h: el.scrollHeight, ch: el.clientHeight };
          const dist = after.h - after.top - after.ch;

          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/b6e440b3-7db2-4485-b87e-91079e337688', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'debug-session', runId: 'run2', hypothesisId: 'H2', location: 'Terminal.tsx:flushPendingLogs', message: 'after scrollTop=scrollHeight', data: { before, after, distToBottom: dist }, timestamp: Date.now() }) }).catch(() => { });
          // #endregion

          updateViewportFromEl(scrollRef.current);
        }
      });
    }
  }, [autoScroll, updateViewportFromEl, updateWindowAtomically, searchResults.length, searchTerm.length]);

  // Phase 1: Schedule flush if needed
  const scheduleFlush = useCallback(() => {
    // Clear existing timeout
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
    }

    const now = Date.now();
    const timeSinceLastFlush = now - lastFlushTimeRef.current;
    const BATCH_SIZE = 10;
    const BATCH_INTERVAL_MS = 50;

    // Flush if we have enough logs OR enough time has passed
    if (pendingLogsRef.current.length >= BATCH_SIZE || timeSinceLastFlush >= BATCH_INTERVAL_MS) {
      flushPendingLogs();
    } else {
      // Schedule flush for remaining time
      const remainingTime = BATCH_INTERVAL_MS - timeSinceLastFlush;
      flushTimeoutRef.current = setTimeout(() => {
        flushPendingLogs();
      }, remainingTime);
    }
  }, [flushPendingLogs]);

  // Subscribe to new logs in real-time
  useEffect(() => {
    const unsubscribe = globalThis.window.electron.subscribeLogs((log) => {
      if (log.dirId === id) {
        // Phase 1: Accumulate logs instead of processing immediately
        pendingLogsRef.current.push(log.line);
        scheduleFlush();
      }
    }) as (() => void) | undefined;

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      // Cleanup: flush any pending logs on unmount
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
      flushPendingLogs();
    };
  }, [id, scheduleFlush, flushPendingLogs]);

  // Handle scroll with requestAnimationFrame
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      // Cancel previous RAF
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }

      // Schedule scroll handling on next animation frame
      rafIdRef.current = requestAnimationFrame(() => {
        const scrollTop = el.scrollTop;
        const scrollHeight = el.scrollHeight;
        const clientHeight = el.clientHeight;

        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
        const distToBottom = scrollHeight - scrollTop - clientHeight;

        // Hypothesis H1: autoScroll flips false due to transient distToBottom spikes while heights settle.
        // Log when we were auto-scrolling and suddenly we aren't "at bottom" anymore.
        if (autoScrollRef.current && !isAtBottom) {
          const now = Date.now();
          if (now - lastAutoScrollDropLogAtRef.current > 1000) {
            lastAutoScrollDropLogAtRef.current = now;
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/b6e440b3-7db2-4485-b87e-91079e337688', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'debug-session', runId: 'run2', hypothesisId: 'H1', location: 'Terminal.tsx:scrollRAF', message: 'autoScroll would drop (not at bottom)', data: { distToBottom, scrollTop, scrollHeight, clientHeight, totalLines: totalLinesRef.current }, timestamp: now }) }).catch(() => { });
            // #endregion
          }
        }
        setAutoScroll(isAtBottom);

        updateViewportFromEl(el);
        const vpStart = Math.floor(scrollTop / ESTIMATED_LINE_HEIGHT) - RENDER_BUFFER;
        const vpEnd = Math.ceil((scrollTop + clientHeight) / ESTIMATED_LINE_HEIGHT) + RENDER_BUFFER;
        const clampedStart = Math.max(0, vpStart);
        const clampedEnd = Math.min(totalLinesRef.current - 1, vpEnd);

        // Check if we need to preload
        const preload = shouldPreload(clampedStart, clampedEnd);

        if (preload.loadUp && !isLoadingRef.current) {
          expandWindowUp();
        }

        if (preload.loadDown && !isLoadingRef.current) {
          expandWindowDown();
        }
      });
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    // Initialize viewport immediately
    updateViewportFromEl(el);
    return () => {
      el.removeEventListener("scroll", handleScroll);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [shouldPreload, expandWindowUp, expandWindowDown, updateViewportFromEl]);

  useEffect(() => {
    setSearchTerm('');
    setSearchInput('');
    setSearchResults([]);
    setCurrentMatchIndex(0);
  }, [id]);

  // Ensure we jump to bottom after initial load when we're showing the tail.
  // With absolute-positioned rows, the "tail" lives far down the scroll area,
  // so until we scroll, the viewport can appear blank.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!autoScroll) return;
    if (totalLines <= 0) return;
    if (window.logs.length === 0) return;
    if (window.endLine !== totalLines - 1) return;

    // If we're at the top but we have a tail window, jump down.
    if (el.scrollTop === 0 && window.startLine > 0) {
      requestAnimationFrame(() => {
        const el2 = scrollRef.current;
        if (!el2) return;
        el2.scrollTop = el2.scrollHeight;
        updateViewportFromEl(el2);
      });
    }
  }, [autoScroll, totalLines, window.endLine, window.logs.length, window.startLine, updateViewportFromEl]);

  const scrollToBottom = () => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight
    });
    updateViewportFromEl(scrollRef.current);
    setAutoScroll(true);
  };

  // Get visible logs for rendering (virtual scrolling)
  const visibleLogs = useMemo(() => {
    if (window.logs.length === 0 || totalLines === 0) return [];

    // Phase 4: Validate window state consistency
    const expectedWindowSize = window.endLine - window.startLine + 1;
    if (window.logs.length !== expectedWindowSize) {
      // Window state is inconsistent - don't render to prevent overlaps
      if (process.env.NODE_ENV === 'development') {
        console.warn('Window state inconsistent:', {
          logsLength: window.logs.length,
          expectedSize: expectedWindowSize,
          startLine: window.startLine,
          endLine: window.endLine
        });
      }
      return [];
    }

    if (viewport.clientHeight === 0) {
      // Initial render before layout: show whole window
      return window.logs.map((log, idx) => ({
        line: log,
        lineNumber: window.startLine + idx
      }));
    }

    const renderStart = viewport.start;
    const renderEnd = viewport.end;

    // Clamp render range to window bounds
    const windowStart = Math.max(renderStart, window.startLine);
    const windowEnd = Math.min(renderEnd, window.endLine);

    // No overlap: we're loading a new window; render nothing (we'll show a loading overlay)
    if (windowStart > windowEnd) return [];

    // Map to window-relative indices
    const startIdx = windowStart - window.startLine;
    const endIdx = windowEnd - window.startLine + 1;

    return window.logs.slice(startIdx, endIdx).map((log, idx) => ({
      line: log,
      lineNumber: windowStart + idx
    }));
  }, [window, totalLines, viewport, heightUpdateTrigger]);

  const handleSearchSubmit = async () => {
    if (!searchInput.trim()) {
      setSearchTerm('');
      setSearchResults([]);
      return;
    }

    setAutoScroll(false);
    setSearchTerm(searchInput);

    try {
      const results = await searchLogs(id, searchInput);
      setSearchResults(results);
      setCurrentMatchIndex(0);

      // If results found, jump to first match
      if (results.length > 0) {
        await jumpToSearchResult(results[0].lineNumber);
      }
    } catch (error) {
      console.error('Failed to search logs:', error);
    }
  };

  const jumpToSearchResult = async (lineNumber: number) => {
    try {
      // Load context around the search result
      const contextSize = 100;
      const contextStart = Math.max(0, lineNumber - contextSize);
      const contextEnd = Math.min(totalLines - 1, lineNumber + contextSize);

      const contextLogs = await loadWindowRange(contextStart, contextEnd);

      if (contextLogs.length > 0) {
        setWindow({
          startLine: contextStart,
          endLine: contextEnd,
          logs: contextLogs
        });

        // Scroll to the line
        setTimeout(() => {
          scrollToLine(lineNumber);
        }, 100);
      }
    } catch (error) {
      console.error('Failed to jump to search result:', error);
    }
  };

  const scrollToLine = (lineNumber: number) => {
    if (!scrollRef.current) return;

    const lineHeight = ESTIMATED_LINE_HEIGHT;
    const targetScrollTop = lineNumber * lineHeight;

    scrollRef.current.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth'
    });
    updateViewportFromEl(scrollRef.current);
  };

  const handleNext = async () => {
    if (searchResults.length === 0) return;
    setAutoScroll(false);
    const nextIndex = (currentMatchIndex + 1) % searchResults.length;
    setCurrentMatchIndex(nextIndex);
    await jumpToSearchResult(searchResults[nextIndex].lineNumber);
  };

  const handlePrev = async () => {
    if (searchResults.length === 0) return;
    setAutoScroll(false);
    const prevIndex = (currentMatchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentMatchIndex(prevIndex);
    await jumpToSearchResult(searchResults[prevIndex].lineNumber);
  };

  const handleClearTerminal = async () => {
    if (id) {
      await clearTerminal(id);
      // Reload logs after clearing
      try {
        const [loadedLogs, total] = await Promise.all([
          getLogsTail(id, WINDOW_SIZE),
          getTotalLineCount(id)
        ]);
        setWindow({
          startLine: Math.max(0, total - loadedLogs.length),
          endLine: total - 1,
          logs: loadedLogs
        });
        setTotalLines(total);
      } catch (error) {
        console.error('Failed to reload logs after clearing:', error);
      }
    }
  };

  function highlightTokensInLine(
    text: string,
    tokens: HighlightToken[],
    isActiveLine: boolean,
    activeSearchTerm: string
  ): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    const searchRegex = activeSearchTerm
      ? new RegExp(`(${activeSearchTerm.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")})`, "gi")
      : null;

    const combined = new RegExp(
      tokens.map((t) => t.regex.source).join("|") +
      (searchRegex ? "|" + searchRegex.source : ""),
      "gi"
    );

    while ((match = combined.exec(text)) !== null) {
      const before = text.slice(lastIndex, match.index);
      if (before) parts.push(<span key={lastIndex}>{before}</span>);

      const matchedText = match[0];
      const tokenDef = tokens.find((t) => t.regex.test(matchedText));

      if (searchRegex?.test(matchedText)) {
        parts.push(
          <span
            key={match.index}
            className={
              isActiveLine
                ? "bg-yellow-700 text-white px-1"
                : "bg-yellow-600 text-black px-1"
            }
          >
            {matchedText}
          </span>
        );
      } else if (tokenDef) {
        parts.push(
          <span key={match.index} className={tokenDef.className}>
            {matchedText}
          </span>
        );
      } else {
        parts.push(<span key={match.index}>{matchedText}</span>);
      }

      lastIndex = combined.lastIndex;
    }

    const tail = text.slice(lastIndex);
    if (tail) parts.push(<span key={lastIndex}>{tail}</span>);

    return parts;
  }

  // Calculate cumulative top position for a line based on measured heights
  const getLineTop = useCallback((lineNumber: number): number => {
    if (lineNumber === 0) return 0;
    if (lineNumber >= totalLinesRef.current) {
      // Calculate total height for all lines
      let totalHeight = 0;
      for (let i = 0; i < totalLinesRef.current; i++) {
        totalHeight += lineHeightsRef.current.get(i) || ESTIMATED_LINE_HEIGHT;
      }
      return totalHeight;
    }

    // Check if we have cached cumulative height
    const cached = cumulativeHeightsRef.current.get(lineNumber);
    if (cached !== undefined) return cached;

    // Calculate cumulative height from previous lines
    let totalHeight = 0;
    for (let i = 0; i < lineNumber; i++) {
      const height = lineHeightsRef.current.get(i) || ESTIMATED_LINE_HEIGHT;
      totalHeight += height;
    }

    // Cache it
    cumulativeHeightsRef.current.set(lineNumber, totalHeight);
    return totalHeight;
  }, []);

  // Calculate total container height
  const getTotalHeight = useCallback((): number => {
    if (totalLinesRef.current === 0) return 0;
    return getLineTop(totalLinesRef.current);
  }, [getLineTop]);

  // Measure line height after render
  const measureLineHeight = useCallback((lineNumber: number, element: HTMLDivElement | null) => {
    if (!element) return;

    // Measure actual height
    const height = element.scrollHeight;
    const oldHeight = lineHeightsRef.current.get(lineNumber);

    // If height changed, update cache and invalidate cumulative heights for subsequent lines
    if (oldHeight !== height) {
      lineHeightsRef.current.set(lineNumber, height);

      // Invalidate cumulative heights for all lines after this one
      const keysToDelete: number[] = [];
      cumulativeHeightsRef.current.forEach((_, key) => {
        if (key > lineNumber) keysToDelete.push(key);
      });
      keysToDelete.forEach(key => cumulativeHeightsRef.current.delete(key));

      // Trigger re-render to update positions
      setHeightUpdateTrigger(prev => prev + 1);

      // Hypothesis H2: late height changes near the bottom increase scrollHeight after we already scrolled.
      if (autoScrollRef.current && lineNumber >= totalLinesRef.current - 5) {
        const now = Date.now();
        if (now - lastScrollSetLogAtRef.current > 250) {
          lastScrollSetLogAtRef.current = now;
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/b6e440b3-7db2-4485-b87e-91079e337688', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'debug-session', runId: 'run2', hypothesisId: 'H2', location: 'Terminal.tsx:measureLineHeight', message: 'height changed near bottom while autoScroll', data: { lineNumber, oldHeight, measuredHeight: height, totalLines: totalLinesRef.current, containerHeight: getTotalHeight(), scroll: { top: scrollRef.current?.scrollTop, h: scrollRef.current?.scrollHeight, ch: scrollRef.current?.clientHeight } }, timestamp: now }) }).catch(() => { });
          // #endregion
        }
      }
    }
  }, [getTotalHeight]);

  const renderLine = (line: string, lineNumber: number) => {
    const prefixMatch = line.match(/^([A-Za-z]+)([:\s]+)/);
    let prefixNode: React.ReactNode | null = null;
    let remainder = line;

    if (prefixMatch) {
      const rawPrefix = prefixMatch[1].toUpperCase();
      const spacer = prefixMatch[2];
      const prefixLen = rawPrefix.length + spacer.length;

      if (LEVEL_PREFIXES[rawPrefix]) {
        prefixNode = (
          <span key={`prefix-${lineNumber}`} className={`${LEVEL_PREFIXES[rawPrefix]}`}>
            {`${rawPrefix}${spacer}`}
          </span>
        );
        remainder = line.slice(prefixLen);
      }
    }

    const combinedTokens: HighlightToken[] = [
      ...IN_LINE_TOKENS,
      ...(searchTerm
        ? [{
          regex: new RegExp(
            `(${searchTerm.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")})`,
            "gi"
          ),
          className: "bg-yellow-600 text-black px-1",
        }]
        : []),
    ];

    const isActive = searchResults.length > 0 &&
      searchResults[currentMatchIndex]?.lineNumber === lineNumber;

    const contentNodes = highlightTokensInLine(remainder, combinedTokens, isActive, searchTerm);

    // Calculate top position based on cumulative heights
    const top = getLineTop(lineNumber);

    // Use lineNumber as key - it's unique and stable across window changes
    return (
      <div
        key={lineNumber}
        data-log-line={lineNumber}
        ref={(el) => measureLineHeight(lineNumber, el)}
        className="text-gray-200"
        style={{
          position: 'absolute',
          top: `${top}px`,
          left: 0,
          right: 0,
          minHeight: `${ESTIMATED_LINE_HEIGHT}px`,
          lineHeight: `${ESTIMATED_LINE_HEIGHT}px`,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflowWrap: 'break-word'
        }}>
        {prefixNode}
        {contentNodes}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-5 px-4 py-2 bg-gray-900 rounded-t-lg border-b border-gray-700">
        <div className="flex items-center flex-1 gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="secondary" size={'sm'} onClick={scrollToBottom}>
                <ChevronDown />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Scroll to bottom</p>
            </TooltipContent>
          </Tooltip>
          <Button variant="secondary" size={'sm'} onClick={handleClearTerminal}><Trash2 /></Button>
          <Input
            placeholder="Search logs..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearchSubmit();
                if (e.shiftKey) {
                  handlePrev();
                } else {
                  handleNext();
                }
              }
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size={'sm'} onClick={() => {
            setSearchTerm('');
            setSearchInput('');
            setSearchResults([]);
          }}><CircleX /></Button>
          <Button variant="secondary" size={'sm'} onClick={handlePrev}><ChevronLeft /></Button>
          <Button variant="secondary" size={'sm'} onClick={handleNext}> <ChevronRight /></Button>
          {searchResults.length > 0 && (
            <div>
              <span className="text-gray-400 text-sm">
                {`${currentMatchIndex + 1}/${searchResults.length}`}
              </span>
            </div>
          )}
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto px-4 py-3 bg-gray-950 font-mono text-sm rounded-b-lg"
      >
        {isLoading && (
          <div className="text-gray-400 text-center py-4">Loading logs...</div>
        )}
        {!isLoading && totalLines === 0 && (
          <div className="text-gray-400 text-center py-4">No logs yet</div>
        )}
        {!isLoading && totalLines > 0 && window.logs.length > 0 && (
          /* Virtual scrolling container */
          <div style={{
            height: `${getTotalHeight()}px`,
            position: 'relative'
          }}>
            {/* Render visible logs */}
            {visibleLogs.map(({ line, lineNumber }) => renderLine(line, lineNumber))}
            {/* Loading overlay when viewport is outside current window */}
            {visibleLogs.length === 0 && window.logs.length > 0 && totalLines > 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-gray-400 text-center py-2 px-3 bg-gray-900/70 rounded">
                  Loading logs...
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
