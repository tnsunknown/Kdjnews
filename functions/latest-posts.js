const fetch = require('node-fetch');
const cheerio = require('cheerio');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

exports.handler = async (event) => {
  const limit = parseInt(event.queryStringParameters?.limit) || 5;
  const baseUrl = 'https://news.kdj.lk/';

  try {
    const homeRes = await fetch(baseUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!homeRes.ok) throw new Error('Failed to fetch homepage');

    const $ = cheerio.load(await homeRes.text());
    const cards = $('article.recent-post-card').slice(0, limit);

    const posts = await Promise.all(
      Array.from(cards).map(async (card, i) => {
        const $card = $(card);
        const title = $card.find('h3.post-title').text().trim() || 'No title';
        const imgUrl = $card.find('img').attr('src') || '';

        // Extract link
        let link = '';
        const onclick = $card.attr('onclick') || '';
        const match = onclick.match(/location\.href='([^']+)'/);
        if (match) {
          link = new URL(match[1], baseUrl).href;
        } else {
          const a = $card.find('a');
          if (a.attr('href')) link = new URL(a.attr('href'), baseUrl).href;
        }

        // Scrape full content
        let longScrap = 'Scrap failed';
        try {
          await delay(800 * (i + 1)); // Rate limit
          const postRes = await fetch(link, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          const post$ = cheerio.load(await postRes.text());

          const selectors = ['div.post-content', 'article', 'main', '.content'];
          let content = '';
          for (const sel of selectors) {
            const el = post$(sel);
            if (el.length) {
              content = el.find('p, h2, h3, li').map((_, p) => post$(p).text().trim()).get().join(' ');
              break;
            }
          }
          longScrap = content || 'No content';
        } catch (e) {
          console.error(`Scrap error ${link}:`, e.message);
        }

        return { title, image_url: imgUrl, link, long_scrap: longScrap };
      })
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        status: true,
        creator: "Chathura hansaka",
        posts
      }, null, 2)
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: false,
        creator: "Chathura hansaka",
        error: error.message,
        posts: []
      }, null, 2)
    };
  }
};
