/// <reference types="vite/client" />

declare module 'node-pty' {
  interface IPty {
    pid: number
    onData: (callback: (data: string) => void) => void
    onExit: (callback: (event: { exitCode: number; signal?: number }) => void) => void
    write: (data: string) => void
    resize: (cols: number, rows: number) => void
    kill: (signal?: string) => void
  }

  interface IPtyForkOptions {
    name?: string
    cols?: number
    rows?: number
    cwd?: string
    env?: Record<string, string>
    encoding?: string
  }

  function spawn(
    file: string,
    args: string[],
    options?: IPtyForkOptions
  ): IPty
}

