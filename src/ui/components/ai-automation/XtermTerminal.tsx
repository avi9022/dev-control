import { useEffect, useRef, type FC } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface XtermTerminalProps {
  cwd: string
  onExit?: (code: number) => void
}

export const XtermTerminal: FC<XtermTerminalProps> = ({ cwd, onExit }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const shellIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const styles = getComputedStyle(containerRef.current)
    const bg = styles.getPropertyValue('--ai-surface-0').trim()
    const isLight = bg.startsWith('#F') || bg.startsWith('#E') || bg.startsWith('#f') || bg.startsWith('#e')

    const darkTheme = {
      background: bg || '#1C1917',
      foreground: styles.getPropertyValue('--ai-text-primary').trim() || '#FAF9F7',
      cursor: styles.getPropertyValue('--ai-accent').trim() || '#9BB89E',
      selectionBackground: 'rgba(155, 184, 158, 0.3)',
    }

    const lightTheme = {
      background: bg || '#F7F5F2',
      foreground: '#2C2825',
      cursor: '#4A7A4E',
      selectionBackground: 'rgba(74, 122, 78, 0.2)',
      black: '#2C2825',
      red: '#C4453C',
      green: '#3A7A3E',
      yellow: '#8A6A18',
      blue: '#3465A4',
      magenta: '#75507B',
      cyan: '#1A7A7A',
      white: '#5C5752',
      brightBlack: '#7A756F',
      brightRed: '#A03030',
      brightGreen: '#2E6A32',
      brightYellow: '#7A5A08',
      brightBlue: '#2A5594',
      brightMagenta: '#65406B',
      brightCyan: '#0A6A6A',
      brightWhite: '#2C2825',
    }

    const term = new Terminal({
      fontSize: 13,
      fontFamily: 'JetBrains Mono, Menlo, monospace',
      cursorBlink: true,
      theme: isLight ? lightTheme : darkTheme,
    })

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)
    fit.fit()
    term.focus()

    termRef.current = term
    fitRef.current = fit

    // Spawn shell
    window.electron.shellSpawn(cwd).then((id) => {
      shellIdRef.current = id
      fit.fit()
      window.electron.shellResize(id, term.cols, term.rows)
    })

    // User input → shell
    const onData = term.onData((data) => {
      if (shellIdRef.current) {
        window.electron.shellWrite(shellIdRef.current, data)
      }
    })

    // Shell output → terminal
    const unsubOutput = window.electron.subscribeShellOutput((data) => {
      if (data.shellId === shellIdRef.current) {
        term.write(data.output)
      }
    })

    const unsubExit = window.electron.subscribeShellExit((data) => {
      if (data.shellId === shellIdRef.current) {
        term.write('\r\n\x1b[90m[shell exited]\x1b[0m\r\n')
        shellIdRef.current = null
        onExit?.(data.exitCode)
      }
    })

    // Resize handling
    const resizeObs = new ResizeObserver(() => {
      fit.fit()
      if (shellIdRef.current) {
        window.electron.shellResize(shellIdRef.current, term.cols, term.rows)
      }
    })
    resizeObs.observe(containerRef.current)

    return () => {
      onData.dispose()
      unsubOutput()
      unsubExit()
      resizeObs.disconnect()
      if (shellIdRef.current) {
        window.electron.shellKill(shellIdRef.current)
      }
      term.dispose()
    }
  }, [cwd])

  // Click to re-focus (in case Radix dialog stole focus)
  const handleClick = () => {
    termRef.current?.focus()
  }

  return <div ref={containerRef} className="h-full w-full" onClick={handleClick} />
}
