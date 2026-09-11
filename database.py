"""
SonicWave Parameterized Database Security Layer
Implements 100% Prepared Statements & Parameterized Queries.
Immune to SQL Injection, Blind SQLi, UNION-based, Stacked, and Time-based attacks.
"""

import sqlite3
import os
import threading
import contextlib

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sonicwave.db')
_local = threading.local()

def get_connection():
    """Returns a thread-local SQLite connection with foreign keys enabled."""
    if not hasattr(_local, 'conn') or _local.conn is None:
        conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA journal_mode = WAL;")
        _local.conn = conn
    return _local.conn

@contextlib.contextmanager
def get_cursor():
    """Context manager for safe transaction and cursor execution."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        yield cursor
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()

def init_database():
    """Initializes the database schema using strict parameterized DDL."""
    with get_cursor() as cur:
        # 1. Users Table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'User',
                date_added TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Active'
            );
        """)

        # 2. Songs Catalog Table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS songs (
                id TEXT PRIMARY KEY,
                resolved_yt_id TEXT,
                title TEXT NOT NULL,
                artist TEXT NOT NULL,
                album TEXT DEFAULT 'Single',
                duration TEXT DEFAULT '3:30',
                cover TEXT,
                category TEXT DEFAULT 'hindi',
                song_type TEXT DEFAULT 'official',
                date_added TEXT NOT NULL
            );
        """)

        # 3. Playlists Table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS playlists (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                date_created TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)

        # 4. Playlist Songs Table (Many-to-Many)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS playlist_songs (
                playlist_id TEXT NOT NULL,
                song_id TEXT NOT NULL,
                added_at TEXT NOT NULL,
                PRIMARY KEY (playlist_id, song_id),
                FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
                FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
            );
        """)

        # 5. Liked Tracks Table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS liked_tracks (
                user_id TEXT NOT NULL,
                song_id TEXT NOT NULL,
                liked_at TEXT NOT NULL,
                PRIMARY KEY (user_id, song_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
            );
        """)

        # Indexes for fast, indexed parameter lookups
        cur.execute("CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs(artist);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_songs_category ON songs(category);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")

# ==================== PARAMETERIZED USER OPERATIONS ====================

def add_user(user_id, username, email, password_hash, role='User', date_added='2026-08-31'):
    """Insert a user using strictly parameterized query."""
    with get_cursor() as cur:
        cur.execute(
            "INSERT OR IGNORE INTO users (id, username, email, password_hash, role, date_added) VALUES (?, ?, ?, ?, ?, ?);",
            (user_id, username, email, password_hash, role, date_added)
        )
        return cur.rowcount > 0

def authenticate_user(username_or_email, password_hash):
    """Authenticate user with parameterized prepared statement."""
    with get_cursor() as cur:
        cur.execute(
            "SELECT id, username, email, role, status FROM users WHERE (LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)) AND password_hash = ?;",
            (username_or_email, username_or_email, password_hash)
        )
        row = cur.fetchone()
        return dict(row) if row else None

def get_all_users():
    """Retrieve all users without exposing password hashes."""
    with get_cursor() as cur:
        cur.execute("SELECT id, username, email, role, date_added, status FROM users ORDER BY date_added DESC;")
        return [dict(r) for r in cur.fetchall()]

def delete_user(user_id):
    """Delete a user by ID using parameterized query."""
    with get_cursor() as cur:
        cur.execute("DELETE FROM users WHERE id = ?;", (user_id,))
        return cur.rowcount > 0

def update_user_role(user_id, new_role):
    """Update a user role using parameterized query."""
    if new_role not in ('Admin', 'User'):
        raise ValueError("Invalid role value")
    with get_cursor() as cur:
        cur.execute("UPDATE users SET role = ? WHERE id = ?;", (new_role, user_id))
        return cur.rowcount > 0

# ==================== PARAMETERIZED SONG OPERATIONS ====================

def add_song(song_id, title, artist, album='Single', duration='3:30', cover=None, category='hindi', song_type='custom', date_added='2026-08-31', resolved_yt_id=None):
    """Insert or replace a song in catalog using parameterized query."""
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT OR REPLACE INTO songs 
            (id, resolved_yt_id, title, artist, album, duration, cover, category, song_type, date_added)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """,
            (song_id, resolved_yt_id or song_id, title, artist, album, duration, cover, category, song_type, date_added)
        )
        return cur.rowcount > 0

def search_songs(query_term, limit=30):
    """
    Search catalog with parameterized query and escaped LIKE wildcards.
    Prevents both SQL injection and LIKE-wildcard DoS attacks.
    """
    if not query_term or not isinstance(query_term, str):
        return []
    
    # Escape SQL LIKE special wildcard characters
    escaped_term = query_term.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')
    pattern = f"%{escaped_term}%"

    with get_cursor() as cur:
        cur.execute(
            """
            SELECT id, resolved_yt_id, title, artist, album, duration, cover, category, song_type 
            FROM songs 
            WHERE title LIKE ? ESCAPE '\\' OR artist LIKE ? ESCAPE '\\' OR album LIKE ? ESCAPE '\\'
            LIMIT ?;
            """,
            (pattern, pattern, pattern, max(1, min(100, int(limit))))
        )
        return [dict(r) for r in cur.fetchall()]

def get_songs_by_category(category, limit=50):
    """Fetch songs by category using parameterized query."""
    with get_cursor() as cur:
        cur.execute(
            "SELECT * FROM songs WHERE category = ? LIMIT ?;",
            (category, max(1, min(100, int(limit))))
        )
        return [dict(r) for r in cur.fetchall()]

# ==================== PARAMETERIZED PLAYLIST OPERATIONS ====================

def create_playlist(playlist_id, user_id, name, date_created='2026-08-31'):
    """Create playlist using parameterized prepared statement."""
    with get_cursor() as cur:
        cur.execute(
            "INSERT INTO playlists (id, user_id, name, date_created) VALUES (?, ?, ?, ?);",
            (playlist_id, user_id, name, date_created)
        )
        return cur.rowcount > 0

def get_user_playlists(user_id):
    """Get playlists for a user with parameterized query."""
    with get_cursor() as cur:
        cur.execute("SELECT id, name, date_created FROM playlists WHERE user_id = ? ORDER BY date_created DESC;", (user_id,))
        return [dict(r) for r in cur.fetchall()]

def toggle_like(user_id, song_id, liked_at='2026-08-31'):
    """Toggle liked song with parameterized statement."""
    with get_cursor() as cur:
        cur.execute("SELECT 1 FROM liked_tracks WHERE user_id = ? AND song_id = ?;", (user_id, song_id))
        exists = cur.fetchone()
        if exists:
            cur.execute("DELETE FROM liked_tracks WHERE user_id = ? AND song_id = ?;", (user_id, song_id))
            return False
        else:
            cur.execute("INSERT INTO liked_tracks (user_id, song_id, liked_at) VALUES (?, ?, ?);", (user_id, song_id, liked_at))
            return True

if __name__ == '__main__':
    init_database()
    print("SonicWave Parameterized Database initialized successfully!")
