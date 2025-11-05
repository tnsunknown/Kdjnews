const fetch = require('node-fetch');
const cheerio = require('cheerio');

exports.handler = async (event, context) => {
  const limit = parseInt(event.queryStringParameters?.limit) || 5;
  const baseUrl = 'https://news.kdj.lk/';

  try {
    // Fetch homepage
    const response = await fetch(baseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch homepage: ${response.status}`);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    const posts = [];

    // Extract post cards
    $('article.recent-post-card').slice(0, limit).each(async (i, card) => {
      const title = $(card).find('h3.post-title').text().trim() || `No title ${i}`;
      const imgUrl = $(card).find('img').attr('src') || '';

      // Extract link from onclick
      const onclick = $(card).attr('onclick') || '';
      let link = '';
      const match = onclick.match(/location\.href='([^']+)'/);
      if (match) {
        link = new URL(match[1], baseUrl).href;
      } else {
        const aTag = $(card).find('a');
        if (aTag.attr('href')) {
          link = new URL(aTag.attr('href'), baseUrl).href;
        }
      }

      if (!link) {
        link = 'No valid link';
      }

      // Scrape full content (with delay)
      let longScrap = 'Scrap failed';
      try {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Rate limit
        const postResponse = await fetch(link, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        const postHtml = await postResponse.text();
        const post$ = cheerio.load(postHtml);

        // Extract content
        const contentSelectors = ['div.post-content', 'article', 'main', '.content', '.entry-content'];
        let contentText = '';
        for (const sel of contentSelectors) {
          const div = post$(sel);
          if (div.length) {
            contentText = div.find('p, h2, h3, h4, li').map((j, el) => post$(el).text().trim()).get().join(' ');
            break;
          }
        }
        longScrap = contentText || 'No content extracted';
      } catch (e) {
        console.error(`Failed to scrape ${link}: ${e.message}`);
      }

      posts.push({
        title,
        image_url: imgUrl,
        link,
        long_scrap: longScrap
      });
    });

    // Return JSON
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        status: true,
        creator: "Chathura hansaka",
        posts: posts
      }, null, 2)
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        status: false,
        creator: "Chathura hansaka",
        error: error.message,
        posts: []
      }, null, 2)
    };
  }
};
