const express = require('express')
const campaigns = require('../services/campaigns')
const proposals = require('../services/campaigns/proposals')
const photos = require('../services/campaigns/photos')
const posters = require('../services/campaigns/posters')
const documents = require('../services/campaigns/documents')
const serviceOperations = require('../services/campaigns/serviceOperations')
const estimations = require('../services/campaigns/estimations')
const published = require('../services/campaigns/published')
const publishedProposals = require('../services/campaigns/publishedProposals')
const publishedThirdParties = require('../services/campaigns/publishedThirdParties')
const presenterInvitations = require('../services/campaigns/presenterInvitations')
const pois = require('../services/campaigns/pois')

const {sequelize} = require('../models')
const SQL = require('sql-template-strings')

const {asyncMW} = require('../utils/async')
const {zipUrls} = require('../utils/zip')
const validate = require('../utils/validate')

const multer  = require('multer')
const upload = multer()

const router = express.Router()
router.get('/', asyncMW(async (req, res) => {
  const fromDate = req.query.fromDate
  const opts = fromDate ? {fromDate: new Date(fromDate)} : undefined
  const result = await campaigns.list(opts)
  res.json(result)
}))

router.post('/', asyncMW(async (req, res) => {
  const props = req.body
  const allProps = Object.assign(props, {
    clientId: req.user.orgId,
    ownerId: req.user.id
  })
  const newObj = await campaigns.create(allProps)
  res.status(201)
  res.header('Location', `${req.baseUrl}/${newObj.id}`)
  res.json(newObj)
}))

router.get('/:id', asyncMW(async (req, res) => {
  const campaign = await campaigns.byId(validate.id(req.params.id))
  if (!campaign) throw Error(404)
  res.json(campaign)
}))

router.delete('/:id', asyncMW(async (req, res) => {
  const deleted = await campaigns.remove(validate.id(req.params.id))
  if (deleted === 0) throw Error(404)
  res.json({deleted})
}))

router.put('/:id', asyncMW(async (req, res) => {
  const props = req.body
  const updated = await campaigns.replace(validate.id(req.params.id), props)
  if (updated === 0) throw Error(404)
  res.json({updated})
}))

router.get('/:id/proposals', asyncMW(async (req, res) => {
  res.json(await proposals.list(validate.id(req.params.id)))
}))

router.post('/:id/proposals', asyncMW(async (req, res) => {
  const props = req.body
  const campaignId = validate.id(req.params.id)
  const allProps = Object.assign(props, {campaignId})
  const newObj = await proposals.create(allProps)
  if (!newObj || !newObj.id) {
    res.status(205)
    res.json({})
  } else {
      res.status(201)
      res.header('Location', `${req.baseUrl}/${campaignId}/proposals/${newObj.id}`)
      res.json(newObj)
    }
}))

router.put('/:id/proposals/:proposalId', asyncMW(async (req, res) => {
  const props = req.body
  const updated = await proposals.update(validate.id(req.params.proposalId), props)
  if (updated === 0) throw Error(404)
  res.json({updated})
}))

router.delete('/:id/proposals/:proposalId', asyncMW(async (req, res) => {
  const deleted = await proposals.remove(validate.id(req.params.proposalId))
  if (deleted === 0) throw Error(404)
  res.json({deleted})
}))

router.get('/:id/documents', asyncMW(async (req, res) => {
  res.json(await documents.list(validate.id(req.params.id)))
}))

function encodeFilename (filename) {
  const charset = 'UTF-8'
  const encoding = 'B'
  const encoded = Buffer.from(filename).toString('base64')
  return `"=?${charset}?${encoding}?${encoded}?="`
}

