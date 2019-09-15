const { openSync, readSync, closeSync, statSync, createReadStream, createWriteStream, existsSync, mkdirsSync, symlink } = require('fs-extra')
const { join, sep, basename, dirname } = require('path')
const { createFromBuffer } = require('chromium-pickle-js')
const { createPackageWithOptions } = require('asar')

class Asar {
  constructor (src, headerSize, fileSize, header) {
    if (typeof src === 'object' && src !== null) {
      if (src instanceof Asar) {
        _asarInit.call(this, src._src, src._headerSize, src._fileSize, src._header)
      } else {
        _asarInit.call(this, src.src, src.headerSize, src.fileSize, src.header)
      }
    } else {
      _asarInit.call(this, src, headerSize, fileSize, header)
    }
    return this
  }

  isOpened () {
    return (this._fd !== null)
  }

  open (asarPath) {
    asarPath = asarPath || this._src
    if (!asarPath) {
      throw new Error('Invalid asar path.')
    }
    if (this.isOpened()) {
      this.close()
    }

    try {
      this._fd = openSync(asarPath, 'r')
    } catch (err) {
      throw new Error(`Open file failed: ${asarPath}`)
    }
    this._src = asarPath

    const headerSizeBuffer = Buffer.alloc(8, 0)
    readSync(this._fd, headerSizeBuffer, 0, 8, 0)
    try {
      this._headerSize = createFromBuffer(headerSizeBuffer).createIterator().readUInt32()
    } catch (err) {
      throw new Error('Invalid asar file. Read header size failed.')
    }

    const headerBuffer = Buffer.alloc(this._headerSize, 0)
    readSync(this._fd, headerBuffer, 0, this._headerSize, 8)

    try {
      this._header = JSON.parse(createFromBuffer(headerBuffer).createIterator().readString())
    } catch (err) {
      throw new Error('Invalid asar file. Read header failed.')
    }

    try {
      this._fileSize = statSync(this._src).size
    } catch (err) {
      throw new Error('Read file size failed.')
    }
  }

  close () {
    if (this._fd === null) {
      return
    }
    try {
      closeSync(this._fd)
    } catch (err) {
      throw new Error(`Close file failed: ${this._src}`)
    }
    _asarInit.call(this, this._src)
  }

  getSrc () {
    return this._src
  }

  getFileSize () {
    return this._fileSize
  }

  getNodeSize (nodeOrPath) {
    if (typeof nodeOrPath === 'string') {
      return Asar.getNodeSize(this._header, nodeOrPath)
    } else {
      return Asar.getNodeSize(nodeOrPath)
    }
  }

  getHeaderSize () {
    return this._headerSize
  }

  getHeader (copy) {
    if (copy === true) {
      return JSON.parse(JSON.stringify(this._header))
    }

    return this._header
  }

  getNode (...path) {
    return Asar.getNode(this._header, ...path)
  }

  copyNode (...path) {
    return Asar.copyNode(this._header, ...path)
  }

  existsSync (...path) {
    return Asar.existsSync(this._header, ...path)
  }

  readdirSync (...path) {
    return Asar.readdirSync(this._header, ...path)
  }

  readFileSync (path, encoding = 'binary') {
    _asarCheck.call(this)
    const node = this.getNode(path)
    if (!node) throw new Error(`No such file or directory: ${join(this._src, path)}`)

    if (node.files) {
      throw new Error(`Illegal operation on a directory: ${join(this._src, path)}`)
    }

    const buf = Buffer.alloc(node.size)
    readSync(this._fd, buf, 0, node.size, 8 + this._headerSize + Number(node.offset))
    if (encoding !== 'binary') {
      return buf.toString(encoding)
    } else {
      return buf
    }
  }

  readFile (path, encoding = 'binary', callback = null) {
    const useCallback = (typeof callback === 'function')
    const promise = new Promise((resolve, reject) => {
      _asarCheck.call(this)
      const node = this.getNode(path)
      if (!node) throw new Error(`No such file or directory: ${join(this._src, path)}`)

      if (node.files) {
        throw new Error(`Illegal operation on a directory: ${join(this._src, path)}`)
      }

      const bufs = []
      createReadStream('', {
        fd: this._fd,
        autoClose: false,
        start: 8 + this._headerSize + Number(node.offset),
        end: 8 + this._headerSize + Number(node.offset) + node.size - 1
      }).on('data', (chunk) => {
        bufs.push(chunk)
      }).on('end', () => {
        const buf = Buffer.concat(bufs)
        if (encoding !== 'binary') {
          const res = buf.toString(encoding)
          if (useCallback) {
            callback(null, res)
          }
          resolve(res)
        } else {
          if (useCallback) {
            callback(null, buf)
          }
          resolve(buf)
        }
      }).on('error', (err) => {
        if (useCallback) {
          callback(err)
        }
        reject(err)
      })
    })

    if (!useCallback) {
      return promise
    }
  }

  walk (callback, path = '') {
    _asarCheck.call(this)
    return Asar.walk(this._header, callback, path)
  }

  async asyncWalk (callback, path = '') {
    _asarCheck.call(this)
    return Asar.asyncWalk(this._header, callback, path)
  }

