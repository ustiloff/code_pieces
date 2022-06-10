const ZipStream = require('zip-stream')
const request = require('request')
const { promiseFromCBMethod, promiseFromStreamEvents } = require('./async')

ZipStream.prototype.$entry = promiseFromCBMethod('entry')
async function zipUrls (outStream, urlsAndNames) {
  const outStreamPromise = promiseFromStreamEvents(outStream)
  const archive = new ZipStream({store: true})
  const archiveErrorPromise = promiseFromStreamEvents(archive)
  archive.pipe(outStream)
  for (let {url, name} of urlsAndNames) {
    const inStream = request.get(url)
    try {
      const res = await Promise.race([archive.$entry(inStream, { name }), archiveErrorPromise, outStreamPromise])
    } finally {
      inStream.end()
    }
  }
  archive.finish()
}

module.exports = {
  zipUrls
}
