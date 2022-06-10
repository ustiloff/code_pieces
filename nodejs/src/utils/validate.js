const validators = {
  id (str) {
    const num = Number(str)
    if (!isFinite(num)) throw Error(404)
    return num
  }
}

module.exports = validators

