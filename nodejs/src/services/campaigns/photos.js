const {PhotoNeed, PhotoRec, Side, Construction, City, PhotoType} = require('../../models')

const list = campaignId => PhotoNeed.rls().findAll({
  where: {campaignId},
  attributes: [
    'id',
    'sideId',
    'type',
    'deadline',
    'campaignId',
    'note',
    'createdAt',
    'updatedAt',
    'personId'
  ],
  include: {
    model: PhotoRec,
    attributes: [
      'id',
      'sideId',
      'type',
      'takenAt',
      'personId',
      'url'
    ],
    through: { attributes: [] }
  }
})

async function archive (campaignId, {year, month, day} = {}) {
  const photoNeedsWhere = {
    campaignId
  }
  if (year) {
    let range
    const y = Number(year)
    if (!isFinite(y)) throw Error('400: Invalid year')
    range = [[y, 0, 1], [y + 1, 0, 1]]
    if (month) {
      const m = Number(month) - 1
      if (!isFinite(m)) throw Error('400: Invalid month')
      range = [[y, m, 1], [y, m + 1, 1]]
      if (day) {
        const d = Number(day)
        if (!isFinite(d)) throw Error('400: Invalid day')
        range = [[y, m, d], [y, m, d + 1]]
      }
    }
    photoNeedsWhere.deadline = {
      $and: {
        $gte: new Date(Date.UTC(...range[0])),
        $lt: new Date(Date.UTC(...range[1]))
      }
    }
  }

  const photorecs = PhotoRec.findAll({
    attributes: ['id', 'type', 'url'],
    include: [{
      model: PhotoNeed,
      attributes: [],
      where: photoNeedsWhere,
      required: true
    }, {
      model: Side,
      attributes: ['num'],
      include: {
        model: Construction,
        attributes: ['id'],
        include: {
          model: City,
          attributes: ['nameEn']
        }
      }
    }]
  })

  const photoTypeToLetter = {
    [PhotoType.Night]: 'n',
    [PhotoType.Near]: 'b'
  }
  const urlsAndNames = photorecs.map(rec => {
    const {
      url, id, type, side: {
        num: faceNum, construction: {
          city: { nameEn: cityName }
        }
      }
    } = rec
    const typeLetter = photoTypeToLetter[type] || ''
    const name = `${cityName}/${faceNum}_${typeLetter}_${id}.jpg`
    return {url, name}
  })
  return urlsAndNames
}

module.exports = {
  list,
  archive
}

