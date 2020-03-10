'use strict'

const AWS = require('aws-sdk')
const S3 = new AWS.S3()
const got = require('got')

const log = require('lambda-log')
log.options.meta.fct = 'importPhotos'
log.options.meta.env = process.env

module.exports.handler = async (event) => {
  const params = {
    Bucket: process.env.migrationBucketName,
    Key: `${event.domain}/images/${event.albumId}.json`
  }
  const albumData = await S3.getObject(params).promise().then(res => {
    return JSON.parse(res.Body.toString())
  })

  const uploads = []
  albumData.content.forEach(photo => {
    const metadata = {
      owner: event.owner,
      filename: photo.name,
      modifiedAt: photo.updatedAt.toString(),
      uploadedAt: new Date().toISOString(),
      uploadBatch: 'kokenExport',
      albumId: photo.albumId,
      photoId: photo.id,
      width: photo.width.toString(),
      height: photo.height.toString()
    }
    const params = {
      Bucket: event.bucket,
      Key: `public/${photo.file.key}`,
      ContentType: photo.contentType,
      Metadata: metadata
    }
    const stream = got.stream(photo.source)
    uploads.push(uploadStream(stream, params))
  })
  return Promise.all(uploads).then(result => {
    console.log(result.length)
  })
}

const uploadStream = async (stream, params) => {
  params.Body = stream
  return S3.upload(params).promise()
}
