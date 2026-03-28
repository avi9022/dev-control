import { useState, useMemo, type FC } from 'react'
import { ToolLayout, InputArea } from './shared'

interface Stats {
  characters: number
  charactersNoSpaces: number
  words: number
  sentences: number
  paragraphs: number
  lines: number
  avgWordLength: number
  avgSentenceLength: number
  readingTime: string
  speakingTime: string
}

function calculateStats(text: string): Stats {
  const characters = text.length
  const charactersNoSpaces = text.replace(/\s/g, '').length

  const words = text.trim() ? text.trim().split(/\s+/).length : 0

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length

  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length

  const lines = text.split('\n').length

  const avgWordLength = words > 0 ? charactersNoSpaces / words : 0
  const avgSentenceLength = sentences > 0 ? words / sentences : 0

  const wordsPerMinuteReading = 200
  const wordsPerMinuteSpeaking = 150

  const readingMinutes = words / wordsPerMinuteReading
  const speakingMinutes = words / wordsPerMinuteSpeaking

  const formatTime = (minutes: number): string => {
    if (minutes < 1) {
      return `${Math.ceil(minutes * 60)} sec`
    }
    const mins = Math.floor(minutes)
    const secs = Math.round((minutes - mins) * 60)
    if (secs === 0) return `${mins} min`
    return `${mins} min ${secs} sec`
  }

  return {
    characters,
    charactersNoSpaces,
    words,
    sentences,
    paragraphs,
    lines,
    avgWordLength: Math.round(avgWordLength * 10) / 10,
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    readingTime: formatTime(readingMinutes),
    speakingTime: formatTime(speakingMinutes),
  }
}

function getTopWords(text: string, limit = 10): { word: string; count: number }[] {
  const words = text.toLowerCase().match(/\b[a-z]+\b/g) || []
  const counts = new Map<string, number>()

  for (const word of words) {
    counts.set(word, (counts.get(word) || 0) + 1)
  }

  return Array.from(counts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

const StatCard: FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="bg-muted/50 p-3 rounded-md">
    <p className="text-2xl font-bold">{value}</p>
    <p className="text-xs text-muted-foreground">{label}</p>
  </div>
)

export const TextStats: FC = () => {
  const [input, setInput] = useState('')

  const stats = useMemo(() => calculateStats(input), [input])
  const topWords = useMemo(() => getTopWords(input), [input])

  return (
    <ToolLayout
      title="Text Stats"
      description="Count characters, words, sentences, and more"
    >
      <div className="space-y-4">
        <InputArea
          value={input}
          onChange={setInput}
          label="Input Text"
          placeholder="Enter or paste your text here..."
          rows={8}
        />

        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Characters" value={stats.characters.toLocaleString()} />
          <StatCard label="Characters (no spaces)" value={stats.charactersNoSpaces.toLocaleString()} />
          <StatCard label="Words" value={stats.words.toLocaleString()} />
          <StatCard label="Sentences" value={stats.sentences.toLocaleString()} />
          <StatCard label="Paragraphs" value={stats.paragraphs.toLocaleString()} />
          <StatCard label="Lines" value={stats.lines.toLocaleString()} />
          <StatCard label="Avg Word Length" value={stats.avgWordLength} />
          <StatCard label="Avg Sentence Length" value={stats.avgSentenceLength} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 p-3 rounded-md">
            <p className="text-lg font-semibold">{stats.readingTime}</p>
            <p className="text-xs text-muted-foreground">Reading time (~200 wpm)</p>
          </div>
          <div className="bg-muted/50 p-3 rounded-md">
            <p className="text-lg font-semibold">{stats.speakingTime}</p>
            <p className="text-xs text-muted-foreground">Speaking time (~150 wpm)</p>
          </div>
        </div>

        {topWords.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2">Top Words</h3>
            <div className="flex flex-wrap gap-2">
              {topWords.map(({ word, count }) => (
                <span
                  key={word}
                  className="px-2 py-1 bg-muted/50 rounded text-sm"
                >
                  {word} <span className="text-muted-foreground">({count})</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </ToolLayout>
  )
}
