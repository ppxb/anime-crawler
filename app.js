const axios = require('axios')
const cheerio = require('cheerio')
const redis = require('redis')
const async = require('async')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const seasonEnum = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10
}

const parse = async animeList => {
  const client = redis.createClient('6379', '127.0.0.1', { db: 5 })
  const reqList = []
  const qps = 10
  for (let i = 0; i < animeList.length; i++) {
    reqList.push(
      axios({
        method: 'GET',
        url: animeList[i].origin || animeList[i]
      })
        .then(async ({ data }) => {
          const $ = cheerio.load(data)
          const baseUrl = animeList[i].origin
            ? animeList[i].origin.split('/show')[0]
            : animeList[i].split('/show')[0]
          const animeName = $('div.rate.r > h1').text()
          const hasSeason = $('div.rate.r > h1')
            .text()
            .match(/第(\S*)季/)
          let animeSeasonNum = 1
          if (hasSeason) {
            animeSeasonNum =
              seasonEnum[
                $('div.rate.r > h1')
                  .text()
                  .match(/第(\S*)季/)[1]
              ]
          }
          const animePlayList = $('div.movurl > ul >li')
          const animePublished = $('div.sinfo > span').eq(0).find('a').text()
          const animeAlias =
            $('div.sinfo > p:nth-child(1)').text().split(':')[1] || ''
          let id = animeList.id || ''

          const hasExisted = await prisma.anime.findUnique({
            where: { name: animeName }
          })

          if (!hasExisted) {
            const dbObj = await prisma.anime.create({
              data: {
                name: animeName,
                alias: animeAlias,
                publishedAt: animePublished,
                origin: animeList[i]
              }
            })
            id = dbObj.id
          }

          animePlayList.each(async (_, item) => {
            const redisObj = {
              animeName,
              title: $(item).find('a').text(),
              animeId: id,
              seasonNum: animeSeasonNum,
              url: baseUrl + $(item).find('a').attr('href'),
              complete: false
            }

            client.setnx(
              `TASK:anime:[ ${redisObj.animeName}] - [ ${redisObj.title} ]`,
              JSON.stringify(redisObj)
            )
          })
        })
        .catch(err => console.error(err))
    )
    if (i % qps === 0)
      await new Promise(resolve => setTimeout(() => resolve(), 1000))
  }
  Promise.all(reqList).then(res => {
    client.keys('TASK:anime:*', (err, value) => {
      getFromRedis(value, client)
    })
  })
}

const getFromRedis = async (value, client) => {
  async.mapLimit(
    value,
    2,
    (key, callback) => {
      client.get(key, async (err, value) => {
        const task = JSON.parse(value)
        if (task.complete === false) {
          try {
            const { data } = await axios({
              method: 'GET',
              url: task.url,
              timeout: 10000
            })

            const $ = cheerio.load(data)
            let src = $('#playbox').attr('data-vid')
            if (src.indexOf('$mp4') > -1) {
              src = src.split('$mp4')[0]
              await prisma.episode.create({
                data: {
                  animeName: task.animeName,
                  title: task.title,
                  animeId: task.animeId,
                  seasonNum: task.seasonNum,
                  src
                }
              })
            }
            task.complete = true
            client.set(key, JSON.stringify(task), (err, res) => {
              callback(null)
            })
          } catch (err) {}
        } else {
          callback(null)
        }
      })
    },
    (err, res) => {
      client.end(true)
    }
  )
}

parse([
  'http://www.yinghuacd.com/show/4426.html',
  'http://www.yinghuacd.com/show/4860.html',
  'http://www.yinghuacd.com/show/738.html'
])
