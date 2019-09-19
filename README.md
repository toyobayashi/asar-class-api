# asar-class-api

## Usage

### Extract

``` js
const Asar = require('asar-class-api')

const asar = Asar.open('file.asar')
asar.extract('.', 'dest', progress => {
  console.log(progress)
}).then(() => {
  console.log('done')
}).catch(err => {
  console.error(err)
})
```

### Pack

``` js
const Asar = require('asar-class-api')

Asar.pack('dir', 'dest.asar', /* unpack: string | string[] | RegExp, */ progress => {
  console.log(progress)
}).then(info => {
  console.log(info)
}).catch(err => {
  console.error(err)
})
```

See `lib/asar.d.ts`.
