'use srtict'

module.exports.epoch2AwsDate = (epoch) => {
  const d = new Date(epoch * 1000)
  return d.toISOString()
}
