# Scrapy settings for flex_crawler project
BOT_NAME = "flex_crawler"

SPIDER_MODULES = ["flex_crawler.spiders"]
NEWSPIDER_MODULE = "flex_crawler.spiders"


# Crawl responsibly by identifying yourself (and your website) on the user-agent
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"

# Obey robots.txt rules
ROBOTSTXT_OBEY = True

ITEM_PIPELINES = {
    'flex_crawler.pipelines.KafkaPipeline': 200,
    'flex_crawler.pipelines.MergeAndSavePipeline': 300
}

# Set settings whose default value is deprecated to a future-proof value
TWISTED_REACTOR = "twisted.internet.asyncioreactor.AsyncioSelectorReactor"
FEED_EXPORT_ENCODING = "utf-8"
AUTOTHROTTLE_ENABLED = True
