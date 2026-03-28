import { useState, useMemo, type FC } from 'react'
import { ToolLayout, InputArea } from './shared'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'

interface Match {
  text: string
  index: number
  groups: string[]
}

export const RegexTester: FC = () => {
  const [pattern, setPattern] = useState('')
  const [testString, setTestString] = useState('')
  const [flags, setFlags] = useState({ g: true, i: false, m: false, s: false })

  const result = useMemo(() => {
    if (!pattern || !testString) {
      return { matches: [], error: null, highlightedText: testString }
    }

    try {
      const flagStr = Object.entries(flags)
        .filter(([, enabled]) => enabled)
        .map(([flag]) => flag)
        .join('')

      const regex = new RegExp(pattern, flagStr)
      const matches: Match[] = []

      if (flags.g) {
        let match
        while ((match = regex.exec(testString)) !== null) {
          matches.push({
            text: match[0],
            index: match.index,
            groups: match.slice(1),
          })
          if (match[0].length === 0) regex.lastIndex++
        }
      } else {
        const match = regex.exec(testString)
        if (match) {
          matches.push({
            text: match[0],
            index: match.index,
            groups: match.slice(1),
          })
        }
      }

      let highlightedText = testString
      const sortedMatches = [...matches].sort((a, b) => b.index - a.index)
      for (const match of sortedMatches) {
        const before = highlightedText.slice(0, match.index)
        const after = highlightedText.slice(match.index + match.text.length)
        highlightedText = `${before}<mark>${match.text}</mark>${after}`
      }

      return { matches, error: null, highlightedText }
    } catch (e) {
      return {
        matches: [],
        error: e instanceof Error ? e.message : 'Invalid regex',
        highlightedText: testString,
      }
    }
  }, [pattern, testString, flags])

  const toggleFlag = (flag: keyof typeof flags) => {
    setFlags((prev) => ({ ...prev, [flag]: !prev[flag] }))
  }

  return (
    <ToolLayout
      title="Regex Tester"
      description="Test regular expressions with live matching and capture groups"
    >
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Regular Expression</label>
          <div className="flex gap-2 items-center">
            <span className="text-muted-foreground">/</span>
            <Input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="[a-z]+"
              className="font-mono flex-1"
            />
            <span className="text-muted-foreground">/</span>
            <div className="flex gap-3">
              {(['g', 'i', 'm', 's'] as const).map((flag) => (
                <label key={flag} className="flex items-center gap-1 cursor-pointer">
                  <Checkbox
                    checked={flags[flag]}
                    onCheckedChange={() => toggleFlag(flag)}
                  />
                  <span className="font-mono text-sm">{flag}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {result.error && (
          <div className="text-destructive text-sm p-3 bg-destructive/10 rounded-md">
            {result.error}
          </div>
        )}

        <InputArea
          value={testString}
          onChange={setTestString}
          label="Test String"
          placeholder="Enter text to test against the regex..."
          rows={6}
        />

        {testString && !result.error && (
          <>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Matches ({result.matches.length})
              </label>
              <div
                className="bg-muted/50 p-3 rounded-md font-mono text-sm whitespace-pre-wrap break-all"
                dangerouslySetInnerHTML={{
                  __html: result.highlightedText
                    .replace(/</g, '&lt;')
                    .replace(/&lt;mark&gt;/g, '<mark class="bg-yellow-300 dark:bg-yellow-700 px-0.5 rounded">')
                    .replace(/&lt;\/mark&gt;/g, '</mark>'),
                }}
              />
            </div>

            {result.matches.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-2 block">Match Details</label>
                <div className="space-y-2 max-h-[200px] overflow-auto">
                  {result.matches.map((match, i) => (
                    <div key={i} className="bg-muted/50 p-2 rounded-md text-sm">
                      <div className="flex justify-between">
                        <span className="font-mono">"{match.text}"</span>
                        <span className="text-muted-foreground text-xs">index: {match.index}</span>
                      </div>
                      {match.groups.length > 0 && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Groups: {match.groups.map((g, j) => (
                            <span key={j} className="font-mono bg-muted px-1 rounded mx-1">
                              ${j + 1}: "{g}"
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Flags:</strong> g = global, i = case insensitive, m = multiline, s = dotAll</p>
        </div>
      </div>
    </ToolLayout>
  )
}
