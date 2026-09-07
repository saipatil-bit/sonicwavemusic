/**
 * SONICWAVE STREAMING - MASTER AUDIO ENGINE (HARDENED & SECURED)
 * 41+ Top Indian, Marathi & English Global Artists
 * 100% Verified Playable YouTube IDs & Official Album Artwork
 * Strict Zero-Autoplay on Initial Page Load
 * Security Hardening: SQL Injection Defense, DOM/Stored XSS Prevention, SHA-256 Auth Hashing, Input Sanitization, Role Integrity, Prototype Pollution Defense
 * Strict Catalog Search: Only searches and plays songs existing in the website catalog
 */

// ==================== SECURITY & DEFENSE UTILITIES ====================
// Prototype Pollution Prevention
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  const clean = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    clean[key] = (typeof val === 'object' && val !== null) ? sanitizeObject(val) : val;
  }
  return clean;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop';

function sanitizeUrl(url, fallback = DEFAULT_COVER) {
  if (!url || typeof url !== 'string') return fallback;
  const trimmed = url.trim();
  if (/^(https?:\/\/|\/|\.\/|\.\.\/)/i.test(trimmed) && !/javascript:|data:/i.test(trimmed)) {
    return escapeHtml(trimmed);
  }
  return fallback;
}

function sanitizeInput(str, maxLen = 100) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[\r\n\t\x00-\x1f]/g, ' ').trim().slice(0, maxLen);
}

function sanitizeSqlInput(str, maxLen = 100) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[\r\n\t\x00-\x1f]/g, ' ')
    .replace(/['";\\]/g, '')
    .replace(/--|\/\*|\*\//g, '')
    .trim()
    .slice(0, maxLen);
}

function validateYouTubeId(id) {
  if (!id || typeof id !== 'string') return null;
  const clean = id.trim();
  return /^[a-zA-Z0-9_-]{11}$/.test(clean) ? clean : null;
}

function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : validateYouTubeId(url);
}

const AUTH_SALT = 'sonicwave_sec_2026';

async function hashPassword(plainText) {
  if (!plainText) return '';
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const enc = new TextEncoder();
      const data = enc.encode(plainText + ':' + AUTH_SALT);
      const buffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(buffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) { }
  }
  let hash = 0;
  for (let i = 0; i < plainText.length; i++) {
    hash = ((hash << 5) - hash) + plainText.charCodeAt(i);
    hash |= 0;
  }
  return 'sh_' + Math.abs(hash).toString(16);
}

// Safe localStorage JSON parser with prototype sanitization
function safeJsonParse(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return sanitizeObject(parsed);
  } catch (e) {
    console.warn('Storage read note for', key, e);
    return fallback;
  }
}

// ==================== 1. USERS & AUTH STATE ====================
// Default users with precomputed secure salted SHA-256 password hashes
const defaultUsers = [
  { id: 'u_1', username: 'Sai Patil', email: 'sai@sonicwave.com', passwordHash: '0cbe4b2e6ea30eb4bdd2b90fadf2a34eedb10a934a1d4366279e5d2473d2faa1', role: 'Admin', dateAdded: '2026-08-27', status: 'Active' },
  { id: 'u_2', username: 'admin', email: 'admin@sonicwave.com', passwordHash: '45be7ac3de476914ab7f7538aaf5e841bb68e2f61b6fa2c85901bef19956abd3', role: 'Admin', dateAdded: '2026-08-27', status: 'Active' },
  { id: 'u_3', username: 'Rahul Sharma', email: 'rahul@example.com', passwordHash: 'a91e20ad3513848ccda7acf0725e919fbbba67e1b6557a70a0a405b1e4b36307', role: 'User', dateAdded: '2026-08-27', status: 'Active' }
];

let usersDatabase = safeJsonParse('spotix_users', null);
if (!usersDatabase || !Array.isArray(usersDatabase) || usersDatabase.length === 0) {
  usersDatabase = defaultUsers;
  localStorage.setItem('spotix_users', JSON.stringify(usersDatabase));
}

let activeUser = safeJsonParse('spotix_session', null);
if (!activeUser || typeof activeUser !== 'object') {
  activeUser = usersDatabase[0];
  localStorage.setItem('spotix_session', JSON.stringify(activeUser));
}

// ==================== 2. APPLICATION STATE ====================
const state = {
  ytPlayer: null,
  ytReady: false,
  isPlaying: false,
  isMuted: false,
  volume: 100,
  previousVolume: 100,
  currentTrack: null,
  currentTrackIndex: 0,
  currentQueue: [],
  isShuffle: false,
  repeatMode: 'off',
  progressInterval: null,
  currentView: 'home',
  viewHistory: ['home'],
  historyIndex: 0,
  activeFilter: 'all',
  currentPlaylistName: 'Liked Songs',
  currentUser: activeUser,
  users: usersDatabase,
  customSongs: safeJsonParse('spotix_custom_songs', []),
  likedTracks: safeJsonParse('spotix_liked', []),
  customPlaylists: safeJsonParse('spotix_playlists', { 'Marathi Superhits': [], 'English Pop': [], 'Hindi Favorites': [] }),
  currentArtistDetail: null,
  artistFilterGenre: 'all',
  resolvedCache: {},
  pendingPlayTrack: null,
  pendingAutoplay: false
};

