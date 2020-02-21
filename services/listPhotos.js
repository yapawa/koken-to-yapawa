'use strict'

const got = require('got')
const path = require('path')
const AWS = require('aws-sdk')
const S3 = new AWS.S3()
const BUCKET = process.env.migrationBucketName
const log = require('lambda-log')
log.options.meta.fct = 'listImages'
log.options.meta.env = process.env
const REGION = process.env.AWS_REGION
const epoch2AwsDate = (epoch) => {
  const d = new Date(epoch * 1000)
  return d.toISOString()
}

module.exports.handler = async (event) => {
  log.info('event', event)
  const encryptionKey = event.encryptionKey
  const albumId = event.albumId
  const albumEndpoint = `https://${event.domain}/api.php?/albums/${albumId}/content/token:${encryptionKey}`

  const response = await got(albumEndpoint).json()
  let position = 0
  const albumDetails = {
    id: albumId,
    covers: response.album.covers.map(item => item.id.toString()),
    content: response.content.map(item => {
      position++
      const visibility = (item.visibility.raw === 'public') ? 'public' : (item.visibility.raw === 'private') ? 'private' : 'protected'
      const name = item.title ? item.title : item.filename
      return {
        id: item.id.toString(),
        albumId: albumId.toString(),
        position: position,
        file: {
          bucket: event.bucket,
          key: `${albumId}/${item.id.toString()}/${path.basename(item.filename)}`,
          region: REGION
        },
        width: item.width,
        height: item.height,
        size: parseInt(item.filesize),
        name: name,
        slug: item.slug,
        visibility: visibility,
        status: 'published',
        createdAt: epoch2AwsDate(item.uploaded_on.timestamp),
        contentType: item.mime_type,
        description: item.caption,
        capturedAt: epoch2AwsDate(item.captured_on.timestamp),
        publishedAt: epoch2AwsDate(item.published_on.timestamp),
        updatedAt: epoch2AwsDate(item.modified_on.timestamp),
        source: item.original.url
      }
    })
  }

  const params = {
    Key: `${event.domain}/images/${albumId}.json`,
    Bucket: BUCKET,
    Body: JSON.stringify(albumDetails, null, 2),
    ContentType: 'application/json'
  }
  return S3.putObject(params).promise()
    .then(res => {
      return albumDetails.content.map(photo => {
        return {
          id: photo.id,
          albumId: photo.albumId,
          key: photo.file.key,
          contentType: photo.contentType,
          source: photo.source
        }
      })
    })
}
