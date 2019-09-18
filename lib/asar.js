const { join, sep, relative, extname, dirname } = require('path')
const { readdirSync, lstatSync, realpathSync, createWriteStream, createReadStream } = process.versions.electron ? require('original-fs') : require('fs-extra')
const { mkdirsSync } = require('fs-extra')
const { UINT64 } = require('cuint')
const pickle = require('chromium-pickle-js')

class AsarHeader {
  constructor (node) {
    if (node && Object.prototype.toString.call(node.files) === '[object Object]') {
      this.files = JSON.parse(JSON.stringify(node.files))
    }
    this.files = {}
  }

  insertNode (path, node) {
    if (!path) return false
    let p = join(path)

    if (p[0] === '/' || p[0] === '\\') p = p.substring(1)
    if (p === '' || p === '.') return false

    const paths = p.split(sep)
    let pointer = this.files

    for (let i = 0; i < paths.length - 1; i++) {
      if (pointer[paths[i]] !== undefined) {
        pointer = pointer[paths[i]].files
      } else {
        pointer[paths[i]] = { files: {} }
        pointer = pointer[paths[i]].files
      }
    }

    pointer[paths[paths.length - 1]] = node
    return true
  }

  removeNode (path) {
    if (!path) return false
    let p = join(path)

    if (p[0] === '/' || p[0] === '\\') p = p.substring(1)
    if (p === '' || p === '.') {
      this.files = {}
      return true
    }

    const paths = p.split(sep)
    let pointer = this.files

    for (let i = 0; i < paths.length - 1; i++) {
      if (pointer === undefined) return true
      if (pointer[paths[i]] !== undefined) {
        pointer = pointer[paths[i]].files
      }
    }

    if (!pointer || pointer[paths[paths.length - 1]] === undefined) return true
    delete pointer[paths[paths.length - 1]]
    return true
  }

  getNode (path) {
    if (!path) return null
    let p = join(path)

    if (p[0] === '/' || p[0] === '\\') p = p.substring(1)
    if (p === '' || p === '.') return this

    const paths = p.split(sep)
    let pointer = this.files

    for (let i = 0; i < paths.length - 1; i++) {
      if (pointer === undefined) return null
      if (pointer[paths[i]] !== undefined) {
        pointer = pointer[paths[i]].files
      }
    }

    if (!pointer || pointer[paths[paths.length - 1]] === undefined) return null
    return pointer[paths[paths.length - 1]]
  }
}

function walkDir (dir, callback) {
  const items = readdirSync(dir)
  for (let i = 0; i < items.length; i++) {
    if (items[i] !== '.' && items[i] !== '..') {
      const full = join(dir, items[i])
      callback(full)
    }
  }
}

function createHeader (dir, unpack, offset, totalSize, files, rootDir) {
  const header = new AsarHeader()
  offset = offset || UINT64(0)
  totalSize = totalSize || UINT64(0)
  files = files || []
  rootDir = rootDir || dir

  const walkHandler = (path) => {
    const pathInAsar = (sep + relative(dir, path)).replace(/\\/g, '/')
    const pathInAsarFull = (sep + relative(rootDir, path)).replace(/\\/g, '/')
    const stat = lstatSync(path)
    if (stat.isDirectory()) {
      header.insertNode(pathInAsar, createHeader(path, unpack, offset, totalSize, files, rootDir).header)
    } else {
      const node = {
        size: stat.size
      }

      if (stat.isSymbolicLink()) {
        const link = relative(realpathSync(rootDir), realpathSync(path))
        if (link.substr(0, 2) === '..') {
          throw new Error(`${path}: file links out of the package`)
        }
        delete node.size
        node.link = link
      }

      if (typeof unpack === 'string' && unpack !== '') {
        if (pathInAsarFull.indexOf(unpack.replace(/\\/g, '/')) !== -1) {
          node.unpacked = true
        }
      } else if (Array.isArray(unpack)) {
        for (let i = 0; i < unpack.length; i++) {
          if (typeof unpack[i] === 'string' && unpack[i] !== '' && pathInAsarFull.indexOf(unpack[i].replace(/\\/g, '/')) !== -1) {
            node.unpacked = true
            break
          }
        }
      } else if (unpack instanceof RegExp) {
        if (unpack.test(pathInAsarFull)) {
          node.unpacked = true
        }
      }

      if (!node.link && ((process.platform === 'win32' && extname(path) === '.exe') || (process.platform !== 'win32' && (stat.mode & 0o100)))) {
        node.executable = true
      }

      if (!node.unpacked && !node.link) {
        node.offset = offset.toString()
        offset.add(UINT64(stat.size))
      }
      header.insertNode(pathInAsar, node)
      totalSize.add(node.link ? UINT64(0) : UINT64(stat.size))
      files.push({ path, size: stat.size, unpacked: !!node.unpacked, symlink: !!node.link })
    }
  }

  walkDir(dir, walkHandler)

  return { header: JSON.parse(JSON.stringify(header)), files, size: totalSize }
}

async function pack (src, dest, unpack, onProgress) {
  const { header, files, size } = createHeader(src, unpack)
  const headerString = JSON.stringify(header)

  const headerPickle = pickle.createEmpty()
  headerPickle.writeString(headerString)
  const headerBuf = headerPickle.toBuffer()

  const sizePickle = pickle.createEmpty()
  sizePickle.writeUInt32(headerBuf.length)
  const sizeBuf = sizePickle.toBuffer()

  mkdirsSync(dirname(dest))
  const out = createWriteStream(dest)

  const write = (data) => {
    return new Promise((resolve) => {
      if (!out.write(data)) {
        out.once('drain', resolve)
      } else {
        process.nextTick(resolve)
      }
    })
  }

  await write(sizeBuf)
  await write(headerBuf)

  const packed = UINT64(0)
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (!file.unpacked) {
      if (file.symlink) {
        continue
      }
      await new Promise((resolve, reject) => {
        createReadStream(file.path)
          .on('error', reject)
          .on('data', (chunk) => {
            packed.add(UINT64(chunk.length))
            if (typeof onProgress === 'function') {
              onProgress({
                currentFile: file.path,
                total: size.toString(),
                packed: packed.toString(),
                percent: UINT64(packed).div(size).toNumber() * 100,
                chunkLength: chunk.length
              })
            }
          })
          .on('end', resolve)
          .pipe(out, { end: false })
      })
    } else {
      const target = join(`${dest}.unpacked`, relative(src, file.path))
      mkdirsSync(dirname(target))
      await new Promise((resolve, reject) => {
        createReadStream(file.path)
          .on('error', reject)
          .on('data', (chunk) => {
            packed.add(UINT64(chunk.length))
            if (typeof onProgress === 'function') {
              onProgress({
                currentFile: file.path,
                total: size.toString(),
                packed: packed.toString(),
                percent: UINT64(packed).div(size).toNumber() * 100,
                chunkLength: chunk.length
              })
            }
          })
          .pipe(
            createWriteStream(target)
              .on('error', reject)
              .on('close', resolve)
          )
      })
    }
  }

  await new Promise((resolve) => {
    out.end(resolve)
  })
}

module.exports.pack = pack
