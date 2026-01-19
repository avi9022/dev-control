export interface TerminalProps {
  id: string
  height?: string | number;
}

export interface HighlightToken {
  regex: RegExp;
  className: string;
}

export interface LogWindow {
  startLine: number;
  endLine: number;
  logs: string[];
}

export interface Viewport {
  start: number;
  end: number;
  scrollTop: number;
  clientHeight: number;
}