router.get('/:id/documents/:documentId/pdf', asyncMW(async (req, res) => {
  const {documentId} = req.params
  let file = await documents.fileByType(documentId, 'pdf')
  if (!file) throw Error(404)
  const {filename, blob} = file
  res.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment;filename=${encodeFilename(filename)}`,
    'Content-Length': blob.byteLength
  })
  res.end(blob, 'binary')
}))

router.get('/:id/posters', asyncMW(async (req, res) => {
  res.json(await posters.list(validate.id(req.params.id)))
}))

router.get('/:id/photos', asyncMW(async (req, res) => {
  res.json(await photos.list(validate.id(req.params.id)))
}))

const campaignPhotorecsZip = asyncMW(async (req, res) => {
  const urlsAndNames = await photos.archive(validate.id(req.params.id), req.params)
  res.writeHead(200, { 'Content-Type': 'application/zip' })
  try {
    await zipUrls(res, urlsAndNames)
  } finally {
    res.end()
  }
})
router.get('/:id/photorecs/monthly/:year/:filename.zip', campaignPhotorecsZip)
router.get('/:id/photorecs/monthly/:year/:month/:filename.zip', campaignPhotorecsZip)
router.get('/:id/photorecs/monthly/:year/:month/:day/:filename.zip', campaignPhotorecsZip)

router.get('/:id/photorecs.zip', campaignPhotorecsZip)
router.get('/:id/photorecs/:filename.zip', campaignPhotorecsZip)
router.get('/:id/photorecs/:year/:filename.zip', campaignPhotorecsZip)
router.get('/:id/photorecs/:year/:month/:filename.zip', campaignPhotorecsZip)
router.get('/:id/photorecs/:year/:month/:day/:filename.zip', campaignPhotorecsZip)

router.get('/:id/serviceOperations', asyncMW(async (req, res) => {
  res.json(await serviceOperations.list(validate.id(req.params.id)))
}))

router.get('/:id/estimations', asyncMW(async (req, res) => {
  res.json(await estimations.list(validate.id(req.params.id)))
}))

router.get('/:id/published', asyncMW(async (req, res) => {
  res.json(await published.list(validate.id(req.params.id)))
}))

router.post('/:id/published', asyncMW(async (req, res) => {
  const props = req.body
  const campaignId = validate.id(req.params.id)
  const allProps = Object.assign(props, {campaignId})
  const newObj = await published.create(allProps)
  res.status(201)
  res.header('Location', `${req.baseUrl}/${campaignId}/published/${newObj.id}`)
  res.json(newObj)
}))

router.put('/:id/published/:publishedCampaignId', asyncMW(async (req, res) => {
  const props = req.body
  const updated = await published.replace(req.params.publishedCampaignId, props)
  if (updated === 0) throw Error(404)
  res.json({updated})
}))

router.delete('/:id/published/:publishedCampaignId', asyncMW(async (req, res) => {
  const deleted = await published.remove(req.params.publishedCampaignId)
  if (deleted === 0) throw Error(404)
  res.json({deleted})
}))

router.get('/:id/published/:publishedCampaignId/proposals/', asyncMW(async (req, res) => {
  res.json(await publishedProposals.list(req.params.publishedCampaignId))
}))

router.post('/:campaignId/published/:publishedCampaignId/proposals', asyncMW(async (req, res) => {
  const props = req.body
  const allProps = Object.assign(props, req.params)
  const newObj = await publishedProposals.updateOrCreate(allProps)
  res.status(201)
  const {campaignId, publishedCampaignId} = req.params
  res.header('Location', `${req.baseUrl}/${campaignId}/published/${publishedCampaignId}/proposals/${newObj.id}`)
  res.json(newObj)
}))

router.put('/:campaignId/published/:publishedCampaignId/proposals/:proposalId', asyncMW(async (req, res) => {
  const props = req.body
  const allProps = Object.assign(props, req.params)
  const result = await publishedProposals.updateOrCreate(allProps)
  res.status(200)
  res.json(result)
}))

router.delete('/:campaignId/published/:publishedCampaignId/proposals/:proposalId', asyncMW(async (req, res) => {
  const {publishedCampaignId, proposalId} = req.params
  const deleted = await publishedProposals.remove(publishedCampaignId, proposalId)
  if (deleted === 0) throw Error(404)
  res.json({deleted})
}))

router.get('/:id/published/:publishedCampaignId/third-party/', asyncMW(async (req, res) => {
  res.json(await publishedThirdParties.list(req.params.publishedCampaignId))
}))

router.post('/:campaignId/published/:publishedCampaignId/third-party', asyncMW(async (req, res) => {
  const props = req.body
  const allProps = Object.assign(props, req.params)
  const newObj = await publishedThirdParties.create(allProps)
  res.status(201)
  const {campaignId, publishedCampaignId} = req.params
  res.header('Location', `${req.baseUrl}/${campaignId}/published/${publishedCampaignId}/third-party/${newObj.id}`)
  res.json(newObj)
}))

router.put('/:campaignId/published/:publishedCampaignId/third-party/:id', asyncMW(async (req, res) => {
  const props = req.body
  const {id} = req.params
  const result = await publishedThirdParties.update(id, props)
  res.status(200)
  res.json(result)
}))

router.delete('/:campaignId/published/:publishedCampaignId/third-party/:id', asyncMW(async (req, res) => {
  const {publishedCampaignId, id} = req.params
  const deleted = await publishedThirdParties.remove(publishedCampaignId, id)
  if (deleted === 0) throw Error('404: Nothing deleted')
  res.json({deleted})
}))

router.post('/:campaignId/published/:publishedCampaignId/presenterInvitations', asyncMW(async (req, res) => {
  const props = req.body
  const allProps = Object.assign(props, req.params)
  const newObj = await presenterInvitations.create(allProps)
  res.status(201)
  res.json(newObj)
}))

router.post('/:id/bulkAddProposals', upload.none(), asyncMW(async (req, res) => {
  const props = req.body
  const campaignId = validate.id(req.params.id)
  const faces = props.faces
  const doorsNums = props.doorsNums
  const startDate = props.startDate
  const endDate = props.endDate

  const [result] = await sequelize.query(`
      exec sp_web_bulk_add_proposals
      @id_campaign  = :campaignId,
      @faces        = :faces,
      @doors_nums   = :doorsNums
    `, { replacements: {
        campaignId: campaignId,
        faces: faces,
        doorsNums: doorsNums
    }, type: sequelize.QueryTypes.SELECT })

  if (!result) throw Error('bulk add proposals failed')
  res.status(201)
  res.json(result)
}))

router.post('/:id/bulkAddSupplierPrices', upload.none(), asyncMW(async (req, res) => {
  const props = req.body
  const campaignId = validate.id(req.params.id)
  const proposals = props.proposals

  const [result] = await sequelize.query(
    `exec sp_web_bulk_add_supplierprices
    @id_campaign  = :campaignId,
    @supplier_prices    = :proposals
  `, { replacements: {
        campaignId,
        proposals
    }})
  if (!result) throw Error('bulk add supplier prices failed')
  res.status(201)
  res.json(result)
}))

router.post('/:id/bulkAddPois', upload.none(), asyncMW(async (req, res) => {
  const props = req.body
  const campaignId = validate.id(req.params.id)
  const pois = props.pois
  const userId = req.user.id

  const [result] = await sequelize.query(
    SQL`
    exec sp_web_bulk_add_pois
    @id_campaign  = ${campaignId},
    @pois    = ${pois},
    @id_person = ${userId}
  `)
  if (!result) throw Error('bulk add pois failed')
  res.status(201)
  res.json(result)
}))

router.post('/:id/bulkUpdatePois', upload.none(), asyncMW(async (req, res) => {
  const props = req.body
  const campaignId = validate.id(req.params.id)
  const pois = props.pois
  const userId = req.user.id

  const [result] = await sequelize.query(
    SQL`
    exec sp_web_bulk_update_pois
    @id_campaign  = ${campaignId},
    @pois    = ${pois},
    @id_person = ${userId}
  `)
  if (!result) throw Error('bulk update pois failed')
  res.status(200)
  res.json(result)
}))

router.post('/:id/bulkDeletePois', upload.none(), asyncMW(async (req, res) => {
  const props = req.body
  const campaignId = validate.id(req.params.id)
  const pois = props.pois
  const userId = req.user.id

  const [result] = await sequelize.query(
    SQL`
    exec sp_web_bulk_delete_pois
    @id_campaign  = ${campaignId},
    @pois    = ${pois},
    @id_person = ${userId}
  `)
  if (!result) throw Error('bulk delete pois failed')
  res.status(200)
  res.json(result)
}))

router.get('/:id/pois', asyncMW(async (req, res) => {
  res.json(await pois.list(validate.id(req.params.id)))
}))

module.exports = router
