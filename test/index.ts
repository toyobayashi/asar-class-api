import 'mocha'
import * as crypto from 'crypto'
import * as fs from 'fs-extra'
import * as assert from 'assert'
import { join } from 'path'
import * as Asar from '../index'

const target = join(__dirname, 'electron_asar')

describe('Asar', function () {
  it('extract', async function () {
    this.timeout(Infinity)
    const asar = Asar.open(join(__dirname, 'electron.asar'))
    let count = 0
    await asar.extract('.', target, function (info) {
      count++
      assert.ok(info, 'Progress info null.')
    })
    if (count === 0) {
      throw new Error('Callback should call.')
    }
    assert.ok(fs.statSync(target).isDirectory())

    asar.close()
  })

  it('pack', async function () {
    this.timeout(Infinity)
    const packTarget = join(__dirname, 'electron_asar.asar')
    const res = await Asar.pack(target, packTarget)
    const asar = new Asar(res)
    asar.open()
    assert.ok(asar.getFileSize() === res.fileSize)
    const originMD5 = crypto.createHash('md5').update(fs.readFileSync(join(__dirname, 'electron.asar'))).digest('hex')
    const packMD5 = crypto.createHash('md5').update(fs.readFileSync(packTarget)).digest('hex')
    assert.strictEqual(packMD5, originMD5)
    asar.close()
  })
})
