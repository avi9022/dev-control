import { useState, useMemo, type FC } from 'react'
import { ToolLayout, InputArea } from './shared'
import { CopyButton } from './shared/CopyButton'

type CaseType = 'camelCase' | 'PascalCase' | 'snake_case' | 'kebab-case' | 'UPPER_CASE' | 'lower case' | 'Title Case' | 'Sentence case'

function splitWords(str: string): string[] {
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function toCamelCase(str: string): string {
  const words = splitWords(str)
  return words
    .map((word, i) => (i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join('')
}

function toPascalCase(str: string): string {
  const words = splitWords(str)
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join('')
}

function toSnakeCase(str: string): string {
  return splitWords(str).join('_').toLowerCase()
}

function toKebabCase(str: string): string {
  return splitWords(str).join('-').toLowerCase()
}

function toUpperCase(str: string): string {
  return splitWords(str).join('_').toUpperCase()
}

function toLowerCase(str: string): string {
  return splitWords(str).join(' ').toLowerCase()
}

function toTitleCase(str: string): string {
  return splitWords(str)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function toSentenceCase(str: string): string {
  const lower = splitWords(str).join(' ').toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

const CONVERTERS: Record<CaseType, (str: string) => string> = {
  camelCase: toCamelCase,
  PascalCase: toPascalCase,
  snake_case: toSnakeCase,
  'kebab-case': toKebabCase,
  UPPER_CASE: toUpperCase,
  'lower case': toLowerCase,
  'Title Case': toTitleCase,
  'Sentence case': toSentenceCase,
}

const CASE_EXAMPLES: Record<CaseType, string> = {
  camelCase: 'myVariableName',
  PascalCase: 'MyClassName',
  snake_case: 'my_variable_name',
  'kebab-case': 'my-css-class',
  UPPER_CASE: 'MY_CONSTANT',
  'lower case': 'simple text',
  'Title Case': 'Document Title',
  'Sentence case': 'Normal sentence',
}

export const StringCaseConverter: FC = () => {
  const [input, setInput] = useState('')

  const conversions = useMemo(() => {
    if (!input.trim()) return []
    return (Object.keys(CONVERTERS) as CaseType[]).map((caseType) => ({
      type: caseType,
      result: CONVERTERS[caseType](input),
      example: CASE_EXAMPLES[caseType],
    }))
  }, [input])

  return (
    <ToolLayout
      title="String Case Converter"
      description="Convert text between different naming conventions"
    >
      <div className="space-y-4">
        <InputArea
          value={input}
          onChange={setInput}
          label="Input Text"
          placeholder="Enter text to convert (e.g., 'hello world', 'helloWorld', 'hello_world')"
          rows={3}
        />

        {conversions.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {conversions.map(({ type, result }) => (
              <div key={type} className="bg-muted/50 p-3 rounded-md">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">{type}</span>
                  <CopyButton text={result} />
                </div>
                <code className="text-sm font-mono break-all">{result}</code>
              </div>
            ))}
          </div>
        )}

        {!input.trim() && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Supported case formats:</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(CASE_EXAMPLES) as CaseType[]).map((caseType) => (
                <div key={caseType} className="bg-muted/50 p-2 rounded-md">
                  <span className="text-xs font-medium">{caseType}</span>
                  <p className="font-mono text-sm text-muted-foreground">{CASE_EXAMPLES[caseType]}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ToolLayout>
  )
}
