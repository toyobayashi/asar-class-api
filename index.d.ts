declare class Asar {
  constructor (): Asar
  constructor (asar: Asar.IAsarNullable): Asar
  constructor (asar: Asar): Asar
  constructor (src: string): Asar
  constructor (src: string, headerSize: number): Asar
  constructor (src: string, headerSize: number, fileSize: number): Asar
  constructor (src: string, headerSize: number, fileSize: number, header: AsarNodeDirectory): Asar

  isOpened (): boolean
  close (): void
  open (asarPath?: string): void
  getSrc (): string
  getFileSize (): number

  getNodeSize (node: Asar.AsarNode): number
  getNodeSize (path: string): number

  getHeaderSize (): number
  getHeader (copy: boolean): Asar.AsarNodeDirectory
  getNode (...path: string[]): Asar.AsarNode | null
  copyNode (...path: string[]): Asar.AsarNode | null
  existsSync (...path: string[]): boolean
  readdirSync (...path: string[]): string[]

  readFileSync (path: string): Buffer
  readFileSync (path: string, encoding: 'binary'): Buffer
  readFileSync (path: string, encoding: string): string

  readFile (path: string): Promise<Buffer>
  readFile (path: string, encoding: 'binary'): Promise<Buffer>
  readFile (path: string, encoding: 'binary', callback: (err: Error | null, data?: Buffer) => void): void
  readFile (path: string, encoding: string): Promise<string>
  readFile (path: string, encoding: string, callback: (err: Error | null, data?: string) => void): void

  walk (callback?: (node: Asar.AsarNode, path: string) => any, path?: string): void
  asyncWalk (callback?: (node: Asar.AsarNode, path: string) => any, path?: string): Promise<void>
  extract (path: string, dest: string, onProgress?: (progress: ExtractProgress) => void): Promise<void>

  static open (asarPath: string): Asar
  static validate (node: any): boolean
  static getNode (rootNode: Asar.AsarNodeDirectory, ...path: string[]): Asar.AsarNode | null
  static copyNode (rootNode: Asar.AsarNodeDirectory, ...path: string[]): Asar.AsarNode | null
  static getNodeSize (node: Asar.AsarNode): number
  static getNodeSize (node: Asar.AsarNodeDirectory, path: string): number
  static existsSync (rootNode: Asar.AsarNodeDirectory, ...path: string[]): boolean
  static readdirSync (rootNode: Asar.AsarNodeDirectory, ...path: string[]): string[]
  static walk (rootNode: Asar.AsarNodeDirectory, callback?: (node: Asar.AsarNode, path: string) => any, path?: string): void
  static asyncWalk (rootNode: Asar.AsarNodeDirectory, callback?: (node: Asar.AsarNode, path: string) => any, path?: string): Promise<void>
  static pack (path: string, target: string, options?: Asar.PackOptions): Promise<Asar.IAsar>
}

declare namespace Asar {
  export interface AsarNodeDirectory {
    files: {
      [item: string]: AsarNode
    }
  }

  export interface AsarNodeFile {
    size: number
    offset: string
    unpacked?: boolean
    executable?: boolean
    link?: string
  }

  export type AsarNode = AsarNodeDirectory | AsarNodeFile

  export interface IAsar {
    src: string
    fileSize: number
    headerSize: number
    header: AsarNodeDirectory
  }

  export interface IAsarNullable {
    src?: string
    fileSize?: number
    headerSize?: number
    header?: AsarNodeDirectory
  }

  export interface ExtractProgress {
    filename: string
    total: number
    current: number
    size: number
  }

  export interface PackOptions {
    globOptions?: any
    dot?: boolean
    pattern?: string
    ordering?: string
    unpackDir?: string
    unpack?: string
    [key: string]: any
  }
}

export = Asar