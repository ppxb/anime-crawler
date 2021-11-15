# 动漫爬虫

## 🚀 **NOTICE**

爬取的网站是[樱花动漫](http://www.yinghuacd.com/)。该网站未做反爬，不过想写一个泛用性高的爬虫实属不易。

主要在于这种类似的动漫网站，都采用了 iframe 对播放器进行包装。就算使用 puppeteer 或 phantomJS 效果也不会好太多。大多数资源都是从各个网站收集来的，各动画甚至使用的播放器都不同。视频源有的使用 m3u8 包裹，但大多数都是经过 php 解析后才能获得真实的视频地址。所以想一劳永逸的爬全站是一个很艰苦的工作。

网站服务器在香港，<code>axios</code> 的timeout可以设大一点。代码写的比较随意。

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

## 🙉 **MORE**

当然你也可以通过爬取全站后再对数据进行筛选。这是目前较好的一种方式。
