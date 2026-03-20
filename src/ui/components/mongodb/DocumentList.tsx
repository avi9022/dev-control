import { useState, useEffect, useCallback, useMemo, type FC } from 'react'
import { useMongoDB } from '@/ui/contexts/mongodb'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Trash2,
  Edit,
  Copy,
  ChevronDown,
  ChevronRight,
  List,
  Code,
  Table2,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  FileWarning,
  Inbox,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface DocumentListProps {
  database: string
  collection: string
  queryOptions: MongoQueryOptions
}

interface DocumentCardProps {
  doc: MongoDocument
  onEdit: (doc: MongoDocument) => void
  onCopy: (doc: MongoDocument) => void
  onDelete: (doc: MongoDocument) => void
}

function getDocumentPreview(doc: MongoDocument): string {
  const idStr = doc._id ? String(doc._id) : 'unknown'
  const keys = Object.keys(doc).filter((k) => k !== '_id')
  const previewFields = keys.slice(0, 3).map((k) => {
    const val = doc[k]
    if (typeof val === 'string') return `${k}: "${val.length > 30 ? val.slice(0, 30) + '...' : val}"`
    if (typeof val === 'number' || typeof val === 'boolean') return `${k}: ${val}`
    if (val === null) return `${k}: null`
    if (Array.isArray(val)) return `${k}: [${val.length} items]`
    if (typeof val === 'object') return `${k}: {...}`
    return `${k}: ${String(val)}`
  })
  return `_id: ${idStr}${previewFields.length > 0 ? ' | ' + previewFields.join(' | ') : ''}`
}

