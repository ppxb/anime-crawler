const axios = require('axios')
const cheerio = require('cheerio')
const redis = require('redis')
const async = require('async')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const bootstrap = async () => {
  const start = new Date().getTime()
  const baseUrl = 'http://www.yinghuacd.com'
  const entryUrl = 'http://www.yinghuacd.com/japan/'
  const pageList = await getPageList(entryUrl)
  const animeList = await getAnimeList(pageList)
  await parse(animeList, baseUrl)
  await crawl(start)
}

const getPageList = async entryUrl => {
  const pageList = []
  try {
    const { data } = await axios({
      method: 'GET',
      url: entryUrl
    })

    const $ = cheerio.load(data)
    // total page
    const totalPage = $('div.fire.l > div.pages > a').eq(-2).text()
    // use a small number to test
    for (let i = 1; i <= 2; i++) {
      if (i === 1) {
        pageList.push(entryUrl)
        continue
      }
      pageList.push(`${entryUrl}${i}.html`)
    }

    return pageList
  } catch (e) {
    console.error(e)
  }
}

const getAnimeList = async pageList => {
  const animeList = []
  try {
    for (let i = 0; i < pageList.length; i++) {
      const { data } = await axios({
        method: 'GET',
        url: pageList[i]
      })

      const $ = cheerio.load(data)
      $('div.lpic > ul > li').each(async (_, item) => {
        if ($(item).find('font').text() !== '') {
          const animeObj = {
            name: $(item).find('h2 > a').text(),
            url: $(item).find('h2 > a').attr('href')
          }
          const { id } = await prisma.anime.create({
            data: {
              name: animeObj.name,
              location: 'japan'
            }
          })
          animeObj.animeId = id
          animeList.push(animeObj)
        }
      })
    }
    return animeList
  } catch (e) {
    console.error(e)
  }
}

const parse = async (animeList, baseUrl) => {
  console.log('========= all animes have been joined queue list =========')
  const reqList = []
  const qps = 10
  for (let i = 0; i < animeList.length; i++) {
    reqList.push(
      axios({
        method: 'GET',
        url: baseUrl + animeList[i].url
      })
        .then(res => {
          const $ = cheerio.load(res.data)
          const total = $('div.movurl > ul >li').length
          let count = 0
          // set your redis client to connect to the redis server
          const client = redis.createClient('6379', '127.0.0.1', { db: 5 })

          $('div.movurl > ul > li').each(async (_, movie) => {
            const redisObj = {
              name: animeList[i].name,
              title: $(movie).find('a').text(),
              animeId: animeList[i].animeId,
              url: baseUrl + $(movie).find('a').attr('href'),
              complete: false
            }

            client.set(
              `TASK:name:[ ${redisObj.name}] - [ ${redisObj.title} ]`,
              JSON.stringify(redisObj),
              (err, _) => {
                if (err) {
                  console.error(err)
                }
                count = count + 1
                if (count === total) {
                  client.end(true)
                }
              }
            )
          })
        })
        .catch(err => console.error(err))
    )
    // set a qps limit
    if (i % qps === 0)
      await new Promise(resolve => setTimeout(() => resolve(), 1000))
  }
  await Promise.all(reqList)
}

const crawl = async start => {
  const client = redis.createClient('6379', '127.0.0.1', { db: 5 })
  client.keys('TASK:name:*', (err, value) => {
    async.mapLimit(
      value,
      2,
      (key, callback) => {
        client.get(key, async (err, value) => {
          let task = JSON.parse(value)
          if (task.complete === false) {
            axios({
              method: 'GET',
              url: task.url,
              timeout: 10000
            })
              .then(async res => {
                const $ = cheerio.load(res.data)
                const fileUrl = $('#playbox').attr('data-vid')
                await prisma.animeFile.create({
                  data: {
                    name: task.name,
                    title: task.title,
                    animeId: task.animeId,
                    url: fileUrl
                  }
                })
                task.complete = true
                client.set(key, JSON.stringify(task), (err, res) => {
                  callback(null)
                })
              })
              .catch(err => console.error(err))
          } else {
            callback(null)
          }
        })
      },
      (err, res) => {
        console.log(
          `🚀 ALL MISSIONS HAS COMPLISHED.takes:${
            (new Date().getTime() - start) / 1000
          } S`
        )
        redis.end(true)
      }
    )
  })
}

bootstrap()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