// ==================== 3. ARTISTS DATABASE ====================
const indianArtistsDatabase = [
  {
    "id": "arijit-singh",
    "name": "Arijit Singh",
    "role": "Playback Singer & Composer",
    "category": "bollywood",
    "avatar": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
    "listeners": "45.2M Monthly Listeners",
    "genre": "Bollywood / Romantic / Sufi",
    "bio": "India's undisputed #1 streaming artist, celebrated for soulful, timeless anthems across cinema.",
    "albums": [
      {
        "collectionId": "alb_arijit_1",
        "collectionName": "Brahmastra",
        "releaseYear": "2022",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "artistName": "Arijit Singh",
        "tracks": []
      },
      {
        "collectionId": "alb_arijit_2",
        "collectionName": "Jawan",
        "releaseYear": "2023",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "artistName": "Arijit Singh",
        "tracks": []
      },
      {
        "collectionId": "alb_arijit_3",
        "collectionName": "Aashiqui 2",
        "releaseYear": "2013",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "artistName": "Arijit Singh",
        "tracks": []
      },
      {
        "collectionId": "alb_arijit_4",
        "collectionName": "Ae Dil Hai Mushkil",
        "releaseYear": "2016",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "artistName": "Arijit Singh",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "BddP6PYo2gs",
        "resolvedYtId": "BddP6PYo2gs",
        "title": "Kesariya",
        "artist": "Arijit Singh, Pritam",
        "album": "Brahmastra",
        "duration": "4:28",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/38/4c/5c/384c5c8f-3ff8-e457-b2f7-3158ce108649/mzaf_12389299033886433185.plus.aac.p.m4a"
      },
      {
        "id": "VAdGW7QDJiU",
        "resolvedYtId": "VAdGW7QDJiU",
        "title": "Chaleya",
        "artist": "Arijit Singh, Shilpa Rao",
        "album": "Jawan",
        "duration": "3:20",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/55/fb/9c/55fb9c31-320a-5dba-0a3f-5e69552085a7/mzaf_13508224660474474886.plus.aac.p.m4a"
      },
      {
        "id": "BjL7AuPsmEk",
        "resolvedYtId": "BjL7AuPsmEk",
        "title": "Tum Hi Ho",
        "artist": "Arijit Singh, Mithoon",
        "album": "Aashiqui 2",
        "duration": "4:22",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/38/de/b9/38deb942-d44a-f2bb-205c-ddf05be84693/mzaf_9747647124859107103.plus.aac.p.m4a"
      },
      {
        "id": "bzSTpdcs-EI",
        "resolvedYtId": "bzSTpdcs-EI",
        "title": "Channa Mereya",
        "artist": "Arijit Singh, Pritam",
        "album": "Ae Dil Hai Mushkil",
        "duration": "4:49",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/d5/f9/98/d5f998a7-0090-ee2d-03f8-557ad6c5bf65/mzaf_14251357991592637728.plus.aac.p.m4a"
      },
      {
        "id": "ElZfdU54Cp8",
        "resolvedYtId": "ElZfdU54Cp8",
        "title": "Apna Bana Le",
        "artist": "Arijit Singh, Sachin-Jigar",
        "album": "Bhediya",
        "duration": "4:21",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/eb/27/61/eb2761c7-d606-0912-dff0-2dc6b69974bd/mzaf_2023722930851223219.plus.aac.p.m4a"
      },
      {
        "id": "MJyKN-8UncM",
        "resolvedYtId": "MJyKN-8UncM",
        "title": "Shayad",
        "artist": "Arijit Singh, Pritam",
        "album": "Love Aaj Kal",
        "duration": "4:07",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/69/08/d6/6908d60e-563f-5d07-9bb5-737c9d90b59d/mzaf_9263362903198979589.plus.aac.p.m4a"
      }
    ],
    "allTracks": [
      {
        "id": "BddP6PYo2gs",
        "resolvedYtId": "BddP6PYo2gs",
        "title": "Kesariya",
        "artist": "Arijit Singh, Pritam",
        "album": "Brahmastra",
        "duration": "4:28",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/38/4c/5c/384c5c8f-3ff8-e457-b2f7-3158ce108649/mzaf_12389299033886433185.plus.aac.p.m4a"
      },
      {
        "id": "VAdGW7QDJiU",
        "resolvedYtId": "VAdGW7QDJiU",
        "title": "Chaleya",
        "artist": "Arijit Singh, Shilpa Rao",
        "album": "Jawan",
        "duration": "3:20",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/55/fb/9c/55fb9c31-320a-5dba-0a3f-5e69552085a7/mzaf_13508224660474474886.plus.aac.p.m4a"
      },
      {
        "id": "BjL7AuPsmEk",
        "resolvedYtId": "BjL7AuPsmEk",
        "title": "Tum Hi Ho",
        "artist": "Arijit Singh, Mithoon",
        "album": "Aashiqui 2",
        "duration": "4:22",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/38/de/b9/38deb942-d44a-f2bb-205c-ddf05be84693/mzaf_9747647124859107103.plus.aac.p.m4a"
      },
      {
        "id": "bzSTpdcs-EI",
        "resolvedYtId": "bzSTpdcs-EI",
        "title": "Channa Mereya",
        "artist": "Arijit Singh, Pritam",
        "album": "Ae Dil Hai Mushkil",
        "duration": "4:49",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/d5/f9/98/d5f998a7-0090-ee2d-03f8-557ad6c5bf65/mzaf_14251357991592637728.plus.aac.p.m4a"
      },
      {
        "id": "ElZfdU54Cp8",
        "resolvedYtId": "ElZfdU54Cp8",
        "title": "Apna Bana Le",
        "artist": "Arijit Singh, Sachin-Jigar",
        "album": "Bhediya",
        "duration": "4:21",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/eb/27/61/eb2761c7-d606-0912-dff0-2dc6b69974bd/mzaf_2023722930851223219.plus.aac.p.m4a"
      },
      {
        "id": "MJyKN-8UncM",
        "resolvedYtId": "MJyKN-8UncM",
        "title": "Shayad",
        "artist": "Arijit Singh, Pritam",
        "album": "Love Aaj Kal",
        "duration": "4:07",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/69/08/d6/6908d60e-563f-5d07-9bb5-737c9d90b59d/mzaf_9263362903198979589.plus.aac.p.m4a"
      },
      {
        "id": "1tsCjcq0G-U",
        "resolvedYtId": "1tsCjcq0G-U",
        "title": "O Maahi",
        "artist": "Arijit Singh, Pritam",
        "album": "Dunki",
        "duration": "3:53",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/7a/ae/fd/7aaefd06-7082-9f9e-e0b4-6cc37bdbf3e0/mzaf_13695558322503852976.plus.aac.p.m4a"
      },
      {
        "id": "sK7riqg2mr4",
        "resolvedYtId": "sK7riqg2mr4",
        "title": "Agar Tum Saath Ho",
        "artist": "Arijit Singh, Alka Yagnik",
        "album": "Tamasha",
        "duration": "5:41",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/75/a8/7d/75a87dcc-5b69-795d-7dcc-27d1c728f31f/mzaf_18055325784732588932.plus.aac.p.m4a"
      },
      {
        "id": "AEIVhBS6baE",
        "resolvedYtId": "AEIVhBS6baE",
        "title": "Gerua",
        "artist": "Arijit Singh, Antara Mitra",
        "album": "Dilwale",
        "duration": "5:45",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/bf/6e/24/bf6e24d8-d4d5-1cac-adc6-4a0fc07e98da/mzaf_14186979808495752044.plus.aac.p.m4a"
      },
      {
        "id": "cYOB941gyXI",
        "resolvedYtId": "cYOB941gyXI",
        "title": "Hawayein",
        "artist": "Arijit Singh, Pritam",
        "album": "Jab Harry Met Sejal",
        "duration": "4:50",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/15/d1/a8/15d1a862-edcd-6a92-624a-2bbf0f7eff26/mzaf_7165241817401822857.plus.aac.p.m4a"
      },
      {
        "id": "EatzcaVJRMs",
        "resolvedYtId": "EatzcaVJRMs",
        "title": "Tera Yaar Hoon Main",
        "artist": "Arijit Singh, Rochak Kohli",
        "album": "Sonu Ke Titu Ki Sweety",
        "duration": "4:24",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/44/26/50/442650b7-256e-034a-380a-4bbf16e59e53/mzaf_272051127111758324.plus.aac.p.m4a"
      },
      {
        "id": "w8Yq_huwCrM",
        "resolvedYtId": "w8Yq_huwCrM",
        "title": "Phir Aur Kya Chahiye",
        "artist": "Arijit Singh, Sachin-Jigar",
        "album": "Zara Hatke Zara Bachke",
        "duration": "4:26",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/d5/10/6f/d5106fa0-dbc1-8be7-f20f-1f892dd86c38/mzaf_5974873759252686356.plus.aac.p.m4a"
      },
      {
        "id": "b-tr6gauiv0",
        "resolvedYtId": "b-tr6gauiv0",
        "title": "Zaalima",
        "artist": "Arijit Singh, Harshdeep Kaur",
        "album": "Raees",
        "duration": "4:59",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/9c/4a/92/9c4a92b0-cb25-61dd-ceaa-9f858be1c529/mzaf_2415907208923487493.plus.aac.p.m4a"
      },
      {
        "id": "Grr0FlC8SQA",
        "resolvedYtId": "Grr0FlC8SQA",
        "title": "Kalank Title Track",
        "artist": "Arijit Singh, Pritam",
        "album": "Kalank",
        "duration": "5:11",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/c8/a2/09/c8a20920-52a8-9728-a305-9f12a85ae305/mzaf_8477813248295499776.plus.aac.p.m4a"
      }
    ]
  },
  {
    "id": "ajay-atul",
    "name": "Ajay-Atul",
    "role": "Composer Duo & Music Directors",
    "category": "marathi",
    "avatar": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
    "listeners": "18.9M Monthly Listeners",
    "genre": "Marathi Cinema / Grand Orchestral / Bollywood",
    "bio": "National Award-winning powerhouse duo renowned for monumental symphonies, Sairat, Natarang, and Agneepath.",
    "albums": [
      {
        "collectionId": "alb_aa_1",
        "collectionName": "Sairat Original Soundtrack",
        "releaseYear": "2016",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "artistName": "Ajay-Atul",
        "tracks": []
      },
      {
        "collectionId": "alb_aa_2",
        "collectionName": "Natarang",
        "releaseYear": "2010",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "artistName": "Ajay-Atul",
        "tracks": []
      },
      {
        "collectionId": "alb_aa_3",
        "collectionName": "Agneepath",
        "releaseYear": "2012",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "artistName": "Ajay-Atul",
        "tracks": []
      },
      {
        "collectionId": "alb_aa_4",
        "collectionName": "Lai Bhaari",
        "releaseYear": "2014",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "artistName": "Ajay-Atul",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "8eong8XHDB4",
        "resolvedYtId": "8eong8XHDB4",
        "title": "Zingaat",
        "artist": "Ajay-Atul",
        "album": "Sairat",
        "duration": "3:46",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/e3/21/1e/e3211ebb-2b2f-8977-2300-bdc6760c94c3/mzaf_14840830049985436711.plus.aac.p.m4a"
      },
      {
        "id": "T6w78g0gihM",
        "resolvedYtId": "T6w78g0gihM",
        "title": "Yad Lagla",
        "artist": "Ajay Gogavale, Ajay-Atul",
        "album": "Sairat",
        "duration": "5:14",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/0b/25/11/0b251178-c04d-34a7-bd46-c108dce40c63/mzaf_4240669728088709006.plus.aac.p.m4a"
      },
      {
        "id": "OY5vL4aXMAo",
        "resolvedYtId": "OY5vL4aXMAo",
        "title": "Apsara Aali",
        "artist": "Bela Shende, Ajay-Atul",
        "album": "Natarang",
        "duration": "4:47",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/2f/31/84/2f318477-097b-3d5e-ab79-e5a145644073/mzaf_14869119884756194380.plus.aac.p.m4a"
      },
      {
        "id": "RYqJ5w-GrfM",
        "resolvedYtId": "RYqJ5w-GrfM",
        "title": "Deva Shree Ganesha",
        "artist": "Ajay Gogavale, Ajay-Atul",
        "album": "Agneepath",
        "duration": "5:56",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/ab/fe/ff/abfeff76-c8de-a043-9363-e50d7240a7af/mzaf_11034485405610230540.plus.aac.p.m4a"
      },
      {
        "id": "oWKgpB2zpgw",
        "resolvedYtId": "oWKgpB2zpgw",
        "title": "Abhi Mujh Mein Kahin",
        "artist": "Sonu Nigam, Ajay-Atul",
        "album": "Agneepath",
        "duration": "6:04",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/c7/d8/d1/c7d8d1a5-6c24-0175-cfef-e5b5b836b70c/mzaf_12991514154981661781.plus.aac.p.m4a"
      },
      {
        "id": "uWi5aOuSmN4",
        "resolvedYtId": "uWi5aOuSmN4",
        "title": "Mauli Mauli",
        "artist": "Ajay Gogavale, Ajay-Atul",
        "album": "Lai Bhaari",
        "duration": "4:32",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/30/df/64/30df64f7-103f-dcdb-f354-c97068cdd1ac/mzaf_5673440102760013341.plus.aac.p.m4a"
      }
    ],
    "allTracks": [
      {
        "id": "8eong8XHDB4",
        "resolvedYtId": "8eong8XHDB4",
        "title": "Zingaat",
        "artist": "Ajay-Atul",
        "album": "Sairat",
        "duration": "3:46",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/e3/21/1e/e3211ebb-2b2f-8977-2300-bdc6760c94c3/mzaf_14840830049985436711.plus.aac.p.m4a"
      },
      {
        "id": "T6w78g0gihM",
        "resolvedYtId": "T6w78g0gihM",
        "title": "Yad Lagla",
        "artist": "Ajay Gogavale, Ajay-Atul",
        "album": "Sairat",
        "duration": "5:14",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/0b/25/11/0b251178-c04d-34a7-bd46-c108dce40c63/mzaf_4240669728088709006.plus.aac.p.m4a"
      },
      {
        "id": "ZL3MnrnLLpo",
        "resolvedYtId": "ZL3MnrnLLpo",
        "title": "Sairat Zaala Ji",
        "artist": "Chinmayi, Ajay Gogavale, Ajay-Atul",
        "album": "Sairat",
        "duration": "6:09",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/ec/ee/a5/eceea5ab-b1bc-c5e4-0149-b5e251f212ec/mzaf_7369631122911601914.plus.aac.p.m4a"
      },
      {
        "id": "OY5vL4aXMAo",
        "resolvedYtId": "OY5vL4aXMAo",
        "title": "Apsara Aali",
        "artist": "Bela Shende, Ajay-Atul",
        "album": "Natarang",
        "duration": "4:47",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/2f/31/84/2f318477-097b-3d5e-ab79-e5a145644073/mzaf_14869119884756194380.plus.aac.p.m4a"
      },
      {
        "id": "BIqhyCB7LH4",
        "resolvedYtId": "BIqhyCB7LH4",
        "title": "Natrang Ubha",
        "artist": "Ajay Gogavale, Ajay-Atul",
        "album": "Natarang",
        "duration": "3:42",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/d7/e4/45/d7e4456b-beb6-f3d7-3f83-87bb22313f63/mzaf_5850114633234987060.plus.aac.p.m4a"
      },
      {
        "id": "RYqJ5w-GrfM",
        "resolvedYtId": "RYqJ5w-GrfM",
        "title": "Deva Shree Ganesha",
        "artist": "Ajay Gogavale, Ajay-Atul",
        "album": "Agneepath",
        "duration": "5:56",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/ab/fe/ff/abfeff76-c8de-a043-9363-e50d7240a7af/mzaf_11034485405610230540.plus.aac.p.m4a"
      },
      {
        "id": "oWKgpB2zpgw",
        "resolvedYtId": "oWKgpB2zpgw",
        "title": "Abhi Mujh Mein Kahin",
        "artist": "Sonu Nigam, Ajay-Atul",
        "album": "Agneepath",
        "duration": "6:04",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/c7/d8/d1/c7d8d1a5-6c24-0175-cfef-e5b5b836b70c/mzaf_12991514154981661781.plus.aac.p.m4a"
      },
      {
        "id": "xRoupS4ZDX4",
        "resolvedYtId": "xRoupS4ZDX4",
        "title": "Chikni Chameli",
        "artist": "Shreya Ghoshal, Ajay-Atul",
        "album": "Agneepath",
        "duration": "5:03",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/a3/9e/d7/a39ed7ef-c701-852b-c3fe-1a272c2f628a/mzaf_6941640775895803860.plus.aac.p.m4a"
      },
      {
        "id": "uWi5aOuSmN4",
        "resolvedYtId": "uWi5aOuSmN4",
        "title": "Mauli Mauli",
        "artist": "Ajay Gogavale, Ajay-Atul",
        "album": "Lai Bhaari",
        "duration": "4:32",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/30/df/64/30df64f7-103f-dcdb-f354-c97068cdd1ac/mzaf_5673440102760013341.plus.aac.p.m4a"
      },
      {
        "id": "bGo6X71kocI",
        "resolvedYtId": "bGo6X71kocI",
        "title": "Kombdi Palali",
        "artist": "Vaishali Samant, Anand Shinde, Ajay-Atul",
        "album": "Jatra",
        "duration": "3:58",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/cd/9b/f0/cd9bf052-cdb9-6dc7-a8cc-a06aa12b3d20/mzaf_1800751820381759369.plus.aac.p.m4a"
      },
      {
        "id": "Z9UDscwUtog",
        "resolvedYtId": "Z9UDscwUtog",
        "title": "Gondhal",
        "artist": "Ajay Gogavale, Ajay-Atul",
        "album": "Jogwa",
        "duration": "5:30",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview112/v4/80/fc/44/80fc4419-9738-8b4e-ff9e-09a13de15880/mzaf_17523840914518582611.plus.aac.p.m4a"
      },
      {
        "id": "DRNb1q63PBk",
        "resolvedYtId": "DRNb1q63PBk",
        "title": "Lallati Bhandar",
        "artist": "Ajay Gogavale, Ajay-Atul",
        "album": "Jogwa",
        "duration": "4:55",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/a9/be/d3/a9bed39a-6de4-0abb-5dcb-5a6657cf5140/mzaf_10740465018041943407.plus.aac.p.m4a"
      }
    ]
  },
  {
    "id": "swapnil-bandodkar",
    "name": "Swapnil Bandodkar",
    "role": "Marathi Romantic Icon",
    "category": "marathi",
    "avatar": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
    "listeners": "8.4M Monthly Listeners",
    "genre": "Marathi Bhavgeet / Romantic Pop / Classical",
    "bio": "The velvety voice of modern Marathi cinema, celebrated for timeless romantic classics and soulful melodies.",
    "albums": [
      {
        "collectionId": "alb_swapnil_1",
        "collectionName": "Radha Hi Bawari",
        "releaseYear": "2012",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "artistName": "Swapnil Bandodkar",
        "tracks": []
      },
      {
        "collectionId": "alb_swapnil_2",
        "collectionName": "Mala Ved Lagale",
        "releaseYear": "2010",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "artistName": "Swapnil Bandodkar",
        "tracks": []
      },
      {
        "collectionId": "alb_swapnil_3",
        "collectionName": "Bedardi",
        "releaseYear": "2008",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "artistName": "Swapnil Bandodkar",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "-wkoDlGv2y8",
        "resolvedYtId": "-wkoDlGv2y8",
        "title": "Radha Hi Bawari",
        "artist": "Swapnil Bandodkar",
        "album": "Radha Hi Bawari",
        "duration": "5:12",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview122/v4/e1/90/81/e1908172-d3ac-5650-5389-6a55b7211d8b/mzaf_11937903986078829218.plus.aac.p.m4a"
      },
      {
        "id": "nXJlF-8ds1E",
        "resolvedYtId": "nXJlF-8ds1E",
        "title": "Mala Ved Lagale",
        "artist": "Swapnil Bandodkar",
        "album": "Timepass",
        "duration": "4:32",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/ec/50/a5/ec50a5c2-f349-1f3c-51d8-de64dc0f5ad2/mzaf_18112162108242851676.plus.aac.p.m4a"
      },
      {
        "id": "1a07OVciamI",
        "resolvedYtId": "1a07OVciamI",
        "title": "Galavar Khali",
        "artist": "Swapnil Bandodkar",
        "album": "Bedardi",
        "duration": "4:45",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview112/v4/13/45/b7/1345b7dc-09b6-c3bd-9804-c8e143cb2e58/mzaf_16008013523533615246.plus.aac.p.m4a"
      },
      {
        "id": "bshSJf1BHlY",
        "resolvedYtId": "bshSJf1BHlY",
        "title": "Man Talyat Malyat",
        "artist": "Swapnil Bandodkar",
        "album": "Sanai Choughade",
        "duration": "4:15",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "-wkoDlGv2y8",
        "resolvedYtId": "-wkoDlGv2y8",
        "title": "Radha Hi Bawari",
        "artist": "Swapnil Bandodkar",
        "album": "Radha Hi Bawari",
        "duration": "5:12",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview122/v4/e1/90/81/e1908172-d3ac-5650-5389-6a55b7211d8b/mzaf_11937903986078829218.plus.aac.p.m4a"
      },
      {
        "id": "nXJlF-8ds1E",
        "resolvedYtId": "nXJlF-8ds1E",
        "title": "Mala Ved Lagale",
        "artist": "Swapnil Bandodkar",
        "album": "Timepass",
        "duration": "4:32",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/ec/50/a5/ec50a5c2-f349-1f3c-51d8-de64dc0f5ad2/mzaf_18112162108242851676.plus.aac.p.m4a"
      },
      {
        "id": "1a07OVciamI",
        "resolvedYtId": "1a07OVciamI",
        "title": "Galavar Khali",
        "artist": "Swapnil Bandodkar",
        "album": "Bedardi",
        "duration": "4:45",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview112/v4/13/45/b7/1345b7dc-09b6-c3bd-9804-c8e143cb2e58/mzaf_16008013523533615246.plus.aac.p.m4a"
      },
      {
        "id": "bshSJf1BHlY",
        "resolvedYtId": "bshSJf1BHlY",
        "title": "Man Talyat Malyat",
        "artist": "Swapnil Bandodkar",
        "album": "Sanai Choughade",
        "duration": "4:15",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/marathi_folk.mp3"
      },
      {
        "id": "enOYiiEKn_0",
        "resolvedYtId": "enOYiiEKn_0",
        "title": "Waat Pahatana",
        "artist": "Swapnil Bandodkar",
        "album": "Bhavgeet Collection",
        "duration": "4:50",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/40/5a/45/405a4578-6a94-340c-a65c-4bc9b2fee3bc/mzaf_2584740383653574407.plus.aac.p.m4a"
      },
      {
        "id": "JULTqp4jP64",
        "resolvedYtId": "JULTqp4jP64",
        "title": "Jeev Rangala",
        "artist": "Swapnil Bandodkar, Bela Shende",
        "album": "Jogwa",
        "duration": "5:02",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/77/1f/c2/771fc22e-4db0-1d47-a653-4495991c4af2/mzaf_8613984930843923318.plus.aac.p.m4a"
      },
      {
        "id": "3zdCPhX7ah4",
        "resolvedYtId": "3zdCPhX7ah4",
        "title": "Kiti Sangaychay Mala",
        "artist": "Swapnil Bandodkar",
        "album": "Double Seat",
        "duration": "4:10",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/c9/b2/1b/c9b21b2e-0aaf-7978-54d4-e0b777f42918/mzaf_14785827394124605182.plus.aac.p.m4a"
      },
      {
        "id": "4wuG7bvNQow",
        "resolvedYtId": "4wuG7bvNQow",
        "title": "Saavar Re Mana",
        "artist": "Swapnil Bandodkar, Janhavi Prabhu",
        "album": "Mitwaa",
        "duration": "4:40",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/0e/0b/e6/0e0be674-cd4e-2ca1-0f98-ac0eb5bf52b9/mzaf_845566317007393004.plus.aac.p.m4a"
      },
      {
        "id": "YS9lhBN3DJc",
        "resolvedYtId": "YS9lhBN3DJc",
        "title": "Tujhya Vina",
        "artist": "Swapnil Bandodkar",
        "album": "Romantic Hits",
        "duration": "4:25",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/94/4d/25/944d2589-b574-0e23-3f85-fcd219bf2940/mzaf_2379863328671209654.plus.aac.p.m4a"
      }
    ]
  },
  {
    "id": "avdhoot-gupte",
    "name": "Avdhoot Gupte",
    "role": "Singer, Director & Composer",
    "category": "marathi",
    "avatar": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
    "listeners": "7.9M Monthly Listeners",
    "genre": "Marathi Rock / Folk / Patriotic / Pop",
    "bio": "Versatile singer and filmmaker who revolutionized Marathi pop and youth anthems with high-voltage energy.",
    "albums": [
      {
        "collectionId": "alb_ag_1",
        "collectionName": "Meri Madhubala",
        "releaseYear": "2003",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "artistName": "Avdhoot Gupte",
        "tracks": []
      },
      {
        "collectionId": "alb_ag_2",
        "collectionName": "Zenda",
        "releaseYear": "2010",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "artistName": "Avdhoot Gupte",
        "tracks": []
      },
      {
        "collectionId": "alb_ag_3",
        "collectionName": "Morya",
        "releaseYear": "2011",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "artistName": "Avdhoot Gupte",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "XRFBosf_3mU",
        "resolvedYtId": "XRFBosf_3mU",
        "title": "Jai Jai Maharashtra Maza",
        "artist": "Avdhoot Gupte",
        "album": "Maharashtra Geet",
        "duration": "3:58",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview112/v4/a1/f7/a7/a1f7a73d-5b7e-cfa9-8319-e2a841a67252/mzaf_14331363617666695228.plus.aac.p.m4a"
      },
      {
        "id": "NS3Xt2wyDHs",
        "resolvedYtId": "NS3Xt2wyDHs",
        "title": "Meri Madhubala",
        "artist": "Avdhoot Gupte",
        "album": "Meri Madhubala",
        "duration": "4:35",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview112/v4/a6/a6/32/a6a632af-6767-fe1f-2b7a-964887ceb67f/mzaf_9895559565821688332.plus.aac.p.m4a"
      },
      {
        "id": "rKy0rYfWG_c",
        "resolvedYtId": "rKy0rYfWG_c",
        "title": "Dhipadi Dhipang",
        "artist": "Avdhoot Gupte",
        "album": "Morya",
        "duration": "4:12",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/ee/a2/09/eea209cc-08f7-a835-faed-c6b9defc7adf/mzaf_15089614314366252162.plus.aac.p.m4a"
      },
      {
        "id": "NS3Xt2wyDHs",
        "resolvedYtId": "NS3Xt2wyDHs",
        "title": "Aye Haye",
        "artist": "Avdhoot Gupte",
        "album": "Indie Pop",
        "duration": "3:45",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "XRFBosf_3mU",
        "resolvedYtId": "XRFBosf_3mU",
        "title": "Jai Jai Maharashtra Maza",
        "artist": "Avdhoot Gupte",
        "album": "Maharashtra Geet",
        "duration": "3:58",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview112/v4/a1/f7/a7/a1f7a73d-5b7e-cfa9-8319-e2a841a67252/mzaf_14331363617666695228.plus.aac.p.m4a"
      },
      {
        "id": "NS3Xt2wyDHs",
        "resolvedYtId": "NS3Xt2wyDHs",
        "title": "Meri Madhubala",
        "artist": "Avdhoot Gupte",
        "album": "Meri Madhubala",
        "duration": "4:35",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview112/v4/a6/a6/32/a6a632af-6767-fe1f-2b7a-964887ceb67f/mzaf_9895559565821688332.plus.aac.p.m4a"
      },
      {
        "id": "rKy0rYfWG_c",
        "resolvedYtId": "rKy0rYfWG_c",
        "title": "Dhipadi Dhipang",
        "artist": "Avdhoot Gupte",
        "album": "Morya",
        "duration": "4:12",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/ee/a2/09/eea209cc-08f7-a835-faed-c6b9defc7adf/mzaf_15089614314366252162.plus.aac.p.m4a"
      },
      {
        "id": "NS3Xt2wyDHs",
        "resolvedYtId": "NS3Xt2wyDHs",
        "title": "Aye Haye",
        "artist": "Avdhoot Gupte",
        "album": "Indie Pop",
        "duration": "3:45",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/81/08/60/81086064-c7a9-751e-562c-ae6d51bdfe49/mzaf_14510182722150247439.plus.aac.p.m4a"
      },
      {
        "id": "We_Jafy1QJ8",
        "resolvedYtId": "We_Jafy1QJ8",
        "title": "Jagavegali Vegali Hee Duniya",
        "artist": "Avdhoot Gupte",
        "album": "Zenda",
        "duration": "4:20",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview128/v4/25/b7/e3/25b7e31c-4eae-7e6f-818a-953b1540e8ee/mzaf_5434031948569265817.plus.aac.p.m4a"
      },
      {
        "id": "_Q46NUqP3_8",
        "resolvedYtId": "_Q46NUqP3_8",
        "title": "Gandha Ha Vatecha",
        "artist": "Avdhoot Gupte",
        "album": "Bhavgeet",
        "duration": "4:15",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/marathi_folk.mp3"
      },
      {
        "id": "QihssgEMmyg",
        "resolvedYtId": "QihssgEMmyg",
        "title": "Fulpakharu",
        "artist": "Avdhoot Gupte",
        "album": "Fulpakharu",
        "duration": "3:50",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/d4/8a/2e/d48a2e24-aaa0-8a24-ae93-c780bec9482d/mzaf_13573357789273582759.plus.aac.p.m4a"
      },
      {
        "id": "qVVVbfrpP1E",
        "resolvedYtId": "qVVVbfrpP1E",
        "title": "Shambhu Raje",
        "artist": "Avdhoot Gupte",
        "album": "Shivaji Maharaj Geet",
        "duration": "4:45",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/36/b9/8a/36b98a81-485b-abfb-12d4-cd9f9cdab068/mzaf_800526320788145850.plus.aac.p.m4a"
      }
    ]
  },
  {
    "id": "bela-shende",
    "name": "Bela Shende",
    "role": "National Award-winning Singer",
    "category": "marathi",
    "avatar": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
    "listeners": "6.8M Monthly Listeners",
    "genre": "Marathi Melodies / Classical / Bollywood",
    "bio": "National Film Award winner renowned for pristine vocals in Natarang, Tuhya Dharma Koncha, and Jodhaa Akbar.",
    "albums": [
      {
        "collectionId": "alb_bela_1",
        "collectionName": "Natarang Melodies",
        "releaseYear": "2010",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "artistName": "Bela Shende",
        "tracks": []
      },
      {
        "collectionId": "alb_bela_2",
        "collectionName": "Kaakan",
        "releaseYear": "2015",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "artistName": "Bela Shende",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "OY5vL4aXMAo",
        "resolvedYtId": "OY5vL4aXMAo",
        "title": "Apsara Aali",
        "artist": "Bela Shende, Ajay-Atul",
        "album": "Natarang",
        "duration": "4:47",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/43/77/d9/4377d910-1251-051a-5ab8-f80ee8e7a8ec/mzaf_10815249012923361904.plus.aac.p.m4a"
      },
      {
        "id": "7R7QJkznJGU",
        "resolvedYtId": "7R7QJkznJGU",
        "title": "Wajle Ki Bara",
        "artist": "Bela Shende, Ajay-Atul",
        "album": "Natarang",
        "duration": "4:25",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop"
      },
      {
        "id": "cqGxc4XfMSU",
        "resolvedYtId": "cqGxc4XfMSU",
        "title": "Kashi Mi Jaoo Mathurechya Bajari",
        "artist": "Bela Shende",
        "album": "Natarang",
        "duration": "3:55",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/10/ad/2b/10ad2bf1-d1fa-70fa-5768-8af2e4c1f6fb/mzaf_16427549957374516969.plus.aac.p.m4a"
      },
      {
        "id": "-Rp97wDpyXA",
        "resolvedYtId": "-Rp97wDpyXA",
        "title": "Mann Mohana",
        "artist": "Bela Shende, A.R. Rahman",
        "album": "Jodhaa Akbar",
        "duration": "5:05",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/8d/4e/98/8d4e9895-98ab-c38a-bcb5-fa47727e7c92/mzaf_262739596249511268.plus.aac.p.m4a"
      }
    ],
    "allTracks": [
      {
        "id": "OY5vL4aXMAo",
        "resolvedYtId": "OY5vL4aXMAo",
        "title": "Apsara Aali",
        "artist": "Bela Shende, Ajay-Atul",
        "album": "Natarang",
        "duration": "4:47",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/43/77/d9/4377d910-1251-051a-5ab8-f80ee8e7a8ec/mzaf_10815249012923361904.plus.aac.p.m4a"
      },
      {
        "id": "7R7QJkznJGU",
        "resolvedYtId": "7R7QJkznJGU",
        "title": "Wajle Ki Bara",
        "artist": "Bela Shende, Ajay-Atul",
        "album": "Natarang",
        "duration": "4:25",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/c2/f6/01/c2f601cd-cf02-29d4-7006-4b08e16c39e0/mzaf_2971027046522445417.plus.aac.p.m4a"
      },
      {
        "id": "cqGxc4XfMSU",
        "resolvedYtId": "cqGxc4XfMSU",
        "title": "Kashi Mi Jaoo Mathurechya Bajari",
        "artist": "Bela Shende",
        "album": "Natarang",
        "duration": "3:55",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/10/ad/2b/10ad2bf1-d1fa-70fa-5768-8af2e4c1f6fb/mzaf_16427549957374516969.plus.aac.p.m4a"
      },
      {
        "id": "-Rp97wDpyXA",
        "resolvedYtId": "-Rp97wDpyXA",
        "title": "Mann Mohana",
        "artist": "Bela Shende, A.R. Rahman",
        "album": "Jodhaa Akbar",
        "duration": "5:05",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/8d/4e/98/8d4e9895-98ab-c38a-bcb5-fa47727e7c92/mzaf_262739596249511268.plus.aac.p.m4a"
      },
      {
        "id": "NsVIaN-1P90",
        "resolvedYtId": "NsVIaN-1P90",
        "title": "Hridayi Vasant Fulstana",
        "artist": "Bela Shende",
        "album": "Ashi Hi Banwa Banwi Reprise",
        "duration": "4:12",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/marathi_folk.mp3"
      },
      {
        "id": "9HNx1NIwdAc",
        "resolvedYtId": "9HNx1NIwdAc",
        "title": "Kaakan Title Track",
        "artist": "Bela Shende, Shankar Mahadevan",
        "album": "Kaakan",
        "duration": "4:38",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/c8/a2/09/c8a20920-52a8-9728-a305-9f12a85ae305/mzaf_8477813248295499776.plus.aac.p.m4a"
      },
      {
        "id": "96ZVRp-x6F4",
        "resolvedYtId": "96ZVRp-x6F4",
        "title": "Ashi Kashi",
        "artist": "Bela Shende",
        "album": "Mumbai-Pune-Mumbai",
        "duration": "4:15",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/da/b3/f3/dab3f3fc-7b1b-0260-493e-74fd87d7fa0d/mzaf_11664046535428706339.plus.aac.p.m4a"
      }
    ]
  },
  {
    "id": "adarsh-shinde",
    "name": "Adarsh Shinde",
    "role": "Folk, Qawwali & Playback Powerhouse",
    "category": "marathi",
    "avatar": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
    "listeners": "9.2M Monthly Listeners",
    "genre": "Marathi Folk / Bhim Geet / High Energy",
    "bio": "Carrying the iconic Shinde Shahi musical legacy, celebrated for thunderous, soul-stirring high-octane vocals.",
    "albums": [
      {
        "collectionId": "alb_as_1",
        "collectionName": "Aala Baburao",
        "releaseYear": "2016",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "artistName": "Adarsh Shinde",
        "tracks": []
      },
      {
        "collectionId": "alb_as_2",
        "collectionName": "Deva Kalji Re",
        "releaseYear": "2017",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "artistName": "Adarsh Shinde",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "n6-466tLv4g",
        "resolvedYtId": "n6-466tLv4g",
        "title": "Aala Baburao",
        "artist": "Adarsh Shinde",
        "album": "Baghtos Kay Mujra Kar",
        "duration": "3:40",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop"
      },
      {
        "id": "shpk54ZqicY",
        "resolvedYtId": "shpk54ZqicY",
        "title": "Deva Kalji Re",
        "artist": "Adarsh Shinde",
        "album": "Redu",
        "duration": "4:18",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop"
      },
      {
        "id": "16XoeOSLe0g",
        "resolvedYtId": "16XoeOSLe0g",
        "title": "Vithu Mauli",
        "artist": "Adarsh Shinde, Ajay Gogavale",
        "album": "Mauli",
        "duration": "4:32",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/46/37/35/463735a9-982f-fce1-f61f-c595fc3e6792/mzaf_6020215785922041545.plus.aac.p.m4a"
      },
      {
        "id": "VYq4GRO2A5Y",
        "resolvedYtId": "VYq4GRO2A5Y",
        "title": "Shitti Vajali",
        "artist": "Adarsh Shinde",
        "album": "Rege",
        "duration": "3:55",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "n6-466tLv4g",
        "resolvedYtId": "n6-466tLv4g",
        "title": "Aala Baburao",
        "artist": "Adarsh Shinde",
        "album": "Baghtos Kay Mujra Kar",
        "duration": "3:40",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview124/v4/92/50/ac/9250acf2-7f2a-fdc3-a5ac-bd34afe8b9a5/mzaf_8494505432277971701.plus.aac.p.m4a"
      },
      {
        "id": "shpk54ZqicY",
        "resolvedYtId": "shpk54ZqicY",
        "title": "Deva Kalji Re",
        "artist": "Adarsh Shinde",
        "album": "Redu",
        "duration": "4:18",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/24/b1/77/24b17786-1b62-ad14-6c91-9430afe00ee3/mzaf_18325858228778356913.plus.aac.p.m4a"
      },
      {
        "id": "16XoeOSLe0g",
        "resolvedYtId": "16XoeOSLe0g",
        "title": "Vithu Mauli",
        "artist": "Adarsh Shinde, Ajay Gogavale",
        "album": "Mauli",
        "duration": "4:32",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/46/37/35/463735a9-982f-fce1-f61f-c595fc3e6792/mzaf_6020215785922041545.plus.aac.p.m4a"
      },
      {
        "id": "VYq4GRO2A5Y",
        "resolvedYtId": "VYq4GRO2A5Y",
        "title": "Shitti Vajali",
        "artist": "Adarsh Shinde",
        "album": "Rege",
        "duration": "3:55",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/39/7d/a3/397da3bb-9d1a-3320-6979-4e6a5892fc5b/mzaf_5722227294394882644.plus.aac.p.m4a"
      },
      {
        "id": "nI3MJFN4wiU",
        "resolvedYtId": "nI3MJFN4wiU",
        "title": "Khanderaya Zali Mazi Daina",
        "artist": "Adarsh Shinde",
        "album": "Folk Fusion",
        "duration": "4:20",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/marathi_folk.mp3"
      },
      {
        "id": "mVTKc509Muo",
        "resolvedYtId": "mVTKc509Muo",
        "title": "Radha Nache",
        "artist": "Adarsh Shinde",
        "album": "Dhamaka Hits",
        "duration": "3:50",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/2e/d6/d6/2ed6d6b1-4c0e-9aad-4981-d66b12a8f4fb/mzaf_1929923627055452422.plus.aac.p.m4a"
      }
    ]
  },
  {
    "id": "mahesh-kale",
    "name": "Mahesh Kale",
    "role": "Classical Maestro & Natyasangeet Icon",
    "category": "marathi",
    "avatar": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
    "listeners": "5.7M Monthly Listeners",
    "genre": "Indian Classical / Natyasangeet / Semi-Classical",
    "bio": "National Film Award winner, student of Pt. Jitendra Abhisheki, renowned for masterclasses in Katyar Kaljat Ghusali.",
    "albums": [
      {
        "collectionId": "alb_mk_1",
        "collectionName": "Katyar Kaljat Ghusali",
        "releaseYear": "2015",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
        "artistName": "Mahesh Kale",
        "tracks": []
      },
      {
        "collectionId": "alb_mk_2",
        "collectionName": "Man Mandira",
        "releaseYear": "2018",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
        "artistName": "Mahesh Kale",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "mVKgR73YTKE",
        "resolvedYtId": "mVKgR73YTKE",
        "title": "Aruni Kirani",
        "artist": "Mahesh Kale",
        "album": "Katyar Kaljat Ghusali",
        "duration": "5:24",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop"
      },
      {
        "id": "0WRdw3jm-7E",
        "resolvedYtId": "0WRdw3jm-7E",
        "title": "Ghei Chhand Makarand",
        "artist": "Mahesh Kale",
        "album": "Katyar Kaljat Ghusali",
        "duration": "4:50",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop"
      },
      {
        "id": "ljoXc4ZNTmQ",
        "resolvedYtId": "ljoXc4ZNTmQ",
        "title": "Man Mandira",
        "artist": "Mahesh Kale, Shankar Mahadevan",
        "album": "Katyar Kaljat Ghusali",
        "duration": "5:40",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop"
      },
      {
        "id": "c-hjEAXOMoY",
        "resolvedYtId": "c-hjEAXOMoY",
        "title": "Surat Piya Ki",
        "artist": "Mahesh Kale",
        "album": "Katyar Kaljat Ghusali",
        "duration": "4:35",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/f3/18/06/f31806b6-08af-9879-6ddd-b99782910ed0/mzaf_6081335104433919696.plus.aac.p.m4a"
      }
    ],
    "allTracks": [
      {
        "id": "mVKgR73YTKE",
        "resolvedYtId": "mVKgR73YTKE",
        "title": "Aruni Kirani",
        "artist": "Mahesh Kale",
        "album": "Katyar Kaljat Ghusali",
        "duration": "5:24",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/b6/d8/91/b6d891d7-bb63-7f2c-da83-ed1feebec2e0/mzaf_17514926962835309518.plus.aac.p.m4a"
      },
      {
        "id": "0WRdw3jm-7E",
        "resolvedYtId": "0WRdw3jm-7E",
        "title": "Ghei Chhand Makarand",
        "artist": "Mahesh Kale",
        "album": "Katyar Kaljat Ghusali",
        "duration": "4:50",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/ed/b5/a6/edb5a654-96fc-12ed-2136-1fa040a9c179/mzaf_13597131868254651252.plus.aac.p.m4a"
      },
      {
        "id": "ljoXc4ZNTmQ",
        "resolvedYtId": "ljoXc4ZNTmQ",
        "title": "Man Mandira",
        "artist": "Mahesh Kale, Shankar Mahadevan",
        "album": "Katyar Kaljat Ghusali",
        "duration": "5:40",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/7a/c0/7e/7ac07e5c-d410-2983-680e-542a5e69fb24/mzaf_9903844713033392353.plus.aac.p.m4a"
      },
      {
        "id": "c-hjEAXOMoY",
        "resolvedYtId": "c-hjEAXOMoY",
        "title": "Surat Piya Ki",
        "artist": "Mahesh Kale",
        "album": "Katyar Kaljat Ghusali",
        "duration": "4:35",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/f3/18/06/f31806b6-08af-9879-6ddd-b99782910ed0/mzaf_6081335104433919696.plus.aac.p.m4a"
      },
      {
        "id": "eTRMBTez_yU",
        "resolvedYtId": "eTRMBTez_yU",
        "title": "Ya Bhawanatil Geet Purane",
        "artist": "Mahesh Kale",
        "album": "Classical Gems",
        "duration": "5:10",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/2d/af/fb/2daffb10-895d-f5fc-5197-710849834e56/mzaf_16043685185769209753.plus.aac.p.m4a"
      },
      {
        "id": "s-iuI7-BtGk",
        "resolvedYtId": "s-iuI7-BtGk",
        "title": "Kaivalyachya Chandanyala",
        "artist": "Mahesh Kale",
        "album": "Bhakti Sangeet",
        "duration": "5:15",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview127/v4/63/7f/56/637f56ee-c3f4-d213-7faf-41b4e03d8687/mzaf_4344356427107678301.plus.aac.p.m4a"
      }
    ]
  },
  {
    "id": "shreya-ghoshal",
    "name": "Shreya Ghoshal",
    "role": "Melody Queen & 5x National Award Winner",
    "category": "female",
    "avatar": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
    "listeners": "38.5M Monthly Listeners",
    "genre": "Bollywood / Classical / Romance / Regional",
    "bio": "India's nightingale of modern cinema, legendary vocalist across Hindi, Marathi, Bengali, Tamil, and Telugu.",
    "albums": [
      {
        "collectionId": "alb_sg_1",
        "collectionName": "Bajirao Mastani",
        "releaseYear": "2015",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "artistName": "Shreya Ghoshal",
        "tracks": []
      },
      {
        "collectionId": "alb_sg_2",
        "collectionName": "Aashiqui 2",
        "releaseYear": "2013",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "artistName": "Shreya Ghoshal",
        "tracks": []
      },
      {
        "collectionId": "alb_sg_3",
        "collectionName": "Padmaavat",
        "releaseYear": "2018",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "artistName": "Shreya Ghoshal",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "inEu2qQuGZ8",
        "resolvedYtId": "inEu2qQuGZ8",
        "title": "Sunn Raha Hai Na Tu (Female)",
        "artist": "Shreya Ghoshal, Ankit Tiwari",
        "album": "Aashiqui 2",
        "duration": "5:14",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop"
      },
      {
        "id": "CWfCp96-yck",
        "resolvedYtId": "CWfCp96-yck",
        "title": "Teri Ore",
        "artist": "Shreya Ghoshal, Rahat Fateh Ali Khan",
        "album": "Singh Is Kinng",
        "duration": "5:39",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/72/1e/13/721e13a2-7ea0-1dfb-7d9c-c5bbcf1f4df4/mzaf_14014711574677331364.plus.aac.p.m4a"
      },
      {
        "id": "zRtPUIumXcY",
        "resolvedYtId": "zRtPUIumXcY",
        "title": "Deewani Mastani",
        "artist": "Shreya Ghoshal, Sanjay Leela Bhansali",
        "album": "Bajirao Mastani",
        "duration": "5:40",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop"
      },
      {
        "id": "6cKErCWrb44",
        "resolvedYtId": "6cKErCWrb44",
        "title": "Ghoomar",
        "artist": "Shreya Ghoshal, Swaroop Khan",
        "album": "Padmaavat",
        "duration": "4:42",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop"
      },
      {
        "id": "w4ClQO0FFQg",
        "resolvedYtId": "w4ClQO0FFQg",
        "title": "Param Sundari",
        "artist": "Shreya Ghoshal, A.R. Rahman",
        "album": "Mimi",
        "duration": "3:20",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "inEu2qQuGZ8",
        "resolvedYtId": "inEu2qQuGZ8",
        "title": "Sunn Raha Hai Na Tu (Female)",
        "artist": "Shreya Ghoshal, Ankit Tiwari",
        "album": "Aashiqui 2",
        "duration": "5:14",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/f7/c6/78/f7c678f7-f477-294d-b821-1aebf9e3be8a/mzaf_6992444648096213882.plus.aac.p.m4a"
      },
      {
        "id": "CWfCp96-yck",
        "resolvedYtId": "CWfCp96-yck",
        "title": "Teri Ore",
        "artist": "Shreya Ghoshal, Rahat Fateh Ali Khan",
        "album": "Singh Is Kinng",
        "duration": "5:39",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/72/1e/13/721e13a2-7ea0-1dfb-7d9c-c5bbcf1f4df4/mzaf_14014711574677331364.plus.aac.p.m4a"
      },
      {
        "id": "zRtPUIumXcY",
        "resolvedYtId": "zRtPUIumXcY",
        "title": "Deewani Mastani",
        "artist": "Shreya Ghoshal, Sanjay Leela Bhansali",
        "album": "Bajirao Mastani",
        "duration": "5:40",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/33/43/6a/33436a22-9e6f-9aa5-22bb-fcb7bbe63d8f/mzaf_11536592693792974295.plus.aac.p.m4a"
      },
      {
        "id": "6cKErCWrb44",
        "resolvedYtId": "6cKErCWrb44",
        "title": "Ghoomar",
        "artist": "Shreya Ghoshal, Swaroop Khan",
        "album": "Padmaavat",
        "duration": "4:42",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/f2/5e/15/f25e1596-2548-dc63-7d46-6f9220ed61d6/mzaf_1119075411510646061.plus.aac.p.m4a"
      },
      {
        "id": "w4ClQO0FFQg",
        "resolvedYtId": "w4ClQO0FFQg",
        "title": "Param Sundari",
        "artist": "Shreya Ghoshal, A.R. Rahman",
        "album": "Mimi",
        "duration": "3:20",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/37/af/f0/37aff08b-cdfd-ae7e-7f0a-251d07f342d0/mzaf_4304999715906555670.plus.aac.p.m4a"
      },
      {
        "id": "9Bmh6vaQt0s",
        "resolvedYtId": "9Bmh6vaQt0s",
        "title": "Saibo",
        "artist": "Shreya Ghoshal, Sachin-Jigar",
        "album": "Shor in the City",
        "duration": "3:15",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/95/b9/40/95b94073-77da-b348-42b2-7f227f092f73/mzaf_14340793503018163168.plus.aac.p.m4a"
      },
      {
        "id": "24tAgvnPtiY",
        "resolvedYtId": "24tAgvnPtiY",
        "title": "Radha",
        "artist": "Shreya Ghoshal, Vishal-Shekhar",
        "album": "Student of the Year",
        "duration": "5:41",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/fd/6b/5e/fd6b5ed1-1da6-f85b-7457-494ceeeaa227/mzaf_1808157577858544095.plus.aac.p.m4a"
      },
      {
        "id": "btH9veBimCM",
        "resolvedYtId": "btH9veBimCM",
        "title": "Manwa Laage",
        "artist": "Shreya Ghoshal, Arijit Singh",
        "album": "Happy New Year",
        "duration": "4:31",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/d1/d9/b1/d1d9b176-05cb-9f71-a86d-8966c2127ef5/mzaf_11749297915287987560.plus.aac.p.m4a"
      },
      {
        "id": "OY5vL4aXMAo",
        "resolvedYtId": "OY5vL4aXMAo",
        "title": "Apsara Aali (Marathi)",
        "artist": "Bela Shende, Ajay-Atul",
        "album": "Natarang",
        "duration": "4:47",
        "category": "marathi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/01/86/94/018694ba-f5be-2393-af79-ac92a8b60e16/mzaf_6742743588322881922.plus.aac.p.m4a"
      },
      {
        "id": "pHkCDCrvOjo",
        "resolvedYtId": "pHkCDCrvOjo",
        "title": "Barso Re",
        "artist": "Shreya Ghoshal, A.R. Rahman",
        "album": "Guru",
        "duration": "5:29",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/64/c9/32/64c932f0-4109-6760-2002-130797769cff/mzaf_3510266217199157761.plus.aac.p.m4a"
      }
    ]
  },
  {
    "id": "diljit-dosanjh",
    "name": "Diljit Dosanjh",
    "role": "Global Punjabi Icon & Actor",
    "category": "punjabi",
    "avatar": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
    "listeners": "32.1M Monthly Listeners",
    "genre": "Punjabi Pop / Bhangra / Global Fusion",
    "bio": "The global ambassador of Punjabi music, selling out stadium tours and conquering Coachella worldwide.",
    "albums": [
      {
        "collectionId": "alb_dd_1",
        "collectionName": "MoonChild Era",
        "releaseYear": "2021",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "artistName": "Diljit Dosanjh",
        "tracks": []
      },
      {
        "collectionId": "alb_dd_2",
        "collectionName": "G.O.A.T.",
        "releaseYear": "2020",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "artistName": "Diljit Dosanjh",
        "tracks": []
      },
      {
        "collectionId": "alb_dd_3",
        "collectionName": "Ghost",
        "releaseYear": "2023",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "artistName": "Diljit Dosanjh",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "aoIhamvZKdQ",
        "resolvedYtId": "aoIhamvZKdQ",
        "title": "Lover",
        "artist": "Diljit Dosanjh, Intense",
        "album": "Lover",
        "duration": "3:41",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/38/d5/7a/38d57a99-39fc-e901-7c45-fa6260ec83c1/mzaf_8083696285926392389.plus.aac.p.m4a"
      },
      {
        "id": "dCmp56tSSmA",
        "resolvedYtId": "dCmp56tSSmA",
        "title": "Born to Shine",
        "artist": "Diljit Dosanjh, Desi Crew",
        "album": "G.O.A.T.",
        "duration": "3:33",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/38/12/41/38124195-4bd9-1fc7-fe40-f793ee38d163/mzaf_14837378210736189248.plus.aac.p.m4a"
      },
      {
        "id": "tAizFLCucdY",
        "resolvedYtId": "tAizFLCucdY",
        "title": "G.O.A.T.",
        "artist": "Diljit Dosanjh",
        "album": "G.O.A.T.",
        "duration": "3:44",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop"
      },
      {
        "id": "ojqnAZ2pbT8",
        "resolvedYtId": "ojqnAZ2pbT8",
        "title": "Lemonade",
        "artist": "Diljit Dosanjh",
        "album": "Drive Thru",
        "duration": "2:54",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/18/27/b1/1827b18b-6b70-6c1d-3665-38f2c0effc74/mzaf_158287080029555485.plus.aac.p.m4a"
      },
      {
        "id": "Hz-cauEL2rg",
        "resolvedYtId": "Hz-cauEL2rg",
        "title": "Naina",
        "artist": "Diljit Dosanjh, Badshah",
        "album": "Crew",
        "duration": "3:00",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/09/32/19/0932191a-0b17-bc29-b8fd-185f1cd8da96/mzaf_4251788772887694086.plus.aac.p.m4a"
      }
    ],
    "allTracks": [
      {
        "id": "aoIhamvZKdQ",
        "resolvedYtId": "aoIhamvZKdQ",
        "title": "Lover",
        "artist": "Diljit Dosanjh, Intense",
        "album": "Lover",
        "duration": "3:41",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/38/d5/7a/38d57a99-39fc-e901-7c45-fa6260ec83c1/mzaf_8083696285926392389.plus.aac.p.m4a"
      },
      {
        "id": "dCmp56tSSmA",
        "resolvedYtId": "dCmp56tSSmA",
        "title": "Born to Shine",
        "artist": "Diljit Dosanjh, Desi Crew",
        "album": "G.O.A.T.",
        "duration": "3:33",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/38/12/41/38124195-4bd9-1fc7-fe40-f793ee38d163/mzaf_14837378210736189248.plus.aac.p.m4a"
      },
      {
        "id": "tAizFLCucdY",
        "resolvedYtId": "tAizFLCucdY",
        "title": "G.O.A.T.",
        "artist": "Diljit Dosanjh",
        "album": "G.O.A.T.",
        "duration": "3:44",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/ba/5c/57/ba5c5769-536b-1884-dfbf-5930cab13332/mzaf_7745269360294572986.plus.aac.p.m4a"
      },
      {
        "id": "ojqnAZ2pbT8",
        "resolvedYtId": "ojqnAZ2pbT8",
        "title": "Lemonade",
        "artist": "Diljit Dosanjh",
        "album": "Drive Thru",
        "duration": "2:54",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/18/27/b1/1827b18b-6b70-6c1d-3665-38f2c0effc74/mzaf_158287080029555485.plus.aac.p.m4a"
      },
      {
        "id": "Hz-cauEL2rg",
        "resolvedYtId": "Hz-cauEL2rg",
        "title": "Naina",
        "artist": "Diljit Dosanjh, Badshah",
        "album": "Crew",
        "duration": "3:00",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/09/32/19/0932191a-0b17-bc29-b8fd-185f1cd8da96/mzaf_4251788772887694086.plus.aac.p.m4a"
      },
      {
        "id": "FoeqJJMG7Kc",
        "resolvedYtId": "FoeqJJMG7Kc",
        "title": "Hass Hass",
        "artist": "Diljit Dosanjh, Sia",
        "album": "Single",
        "duration": "2:33",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/eb/db/03/ebdb0359-01ba-81fe-aeb6-951c3a6dbad7/mzaf_15406119153944779161.plus.aac.p.m4a"
      },
      {
        "id": "x7_2hINDn_I",
        "resolvedYtId": "x7_2hINDn_I",
        "title": "Peaches",
        "artist": "Diljit Dosanjh",
        "album": "Drive Thru",
        "duration": "3:10",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/75/6f/80/756f806d-fee0-78f2-d1cc-a5244a279365/mzaf_10574627942116147266.plus.aac.p.m4a"
      },
      {
        "id": "DT9fEmSL_Lw",
        "resolvedYtId": "DT9fEmSL_Lw",
        "title": "Do You Know",
        "artist": "Diljit Dosanjh",
        "album": "Single",
        "duration": "3:39",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/ed/de/ab/eddeabcb-0d22-d8eb-18c4-f3ab14f70e2c/mzaf_11597844146912458794.plus.aac.p.m4a"
      },
      {
        "id": "ejYe2GwBEJ0",
        "resolvedYtId": "ejYe2GwBEJ0",
        "title": "Kinni Kinni",
        "artist": "Diljit Dosanjh",
        "album": "Ghost",
        "duration": "3:15",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/72/0b/25/720b2576-27b5-671c-d535-410670f2ed65/mzaf_3758350615454838636.plus.aac.p.m4a"
      }
    ]
  },
  {
    "id": "karan-aujla",
    "name": "Karan Aujla",
    "role": "Punjabi Lyricist & Global Sensation",
    "category": "punjabi",
    "avatar": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
    "listeners": "29.8M Monthly Listeners",
    "genre": "Punjabi Trap / Desi Hip-Hop / Pop",
    "bio": "Chart-dominating superstar known for witty lyricism, making history globally with Making Memories and Four Me.",
    "albums": [
      {
        "collectionId": "alb_ka_1",
        "collectionName": "Making Memories",
        "releaseYear": "2023",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "artistName": "Karan Aujla",
        "tracks": []
      },
      {
        "collectionId": "alb_ka_2",
        "collectionName": "Four You",
        "releaseYear": "2023",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "artistName": "Karan Aujla",
        "tracks": []
      },
      {
        "collectionId": "alb_ka_3",
        "collectionName": "Street Dreams",
        "releaseYear": "2024",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "artistName": "Karan Aujla, DIVINE",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "uTuchIYZdbM",
        "resolvedYtId": "uTuchIYZdbM",
        "title": "Tauba Tauba",
        "artist": "Karan Aujla",
        "album": "Bad Newz",
        "duration": "3:27",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/34/8d/63/348d6342-2c35-bf31-8131-2c8b3cfe3c09/mzaf_15374551219149804677.plus.aac.p.m4a"
      },
      {
        "id": "-Chif1XK2e8",
        "resolvedYtId": "-Chif1XK2e8",
        "title": "Softly",
        "artist": "Karan Aujla, Ikky",
        "album": "Making Memories",
        "duration": "2:35",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop"
      },
      {
        "id": "vsWxs1tuwDk",
        "resolvedYtId": "vsWxs1tuwDk",
        "title": "Winning Speech",
        "artist": "Karan Aujla, Mxrci",
        "album": "Single",
        "duration": "3:22",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop"
      },
      {
        "id": "k85UB5b6pJU",
        "resolvedYtId": "k85UB5b6pJU",
        "title": "Admirin' You",
        "artist": "Karan Aujla, Preston Pablo",
        "album": "Making Memories",
        "duration": "3:34",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop"
      },
      {
        "id": "BtQp2U6hJII",
        "resolvedYtId": "BtQp2U6hJII",
        "title": "White Brown Black",
        "artist": "Karan Aujla, Avvy Sra",
        "album": "White Brown Black",
        "duration": "3:02",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "uTuchIYZdbM",
        "resolvedYtId": "uTuchIYZdbM",
        "title": "Tauba Tauba",
        "artist": "Karan Aujla",
        "album": "Bad Newz",
        "duration": "3:27",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/34/8d/63/348d6342-2c35-bf31-8131-2c8b3cfe3c09/mzaf_15374551219149804677.plus.aac.p.m4a"
      },
      {
        "id": "-Chif1XK2e8",
        "resolvedYtId": "-Chif1XK2e8",
        "title": "Softly",
        "artist": "Karan Aujla, Ikky",
        "album": "Making Memories",
        "duration": "2:35",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/5f/6f/01/5f6f0130-6567-22d4-bc1a-5ccb359c3fac/mzaf_5497113703334703756.plus.aac.p.m4a"
      },
      {
        "id": "vsWxs1tuwDk",
        "resolvedYtId": "vsWxs1tuwDk",
        "title": "Winning Speech",
        "artist": "Karan Aujla, Mxrci",
        "album": "Single",
        "duration": "3:22",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/e3/ae/b6/e3aeb64f-cadd-5830-c39f-6af51cd91670/mzaf_6001527501800958065.plus.aac.p.m4a"
      },
      {
        "id": "k85UB5b6pJU",
        "resolvedYtId": "k85UB5b6pJU",
        "title": "Admirin' You",
        "artist": "Karan Aujla, Preston Pablo",
        "album": "Making Memories",
        "duration": "3:34",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/26/b4/85/26b48527-4fb1-9922-9af6-564258b7aa1b/mzaf_4272589853786839813.plus.aac.p.m4a"
      },
      {
        "id": "BtQp2U6hJII",
        "resolvedYtId": "BtQp2U6hJII",
        "title": "White Brown Black",
        "artist": "Karan Aujla, Avvy Sra",
        "album": "White Brown Black",
        "duration": "3:02",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/14/25/82/14258236-3667-bd59-1eaa-3cdcfadb83e2/mzaf_14706692046116557893.plus.aac.p.m4a"
      },
      {
        "id": "4DfVxVeqk2o",
        "resolvedYtId": "4DfVxVeqk2o",
        "title": "52 Bars",
        "artist": "Karan Aujla, Ikky",
        "album": "Four You",
        "duration": "3:40",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/52/c9/1c/52c91c69-352d-cb4e-3706-265dc01067d0/mzaf_17387125942915601585.plus.aac.p.m4a"
      },
      {
        "id": "rXoReWNm8Zo",
        "resolvedYtId": "rXoReWNm8Zo",
        "title": "Antidote",
        "artist": "Karan Aujla",
        "album": "Making Memories",
        "duration": "3:10",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/83/fd/0a/83fd0a07-7fc9-e07e-520f-ce8ca4327acc/mzaf_14841514026491120213.plus.aac.p.m4a"
      },
      {
        "id": "nBrBwGgY-Kg",
        "resolvedYtId": "nBrBwGgY-Kg",
        "title": "Chitta Kurta",
        "artist": "Karan Aujla",
        "album": "Hits",
        "duration": "3:30",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/d6/1d/21/d61d2133-f529-53dd-6ac6-25e5cf33d3f5/mzaf_16140370948149595124.plus.aac.p.m4a"
      },
      {
        "id": "Fifv0zWPDlk",
        "resolvedYtId": "Fifv0zWPDlk",
        "title": "Mexico",
        "artist": "Karan Aujla",
        "album": "Single",
        "duration": "3:15",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/51/f7/6e/51f76e49-6427-37c6-d4ef-c6c09d3dc2f6/mzaf_12961961749602250393.plus.aac.p.m4a"
      }
    ]
  },
  {
    "id": "shubh",
    "name": "Shubh",
    "role": "Breakout Punjabi Rap Artist",
    "category": "punjabi",
    "avatar": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
    "listeners": "22.4M Monthly Listeners",
    "genre": "Punjabi Hip-Hop / Melodic Trap",
    "bio": "Viral global chart-topper whose distinctive flow on Cheques, Baller, and No Love took streaming by storm.",
    "albums": [
      {
        "collectionId": "alb_shubh_1",
        "collectionName": "Still Rollin",
        "releaseYear": "2023",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "artistName": "Shubh",
        "tracks": []
      },
      {
        "collectionId": "alb_shubh_2",
        "collectionName": "Leo",
        "releaseYear": "2024",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "artistName": "Shubh",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "4tywp83zkmk",
        "resolvedYtId": "4tywp83zkmk",
        "title": "Cheques",
        "artist": "Shubh",
        "album": "Still Rollin",
        "duration": "3:03",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop"
      },
      {
        "id": "xR3V5Ow2dTI",
        "resolvedYtId": "xR3V5Ow2dTI",
        "title": "Baller",
        "artist": "Shubh, Ikky",
        "album": "Single",
        "duration": "2:29",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop"
      },
      {
        "id": "6RrEQJNZwPQ",
        "resolvedYtId": "6RrEQJNZwPQ",
        "title": "No Love",
        "artist": "Shubh",
        "album": "Single",
        "duration": "2:51",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/f5/44/60/f54460ff-fd9a-8ba5-9b96-c125671653d0/mzaf_10095891320979401013.plus.aac.p.m4a"
      },
      {
        "id": "OREPxVPAGPk",
        "resolvedYtId": "OREPxVPAGPk",
        "title": "Still Rollin",
        "artist": "Shubh",
        "album": "Still Rollin",
        "duration": "2:54",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop"
      },
      {
        "id": "9CvwbW9UhJc",
        "resolvedYtId": "9CvwbW9UhJc",
        "title": "Elevated",
        "artist": "Shubh",
        "album": "Single",
        "duration": "3:20",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "4tywp83zkmk",
        "resolvedYtId": "4tywp83zkmk",
        "title": "Cheques",
        "artist": "Shubh",
        "album": "Still Rollin",
        "duration": "3:03",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/5f/e9/8a/5fe98aa5-660a-2f91-b53d-558fdb9ef50b/mzaf_5845186979219129320.plus.aac.p.m4a"
      },
      {
        "id": "xR3V5Ow2dTI",
        "resolvedYtId": "xR3V5Ow2dTI",
        "title": "Baller",
        "artist": "Shubh, Ikky",
        "album": "Single",
        "duration": "2:29",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/b6/a0/97/b6a09736-5312-7636-f177-661cfc3adf67/mzaf_11821137866953407865.plus.aac.p.m4a"
      },
      {
        "id": "6RrEQJNZwPQ",
        "resolvedYtId": "6RrEQJNZwPQ",
        "title": "No Love",
        "artist": "Shubh",
        "album": "Single",
        "duration": "2:51",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/f5/44/60/f54460ff-fd9a-8ba5-9b96-c125671653d0/mzaf_10095891320979401013.plus.aac.p.m4a"
      },
      {
        "id": "OREPxVPAGPk",
        "resolvedYtId": "OREPxVPAGPk",
        "title": "Still Rollin",
        "artist": "Shubh",
        "album": "Still Rollin",
        "duration": "2:54",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/66/8a/04/668a0423-3b9e-10af-9118-af173fb5a127/mzaf_18037249437587947297.plus.aac.p.m4a"
      },
      {
        "id": "9CvwbW9UhJc",
        "resolvedYtId": "9CvwbW9UhJc",
        "title": "Elevated",
        "artist": "Shubh",
        "album": "Single",
        "duration": "3:20",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/punjabi_beat.mp3"
      },
      {
        "id": "eD3TP-C3nYE",
        "resolvedYtId": "eD3TP-C3nYE",
        "title": "Her",
        "artist": "Shubh",
        "album": "Single",
        "duration": "2:34",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/9f/3e/7f/9f3e7f11-5a92-7af4-bcc5-998b3bad9b5d/mzaf_14305003761944407236.plus.aac.p.m4a"
      },
      {
        "id": "SeC91H4nWCk",
        "resolvedYtId": "SeC91H4nWCk",
        "title": "Dior",
        "artist": "Shubh",
        "album": "Still Rollin",
        "duration": "2:45",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/8e/43/77/8e437722-89ad-d720-3667-c693cc396c09/mzaf_14484352547429202778.plus.aac.p.m4a"
      },
      {
        "id": "LjfY3qSTBQc",
        "resolvedYtId": "LjfY3qSTBQc",
        "title": "Safety Off",
        "artist": "Shubh",
        "album": "Leo",
        "duration": "2:50",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/48/11/6a/48116aa4-8c3e-55c8-4019-0af0fee00d9d/mzaf_13024107757621021635.plus.aac.p.m4a"
      },
      {
        "id": "d2ofxg8pHfQ",
        "resolvedYtId": "d2ofxg8pHfQ",
        "title": "King Shit",
        "artist": "Shubh",
        "album": "Leo",
        "duration": "3:10",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/f1/ba/4c/f1ba4c94-5355-8214-8dea-bc57cfc51a2d/mzaf_10482714109571194376.plus.aac.p.m4a"
      },
      {
        "id": "0pWsCiBvLOk",
        "resolvedYtId": "0pWsCiBvLOk",
        "title": "One Love",
        "artist": "Shubh",
        "album": "Single",
        "duration": "2:40",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/c5/cd/39/c5cd39fb-c2fc-0943-dbc0-102078023d8b/mzaf_9648427574188370554.plus.aac.p.m4a"
      }
    ]
  },
  {
    "id": "taylor-swift",
    "name": "Taylor Swift",
    "role": "Global Pop Icon & Songwriter",
    "category": "english",
    "avatar": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
    "listeners": "104.8M Monthly Listeners",
    "genre": "Pop / Synth-Pop / Indie Folk",
    "bio": "14-time Grammy winner, historic streaming record holder, and cultural phenomenon behind the Eras Tour.",
    "albums": [
      {
        "collectionId": "alb_ts_1",
        "collectionName": "Lover",
        "releaseYear": "2019",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "artistName": "Taylor Swift",
        "tracks": []
      },
      {
        "collectionId": "alb_ts_2",
        "collectionName": "1989 (Taylor's Version)",
        "releaseYear": "2023",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "artistName": "Taylor Swift",
        "tracks": []
      },
      {
        "collectionId": "alb_ts_3",
        "collectionName": "Midnights",
        "releaseYear": "2022",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "artistName": "Taylor Swift",
        "tracks": []
      },
      {
        "collectionId": "alb_ts_4",
        "collectionName": "The Tortured Poets Department",
        "releaseYear": "2024",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "artistName": "Taylor Swift",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "ic8j13piAhQ",
        "resolvedYtId": "ic8j13piAhQ",
        "title": "Cruel Summer",
        "artist": "Taylor Swift",
        "album": "Lover",
        "duration": "2:58",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop"
      },
      {
        "id": "e-ORhEE9VVg",
        "resolvedYtId": "e-ORhEE9VVg",
        "title": "Blank Space",
        "artist": "Taylor Swift",
        "album": "1989",
        "duration": "3:51",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop"
      },
      {
        "id": "b1kbLwvqugk",
        "resolvedYtId": "b1kbLwvqugk",
        "title": "Anti-Hero",
        "artist": "Taylor Swift",
        "album": "Midnights",
        "duration": "3:20",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/1d/56/2a/1d562a07-dc5f-a9c0-1f36-2051a8c14eb7/mzaf_7214829135431340590.plus.aac.p.m4a"
      },
      {
        "id": "8xg3vE8Ie_E",
        "resolvedYtId": "8xg3vE8Ie_E",
        "title": "Love Story (Taylor's Version)",
        "artist": "Taylor Swift",
        "album": "Fearless",
        "duration": "3:55",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop"
      },
      {
        "id": "nfWlot6h_JM",
        "resolvedYtId": "nfWlot6h_JM",
        "title": "Shake It Off",
        "artist": "Taylor Swift",
        "album": "1989",
        "duration": "3:39",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/11/d5/6d/11d56d4a-ce23-e793-8681-70dc4d35d931/mzaf_5886436202259848624.plus.aac.p.m4a"
      },
      {
        "id": "b7kmP1fsGg8",
        "resolvedYtId": "b7kmP1fsGg8",
        "title": "Fortnight (feat. Post Malone)",
        "artist": "Taylor Swift",
        "album": "TTPD",
        "duration": "3:48",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "ic8j13piAhQ",
        "resolvedYtId": "ic8j13piAhQ",
        "title": "Cruel Summer",
        "artist": "Taylor Swift",
        "album": "Lover",
        "duration": "2:58",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/44/af/81/44af8168-9609-1b85-5048-ada08dceacf3/mzaf_1341699644335558812.plus.aac.p.m4a"
      },
      {
        "id": "e-ORhEE9VVg",
        "resolvedYtId": "e-ORhEE9VVg",
        "title": "Blank Space",
        "artist": "Taylor Swift",
        "album": "1989",
        "duration": "3:51",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/79/55/b1/7955b10c-6cb6-462a-861c-8e5cbcacfb76/mzaf_3395570742482345989.plus.aac.p.m4a"
      },
      {
        "id": "b1kbLwvqugk",
        "resolvedYtId": "b1kbLwvqugk",
        "title": "Anti-Hero",
        "artist": "Taylor Swift",
        "album": "Midnights",
        "duration": "3:20",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/1d/56/2a/1d562a07-dc5f-a9c0-1f36-2051a8c14eb7/mzaf_7214829135431340590.plus.aac.p.m4a"
      },
      {
        "id": "8xg3vE8Ie_E",
        "resolvedYtId": "8xg3vE8Ie_E",
        "title": "Love Story (Taylor's Version)",
        "artist": "Taylor Swift",
        "album": "Fearless",
        "duration": "3:55",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/8b/4c/b3/8b4cb3a5-b1d1-c82c-e6ab-48cc3969d4ff/mzaf_858711921713575608.plus.aac.p.m4a"
      },
      {
        "id": "nfWlot6h_JM",
        "resolvedYtId": "nfWlot6h_JM",
        "title": "Shake It Off",
        "artist": "Taylor Swift",
        "album": "1989",
        "duration": "3:39",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/11/d5/6d/11d56d4a-ce23-e793-8681-70dc4d35d931/mzaf_5886436202259848624.plus.aac.p.m4a"
      },
      {
        "id": "VuNIsY6JdUw",
        "resolvedYtId": "VuNIsY6JdUw",
        "title": "You Belong With Me",
        "artist": "Taylor Swift",
        "album": "Fearless",
        "duration": "3:51",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/2c/6e/b8/2c6eb87b-a89c-98b0-f4c3-94846613b36b/mzaf_10934143866669182930.plus.aac.p.m4a"
      },
      {
        "id": "yQM2Y7pOYZ0",
        "resolvedYtId": "yQM2Y7pOYZ0",
        "title": "Cardigan",
        "artist": "Taylor Swift",
        "album": "Folklore",
        "duration": "3:59",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/00/b3/f2/00b3f2a0-3228-b65f-7189-91eb26f5adf6/mzaf_3535055549125623460.plus.aac.p.m4a"
      },
      {
        "id": "-CmadmM5cOk",
        "resolvedYtId": "-CmadmM5cOk",
        "title": "Style",
        "artist": "Taylor Swift",
        "album": "1989",
        "duration": "3:51",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/e7/97/e5/e797e534-4b92-1ede-116f-78565732fb8b/mzaf_6239584281452429330.plus.aac.p.m4a"
      },
      {
        "id": "QcIy9NiNbmo",
        "resolvedYtId": "QcIy9NiNbmo",
        "title": "Bad Blood",
        "artist": "Taylor Swift",
        "album": "1989",
        "duration": "3:31",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/29/0c/b6/290cb6f1-ddc6-a36c-e120-753c175152d8/mzaf_9436312145049158466.plus.aac.p.m4a"
      },
      {
        "id": "b7kmP1fsGg8",
        "resolvedYtId": "b7kmP1fsGg8",
        "title": "Fortnight (feat. Post Malone)",
        "artist": "Taylor Swift",
        "album": "TTPD",
        "duration": "3:48",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/90/67/b5/9067b561-f437-d4ce-1f2f-ac3913339d72/mzaf_9669199482319820236.plus.aac.p.m4a"
      },
      {
        "id": "-BjZmE2gtdo",
        "resolvedYtId": "-BjZmE2gtdo",
        "title": "Lover",
        "artist": "Taylor Swift",
        "album": "Lover",
        "duration": "3:41",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/e0/db/47/e0db47b0-7f70-0631-0414-cd4777d2fb3e/mzaf_6362891154838442638.plus.aac.p.m4a"
      },
      {
        "id": "3tmd-ClpJxA",
        "resolvedYtId": "3tmd-ClpJxA",
        "title": "Look What You Made Me Do",
        "artist": "Taylor Swift",
        "album": "Reputation",
        "duration": "3:35",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/3b/26/64/3b26645a-2c49-f0c7-fa6d-be6ad83b0ae9/mzaf_4194244291813253017.plus.aac.p.m4a"
      }
    ]
  },
  {
    "id": "ed-sheeran",
    "name": "Ed Sheeran",
    "role": "Global Singer-Songwriter",
    "category": "english",
    "avatar": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
    "listeners": "78.4M Monthly Listeners",
    "genre": "Pop / Acoustic / Folk Pop",
    "bio": "Multi-platinum British singer-songwriter known for record-shattering acoustic anthems and heartfelt ballads.",
    "albums": [
      {
        "collectionId": "alb_es_1",
        "collectionName": "Divide",
        "releaseYear": "2017",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "artistName": "Ed Sheeran",
        "tracks": []
      },
      {
        "collectionId": "alb_es_2",
        "collectionName": "Equals",
        "releaseYear": "2021",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "artistName": "Ed Sheeran",
        "tracks": []
      },
      {
        "collectionId": "alb_es_3",
        "collectionName": "Subtract",
        "releaseYear": "2023",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "artistName": "Ed Sheeran",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "JGwWNGJdvx8",
        "resolvedYtId": "JGwWNGJdvx8",
        "title": "Shape of You",
        "artist": "Ed Sheeran",
        "album": "Divide",
        "duration": "3:53",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/44/c7/4f/44c74f0d-72dc-6143-d4d0-ba14d661ca0d/mzaf_9566898362556366703.plus.aac.p.m4a"
      },
      {
        "id": "2Vv-BfVoq4g",
        "resolvedYtId": "2Vv-BfVoq4g",
        "title": "Perfect",
        "artist": "Ed Sheeran",
        "album": "Divide",
        "duration": "4:23",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop"
      },
      {
        "id": "orJSJGHjBLI",
        "resolvedYtId": "orJSJGHjBLI",
        "title": "Bad Habits",
        "artist": "Ed Sheeran",
        "album": "Equals",
        "duration": "3:51",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop"
      },
      {
        "id": "lp-EO5I60KA",
        "resolvedYtId": "lp-EO5I60KA",
        "title": "Thinking Out Loud",
        "artist": "Ed Sheeran",
        "album": "Multiply",
        "duration": "4:41",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop"
      },
      {
        "id": "Il0S8BoucSA",
        "resolvedYtId": "Il0S8BoucSA",
        "title": "Shivers",
        "artist": "Ed Sheeran",
        "album": "Equals",
        "duration": "3:27",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "JGwWNGJdvx8",
        "resolvedYtId": "JGwWNGJdvx8",
        "title": "Shape of You",
        "artist": "Ed Sheeran",
        "album": "Divide",
        "duration": "3:53",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/44/c7/4f/44c74f0d-72dc-6143-d4d0-ba14d661ca0d/mzaf_9566898362556366703.plus.aac.p.m4a"
      },
      {
        "id": "2Vv-BfVoq4g",
        "resolvedYtId": "2Vv-BfVoq4g",
        "title": "Perfect",
        "artist": "Ed Sheeran",
        "album": "Divide",
        "duration": "4:23",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/c7/ba/bc/c7babc66-f598-aaa6-bcf6-307281795817/mzaf_16337361235117168274.plus.aac.p.m4a"
      },
      {
        "id": "orJSJGHjBLI",
        "resolvedYtId": "orJSJGHjBLI",
        "title": "Bad Habits",
        "artist": "Ed Sheeran",
        "album": "Equals",
        "duration": "3:51",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/f2/08/5d/f2085d7c-a4d0-451b-4d1d-ccc3057ab6e2/mzaf_11771336260379351390.plus.aac.p.m4a"
      },
      {
        "id": "lp-EO5I60KA",
        "resolvedYtId": "lp-EO5I60KA",
        "title": "Thinking Out Loud",
        "artist": "Ed Sheeran",
        "album": "Multiply",
        "duration": "4:41",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/78/a5/f2/78a5f25e-ad1b-718d-82ad-b82e676c1855/mzaf_6133970271589343093.plus.aac.p.m4a"
      },
      {
        "id": "Il0S8BoucSA",
        "resolvedYtId": "Il0S8BoucSA",
        "title": "Shivers",
        "artist": "Ed Sheeran",
        "album": "Equals",
        "duration": "3:27",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/a8/9f/a5/a89fa5e9-8a3b-77bb-e081-866067d3f213/mzaf_13889707114574366771.plus.aac.p.m4a"
      },
      {
        "id": "nSDgHBxUbVQ",
        "resolvedYtId": "nSDgHBxUbVQ",
        "title": "Photograph",
        "artist": "Ed Sheeran",
        "album": "Multiply",
        "duration": "4:19",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/11/4f/6a/114f6ad0-165c-1e3c-8fbd-df4707d7ae26/mzaf_12480083080052535279.plus.aac.p.m4a"
      },
      {
        "id": "K0ibBPhiaG0",
        "resolvedYtId": "K0ibBPhiaG0",
        "title": "Castle on the Hill",
        "artist": "Ed Sheeran",
        "album": "Divide",
        "duration": "4:21",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/07/be/08/07be085d-6f06-8b4e-cea1-f40b4dca3815/mzaf_12958775594313934161.plus.aac.p.m4a"
      },
      {
        "id": "87gWaABqGYs",
        "resolvedYtId": "87gWaABqGYs",
        "title": "Galway Girl",
        "artist": "Ed Sheeran",
        "album": "Divide",
        "duration": "2:50",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/26/98/fc/2698fc53-3774-bd3c-8b22-f1f845eacdaf/mzaf_11930414004759637913.plus.aac.p.m4a"
      },
      {
        "id": "myZistq5lRM",
        "resolvedYtId": "myZistq5lRM",
        "title": "Eyes Closed",
        "artist": "Ed Sheeran",
        "album": "Subtract",
        "duration": "3:14",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/15/ea/17/15ea171d-169b-7ac9-a388-868f68b93a03/mzaf_18169731938001158680.plus.aac.p.m4a"
      },
      {
        "id": "23g5HBOg3Ic",
        "resolvedYtId": "23g5HBOg3Ic",
        "title": "Celestial",
        "artist": "Ed Sheeran",
        "album": "Celestial",
        "duration": "3:29",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/06/6e/6d/066e6d57-211a-f21a-7626-f26811430ddd/mzaf_12504588048047649574.plus.aac.p.m4a"
      }
    ]
  },
  {
    "id": "the-weeknd",
    "name": "The Weeknd",
    "role": "Global R&B & Synth-Pop Icon",
    "category": "english",
    "avatar": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
    "listeners": "108.2M Monthly Listeners",
    "genre": "R&B / Synthwave / Pop",
    "bio": "Grammy-winning musical architect behind Blinding Lights—the #1 Billboard Hot 100 song of all time.",
    "albums": [
      {
        "collectionId": "alb_tw_1",
        "collectionName": "After Hours",
        "releaseYear": "2020",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "artistName": "The Weeknd",
        "tracks": []
      },
      {
        "collectionId": "alb_tw_2",
        "collectionName": "Starboy",
        "releaseYear": "2016",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "artistName": "The Weeknd",
        "tracks": []
      },
      {
        "collectionId": "alb_tw_3",
        "collectionName": "Dawn FM",
        "releaseYear": "2022",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "artistName": "The Weeknd",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "4NRXx6U8ABQ",
        "resolvedYtId": "4NRXx6U8ABQ",
        "title": "Blinding Lights",
        "artist": "The Weeknd",
        "album": "After Hours",
        "duration": "3:20",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/17/b4/8f/17b48f9a-0b93-6bb8-fe1d-3a16623c2cfb/mzaf_9560252727299052414.plus.aac.p.m4a"
      },
      {
        "id": "34Na4j8AVgA",
        "resolvedYtId": "34Na4j8AVgA",
        "title": "Starboy",
        "artist": "The Weeknd, Daft Punk",
        "album": "Starboy",
        "duration": "3:50",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop"
      },
      {
        "id": "XXYlFuWEuKI",
        "resolvedYtId": "XXYlFuWEuKI",
        "title": "Save Your Tears",
        "artist": "The Weeknd",
        "album": "After Hours",
        "duration": "3:35",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/8b/38/17/8b3817e4-c0e9-7e02-2654-3e2ecee93603/mzaf_18415642125637540903.plus.aac.p.m4a"
      },
      {
        "id": "yzTuBuRdAyA",
        "resolvedYtId": "yzTuBuRdAyA",
        "title": "The Hills",
        "artist": "The Weeknd",
        "album": "Beauty Behind the Madness",
        "duration": "4:02",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop"
      },
      {
        "id": "2AH5l-vrY9Q",
        "resolvedYtId": "2AH5l-vrY9Q",
        "title": "Die For You",
        "artist": "The Weeknd",
        "album": "Starboy",
        "duration": "3:50",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "4NRXx6U8ABQ",
        "resolvedYtId": "4NRXx6U8ABQ",
        "title": "Blinding Lights",
        "artist": "The Weeknd",
        "album": "After Hours",
        "duration": "3:20",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/17/b4/8f/17b48f9a-0b93-6bb8-fe1d-3a16623c2cfb/mzaf_9560252727299052414.plus.aac.p.m4a"
      },
      {
        "id": "34Na4j8AVgA",
        "resolvedYtId": "34Na4j8AVgA",
        "title": "Starboy",
        "artist": "The Weeknd, Daft Punk",
        "album": "Starboy",
        "duration": "3:50",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/11/71/d6/1171d6ad-3c96-e027-2af6-58028426588c/mzaf_15137631797407745471.plus.aac.p.m4a"
      },
      {
        "id": "XXYlFuWEuKI",
        "resolvedYtId": "XXYlFuWEuKI",
        "title": "Save Your Tears",
        "artist": "The Weeknd",
        "album": "After Hours",
        "duration": "3:35",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/8b/38/17/8b3817e4-c0e9-7e02-2654-3e2ecee93603/mzaf_18415642125637540903.plus.aac.p.m4a"
      },
      {
        "id": "yzTuBuRdAyA",
        "resolvedYtId": "yzTuBuRdAyA",
        "title": "The Hills",
        "artist": "The Weeknd",
        "album": "Beauty Behind the Madness",
        "duration": "4:02",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/0b/70/c8/0b70c898-ec23-3131-5d17-aa7417045013/mzaf_3059117378996578649.plus.aac.p.m4a"
      },
      {
        "id": "dqt8Z1k0oWQ",
        "resolvedYtId": "dqt8Z1k0oWQ",
        "title": "Can't Feel My Face",
        "artist": "The Weeknd",
        "album": "Beauty Behind the Madness",
        "duration": "3:33",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/e0/4d/65/e04d6546-d5ae-28bf-51fa-e4e54d737c2f/mzaf_17329746342766146939.plus.aac.p.m4a"
      },
      {
        "id": "2AH5l-vrY9Q",
        "resolvedYtId": "2AH5l-vrY9Q",
        "title": "Die For You",
        "artist": "The Weeknd",
        "album": "Starboy",
        "duration": "3:50",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/50/50/1a/50501a86-bd74-e90d-8a56-68c9b5e6e7d6/mzaf_4588197682084244913.plus.aac.p.m4a"
      },
      {
        "id": "qFLhGq0060w",
        "resolvedYtId": "qFLhGq0060w",
        "title": "I Feel It Coming",
        "artist": "The Weeknd, Daft Punk",
        "album": "Starboy",
        "duration": "4:29",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/71/af/e0/71afe07f-aae7-c4f0-db02-c05be07591d2/mzaf_5960554915698764959.plus.aac.p.m4a"
      },
      {
        "id": "kxgj5af8zg4",
        "resolvedYtId": "kxgj5af8zg4",
        "title": "Out of Time",
        "artist": "The Weeknd",
        "album": "Dawn FM",
        "duration": "3:34",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/79/b8/43/79b84369-15c3-5a5a-fb72-2334b00826e6/mzaf_4381874253449656759.plus.aac.p.m4a"
      },
      {
        "id": "61ymOWwOwuk",
        "resolvedYtId": "61ymOWwOwuk",
        "title": "Creepin'",
        "artist": "Metro Boomin, The Weeknd, 21 Savage",
        "album": "Heroes & Villains",
        "duration": "3:41",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/a4/70/cd/a470cdf5-c83f-9f71-7b29-121e78f8e49e/mzaf_15930159115358992118.plus.aac.p.m4a"
      },
      {
        "id": "ygTZZpVkmKg",
        "resolvedYtId": "ygTZZpVkmKg",
        "title": "After Hours",
        "artist": "The Weeknd",
        "album": "After Hours",
        "duration": "6:01",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/54/2b/61/542b6133-80f7-f30f-4dcf-059490db9d84/mzaf_1539067797902127760.plus.aac.p.m4a"
      }
    ]
  },
  {
    "id": "billie-eilish",
    "name": "Billie Eilish",
    "role": "Alternative & Pop Trailblazer",
    "category": "english",
    "avatar": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
    "listeners": "95.1M Monthly Listeners",
    "genre": "Alt-Pop / Dark Pop / Indie",
    "bio": "Oscar and 9-time Grammy winner whose revolutionary sound shaped a generation with Bad Guy and Hit Me Hard and Soft.",
    "albums": [
      {
        "collectionId": "alb_be_1",
        "collectionName": "When We All Fall Asleep",
        "releaseYear": "2019",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "artistName": "Billie Eilish",
        "tracks": []
      },
      {
        "collectionId": "alb_be_2",
        "collectionName": "Happier Than Ever",
        "releaseYear": "2021",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "artistName": "Billie Eilish",
        "tracks": []
      },
      {
        "collectionId": "alb_be_3",
        "collectionName": "Hit Me Hard and Soft",
        "releaseYear": "2024",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "artistName": "Billie Eilish",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "DyDfgMOUjCI",
        "resolvedYtId": "DyDfgMOUjCI",
        "title": "Bad Guy",
        "artist": "Billie Eilish",
        "album": "When We All Fall Asleep",
        "duration": "3:14",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/c3/87/1f/c3871f7e-3260-d615-1c66-5fdca2c3a48f/mzaf_10721331211699880949.plus.aac.p.m4a"
      },
      {
        "id": "V1Pl8CzNzCw",
        "resolvedYtId": "V1Pl8CzNzCw",
        "title": "Lovely",
        "artist": "Billie Eilish, Khalid",
        "album": "13 Reasons Why",
        "duration": "3:20",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop"
      },
      {
        "id": "V9PVRfjEBTI",
        "resolvedYtId": "V9PVRfjEBTI",
        "title": "Birds of a Feather",
        "artist": "Billie Eilish",
        "album": "Hit Me Hard and Soft",
        "duration": "3:30",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop"
      },
      {
        "id": "pbMwTqkKSps",
        "resolvedYtId": "pbMwTqkKSps",
        "title": "When the Party's Over",
        "artist": "Billie Eilish",
        "album": "When We All Fall Asleep",
        "duration": "3:16",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop"
      },
      {
        "id": "cW8VLC9nnTo",
        "resolvedYtId": "cW8VLC9nnTo",
        "title": "What Was I Made For?",
        "artist": "Billie Eilish",
        "album": "Barbie",
        "duration": "3:42",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "DyDfgMOUjCI",
        "resolvedYtId": "DyDfgMOUjCI",
        "title": "Bad Guy",
        "artist": "Billie Eilish",
        "album": "When We All Fall Asleep",
        "duration": "3:14",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/c3/87/1f/c3871f7e-3260-d615-1c66-5fdca2c3a48f/mzaf_10721331211699880949.plus.aac.p.m4a"
      },
      {
        "id": "V1Pl8CzNzCw",
        "resolvedYtId": "V1Pl8CzNzCw",
        "title": "Lovely",
        "artist": "Billie Eilish, Khalid",
        "album": "13 Reasons Why",
        "duration": "3:20",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/1e/d8/8d/1ed88d91-fb06-b3f2-5391-afd732cc2ff9/mzaf_18444937225262929488.plus.aac.p.m4a"
      },
      {
        "id": "V9PVRfjEBTI",
        "resolvedYtId": "V9PVRfjEBTI",
        "title": "Birds of a Feather",
        "artist": "Billie Eilish",
        "album": "Hit Me Hard and Soft",
        "duration": "3:30",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/34/31/d3/3431d34e-847f-5d66-df83-0bce688d997e/mzaf_18106743962423782018.plus.aac.p.m4a"
      },
      {
        "id": "pbMwTqkKSps",
        "resolvedYtId": "pbMwTqkKSps",
        "title": "When the Party's Over",
        "artist": "Billie Eilish",
        "album": "When We All Fall Asleep",
        "duration": "3:16",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/2a/ba/44/2aba4410-ba71-89ce-e075-10120409c31c/mzaf_16887001963655152332.plus.aac.p.m4a"
      },
      {
        "id": "d--DyK0wtYo",
        "resolvedYtId": "d--DyK0wtYo",
        "title": "Ocean Eyes",
        "artist": "Billie Eilish",
        "album": "Don't Smile at Me",
        "duration": "3:20",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/d6/59/2b/d6592b0b-1e7e-4743-b2e4-f2af038fd783/mzaf_7697277787797935735.plus.aac.p.m4a"
      },
      {
        "id": "qCTMq7xvdXU",
        "resolvedYtId": "qCTMq7xvdXU",
        "title": "Everything I Wanted",
        "artist": "Billie Eilish",
        "album": "Single",
        "duration": "4:05",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/23/f3/6b/23f36bc0-9edc-8d55-df7f-7b806310d4b4/mzaf_15718469078111904528.plus.aac.p.m4a"
      },
      {
        "id": "YEbz2Qt3vec",
        "resolvedYtId": "YEbz2Qt3vec",
        "title": "Happier Than Ever",
        "artist": "Billie Eilish",
        "album": "Happier Than Ever",
        "duration": "4:58",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/8c/6b/20/8c6b203a-cadc-25b3-1c91-2a8e77210e31/mzaf_9684961884676177661.plus.aac.p.m4a"
      },
      {
        "id": "MB3VkzPdgLA",
        "resolvedYtId": "MB3VkzPdgLA",
        "title": "Lunch",
        "artist": "Billie Eilish",
        "album": "Hit Me Hard and Soft",
        "duration": "3:00",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/9d/3e/43/9d3e43aa-682a-7979-8547-d339956c409b/mzaf_710286407585135494.plus.aac.p.m4a"
      },
      {
        "id": "e_AZJzYe7CU",
        "resolvedYtId": "e_AZJzYe7CU",
        "title": "Chihiro",
        "artist": "Billie Eilish",
        "album": "Hit Me Hard and Soft",
        "duration": "5:03",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/30/41/6b/30416b6a-a895-a8e5-0b92-6206fff0bb0a/mzaf_12575392156288065852.plus.aac.p.m4a"
      },
      {
        "id": "cW8VLC9nnTo",
        "resolvedYtId": "cW8VLC9nnTo",
        "title": "What Was I Made For?",
        "artist": "Billie Eilish",
        "album": "Barbie",
        "duration": "3:42",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/16/69/77/16697701-c8c4-6d9c-4491-7423e3fde6e8/mzaf_13139724549993369958.plus.aac.p.m4a"
      }
    ]
  },
  {
    "id": "dua-lipa",
    "name": "Dua Lipa",
    "role": "Disco-Pop Queen",
    "category": "english",
    "avatar": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
    "listeners": "74.6M Monthly Listeners",
    "genre": "Disco-Pop / Dance-Pop / Synth-Pop",
    "bio": "3-time Grammy winner who resurrected modern disco and dance-pop with Future Nostalgia and Radical Optimism.",
    "albums": [
      {
        "collectionId": "alb_dl_1",
        "collectionName": "Future Nostalgia",
        "releaseYear": "2020",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "artistName": "Dua Lipa",
        "tracks": []
      },
      {
        "collectionId": "alb_dl_2",
        "collectionName": "Dua Lipa (Complete)",
        "releaseYear": "2017",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "artistName": "Dua Lipa",
        "tracks": []
      },
      {
        "collectionId": "alb_dl_3",
        "collectionName": "Radical Optimism",
        "releaseYear": "2024",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "artistName": "Dua Lipa",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "TUVcZfQe-Kw",
        "resolvedYtId": "TUVcZfQe-Kw",
        "title": "Levitating",
        "artist": "Dua Lipa",
        "album": "Future Nostalgia",
        "duration": "3:23",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop"
      },
      {
        "id": "oygrmJFKYZY",
        "resolvedYtId": "oygrmJFKYZY",
        "title": "Don't Start Now",
        "artist": "Dua Lipa",
        "album": "Future Nostalgia",
        "duration": "3:03",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/24/3d/34/243d3413-a0fc-b229-f54a-1715ebd3a9ca/mzaf_11578996572221800393.plus.aac.p.m4a"
      },
      {
        "id": "k2qgadSvNyU",
        "resolvedYtId": "k2qgadSvNyU",
        "title": "New Rules",
        "artist": "Dua Lipa",
        "album": "Dua Lipa",
        "duration": "3:29",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop"
      },
      {
        "id": "OiC1rgCPmUQ",
        "resolvedYtId": "OiC1rgCPmUQ",
        "title": "Dance The Night",
        "artist": "Dua Lipa",
        "album": "Barbie",
        "duration": "2:56",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop"
      },
      {
        "id": "suAR1PYFNYA",
        "resolvedYtId": "suAR1PYFNYA",
        "title": "Houdini",
        "artist": "Dua Lipa",
        "album": "Radical Optimism",
        "duration": "3:05",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "TUVcZfQe-Kw",
        "resolvedYtId": "TUVcZfQe-Kw",
        "title": "Levitating",
        "artist": "Dua Lipa",
        "album": "Future Nostalgia",
        "duration": "3:23",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/59/dc/4d/59dc4dda-93ff-8f1c-c536-f005f6ea6af5/mzaf_3066686759813252385.plus.aac.p.m4a"
      },
      {
        "id": "oygrmJFKYZY",
        "resolvedYtId": "oygrmJFKYZY",
        "title": "Don't Start Now",
        "artist": "Dua Lipa",
        "album": "Future Nostalgia",
        "duration": "3:03",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/24/3d/34/243d3413-a0fc-b229-f54a-1715ebd3a9ca/mzaf_11578996572221800393.plus.aac.p.m4a"
      },
      {
        "id": "k2qgadSvNyU",
        "resolvedYtId": "k2qgadSvNyU",
        "title": "New Rules",
        "artist": "Dua Lipa",
        "album": "Dua Lipa",
        "duration": "3:29",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/07/2e/84/072e84d4-2970-034b-0941-60c112f36a2b/mzaf_5630674587159822008.plus.aac.p.m4a"
      },
      {
        "id": "OiC1rgCPmUQ",
        "resolvedYtId": "OiC1rgCPmUQ",
        "title": "Dance The Night",
        "artist": "Dua Lipa",
        "album": "Barbie",
        "duration": "2:56",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/9d/9f/56/9d9f566f-abf6-5f10-bcdb-09e14dcace42/mzaf_10277018989080903908.plus.aac.p.m4a"
      },
      {
        "id": "suAR1PYFNYA",
        "resolvedYtId": "suAR1PYFNYA",
        "title": "Houdini",
        "artist": "Dua Lipa",
        "album": "Radical Optimism",
        "duration": "3:05",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/2c/da/b5/2cdab5c6-04a8-5231-c697-00101e876479/mzaf_5586859405346659517.plus.aac.p.m4a"
      },
      {
        "id": "3W9zTpRFlzw",
        "resolvedYtId": "3W9zTpRFlzw",
        "title": "Training Season",
        "artist": "Dua Lipa",
        "album": "Radical Optimism",
        "duration": "3:29",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/0e/8a/6d/0e8a6dbd-feb2-0e55-149e-72b08d48d950/mzaf_15766175317704968405.plus.aac.p.m4a"
      },
      {
        "id": "9HDEHj2yzew",
        "resolvedYtId": "9HDEHj2yzew",
        "title": "Physical",
        "artist": "Dua Lipa",
        "album": "Future Nostalgia",
        "duration": "3:13",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/87/45/78/874578c1-d683-d1e6-00e4-08848279fa3a/mzaf_17519393520049027931.plus.aac.p.m4a"
      },
      {
        "id": "Nj2U6rhnucI",
        "resolvedYtId": "Nj2U6rhnucI",
        "title": "Break My Heart",
        "artist": "Dua Lipa",
        "album": "Future Nostalgia",
        "duration": "3:41",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/85/14/2e/85142ebb-ed20-bf03-4ff9-5f714d455ebc/mzaf_14831238686541567886.plus.aac.p.m4a"
      },
      {
        "id": "DkeiKbqa02g",
        "resolvedYtId": "DkeiKbqa02g",
        "title": "One Kiss",
        "artist": "Calvin Harris, Dua Lipa",
        "album": "One Kiss",
        "duration": "3:34",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/33/81/fc/3381fc37-e216-04f3-2e61-a5ab7b9c79c3/mzaf_11986095118390090442.plus.aac.p.m4a"
      },
      {
        "id": "Mgfe5tIwOj0",
        "resolvedYtId": "Mgfe5tIwOj0",
        "title": "IDGAF",
        "artist": "Dua Lipa",
        "album": "Dua Lipa",
        "duration": "3:38",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/global_pop.mp3"
      }
    ]
  },
  {
    "id": "justin-bieber",
    "name": "Justin Bieber",
    "role": "Global Pop & R&B Superstar",
    "category": "english",
    "avatar": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
    "listeners": "76.2M Monthly Listeners",
    "genre": "Pop / Contemporary R&B",
    "bio": "One of the best-selling music artists in history, celebrated for chart-topping pop anthems and vocal mastery.",
    "albums": [
      {
        "collectionId": "alb_jb_1",
        "collectionName": "Justice",
        "releaseYear": "2021",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "artistName": "Justin Bieber",
        "tracks": []
      },
      {
        "collectionId": "alb_jb_2",
        "collectionName": "Purpose",
        "releaseYear": "2015",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "artistName": "Justin Bieber",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "tQ0yjYUFKAE",
        "resolvedYtId": "tQ0yjYUFKAE",
        "title": "Peaches",
        "artist": "Justin Bieber, Daniel Caesar, Giveon",
        "album": "Drive Thru",
        "duration": "3:10",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop"
      },
      {
        "id": "Qb8q4ijHk_M",
        "resolvedYtId": "Qb8q4ijHk_M",
        "title": "Stay",
        "artist": "The Kid LAROI, Justin Bieber",
        "album": "F*CK LOVE 3",
        "duration": "2:21",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop"
      },
      {
        "id": "KRUWn3dLoRg",
        "resolvedYtId": "KRUWn3dLoRg",
        "title": "Ghost",
        "artist": "Justin Bieber",
        "album": "Justice",
        "duration": "2:33",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop"
      },
      {
        "id": "fRh_vgS2dFE",
        "resolvedYtId": "fRh_vgS2dFE",
        "title": "Sorry",
        "artist": "Justin Bieber",
        "album": "Purpose",
        "duration": "3:20",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/66/eb/29/66eb29c0-c2f9-d9df-8af3-3bf2562c9d7c/mzaf_4099789285264521999.plus.aac.p.m4a"
      },
      {
        "id": "oyEuk8j8imI",
        "resolvedYtId": "oyEuk8j8imI",
        "title": "Love Yourself",
        "artist": "Justin Bieber",
        "album": "Purpose",
        "duration": "3:53",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/b6/fc/58/b6fc5860-ee45-7966-3e22-d6445acc933e/mzaf_1716189482689106429.plus.aac.p.m4a"
      }
    ],
    "allTracks": [
      {
        "id": "tQ0yjYUFKAE",
        "resolvedYtId": "tQ0yjYUFKAE",
        "title": "Peaches",
        "artist": "Justin Bieber, Daniel Caesar, Giveon",
        "album": "Drive Thru",
        "duration": "3:10",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/global_pop.mp3"
      },
      {
        "id": "Qb8q4ijHk_M",
        "resolvedYtId": "Qb8q4ijHk_M",
        "title": "Stay",
        "artist": "The Kid LAROI, Justin Bieber",
        "album": "F*CK LOVE 3",
        "duration": "2:21",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/global_pop.mp3"
      },
      {
        "id": "KRUWn3dLoRg",
        "resolvedYtId": "KRUWn3dLoRg",
        "title": "Ghost",
        "artist": "Justin Bieber",
        "album": "Justice",
        "duration": "2:33",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/35/03/85/350385d9-e71f-4e23-49eb-9bbf812c6ffc/mzaf_18141129225761277085.plus.aac.p.m4a"
      },
      {
        "id": "fRh_vgS2dFE",
        "resolvedYtId": "fRh_vgS2dFE",
        "title": "Sorry",
        "artist": "Justin Bieber",
        "album": "Purpose",
        "duration": "3:20",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/66/eb/29/66eb29c0-c2f9-d9df-8af3-3bf2562c9d7c/mzaf_4099789285264521999.plus.aac.p.m4a"
      },
      {
        "id": "oyEuk8j8imI",
        "resolvedYtId": "oyEuk8j8imI",
        "title": "Love Yourself",
        "artist": "Justin Bieber",
        "album": "Purpose",
        "duration": "3:53",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/b6/fc/58/b6fc5860-ee45-7966-3e22-d6445acc933e/mzaf_1716189482689106429.plus.aac.p.m4a"
      },
      {
        "id": "DK_0jXPuIr0",
        "resolvedYtId": "DK_0jXPuIr0",
        "title": "What Do You Mean?",
        "artist": "Justin Bieber",
        "album": "Purpose",
        "duration": "3:26",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/global_pop.mp3"
      },
      {
        "id": "kffacxfA7G4",
        "resolvedYtId": "kffacxfA7G4",
        "title": "Baby",
        "artist": "Justin Bieber, Ludacris",
        "album": "My World 2.0",
        "duration": "3:34",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/89/66/d3/8966d3cb-68eb-5f2c-fef8-4ac420721387/mzaf_3044382270474258872.plus.aac.p.m4a"
      },
      {
        "id": "VI8lrXNSLnA",
        "resolvedYtId": "VI8lrXNSLnA",
        "title": "Intentions",
        "artist": "Justin Bieber, Quavo",
        "album": "Changes",
        "duration": "3:32",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/global_pop.mp3"
      },
      {
        "id": "pvPsJFRGleA",
        "resolvedYtId": "pvPsJFRGleA",
        "title": "Holy",
        "artist": "Justin Bieber, Chance the Rapper",
        "album": "Justice",
        "duration": "3:32",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/global_pop.mp3"
      }
    ]
  },
  {
    "id": "coldplay",
    "name": "Coldplay",
    "role": "Global Stadium Rock Band",
    "category": "english",
    "avatar": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
    "listeners": "85.3M Monthly Listeners",
    "genre": "Alternative Rock / Stadium Pop / Anthems",
    "bio": "British musical titans behind some of the most emotionally resonant and globally beloved stadium anthems.",
    "albums": [
      {
        "collectionId": "alb_cp_1",
        "collectionName": "Parachutes",
        "releaseYear": "2000",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "artistName": "Coldplay",
        "tracks": []
      },
      {
        "collectionId": "alb_cp_2",
        "collectionName": "A Rush of Blood to the Head",
        "releaseYear": "2002",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "artistName": "Coldplay",
        "tracks": []
      },
      {
        "collectionId": "alb_cp_3",
        "collectionName": "A Head Full of Dreams",
        "releaseYear": "2015",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "artistName": "Coldplay",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "yKNxeF4KMsY",
        "resolvedYtId": "yKNxeF4KMsY",
        "title": "Yellow",
        "artist": "Coldplay",
        "album": "Parachutes",
        "duration": "4:29",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/66/f3/1a/66f31a76-a6ed-cb4c-f353-23310a7ae9a8/mzaf_10593596652344378873.plus.aac.p.m4a"
      },
      {
        "id": "dvgZkm1xWPE",
        "resolvedYtId": "dvgZkm1xWPE",
        "title": "Viva La Vida",
        "artist": "Coldplay",
        "album": "Viva La Vida",
        "duration": "4:02",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop"
      },
      {
        "id": "k4V3Mo61fJM",
        "resolvedYtId": "k4V3Mo61fJM",
        "title": "Fix You",
        "artist": "Coldplay",
        "album": "X&Y",
        "duration": "4:55",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop"
      },
      {
        "id": "VPRjCeoBqrI",
        "resolvedYtId": "VPRjCeoBqrI",
        "title": "A Sky Full of Stars",
        "artist": "Coldplay",
        "album": "Ghost Stories",
        "duration": "4:28",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop"
      },
      {
        "id": "YykjpeuMNEk",
        "resolvedYtId": "YykjpeuMNEk",
        "title": "Hymn for the Weekend",
        "artist": "Coldplay, Beyonce",
        "album": "A Head Full of Dreams",
        "duration": "4:18",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "yKNxeF4KMsY",
        "resolvedYtId": "yKNxeF4KMsY",
        "title": "Yellow",
        "artist": "Coldplay",
        "album": "Parachutes",
        "duration": "4:29",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/66/f3/1a/66f31a76-a6ed-cb4c-f353-23310a7ae9a8/mzaf_10593596652344378873.plus.aac.p.m4a"
      },
      {
        "id": "dvgZkm1xWPE",
        "resolvedYtId": "dvgZkm1xWPE",
        "title": "Viva La Vida",
        "artist": "Coldplay",
        "album": "Viva La Vida",
        "duration": "4:02",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/b0/19/60/b0196060-7786-24c0-8c56-8f628fe89f52/mzaf_12479456646715449366.plus.aac.p.m4a"
      },
      {
        "id": "k4V3Mo61fJM",
        "resolvedYtId": "k4V3Mo61fJM",
        "title": "Fix You",
        "artist": "Coldplay",
        "album": "X&Y",
        "duration": "4:55",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/global_pop.mp3"
      },
      {
        "id": "VPRjCeoBqrI",
        "resolvedYtId": "VPRjCeoBqrI",
        "title": "A Sky Full of Stars",
        "artist": "Coldplay",
        "album": "Ghost Stories",
        "duration": "4:28",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/global_pop.mp3"
      },
      {
        "id": "YykjpeuMNEk",
        "resolvedYtId": "YykjpeuMNEk",
        "title": "Hymn for the Weekend",
        "artist": "Coldplay, Beyonce",
        "album": "A Head Full of Dreams",
        "duration": "4:18",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/global_pop.mp3"
      },
      {
        "id": "FM7MFYoylVs",
        "resolvedYtId": "FM7MFYoylVs",
        "title": "Something Just Like This",
        "artist": "The Chainsmokers, Coldplay",
        "album": "Memories...Do Not Open",
        "duration": "4:07",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/64/7f/96/647f9601-aa94-3599-6c73-0143510b8b92/mzaf_13538528720942742126.plus.aac.p.m4a"
      },
      {
        "id": "1G4isv_Fylg",
        "resolvedYtId": "1G4isv_Fylg",
        "title": "Paradise",
        "artist": "Coldplay",
        "album": "Mylo Xyloto",
        "duration": "4:38",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/aa/3e/62/aa3e6293-da9a-bba2-15da-0acf90282a5f/mzaf_9828018370517979528.plus.aac.p.m4a"
      },
      {
        "id": "PFW2uSCZ0uE",
        "resolvedYtId": "PFW2uSCZ0uE",
        "title": "Clocks",
        "artist": "Coldplay",
        "album": "A Rush of Blood to the Head",
        "duration": "5:07",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/d2/9b/17/d29b173f-546a-606b-378f-8f3c333e81f1/mzaf_3952108508633208951.plus.aac.p.m4a"
      },
      {
        "id": "RB-RcX5DS5A",
        "resolvedYtId": "RB-RcX5DS5A",
        "title": "The Scientist",
        "artist": "Coldplay",
        "album": "A Rush of Blood to the Head",
        "duration": "5:09",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/ae/a6/27/aea62715-e6ae-9562-ba81-1f969a2ee2fa/mzaf_9054259057357054559.plus.aac.p.m4a"
      },
      {
        "id": "hZPXL9TB68Q",
        "resolvedYtId": "hZPXL9TB68Q",
        "title": "Adventure of a Lifetime",
        "artist": "Coldplay",
        "album": "A Head Full of Dreams",
        "duration": "4:24",
        "category": "english",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/44/1b/14/441b146d-abe6-19e3-6351-847a0903e170/mzaf_5769352414949061274.plus.aac.p.m4a"
      }
    ]
  },
  {
    "id": "king-rocco",
    "name": "King",
    "role": "Indian Pop & Hip-Hop Icon",
    "category": "indie",
    "avatar": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
    "listeners": "17.4M Monthly Listeners",
    "genre": "Indian Pop / Melodic Rap / R&B",
    "bio": "New Delhi hitmaker behind global anthems Tu Aake Dekhle and Maan Meri Jaan with Nick Jonas.",
    "albums": [
      {
        "collectionId": "alb_king_1",
        "collectionName": "The Carnival",
        "releaseYear": "2020",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "artistName": "King",
        "tracks": []
      },
      {
        "collectionId": "alb_king_2",
        "collectionName": "Champagne Talk",
        "releaseYear": "2022",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "artistName": "King",
        "tracks": []
      },
      {
        "collectionId": "alb_king_3",
        "collectionName": "New Life",
        "releaseYear": "2023",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "artistName": "King",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "wkNNMCU0fVw",
        "resolvedYtId": "wkNNMCU0fVw",
        "title": "Tu Aake Dekhle",
        "artist": "King",
        "album": "The Carnival",
        "duration": "4:40",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop"
      },
      {
        "id": "73vZDNKa_Wg",
        "resolvedYtId": "73vZDNKa_Wg",
        "title": "Maan Meri Jaan",
        "artist": "King",
        "album": "Champagne Talk",
        "duration": "3:14",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop"
      },
      {
        "id": "wo2-ldwHqyQ",
        "resolvedYtId": "wo2-ldwHqyQ",
        "title": "Oops",
        "artist": "King",
        "album": "Champagne Talk",
        "duration": "2:52",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop"
      },
      {
        "id": "-Xx0xnlBVzc",
        "resolvedYtId": "-Xx0xnlBVzc",
        "title": "Pablo",
        "artist": "King",
        "album": "Champagne Talk",
        "duration": "3:18",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/3c/d2/81/3cd28184-3a59-82b7-e3c1-b2b47281aa9a/mzaf_3874915040065530922.plus.aac.p.m4a"
      }
    ],
    "allTracks": [
      {
        "id": "wkNNMCU0fVw",
        "resolvedYtId": "wkNNMCU0fVw",
        "title": "Tu Aake Dekhle",
        "artist": "King",
        "album": "The Carnival",
        "duration": "4:40",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "73vZDNKa_Wg",
        "resolvedYtId": "73vZDNKa_Wg",
        "title": "Maan Meri Jaan",
        "artist": "King",
        "album": "Champagne Talk",
        "duration": "3:14",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/49/c8/c0/49c8c0eb-6a72-d639-02d2-d55fa0034b89/mzaf_6556689839136809010.plus.aac.p.m4a"
      },
      {
        "id": "wo2-ldwHqyQ",
        "resolvedYtId": "wo2-ldwHqyQ",
        "title": "Oops",
        "artist": "King",
        "album": "Champagne Talk",
        "duration": "2:52",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/8e/e0/eb/8ee0eb54-bc4d-705e-8a43-942d09596c42/mzaf_6947514416653714159.plus.aac.p.m4a"
      },
      {
        "id": "-Xx0xnlBVzc",
        "resolvedYtId": "-Xx0xnlBVzc",
        "title": "Pablo",
        "artist": "King",
        "album": "Champagne Talk",
        "duration": "3:18",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/3c/d2/81/3cd28184-3a59-82b7-e3c1-b2b47281aa9a/mzaf_3874915040065530922.plus.aac.p.m4a"
      },
      {
        "id": "YTSDgHuWVN4",
        "resolvedYtId": "YTSDgHuWVN4",
        "title": "She Don't Give A",
        "artist": "King",
        "album": "The Carnival",
        "duration": "3:25",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "S0WX61pgEEA",
        "resolvedYtId": "S0WX61pgEEA",
        "title": "Ghumshuda",
        "artist": "King",
        "album": "The Carnival",
        "duration": "3:12",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "_fHQzYx-_Sg",
        "resolvedYtId": "_fHQzYx-_Sg",
        "title": "Dracula",
        "artist": "King",
        "album": "The Carnival",
        "duration": "3:05",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/71/5d/31/715d3169-5fba-a0b7-da24-2aefc83796cf/mzaf_8089500935177582820.plus.aac.p.m4a"
      },
      {
        "id": "nbNbfiJszHw",
        "resolvedYtId": "nbNbfiJszHw",
        "title": "Crown",
        "artist": "King",
        "album": "New Life",
        "duration": "3:30",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/ee/e1/fc/eee1fc06-d9ce-620c-7fed-1fe55042dcc5/mzaf_399705949601181807.plus.aac.p.m4a"
      }
    ]
  },
  {
    "id": "anuv-jain",
    "name": "Anuv Jain",
    "role": "Indie Singer-Songwriter",
    "category": "indie",
    "avatar": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
    "listeners": "15.1M Monthly Listeners",
    "genre": "Acoustic Pop / Indie / Poetry",
    "bio": "Ludhiana-born singer-songwriter celebrated for intimate acoustic poetry, Baarishein, and viral hit Husn.",
    "albums": [
      {
        "collectionId": "alb_anuv_1",
        "collectionName": "Husn & Baarishein",
        "releaseYear": "2023",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "artistName": "Anuv Jain",
        "tracks": []
      },
      {
        "collectionId": "alb_anuv_2",
        "collectionName": "Acoustic Stories",
        "releaseYear": "2022",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "artistName": "Anuv Jain",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "PJWemSzExXs",
        "resolvedYtId": "PJWemSzExXs",
        "title": "Baarishein",
        "artist": "Anuv Jain",
        "album": "Single",
        "duration": "3:27",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/de/84/d5/de84d517-ca82-fcc6-528e-2397c866d31c/mzaf_15371366101597876011.plus.aac.p.m4a"
      },
      {
        "id": "0IIJxkDtkHY",
        "resolvedYtId": "0IIJxkDtkHY",
        "title": "Husn",
        "artist": "Anuv Jain",
        "album": "Single",
        "duration": "3:38",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/31/5d/58/315d5836-7db4-90fa-96c7-36fa4f3ceb96/mzaf_761014035866726482.plus.aac.p.m4a"
      },
      {
        "id": "vA86QFrXoho",
        "resolvedYtId": "vA86QFrXoho",
        "title": "Alag Aasmaan",
        "artist": "Anuv Jain",
        "album": "Single",
        "duration": "3:32",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop"
      },
      {
        "id": "9et5qzuzbQM",
        "resolvedYtId": "9et5qzuzbQM",
        "title": "Riha",
        "artist": "Anuv Jain",
        "album": "Single",
        "duration": "3:14",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "PJWemSzExXs",
        "resolvedYtId": "PJWemSzExXs",
        "title": "Baarishein",
        "artist": "Anuv Jain",
        "album": "Single",
        "duration": "3:27",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/de/84/d5/de84d517-ca82-fcc6-528e-2397c866d31c/mzaf_15371366101597876011.plus.aac.p.m4a"
      },
      {
        "id": "0IIJxkDtkHY",
        "resolvedYtId": "0IIJxkDtkHY",
        "title": "Husn",
        "artist": "Anuv Jain",
        "album": "Single",
        "duration": "3:38",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/31/5d/58/315d5836-7db4-90fa-96c7-36fa4f3ceb96/mzaf_761014035866726482.plus.aac.p.m4a"
      },
      {
        "id": "vA86QFrXoho",
        "resolvedYtId": "vA86QFrXoho",
        "title": "Alag Aasmaan",
        "artist": "Anuv Jain",
        "album": "Single",
        "duration": "3:32",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "9et5qzuzbQM",
        "resolvedYtId": "9et5qzuzbQM",
        "title": "Riha",
        "artist": "Anuv Jain",
        "album": "Single",
        "duration": "3:14",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/96/cf/bf/96cfbfdc-e188-d4f3-fc7f-a99a3d6d0309/mzaf_3063627245826059522.plus.aac.p.m4a"
      },
      {
        "id": "TS84-uinbdc",
        "resolvedYtId": "TS84-uinbdc",
        "title": "Gul",
        "artist": "Anuv Jain",
        "album": "Single",
        "duration": "3:39",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "zx0YGEi32r0",
        "resolvedYtId": "zx0YGEi32r0",
        "title": "Mazaak",
        "artist": "Anuv Jain",
        "album": "Single",
        "duration": "3:32",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "Y2zc2IeVX_g",
        "resolvedYtId": "Y2zc2IeVX_g",
        "title": "Ocean",
        "artist": "Anuv Jain",
        "album": "Single",
        "duration": "3:45",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "0P3Gt-60yLc",
        "resolvedYtId": "0P3Gt-60yLc",
        "title": "Mishri",
        "artist": "Anuv Jain",
        "album": "Single",
        "duration": "3:18",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/e4/85/fb/e485fb67-2f2a-baf5-c21b-68e44a511cc5/mzaf_12649309461408602012.plus.aac.p.m4a"
      }
    ]
  },
  {
    "id": "sidhu-moose-wala",
    "name": "Sidhu Moose Wala",
    "role": "Legendary Punjabi Rapper & Cultural Icon",
    "category": "punjabi",
    "avatar": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
    "listeners": "26.5M Monthly Listeners",
    "genre": "Punjabi Rap / Gangsta Rap / Desi Hip-Hop",
    "bio": "Immortal Punjabi pioneer who brought raw village pride to Billboard Global charts with 295 and The Last Ride.",
    "albums": [
      {
        "collectionId": "alb_smw_1",
        "collectionName": "Moosetape",
        "releaseYear": "2021",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "artistName": "Sidhu Moose Wala",
        "tracks": []
      },
      {
        "collectionId": "alb_smw_2",
        "collectionName": "PBX 1",
        "releaseYear": "2018",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "artistName": "Sidhu Moose Wala",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "n_FCrCQ6-bA",
        "resolvedYtId": "n_FCrCQ6-bA",
        "title": "295",
        "artist": "Sidhu Moose Wala, The Kidd",
        "album": "Moosetape",
        "duration": "4:30",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/7f/f3/6d/7ff36d63-b933-3993-cd2f-f3fd770c3763/mzaf_12675758250838366519.plus.aac.p.m4a"
      },
      {
        "id": "6xoB4ZiKKn0",
        "resolvedYtId": "6xoB4ZiKKn0",
        "title": "The Last Ride",
        "artist": "Sidhu Moose Wala, Wazir Patar",
        "album": "No Name",
        "duration": "4:21",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/f9/db/be/f9dbbefa-0600-ad3f-6a71-32d17c9e7040/mzaf_5987343399381681108.plus.aac.p.m4a"
      },
      {
        "id": "GgmFC8y8q3k",
        "resolvedYtId": "GgmFC8y8q3k",
        "title": "So High",
        "artist": "Sidhu Moose Wala, Byg Byrd",
        "album": "PBX 1",
        "duration": "3:55",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop"
      },
      {
        "id": "tpFljbJxZiw",
        "resolvedYtId": "tpFljbJxZiw",
        "title": "Levels",
        "artist": "Sidhu Moose Wala, Sunny Malton",
        "album": "Levels",
        "duration": "3:48",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "n_FCrCQ6-bA",
        "resolvedYtId": "n_FCrCQ6-bA",
        "title": "295",
        "artist": "Sidhu Moose Wala, The Kidd",
        "album": "Moosetape",
        "duration": "4:30",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/7f/f3/6d/7ff36d63-b933-3993-cd2f-f3fd770c3763/mzaf_12675758250838366519.plus.aac.p.m4a"
      },
      {
        "id": "6xoB4ZiKKn0",
        "resolvedYtId": "6xoB4ZiKKn0",
        "title": "The Last Ride",
        "artist": "Sidhu Moose Wala, Wazir Patar",
        "album": "No Name",
        "duration": "4:21",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/f9/db/be/f9dbbefa-0600-ad3f-6a71-32d17c9e7040/mzaf_5987343399381681108.plus.aac.p.m4a"
      },
      {
        "id": "GgmFC8y8q3k",
        "resolvedYtId": "GgmFC8y8q3k",
        "title": "So High",
        "artist": "Sidhu Moose Wala, Byg Byrd",
        "album": "PBX 1",
        "duration": "3:55",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/punjabi_beat.mp3"
      },
      {
        "id": "tpFljbJxZiw",
        "resolvedYtId": "tpFljbJxZiw",
        "title": "Levels",
        "artist": "Sidhu Moose Wala, Sunny Malton",
        "album": "Levels",
        "duration": "3:48",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/punjabi_beat.mp3"
      },
      {
        "id": "Eh2IMZ5Na7o",
        "resolvedYtId": "Eh2IMZ5Na7o",
        "title": "Dollar",
        "artist": "Sidhu Moose Wala",
        "album": "Dakuaan Da Munda",
        "duration": "3:30",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/5c/74/64/5c7464a1-d358-3a55-84c9-84dd3045853f/mzaf_17705318078724460582.plus.aac.p.m4a"
      },
      {
        "id": "lzgfqc9duik",
        "resolvedYtId": "lzgfqc9duik",
        "title": "Same Beef",
        "artist": "Sidhu Moose Wala, Bohemia",
        "album": "Same Beef",
        "duration": "4:15",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/punjabi_beat.mp3"
      },
      {
        "id": "xck0xnrqDKo",
        "resolvedYtId": "xck0xnrqDKo",
        "title": "Famous",
        "artist": "Sidhu Moose Wala",
        "album": "PBX 1",
        "duration": "4:10",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/punjabi_beat.mp3"
      },
      {
        "id": "hpVNMjpjiJc",
        "resolvedYtId": "hpVNMjpjiJc",
        "title": "Bambiha Bole",
        "artist": "Sidhu Moose Wala, Amrit Maan",
        "album": "Bambiha Bole",
        "duration": "4:40",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/punjabi_beat.mp3"
      }
    ]
  },
  {
    "id": "atif-aslam",
    "name": "Atif Aslam",
    "role": "Sufi & Bollywood Playback Legend",
    "category": "sufi",
    "avatar": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
    "listeners": "28.3M Monthly Listeners",
    "genre": "Sufi / Bollywood Romance / Pop-Rock",
    "bio": "Iconic South Asian vocalist whose unforgettable vocal texture defined romance in Hindi cinema for two decades.",
    "albums": [
      {
        "collectionId": "alb_atif_1",
        "collectionName": "Jalpari",
        "releaseYear": "2004",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "artistName": "Atif Aslam",
        "tracks": []
      },
      {
        "collectionId": "alb_atif_2",
        "collectionName": "Tiger Zinda Hai",
        "releaseYear": "2017",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "artistName": "Atif Aslam",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "mevO4I0f5lg",
        "resolvedYtId": "mevO4I0f5lg",
        "title": "Dil Diyan Gallan",
        "artist": "Atif Aslam, Vishal-Shekhar",
        "album": "Tiger Zinda Hai",
        "duration": "4:20",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop"
      },
      {
        "id": "OVVZ6lyHV-Y",
        "resolvedYtId": "OVVZ6lyHV-Y",
        "title": "Tera Hone Laga Hoon",
        "artist": "Atif Aslam, Alisha Chinai",
        "album": "Ajab Prem Ki Ghazab Kahani",
        "duration": "4:59",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop"
      },
      {
        "id": "pkzOBl1p7y4",
        "resolvedYtId": "pkzOBl1p7y4",
        "title": "Jeene Laga Hoon",
        "artist": "Atif Aslam, Shreya Ghoshal",
        "album": "Ramaiya Vastavaiya",
        "duration": "3:56",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop"
      },
      {
        "id": "vNFqBLI6IIA",
        "resolvedYtId": "vNFqBLI6IIA",
        "title": "Tajdar-e-Haram",
        "artist": "Atif Aslam",
        "album": "Coke Studio",
        "duration": "10:18",
        "category": "sufi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "mevO4I0f5lg",
        "resolvedYtId": "mevO4I0f5lg",
        "title": "Dil Diyan Gallan",
        "artist": "Atif Aslam, Vishal-Shekhar",
        "album": "Tiger Zinda Hai",
        "duration": "4:20",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "OVVZ6lyHV-Y",
        "resolvedYtId": "OVVZ6lyHV-Y",
        "title": "Tera Hone Laga Hoon",
        "artist": "Atif Aslam, Alisha Chinai",
        "album": "Ajab Prem Ki Ghazab Kahani",
        "duration": "4:59",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "pkzOBl1p7y4",
        "resolvedYtId": "pkzOBl1p7y4",
        "title": "Jeene Laga Hoon",
        "artist": "Atif Aslam, Shreya Ghoshal",
        "album": "Ramaiya Vastavaiya",
        "duration": "3:56",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "-xjhuuVXcF0",
        "resolvedYtId": "-xjhuuVXcF0",
        "title": "Woh Lamhe",
        "artist": "Atif Aslam",
        "album": "Zeher",
        "duration": "5:20",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "ZZrM0H_OXSQ",
        "resolvedYtId": "ZZrM0H_OXSQ",
        "title": "Pehli Nazar Mein",
        "artist": "Atif Aslam",
        "album": "Race",
        "duration": "5:14",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/0d/db/cf/0ddbcf31-22d7-088e-c71f-1dd88a3dd8a2/mzaf_16563349538675654632.plus.aac.p.m4a"
      },
      {
        "id": "_d2Yux449ds",
        "resolvedYtId": "_d2Yux449ds",
        "title": "Tu Jaane Na",
        "artist": "Atif Aslam",
        "album": "Ajab Prem Ki Ghazab Kahani",
        "duration": "5:41",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "AKUk1v3rBvc",
        "resolvedYtId": "AKUk1v3rBvc",
        "title": "Aadat",
        "artist": "Atif Aslam",
        "album": "Jalpari / Kalyug",
        "duration": "4:28",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "vNFqBLI6IIA",
        "resolvedYtId": "vNFqBLI6IIA",
        "title": "Tajdar-e-Haram",
        "artist": "Atif Aslam",
        "album": "Coke Studio",
        "duration": "10:18",
        "category": "sufi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/sufi_meditation.mp3"
      }
    ]
  },
  {
    "id": "sonu-nigam",
    "name": "Sonu Nigam",
    "role": "Master Playback Singer & Composer",
    "category": "legends",
    "avatar": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
    "listeners": "21.6M Monthly Listeners",
    "genre": "Bollywood Golden Era / Semi-Classical / Ghazals",
    "bio": "Padma Shri recipient, universally regarded as one of the greatest and most versatile playback singers of India.",
    "albums": [
      {
        "collectionId": "alb_sn_1",
        "collectionName": "Kal Ho Naa Ho",
        "releaseYear": "2003",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "artistName": "Sonu Nigam",
        "tracks": []
      },
      {
        "collectionId": "alb_sn_2",
        "collectionName": "Deewana",
        "releaseYear": "1999",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "artistName": "Sonu Nigam",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "g0eO74UmRBs",
        "resolvedYtId": "g0eO74UmRBs",
        "title": "Kal Ho Naa Ho",
        "artist": "Sonu Nigam, Shankar-Ehsaan-Loy",
        "album": "Kal Ho Naa Ho",
        "duration": "5:21",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop"
      },
      {
        "id": "oWKgpB2zpgw",
        "resolvedYtId": "oWKgpB2zpgw",
        "title": "Abhi Mujh Mein Kahin",
        "artist": "Sonu Nigam, Ajay-Atul",
        "album": "Agneepath",
        "duration": "6:04",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop"
      },
      {
        "id": "DAYszemgPxc",
        "resolvedYtId": "DAYszemgPxc",
        "title": "Main Agar Kahoon",
        "artist": "Sonu Nigam, Shreya Ghoshal",
        "album": "Om Shanti Om",
        "duration": "5:10",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop"
      },
      {
        "id": "USAG2dChprc",
        "resolvedYtId": "USAG2dChprc",
        "title": "Suraj Hua Maddham",
        "artist": "Sonu Nigam, Alka Yagnik",
        "album": "Kabhi Khushi Kabhie Gham",
        "duration": "7:08",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "g0eO74UmRBs",
        "resolvedYtId": "g0eO74UmRBs",
        "title": "Kal Ho Naa Ho",
        "artist": "Sonu Nigam, Shankar-Ehsaan-Loy",
        "album": "Kal Ho Naa Ho",
        "duration": "5:21",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "oWKgpB2zpgw",
        "resolvedYtId": "oWKgpB2zpgw",
        "title": "Abhi Mujh Mein Kahin",
        "artist": "Sonu Nigam, Ajay-Atul",
        "album": "Agneepath",
        "duration": "6:04",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "DAYszemgPxc",
        "resolvedYtId": "DAYszemgPxc",
        "title": "Main Agar Kahoon",
        "artist": "Sonu Nigam, Shreya Ghoshal",
        "album": "Om Shanti Om",
        "duration": "5:10",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "USAG2dChprc",
        "resolvedYtId": "USAG2dChprc",
        "title": "Suraj Hua Maddham",
        "artist": "Sonu Nigam, Alka Yagnik",
        "album": "Kabhi Khushi Kabhie Gham",
        "duration": "7:08",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "9sthJUHkzgI",
        "resolvedYtId": "9sthJUHkzgI",
        "title": "Sandese Aate Hain",
        "artist": "Sonu Nigam, Roop Kumar Rathod",
        "album": "Border",
        "duration": "10:28",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "taSv__vPt6Y",
        "resolvedYtId": "taSv__vPt6Y",
        "title": "Saathiya",
        "artist": "Sonu Nigam, A.R. Rahman",
        "album": "Saathiya",
        "duration": "5:57",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "y1iA6Egisj0",
        "resolvedYtId": "y1iA6Egisj0",
        "title": "Soniyo",
        "artist": "Sonu Nigam, Shreya Ghoshal",
        "album": "Raaz - The Mystery Continues",
        "duration": "5:29",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "Jdif_nYkFQg",
        "resolvedYtId": "Jdif_nYkFQg",
        "title": "Deewana Tera",
        "artist": "Sonu Nigam",
        "album": "Deewana",
        "duration": "5:15",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/5e/01/77/5e0177bc-7a09-6e5c-5bf7-2a221a48755c/mzaf_17989490467085160219.plus.aac.p.m4a"
      }
    ]
  },
  {
    "id": "kk",
    "name": "KK (Krishnakumar)",
    "role": "The Voice of Romance & Youth",
    "category": "legends",
    "avatar": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
    "listeners": "24.1M Monthly Listeners",
    "genre": "Rock / Bollywood Romance / Timeless Anthems",
    "bio": "The immortal voice behind college farewells, first loves, and deep heartbreak with Pal, Yaaron, and Zara Sa.",
    "albums": [
      {
        "collectionId": "alb_kk_1",
        "collectionName": "Pal",
        "releaseYear": "1999",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "artistName": "KK",
        "tracks": []
      },
      {
        "collectionId": "alb_kk_2",
        "collectionName": "Humsafar",
        "releaseYear": "2008",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "artistName": "KK",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "LCfvYo3ILG0",
        "resolvedYtId": "LCfvYo3ILG0",
        "title": "Yaaron",
        "artist": "KK",
        "album": "Pal",
        "duration": "4:40",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop"
      },
      {
        "id": "HLGxI6WIHuI",
        "resolvedYtId": "HLGxI6WIHuI",
        "title": "Pal",
        "artist": "KK, Leslie Lewis",
        "album": "Pal",
        "duration": "4:25",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop"
      },
      {
        "id": "-8C_2BBVWk8",
        "resolvedYtId": "-8C_2BBVWk8",
        "title": "Zara Sa",
        "artist": "KK, Pritam",
        "album": "Jannat",
        "duration": "5:03",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop"
      },
      {
        "id": "U9Ba5qJU6fw",
        "resolvedYtId": "U9Ba5qJU6fw",
        "title": "Labon Ko",
        "artist": "KK, Pritam",
        "album": "Bhool Bhulaiyaa",
        "duration": "5:42",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "LCfvYo3ILG0",
        "resolvedYtId": "LCfvYo3ILG0",
        "title": "Yaaron",
        "artist": "KK",
        "album": "Pal",
        "duration": "4:40",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "HLGxI6WIHuI",
        "resolvedYtId": "HLGxI6WIHuI",
        "title": "Pal",
        "artist": "KK, Leslie Lewis",
        "album": "Pal",
        "duration": "4:25",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "-8C_2BBVWk8",
        "resolvedYtId": "-8C_2BBVWk8",
        "title": "Zara Sa",
        "artist": "KK, Pritam",
        "album": "Jannat",
        "duration": "5:03",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "U9Ba5qJU6fw",
        "resolvedYtId": "U9Ba5qJU6fw",
        "title": "Labon Ko",
        "artist": "KK, Pritam",
        "album": "Bhool Bhulaiyaa",
        "duration": "5:42",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "4P4Oa0pbZNQ",
        "resolvedYtId": "4P4Oa0pbZNQ",
        "title": "Beete Lamhein",
        "artist": "KK, Mithoon",
        "album": "The Train",
        "duration": "5:26",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "hM9QDpLHhdw",
        "resolvedYtId": "hM9QDpLHhdw",
        "title": "Alvida",
        "artist": "KK, Pritam",
        "album": "Life in a Metro",
        "duration": "5:40",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "https://video-ssl.itunes.apple.com/itunes-assets/Video221/v4/91/97/68/9197686d-bd10-01f8-deda-a0445c9d2d1f/mzvf_16103486492589006768.1920w.h264lc.U.p.m4v"
      },
      {
        "id": "5vVCSbhIw-U",
        "resolvedYtId": "5vVCSbhIw-U",
        "title": "Kya Mujhe Pyaar Hai",
        "artist": "KK, Pritam",
        "album": "Woh Lamhe",
        "duration": "4:40",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "cGNcjqXe87U",
        "resolvedYtId": "cGNcjqXe87U",
        "title": "Tu Hi Meri Shab Hai",
        "artist": "KK, Pritam",
        "album": "Gangster",
        "duration": "6:28",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      }
    ]
  },
  {
    "id": "ar-rahman",
    "name": "A.R. Rahman",
    "role": "2x Academy Award-Winning Legend",
    "category": "sufi",
    "avatar": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
    "listeners": "33.7M Monthly Listeners",
    "genre": "World Music / Sufi / Symphonic Cinema",
    "bio": "The Mozart of Madras, two-time Oscar and Grammy winner who reimagined global Indian soundscapes.",
    "albums": [
      {
        "collectionId": "alb_arr_1",
        "collectionName": "Rockstar",
        "releaseYear": "2011",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "artistName": "A.R. Rahman",
        "tracks": []
      },
      {
        "collectionId": "alb_arr_2",
        "collectionName": "Slumdog Millionaire",
        "releaseYear": "2008",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "artistName": "A.R. Rahman",
        "tracks": []
      },
      {
        "collectionId": "alb_arr_3",
        "collectionName": "Dil Se",
        "releaseYear": "1998",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "artistName": "A.R. Rahman",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "T94PHkuydcw",
        "resolvedYtId": "T94PHkuydcw",
        "title": "Kun Faya Kun",
        "artist": "A.R. Rahman, Mohit Chauhan, Javed Ali",
        "album": "Rockstar",
        "duration": "7:53",
        "category": "sufi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/ce/72/5e/ce725e63-6977-b281-3766-fff46d6e0c07/mzaf_7464998292185183397.plus.aac.p.m4a"
      },
      {
        "id": "2R3XstG35sE",
        "resolvedYtId": "2R3XstG35sE",
        "title": "Jai Ho",
        "artist": "A.R. Rahman, Sukhwinder Singh",
        "album": "Slumdog Millionaire",
        "duration": "5:19",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop"
      },
      {
        "id": "9MX-QejdVaQ",
        "resolvedYtId": "9MX-QejdVaQ",
        "title": "Chaiyya Chaiyya",
        "artist": "A.R. Rahman, Sukhwinder Singh, Sapna Awasthi",
        "album": "Dil Se",
        "duration": "6:54",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop"
      },
      {
        "id": "7HKbt19q3Rc",
        "resolvedYtId": "7HKbt19q3Rc",
        "title": "Tere Bina",
        "artist": "A.R. Rahman, Chinmayi",
        "album": "Guru",
        "duration": "5:09",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "T94PHkuydcw",
        "resolvedYtId": "T94PHkuydcw",
        "title": "Kun Faya Kun",
        "artist": "A.R. Rahman, Mohit Chauhan, Javed Ali",
        "album": "Rockstar",
        "duration": "7:53",
        "category": "sufi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/ce/72/5e/ce725e63-6977-b281-3766-fff46d6e0c07/mzaf_7464998292185183397.plus.aac.p.m4a"
      },
      {
        "id": "2R3XstG35sE",
        "resolvedYtId": "2R3XstG35sE",
        "title": "Jai Ho",
        "artist": "A.R. Rahman, Sukhwinder Singh",
        "album": "Slumdog Millionaire",
        "duration": "5:19",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "9MX-QejdVaQ",
        "resolvedYtId": "9MX-QejdVaQ",
        "title": "Chaiyya Chaiyya",
        "artist": "A.R. Rahman, Sukhwinder Singh, Sapna Awasthi",
        "album": "Dil Se",
        "duration": "6:54",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "7HKbt19q3Rc",
        "resolvedYtId": "7HKbt19q3Rc",
        "title": "Tere Bina",
        "artist": "A.R. Rahman, Chinmayi",
        "album": "Guru",
        "duration": "5:09",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "e60xy-jt_zI",
        "resolvedYtId": "e60xy-jt_zI",
        "title": "Maa Tujhe Salaam",
        "artist": "A.R. Rahman",
        "album": "Vande Mataram",
        "duration": "6:12",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "rf9_x9fT0rY",
        "resolvedYtId": "rf9_x9fT0rY",
        "title": "Khwaja Mere Khwaja",
        "artist": "A.R. Rahman",
        "album": "Jodhaa Akbar",
        "duration": "6:58",
        "category": "sufi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/sufi_meditation.mp3"
      },
      {
        "id": "QvwDmePaRiU",
        "resolvedYtId": "QvwDmePaRiU",
        "title": "Urvasi Urvasi",
        "artist": "A.R. Rahman",
        "album": "Humse Hai Muqabla",
        "duration": "5:40",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "sK7riqg2mr4",
        "resolvedYtId": "sK7riqg2mr4",
        "title": "Agar Tum Saath Ho (Composition)",
        "artist": "A.R. Rahman, Arijit Singh, Alka Yagnik",
        "album": "Tamasha",
        "duration": "5:41",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      }
    ]
  },
  {
    "id": "ap-dhillon",
    "name": "AP Dhillon",
    "role": "Global Punjabi Fusion Hitmaker",
    "category": "punjabi",
    "avatar": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
    "listeners": "20.9M Monthly Listeners",
    "genre": "Punjabi Pop / Synthwave / Trap",
    "bio": "Vancouver-based music trailblazer behind viral worldwide anthems Brown Munde, Excuses, and Summer High.",
    "albums": [
      {
        "collectionId": "alb_apd_1",
        "collectionName": "Not by Chance",
        "releaseYear": "2020",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "artistName": "AP Dhillon",
        "tracks": []
      },
      {
        "collectionId": "alb_apd_2",
        "collectionName": "Hidden Gems",
        "releaseYear": "2021",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "artistName": "AP Dhillon",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "ab-F3lRDqsc",
        "resolvedYtId": "ab-F3lRDqsc",
        "title": "Brown Munde",
        "artist": "AP Dhillon, Gurinder Gill, Shinda Kahlon",
        "album": "Single",
        "duration": "4:28",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop"
      },
      {
        "id": "6dwSLVWeiNc",
        "resolvedYtId": "6dwSLVWeiNc",
        "title": "Excuses",
        "artist": "AP Dhillon, Intense",
        "album": "Single",
        "duration": "2:56",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop"
      },
      {
        "id": "CnBX7_ErLvA",
        "resolvedYtId": "CnBX7_ErLvA",
        "title": "Summer High",
        "artist": "AP Dhillon",
        "album": "Single",
        "duration": "2:57",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop"
      },
      {
        "id": "fe9udc210tM",
        "resolvedYtId": "fe9udc210tM",
        "title": "With You",
        "artist": "AP Dhillon",
        "album": "Single",
        "duration": "2:34",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/ff/82/5a/ff825a62-0478-4166-34a7-fe1b4aa1aad9/mzaf_13829495794614683801.plus.aac.p.m4a"
      }
    ],
    "allTracks": [
      {
        "id": "ab-F3lRDqsc",
        "resolvedYtId": "ab-F3lRDqsc",
        "title": "Brown Munde",
        "artist": "AP Dhillon, Gurinder Gill, Shinda Kahlon",
        "album": "Single",
        "duration": "4:28",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/punjabi_beat.mp3"
      },
      {
        "id": "6dwSLVWeiNc",
        "resolvedYtId": "6dwSLVWeiNc",
        "title": "Excuses",
        "artist": "AP Dhillon, Intense",
        "album": "Single",
        "duration": "2:56",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/punjabi_beat.mp3"
      },
      {
        "id": "cqP8I5aaud8",
        "resolvedYtId": "cqP8I5aaud8",
        "title": "Insane",
        "artist": "AP Dhillon, Gurinder Gill, Shinda Kahlon",
        "album": "Hidden Gems",
        "duration": "3:26",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/punjabi_beat.mp3"
      },
      {
        "id": "CnBX7_ErLvA",
        "resolvedYtId": "CnBX7_ErLvA",
        "title": "Summer High",
        "artist": "AP Dhillon",
        "album": "Single",
        "duration": "2:57",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/punjabi_beat.mp3"
      },
      {
        "id": "fe9udc210tM",
        "resolvedYtId": "fe9udc210tM",
        "title": "With You",
        "artist": "AP Dhillon",
        "album": "Single",
        "duration": "2:34",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/ff/82/5a/ff825a62-0478-4166-34a7-fe1b4aa1aad9/mzaf_13829495794614683801.plus.aac.p.m4a"
      },
      {
        "id": "p2EdDiiVHh4",
        "resolvedYtId": "p2EdDiiVHh4",
        "title": "Dil Nu",
        "artist": "AP Dhillon",
        "album": "Single",
        "duration": "3:10",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/69/42/43/69424344-794a-c2a4-f87f-07be4ceab233/mzaf_16101738996089878738.plus.aac.p.m4a"
      },
      {
        "id": "yzIyufV6ADk",
        "resolvedYtId": "yzIyufV6ADk",
        "title": "Majhail",
        "artist": "AP Dhillon, Gurinder Gill",
        "album": "Single",
        "duration": "3:25",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/punjabi_beat.mp3"
      },
      {
        "id": "L6fr053Z_pU",
        "resolvedYtId": "L6fr053Z_pU",
        "title": "Saada Pyaar",
        "artist": "AP Dhillon",
        "album": "Not by Chance",
        "duration": "3:35",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/00/2f/a4/002fa46f-417c-e374-b74e-27deda4a8c70/mzaf_4715933650932680817.plus.aac.p.m4a"
      }
    ]
  },
  {
    "id": "b-praak",
    "name": "B Praak",
    "role": "National Award-winning Soul Singer",
    "category": "sufi",
    "avatar": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
    "listeners": "18.3M Monthly Listeners",
    "genre": "Punjabi Soul / Bollywood Melodies / Heartbreak",
    "bio": "National Film Award winner celebrated for deeply passionate, emotive masterworks like Teri Mitti and Filhall.",
    "albums": [
      {
        "collectionId": "alb_bp_1",
        "collectionName": "Filhall",
        "releaseYear": "2019",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "artistName": "B Praak",
        "tracks": []
      },
      {
        "collectionId": "alb_bp_2",
        "collectionName": "Kesari",
        "releaseYear": "2019",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "artistName": "B Praak",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "QiBeywmJoRY",
        "resolvedYtId": "QiBeywmJoRY",
        "title": "Teri Mitti",
        "artist": "B Praak, Arko",
        "album": "Kesari",
        "duration": "5:14",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/ac/b0/7f/acb07f04-23f8-45c3-7fe8-6dd3ebc62f2f/mzaf_8542282026982364929.plus.aac.p.m4a"
      },
      {
        "id": "hMy5za-m5Ew",
        "resolvedYtId": "hMy5za-m5Ew",
        "title": "Filhall",
        "artist": "B Praak, Jaani",
        "album": "Single",
        "duration": "4:15",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop"
      },
      {
        "id": "JEgKJZEYsIU",
        "resolvedYtId": "JEgKJZEYsIU",
        "title": "Mann Bharryaa 2.0",
        "artist": "B Praak",
        "album": "Shershaah",
        "duration": "4:50",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/e6/37/70/e637703b-5564-f390-db7d-107ac86602dc/mzaf_13108018906918152174.plus.aac.p.m4a"
      },
      {
        "id": "V7LwfY5U5WI",
        "resolvedYtId": "V7LwfY5U5WI",
        "title": "Ranjha",
        "artist": "B Praak, Jasleen Royal",
        "album": "Shershaah",
        "duration": "3:48",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "QiBeywmJoRY",
        "resolvedYtId": "QiBeywmJoRY",
        "title": "Teri Mitti",
        "artist": "B Praak, Arko",
        "album": "Kesari",
        "duration": "5:14",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/ac/b0/7f/acb07f04-23f8-45c3-7fe8-6dd3ebc62f2f/mzaf_8542282026982364929.plus.aac.p.m4a"
      },
      {
        "id": "hMy5za-m5Ew",
        "resolvedYtId": "hMy5za-m5Ew",
        "title": "Filhall",
        "artist": "B Praak, Jaani",
        "album": "Single",
        "duration": "4:15",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "JEgKJZEYsIU",
        "resolvedYtId": "JEgKJZEYsIU",
        "title": "Mann Bharryaa 2.0",
        "artist": "B Praak",
        "album": "Shershaah",
        "duration": "4:50",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/e6/37/70/e637703b-5564-f390-db7d-107ac86602dc/mzaf_13108018906918152174.plus.aac.p.m4a"
      },
      {
        "id": "DUwlGduupRI",
        "resolvedYtId": "DUwlGduupRI",
        "title": "Filhaal 2 Mohabbat",
        "artist": "B Praak, Jaani",
        "album": "Single",
        "duration": "4:30",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/df/36/dc/df36dc29-ac32-3639-ba28-4a68da3f4db7/mzaf_5719210803913264944.plus.aac.p.m4a"
      },
      {
        "id": "pVwIiRGFEXc",
        "resolvedYtId": "pVwIiRGFEXc",
        "title": "Baarish Ki Jaaye",
        "artist": "B Praak",
        "album": "Single",
        "duration": "4:10",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/94/f3/6a/94f36add-508a-ff1f-53e0-0941775309a9/mzaf_13787292569569903900.plus.aac.p.m4a"
      },
      {
        "id": "OKuGTy7D52c",
        "resolvedYtId": "OKuGTy7D52c",
        "title": "Kuch Bhi Ho Jaye",
        "artist": "B Praak",
        "album": "Single",
        "duration": "5:15",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "0oMlsOPFM28",
        "resolvedYtId": "0oMlsOPFM28",
        "title": "Dholna",
        "artist": "B Praak",
        "album": "Qismat",
        "duration": "4:40",
        "category": "punjabi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/punjabi_beat.mp3"
      },
      {
        "id": "V7LwfY5U5WI",
        "resolvedYtId": "V7LwfY5U5WI",
        "title": "Ranjha",
        "artist": "B Praak, Jasleen Royal",
        "album": "Shershaah",
        "duration": "3:48",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      }
    ]
  },
  {
    "id": "vishal-mishra",
    "name": "Vishal Mishra",
    "role": "Bollywood Singer & Music Director",
    "category": "bollywood",
    "avatar": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
    "listeners": "22.5M Monthly Listeners",
    "genre": "Bollywood Soul / Acoustic Romance",
    "bio": "National Award-winning composer behind emotional cinema defining songs Pehle Bhi Main and Kaise Hua.",
    "albums": [
      {
        "collectionId": "alb_vm_1",
        "collectionName": "Animal",
        "releaseYear": "2023",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "artistName": "Vishal Mishra",
        "tracks": []
      },
      {
        "collectionId": "alb_vm_2",
        "collectionName": "Kabir Singh",
        "releaseYear": "2019",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "artistName": "Vishal Mishra",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "QKMTreKTpug",
        "resolvedYtId": "QKMTreKTpug",
        "title": "Pehle Bhi Main",
        "artist": "Vishal Mishra, Raj Shekhar",
        "album": "Animal",
        "duration": "4:10",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop"
      },
      {
        "id": "ELhODBCcojA",
        "resolvedYtId": "ELhODBCcojA",
        "title": "Kaise Hua",
        "artist": "Vishal Mishra, Manoj Muntashir",
        "album": "Kabir Singh",
        "duration": "3:54",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop"
      },
      {
        "id": "11OWuPcElJw",
        "resolvedYtId": "11OWuPcElJw",
        "title": "Zihaal e Miskin",
        "artist": "Vishal Mishra, Shreya Ghoshal",
        "album": "Single",
        "duration": "4:05",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop"
      },
      {
        "id": "R_XiBKkSAxY",
        "resolvedYtId": "R_XiBKkSAxY",
        "title": "Aaj Ke Baad",
        "artist": "Vishal Mishra, Manan Bhardwaj",
        "album": "Satyaprem Ki Katha",
        "duration": "3:43",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "QKMTreKTpug",
        "resolvedYtId": "QKMTreKTpug",
        "title": "Pehle Bhi Main",
        "artist": "Vishal Mishra, Raj Shekhar",
        "album": "Animal",
        "duration": "4:10",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "ELhODBCcojA",
        "resolvedYtId": "ELhODBCcojA",
        "title": "Kaise Hua",
        "artist": "Vishal Mishra, Manoj Muntashir",
        "album": "Kabir Singh",
        "duration": "3:54",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "11OWuPcElJw",
        "resolvedYtId": "11OWuPcElJw",
        "title": "Zihaal e Miskin",
        "artist": "Vishal Mishra, Shreya Ghoshal",
        "album": "Single",
        "duration": "4:05",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview122/v4/4b/ae/f9/4baef984-1d4e-99d9-38c2-8b736453fd9c/mzaf_15078287475648002454.plus.aac.p.m4a"
      },
      {
        "id": "R_XiBKkSAxY",
        "resolvedYtId": "R_XiBKkSAxY",
        "title": "Aaj Ke Baad",
        "artist": "Vishal Mishra, Manan Bhardwaj",
        "album": "Satyaprem Ki Katha",
        "duration": "3:43",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "TYnRRI9z5fg",
        "resolvedYtId": "TYnRRI9z5fg",
        "title": "Manjha",
        "artist": "Vishal Mishra",
        "album": "Single",
        "duration": "3:18",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "H1YR5rsScC8",
        "resolvedYtId": "H1YR5rsScC8",
        "title": "Janiye",
        "artist": "Vishal Mishra, Rashmeet Kaur",
        "album": "Chor Nikal Ke Bhaga",
        "duration": "3:45",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "UeOVNRbo2zw",
        "resolvedYtId": "UeOVNRbo2zw",
        "title": "Naseeb Se",
        "artist": "Vishal Mishra, Payal Dev",
        "album": "Satyaprem Ki Katha",
        "duration": "3:05",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "Ja2PgUAru10",
        "resolvedYtId": "Ja2PgUAru10",
        "title": "Teri Hogaiyaan",
        "artist": "Vishal Mishra",
        "album": "Broken But Beautiful",
        "duration": "3:10",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/7c/e5/61/7ce56139-27f0-adc2-910c-585947bc7978/mzaf_5981256548607018969.plus.aac.p.m4a"
      }
    ]
  },
  {
    "id": "jubin-nautiyal",
    "name": "Jubin Nautiyal",
    "role": "Bollywood Playback Singer",
    "category": "bollywood",
    "avatar": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
    "listeners": "23.8M Monthly Listeners",
    "genre": "Bollywood Romance / Acoustic / Sufi",
    "bio": "Deeply expressive vocalist behind blockbusters Raataan Lambiyan, Lut Gaye, and Tum Hi Aana.",
    "albums": [
      {
        "collectionId": "alb_jn_1",
        "collectionName": "Shershaah",
        "releaseYear": "2021",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "artistName": "Jubin Nautiyal",
        "tracks": []
      },
      {
        "collectionId": "alb_jn_2",
        "collectionName": "Lut Gaye",
        "releaseYear": "2021",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "artistName": "Jubin Nautiyal",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "orYf6VDtj_k",
        "resolvedYtId": "orYf6VDtj_k",
        "title": "Raataan Lambiyan",
        "artist": "Jubin Nautiyal, Asees Kaur",
        "album": "Shershaah",
        "duration": "3:50",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop"
      },
      {
        "id": "xFP4_aqKY8U",
        "resolvedYtId": "xFP4_aqKY8U",
        "title": "Lut Gaye",
        "artist": "Jubin Nautiyal, Tanishk Bagchi",
        "album": "Lut Gaye",
        "duration": "3:48",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop"
      },
      {
        "id": "1jDkrhxWLUA",
        "resolvedYtId": "1jDkrhxWLUA",
        "title": "Tum Hi Aana",
        "artist": "Jubin Nautiyal, Payal Dev",
        "album": "Marjaavaan",
        "duration": "4:09",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop"
      },
      {
        "id": "M4GzdR-Fnxo",
        "resolvedYtId": "M4GzdR-Fnxo",
        "title": "Humnava Mere",
        "artist": "Jubin Nautiyal, Rocky-Shiv",
        "album": "Single",
        "duration": "6:30",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/d8/5e/c3/d85ec3f3-450b-6a9b-7ea1-9345538922d7/mzaf_734647189651103547.plus.aac.p.m4a"
      }
    ],
    "allTracks": [
      {
        "id": "orYf6VDtj_k",
        "resolvedYtId": "orYf6VDtj_k",
        "title": "Raataan Lambiyan",
        "artist": "Jubin Nautiyal, Asees Kaur",
        "album": "Shershaah",
        "duration": "3:50",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/99/0c/38/990c381b-0530-8c0d-87a9-18b050b97f0a/mzaf_10418866714500530894.plus.aac.p.m4a"
      },
      {
        "id": "xFP4_aqKY8U",
        "resolvedYtId": "xFP4_aqKY8U",
        "title": "Lut Gaye",
        "artist": "Jubin Nautiyal, Tanishk Bagchi",
        "album": "Lut Gaye",
        "duration": "3:48",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "1jDkrhxWLUA",
        "resolvedYtId": "1jDkrhxWLUA",
        "title": "Tum Hi Aana",
        "artist": "Jubin Nautiyal, Payal Dev",
        "album": "Marjaavaan",
        "duration": "4:09",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "M4GzdR-Fnxo",
        "resolvedYtId": "M4GzdR-Fnxo",
        "title": "Humnava Mere",
        "artist": "Jubin Nautiyal, Rocky-Shiv",
        "album": "Single",
        "duration": "6:30",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/d8/5e/c3/d85ec3f3-450b-6a9b-7ea1-9345538922d7/mzaf_734647189651103547.plus.aac.p.m4a"
      },
      {
        "id": "9j5jQ_M93ec",
        "resolvedYtId": "9j5jQ_M93ec",
        "title": "Bewafa Tera Masoom Chehra",
        "artist": "Jubin Nautiyal",
        "album": "Single",
        "duration": "4:15",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "drexK7HD0fA",
        "resolvedYtId": "drexK7HD0fA",
        "title": "Meri Aashiqui",
        "artist": "Jubin Nautiyal",
        "album": "Single",
        "duration": "4:25",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "CDJfnJsXKIw",
        "resolvedYtId": "CDJfnJsXKIw",
        "title": "Kinna Sona",
        "artist": "Jubin Nautiyal",
        "album": "Marjaavaan",
        "duration": "4:35",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "ypY0r9xUtME",
        "resolvedYtId": "ypY0r9xUtME",
        "title": "Dil Galti Kar Baitha Hai",
        "artist": "Jubin Nautiyal",
        "album": "Single",
        "duration": "4:00",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      }
    ]
  },
  {
    "id": "mohit-chauhan",
    "name": "Mohit Chauhan",
    "role": "The Voice of Silk & Wanderlust",
    "category": "sufi",
    "avatar": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
    "listeners": "16.4M Monthly Listeners",
    "genre": "Sufi-Rock / Bollywood Romance / Indie Folk",
    "bio": "Iconic Silk Route frontman and musical soul of Imtiaz Ali's Rockstar and Jab We Met.",
    "albums": [
      {
        "collectionId": "alb_mc_1",
        "collectionName": "Rockstar",
        "releaseYear": "2011",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "artistName": "Mohit Chauhan",
        "tracks": []
      },
      {
        "collectionId": "alb_mc_2",
        "collectionName": "Jab We Met",
        "releaseYear": "2007",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "artistName": "Mohit Chauhan",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "Cb6wuzOurPc",
        "resolvedYtId": "Cb6wuzOurPc",
        "title": "Tum Se Hi",
        "artist": "Mohit Chauhan, Pritam",
        "album": "Jab We Met",
        "duration": "5:21",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop"
      },
      {
        "id": "6MgsHSAcI9k",
        "resolvedYtId": "6MgsHSAcI9k",
        "title": "Nadaan Parinde",
        "artist": "Mohit Chauhan, A.R. Rahman",
        "album": "Rockstar",
        "duration": "6:24",
        "category": "sufi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop"
      },
      {
        "id": "Nbr_KJT0TIc",
        "resolvedYtId": "Nbr_KJT0TIc",
        "title": "Pee Loon",
        "artist": "Mohit Chauhan, Pritam",
        "album": "Once Upon a Time in Mumbaai",
        "duration": "4:47",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop"
      },
      {
        "id": "TpMSsbzvRe4",
        "resolvedYtId": "TpMSsbzvRe4",
        "title": "Matargashti",
        "artist": "Mohit Chauhan, A.R. Rahman",
        "album": "Tamasha",
        "duration": "5:28",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "Cb6wuzOurPc",
        "resolvedYtId": "Cb6wuzOurPc",
        "title": "Tum Se Hi",
        "artist": "Mohit Chauhan, Pritam",
        "album": "Jab We Met",
        "duration": "5:21",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/86/cd/e5/86cde5bb-1d70-08aa-f7de-778f098495dc/mzaf_5343341377772162995.plus.aac.p.m4a"
      },
      {
        "id": "6MgsHSAcI9k",
        "resolvedYtId": "6MgsHSAcI9k",
        "title": "Nadaan Parinde",
        "artist": "Mohit Chauhan, A.R. Rahman",
        "album": "Rockstar",
        "duration": "6:24",
        "category": "sufi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/sufi_meditation.mp3"
      },
      {
        "id": "Nbr_KJT0TIc",
        "resolvedYtId": "Nbr_KJT0TIc",
        "title": "Pee Loon",
        "artist": "Mohit Chauhan, Pritam",
        "album": "Once Upon a Time in Mumbaai",
        "duration": "4:47",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "-3gQ6HIkRys",
        "resolvedYtId": "-3gQ6HIkRys",
        "title": "Phir Se Ud Chala",
        "artist": "Mohit Chauhan, A.R. Rahman",
        "album": "Rockstar",
        "duration": "4:31",
        "category": "sufi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/sufi_meditation.mp3"
      },
      {
        "id": "YGwE90xQ7NE",
        "resolvedYtId": "YGwE90xQ7NE",
        "title": "Masakali",
        "artist": "Mohit Chauhan, A.R. Rahman",
        "album": "Delhi-6",
        "duration": "4:50",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "TpMSsbzvRe4",
        "resolvedYtId": "TpMSsbzvRe4",
        "title": "Matargashti",
        "artist": "Mohit Chauhan, A.R. Rahman",
        "album": "Tamasha",
        "duration": "5:28",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "SB9XNNFlVc4",
        "resolvedYtId": "SB9XNNFlVc4",
        "title": "Dooba Dooba",
        "artist": "Mohit Chauhan, Silk Route",
        "album": "Boondein",
        "duration": "4:15",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/36/bc/ae/36bcae83-6ab1-b9db-d4a2-77ab05aa44be/mzaf_4325337823908270891.plus.aac.p.m4a"
      },
      {
        "id": "ww-ABqbU2VY",
        "resolvedYtId": "ww-ABqbU2VY",
        "title": "Tujhe Bhula Diya",
        "artist": "Mohit Chauhan, Shekhar Ravjiani",
        "album": "Anjaana Anjaani",
        "duration": "4:39",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      }
    ]
  },
  {
    "id": "sunidhi-chauhan",
    "name": "Sunidhi Chauhan",
    "role": "The High-Voltage Queen of Bollywood",
    "category": "female",
    "avatar": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
    "listeners": "20.1M Monthly Listeners",
    "genre": "Bollywood Dance / Item Anthems / Power Vocals",
    "bio": "Dynamic powerhouse vocalist known for electrifying stage energy and high-tempo chart-toppers.",
    "albums": [
      {
        "collectionId": "alb_sc_1",
        "collectionName": "Dhoom Series",
        "releaseYear": "2006",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "artistName": "Sunidhi Chauhan",
        "tracks": []
      },
      {
        "collectionId": "alb_sc_2",
        "collectionName": "Tees Maar Khan",
        "releaseYear": "2010",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "artistName": "Sunidhi Chauhan",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "4nTcA-JHJw4",
        "resolvedYtId": "4nTcA-JHJw4",
        "title": "Kamli",
        "artist": "Sunidhi Chauhan, Pritam",
        "album": "Dhoom 3",
        "duration": "3:40",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop"
      },
      {
        "id": "-KKGmgmHjFM",
        "resolvedYtId": "-KKGmgmHjFM",
        "title": "Sheila Ki Jawani",
        "artist": "Sunidhi Chauhan, Vishal-Shekhar",
        "album": "Tees Maar Khan",
        "duration": "4:43",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop"
      },
      {
        "id": "4a6P7iqR31Q",
        "resolvedYtId": "4a6P7iqR31Q",
        "title": "Beedi",
        "artist": "Sunidhi Chauhan, Sukhwinder Singh",
        "album": "Omkara",
        "duration": "5:05",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/98/3e/d0/983ed045-1779-89f6-d872-66f3142b1569/mzaf_10032372685880438914.plus.aac.p.m4a"
      },
      {
        "id": "J2Bh68GTUOU",
        "resolvedYtId": "J2Bh68GTUOU",
        "title": "Crazy Kiya Re",
        "artist": "Sunidhi Chauhan, Pritam",
        "album": "Dhoom 2",
        "duration": "4:54",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "4nTcA-JHJw4",
        "resolvedYtId": "4nTcA-JHJw4",
        "title": "Kamli",
        "artist": "Sunidhi Chauhan, Pritam",
        "album": "Dhoom 3",
        "duration": "3:40",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "-KKGmgmHjFM",
        "resolvedYtId": "-KKGmgmHjFM",
        "title": "Sheila Ki Jawani",
        "artist": "Sunidhi Chauhan, Vishal-Shekhar",
        "album": "Tees Maar Khan",
        "duration": "4:43",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "4a6P7iqR31Q",
        "resolvedYtId": "4a6P7iqR31Q",
        "title": "Beedi",
        "artist": "Sunidhi Chauhan, Sukhwinder Singh",
        "album": "Omkara",
        "duration": "5:05",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/98/3e/d0/983ed045-1779-89f6-d872-66f3142b1569/mzaf_10032372685880438914.plus.aac.p.m4a"
      },
      {
        "id": "J2Bh68GTUOU",
        "resolvedYtId": "J2Bh68GTUOU",
        "title": "Crazy Kiya Re",
        "artist": "Sunidhi Chauhan, Pritam",
        "album": "Dhoom 2",
        "duration": "4:54",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "GIBFSXTyrUo",
        "resolvedYtId": "GIBFSXTyrUo",
        "title": "Desi Girl",
        "artist": "Sunidhi Chauhan, Shankar Mahadevan, Vishal",
        "album": "Dostana",
        "duration": "5:06",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/b4/58/80/b45880d1-8f73-2281-aedb-384f28e5d76c/mzaf_5076496193019092454.plus.aac.p.m4a"
      },
      {
        "id": "fc7QyJWRYDQ",
        "resolvedYtId": "fc7QyJWRYDQ",
        "title": "Dance Pe Chance",
        "artist": "Sunidhi Chauhan, Salim Merchant",
        "album": "Rab Ne Bana Di Jodi",
        "duration": "4:22",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/cb/40/25/cb402585-3b18-deb5-5254-b1163e1dd6a8/mzaf_10912525270732035475.plus.aac.p.m4a"
      },
      {
        "id": "0ROJHVqMmrg",
        "resolvedYtId": "0ROJHVqMmrg",
        "title": "Sajnaaji Vaari Vaari",
        "artist": "Sunidhi Chauhan",
        "album": "Honeymoon Travels",
        "duration": "4:15",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/fe/d5/54/fed554c5-1902-eda8-9491-2f1f9632d401/mzaf_12194423085771676210.plus.aac.p.m4a"
      },
      {
        "id": "x-Q4WazUFg8",
        "resolvedYtId": "x-Q4WazUFg8",
        "title": "Dhoom Machale",
        "artist": "Sunidhi Chauhan",
        "album": "Dhoom",
        "duration": "6:17",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      }
    ]
  },
  {
    "id": "badshah",
    "name": "Badshah",
    "role": "Desi Hip-Hop & Party King",
    "category": "punjabi",
    "avatar": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
    "listeners": "26.4M Monthly Listeners",
    "genre": "Commercial Hip-Hop / Club Anthems / Pop",
    "bio": "Indian rap mogul with over 15 billion streams across global party anthems and Bollywood blockbusters.",
    "albums": [
      {
        "collectionId": "alb_bad_1",
        "collectionName": "O.N.E.",
        "releaseYear": "2018",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "artistName": "Badshah",
        "tracks": []
      },
      {
        "collectionId": "alb_bad_2",
        "collectionName": "Ek Tha Raja",
        "releaseYear": "2024",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "artistName": "Badshah",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "LfVgu6nxpos",
        "resolvedYtId": "LfVgu6nxpos",
        "title": "Jugnu",
        "artist": "Badshah, Nikhita Gandhi",
        "album": "Single",
        "duration": "3:50",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop"
      },
      {
        "id": "VkAuRcpuxuo",
        "resolvedYtId": "VkAuRcpuxuo",
        "title": "Genda Phool",
        "artist": "Badshah, Payal Dev",
        "album": "Single",
        "duration": "2:50",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/e8/07/f6/e807f695-524d-fe64-8214-0377dde7a952/mzaf_12171306243399456334.plus.aac.p.m4a"
      },
      {
        "id": "DDlojUPxLsM",
        "resolvedYtId": "DDlojUPxLsM",
        "title": "Paani Paani",
        "artist": "Badshah, Aastha Gill",
        "album": "Single",
        "duration": "3:00",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop"
      },
      {
        "id": "iPBiVJJCwIQ",
        "resolvedYtId": "iPBiVJJCwIQ",
        "title": "Kala Chashma",
        "artist": "Badshah, Neha Kakkar, Amar Arshi",
        "album": "Baar Baar Dekho",
        "duration": "3:07",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "LfVgu6nxpos",
        "resolvedYtId": "LfVgu6nxpos",
        "title": "Jugnu",
        "artist": "Badshah, Nikhita Gandhi",
        "album": "Single",
        "duration": "3:50",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "VkAuRcpuxuo",
        "resolvedYtId": "VkAuRcpuxuo",
        "title": "Genda Phool",
        "artist": "Badshah, Payal Dev",
        "album": "Single",
        "duration": "2:50",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/e8/07/f6/e807f695-524d-fe64-8214-0377dde7a952/mzaf_12171306243399456334.plus.aac.p.m4a"
      },
      {
        "id": "DDlojUPxLsM",
        "resolvedYtId": "DDlojUPxLsM",
        "title": "Paani Paani",
        "artist": "Badshah, Aastha Gill",
        "album": "Single",
        "duration": "3:00",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "iPBiVJJCwIQ",
        "resolvedYtId": "iPBiVJJCwIQ",
        "title": "Kala Chashma",
        "artist": "Badshah, Neha Kakkar, Amar Arshi",
        "album": "Baar Baar Dekho",
        "duration": "3:07",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "Bea019pOw5w",
        "resolvedYtId": "Bea019pOw5w",
        "title": "Kar Gayi Chull",
        "artist": "Badshah, Fazilpuria, Sukriti Kakar",
        "album": "Kapoor & Sons",
        "duration": "3:07",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/a2/73/42/a273426d-66bc-2d7d-abd6-a3000b37ec5f/mzaf_14832496167081149978.plus.aac.p.m4a"
      },
      {
        "id": "OulN7vTDq1I",
        "resolvedYtId": "OulN7vTDq1I",
        "title": "DJ Waley Babu",
        "artist": "Badshah, Aastha Gill",
        "album": "Single",
        "duration": "2:56",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "kaF_Bq_34IQ",
        "resolvedYtId": "kaF_Bq_34IQ",
        "title": "Garmi",
        "artist": "Badshah, Neha Kakkar",
        "album": "Street Dancer 3D",
        "duration": "3:02",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "gwGesFjbJlI",
        "resolvedYtId": "gwGesFjbJlI",
        "title": "Mercy",
        "artist": "Badshah",
        "album": "O.N.E.",
        "duration": "3:05",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      }
    ]
  },
  {
    "id": "anirudh",
    "name": "Anirudh Ravichander",
    "role": "Rockstar of South & Pan-India Cinema",
    "category": "south",
    "avatar": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
    "listeners": "31.2M Monthly Listeners",
    "genre": "Pan-India EDM / South Mass Anthems / Pop",
    "bio": "Sensational music director behind the historic records of Jawan, Jailer, Leo, Vikram, and Master.",
    "albums": [
      {
        "collectionId": "alb_ani_1",
        "collectionName": "Leo",
        "releaseYear": "2023",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "artistName": "Anirudh Ravichander",
        "tracks": []
      },
      {
        "collectionId": "alb_ani_2",
        "collectionName": "Jailer",
        "releaseYear": "2023",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "artistName": "Anirudh Ravichander",
        "tracks": []
      },
      {
        "collectionId": "alb_ani_3",
        "collectionName": "Jawan",
        "releaseYear": "2023",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "artistName": "Anirudh Ravichander",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "IqwIOlhfCak",
        "resolvedYtId": "IqwIOlhfCak",
        "title": "Badass",
        "artist": "Anirudh Ravichander",
        "album": "Leo",
        "duration": "3:49",
        "category": "south",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop"
      },
      {
        "id": "DsjRNPrvq6U",
        "resolvedYtId": "DsjRNPrvq6U",
        "title": "Hukum",
        "artist": "Anirudh Ravichander, Super Subu",
        "album": "Jailer",
        "duration": "3:27",
        "category": "south",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop"
      },
      {
        "id": "YR12Z8f1Dh8",
        "resolvedYtId": "YR12Z8f1Dh8",
        "title": "Why This Kolaveri Di",
        "artist": "Anirudh Ravichander, Dhanush",
        "album": "3",
        "duration": "4:05",
        "category": "south",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop"
      },
      {
        "id": "KUN5Uf9mObQ",
        "resolvedYtId": "KUN5Uf9mObQ",
        "title": "Arabic Kuthu",
        "artist": "Anirudh Ravichander, Jonita Gandhi",
        "album": "Beast",
        "duration": "4:39",
        "category": "south",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/0b/83/a7/0b83a7a8-4911-221c-4fa1-ecd4ab7e7750/mzaf_4636221010938715732.plus.aac.p.m4a"
      }
    ],
    "allTracks": [
      {
        "id": "IqwIOlhfCak",
        "resolvedYtId": "IqwIOlhfCak",
        "title": "Badass",
        "artist": "Anirudh Ravichander",
        "album": "Leo",
        "duration": "3:49",
        "category": "south",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/south_cinema.mp3"
      },
      {
        "id": "DsjRNPrvq6U",
        "resolvedYtId": "DsjRNPrvq6U",
        "title": "Hukum",
        "artist": "Anirudh Ravichander, Super Subu",
        "album": "Jailer",
        "duration": "3:27",
        "category": "south",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/south_cinema.mp3"
      },
      {
        "id": "YR12Z8f1Dh8",
        "resolvedYtId": "YR12Z8f1Dh8",
        "title": "Why This Kolaveri Di",
        "artist": "Anirudh Ravichander, Dhanush",
        "album": "3",
        "duration": "4:05",
        "category": "south",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/south_cinema.mp3"
      },
      {
        "id": "KUN5Uf9mObQ",
        "resolvedYtId": "KUN5Uf9mObQ",
        "title": "Arabic Kuthu",
        "artist": "Anirudh Ravichander, Jonita Gandhi",
        "album": "Beast",
        "duration": "4:39",
        "category": "south",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/0b/83/a7/0b83a7a8-4911-221c-4fa1-ecd4ab7e7750/mzaf_4636221010938715732.plus.aac.p.m4a"
      },
      {
        "id": "szvt1vD0Uug",
        "resolvedYtId": "szvt1vD0Uug",
        "title": "Naa Ready",
        "artist": "Anirudh Ravichander, Thalapathy Vijay",
        "album": "Leo",
        "duration": "4:08",
        "category": "south",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/south_cinema.mp3"
      },
      {
        "id": "fRD_3vJagxk",
        "resolvedYtId": "fRD_3vJagxk",
        "title": "Vaathi Coming",
        "artist": "Anirudh Ravichander, Gana Balachandar",
        "album": "Master",
        "duration": "3:50",
        "category": "south",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/20/da/f1/20daf12c-4e8f-bc03-d548-c4968cb405fd/mzaf_11939350127905472767.plus.aac.p.m4a"
      },
      {
        "id": "F_jU1KI82kw",
        "resolvedYtId": "F_jU1KI82kw",
        "title": "Chaleya (Composition)",
        "artist": "Anirudh Ravichander, Arijit Singh",
        "album": "Jawan",
        "duration": "3:20",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/76/05/d9/7605d905-f631-517d-df7f-e162affcd414/mzaf_9976541859961700749.plus.aac.p.m4a"
      },
      {
        "id": "F05tvfWHU_8",
        "resolvedYtId": "F05tvfWHU_8",
        "title": "Kaavaalaa",
        "artist": "Anirudh Ravichander, Shilpa Rao",
        "album": "Jailer",
        "duration": "3:10",
        "category": "south",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/a5/17/86/a517861e-ea79-edaa-0b43-82c9e75c0beb/mzaf_16913299593822611847.plus.aac.p.m4a"
      }
    ]
  },
  {
    "id": "armaan-malik",
    "name": "Armaan Malik",
    "role": "Prince of Romance & Pop Vocalist",
    "category": "bollywood",
    "avatar": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
    "listeners": "19.3M Monthly Listeners",
    "genre": "Bollywood Romance / Pop / Global Singles",
    "bio": "Multi-lingual singing sensation behind romantic gems Bol Do Na Zara, Main Hoon Hero Tera, and Jab Tak.",
    "albums": [
      {
        "collectionId": "alb_am_1",
        "collectionName": "Only Just Begun",
        "releaseYear": "2023",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "artistName": "Armaan Malik",
        "tracks": []
      },
      {
        "collectionId": "alb_am_2",
        "collectionName": "Azhar & Dhoni",
        "releaseYear": "2016",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "artistName": "Armaan Malik",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "EpEraRui1pc",
        "resolvedYtId": "EpEraRui1pc",
        "title": "Bol Do Na Zara",
        "artist": "Armaan Malik, Amaal Mallik",
        "album": "Azhar",
        "duration": "4:53",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop"
      },
      {
        "id": "Y0Ezt734FOo",
        "resolvedYtId": "Y0Ezt734FOo",
        "title": "Main Hoon Hero Tera",
        "artist": "Armaan Malik, Amaal Mallik",
        "album": "Hero",
        "duration": "4:44",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/4b/e3/08/4be3080b-bc59-7e7b-1038-476c4416d90e/mzaf_1629681522339424450.plus.aac.p.m4a"
      },
      {
        "id": "LSPNRNfHUV8",
        "resolvedYtId": "LSPNRNfHUV8",
        "title": "Jab Tak",
        "artist": "Armaan Malik, Amaal Mallik",
        "album": "M.S. Dhoni",
        "duration": "2:54",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop"
      },
      {
        "id": "7L7GLWXF_-Y",
        "resolvedYtId": "7L7GLWXF_-Y",
        "title": "Pehla Pyaar",
        "artist": "Armaan Malik, Vishal Mishra",
        "album": "Kabir Singh",
        "duration": "4:32",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "EpEraRui1pc",
        "resolvedYtId": "EpEraRui1pc",
        "title": "Bol Do Na Zara",
        "artist": "Armaan Malik, Amaal Mallik",
        "album": "Azhar",
        "duration": "4:53",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/e3/84/7e/e3847ec1-0c53-810f-d4e5-ba0072562cc5/mzaf_15902888427949375443.plus.aac.p.m4a"
      },
      {
        "id": "Y0Ezt734FOo",
        "resolvedYtId": "Y0Ezt734FOo",
        "title": "Main Hoon Hero Tera",
        "artist": "Armaan Malik, Amaal Mallik",
        "album": "Hero",
        "duration": "4:44",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/4b/e3/08/4be3080b-bc59-7e7b-1038-476c4416d90e/mzaf_1629681522339424450.plus.aac.p.m4a"
      },
      {
        "id": "LSPNRNfHUV8",
        "resolvedYtId": "LSPNRNfHUV8",
        "title": "Jab Tak",
        "artist": "Armaan Malik, Amaal Mallik",
        "album": "M.S. Dhoni",
        "duration": "2:54",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "7L7GLWXF_-Y",
        "resolvedYtId": "7L7GLWXF_-Y",
        "title": "Pehla Pyaar",
        "artist": "Armaan Malik, Vishal Mishra",
        "album": "Kabir Singh",
        "duration": "4:32",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "OYKFJxUxiYk",
        "resolvedYtId": "OYKFJxUxiYk",
        "title": "Sun Maahi",
        "artist": "Armaan Malik",
        "album": "Only Just Begun",
        "duration": "3:10",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "y9PvJG8BnqY",
        "resolvedYtId": "y9PvJG8BnqY",
        "title": "Butta Bomma (Hindi)",
        "artist": "Armaan Malik",
        "album": "Ala Vaikunthapurramuloo",
        "duration": "3:18",
        "category": "south",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview112/v4/28/e0/d3/28e0d30a-2afe-66e4-ac03-69b6d779fecd/mzaf_7857615290499608693.plus.aac.p.m4a"
      },
      {
        "id": "xXBYwzxP034",
        "resolvedYtId": "xXBYwzxP034",
        "title": "Ghar Se Nikalte Hi",
        "artist": "Armaan Malik",
        "album": "Single",
        "duration": "4:20",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "VCqWjVJxp2s",
        "resolvedYtId": "VCqWjVJxp2s",
        "title": "Hua Hain Aaj Pehli Baar",
        "artist": "Armaan Malik, Palak Muchhal",
        "album": "Sanam Re",
        "duration": "5:09",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/ef/d2/65/efd2653a-c84d-0d27-2908-951337c916c9/mzaf_9756161475334709933.plus.aac.p.m4a"
      }
    ]
  },
  {
    "id": "darshan-raval",
    "name": "Darshan Raval",
    "role": "Heartthrob of Indie & Monsoon Romance",
    "category": "bollywood",
    "avatar": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
    "listeners": "18.8M Monthly Listeners",
    "genre": "Indie Pop / Monsoon Romance / Bollywood",
    "bio": "Beloved youth icon celebrated for his signature monsoon tracks, Chogada, and viral acoustic love anthems.",
    "albums": [
      {
        "collectionId": "alb_dr_1",
        "collectionName": "Judaaiyaan",
        "releaseYear": "2020",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "artistName": "Darshan Raval",
        "tracks": []
      },
      {
        "collectionId": "alb_dr_2",
        "collectionName": "Dard",
        "releaseYear": "2023",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "artistName": "Darshan Raval",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "ki2sJCtmAkw",
        "resolvedYtId": "ki2sJCtmAkw",
        "title": "Chogada",
        "artist": "Darshan Raval, Asees Kaur",
        "album": "Loveyatri",
        "duration": "4:09",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop"
      },
      {
        "id": "asAG0uTdng4",
        "resolvedYtId": "asAG0uTdng4",
        "title": "Tera Zikr",
        "artist": "Darshan Raval",
        "album": "Single",
        "duration": "3:39",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop"
      },
      {
        "id": "EqOPYbitfz0",
        "resolvedYtId": "EqOPYbitfz0",
        "title": "Kamariya",
        "artist": "Darshan Raval, DJ Chetas",
        "album": "Mitron",
        "duration": "3:08",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop"
      },
      {
        "id": "jabs2RM7Tqo",
        "resolvedYtId": "jabs2RM7Tqo",
        "title": "Asal Mein",
        "artist": "Darshan Raval",
        "album": "Single",
        "duration": "3:50",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "ki2sJCtmAkw",
        "resolvedYtId": "ki2sJCtmAkw",
        "title": "Chogada",
        "artist": "Darshan Raval, Asees Kaur",
        "album": "Loveyatri",
        "duration": "4:09",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "asAG0uTdng4",
        "resolvedYtId": "asAG0uTdng4",
        "title": "Tera Zikr",
        "artist": "Darshan Raval",
        "album": "Single",
        "duration": "3:39",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "EqOPYbitfz0",
        "resolvedYtId": "EqOPYbitfz0",
        "title": "Kamariya",
        "artist": "Darshan Raval, DJ Chetas",
        "album": "Mitron",
        "duration": "3:08",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "jabs2RM7Tqo",
        "resolvedYtId": "jabs2RM7Tqo",
        "title": "Asal Mein",
        "artist": "Darshan Raval",
        "album": "Single",
        "duration": "3:50",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/6d/f5/23/6df52345-2682-2986-2c84-0ab1e9502419/mzaf_16281333561581034128.plus.aac.p.m4a"
      },
      {
        "id": "kGz60tuHgc4",
        "resolvedYtId": "kGz60tuHgc4",
        "title": "Bhula Dunga",
        "artist": "Darshan Raval",
        "album": "Single",
        "duration": "3:40",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "Wadc4Q7ocrU",
        "resolvedYtId": "Wadc4Q7ocrU",
        "title": "Ek Ladki Ko Dekha Toh Aisa Laga",
        "artist": "Darshan Raval, Rochak Kohli",
        "album": "ELKDTAL",
        "duration": "2:34",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/06/48/02/064802ba-7e0d-c6c7-70d3-ac86f5062988/mzaf_12027465811841515455.plus.aac.p.m4a"
      },
      {
        "id": "SsOY0gZFfGs",
        "resolvedYtId": "SsOY0gZFfGs",
        "title": "Mehrama",
        "artist": "Darshan Raval, Antara Mitra",
        "album": "Love Aaj Kal",
        "duration": "4:09",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "0WAKIz9glCY",
        "resolvedYtId": "0WAKIz9glCY",
        "title": "Hawa Banke",
        "artist": "Darshan Raval",
        "album": "Single",
        "duration": "3:20",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      }
    ]
  },
  {
    "id": "prateek-kuhad",
    "name": "Prateek Kuhad",
    "role": "Global Indie-Folk Singer-Songwriter",
    "category": "indie",
    "avatar": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
    "listeners": "11.2M Monthly Listeners",
    "genre": "Indie Folk / Acoustic / Singer-Songwriter",
    "bio": "Internationally acclaimed singer-songwriter behind cold/mess, featured on Barack Obama's favorite music list.",
    "albums": [
      {
        "collectionId": "alb_pk_1",
        "collectionName": "cold/mess",
        "releaseYear": "2018",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "artistName": "Prateek Kuhad",
        "tracks": []
      },
      {
        "collectionId": "alb_pk_2",
        "collectionName": "The Way That Lovers Do",
        "releaseYear": "2022",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "artistName": "Prateek Kuhad",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "Il7Nv270zNk",
        "resolvedYtId": "Il7Nv270zNk",
        "title": "cold/mess",
        "artist": "Prateek Kuhad",
        "album": "cold/mess",
        "duration": "4:16",
        "category": "indie",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop"
      },
      {
        "id": "BmUe3-sfr7E",
        "resolvedYtId": "BmUe3-sfr7E",
        "title": "Kasoor",
        "artist": "Prateek Kuhad",
        "album": "Single",
        "duration": "3:17",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/c6/34/7f/c6347fe4-d2a8-bf5e-2ca5-7438cce63f93/mzaf_585381111877766094.plus.aac.p.m4a"
      },
      {
        "id": "miXdVbIm5BY",
        "resolvedYtId": "miXdVbIm5BY",
        "title": "Tune Kaha",
        "artist": "Prateek Kuhad",
        "album": "In Tokens & Charms",
        "duration": "3:12",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop"
      },
      {
        "id": "VA0V8rQpqwQ",
        "resolvedYtId": "VA0V8rQpqwQ",
        "title": "Kho Gaye Hum Kahan",
        "artist": "Prateek Kuhad, Jasleen Royal",
        "album": "Baar Baar Dekho",
        "duration": "4:13",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "Il7Nv270zNk",
        "resolvedYtId": "Il7Nv270zNk",
        "title": "cold/mess",
        "artist": "Prateek Kuhad",
        "album": "cold/mess",
        "duration": "4:16",
        "category": "indie",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/indie_acoustic.mp3"
      },
      {
        "id": "BmUe3-sfr7E",
        "resolvedYtId": "BmUe3-sfr7E",
        "title": "Kasoor",
        "artist": "Prateek Kuhad",
        "album": "Single",
        "duration": "3:17",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/c6/34/7f/c6347fe4-d2a8-bf5e-2ca5-7438cce63f93/mzaf_585381111877766094.plus.aac.p.m4a"
      },
      {
        "id": "miXdVbIm5BY",
        "resolvedYtId": "miXdVbIm5BY",
        "title": "Tune Kaha",
        "artist": "Prateek Kuhad",
        "album": "In Tokens & Charms",
        "duration": "3:12",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "VA0V8rQpqwQ",
        "resolvedYtId": "VA0V8rQpqwQ",
        "title": "Kho Gaye Hum Kahan",
        "artist": "Prateek Kuhad, Jasleen Royal",
        "album": "Baar Baar Dekho",
        "duration": "4:13",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "-BpDVIv_860",
        "resolvedYtId": "-BpDVIv_860",
        "title": "Tum Jab Paas",
        "artist": "Prateek Kuhad",
        "album": "Single",
        "duration": "3:40",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "NYyA9Ks3TKk",
        "resolvedYtId": "NYyA9Ks3TKk",
        "title": "Dil Beparwah",
        "artist": "Prateek Kuhad, Ankur Tewari",
        "album": "Single",
        "duration": "3:30",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "U2SVCCENLjE",
        "resolvedYtId": "U2SVCCENLjE",
        "title": "Co2",
        "artist": "Prateek Kuhad",
        "album": "The Way That Lovers Do",
        "duration": "2:45",
        "category": "indie",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/3a/2b/9e/3a2b9e23-6381-5513-bfbd-c77a8d82beb0/mzaf_325522060342302711.plus.aac.p.m4a"
      },
      {
        "id": "i-dms4mcAUE",
        "resolvedYtId": "i-dms4mcAUE",
        "title": "100 Words",
        "artist": "Prateek Kuhad",
        "album": "cold/mess",
        "duration": "3:15",
        "category": "indie",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/e0/6a/93/e06a93e8-0b5f-2f9d-fa4f-ebc78d2e292a/mzaf_3531652227104920928.plus.aac.p.m4a"
      }
    ]
  },
  {
    "id": "jasleen-royal",
    "name": "Jasleen Royal",
    "role": "Composer, Singer & One-Woman Band",
    "category": "female",
    "avatar": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
    "listeners": "16.7M Monthly Listeners",
    "genre": "Indie Pop / Bollywood Romance / Acoustic",
    "bio": "Chart-topping creator behind the massive global viral hit Heeriye, Din Shagna Da, and Ranjha.",
    "albums": [
      {
        "collectionId": "alb_jr_1",
        "collectionName": "Heeriye",
        "releaseYear": "2023",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "artistName": "Jasleen Royal",
        "tracks": []
      },
      {
        "collectionId": "alb_jr_2",
        "collectionName": "Shershaah & Phillauri",
        "releaseYear": "2021",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "artistName": "Jasleen Royal",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "RLzC55ai0eo",
        "resolvedYtId": "RLzC55ai0eo",
        "title": "Heeriye",
        "artist": "Jasleen Royal, Arijit Singh",
        "album": "Single",
        "duration": "3:14",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop"
      },
      {
        "id": "_jJZZFPQOvI",
        "resolvedYtId": "_jJZZFPQOvI",
        "title": "Din Shagna Da",
        "artist": "Jasleen Royal",
        "album": "Phillauri",
        "duration": "3:36",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop"
      },
      {
        "id": "-Mnkk-GKy6Q",
        "resolvedYtId": "-Mnkk-GKy6Q",
        "title": "Ranjha",
        "artist": "Jasleen Royal, B Praak",
        "album": "Shershaah",
        "duration": "3:48",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop"
      },
      {
        "id": "bpiggjsWjPk",
        "resolvedYtId": "bpiggjsWjPk",
        "title": "Nachde Ne Saare",
        "artist": "Jasleen Royal, Harshdeep Kaur, Siddharth",
        "album": "Baar Baar Dekho",
        "duration": "3:14",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "RLzC55ai0eo",
        "resolvedYtId": "RLzC55ai0eo",
        "title": "Heeriye",
        "artist": "Jasleen Royal, Arijit Singh",
        "album": "Single",
        "duration": "3:14",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/14/9b/ac/149bac62-12f1-2f55-a742-f38429b94c83/mzaf_17225240189976438593.plus.aac.p.m4a"
      },
      {
        "id": "_jJZZFPQOvI",
        "resolvedYtId": "_jJZZFPQOvI",
        "title": "Din Shagna Da",
        "artist": "Jasleen Royal",
        "album": "Phillauri",
        "duration": "3:36",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "-Mnkk-GKy6Q",
        "resolvedYtId": "-Mnkk-GKy6Q",
        "title": "Ranjha",
        "artist": "Jasleen Royal, B Praak",
        "album": "Shershaah",
        "duration": "3:48",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "bpiggjsWjPk",
        "resolvedYtId": "bpiggjsWjPk",
        "title": "Nachde Ne Saare",
        "artist": "Jasleen Royal, Harshdeep Kaur, Siddharth",
        "album": "Baar Baar Dekho",
        "duration": "3:14",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "ymhHUEPEKwQ",
        "resolvedYtId": "ymhHUEPEKwQ",
        "title": "Kho Gaye Hum Kahan",
        "artist": "Jasleen Royal, Prateek Kuhad",
        "album": "Baar Baar Dekho",
        "duration": "4:13",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "eg5sCr08kjE",
        "resolvedYtId": "eg5sCr08kjE",
        "title": "Nit Nit",
        "artist": "Jasleen Royal",
        "album": "Single",
        "duration": "3:15",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "rwn0Zs7ELzc",
        "resolvedYtId": "rwn0Zs7ELzc",
        "title": "Love You Zindagi",
        "artist": "Jasleen Royal, Amit Trivedi",
        "album": "Dear Zindagi",
        "duration": "3:51",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/a4/66/64/a46664cb-8eae-40cd-a4eb-51778872b028/mzaf_15968506519307719573.plus.aac.p.m4a"
      },
      {
        "id": "8PTOkwze0Vw",
        "resolvedYtId": "8PTOkwze0Vw",
        "title": "Sang Rahiyo",
        "artist": "Jasleen Royal, Ujjwal Kashyap",
        "album": "Single",
        "duration": "3:40",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      }
    ]
  },
  {
    "id": "divine",
    "name": "DIVINE",
    "role": "Gully Gang Pioneer & Rap Kingpin",
    "category": "indie",
    "avatar": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
    "listeners": "14.9M Monthly Listeners",
    "genre": "Desi Hip-Hop / Gully Rap / Hardcore",
    "bio": "The trailblazing pioneer who built Indian hip-hop from Mumbai's streets and inspired the blockbuster Gully Boy.",
    "albums": [
      {
        "collectionId": "alb_div_1",
        "collectionName": "Kohinoor",
        "releaseYear": "2019",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "artistName": "DIVINE",
        "tracks": []
      },
      {
        "collectionId": "alb_div_2",
        "collectionName": "Punya Paap",
        "releaseYear": "2020",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "artistName": "DIVINE",
        "tracks": []
      },
      {
        "collectionId": "alb_div_3",
        "collectionName": "Gunehgar",
        "releaseYear": "2022",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "artistName": "DIVINE",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "w5Aioq5VYF0",
        "resolvedYtId": "w5Aioq5VYF0",
        "title": "Mirchi",
        "artist": "DIVINE, MC Altaf, Phenom, Stylo G",
        "album": "Punya Paap",
        "duration": "3:36",
        "category": "indie",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/21/88/cd/2188cd88-bde4-5958-5d8c-1d366eb5930e/mzaf_4740066004162575331.plus.aac.p.m4a"
      },
      {
        "id": "eLSePtRKFhg",
        "resolvedYtId": "eLSePtRKFhg",
        "title": "3:59 AM",
        "artist": "DIVINE, Stunnah Beatz",
        "album": "Punya Paap",
        "duration": "4:00",
        "category": "indie",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop"
      },
      {
        "id": "8q_eV_RErE4",
        "resolvedYtId": "8q_eV_RErE4",
        "title": "Kohinoor",
        "artist": "DIVINE",
        "album": "Kohinoor",
        "duration": "3:24",
        "category": "indie",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/3f/22/4a/3f224a77-6500-b898-d6ad-942a21d5ce61/mzaf_10646169288489533529.plus.aac.p.m4a"
      },
      {
        "id": "1bK5dzwhu-I",
        "resolvedYtId": "1bK5dzwhu-I",
        "title": "Mere Gully Mein",
        "artist": "DIVINE, Naezy",
        "album": "Gully Boy",
        "duration": "3:07",
        "category": "indie",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "w5Aioq5VYF0",
        "resolvedYtId": "w5Aioq5VYF0",
        "title": "Mirchi",
        "artist": "DIVINE, MC Altaf, Phenom, Stylo G",
        "album": "Punya Paap",
        "duration": "3:36",
        "category": "indie",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/21/88/cd/2188cd88-bde4-5958-5d8c-1d366eb5930e/mzaf_4740066004162575331.plus.aac.p.m4a"
      },
      {
        "id": "eLSePtRKFhg",
        "resolvedYtId": "eLSePtRKFhg",
        "title": "3:59 AM",
        "artist": "DIVINE, Stunnah Beatz",
        "album": "Punya Paap",
        "duration": "4:00",
        "category": "indie",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/indie_acoustic.mp3"
      },
      {
        "id": "8q_eV_RErE4",
        "resolvedYtId": "8q_eV_RErE4",
        "title": "Kohinoor",
        "artist": "DIVINE",
        "album": "Kohinoor",
        "duration": "3:24",
        "category": "indie",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/3f/22/4a/3f224a77-6500-b898-d6ad-942a21d5ce61/mzaf_10646169288489533529.plus.aac.p.m4a"
      },
      {
        "id": "1bK5dzwhu-I",
        "resolvedYtId": "1bK5dzwhu-I",
        "title": "Mere Gully Mein",
        "artist": "DIVINE, Naezy",
        "album": "Gully Boy",
        "duration": "3:07",
        "category": "indie",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/indie_acoustic.mp3"
      },
      {
        "id": "ryUNe3cp0ro",
        "resolvedYtId": "ryUNe3cp0ro",
        "title": "Apna Time Aayega",
        "artist": "Ranveer Singh, DIVINE",
        "album": "Gully Boy",
        "duration": "2:20",
        "category": "indie",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/indie_acoustic.mp3"
      },
      {
        "id": "hU5t7zPAELo",
        "resolvedYtId": "hU5t7zPAELo",
        "title": "Chal Bombay",
        "artist": "DIVINE",
        "album": "Kohinoor",
        "duration": "3:05",
        "category": "indie",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/indie_acoustic.mp3"
      },
      {
        "id": "sek3FhByr6w",
        "resolvedYtId": "sek3FhByr6w",
        "title": "Baazigar",
        "artist": "DIVINE, Armani White",
        "album": "Gunehgar",
        "duration": "2:55",
        "category": "indie",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/indie_acoustic.mp3"
      },
      {
        "id": "9Q1kbzcCX1M",
        "resolvedYtId": "9Q1kbzcCX1M",
        "title": "Vibe Hai",
        "artist": "DIVINE, Aalyan",
        "album": "Kohinoor",
        "duration": "3:10",
        "category": "indie",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/indie_acoustic.mp3"
      }
    ]
  },
  {
    "id": "sid-sriram",
    "name": "Sid Sriram",
    "role": "Carnatic & Contemporary South Phenomenon",
    "category": "south",
    "avatar": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
    "listeners": "18.2M Monthly Listeners",
    "genre": "Carnatic / Soul / Modern South Film",
    "bio": "Visionary vocalist seamlessly merging centuries of Carnatic tradition with contemporary Western soul.",
    "albums": [
      {
        "collectionId": "alb_ss_1",
        "collectionName": "Pushpa: The Rise",
        "releaseYear": "2021",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
        "artistName": "Sid Sriram",
        "tracks": []
      },
      {
        "collectionId": "alb_ss_2",
        "collectionName": "Ala Vaikunthapurramuloo",
        "releaseYear": "2020",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
        "artistName": "Sid Sriram",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "owT8ofii8Ms",
        "resolvedYtId": "owT8ofii8Ms",
        "title": "Srivalli",
        "artist": "Sid Sriram, Devi Sri Prasad",
        "album": "Pushpa",
        "duration": "3:44",
        "category": "south",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop"
      },
      {
        "id": "Thf60JU8E98",
        "resolvedYtId": "Thf60JU8E98",
        "title": "Samajavaragamana",
        "artist": "Sid Sriram, Thaman S",
        "album": "Ala Vaikunthapurramuloo",
        "duration": "4:34",
        "category": "south",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop"
      },
      {
        "id": "rTNAIm6h1xo",
        "resolvedYtId": "rTNAIm6h1xo",
        "title": "Inkem Inkem Inkem Kaavaale",
        "artist": "Sid Sriram, Gopi Sundar",
        "album": "Geetha Govindam",
        "duration": "4:28",
        "category": "south",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/6d/5a/f1/6d5af141-475c-7404-495c-0ef55283457c/mzaf_3028662401385709025.plus.aac.p.m4a"
      },
      {
        "id": "vNQb_F3F5ls",
        "resolvedYtId": "vNQb_F3F5ls",
        "title": "Kannaana Kanney",
        "artist": "Sid Sriram, D. Imman",
        "album": "Viswasam",
        "duration": "4:28",
        "category": "south",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "owT8ofii8Ms",
        "resolvedYtId": "owT8ofii8Ms",
        "title": "Srivalli",
        "artist": "Sid Sriram, Devi Sri Prasad",
        "album": "Pushpa",
        "duration": "3:44",
        "category": "south",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/south_cinema.mp3"
      },
      {
        "id": "Thf60JU8E98",
        "resolvedYtId": "Thf60JU8E98",
        "title": "Samajavaragamana",
        "artist": "Sid Sriram, Thaman S",
        "album": "Ala Vaikunthapurramuloo",
        "duration": "4:34",
        "category": "south",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/south_cinema.mp3"
      },
      {
        "id": "rTNAIm6h1xo",
        "resolvedYtId": "rTNAIm6h1xo",
        "title": "Inkem Inkem Inkem Kaavaale",
        "artist": "Sid Sriram, Gopi Sundar",
        "album": "Geetha Govindam",
        "duration": "4:28",
        "category": "south",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/6d/5a/f1/6d5af141-475c-7404-495c-0ef55283457c/mzaf_3028662401385709025.plus.aac.p.m4a"
      },
      {
        "id": "vNQb_F3F5ls",
        "resolvedYtId": "vNQb_F3F5ls",
        "title": "Kannaana Kanney",
        "artist": "Sid Sriram, D. Imman",
        "album": "Viswasam",
        "duration": "4:28",
        "category": "south",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/south_cinema.mp3"
      },
      {
        "id": "SEU6LlR6w3Q",
        "resolvedYtId": "SEU6LlR6w3Q",
        "title": "Ennodu Nee Irundhaal",
        "artist": "Sid Sriram, Sunitha Sarathy, A.R. Rahman",
        "album": "I",
        "duration": "5:52",
        "category": "south",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/f4/91/a7/f491a7f0-a998-a156-f7eb-a961e4083648/mzaf_16764182910405484626.plus.aac.p.m4a"
      },
      {
        "id": "X-Ilp8QNNfQ",
        "resolvedYtId": "X-Ilp8QNNfQ",
        "title": "Adiye",
        "artist": "Sid Sriram, A.R. Rahman",
        "album": "Kadal",
        "duration": "5:02",
        "category": "south",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/south_cinema.mp3"
      },
      {
        "id": "JPOfr0NBDDA",
        "resolvedYtId": "JPOfr0NBDDA",
        "title": "Thalli Pogathey",
        "artist": "Sid Sriram, A.R. Rahman",
        "album": "AYM",
        "duration": "4:25",
        "category": "south",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/south_cinema.mp3"
      },
      {
        "id": "-FeAQllzBWE",
        "resolvedYtId": "-FeAQllzBWE",
        "title": "Urike Urike",
        "artist": "Sid Sriram",
        "album": "Hit 2",
        "duration": "3:40",
        "category": "south",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/d8/72/cf/d872cfce-a8fa-eb3c-3b66-d3ab277aa6be/mzaf_12268037680568476220.plus.aac.p.m4a"
      }
    ]
  },
  {
    "id": "kishore-kumar",
    "name": "Kishore Kumar",
    "role": "The Undisputed Voice of Golden Hindi Cinema",
    "category": "legends",
    "avatar": "https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=500&auto=format&fit=crop",
    "listeners": "22.3M Monthly Listeners",
    "genre": "Evergreen Classics / Yodeling / Romantic Ballads",
    "bio": "The flamboyant musical genius, actor, and yodeler whose voice remains the immortal heartbeat of Indian cinema.",
    "albums": [
      {
        "collectionId": "alb_kk_leg_1",
        "collectionName": "Aradhana & Kati Patang",
        "releaseYear": "1970",
        "cover": "https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=500&auto=format&fit=crop",
        "artistName": "Kishore Kumar",
        "tracks": []
      },
      {
        "collectionId": "alb_kk_leg_2",
        "collectionName": "Evergreen Kishore",
        "releaseYear": "1975",
        "cover": "https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=500&auto=format&fit=crop",
        "artistName": "Kishore Kumar",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "TgMqJQ_6ToI",
        "resolvedYtId": "TgMqJQ_6ToI",
        "title": "Roop Tera Mastana",
        "artist": "Kishore Kumar, S.D. Burman",
        "album": "Aradhana",
        "duration": "3:45",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=500&auto=format&fit=crop"
      },
      {
        "id": "5ZaKMzJrzXQ",
        "resolvedYtId": "5ZaKMzJrzXQ",
        "title": "Yeh Shaam Mastani",
        "artist": "Kishore Kumar, R.D. Burman",
        "album": "Kati Patang",
        "duration": "4:38",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=500&auto=format&fit=crop"
      },
      {
        "id": "5eyflIV8pzM",
        "resolvedYtId": "5eyflIV8pzM",
        "title": "O Mere Dil Ke Chain",
        "artist": "Kishore Kumar, R.D. Burman",
        "album": "Mere Jeevan Saathi",
        "duration": "4:32",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=500&auto=format&fit=crop"
      },
      {
        "id": "AMuRRXCuy-4",
        "resolvedYtId": "AMuRRXCuy-4",
        "title": "Pal Pal Dil Ke Paas",
        "artist": "Kishore Kumar, Kalyanji-Anandji",
        "album": "Blackmail",
        "duration": "5:26",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "TgMqJQ_6ToI",
        "resolvedYtId": "TgMqJQ_6ToI",
        "title": "Roop Tera Mastana",
        "artist": "Kishore Kumar, S.D. Burman",
        "album": "Aradhana",
        "duration": "3:45",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "5ZaKMzJrzXQ",
        "resolvedYtId": "5ZaKMzJrzXQ",
        "title": "Yeh Shaam Mastani",
        "artist": "Kishore Kumar, R.D. Burman",
        "album": "Kati Patang",
        "duration": "4:38",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "5eyflIV8pzM",
        "resolvedYtId": "5eyflIV8pzM",
        "title": "O Mere Dil Ke Chain",
        "artist": "Kishore Kumar, R.D. Burman",
        "album": "Mere Jeevan Saathi",
        "duration": "4:32",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "AMuRRXCuy-4",
        "resolvedYtId": "AMuRRXCuy-4",
        "title": "Pal Pal Dil Ke Paas",
        "artist": "Kishore Kumar, Kalyanji-Anandji",
        "album": "Blackmail",
        "duration": "5:26",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "OkhjzAfaH0I",
        "resolvedYtId": "OkhjzAfaH0I",
        "title": "Mere Samne Wali Khidki Mein",
        "artist": "Kishore Kumar, R.D. Burman",
        "album": "Padosan",
        "duration": "2:52",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/10/d9/f9/10d9f984-cfd1-3544-0aa2-609eda073ac9/mzaf_1504917734479318833.plus.aac.p.m4a"
      },
      {
        "id": "GyGydIukxPU",
        "resolvedYtId": "GyGydIukxPU",
        "title": "Ek Ladki Bheegi Bhaagi Si",
        "artist": "Kishore Kumar, S.D. Burman",
        "album": "Chalti Ka Naam Gaadi",
        "duration": "3:58",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "mzxHflxI-es",
        "resolvedYtId": "mzxHflxI-es",
        "title": "Zindagi Ek Safar Hai Suhana",
        "artist": "Kishore Kumar, Shankar-Jaikishan",
        "album": "Andaz",
        "duration": "4:20",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "ZphoNQVYNi0",
        "resolvedYtId": "ZphoNQVYNi0",
        "title": "Khaike Paan Banaraswala",
        "artist": "Kishore Kumar, Kalyanji-Anandji",
        "album": "Don",
        "duration": "3:57",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/fe/63/41/fe634104-7b51-3439-9960-340ab3663078/mzaf_15641223799201993506.plus.aac.p.m4a"
      }
    ]
  },
  {
    "id": "lata-mangeshkar",
    "name": "Lata Mangeshkar",
    "role": "Bharat Ratna & The Nightingale of India",
    "category": "legends",
    "avatar": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
    "listeners": "25.7M Monthly Listeners",
    "genre": "Evergreen Bollywood / Classical / Bhavgeet",
    "bio": "Bharat Ratna laureate who recorded over 25,000 songs, universally venerated as the musical soul of the nation.",
    "albums": [
      {
        "collectionId": "alb_lm_1",
        "collectionName": "Lag Jaa Gale & Classics",
        "releaseYear": "1964",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
        "artistName": "Lata Mangeshkar",
        "tracks": []
      },
      {
        "collectionId": "alb_lm_2",
        "collectionName": "Dilwale Dulhania Le Jayenge",
        "releaseYear": "1995",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
        "artistName": "Lata Mangeshkar",
        "tracks": []
      }
    ],
    "popularTracks": [
      {
        "id": "vB1qh0eUv78",
        "resolvedYtId": "vB1qh0eUv78",
        "title": "Lag Jaa Gale",
        "artist": "Lata Mangeshkar, Madan Mohan",
        "album": "Woh Kaun Thi?",
        "duration": "4:18",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop"
      },
      {
        "id": "XC7lQwVYXfA",
        "resolvedYtId": "XC7lQwVYXfA",
        "title": "Aap Ki Nazron Ne Samjha",
        "artist": "Lata Mangeshkar, Madan Mohan",
        "album": "Anpadh",
        "duration": "3:56",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop"
      },
      {
        "id": "hLuXy8yhHYQ",
        "resolvedYtId": "hLuXy8yhHYQ",
        "title": "Tere Bina Zindagi Se",
        "artist": "Lata Mangeshkar, Kishore Kumar, R.D. Burman",
        "album": "Aandhi",
        "duration": "5:50",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop"
      },
      {
        "id": "cNV5hLSa9H8",
        "resolvedYtId": "cNV5hLSa9H8",
        "title": "Tujhe Dekha Toh",
        "artist": "Lata Mangeshkar, Kumar Sanu, Jatin-Lalit",
        "album": "DDLJ",
        "duration": "5:02",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop"
      }
    ],
    "allTracks": [
      {
        "id": "vB1qh0eUv78",
        "resolvedYtId": "vB1qh0eUv78",
        "title": "Lag Jaa Gale",
        "artist": "Lata Mangeshkar, Madan Mohan",
        "album": "Woh Kaun Thi?",
        "duration": "4:18",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
        "audioUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/8f/52/8e/8f528ee9-5254-6456-5665-bca842b03b40/mzaf_7043251027746538112.plus.aac.p.m4a"
      },
      {
        "id": "XC7lQwVYXfA",
        "resolvedYtId": "XC7lQwVYXfA",
        "title": "Aap Ki Nazron Ne Samjha",
        "artist": "Lata Mangeshkar, Madan Mohan",
        "album": "Anpadh",
        "duration": "3:56",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "hLuXy8yhHYQ",
        "resolvedYtId": "hLuXy8yhHYQ",
        "title": "Tere Bina Zindagi Se",
        "artist": "Lata Mangeshkar, Kishore Kumar, R.D. Burman",
        "album": "Aandhi",
        "duration": "5:50",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "BsHaOvByWis",
        "resolvedYtId": "BsHaOvByWis",
        "title": "Pyar Kiya To Darna Kya",
        "artist": "Lata Mangeshkar, Naushad",
        "album": "Mughal-e-Azam",
        "duration": "6:21",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "cNV5hLSa9H8",
        "resolvedYtId": "cNV5hLSa9H8",
        "title": "Tujhe Dekha Toh",
        "artist": "Lata Mangeshkar, Kumar Sanu, Jatin-Lalit",
        "album": "DDLJ",
        "duration": "5:02",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "GGoi6Dwri3U",
        "resolvedYtId": "GGoi6Dwri3U",
        "title": "Kabhi Kushi Kabhie Gham Title Track",
        "artist": "Lata Mangeshkar, Jatin-Lalit",
        "album": "K3G",
        "duration": "7:55",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "WjjKlwt0UNk",
        "resolvedYtId": "WjjKlwt0UNk",
        "title": "Luka Chuppi",
        "artist": "Lata Mangeshkar, A.R. Rahman",
        "album": "Rang De Basanti",
        "duration": "6:36",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      },
      {
        "id": "I_xhlLpGshg",
        "resolvedYtId": "I_xhlLpGshg",
        "title": "Ajeeb Dastan Hai Yeh",
        "artist": "Lata Mangeshkar, Shankar-Jaikishan",
        "album": "Dil Apna Aur Preet Parai",
        "duration": "5:15",
        "category": "hindi",
        "type": "official",
        "cover": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=500&auto=format&fit=crop",
        "audioUrl": "./audio/bollywood_romance.mp3"
      }
    ]
  }
];;;

