import json, urllib.request, urllib.parse, time

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

start_idx = content.find('const indianArtistsDatabase = [')
bracket_count = 0
in_arr = False
end_idx = -1
for i in range(start_idx, len(content)):
    if content[i] == '[':
        bracket_count += 1
        in_arr = True
    elif content[i] == ']':
        bracket_count -= 1
        if in_arr and bracket_count == 0:
            end_idx = i + 1
            break

raw_json = content[start_idx + len('const indianArtistsDatabase = '):end_idx].strip()
if raw_json.endswith(';'): raw_json = raw_json[:-1]
artists = json.loads(raw_json)

print(f"Total artists to process: {len(artists)}")

def search_itunes(title, artist):
    clean_title = title.split('(')[0].split('-')[0].strip()
    queries = [
        f"{title} {artist}",
        f"{clean_title} {artist}",
        f"{title}"
    ]
    for q in queries:
        url = f"https://itunes.apple.com/search?term={urllib.parse.quote(q)}&media=music&limit=3"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        try:
            with urllib.request.urlopen(req, timeout=4) as response:
                data = json.loads(response.read().decode('utf-8'))
                results = data.get('results', [])
                if results:
                    return results[0].get('previewUrl')
        except Exception:
            pass
        time.sleep(0.05)
    return None

resolved = 0
total = 0
for a in artists:
    for t in a.get('allTracks', []):
        total += 1
        curr_audio = t.get('audioUrl')
        if curr_audio and curr_audio.startswith('http'):
            resolved += 1
        else:
            found = search_itunes(t.get('title', ''), a.get('name', ''))
            if found:
                t['audioUrl'] = found
                resolved += 1
            else:
                pass

print(f"Total tracks: {total}, Resolved: {resolved}")
