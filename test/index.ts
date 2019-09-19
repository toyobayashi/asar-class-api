import 'mocha'
// import * as crypto from 'crypto'
import * as fs from 'fs-extra'
import * as assert from 'assert'
import { join } from 'path'
import * as Asar from '../index'

const origin = join(__dirname, 'electron.asar')
const repack = join(__dirname, 'repack.asar')
const extractTarget = join(__dirname, 'extract')

describe('Asar', function () {
  it('clean', async function () {
    this.timeout(Infinity)
    const ignore = [
      'electron.asar',
      'index.ts',
      'test',
      'test.asar'
    ]
    await Promise.all(fs.readdirSync(__dirname).map(s => {
      if (ignore.indexOf(s) === -1) {
        return fs.remove(join(__dirname, s))
      } else {
        return Promise.resolve()
      }
    }))
  })

  it('extract', async function () {
    this.timeout(Infinity)
    const asar = Asar.open(origin)
    let count = 0
    await asar.extract('.', extractTarget, function (info) {
      count++
      assert.ok(info, 'Progress info null.')
    })
    if (count === 0) {
      throw new Error('Callback should call.')
    }
    assert.ok(fs.statSync(extractTarget).isDirectory())

    asar.close()
  })

  it('pack', async function () {
    this.timeout(Infinity)
    const res = await Asar.pack(extractTarget, repack)
    const asar = new Asar(res)
    asar.open()
    assert.ok(asar.getFileSize() === res.fileSize)
    // const originMD5 = crypto.createHash('md5').update(fs.readFileSync(origin)).digest('hex')
    // const packMD5 = crypto.createHash('md5').update(fs.readFileSync(repack)).digest('hex')
    // assert.strictEqual(packMD5, originMD5)
    asar.close()
  })

  it('write', async function () {
    this.timeout(Infinity)
    const asar = Asar.open(repack)
    await asar.write('./test/unpack', extractTarget, true)
    assert.ok(Object.prototype.hasOwnProperty.call(asar.getNode('./test/unpack'), 'files'))
    // await asar.extract('.', join(__dirname, 'electron_asar_write'))
    // assert.ok(fs.existsSync(join(__dirname, 'electron_asar_write', 'test/unpack')))
    asar.close()
  })

  it('erase', async function () {
    this.timeout(Infinity)
    const asar = Asar.open(repack)
    await asar.erase('./renderer')
    await asar.erase('./test/unpack/renderer')
    assert.ok(asar.getNode('./renderer') === null)
    assert.ok(asar.getNode('./test/unpack/renderer') === null)
    // await asar.extract('.', join(__dirname, 'erase'))
    // assert.ok(!fs.existsSync(join(__dirname, 'erase', 'renderer')))
    asar.close()
  })

  it('unpack', async function () {
    this.timeout(Infinity)
    const tmp = join(__dirname, 'unpk.asar')
    await fs.copy(origin, tmp)
    const asar = Asar.open(tmp)
    const a = asar.list()
    await asar.unpack(['./renderer', './browser', './worker/init.js'])
    const b = asar.list()
    assert.deepStrictEqual(b, a)
    asar.close()
  })

  it('erase_unpack', async function () {
    this.timeout(Infinity)
    const asar = Asar.open(join(__dirname, 'unpk.asar'))
    await asar.erase('./renderer/extensions')
    assert.ok(asar.getNode('./renderer/extensions') === null)
    // await asar.extract('.', join(__dirname, 'electron_asar_erase_unpack'))
    // assert.ok(!fs.existsSync(join(__dirname, 'electron_asar_erase_unpack', 'renderer/extensions')))
    asar.close()
  })

  it('symlink', async function () {
    this.timeout(Infinity)
    await Asar.pack(join(__dirname, 'test'), join(__dirname, 'test3.asar'))
    const asar = Asar.open(join(__dirname, 'test3.asar'))
    await asar.extract('.', join(__dirname, 'test3'))
    asar.close()
  })
})
