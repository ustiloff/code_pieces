function asyncToCb (asyncFunc) {
  return function (...args) {
    const cb = args.pop()
    return asyncFunc(...args).then(res => cb(null, res), err => cb(err))
  }
}

function asyncMW (fn) {
  return (fn.length === 4)
    ? (err, req, res, next) => fn(err, req, res, next).catch(next)
    : (req, res, next) => fn(req, res, next).catch(next)
}

function promiseFromCBMethod (methodName) {
  return function (...args) {
    return new Promise((resolve, reject) => {
      this[methodName](...args, (err, res) => {
        if (err) reject(err)
        else resolve(res)
      })
    })
  }
}

function promiseFromCBFunction (fn) {
  return function (...args) {
    return new Promise((resolve, reject) => {
      fn(...args, (err, res) => {
        if (err) reject(err)
        else resolve(res)
      })
    })
  }
}

function promiseFromStreamEvents (emitter) {
  return new Promise(function (resolve, reject) {
    emitter.on('error', reject)
    emitter.on('end', _ => resolve('end'))
    emitter.on('close', _ => reject(Error('StreamClosed')))
  })
}

module.exports = {
  asyncToCb,
  asyncMW,
  promiseFromCBMethod,
  promiseFromCBFunction,
  promiseFromStreamEvents
}
