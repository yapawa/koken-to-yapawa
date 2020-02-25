'use strict'

const AWS = require('aws-sdk')
const dynamo = new AWS.DynamoDB.DocumentClient({ convertEmptyValues: true })
const S3 = new AWS.S3()
const BUCKET = process.env.migrationBucketName
const log = require('lambda-log')
log.options.meta.fct = 'setCounters'
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

  let totalCount = 0
  let publicCount = 0
  if (albumDetails.content) {
    totalCount = albumDetails.content.length
    publicCount = albumDetails.content.filter(el => el.visibility === 'public' && el.status === 'published').length
  } else {
    const children = await getChildren(event.albumTable, albumId)
    totalCount = children.length
    publicCount = children.filter(el => el.visibility === 'public' && el.status === 'published').length
  }

  const res = await updateCounters(event.albumTable, albumId, totalCount, publicCount)
  return res
  // const coversData = []
  // for (let i = 0; i < albumDetails.covers.length; i++) {
  //   const coverId = albumDetails.covers[i]
  //   if (albumDetails.content) {
  //     const coverImage = albumDetails.content.filter(c => c.id === coverId)[0]
  //     if (coverImage) {
  //       coversData.push({
  //         id: coverImage.id,
  //         contentType: coverImage.contentType,
  //         file: {
  //           key: coverImage.file.key
  //         },
  //         width: coverImage.width,
  //         height: coverImage.height,
  //         updatedAt: coverImage.updatedAt,
  //         slug: coverImage.slug
  //       })
  //     } else {
  //       const coverImage = await getImageInfo(event.photoTable, coverId)
  //       if (coverImage) {
  //         coversData.push(coverImage)
  //       }
  //     }
  //   } else {
  //     const coverImage = await getImageInfo(event.photoTable, coverId)
  //     if (coverImage) {
  //       coversData.push(coverImage)
  //     }
  //   }
  // }
  //
  // if (coversData.length > 0) {
  //   const params = {
  //     TableName: event.albumTable,
  //     Key: { id: albumId.toString() },
  //     UpdateExpression: 'set #covers = :covers',
  //     ExpressionAttributeNames: { '#covers': 'covers' },
  //     ExpressionAttributeValues: {
  //       ':covers': coversData
  //     }
  //   }
  //   console.log(params)
  //   const update = await dynamo.update(params).promise() // eslint-disable-line no-unused-vars
  //   return null
  // } else {
  //   return null
  // }
}
const getChildren = async (table, id) => {
  const params = {
    TableName: table,
    IndexName: 'gsi-AlbumAlbums',
    ExpressionAttributeValues: {
      ':parentId': id.toString()
    },
    KeyConditionExpression: 'parentId = :parentId',
    Limit: 1000,
    ProjectionExpression: '#i, #p, #v, #s',
    ExpressionAttributeNames: {
      '#i': 'id',
      '#p': 'parentId',
      '#v': 'visibility',
      '#s': 'status'
    }
  }
  const children = await dynamo.query(params).promise()
  return children.Items
}

const updateCounters = async (table, albumId, totalCount, publicCount) => {
  const params = {
    TableName: table,
    Key: {
      id: albumId.toString()
    },
    UpdateExpression: 'set #t = :t, #p = :p',
    ExpressionAttributeNames: {
      '#t': 'contentCountTotal',
      '#p': 'contentCountPublic'
    },
    ExpressionAttributeValues: {
      ':t': totalCount,
      ':p': publicCount
    }
  }
  const res = dynamo.update(params).promise()
  return res
}
