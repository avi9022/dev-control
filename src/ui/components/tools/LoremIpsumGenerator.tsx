import { useState, type FC } from 'react'
import { ToolLayout, OutputArea } from './shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RefreshCw } from 'lucide-react'

const LOREM_WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
  'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
  'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
  'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
  'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
  'velit', 'esse', 'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint',
  'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia',
  'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum', 'perspiciatis', 'unde',
  'omnis', 'iste', 'natus', 'error', 'voluptatem', 'accusantium', 'doloremque',
  'laudantium', 'totam', 'rem', 'aperiam', 'eaque', 'ipsa', 'quae', 'ab', 'illo',
  'inventore', 'veritatis', 'quasi', 'architecto', 'beatae', 'vitae', 'dicta',
  'explicabo', 'nemo', 'ipsam', 'voluptas', 'aspernatur', 'aut', 'odit', 'fugit',
]

function getRandomWord(): string {
  return LOREM_WORDS[Math.floor(Math.random() * LOREM_WORDS.length)]
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function generateWords(count: number): string {
  const words: string[] = []
  for (let i = 0; i < count; i++) {
    words.push(getRandomWord())
  }
  return words.join(' ')
}

function generateSentence(): string {
  const wordCount = Math.floor(Math.random() * 10) + 5
  const words = generateWords(wordCount)
  return capitalize(words) + '.'
}

function generateSentences(count: number): string {
  const sentences: string[] = []
  for (let i = 0; i < count; i++) {
    sentences.push(generateSentence())
  }
  return sentences.join(' ')
}

function generateParagraph(): string {
  const sentenceCount = Math.floor(Math.random() * 4) + 3
  return generateSentences(sentenceCount)
}

function generateParagraphs(count: number): string {
  const paragraphs: string[] = []
  for (let i = 0; i < count; i++) {
    paragraphs.push(generateParagraph())
  }
  return paragraphs.join('\n\n')
}

type UnitType = 'words' | 'sentences' | 'paragraphs'

export const LoremIpsumGenerator: FC = () => {
  const [output, setOutput] = useState('')
  const [count, setCount] = useState(5)
  const [unit, setUnit] = useState<UnitType>('paragraphs')
  const [startWithLorem, setStartWithLorem] = useState(true)

  const handleGenerate = () => {
    let result = ''

    switch (unit) {
      case 'words':
        result = generateWords(count)
        break
      case 'sentences':
        result = generateSentences(count)
        break
      case 'paragraphs':
        result = generateParagraphs(count)
        break
    }

    if (startWithLorem && result.length > 0) {
      if (unit === 'words') {
        result = 'Lorem ipsum ' + result
      } else {
        result = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' + result.slice(result.indexOf(' ') + 1)
      }
    }

    setOutput(result)
  }

  return (
    <ToolLayout
      title="Lorem Ipsum Generator"
      description="Generate placeholder text for designs and mockups"
    >
      <div className="space-y-4">
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm">Generate</span>
            <Input
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) => setCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-20"
            />
          </div>

          <Select value={unit} onValueChange={(v) => setUnit(v as UnitType)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="words">Words</SelectItem>
              <SelectItem value="sentences">Sentences</SelectItem>
              <SelectItem value="paragraphs">Paragraphs</SelectItem>
            </SelectContent>
          </Select>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={startWithLorem}
              onChange={(e) => setStartWithLorem(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Start with "Lorem ipsum..."</span>
          </label>
        </div>

        <Button onClick={handleGenerate} className="w-full">
          <RefreshCw className="h-4 w-4 mr-2" />
          Generate
        </Button>

        <OutputArea value={output} label="Generated Text" />

        {output && (
          <div className="text-xs text-muted-foreground">
            {output.split(/\s+/).length} words, {output.length} characters
          </div>
        )}
      </div>
    </ToolLayout>
  )
}
