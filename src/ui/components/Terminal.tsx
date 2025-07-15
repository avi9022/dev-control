import { useEffect, useRef, useState, type FC } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CircleX, Trash2 } from "lucide-react";
import { useLogger } from "../contexts/logger";

interface TerminalProps {
  logs: string[];
  id: string
  height?: string | number;
}

interface HighlightToken {
  regex: RegExp;     // e.g. /\berror\b/i
  className: string; // e.g. "text-red-400"
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


export const Terminal: FC<TerminalProps> = ({ logs, id }) => {
  const { clearTerminal } = useLogger()
  const scrollRef = useRef<HTMLDivElement>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [matchIndexes, setMatchIndexes] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  useEffect(() => {
    setSearchTerm('')
    setSearchInput('')
    setMatchIndexes([])
  }, [id])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight
      });
    }
  }, [logs]);

  useEffect(() => {
    if (searchTerm) {
      const matches = logs
        .map((line, idx) => line.toLowerCase().includes(searchTerm.toLowerCase()) ? idx : -1)
        .filter(idx => idx !== -1);
      setMatchIndexes(matches);
      setCurrentMatchIndex(0);
    } else {
      setMatchIndexes([]);
      setCurrentMatchIndex(0);
    }
  }, [searchTerm, logs]);

  useEffect(() => {
    if (matchIndexes.length && scrollRef.current) {
      const lineEl = scrollRef.current.querySelector(`[data-log-line='${matchIndexes[currentMatchIndex]}']`);
      if (lineEl) {
        lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentMatchIndex, matchIndexes]);

  const handleNext = () => {
    if (matchIndexes.length === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % matchIndexes.length);
  };

  const handlePrev = () => {
    if (matchIndexes.length === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + matchIndexes.length) % matchIndexes.length);
  };

  const handleSearchSubmit = () => {
    setSearchTerm(searchInput);
  };

  const handleClearTerminal = () => {
    if (id) {
      clearTerminal(id)
    }
  }

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


  const renderLine = (line: string, idx: number) => {
    const prefixMatch = line.match(/^([A-Za-z]+)([:\s]+)/);
    let prefixNode: React.ReactNode | null = null;
    let remainder = line;

    if (prefixMatch) {
      const rawPrefix = prefixMatch[1].toUpperCase();
      const spacer = prefixMatch[2];
      const prefixLen = rawPrefix.length + spacer.length;

      if (LEVEL_PREFIXES[rawPrefix]) {
        prefixNode = (
          <span key={`prefix-${idx}`} className={`${LEVEL_PREFIXES[rawPrefix]}`}>
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

    const isMatch = matchIndexes.includes(idx);
    const isActive = isMatch && idx === matchIndexes[currentMatchIndex];

    const contentNodes = highlightTokensInLine(remainder, combinedTokens, isActive, searchTerm);

    return (
      <div key={idx} data-log-line={idx}
        className="whitespace-pre-wrap text-wrap break-all text-gray-200">
        {prefixNode}
        {contentNodes}
      </div>
    );
  };


  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-5 px-4 py-2 bg-gray-900 rounded-t-lg border-b border-gray-700">
        <div className="flex items-center flex-1 gap-2">
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
            setSearchTerm('')
            setSearchInput('')
          }}><CircleX /></Button>
          <Button variant="secondary" size={'sm'} onClick={handlePrev}><ChevronLeft /></Button>
          <Button variant="secondary" size={'sm'} onClick={handleNext}> <ChevronRight /></Button>
          {matchIndexes.length > 0 && (
            <div className="w-3">
              <span className="text-gray-400 text-sm">
                {`${currentMatchIndex + 1}/${matchIndexes.length}`}
              </span>
            </div>
          )}
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 bg-gray-950 font-mono text-sm whitespace-pre-wrap break-words break-all rounded-b-lg"
      >
        {logs.map((line, idx) => renderLine(line, idx))}
      </div>
    </div>
  );
};
