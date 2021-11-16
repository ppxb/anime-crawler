# 动漫爬虫

## 🚀 **NOTICE**

爬取的网站是[樱花动漫](http://www.yinghuacd.com/)。

## 🖥️ **HOW TO USE**

```
$ git clone https://github.com/ppxb/anime-crawler.git
$ cd anime-crawler
$ npm i
$ npm run dev
```

需要在根目录添加 <code>.env</code> 文件，以连接到数据库。

```
# .env

# mysql
DATABASE_URL="mysql://root:root@localhost:3306/yourdbname?schema=public"

# sqlite
DATABASE_URL="file:./dev.db"
```

修改 <code>prisma</code> 文件夹下的<code> schema.prisma </code> 。

```
datasource db {
  provider = "mysql" // or sqlite
  url      = env("DATABASE_URL")
}
```