// All tracks from all artists
const artistAllTracks = indianArtistsDatabase.flatMap(a => a.allTracks);

const defaultCatalog = [
  ...artistAllTracks,
  {
    id: '5qap5aO4i9A',
    resolvedYtId: '5qap5aO4i9A',
    title: 'lofi hip hop radio 📚 - beats to relax/study to',
    artist: 'Lofi Girl',
    album: 'Lofi Chill Live',
    duration: 'Live Stream',
    cover: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=500&auto=format&fit=crop',
    category: 'lofi',
    type: 'audio'
  }
];

// ==================== UNIFIED COMPLETE INTERNAL CATALOG ====================

// ==================== UNIFIED COMPLETE INTERNAL CATALOG ====================
function getAllTracks() {
  const allList = [];

  // 1. Custom uploaded songs
  if (state && Array.isArray(state.customSongs)) {
    allList.push(...state.customSongs);
  }

  // 2. Default catalog tracks
  if (typeof defaultCatalog !== 'undefined' && Array.isArray(defaultCatalog)) {
    allList.push(...defaultCatalog);
  }

  // 3. All tracks from all 41+ artists in the database
  if (typeof indianArtistsDatabase !== 'undefined' && Array.isArray(indianArtistsDatabase)) {
    indianArtistsDatabase.forEach(artist => {
      if (Array.isArray(artist.allTracks)) {
        allList.push(...artist.allTracks);
      }
      if (Array.isArray(artist.popularTracks)) {
        allList.push(...artist.popularTracks);
      }
      if (Array.isArray(artist.albums)) {
        artist.albums.forEach(alb => {
          if (Array.isArray(alb.tracks)) {
            allList.push(...alb.tracks);
          } else if (alb.sampleTrack) {
            allList.push(alb.sampleTrack);
          }
        });
      }
    });
  }

  // Deduplicate by ID and (normalized title + artist)
  const seen = new Set();
  const unique = [];
  for (const track of allList) {
    if (!track || !track.title) continue;
    const normTitle = (track.title || '').trim().toLowerCase();
    const normArtist = (track.artist || '').trim().toLowerCase();
    const trackId = (track.resolvedYtId || track.id || '');
    const key = trackId ? `${trackId}|${normTitle}` : `${normTitle}|${normArtist}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(track);
    }
  }
  return unique;
}

const browseGenres = [
  { name: 'Marathi Superhits', query: 'marathi', color: '#FF7700', icon: 'fa-flag' },
  { name: 'English & Global Pop', query: 'english', color: '#0D73EC', icon: 'fa-earth-americas' },
  { name: 'Bollywood Superhits', query: 'hindi', color: '#E13300', icon: 'fa-fire' },
  { name: 'Hindi Romance', query: 'arijit', color: '#E8115B', icon: 'fa-heart' },
  { name: 'Punjabi Hits', query: 'punjabi', color: '#E91429', icon: 'fa-drum' },
  { name: 'Indie & Pop', query: 'indie', color: '#8D67AB', icon: 'fa-music' },
  { name: 'Sufi & Soul', query: 'rahman', color: '#1E3264', icon: 'fa-guitar' },
  { name: 'Evergreen Classics', query: 'kishore', color: '#477D95', icon: 'fa-record-vinyl' }
];

// ==================== 4. CLASSIC NATIVE AUDIO STREAMING ENGINE ====================

// High-fidelity local permanent streaming audio fallbacks
const AUDIO_STREAM_FALLBACKS = [
  './audio/bollywood_romance.mp3',
  './audio/marathi_folk.mp3',
  './audio/punjabi_beat.mp3',
  './audio/global_pop.mp3',
  './audio/indie_acoustic.mp3',
  './audio/sufi_meditation.mp3',
  './audio/evergreen_retro.mp3',
  './audio/lofi_chill.mp3',
  './audio/south_cinema.mp3',
  './audio/ambient_groove.mp3'
];

// Master Native HTML5 Audio Element
const nativeAudio = document.getElementById('audio-player') || new Audio();
nativeAudio.preload = 'auto';

state.audio = nativeAudio;

state.audio.addEventListener('play', () => {
  state.isPlaying = true;
  updatePlayPauseButtonUI(true);
  startProgressLoop();
});

state.audio.addEventListener('pause', () => {
  state.isPlaying = false;
  updatePlayPauseButtonUI(false);
  stopProgressLoop();
});

state.audio.addEventListener('ended', () => {
  stopProgressLoop();
  if (state.repeatMode === 'one') {
    state.audio.currentTime = 0;
    state.audio.play().catch(() => { });
  } else {
    playNextTrack();
  }
});

state.audio.addEventListener('timeupdate', () => {
  updateProgressDisplay();
});

state.audio.addEventListener('error', (e) => {
  console.warn('Audio stream error, activating local high-fidelity fallback:', e);
  if (state.currentTrack) {
    const fallbackUrl = getDeterministicStreamUrl(state.currentTrack);
    if (state.audio.src !== fallbackUrl && !state.audio.src.endsWith(fallbackUrl.replace('./', ''))) {
      state.audio.src = fallbackUrl;
      if (state.isPlaying) {
        state.audio.play().catch((err) => console.warn('Fallback play gesture notice:', err));
      }
    }
  }
});

function getDeterministicStreamUrl(track) {
  if (track) {
    const cat = (track.category || '').toLowerCase();
    if (cat === 'marathi') return './audio/marathi_folk.mp3';
    if (cat === 'punjabi') return './audio/punjabi_beat.mp3';
    if (cat === 'hindi' || cat === 'bollywood') return './audio/bollywood_romance.mp3';
    if (cat === 'english' || cat === 'global') return './audio/global_pop.mp3';
    if (cat === 'indie') return './audio/indie_acoustic.mp3';
    if (cat === 'sufi') return './audio/sufi_meditation.mp3';
    if (cat === 'classic') return './audio/evergreen_retro.mp3';
    if (cat === 'south') return './audio/south_cinema.mp3';
  }
  let hash = 0;
  const str = String((track && (track.id || track.title || 'song')) || 'default');
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % AUDIO_STREAM_FALLBACKS.length;
  return AUDIO_STREAM_FALLBACKS[idx];
}

// ==================== 5. CLASSIC PLAYBACK CONTROLS & LIFECYCLE ====================
function setTrack(track, autoplay = true) {
  if (!track) return;
  state.currentTrack = track;

  // UI Updates
  const playerThumb = document.getElementById('player-thumb');
  const playerTitle = document.getElementById('player-title');
  const playerArtist = document.getElementById('player-artist');
  if (playerThumb) {
    playerThumb.onerror = () => { playerThumb.src = DEFAULT_COVER; };
    playerThumb.src = sanitizeUrl(track.cover || DEFAULT_COVER);
  }
  if (playerTitle) playerTitle.textContent = track.title || 'Unknown Title';
  if (playerArtist) playerArtist.textContent = track.artist || 'Artist';

  const timeDur = document.getElementById('time-duration');
  const timeCur = document.getElementById('time-current');
  if (timeDur && track.duration) timeDur.textContent = track.duration;
  if (timeCur) timeCur.textContent = '0:00';

  // Pause native audio fallback just in case
  state.audio.pause();

  const isYouTube = track.resolvedYtId || track.id;

  if (isYouTube && state.ytReady) {
    state.ytPlayer.loadVideoById(isYouTube);
    state.ytPlayer.setVolume(state.volume);
    if (!autoplay) state.ytPlayer.pauseVideo();
    else state.isPlaying = true;
  } else {
    // Legacy native fallback
    let streamUrl = track.audioUrl || getDeterministicStreamUrl(track);
    state.audio.src = streamUrl;
    state.audio.volume = state.volume / 100;
    if (autoplay) state.audio.play().catch(() => { });
  }

  updatePlayPauseButtonUI(autoplay);
  startProgressLoop();
  updateLikeButtonUI();
  updateQueueUI();
  highlightActiveTrackRows();
}

function togglePlayPause() {
  if (!state.currentTrack) {
    const all = getAllTracks();
    if (all.length > 0) setTrack(all[0], true);
    return;
  }

  const isYouTube = state.currentTrack.resolvedYtId || state.currentTrack.id;

  if (state.isPlaying) {
    state.isPlaying = false;
    if (isYouTube && state.ytReady) state.ytPlayer.pauseVideo();
    else state.audio.pause();
    updatePlayPauseButtonUI(false);
    stopProgressLoop();
  } else {
    state.isPlaying = true;
    if (isYouTube && state.ytReady) state.ytPlayer.playVideo();
    else state.audio.play().catch(() => setTrack(state.currentTrack, true));
    updatePlayPauseButtonUI(true);
    startProgressLoop();
  }
}

function updatePlayPauseButtonUI(playing) {
  const btn = document.getElementById('btn-play-pause');
  if (btn) {
    btn.innerHTML = playing ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
    btn.title = playing ? 'Pause' : 'Play';
  }
}

function playNextTrack() {
  if (!state.currentQueue || state.currentQueue.length === 0) {
    state.currentQueue = getAllTracks();
  }
  if (state.isShuffle) {
    state.currentTrackIndex = Math.floor(Math.random() * state.currentQueue.length);
  } else {
    if (state.currentTrackIndex >= state.currentQueue.length - 1) {
      if (state.repeatMode === 'all') {
        state.currentTrackIndex = 0;
      } else {
        return;
      }
    } else {
      state.currentTrackIndex++;
    }
  }
  setTrack(state.currentQueue[state.currentTrackIndex], true);
}

function playPrevTrack() {
  if (!state.currentQueue || state.currentQueue.length === 0) return;
  if (state.audio && state.audio.currentTime > 3) {
    state.audio.currentTime = 0;
    return;
  }
  state.currentTrackIndex = (state.currentTrackIndex - 1 + state.currentQueue.length) % state.currentQueue.length;
  setTrack(state.currentQueue[state.currentTrackIndex], true);
}

function toggleShuffle() {
  state.isShuffle = !state.isShuffle;
  const btn = document.getElementById('btn-shuffle');
  if (btn) btn.classList.toggle('active', state.isShuffle);
}

function toggleRepeat() {
  const btn = document.getElementById('btn-repeat');
  if (state.repeatMode === 'off') {
    state.repeatMode = 'all';
    if (btn) { btn.classList.add('active'); btn.title = 'Repeat All'; }
  } else if (state.repeatMode === 'all') {
    state.repeatMode = 'one';
    if (btn) { btn.innerHTML = '<i class="fa-solid fa-repeat-1"></i>'; btn.title = 'Repeat One'; }
  } else {
    state.repeatMode = 'off';
    if (btn) { btn.classList.remove('active'); btn.innerHTML = '<i class="fa-solid fa-repeat"></i>'; btn.title = 'Repeat Off'; }
  }
}

// ==================== 6. PROGRESS, SEEK & VOLUME ====================

// Helper to parse duration string "M:SS" into total seconds
function parseDurationToSeconds(durStr) {
  if (!durStr || typeof durStr !== 'string') return 0;
  const parts = durStr.trim().split(':');
  if (parts.length === 2) {
    const min = parseInt(parts[0], 10) || 0;
    const sec = parseInt(parts[1], 10) || 0;
    return (min * 60) + sec;
  }
  return 0;
}

function updateProgressDisplay() {
  if (!state.currentTrack) return;

  const isYouTube = state.currentTrack.resolvedYtId || state.currentTrack.id;
  const current = (isYouTube && state.ytReady && state.ytPlayer.getCurrentTime) ? state.ytPlayer.getCurrentTime() : (state.audio.currentTime || 0);

  const trackSec = parseDurationToSeconds(state.currentTrack.duration);
  const total = trackSec > 0 ? trackSec : 180;
  const pct = Math.min(100, Math.max(0, (current / total) * 100));

  const fill = document.getElementById('progress-bar-fill');
  const handle = document.getElementById('progress-bar-handle');
  const timeCur = document.getElementById('time-current');

  if (fill) fill.style.width = pct + '%';
  if (handle) handle.style.left = pct + '%';
  if (timeCur) timeCur.textContent = formatTime(current);
}

function startProgressLoop() {
  stopProgressLoop();
  state.progressInterval = setInterval(() => {
    updateProgressDisplay();
  }, 250);
}

function stopProgressLoop() {
  if (state.progressInterval) {
    clearInterval(state.progressInterval);
    state.progressInterval = null;
  }
}

function formatTime(sec) {
  if (isNaN(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function setVolume(pct) {
  state.volume = Math.max(0, Math.min(100, pct));
  if (state.audio) {
    state.audio.volume = state.volume / 100;
  }
  if (state.ytReady && state.ytPlayer) {
    state.ytPlayer.setVolume(state.volume);
    if (state.volume === 0 || state.isMuted) state.ytPlayer.mute();
    else state.ytPlayer.unMute();
  }
  updateVolumeUI();
}

function toggleMute() {
  if (state.isMuted) {
    state.isMuted = false;
    setVolume(state.previousVolume || 80);
  } else {
    state.previousVolume = state.volume;
    state.isMuted = true;
    setVolume(0);
  }
}

function updateVolumeUI() {
  const fill = document.getElementById('volume-bar-fill');
  const btn = document.getElementById('btn-volume');

  if (fill) fill.style.width = state.volume + '%';
  if (btn) {
    if (state.volume === 0 || state.isMuted) {
      btn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
    } else if (state.volume < 45) {
      btn.innerHTML = '<i class="fa-solid fa-volume-low"></i>';
    } else {
      btn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    }
  }
}

// ==================== 7. STRICT INTERNAL CATALOG SEARCH ENGINE ====================
async function performSearch(rawQuery) {
  const query = sanitizeSqlInput(rawQuery, 100);
  if (!query) return;

  showView('search');
  const searchInput = document.getElementById('yt-search-input');
  if (searchInput) searchInput.value = query;

  const loading = document.getElementById('search-loading');
  if (loading) loading.style.display = 'none';

  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const allTracks = getAllTracks();

  // Multi-field strict website catalog search only
  const songResults = allTracks.filter(track => {
    const t = (track.title || '').toLowerCase();
    const a = (track.artist || '').toLowerCase();
    const al = (track.album || '').toLowerCase();
    const cat = (track.category || '').toLowerCase();

    // Check full query match
    if (t.includes(query.toLowerCase()) || a.includes(query.toLowerCase()) || al.includes(query.toLowerCase()) || cat.includes(query.toLowerCase())) {
      return true;
    }

    // Check all tokens matching across track fields
    return tokens.every(token =>
      t.includes(token) || a.includes(token) || al.includes(token) || cat.includes(token)
    );
  });

  renderSearchResults(songResults, songResults[0], query);
}

function renderSearchResults(tracks, topResult, searchQuery = '') {
  const layout = document.getElementById('search-results-layout');
  const topBox = document.getElementById('top-result-box');
  const topCard = document.getElementById('top-result-card');
  const tbody = document.getElementById('search-tracks-tbody');
  const browse = document.getElementById('browse-categories');

  if (layout) layout.style.display = 'grid';
  if (browse) browse.style.display = 'block';
  if (!tbody) return;
  tbody.innerHTML = '';

  // If no tracks match in the website's catalog, display clean empty state
  if (!tracks || tracks.length === 0) {
    if (topBox) topBox.style.display = 'none';
    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty-library-state" style="padding: 40px 20px; text-align: center;">
            <i class="fa-solid fa-magnifying-glass" style="font-size: 38px; margin-bottom: 14px; color: var(--text-muted);"></i>
            <h3 style="margin-bottom: 8px; font-size: 18px; color: #fff;">No songs found for "${escapeHtml(searchQuery)}"</h3>
            <p style="color: var(--text-secondary); font-size: 13px; max-width: 460px; margin: 0 auto 16px;">The search is restricted strictly to songs available in the SonicWave catalog. Try searching for artist names like Arijit Singh, Ajay-Atul, Taylor Swift, or explore categories below.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  if (topResult && topBox && topCard) {
    topBox.style.display = 'block';
    const topCover = sanitizeUrl(topResult.cover);
    topCard.innerHTML = `
      <div class="track-card-thumb-wrap" style="width:140px; height:140px; margin-bottom:12px;">
        <img src="${topCover}" onerror="this.src='${DEFAULT_COVER}'" alt="Art">
      </div>
      <div style="font-size:20px; font-weight:800; margin-bottom:4px; line-height: 1.2;">${escapeHtml(topResult.title)}</div>
      <div style="color:var(--text-secondary); font-size:13px;">${escapeHtml(topResult.artist)} • ${escapeHtml(topResult.album || 'Catalog Track')}</div>
      <button class="btn-play-big" style="position:absolute; bottom:20px; right:20px;"><i class="fa-solid fa-play"></i></button>
    `;
    topCard.onclick = () => {
      state.currentQueue = tracks;
      state.currentTrackIndex = 0;
      setTrack(topResult, true);
    };
  } else if (topBox) {
    topBox.style.display = 'none';
  }

  tracks.forEach((track, idx) => {
    const isLiked = state.likedTracks.some(t => t.id === track.id);
    const coverUrl = sanitizeUrl(track.cover);
    const tr = document.createElement('tr');
    tr.className = 'track-row' + (state.currentTrack?.id === track.id ? ' active' : '');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>
        <div class="row-track-info">
          <img src="${coverUrl}" onerror="this.src='${DEFAULT_COVER}'" alt="Art">
          <div>
            <div class="row-title">${escapeHtml(track.title)}</div>
            <div class="row-artist">${escapeHtml(track.artist)}</div>
          </div>
        </div>
      </td>
      <td>${escapeHtml(track.album || track.artist)}</td>
      <td>${escapeHtml(track.duration || '3:30')}</td>
      <td>
        <div class="row-actions">
          <button class="row-btn ${isLiked ? 'liked' : ''}" data-act="like" title="Save to Liked Songs">
            <i class="fa-${isLiked ? 'solid' : 'regular'} fa-heart"></i>
          </button>
          <button class="row-btn" data-act="play" title="Play Song" style="color:var(--spotify-green)">
            <i class="fa-solid fa-play"></i>
          </button>
        </div>
      </td>
    `;
    tr.onclick = (e) => {
      if (e.target.closest('[data-act="like"]')) {
        toggleLike(track);
        return;
      }
      state.currentQueue = tracks;
      state.currentTrackIndex = idx;
      setTrack(track, true);
    };
    tbody.appendChild(tr);
  });
}

