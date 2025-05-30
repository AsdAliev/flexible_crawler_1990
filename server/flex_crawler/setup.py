from setuptools import setup, find_packages

setup(
    name='flex_crawler',
    version='1.0.0',
    packages=find_packages(),
    entry_points={'scrapy': ['settings = flex_crawler.settings']},
)
