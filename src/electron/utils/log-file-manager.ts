import { app } from 'electron';
import fs from 'fs';
import path from 'path';

let logsDirectory: string | null = null;


/**
 * Gets the logs directory path, ensuring it exists
 */
function getLogsDirectory(): string {
  if (!logsDirectory) {
    const userDataPath = app.getPath('userData');
    logsDirectory = path.join(userDataPath, 'logs');
    ensureLogsDirectory();
  }
  return logsDirectory;
}

/**
 * Ensures the logs directory exists
 */
export function ensureLogsDirectory(): void {
  const logsDir = logsDirectory || path.join(app.getPath('userData'), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  logsDirectory = logsDir;
}

/**
 * Returns the file path for a specific directory's log file
 * @param dirId - The directory ID
 * @returns The full path to the log file
 */
export function getLogFilePath(dirId: string): string {
  const logsDir = getLogsDirectory();
  return path.join(logsDir, `${dirId}.log`);
}

/**
 * Appends a log line to the file
 * @param dirId - The directory ID
 * @param line - The log line to append
 */
export async function appendLogToFile(dirId: string, line: string): Promise<void> {
  try {
    const filePath = getLogFilePath(dirId);
    await fs.promises.appendFile(filePath, line, 'utf8');
    // Invalidate cache when file is modified
    invalidateLineCountCache(dirId);
  } catch (error) {
    console.error(`Failed to append log to file for dirId ${dirId}:`, error);
    // Don't throw - we don't want to break the log stream
  }
}

/**
 * Reads all lines from the log file
 * @param dirId - The directory ID
 * @returns Array of log lines, or empty array if file doesn't exist
 */
export async function readLogFile(dirId: string): Promise<string[]> {
  try {
    const filePath = getLogFilePath(dirId);

    if (!fs.existsSync(filePath)) {
      return [];
    }

    const content = await fs.promises.readFile(filePath, 'utf8');

    if (!content.trim()) {
      return [];
    }

    // Split by newlines and filter out empty lines at the end
    return content.split('\n').filter((line, index, array) => {
      // Keep all lines except trailing empty ones
      if (line === '' && index === array.length - 1) {
        return false;
      }
      return true;
    });
  } catch (error) {
    console.error(`Failed to read log file for dirId ${dirId}:`, error);
    return [];
  }
}

/**
 * Clears the log file by truncating it
 * @param dirId - The directory ID
 */
export async function clearLogFile(dirId: string): Promise<void> {
  try {
    const filePath = getLogFilePath(dirId);

    if (fs.existsSync(filePath)) {
      await fs.promises.writeFile(filePath, '', 'utf8');
      // Invalidate cache when file is cleared
      invalidateLineCountCache(dirId);
    }
  } catch (error) {
    console.error(`Failed to clear log file for dirId ${dirId}:`, error);
    throw error;
  }
}

/**
 * Deletes the log file for a directory
 * @param dirId - The directory ID
 */
export async function deleteLogFile(dirId: string): Promise<void> {
  try {
    const filePath = getLogFilePath(dirId);

    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  } catch (error) {
    console.error(`Failed to delete log file for dirId ${dirId}:`, error);
    // Don't throw - cleanup failures shouldn't break directory removal
  }
}

/**
 * Gets the size of a log file in bytes
 * @param dirId - The directory ID
 * @returns File size in bytes, or 0 if file doesn't exist
 */
export async function getLogFileSize(dirId: string): Promise<number> {
  try {
    const filePath = getLogFilePath(dirId);

    if (!fs.existsSync(filePath)) {
      return 0;
    }

    const stats = await fs.promises.stat(filePath);
    return stats.size;
  } catch (error) {
    console.error(`Failed to get log file size for dirId ${dirId}:`, error);
    return 0;
  }
}

// Cache for line counts to avoid repeated file reads
const lineCountCache = new Map<string, { count: number, timestamp: number }>();
const CACHE_TTL = 5000; // 5 seconds cache

/**
 * Gets the total number of lines in a log file
 * @param dirId - The directory ID
 * @returns Total line count, or 0 if file doesn't exist
 */
export async function getLogFileLineCount(dirId: string): Promise<number> {
  try {
    const filePath = getLogFilePath(dirId);

    if (!fs.existsSync(filePath)) {
      lineCountCache.delete(dirId);
      return 0;
    }

    // Check cache first
    const cached = lineCountCache.get(dirId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.count;
    }

    const content = await fs.promises.readFile(filePath, 'utf8');

    if (!content.trim()) {
      lineCountCache.set(dirId, { count: 0, timestamp: Date.now() });
      return 0;
    }

    // Count newlines (add 1 if file doesn't end with newline)
    const lines = content.split('\n');
    // Filter out trailing empty line if file ends with newline
    const lineCount = lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;

    // Update cache
    lineCountCache.set(dirId, { count: lineCount, timestamp: Date.now() });
    return lineCount;
  } catch (error) {
    console.error(`Failed to get log file line count for dirId ${dirId}:`, error);
    // Return cached value if available, otherwise 0
    return lineCountCache.get(dirId)?.count || 0;
  }
}

/**
 * Invalidates the line count cache for a directory (call when file is modified)
 */
export function invalidateLineCountCache(dirId: string): void {
  lineCountCache.delete(dirId);
}

/**
 * Reads a specific chunk of logs from the file
 * @param dirId - The directory ID
 * @param offset - Starting line number (0-indexed)
 * @param limit - Maximum number of lines to read
 * @returns Array of log lines
 */
export async function readLogFileChunk(dirId: string, offset: number, limit: number): Promise<string[]> {
  try {
    const filePath = getLogFilePath(dirId);

    if (!fs.existsSync(filePath)) {
      return [];
    }

    const content = await fs.promises.readFile(filePath, 'utf8');

    if (!content.trim()) {
      return [];
    }

    const lines = content.split('\n');
    // Remove trailing empty line if file ends with newline
    const allLines = lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines;

    // Ensure offset is within bounds
    const startIndex = Math.max(0, Math.min(offset, allLines.length));
    const endIndex = Math.min(startIndex + limit, allLines.length);

    return allLines.slice(startIndex, endIndex);
  } catch (error) {
    console.error(`Failed to read log file chunk for dirId ${dirId}:`, error);
    return [];
  }
}

/**
 * Reads the last N lines from the file (for initial load)
 * @param dirId - The directory ID
 * @param limit - Number of lines to read from the end
 * @returns Array of log lines (last N lines)
 */
export async function readLogFileTail(dirId: string, limit: number): Promise<string[]> {
  try {
    const filePath = getLogFilePath(dirId);

    if (!fs.existsSync(filePath)) {
      return [];
    }

    const content = await fs.promises.readFile(filePath, 'utf8');

    if (!content.trim()) {
      return [];
    }

    const lines = content.split('\n');
    // Remove trailing empty line if file ends with newline
    const allLines = lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines;

    const startIndex = Math.max(0, allLines.length - limit);
    return allLines.slice(startIndex);
  } catch (error) {
    console.error(`Failed to read log file tail for dirId ${dirId}:`, error);
    return [];
  }
}

/**
 * Reads a specific range of lines from the file
 * @param dirId - The directory ID
 * @param startLine - Starting line number (0-indexed, inclusive)
 * @param endLine - Ending line number (0-indexed, exclusive)
 * @returns Array of log lines in the range
 */
export async function readLogFileRange(dirId: string, startLine: number, endLine: number): Promise<string[]> {
  try {
    const filePath = getLogFilePath(dirId);

    if (!fs.existsSync(filePath)) {
      return [];
    }

    const content = await fs.promises.readFile(filePath, 'utf8');

    if (!content.trim()) {
      return [];
    }

    const lines = content.split('\n');
    // Remove trailing empty line if file ends with newline
    const allLines = lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines;

    // Ensure bounds are valid
    const startIndex = Math.max(0, Math.min(startLine, allLines.length));
    const endIndex = Math.max(startIndex, Math.min(endLine, allLines.length));

    return allLines.slice(startIndex, endIndex);
  } catch (error) {
    console.error(`Failed to read log file range for dirId ${dirId}:`, error);
    return [];
  }
}

/**
 * Searches entire log file for matching lines
 * @param dirId - The directory ID
 * @param searchTerm - Search term (case-insensitive)
 * @returns Array of objects with line number and content
 */
export async function searchLogFile(dirId: string, searchTerm: string): Promise<Array<{ lineNumber: number, line: string }>> {
  try {
    const filePath = getLogFilePath(dirId);

    if (!fs.existsSync(filePath)) {
      return [];
    }

    if (!searchTerm.trim()) {
      return [];
    }

    const content = await fs.promises.readFile(filePath, 'utf8');

    if (!content.trim()) {
      return [];
    }

    const lines = content.split('\n');
    // Remove trailing empty line if file ends with newline
    const allLines = lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines;

    const searchLower = searchTerm.toLowerCase();
    const matches: Array<{ lineNumber: number, line: string }> = [];

    for (let i = 0; i < allLines.length; i++) {
      if (allLines[i].toLowerCase().includes(searchLower)) {
        matches.push({
          lineNumber: i,
          line: allLines[i]
        });
      }
    }

    return matches;
  } catch (error) {
    console.error(`Failed to search log file for dirId ${dirId}:`, error);
    return [];
  }
}