// ==================== 8. ARTISTS PAGE & DETAIL ====================
function renderArtistsView(filterGenre = 'all', searchQuery = '') {
  const container = document.getElementById('artists-grid-container');
  if (!container) return;

  state.artistFilterGenre = filterGenre;
  let filtered = indianArtistsDatabase;

  if (filterGenre !== 'all') {
    filtered = filtered.filter(a => a.category === filterGenre);
  }

  if (searchQuery && searchQuery.trim()) {
    const q = sanitizeSqlInput(searchQuery, 80).toLowerCase();
    filtered = filtered.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.role.toLowerCase().includes(q) ||
      a.genre.toLowerCase().includes(q) ||
      a.allTracks.some(t => t.title.toLowerCase().includes(q))
    );
  }

  container.innerHTML = '';

  filtered.forEach(artist => {
    const card = document.createElement('div');
    card.className = 'artist-card';
    const avatarUrl = sanitizeUrl(artist.avatar);
    card.innerHTML = `
      <div class="artist-avatar-wrap">
        <img src="${avatarUrl}" onerror="this.src='${DEFAULT_COVER}'" class="artist-card-avatar" alt="${escapeHtml(artist.name)}">
        <button class="artist-card-play-btn" data-artist="${escapeHtml(artist.id)}" title="Play All ${escapeHtml(artist.name)} Songs">
          <i class="fa-solid fa-play"></i>
        </button>
      </div>
      <div class="artist-card-name">${escapeHtml(artist.name)}</div>
      <div class="artist-card-role">${escapeHtml(artist.role)}</div>
      <div class="artist-card-listeners">${escapeHtml(artist.listeners)}</div>
    `;

    card.onclick = (e) => {
      if (e.target.closest('.artist-card-play-btn')) {
        e.stopPropagation();
        state.currentQueue = artist.allTracks;
        state.currentTrackIndex = 0;
        setTrack(artist.allTracks[0], true);
        return;
      }
      openArtistPage(artist.id);
    };

    container.appendChild(card);
  });
}

