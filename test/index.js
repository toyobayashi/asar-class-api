const path = require('path')
const Asar = require('../index.js')

const electronAsar = Asar.open(path.join(__dirname, 'electron.asar'))

electronAsar.extract('.', path.join(__dirname, 'electron_asar'), function (info) {
  console.log(info)
}).then(function () {
  console.log('done')
  electronAsar.close()

  Asar.pack(path.join(__dirname, 'electron_asar'), path.join(__dirname, 'el.asar')).then(res => {
    console.log(res)
  })
})

electronAsar.asyncWalk((node, path) => {
  console.log(path)
})

console.log(electronAsar.readdirSync('renderer'))