  async extract (path, dest, onProgress) {
    _asarCheck.call(this)
    path = path.replace(/\\/g, '/')
    const node = this.getNode(path)
    if (!node) throw new Error(`No such file or directory: ${join(this._src, path)}`)

    const target = join(dest, basename(path))

    if (node.files) {
      for (const name in node.files) {
        await this.extract(join(path, name), target, onProgress)
      }
      return
    }

    if (!existsSync(dirname(target))) mkdirsSync(dirname(target))
    if (node.unpacked) {
      return new Promise((resolve, reject) => {
        let len = 0
        console.log(join(this._src + '.unpacked', path))
        try {
          createReadStream(join(this._src + '.unpacked', path))
            .on('data', (chunk) => {
              len += chunk.length
              if (typeof onProgress === 'function') {
                onProgress({
                  filename: path,
                  total: node.size,
                  current: len,
                  size: chunk.length
                })
              }
            })
            .on('error', (err) => {
              reject(err)
            })
            .pipe(
              createWriteStream(target)
                .on('close', () => resolve())
                .on('error', (err) => {
                  reject(err)
                })
            )
        } catch (err) {
          reject(err)
        }
      })
    }

    if (node.link) {
      const target = node.link
      return new Promise((resolve, reject) => {
        const stat = statSync(target)
        symlink(target, target, stat.isDirectory() ? 'dir' : 'file', (err) => {
          if (err) {
            reject(err)
          }
          resolve()
        })
      })
    }

    return new Promise((resolve, reject) => {
      let len = 0
      try {
        if (node.size > 0) {
          createReadStream('', {
            fd: this._fd,
            autoClose: false,
            start: 8 + this._headerSize + Number(node.offset),
            end: 8 + this._headerSize + Number(node.offset) + node.size - 1
          })
            .on('data', (chunk) => {
              len += chunk.length
              if (typeof onProgress === 'function') {
                onProgress({
                  filename: path,
                  total: node.size,
                  current: len,
                  size: chunk.length
                })
              }
            })
            .on('error', (err) => {
              reject(err)
            })
            .pipe(
              createWriteStream(target)
                .on('close', () => resolve())
                .on('error', (err) => {
                  reject(err)
                })
            )
        } else {
          closeSync(openSync(target, 'w'))
          resolve()
        }
      } catch (err) {
        reject(err)
      }
    })
  }
}

Asar.open = function (asarPath) {
  const asar = new Asar()
  asar.open(asarPath)
  return asar
}

Asar.validate = function (node) {
  if ((typeof node === 'object' && node !== null) && (
    (Object.prototype.toString.call(node.files) === '[object Object]') || (
      typeof node.size === 'number' && typeof node.offset === 'string'
    )
  )) {
    return true
  } else {
    return false
  }
}

Asar.getNode = function (rootNode, ...path) {
  if (!path.length) return null
  let p = join(...path)

  if (p[0] === '/' || p[0] === '\\') p = p.substring(1)
  if (p === '' || p === '.') return (Asar.validate(rootNode) ? rootNode : null)

  const paths = p.split(sep)
  let pointer = rootNode.files

  for (let i = 0; i < paths.length - 1; i++) {
    if (pointer === undefined) return null
    if (pointer[paths[i]] !== undefined) {
      pointer = pointer[paths[i]].files
    }
  }

  if (!pointer || pointer[paths[paths.length - 1]] === undefined) return null
  return pointer[paths[paths.length - 1]]
}

Asar.copyNode = function (rootNode, ...path) {
  const node = Asar.getNode(rootNode, ...path)
  if (node) {
    return JSON.parse(JSON.stringify(node))
  }
  return null
}

Asar.getNodeSize = function (rootNode, path) {
  let node
  if (typeof path === 'string') {
    node = Asar.getNode(rootNode, path)
  } else {
    node = rootNode
  }

  if (!Asar.validate(node)) {
    return 0
  }

  let res = 0
  if (node.files) {
    for (const name in node.files) {
      res += Asar.totalSize(node.files[name])
    }
  } else {
    res += (node.size || 0)
  }
  return res
}

Asar.existsSync = function (rootNode, ...path) {
  return (Asar.getNode(rootNode, ...path) !== null)
}

Asar.readdirSync = function (rootNode, ...path) {
  const node = Asar.getNode(rootNode, ...path)
  if (!node) {
    throw new Error(`No such directory: ${join(...path)}`)
  }
  if (!node.files) {
    throw new Error(`not a directory: ${join(...path)}`)
  }

  return Object.keys(node.files)
}

Asar.walk = function (node, callback, path = '') {
  if (typeof callback !== 'function') {
    return
  }
  if (callback(node, path) !== false) {
    if (node.files) {
      for (const name in node.files) {
        Asar.walk(node.files[name], callback, join(path, name))
      }
    }
  }
}

Asar.asyncWalk = async function (node, callback, path = '') {
  if (typeof callback !== 'function') {
    return
  }
  if ((await Promise.resolve(callback(node, path))) !== false) {
    if (node.files) {
      for (const name in node.files) {
        await Asar.asyncWalk(node.files[name], callback, join(path, name))
      }
    }
  }
}

Asar.pack = async function (dir, target, options = {}) {
  await createPackageWithOptions(dir, target, options)
  const asar = Asar.open(target)
  const res = {
    src: asar.getSrc(),
    headerSize: asar.getHeaderSize(),
    fileSize: asar.getFileSize(),
    header: asar.getHeader()
  }
  asar.close()
  return res
}

function _asarInit (src, headerSize, fileSize, header) {
  this._fd = null
  this._src = src || ''
  this._headerSize = headerSize || 0
  this._fileSize = fileSize || 0
  this._header = header || { files: {} }
}

function _asarCheck () {
  if (!this.isOpened()) {
    throw new Error('Invalid asar object.')
  }
}

module.exports = Asar