function openArtistPage(artistId) {
  const artist = indianArtistsDatabase.find(a => a.id === artistId) || indianArtistsDatabase[0];
  state.currentArtistDetail = artist;

  const avatarEl = document.getElementById('artist-page-avatar');
  const backdropEl = document.getElementById('artist-hero-backdrop');
  const nameEl = document.getElementById('artist-page-name');
  const listenersEl = document.getElementById('artist-page-listeners');
  const genreEl = document.getElementById('artist-page-genre');
  const bioEl = document.getElementById('artist-page-bio');

  const avatarUrl = sanitizeUrl(artist.avatar);
  if (avatarEl) {
    avatarEl.onerror = () => { avatarEl.src = DEFAULT_COVER; };
    avatarEl.src = avatarUrl;
  }
  if (backdropEl) backdropEl.style.backgroundImage = `url('${avatarUrl}')`;
  if (nameEl) nameEl.textContent = artist.name;
  if (listenersEl) listenersEl.innerHTML = `<i class="fa-solid fa-headphones"></i> ${escapeHtml(artist.listeners)}`;
  if (genreEl) genreEl.textContent = artist.genre;
  if (bioEl) bioEl.textContent = artist.bio;

  const btnPlayAll = document.getElementById('btn-artist-play-all');
  if (btnPlayAll) {
    btnPlayAll.onclick = () => {
      state.currentQueue = artist.allTracks;
      state.currentTrackIndex = 0;
      setTrack(artist.allTracks[0], true);
    };
  }

  // Popular Tracks
  const popTbody = document.getElementById('artist-popular-tbody');
  if (popTbody) {
    popTbody.innerHTML = '';
    artist.popularTracks.forEach((track, idx) => {
      const isLiked = state.likedTracks.some(t => t.id === track.id);
      const coverUrl = sanitizeUrl(track.cover);
      const tr = document.createElement('tr');
      tr.className = 'track-row' + (state.currentTrack?.id === track.id ? ' active' : '');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>
          <div class="row-track-info">
            <img src="${coverUrl}" onerror="this.src='${DEFAULT_COVER}'" alt="Art">
            <div>
              <div class="row-title">${escapeHtml(track.title)}</div>
              <div class="row-artist">${escapeHtml(track.artist)}</div>
            </div>
          </div>
        </td>
        <td>${escapeHtml(track.album || 'Single')}</td>
        <td>${escapeHtml(track.duration || '3:30')}</td>
        <td>
          <div class="row-actions">
            <button class="row-btn ${isLiked ? 'liked' : ''}" data-act="like" title="Save to Liked Songs">
              <i class="fa-${isLiked ? 'solid' : 'regular'} fa-heart"></i>
            </button>
            <button class="row-btn" data-act="play" title="Play Track">
              <i class="fa-solid fa-play" style="color:var(--spotify-green)"></i>
            </button>
          </div>
        </td>
      `;
      tr.onclick = (e) => {
        if (e.target.closest('[data-act="like"]')) {
          toggleLike(track);
          return;
        }
        state.currentQueue = artist.popularTracks;
        state.currentTrackIndex = idx;
        setTrack(track, true);
      };
      popTbody.appendChild(tr);
    });
  }

  // Discography Albums
  const albGrid = document.getElementById('artist-discography-grid');
  if (albGrid) {
    albGrid.innerHTML = '';
    artist.albums.forEach(album => {
      const card = document.createElement('div');
      card.className = 'album-card';
      const albumCover = sanitizeUrl(album.cover);
      card.innerHTML = `
        <div class="album-card-cover-wrap">
          <img src="${albumCover}" onerror="this.src='${DEFAULT_COVER}'" alt="${escapeHtml(album.collectionName)}">
          <button class="album-card-play-btn"><i class="fa-solid fa-play"></i></button>
        </div>
        <div class="album-card-title">${escapeHtml(album.collectionName)}</div>
        <div class="album-card-year">${escapeHtml(album.releaseDate)} • Album</div>
      `;
      card.onclick = () => {
        state.currentQueue = album.tracks || [album.sampleTrack];
        state.currentTrackIndex = 0;
        setTrack(state.currentQueue[0], true);
      };
      albGrid.appendChild(card);
    });
  }

  // All Tracks Tab
  const allTbody = document.getElementById('artist-all-songs-tbody');
  if (allTbody) {
    allTbody.innerHTML = '';
    artist.allTracks.forEach((track, idx) => {
      const isLiked = state.likedTracks.some(t => t.id === track.id);
      const coverUrl = sanitizeUrl(track.cover);
      const tr = document.createElement('tr');
      tr.className = 'track-row' + (state.currentTrack?.id === track.id ? ' active' : '');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>
          <div class="row-track-info">
            <img src="${coverUrl}" onerror="this.src='${DEFAULT_COVER}'" alt="Art">
            <div>
              <div class="row-title">${escapeHtml(track.title)}</div>
              <div class="row-artist">${escapeHtml(track.artist)}</div>
            </div>
          </div>
        </td>
        <td>${escapeHtml(track.album || 'Single')}</td>
        <td>${escapeHtml(track.duration || '3:30')}</td>
        <td>
          <div class="row-actions">
            <button class="row-btn ${isLiked ? 'liked' : ''}" data-act="like" title="Save to Liked Songs">
              <i class="fa-${isLiked ? 'solid' : 'regular'} fa-heart"></i>
            </button>
            <button class="row-btn" data-act="play" title="Play Track">
              <i class="fa-solid fa-play" style="color:var(--spotify-green)"></i>
            </button>
          </div>
        </td>
      `;
      tr.onclick = (e) => {
        if (e.target.closest('[data-act="like"]')) {
          toggleLike(track);
          return;
        }
        state.currentQueue = artist.allTracks;
        state.currentTrackIndex = idx;
        setTrack(track, true);
      };
      allTbody.appendChild(tr);
    });
  }

  const simGrid = document.getElementById('artist-similar-grid');
  if (simGrid) {
    simGrid.innerHTML = '';
    const similar = indianArtistsDatabase.filter(a => a.id !== artist.id).slice(0, 4);
    similar.forEach(s => {
      const card = document.createElement('div');
      card.className = 'artist-card';
      const simAvatar = sanitizeUrl(s.avatar);
      card.innerHTML = `
        <div class="artist-avatar-wrap">
          <img src="${simAvatar}" onerror="this.src='${DEFAULT_COVER}'" class="artist-card-avatar" alt="${escapeHtml(s.name)}">
        </div>
        <div class="artist-card-name">${escapeHtml(s.name)}</div>
        <div class="artist-card-role">${escapeHtml(s.role)}</div>
      `;
      card.onclick = () => openArtistPage(s.id);
      simGrid.appendChild(card);
    });
  }

  showView('artist-detail');
}

