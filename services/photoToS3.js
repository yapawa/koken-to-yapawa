'use strict'

const AWS = require('aws-sdk')
const S3 = new AWS.S3()
const got = require('got')

const log = require('lambda-log')
log.options.meta.fct = 'importPhotos'
log.options.meta.env = process.env

module.exports.handler = async (event) => {
  const params = {
    Bucket: event.bucket,
    Key: `public/${event.photo.key}`,
    ContentType: event.photo.contentType
  }

  const stream = got.stream(event.photo.source)
  const result = await uploadStream(stream, params) // eslint-disable-line no-unused-vars
  return params.Key
}

const uploadStream = async (stream, params) => {
  params.Body = stream
  return S3.upload(params).promise()
}