const DocumentCard: FC<DocumentCardProps> = ({ doc, onEdit, onCopy, onDelete }) => {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border rounded-md bg-card">
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded((prev) => !prev)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
        <span className="text-xs font-mono text-muted-foreground truncate flex-1">
          {getDocumentPreview(doc)}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => onEdit(doc)}
            title="Edit document"
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => onCopy(doc)}
            title="Copy to clipboard"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={() => onDelete(doc)}
            title="Delete document"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="border-t px-3 py-2">
          <pre className="text-xs font-mono whitespace-pre-wrap break-all text-foreground/80">
            {JSON.stringify(doc, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return `[${value.length}]`
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

interface DocumentTableProps {
  documents: MongoDocument[]
  onEdit: (doc: MongoDocument) => void
  onCopy: (doc: MongoDocument) => void
  onDelete: (doc: MongoDocument) => void
  onFieldUpdate: (doc: MongoDocument, field: string, value: unknown) => Promise<void>
}

const DocumentTable: FC<DocumentTableProps> = ({ documents, onEdit, onCopy, onDelete, onFieldUpdate }) => {
  const [editingCell, setEditingCell] = useState<{ docIndex: number; field: string } | null>(null)
  const [editCellValue, setEditCellValue] = useState('')
  const [escapedCell, setEscapedCell] = useState(false)

  const columns = useMemo(() => {
    const fieldSet = new Set<string>()
    for (const doc of documents) {
      for (const key of Object.keys(doc)) {
        fieldSet.add(key)
      }
    }
    const cols = Array.from(fieldSet)
    const idIndex = cols.indexOf('_id')
    if (idIndex > 0) {
      cols.splice(idIndex, 1)
      cols.unshift('_id')
    }
    return cols
  }, [documents])

  const handleCellDoubleClick = (docIndex: number, field: string) => {
    if (field === '_id') return
    const val = documents[docIndex][field]
    setEditCellValue(typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val ?? ''))
    setEscapedCell(false)
    setEditingCell({ docIndex, field })
  }

  const handleCellSave = async (doc: MongoDocument, field: string) => {
    if (escapedCell) return
    let parsed: unknown
    try {
      parsed = JSON.parse(editCellValue)
    } catch {
      parsed = editCellValue
    }
    setEditingCell(null)
    await onFieldUpdate(doc, field, parsed)
  }

  const handleCellKeyDown = (e: React.KeyboardEvent, doc: MongoDocument, field: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleCellSave(doc, field)
    }
    if (e.key === 'Escape') {
      setEscapedCell(true)
      setEditingCell(null)
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <table className="w-full text-xs font-mono border-collapse">
        <thead className="sticky top-0 z-10 bg-muted">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="text-left px-3 py-2 border-b border-r font-medium text-muted-foreground whitespace-nowrap"
              >
                {col}
              </th>
            ))}
            <th className="px-3 py-2 border-b w-24 text-right text-muted-foreground font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc, rowIndex) => (
            <tr key={doc._id ? String(doc._id) : rowIndex} className="hover:bg-muted/50 border-b">
              {columns.map((col) => {
                const isEditing = editingCell?.docIndex === rowIndex && editingCell?.field === col
                return (
                  <td
                    key={col}
                    className={cn(
                      "px-3 py-1.5 border-r max-w-[300px] truncate",
                      col !== '_id' && "cursor-pointer hover:bg-accent/50"
                    )}
                    onDoubleClick={() => handleCellDoubleClick(rowIndex, col)}
                    title={formatCellValue(doc[col])}
                  >
                    {isEditing ? (
                      <input
                        className="w-full bg-background border rounded px-1 py-0.5 text-xs font-mono outline-none focus:ring-1 focus:ring-ring"
                        value={editCellValue}
                        onChange={(e) => setEditCellValue(e.target.value)}
                        onKeyDown={(e) => handleCellKeyDown(e, doc, col)}
                        onBlur={() => handleCellSave(doc, col)}
                        autoFocus
                      />
                    ) : (
                      <span className={cn(col === '_id' && "text-muted-foreground")}>
                        {formatCellValue(doc[col])}
                      </span>
                    )}
                  </td>
                )
              })}
              <td className="px-3 py-1.5 text-right">
                <div className="flex items-center justify-end gap-0.5">
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => onEdit(doc)} title="Edit">
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => onCopy(doc)} title="Copy">
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive hover:text-destructive" onClick={() => onDelete(doc)} title="Delete">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const DocumentList: FC<DocumentListProps> = ({ database, collection, queryOptions }) => {
  const { findDocuments, insertDocument, updateDocument, deleteDocument } = useMongoDB()

  const [documents, setDocuments] = useState<MongoDocument[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'table' | 'json'>('list')

  const [insertOpen, setInsertOpen] = useState(false)
  const [insertText, setInsertText] = useState('{\n  \n}')
  const [insertError, setInsertError] = useState<string | null>(null)
  const [insertLoading, setInsertLoading] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editDoc, setEditDoc] = useState<MongoDocument | null>(null)
  const [editText, setEditText] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [editLoading, setEditLoading] = useState(false)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteDoc, setDeleteDoc] = useState<MongoDocument | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [pageSize, setPageSize] = useState(queryOptions.limit ?? 50)
  const [currentPage, setCurrentPage] = useState(0)

  const fetchDocuments = useCallback(async () => {
    setLoadingDocs(true)
    setFetchError(null)
    try {
      const opts: MongoQueryOptions = {
        ...queryOptions,
        limit: pageSize,
        skip: currentPage * pageSize,
      }
      const result = await findDocuments(database, collection, opts.filter, opts)
      setDocuments(result.documents ?? [])
      setTotalCount(result.totalCount ?? 0)
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch documents')
      setDocuments([])
      setTotalCount(0)
    } finally {
      setLoadingDocs(false)
    }
  }, [database, collection, queryOptions, pageSize, currentPage, findDocuments])

  useEffect(() => {
    setCurrentPage(0)
  }, [database, collection, queryOptions])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  const handleCopy = useCallback((doc: MongoDocument) => {
    navigator.clipboard.writeText(JSON.stringify(doc, null, 2))
  }, [])

  const handleEditOpen = useCallback((doc: MongoDocument) => {
    setEditDoc(doc)
    setEditText(JSON.stringify(doc, null, 2))
    setEditError(null)
    setEditOpen(true)
  }, [])

  const handleEditSave = useCallback(async () => {
    if (!editDoc) return
    try {
      const parsed = JSON.parse(editText)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setEditError('Must be a JSON object')
        return
      }
      setEditLoading(true)
      setEditError(null)
      const docId = String(editDoc._id)
      const { _id, ...update } = parsed
      await updateDocument(database, collection, docId, update)
      setEditOpen(false)
      await fetchDocuments()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Invalid JSON')
    } finally {
      setEditLoading(false)
    }
  }, [editDoc, editText, database, collection, updateDocument, fetchDocuments])

  const handleDeleteOpen = useCallback((doc: MongoDocument) => {
    setDeleteDoc(doc)
    setDeleteOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteDoc) return
    try {
      setDeleteLoading(true)
      await deleteDocument(database, collection, String(deleteDoc._id))
      setDeleteOpen(false)
      setDeleteDoc(null)
      await fetchDocuments()
    } catch {
      // Error is handled silently; the document list will re-fetch
    } finally {
      setDeleteLoading(false)
    }
  }, [deleteDoc, database, collection, deleteDocument, fetchDocuments])

  const handleInsert = useCallback(async () => {
    try {
      const parsed = JSON.parse(insertText)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setInsertError('Must be a JSON object')
        return
      }
      setInsertLoading(true)
      setInsertError(null)
      await insertDocument(database, collection, parsed)
      setInsertOpen(false)
      setInsertText('{\n  \n}')
      await fetchDocuments()
    } catch (err) {
      setInsertError(err instanceof Error ? err.message : 'Invalid JSON')
    } finally {
      setInsertLoading(false)
    }
  }, [insertText, database, collection, insertDocument, fetchDocuments])

  if (loadingDocs && documents.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Loading documents...</span>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
        <FileWarning className="h-8 w-8" />
        <p className="text-sm">{fetchError}</p>
        <Button size="sm" variant="outline" onClick={fetchDocuments}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-2 border-b flex-shrink-0">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={() => setInsertOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add Document
          </Button>
          <Badge variant="secondary" className="text-xs">
            {totalCount} document{totalCount !== 1 ? 's' : ''}
          </Badge>
          {loadingDocs && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            className="h-7 w-7"
            onClick={() => setViewMode('list')}
            title="List view"
          >
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            className="h-7 w-7"
            onClick={() => setViewMode('table')}
            title="Table view"
          >
            <Table2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant={viewMode === 'json' ? 'secondary' : 'ghost'}
            className="h-7 w-7"
            onClick={() => setViewMode('json')}
            title="JSON view"
          >
            <Code className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Document content */}
      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground gap-2 py-12">
          <Inbox className="h-8 w-8" />
          <p className="text-sm">No documents found</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="space-y-1 px-6 py-4">
            {documents.map((doc, i) => (
              <DocumentCard
                key={doc._id ? String(doc._id) : i}
                doc={doc}
                onEdit={handleEditOpen}
                onCopy={handleCopy}
                onDelete={handleDeleteOpen}
              />
            ))}
          </div>
        </div>
      ) : viewMode === 'table' ? (
        <DocumentTable
          documents={documents}
          onEdit={handleEditOpen}
          onCopy={handleCopy}
          onDelete={handleDeleteOpen}
          onFieldUpdate={async (doc, field, value) => {
            const docId = String(doc._id)
            const updated = { ...doc, [field]: value }
            await updateDocument(database, collection, docId, updated)
            await fetchDocuments()
          }}
        />
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          <pre className="text-xs font-mono px-6 py-4 whitespace-pre-wrap break-all">
            {JSON.stringify(documents, null, 2)}
          </pre>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between px-6 py-2 border-t flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {currentPage * pageSize + 1}-{Math.min((currentPage + 1) * pageSize, totalCount)} of {totalCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(pageSize)}
            onValueChange={(val) => {
              setPageSize(Number(val))
              setCurrentPage(0)
            }}
          >
            <SelectTrigger className="h-7 w-20 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}/page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-0.5">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              disabled={currentPage === 0}
              onClick={() => setCurrentPage(0)}
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              disabled={currentPage === 0}
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground px-2">
              Page {currentPage + 1} of {totalPages}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setCurrentPage(totalPages - 1)}
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Insert Dialog */}
      <Dialog open={insertOpen} onOpenChange={setInsertOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Insert Document</DialogTitle>
            <DialogDescription>
              Add a new document to {database}.{collection}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            className="font-mono text-sm min-h-[200px]"
            value={insertText}
            onChange={(e) => setInsertText(e.target.value)}
            placeholder='{ "key": "value" }'
          />
          {insertError && <p className="text-sm text-status-red">{insertError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setInsertOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInsert} disabled={insertLoading}>
              {insertLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Insert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
            <DialogDescription>
              Modify the document and save changes
            </DialogDescription>
          </DialogHeader>
          <Textarea
            className="font-mono text-sm min-h-[250px]"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
          />
          {editError && <p className="text-sm text-status-red">{editError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={editLoading}>
              {editLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteDoc && (
            <p className="text-xs font-mono text-muted-foreground truncate">
              _id: {String(deleteDoc._id)}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleteLoading}>
              {deleteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
