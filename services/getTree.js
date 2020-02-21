'use strict'

const AWS = require('aws-sdk')
const S3 = new AWS.S3()
const BUCKET = process.env.migrationBucketName
const log = require('lambda-log')
log.options.meta.fct = 'getTree'
log.options.meta.env = process.env

const epoch2AwsDate = (epoch) => {
  try {
    const d = new Date(epoch * 1000)
    return d.toISOString()
  } catch (err) {
    console.error(err)
  }
}
const got = require('got')

module.exports.handler = async (event) => {
  log.info('event', event)

  const treeEndpoint = `https://${event.domain}/api.php?/albums/tree`
  const kokenTree = await got(treeEndpoint).json()
  const yapawaTree = flatten(kokenTree)

  const getMetas = []
  for (let i = 0; i < yapawaTree.length; i++) {
    const album = yapawaTree[i]
    getMetas.push(enhanceAlbum(event.domain, album))
  }
  return Promise.all(getMetas).then(yapawaTree => {
    const params = {
      Key: `${event.domain}/tree.json`,
      Bucket: BUCKET,
      Body: JSON.stringify(yapawaTree, null, 2),
      ContentType: 'application/json'
    }
    return S3.putObject(params).promise().then(res => {
      const collections = []
      const albums = []

      yapawaTree.forEach(album => {
        if (album.type === 'collection') {
          collections.push(album.id)
        } else {
          albums.push(album.id)
        }
      })
      return {
        collections,
        albums
      }
    })
  })
}

const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const enhanceAlbum = async (domain, album) => {
  const ms = Math.floor(Math.random() * 20)
  await sleep(ms * 1000)
  const albumEndpoint = `https://${domain}/api.php?/albums/${album.id}`
  return got(albumEndpoint).json()
    .then(albumMeta => {
      album.slug = albumMeta.slug
      album.description = albumMeta.description.replace(/<br\s*[/]?>/gi, '\n')
      album.summary = albumMeta.summary.replace(/<br\s*[/]?>/gi, '\n')
      return album
    })
}

const flatten = (level, parentId = 'root') => {
  let position = 1
  let output = []
  level.forEach(album => {
    let [orderBy, orderDirection] = album.sort.split(' ')
    switch (orderBy) {
      case 'created_on':
        orderBy = 'createdAt'
        break
      case 'captured_on':
        orderBy = 'createdAt'
        break
      case 'published_on':
        orderBy = 'publishedAt'
        break
      case 'modified_on':
        orderBy = 'updatedAt'
        break
      case 'manual':
        orderBy = 'position'
        break
      default:
        break
    }
    orderDirection = orderDirection.toLowerCase()
    const type = album.album_type === 'set' ? 'collection' : 'album'
    const visibility = (album.visibility === 'public') ? 'public' : (album.visibility === 'private') ? 'private' : 'protected'

    const albumData = {
      slug: null,
      description: null,
      summary: null
    }

    const yapawaAlbum = {
      id: album.id,
      name: album.title,
      parentId: parentId,
      type: type,
      position: position,
      slug: albumData.slug,
      description: albumData.description,
      summary: albumData.summary,
      visibility: visibility,
      status: 'published',
      createdAt: epoch2AwsDate(album.created_on),
      publishedAt: epoch2AwsDate(album.published_on),
      updatedAt: epoch2AwsDate(album.modified_on),
      orderBy: orderBy,
      orderDirection: orderDirection,
      contentCountTotal: 0,
      contentCountPublic: 0
    }
    //
    // covers: AWSJSON

    position++
    output.push(yapawaAlbum)
    if (album.children && album.children.length > 0) {
      const children = flatten(album.children, album.id)
      output = output.concat(children)
    }
  })
  return output
}