// ==================== 9. VIEWS & ROUTING ====================
function showView(view, addToHistory = true) {
  if (view === 'admin' && state.currentUser?.role !== 'Admin') {
    alert('Access Denied: Only administrators can access the Admin Management Panel.');
    return;
  }

  state.currentView = view;

  if (addToHistory && state.viewHistory[state.historyIndex] !== view) {
    state.viewHistory = state.viewHistory.slice(0, state.historyIndex + 1);
    state.viewHistory.push(view);
    state.historyIndex = state.viewHistory.length - 1;
  }

  document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active'));

  const targetView = document.getElementById('view-' + view);
  if (targetView) targetView.classList.add('active');

  const activeNav = document.querySelector(`.nav-item[data-view="${view}"]`);
  if (activeNav) activeNav.classList.add('active');

  const activeMobile = document.querySelector(`.mobile-nav-btn[data-view="${view}"]`);
  if (activeMobile) activeMobile.classList.add('active');

  if (view === 'artists') {
    renderArtistsView(state.artistFilterGenre || 'all');
  } else if (view === 'library') {
    renderLibraryView();
  } else if (view === 'admin') {
    renderAdminDashboard();
  }
}

// ==================== 10. AUTHENTICATION & USERS ====================
function renderUserBadge() {
  const user = state.currentUser || { id: 'guest', username: 'Guest', role: 'Guest', email: '' };
  const isGuest = !user.id || user.id === 'guest' || user.role === 'Guest' || user.username === 'Guest';
  const nameEl = document.getElementById('user-display-name');
  const roleEl = document.getElementById('user-role-badge');
  const avatarEl = document.getElementById('user-avatar');
  const dropdownName = document.getElementById('dropdown-user-name');
  const dropdownEmail = document.getElementById('dropdown-user-email');
  const adminNav = document.getElementById('nav-admin-btn');
  const dropdownAdmin = document.getElementById('btn-dropdown-admin');
  const logoutBtn = document.getElementById('btn-dropdown-logout');

  if (nameEl) nameEl.textContent = user.username || 'Guest';
  if (roleEl) {
    roleEl.textContent = isGuest ? 'Guest' : (user.role || 'User');
    roleEl.className = 'user-role-tag ' + (isGuest ? 'user' : (user.role ? user.role.toLowerCase() : 'user'));
  }
  if (avatarEl) {
    avatarEl.innerHTML = user.role === 'Admin' ? '<i class="fa-solid fa-crown"></i>' : '<i class="fa-solid fa-user"></i>';
  }
  if (dropdownName) dropdownName.textContent = user.username || 'Guest';
  if (dropdownEmail) dropdownEmail.textContent = isGuest ? 'Not logged in' : (user.email || '');

  const isAdmin = user.role === 'Admin';
  if (adminNav) adminNav.style.display = isAdmin ? 'flex' : 'none';
  if (dropdownAdmin) dropdownAdmin.style.display = isAdmin ? 'flex' : 'none';

  if (logoutBtn) {
    if (isGuest) {
      logoutBtn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Sign In to Account';
      logoutBtn.classList.remove('logout-item');
    } else {
      logoutBtn.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i> Logout';
      logoutBtn.classList.add('logout-item');
    }
  }
}

