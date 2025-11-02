from flask import Flask, request, jsonify
import feedparser

app = Flask(__name__)

@app.route('/parse_rss', methods=['GET'])
def parse_rss():
    rss_url = request.args.get('url')
    if not rss_url:
        return jsonify({'error': 'Missing RSS url'}), 400

    feed = feedparser.parse(rss_url)
    if feed.bozo:
        return jsonify({'error': 'Failed to parse RSS feed.'}), 400

    result = {
        'feed': {
            'title': feed.feed.get('title', ''),
            'link': feed.feed.get('link', ''),
            'description': feed.feed.get('description', ''),
        },
        'entries': [
            {
                'title': entry.get('title', ''),
                'link': entry.get('link', ''),
                'published': entry.get('published', ''),
                'summary': entry.get('summary', ''),
            }
            for entry in feed.entries
        ]
    }
    return jsonify(result)

if __name__ == '__main__':
    app.run(port=5000)