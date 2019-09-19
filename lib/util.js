const { readdirSync } = process.versions.electron ? require('original-fs') : require('fs-extra')
const { join } = require('path')

function walkDir (dir, callback) {
  const items = readdirSync(dir)
  for (let i = 0; i < items.length; i++) {
    if (items[i] !== '.' && items[i] !== '..') {
      const full = join(dir, items[i])
      callback(full)
    }
  }
}

const generateObjectId = (function () {
  let processUnique = ''
  for (let i = 0; i < 5; i++) {
    processUnique += toHex(Math.floor(Math.random() * 256))
  }
  let index = ~~(Math.random() * 0xffffff)

  function toHex (num) {
    const hex = num.toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }

  return function generateObjectId () {
    const time = ~~(Date.now() / 1000)
    let timeString = ''
    let indexString = ''
    timeString += toHex((time >> 24) & 0xff)
    timeString += toHex((time >> 16) & 0xff)
    timeString += toHex((time >> 8) & 0xff)
    timeString += toHex((time) & 0xff)

    indexString += toHex((index >> 16) & 0xff)
    indexString += toHex((index >> 8) & 0xff)
    indexString += toHex((index) & 0xff)
    index++
    return timeString + processUnique + indexString
  }
})()

module.exports = {
  walkDir,
  generateObjectId
}