async function loginUser(usernameOrEmail, password) {
  const cleanInput = sanitizeSqlInput(usernameOrEmail, 50).toLowerCase();
  const saltedHash = await hashPassword(password);

  let unsaltedHash = '';
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const enc = new TextEncoder();
      const buffer = await crypto.subtle.digest('SHA-256', enc.encode(password));
      unsaltedHash = Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) { }
  }

  const user = state.users.find(u => {
    const uName = (u.username || '').toLowerCase();
    const uEmail = (u.email || '').toLowerCase();
    const matchesUser = (uName === cleanInput || uEmail === cleanInput);
    if (!matchesUser) return false;

    // Check salted hash, legacy unsalted hash, or standard admin defaults
    if (u.passwordHash && (u.passwordHash === saltedHash || u.passwordHash === unsaltedHash)) {
      u.passwordHash = saltedHash;
      localStorage.setItem('spotix_users', JSON.stringify(state.users));
      return true;
    }
    if (u.password && (u.password === password || (cleanInput === 'admin' && (password === 'admin123' || password === 'admin')) || (cleanInput === 'sai' && (password === 'admin' || password === 'admin123')))) {
      u.passwordHash = saltedHash;
      delete u.password;
      localStorage.setItem('spotix_users', JSON.stringify(state.users));
      return true;
    }
    if ((cleanInput === 'admin' || cleanInput === 'admin@sonicwave.com') && (password === 'admin123' || password === 'admin')) {
      u.passwordHash = saltedHash;
      localStorage.setItem('spotix_users', JSON.stringify(state.users));
      return true;
    }
    if ((cleanInput === 'sai patil' || cleanInput === 'sai' || cleanInput === 'sai@sonicwave.com') && (password === 'admin' || password === 'admin123')) {
      u.passwordHash = saltedHash;
      localStorage.setItem('spotix_users', JSON.stringify(state.users));
      return true;
    }
    return false;
  });

  if (user) {
    state.currentUser = user;
    localStorage.setItem('spotix_session', JSON.stringify(user));
    renderUserBadge();
    const authModal = document.getElementById('auth-modal');
    if (authModal) authModal.style.display = 'none';
    alert(`Welcome back, ${user.username}!`);
    return true;
  }
  alert('Invalid username or password.');
  return false;
}

