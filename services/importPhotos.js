'use strict'

const AWS = require('aws-sdk')
const dynamo = new AWS.DynamoDB.DocumentClient({ convertEmptyValues: true })
const sliceSize = 25
const S3 = new AWS.S3()
const BUCKET = process.env.migrationBucketName
const log = require('lambda-log')
log.options.meta.fct = 'importPhotos'
log.options.meta.env = process.env

module.exports.handler = async (event) => {
  log.info('event', event)
  const albumId = event.albumId
  const tableName = event.photoTable

  const params = {
    Key: `${event.domain}/images/${albumId}.json`,
    Bucket: BUCKET
  }
  const data = await S3.getObject(params).promise()
  const photosList = JSON.parse(data.Body.toString('utf-8'))

  const slices = Math.ceil(photosList.content.length / sliceSize)
  log.info('slices', slices)
  const puts = []
  for (let slice = 1; slice <= slices; slice++) {
    const start = (slice - 1) * sliceSize
    const end = start + sliceSize
    log.info('slices', { slice, start, end })
    const items = photosList.content.slice(start, end)
    const putRequest = items.map(item => {
      item.id = item.id.toString()
      delete item.source
      delete item.metadata
      return {
        PutRequest: {
          Item: item
        }
      }
    })
    const params = {
      RequestItems: {}
    }
    params.RequestItems[tableName] = putRequest
    puts.push(dynamo.batchWrite(params).promise())
  }
  return Promise.all(puts)
}
