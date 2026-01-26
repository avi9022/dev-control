import { useState, useRef, useMemo, useCallback, type FC, type DragEvent } from 'react'
import { ToolLayout } from './shared'
import { Button } from '@/components/ui/button'
import Editor from '@monaco-editor/react'
import * as XLSX from 'xlsx'

const PREVIEW_ROWS = 5

interface FileInfo {
  name: string
  size: number
  rowCount?: number
}

export const JsonToXlsxConverter: FC = () => {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [filename, setFilename] = useState('data')
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [parsedData, setParsedData] = useState<unknown[] | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [editorHeight, setEditorHeight] = useState(200)
  const [isResizing, setIsResizing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const resizeStartY = useRef(0)
  const resizeStartHeight = useRef(0)

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    resizeStartY.current = e.clientY
    resizeStartHeight.current = editorHeight

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientY - resizeStartY.current
      const newHeight = Math.max(100, Math.min(500, resizeStartHeight.current + delta))
      setEditorHeight(newHeight)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [editorHeight])

  // Get preview data - either from parsedData or by parsing input
  const previewData = useMemo(() => {
    if (parsedData && parsedData.length > 0) {
      return parsedData.slice(0, PREVIEW_ROWS)
    }
    if (input.trim()) {
      try {
        const parsed = JSON.parse(input)
        const data = Array.isArray(parsed) ? parsed : [parsed]
        return data.slice(0, PREVIEW_ROWS)
      } catch {
        return null
      }
    }
    return null
  }, [parsedData, input])

  // Get column headers from preview data
  const columns = useMemo(() => {
    if (!previewData || previewData.length === 0) return []
    const allKeys = new Set<string>()
    previewData.forEach((row) => {
      if (row && typeof row === 'object') {
        Object.keys(row as object).forEach((key) => allKeys.add(key))
      }
    })
    return Array.from(allKeys)
  }, [previewData])

  const totalRows = parsedData?.length ?? (previewData?.length || 0)

  const processFile = (file: File) => {
    // Set filename from uploaded file (without extension)
    const nameWithoutExt = file.name.replace(/\.json$/i, '')
    setFilename(nameWithoutExt)

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setError('')

      // Try to parse immediately to get row count
      try {
        const parsed = JSON.parse(content)
        const data = Array.isArray(parsed) ? parsed : [parsed]
        setParsedData(data)

        setFileInfo({
          name: file.name,
          size: file.size,
          rowCount: data.length,
        })

        // Always set input - Monaco handles large files with virtualization
        setInput(content)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid JSON file')
        setFileInfo(null)
        setParsedData(null)
      }
    }
    reader.onerror = () => {
      setError('Failed to read file')
    }
    reader.readAsText(file)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    processFile(file)
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      setError('Please drop a JSON file')
      return
    }

    processFile(file)
  }

  const handleInputChange = (value: string) => {
    setInput(value)
    setFileInfo(null)
    setParsedData(null)
  }

  const clearFile = () => {
    setInput('')
    setFileInfo(null)
    setParsedData(null)
    setFilename('data')
    setError('')
  }

  const handleConvert = () => {
    try {
      setError('')

      // Use pre-parsed data if available, otherwise parse input
      let data: unknown[]
      if (parsedData) {
        data = parsedData
      } else {
        const parsed = JSON.parse(input)
        data = Array.isArray(parsed) ? parsed : [parsed]
      }

      if (data.length === 0) {
        setError('JSON array is empty')
        return
      }

      // Create worksheet from JSON data
      const worksheet = XLSX.utils.json_to_sheet(data)

      // Create workbook and add worksheet
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')

      // Generate and download file
      XLSX.writeFile(workbook, `${filename || 'data'}.xlsx`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Conversion failed')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatCellValue = (value: unknown): string => {
    if (value === null) return 'null'
    if (value === undefined) return ''
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  return (
    <ToolLayout
      title="JSON to XLSX Converter"
      description="Convert JSON data to Excel spreadsheet"
    >
      <div className="h-full flex flex-col overflow-hidden gap-4">
        {/* JSON Input Section - fixed height */}
        <div className="flex-shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">JSON Input</label>
              {fileInfo && (
                <span className="text-xs text-muted-foreground">
                  ({fileInfo.name} • {formatFileSize(fileInfo.size)} • {fileInfo.rowCount?.toLocaleString()} rows)
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileSelect}
                className="hidden"
              />
              {(fileInfo || input) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFile}
                >
                  Clear
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Select File
              </Button>
            </div>
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative ${isDragging ? 'ring-2 ring-primary ring-offset-2 rounded-md' : ''}`}
          >
            {isDragging && (
              <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-md flex items-center justify-center z-10">
                <p className="text-sm font-medium text-primary">Drop JSON file here</p>
              </div>
            )}

            <div className="border rounded-md overflow-hidden flex flex-col">
              <div style={{ height: editorHeight }}>
                <Editor
                  height="100%"
                  defaultLanguage="json"
                  value={input}
                  onChange={(value) => handleInputChange(value || '')}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    fontSize: 12,
                    tabSize: 2,
                    wordWrap: 'on',
                    automaticLayout: true,
                    folding: true,
                    renderWhitespace: 'none',
                  }}
                />
              </div>
              {/* Resize handle */}
              <div
                className={`h-2 cursor-ns-resize bg-muted hover:bg-muted-foreground/20 flex items-center justify-center ${isResizing ? 'bg-muted-foreground/20' : ''}`}
                onMouseDown={handleResizeStart}
              >
                <div className="w-8 h-0.5 bg-muted-foreground/40 rounded" />
              </div>
            </div>
          </div>
        </div>

        {/* Preview Table - scrollable */}
        {previewData && previewData.length > 0 && columns.length > 0 && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Preview</label>
              <span className="text-xs text-muted-foreground">
                Showing {previewData.length} of {totalRows.toLocaleString()} rows
              </span>
            </div>
            <div className="flex-1 min-h-0 border rounded-md overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col}
                        className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap border-b bg-muted"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b last:border-b-0 hover:bg-muted/50">
                      {columns.map((col) => (
                        <td
                          key={col}
                          className="px-3 py-2 whitespace-nowrap max-w-[200px] truncate"
                          title={formatCellValue((row as Record<string, unknown>)[col])}
                        >
                          {formatCellValue((row as Record<string, unknown>)[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Bottom controls - fixed */}
        <div className="flex-shrink-0 space-y-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground whitespace-nowrap">
              Filename:
            </label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border rounded-md bg-background"
              placeholder="data"
            />
            <span className="text-sm text-muted-foreground">.xlsx</span>
          </div>

          <Button onClick={handleConvert} className="w-full" disabled={!previewData}>
            Download XLSX
          </Button>

          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {error}
            </div>
          )}
        </div>
      </div>
    </ToolLayout>
  )
}
