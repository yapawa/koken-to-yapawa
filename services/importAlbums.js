'use strict'

const AWS = require('aws-sdk')
const dynamo = new AWS.DynamoDB.DocumentClient({ convertEmptyValues: true })
const sliceSize = 25
const S3 = new AWS.S3()
const BUCKET = process.env.migrationBucketName
const log = require('lambda-log')
log.options.meta.fct = 'importAlbums'
log.options.meta.env = process.env

module.exports.handler = async (event) => {
  log.info('event', event)

  const params = {
    Key: `${event.domain}/tree.json`,
    Bucket: BUCKET
  }
  const tableName = event.albumTable
  const data = await S3.getObject(params).promise()
  const yapawaTree = JSON.parse(data.Body.toString('utf-8'))
  const root = {
    id: 'root',
    name: 'Albums',
    parentId: '-',
    type: 'collection',
    position: 1,
    slug: 'albums',
    description: '',
    summary: '',
    visibility: 'public',
    status: 'published',
    createdAt: '1995-01-01T00:00:00.000Z',
    publishedAt: '1995-01-01T00:00:00.000Z',
    updatedAt: '1995-01-01T00:00:00.000Z',
    orderBy: 'position',
    orderDirection: 'asc',
    contentCountTotal: 0,
    contentCountPublic: 0
  }
  yapawaTree.unshift(root)

  const slices = Math.ceil(yapawaTree.length / sliceSize)
  log.info('slices', slices)
  const puts = []
  for (let slice = 1; slice <= slices; slice++) {
    const start = (slice - 1) * sliceSize
    const end = start + sliceSize
    log.info('slices', { slice, start, end })
    const items = yapawaTree.slice(start, end)
    const putRequest = items.map(item => {
      item.id = item.id.toString()
      item.parentId = item.parentId.toString()
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
