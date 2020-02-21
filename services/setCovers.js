'use strict'

const AWS = require('aws-sdk')
const dynamo = new AWS.DynamoDB.DocumentClient({ convertEmptyValues: true })
const S3 = new AWS.S3()
const BUCKET = process.env.migrationBucketName
const log = require('lambda-log')
log.options.meta.fct = 'setCovers'
log.options.meta.env = process.env

module.exports.handler = async (event) => {
  log.info('event', event)
  const albumId = event.albumId
  const params = {
    Key: `${event.domain}/images/${albumId}.json`,
    Bucket: BUCKET
  }
  const albumDetails = await S3.getObject(params).promise().then(data => {
    return JSON.parse(data.Body.toString())
  })

  const coversData = []
  for (let i = 0; i < albumDetails.covers.length; i++) {
    const coverId = albumDetails.covers[i]
    if (albumDetails.content) {
      const coverImage = albumDetails.content.filter(c => c.id === coverId)[0]
      if (coverImage) {
        coversData.push({
          id: coverImage.id,
          contentType: coverImage.contentType,
          file: {
            key: coverImage.file.key
          },
          width: coverImage.width,
          height: coverImage.height,
          updatedAt: coverImage.updatedAt,
          slug: coverImage.slug
        })
      } else {
        const coverImage = await getImageInfo(event.photoTable, coverId)
        if (coverImage) {
          coversData.push(coverImage)
        }
      }
    } else {
      const coverImage = await getImageInfo(event.photoTable, coverId)
      if (coverImage) {
        coversData.push(coverImage)
      }
    }
  }

  if (coversData.length > 0) {
    const params = {
      TableName: event.albumTable,
      Key: { id: albumId.toString() },
      UpdateExpression: 'set #covers = :covers',
      ExpressionAttributeNames: { '#covers': 'covers' },
      ExpressionAttributeValues: {
        ':covers': coversData
      }
    }
    console.log(params)
    const update = await dynamo.update(params).promise() // eslint-disable-line no-unused-vars
    return null
  } else {
    return null
  }
}

const getImageInfo = async (table, id) => {
  const params = {
    TableName: table,
    Key: {
      id: id
    }
  }
  const imageInfo = await dynamo.get(params).promise()
  if (imageInfo.Item) {
    return {
      id: imageInfo.Item.id,
      contentType: imageInfo.Item.contentType,
      file: {
        key: imageInfo.Item.file.key
      },
      width: imageInfo.Item.width,
      height: imageInfo.Item.height,
      updatedAt: imageInfo.Item.updatedAt,
      slug: imageInfo.Item.slug
    }
  }
  return null
}