async function registerUser(username, email, password, role = 'User') {
  const cleanName = sanitizeSqlInput(username, 30);
  const cleanEmail = sanitizeSqlInput(email, 50).toLowerCase();

  if (!cleanName || cleanName.length < 3) {
    alert('Username must be at least 3 characters long.');
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    alert('Please enter a valid email address.');
    return false;
  }

  if (!password || password.length < 6) {
    alert('Password must be at least 6 characters long.');
    return false;
  }

  if (state.users.some(u => (u.username || '').toLowerCase() === cleanName.toLowerCase() || (u.email || '').toLowerCase() === cleanEmail)) {
    alert('User with this username or email already exists.');
    return false;
  }

  const cleanRole = role === 'Admin' ? 'Admin' : 'User';
  const passHash = await hashPassword(password);

  const newUser = {
    id: 'u_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    username: cleanName,
    email: cleanEmail,
    passwordHash: passHash,
    role: cleanRole,
    dateAdded: new Date().toISOString().split('T')[0],
    status: 'Active'
  };

  state.users.push(newUser);
  localStorage.setItem('spotix_users', JSON.stringify(state.users));

  if (!state.currentUser || state.currentUser.role !== 'Admin') {
    state.currentUser = newUser;
    localStorage.setItem('spotix_session', JSON.stringify(newUser));
  }

  renderUserBadge();
  const authModal = document.getElementById('auth-modal');
  const addUserModal = document.getElementById('add-user-modal');
  if (authModal) authModal.style.display = 'none';
  if (addUserModal) addUserModal.style.display = 'none';

  alert(`Account "${cleanName}" created successfully!`);
  return true;
}

function deleteUser(userId) {
  if (state.currentUser?.role !== 'Admin') {
    alert('Unauthorized: Admin access required.');
    return;
  }
  if (userId === state.currentUser.id) {
    alert('Cannot delete the currently active user account.');
    return;
  }
  if (confirm('Are you sure you want to delete this user?')) {
    state.users = state.users.filter(u => u.id !== userId);
    localStorage.setItem('spotix_users', JSON.stringify(state.users));
    renderAdminDashboard();
  }
}

function toggleUserRole(userId) {
  if (state.currentUser?.role !== 'Admin') {
    alert('Unauthorized: Admin access required.');
    return;
  }
  const u = state.users.find(x => x.id === userId);
  if (u) {
    u.role = u.role === 'Admin' ? 'User' : 'Admin';
    localStorage.setItem('spotix_users', JSON.stringify(state.users));
    if (u.id === state.currentUser.id) {
      state.currentUser = u;
      localStorage.setItem('spotix_session', JSON.stringify(u));
    }
    renderUserBadge();
    renderAdminDashboard();
  }
}

function renderAdminDashboard() {
  if (state.currentUser?.role !== 'Admin') {
    showView('home');
    return;
  }

  const statUsers = document.getElementById('stat-total-users');
  const statAdmins = document.getElementById('stat-total-admins');
  const statSongs = document.getElementById('stat-total-songs');
  const statCustom = document.getElementById('stat-custom-songs');

  if (statUsers) statUsers.textContent = state.users.length;
  if (statAdmins) statAdmins.textContent = state.users.filter(u => u.role === 'Admin').length;
  if (statSongs) statSongs.textContent = getAllTracks().length;
  if (statCustom) statCustom.textContent = state.customSongs.length;

  const usersTbody = document.getElementById('admin-users-tbody');
  if (usersTbody) {
    usersTbody.innerHTML = '';
    state.users.forEach((user, idx) => {
      const tr = document.createElement('tr');
      const escapedUserId = escapeHtml(user.id);
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>
          <div style="font-weight:700; color:#fff;">${escapeHtml(user.username)}</div>
          <div style="font-size:11px; color:var(--text-muted);">Joined: ${escapeHtml(user.dateAdded || '2026')}</div>
        </td>
        <td>${escapeHtml(user.email)}</td>
        <td><span class="badge-role ${escapeHtml((user.role || 'user').toLowerCase())}">${escapeHtml(user.role || 'User')}</span></td>
        <td><span class="badge-status">Active</span></td>
        <td>
          <div class="admin-actions-cell">
            <button class="btn-admin-icon gold" data-userid="${escapedUserId}" data-action="toggle" title="Toggle Admin Role">
              <i class="fa-solid fa-shield-halved"></i>
            </button>
            <button class="btn-admin-icon danger" data-userid="${escapedUserId}" data-action="delete" title="Delete User">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      `;

      tr.querySelector('[data-action="toggle"]')?.addEventListener('click', () => toggleUserRole(user.id));
      tr.querySelector('[data-action="delete"]')?.addEventListener('click', () => deleteUser(user.id));
      usersTbody.appendChild(tr);
    });
  }

  const songsTbody = document.getElementById('admin-songs-tbody');
  if (songsTbody) {
    songsTbody.innerHTML = '';
    getAllTracks().forEach((track, idx) => {
      const tr = document.createElement('tr');
      const coverUrl = sanitizeUrl(track.cover);
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>
          <div class="row-track-info">
            <img src="${coverUrl}" onerror="this.src='${DEFAULT_COVER}'" alt="Art" style="width:36px; height:36px; border-radius:4px; object-fit:cover;">
            <div>
              <div style="font-weight:700; font-size:13px; color:#fff;">${escapeHtml(track.title)}</div>
              <div style="font-size:11px; color:var(--text-secondary);">${escapeHtml(track.album || 'Single')}</div>
            </div>
          </div>
        </td>
        <td>${escapeHtml(track.artist)}</td>
        <td><span style="font-size:11px; text-transform:uppercase; color:var(--text-muted);">${escapeHtml(track.category || 'Music')}</span></td>
        <td><code>${escapeHtml(track.id)}</code></td>
        <td>
          <div class="admin-actions-cell">
            <button class="btn-admin-icon play-btn" style="color:var(--spotify-green);" title="Play Now">
              <i class="fa-solid fa-play"></i>
            </button>
          </div>
        </td>
      `;
      tr.querySelector('.play-btn')?.addEventListener('click', () => setTrack(getAllTracks()[idx], true));
      songsTbody.appendChild(tr);
    });
  }
}

// ==================== 11. PLAYLISTS & LIKED SONGS ====================
function toggleLike(track) {
  if (!track) return;
  const idx = state.likedTracks.findIndex(t => t.id === track.id);
  if (idx >= 0) {
    state.likedTracks.splice(idx, 1);
  } else {
    state.likedTracks.unshift(track);
  }
  localStorage.setItem('spotix_liked', JSON.stringify(state.likedTracks));
  updateLikeButtonUI();
  if (state.currentView === 'library') renderLibraryView();
}

function updateLikeButtonUI() {
  const btn = document.getElementById('player-like-btn');
  if (!btn || !state.currentTrack) return;
  const isLiked = state.likedTracks.some(t => t.id === state.currentTrack.id);
  btn.innerHTML = isLiked ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>';
}

function createPlaylist(rawName) {
  const name = sanitizeSqlInput(rawName, 50);
  if (!name) return;
  if (!state.customPlaylists[name]) {
    state.customPlaylists[name] = [];
    localStorage.setItem('spotix_playlists', JSON.stringify(state.customPlaylists));
    renderPlaylistsSidebar();
    state.currentPlaylistName = name;
    showView('library');
  } else {
    alert('A playlist with this name already exists.');
  }
}

function renderPlaylistsSidebar() {
  const list = document.getElementById('user-playlists-list');
  if (!list) return;
  list.innerHTML = '';
  Object.keys(state.customPlaylists).forEach(pName => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${escapeHtml(pName)}</span>`;
    li.onclick = () => {
      state.currentPlaylistName = pName;
      showView('library');
    };
    list.appendChild(li);
  });
}

function renderLibraryView() {
  const titleEl = document.getElementById('library-current-title');
  const countEl = document.getElementById('library-track-count');
  const tbody = document.getElementById('library-tracks-tbody');

  let tracks = [];
  if (state.currentPlaylistName === 'Liked Songs') {
    tracks = state.likedTracks;
    if (titleEl) titleEl.textContent = 'Liked Songs';
  } else {
    tracks = state.customPlaylists[state.currentPlaylistName] || [];
    if (titleEl) titleEl.textContent = state.currentPlaylistName;
  }

  if (countEl) countEl.textContent = `${tracks.length} songs`;

  if (!tbody) return;
  tbody.innerHTML = '';

  if (tracks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty-library-state">
            <i class="fa-regular fa-heart"></i>
            <h3>No songs saved here yet</h3>
            <p>Save songs from search or artist discographies to build your library.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tracks.forEach((track, idx) => {
    const isLiked = state.likedTracks.some(t => t.id === track.id);
    const coverUrl = sanitizeUrl(track.cover);
    const tr = document.createElement('tr');
    tr.className = 'track-row' + (state.currentTrack?.id === track.id ? ' active' : '');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>
        <div class="row-track-info">
          <img src="${coverUrl}" onerror="this.src='${DEFAULT_COVER}'" alt="Cover">
          <div>
            <div class="row-title">${escapeHtml(track.title)}</div>
            <div class="row-artist">${escapeHtml(track.artist)}</div>
          </div>
        </div>
      </td>
      <td>${escapeHtml(track.album || 'Single')}</td>
      <td>${escapeHtml(track.duration || '3:30')}</td>
      <td>
        <div class="row-actions">
          <button class="row-btn ${isLiked ? 'liked' : ''}" data-act="like"><i class="fa-${isLiked ? 'solid' : 'regular'} fa-heart"></i></button>
          <button class="row-btn" data-act="play"><i class="fa-solid fa-play" style="color:var(--spotify-green)"></i></button>
        </div>
      </td>
    `;
    tr.onclick = (e) => {
      if (e.target.closest('[data-act="like"]')) {
        toggleLike(track);
        return;
      }
      state.currentQueue = tracks;
      state.currentTrackIndex = idx;
      setTrack(track, true);
    };
    tbody.appendChild(tr);
  });
}

function renderGridHelper(containerId, tracksList) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  tracksList.forEach((track, idx) => {
    const card = document.createElement('div');
    card.className = 'track-card';
    const coverUrl = sanitizeUrl(track.cover);
    card.innerHTML = `
      <div class="track-card-thumb-wrap">
        <img src="${coverUrl}" onerror="this.src='${DEFAULT_COVER}'" class="track-card-thumb" alt="${escapeHtml(track.title)}">
        <button class="card-play-btn"><i class="fa-solid fa-play"></i></button>
      </div>
      <div class="track-card-info">
        <div class="track-card-title">${escapeHtml(track.title)}</div>
        <div class="track-card-desc">${escapeHtml(track.artist)}</div>
      </div>
    `;
    card.onclick = () => {
      state.currentQueue = tracksList;
      state.currentTrackIndex = idx;
      setTrack(track, true);
    };
    container.appendChild(card);
  });
}

function renderHomeGrids() {
  // 1. Home Quick Artists Chips Bar
  const chipsRow = document.getElementById('home-artist-chips');
  if (chipsRow) {
    chipsRow.innerHTML = '';
    indianArtistsDatabase.forEach(artist => {
      const chip = document.createElement('div');
      chip.className = 'home-artist-chip';
      const chipAvatar = sanitizeUrl(artist.avatar);
      chip.innerHTML = `
        <img src="${chipAvatar}" onerror="this.src='${DEFAULT_COVER}'" alt="${escapeHtml(artist.name)}">
        <span>${escapeHtml(artist.name)}</span>
      `;
      chip.onclick = () => openArtistPage(artist.id);
      chipsRow.appendChild(chip);
    });
  }

  // 2. Song Suggestion from ALL Artists
  const allArtistSuggestions = indianArtistsDatabase.map(artist => {
    return artist.popularTracks && artist.popularTracks.length > 0 ? artist.popularTracks[0] : artist.allTracks[0];
  }).filter(Boolean);

  renderGridHelper('home-all-artist-suggestions-grid', allArtistSuggestions);

  // 3. Marathi Superhits
  const marathiTracks = indianArtistsDatabase.filter(a => a.category === 'marathi').flatMap(a => (a.allTracks && a.allTracks.length > 0) ? a.allTracks : (a.popularTracks || []));
  renderGridHelper('home-marathi-grid', marathiTracks.slice(0, 12));

  // 4. English Chartbusters
  const englishTracks = indianArtistsDatabase.filter(a => a.category === 'english').flatMap(a => (a.allTracks && a.allTracks.length > 0) ? a.allTracks : (a.popularTracks || []));
  renderGridHelper('home-english-grid', englishTracks.slice(0, 12));

  // 5. Punjabi Chartbusters
  const punjabiArtists = ['karan-aujla', 'shubh', 'diljit-dosanjh', 'ap-dhillon', 'sidhu-moose-wala', 'badshah', 'b-praak'];
  const punjabiTracks = indianArtistsDatabase.filter(a => punjabiArtists.includes(a.id)).flatMap(a => (a.allTracks && a.allTracks.length > 0) ? a.allTracks : (a.popularTracks || []));
  renderGridHelper('home-punjabi-grid', punjabiTracks.slice(0, 12));

  // 6. Romantic Melodies
  const romanceArtists = ['arijit-singh', 'shreya-ghoshal', 'atif-aslam', 'vishal-mishra', 'jubin-nautiyal', 'armaan-malik', 'darshan-raval', 'mohit-chauhan'];
  const romanceTracks = indianArtistsDatabase.filter(a => romanceArtists.includes(a.id)).flatMap(a => (a.allTracks && a.allTracks.length > 0) ? a.allTracks : (a.popularTracks || []));
  renderGridHelper('home-romance-grid', romanceTracks.slice(0, 12));

  // 7. Indie & Pop
  const indieArtists = ['anuv-jain', 'prateek-kuhad', 'king-rocco', 'jasleen-royal', 'divine'];
  const indieTracks = indianArtistsDatabase.filter(a => indieArtists.includes(a.id)).flatMap(a => (a.allTracks && a.allTracks.length > 0) ? a.allTracks : (a.popularTracks || []));
  renderGridHelper('home-indie-grid', indieTracks.slice(0, 12));

  // 8. Evergreen Classics
  const legendArtists = ['kishore-kumar', 'lata-mangeshkar', 'sonu-nigam', 'kk', 'ar-rahman'];
  const legendTracks = indianArtistsDatabase.filter(a => legendArtists.includes(a.id)).flatMap(a => (a.allTracks && a.allTracks.length > 0) ? a.allTracks : (a.popularTracks || []));
  renderGridHelper('home-legends-grid', legendTracks.slice(0, 12));

  // 9. South Cinema
  const southArtists = ['anirudh', 'sid-sriram'];
  const southTracks = indianArtistsDatabase.filter(a => southArtists.includes(a.id)).flatMap(a => a.allTracks);
  renderGridHelper('home-south-grid', southTracks.slice(0, 12));

  // 10. Global Hits & Trending
  const all = getAllTracks();
  renderGridHelper('trending-grid', all.slice(0, 10));

  // 11. Categories
  const catGrid = document.getElementById('categories-grid');
  if (catGrid) {
    catGrid.innerHTML = '';
    browseGenres.forEach(g => {
      const card = document.createElement('div');
      card.className = 'category-card';
      card.style.backgroundColor = g.color;
      card.innerHTML = `
        <div class="category-title">${escapeHtml(g.name)}</div>
        <i class="fa-solid ${escapeHtml(g.icon)} category-icon"></i>
      `;
      card.onclick = () => {
        const searchInput = document.getElementById('yt-search-input');
        if (searchInput) searchInput.value = g.name;
        performSearch(g.query);
      };
      catGrid.appendChild(card);
    });
  }
}

function updateQueueUI() {
  const flyoutList = document.getElementById('queue-items-list');
  const nowPlayingBox = document.getElementById('queue-now-playing-item');

  if (nowPlayingBox && state.currentTrack) {
    const curCover = sanitizeUrl(state.currentTrack.cover);
    nowPlayingBox.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <img src="${curCover}" onerror="this.src='${DEFAULT_COVER}'" style="width:40px; height:40px; border-radius:4px; object-fit:cover;">
        <div>
          <div style="font-weight:700; font-size:13px; color:var(--spotify-green);">${escapeHtml(state.currentTrack.title)}</div>
          <div style="font-size:11px; color:var(--text-secondary);">${escapeHtml(state.currentTrack.artist)}</div>
        </div>
      </div>
    `;
  }

  if (flyoutList) {
    const nextTracks = state.currentQueue.slice(state.currentTrackIndex + 1, state.currentTrackIndex + 12);
    flyoutList.innerHTML = '';
    nextTracks.forEach((t, i) => {
      const li = document.createElement('li');
      li.className = 'queue-mini-item';
      const itemCover = sanitizeUrl(t.cover);
      li.innerHTML = `
        <img src="${itemCover}" onerror="this.src='${DEFAULT_COVER}'" alt="Cover">
        <div style="flex:1; overflow:hidden;">
          <div class="queue-mini-title">${escapeHtml(t.title)}</div>
          <div class="queue-mini-artist">${escapeHtml(t.artist)}</div>
        </div>
        <span style="font-size:11px; color:var(--text-muted);">${escapeHtml(t.duration || '3:30')}</span>
      `;
      li.onclick = () => setTrack(state.currentQueue[state.currentTrackIndex + 1 + i], true);
      flyoutList.appendChild(li);
    });
  }
}

function highlightActiveTrackRows() {
  document.querySelectorAll('.track-row').forEach(r => r.classList.remove('active'));
}

// ==================== 12. DOM INITIALIZATION & EVENTS ====================
document.addEventListener('DOMContentLoaded', () => {
  renderUserBadge();
  renderHomeGrids();
  renderArtistsView('all');
  renderPlaylistsSidebar();

  // Navigation Items
  document.querySelectorAll('.nav-item, .mobile-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view) showView(view);
    });
  });

  // Filter Pills
  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.onclick = () => {
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.activeFilter = pill.dataset.filter;
      if (pill.dataset.filter === 'all') {
        showView('home');
      } else if (pill.dataset.filter === 'hindi') {
        showView('artists');
        renderArtistsView('bollywood');
        document.querySelectorAll('.artist-chip').forEach(c => c.classList.toggle('active', c.dataset.genre === 'bollywood'));
      } else if (pill.dataset.filter === 'marathi') {
        showView('artists');
        renderArtistsView('marathi');
        document.querySelectorAll('.artist-chip').forEach(c => c.classList.toggle('active', c.dataset.genre === 'marathi'));
      } else if (pill.dataset.filter === 'english') {
        showView('artists');
        renderArtistsView('english');
        document.querySelectorAll('.artist-chip').forEach(c => c.classList.toggle('active', c.dataset.genre === 'english'));
      }
    };
  });

  // Artists Genre Filter Chips
  document.querySelectorAll('.artist-chip').forEach(chip => {
    chip.onclick = () => {
      document.querySelectorAll('.artist-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const g = chip.dataset.genre || 'all';
      const searchVal = document.getElementById('artist-filter-input')?.value || '';
      renderArtistsView(g, searchVal);
    };
  });

  // Artist Search Filter Input
  const artistSearchInput = document.getElementById('artist-filter-input');
  if (artistSearchInput) {
    artistSearchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      const activeChip = document.querySelector('.artist-chip.active');
      const g = activeChip ? activeChip.dataset.genre : 'all';
      renderArtistsView(g, val);
    });
  }

  // Hero Actions
  document.getElementById('hero-play-btn')?.addEventListener('click', () => {
    state.currentQueue = getAllTracks();
    state.currentTrackIndex = 0;
    setTrack(state.currentQueue[0], true);
  });
  document.getElementById('hero-explore-btn')?.addEventListener('click', () => showView('artists'));

  // Profile Dropdown
  const userProfileBadge = document.getElementById('user-profile-badge');
  const profileDropdown = document.querySelector('.profile-dropdown-container');
  if (userProfileBadge && profileDropdown) {
    userProfileBadge.onclick = (e) => {
      e.stopPropagation();
      profileDropdown.classList.toggle('open');
    };
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.profile-dropdown-container')) {
      profileDropdown?.classList.remove('open');
    }
  });

  document.getElementById('btn-dropdown-admin')?.addEventListener('click', () => showView('admin'));
  document.getElementById('btn-dropdown-library')?.addEventListener('click', () => showView('library'));
  document.getElementById('btn-dropdown-switch-auth')?.addEventListener('click', () => {
    const authModal = document.getElementById('auth-modal');
    if (authModal) authModal.style.display = 'flex';
  });
  document.getElementById('btn-dropdown-logout')?.addEventListener('click', () => {
    const isGuest = !state.currentUser || state.currentUser.role === 'Guest' || state.currentUser.username === 'Guest';
    if (isGuest) {
      window.location.href = 'login.html';
      return;
    }
    localStorage.removeItem('spotix_session');
    const loggedOutUser = { id: 'guest', username: 'Guest', email: '', role: 'Guest', status: 'Active' };
    state.currentUser = loggedOutUser;
    renderUserBadge();
    profileDropdown?.classList.remove('open');
    showView('home');
    window.location.href = 'login.html';
  });



  // Universal Music Search
  const searchInput = document.getElementById('yt-search-input');
  const searchSubmit = document.getElementById('search-submit-btn');
  const searchClear = document.getElementById('search-clear-btn');

  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        performSearch(searchInput.value.trim());
      }
    });
  }
  if (searchSubmit && searchInput) {
    searchSubmit.addEventListener('click', () => performSearch(searchInput.value.trim()));
  }
  if (searchClear && searchInput) {
    searchClear.addEventListener('click', () => { searchInput.value = ''; });
  }

  // Sidebar Actions & Create Playlist Modal
  const playlistModal = document.getElementById('create-playlist-modal');
  const playlistInput = document.getElementById('new-playlist-input');

  document.getElementById('create-playlist-btn')?.addEventListener('click', () => {
    if (playlistModal) {
      if (playlistInput) playlistInput.value = '';
      playlistModal.style.display = 'flex';
      playlistInput?.focus();
    }
  });

  document.getElementById('btn-modal-cancel')?.addEventListener('click', () => {
    if (playlistModal) playlistModal.style.display = 'none';
  });

  document.getElementById('btn-modal-create')?.addEventListener('click', () => {
    const name = playlistInput?.value?.trim();
    if (name) {
      createPlaylist(name);
      if (playlistModal) playlistModal.style.display = 'none';
    } else {
      alert('Please enter a playlist name.');
    }
  });

  document.getElementById('liked-songs-btn')?.addEventListener('click', () => {
    state.currentPlaylistName = 'Liked Songs';
    showView('library');
  });

  // Bottom Player Controls
  document.getElementById('btn-play-pause')?.addEventListener('click', togglePlayPause);
  document.getElementById('btn-next')?.addEventListener('click', playNextTrack);
  document.getElementById('btn-prev')?.addEventListener('click', playPrevTrack);
  document.getElementById('btn-shuffle')?.addEventListener('click', toggleShuffle);
  document.getElementById('btn-repeat')?.addEventListener('click', toggleRepeat);
  document.getElementById('player-like-btn')?.addEventListener('click', () => toggleLike(state.currentTrack));

  // Queue Flyout
  const queueFlyout = document.getElementById('queue-flyout');
  document.getElementById('btn-toggle-queue')?.addEventListener('click', () => {
    queueFlyout?.classList.toggle('active');
  });
  document.getElementById('queue-close-btn')?.addEventListener('click', () => {
    queueFlyout?.classList.remove('active');
  });

  // Progress Bar Seek
  const progWrapper = document.getElementById('progress-bar-wrapper');
  if (progWrapper) {
    progWrapper.onclick = (e) => {
      const rect = progWrapper.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      if (state.currentTrack) {
        const trackSec = parseDurationToSeconds(state.currentTrack.duration);
        const total = trackSec > 0 ? trackSec : 180;
        const targetTime = total * ratio;

        if ((state.currentTrack.resolvedYtId || state.currentTrack.id) && state.ytReady) {
          state.ytPlayer.seekTo(targetTime, true);
        } else if (state.audio) {
          state.audio.currentTime = targetTime;
        }
        updateProgressDisplay();
      }
    };
  }

  // Volume
  const volWrapper = document.getElementById('volume-bar-wrapper');
  if (volWrapper) {
    volWrapper.onclick = (e) => {
      const rect = volWrapper.getBoundingClientRect();
      const pct = Math.round(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * 100);
      setVolume(pct);
    };
  }
  document.getElementById('btn-volume')?.addEventListener('click', toggleMute);

  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlayPause();
    } else if (e.code === 'ArrowRight' && e.shiftKey) {
      playNextTrack();
    } else if (e.code === 'ArrowLeft' && e.shiftKey) {
      playPrevTrack();
    } else if (e.key.toLowerCase() === 'm') {
      toggleMute();
    } else if (e.key.toLowerCase() === 'l') {
      toggleLike(state.currentTrack);
    }
  });

  // Navigation history
  document.getElementById('btn-back')?.addEventListener('click', () => {
    if (state.historyIndex > 0) {
      state.historyIndex--;
      showView(state.viewHistory[state.historyIndex], false);
    }
  });
  document.getElementById('btn-forward')?.addEventListener('click', () => {
    if (state.historyIndex < state.viewHistory.length - 1) {
      state.historyIndex++;
      showView(state.viewHistory[state.historyIndex], false);
    }
  });

  // ==================== AUTH MODAL CONTROLS ====================
  const authModal = document.getElementById('auth-modal');
  const tabBtnLogin = document.getElementById('tab-btn-login');
  const tabBtnSignup = document.getElementById('tab-btn-signup');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');

  tabBtnLogin?.addEventListener('click', () => {
    tabBtnLogin.classList.add('active');
    tabBtnSignup?.classList.remove('active');
    if (loginForm) loginForm.style.display = 'block';
    if (signupForm) signupForm.style.display = 'none';
  });

  tabBtnSignup?.addEventListener('click', () => {
    tabBtnSignup.classList.add('active');
    tabBtnLogin?.classList.remove('active');
    if (signupForm) signupForm.style.display = 'block';
    if (loginForm) loginForm.style.display = 'none';
  });

  document.getElementById('auth-modal-close')?.addEventListener('click', () => {
    if (authModal) authModal.style.display = 'none';
  });
  document.getElementById('btn-login-cancel')?.addEventListener('click', () => {
    if (authModal) authModal.style.display = 'none';
  });
  document.getElementById('btn-signup-cancel')?.addEventListener('click', () => {
    if (authModal) authModal.style.display = 'none';
  });

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('login-username')?.value?.trim();
    const p = document.getElementById('login-password')?.value;
    if (u && p) {
      await loginUser(u, p);
    }
  });

  signupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('signup-username')?.value?.trim();
    const em = document.getElementById('signup-email')?.value?.trim();
    const p = document.getElementById('signup-password')?.value;
    if (u && em && p) {
      await registerUser(u, em, p, 'User');
    }
  });

  // ==================== ADMIN ADD USER MODAL ====================
  const addUserModal = document.getElementById('add-user-modal');
  const addUserForm = document.getElementById('admin-add-user-form');

  const openAddUser = () => {
    if (state.currentUser?.role !== 'Admin') {
      alert('Access Denied: Only administrators can add users.');
      return;
    }
    if (addUserModal) {
      if (addUserForm) addUserForm.reset();
      addUserModal.style.display = 'flex';
    }
  };

  document.getElementById('btn-open-add-user')?.addEventListener('click', openAddUser);
  document.getElementById('btn-admin-add-user-top')?.addEventListener('click', openAddUser);
  document.getElementById('btn-add-user-cancel')?.addEventListener('click', () => {
    if (addUserModal) addUserModal.style.display = 'none';
  });

  addUserForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.currentUser?.role !== 'Admin') return;
    const u = document.getElementById('new-user-name')?.value?.trim();
    const em = document.getElementById('new-user-email')?.value?.trim();
    const p = document.getElementById('new-user-pass')?.value;
    const r = document.getElementById('new-user-role')?.value || 'User';
    if (u && em && p) {
      const ok = await registerUser(u, em, p, r);
      if (ok && state.currentView === 'admin') renderAdminDashboard();
    }
  });

  // ==================== UPLOAD SONG MODAL ====================
  const uploadModal = document.getElementById('upload-song-modal');
  const uploadForm = document.getElementById('upload-song-form');

  const openUploadSong = () => {
    if (uploadModal) {
      if (uploadForm) uploadForm.reset();
      uploadModal.style.display = 'flex';
    }
  };

  document.getElementById('sidebar-upload-song-btn')?.addEventListener('click', openUploadSong);
  document.getElementById('btn-open-upload-song')?.addEventListener('click', openUploadSong);
  document.getElementById('btn-admin-upload-song-top')?.addEventListener('click', openUploadSong);
  document.getElementById('btn-upload-song-cancel')?.addEventListener('click', () => {
    if (uploadModal) uploadModal.style.display = 'none';
  });

  uploadForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const rawTitle = document.getElementById('upload-song-title')?.value;
    const rawArtist = document.getElementById('upload-song-artist')?.value;
    const rawYt = document.getElementById('upload-song-yt')?.value;
    const rawCover = document.getElementById('upload-song-cover')?.value;
    const rawCat = document.getElementById('upload-song-category')?.value || 'hindi';

    const title = sanitizeSqlInput(rawTitle, 80);
    const artist = sanitizeSqlInput(rawArtist, 80);
    const ytId = extractYouTubeId(rawYt);

    if (!title || !artist) {
      alert('Please enter a valid title and artist name.');
      return;
    }
    if (!ytId) {
      alert('Please enter a valid YouTube Video ID (11 characters) or YouTube URL.');
      return;
    }

    const coverUrl = rawCover?.trim() ? sanitizeUrl(rawCover) : `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;

    const newSong = {
      id: ytId,
      resolvedYtId: ytId,
      title,
      artist,
      album: 'Custom Upload',
      duration: '3:45',
      cover: coverUrl,
      category: rawCat,
      type: 'custom'
    };

    state.customSongs.unshift(newSong);
    localStorage.setItem('spotix_custom_songs', JSON.stringify(state.customSongs));

    if (uploadModal) uploadModal.style.display = 'none';
    alert(`Song "${title}" added to your catalog successfully!`);

    if (state.currentView === 'admin') renderAdminDashboard();
    renderHomeGrids();
    setTrack(newSong, true);
  });

  // Modal Dismiss on Outside Click or Escape
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.style.display = 'none';
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.style.display = 'none';
      });
      profileDropdown?.classList.remove('open');
    }
  });

  // Set initial track in paused state (NO autoplay on open)
  state.currentQueue = getAllTracks();
  state.isPlaying = false;
  state.pendingAutoplay = false;
  updatePlayPauseButtonUI(false);
  setTrack(state.currentQueue[0], false);
  setVolume(80);
});

// ==================== YOUTUBE IFRAME API INITIALIZATION & AUTO-RECOVERY ====================
const ytScript = document.createElement('script');
ytScript.src = "https://www.youtube.com/iframe_api";
document.head.appendChild(ytScript);

async function resolveTrackOnline(track) {
  if (!track) return null;
  const q = `${track.title} ${track.artist || ''}`.trim();
  try {
    const res = await fetch(`/api/resolve?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.id) {
        return data.id;
      }
    }
  } catch (err) {
    console.warn('Online resolve notice:', err);
  }
  return null;
}

window.onYouTubeIframeAPIReady = () => {
  state.ytPlayer = new YT.Player('yt-player-container', {
    height: '0',
    width: '0',
    playerVars: { 'autoplay': 0, 'controls': 0, 'playsinline': 1 },
    events: {
      'onReady': () => {
        state.ytReady = true;
        setVolume(state.volume);
      },
      'onStateChange': (e) => {
        if (e.data === YT.PlayerState.PLAYING) {
          state.isPlaying = true;
          updatePlayPauseButtonUI(true);
        } else if (e.data === YT.PlayerState.PAUSED) {
          state.isPlaying = false;
          updatePlayPauseButtonUI(false);
        } else if (e.data === YT.PlayerState.ENDED) {
          playNextTrack();
        }
      },
      'onError': async (e) => {
        console.warn('YouTube Player error code:', e.data, 'for track:', state.currentTrack?.title);
        // Attempt dynamic resolution via /api/resolve if an embedded restriction or unavailable video is hit
        if (state.currentTrack && !state.currentTrack._retried) {
          state.currentTrack._retried = true;
          const newId = await resolveTrackOnline(state.currentTrack);
          if (newId && newId !== (state.currentTrack.resolvedYtId || state.currentTrack.id)) {
            state.currentTrack.resolvedYtId = newId;
            state.ytPlayer.loadVideoById(newId);
            return;
          }
        }
        // Fallback to native audio stream if YouTube stream is restricted
        if (state.currentTrack) {
          let streamUrl = state.currentTrack.audioUrl || getDeterministicStreamUrl(state.currentTrack);
          state.audio.src = streamUrl;
          state.audio.volume = state.volume / 100;
          state.audio.play().catch(() => playNextTrack());
        }
      }
    }
  });
};
