import os
import re
import sqlite3
from functools import wraps
from pathlib import Path

from flask import Flask, render_template, request, jsonify, session, redirect, url_for, flash
from werkzeug.security import generate_password_hash, check_password_hash

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "instance" / "arcade_x.sqlite3"

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "change-this-secret-key-before-deploying")
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.environ.get("COOKIE_SECURE", "0") == "1"
app.config["MAX_CONTENT_LENGTH"] = 1 * 1024 * 1024

GAMES = [
    {"id": "snake", "name": "Snake", "category": "Arcade", "description": "Eat, grow, and avoid your own tail.", "icon": "🐍", "difficulty": "Easy"},
    {"id": "memory", "name": "Memory Match", "category": "Puzzle", "description": "Find matching pairs with as few moves as possible.", "icon": "🧠", "difficulty": "Easy"},
    {"id": "tictactoe", "name": "Tic-Tac-Toe", "category": "Strategy", "description": "Get three in a row against a friend.", "icon": "⭕", "difficulty": "Easy"},
    {"id": "ski", "name": "Alpine Rush", "category": "Sports", "description": "Race downhill, dodge obstacles, and land tricks.", "icon": "🎿", "difficulty": "Medium"},
]
ALLOWED_GAMES = {g["id"] for g in GAMES}


def get_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    return db


def init_db():
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL COLLATE NOCASE UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                game_id TEXT NOT NULL,
                score INTEGER NOT NULL CHECK(score >= 0),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        db.execute("CREATE INDEX IF NOT EXISTS idx_scores_game_score ON scores(game_id, score DESC)")


def current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    with get_db() as db:
        row = db.execute("SELECT id, username FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        session.clear()
        return None
    return {"id": row["id"], "username": row["username"]}


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not current_user():
            return jsonify({"error": "Please log in first."}), 401
        return fn(*args, **kwargs)
    return wrapper


@app.context_processor
def inject_user():
    return {"logged_in_user": current_user()}


@app.get("/")
def home():
    return render_template("index.html", games=GAMES)


@app.get("/api/games")
def games():
    return jsonify(GAMES)


@app.post("/api/register")
def register():
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip()
    password = str(data.get("password", ""))
    if not re.fullmatch(r"[A-Za-z0-9_]{3,18}", username):
        return jsonify({"error": "Username must be 3–18 characters: letters, numbers or underscores."}), 400
    if len(password) < 8 or len(password) > 128:
        return jsonify({"error": "Password must be between 8 and 128 characters."}), 400
    try:
        with get_db() as db:
            cur = db.execute(
                "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                (username, generate_password_hash(password))
            )
            user_id = cur.lastrowid
    except sqlite3.IntegrityError:
        return jsonify({"error": "That username is already taken."}), 409
    session.clear()
    session["user_id"] = user_id
    return jsonify({"message": "Account created.", "user": {"username": username}}), 201


@app.post("/api/login")
def login():
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip()
    password = str(data.get("password", ""))
    with get_db() as db:
        row = db.execute("SELECT id, username, password_hash FROM users WHERE username = ? COLLATE NOCASE", (username,)).fetchone()
    if not row or not check_password_hash(row["password_hash"], password):
        return jsonify({"error": "Incorrect username or password."}), 401
    session.clear()
    session["user_id"] = row["id"]
    return jsonify({"message": "Logged in.", "user": {"username": row["username"]}})


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify({"message": "Logged out."})


@app.get("/api/me")
def me():
    user = current_user()
    return jsonify({"user": user})


@app.post("/api/scores")
@login_required
def submit_score():
    data = request.get_json(silent=True) or {}
    game_id = str(data.get("game_id", ""))
    score = data.get("score")
    if game_id not in ALLOWED_GAMES:
        return jsonify({"error": "Unknown game."}), 400
    if isinstance(score, bool) or not isinstance(score, int) or score < 0 or score > 10_000_000:
        return jsonify({"error": "Invalid score."}), 400
    user = current_user()
    with get_db() as db:
        db.execute("INSERT INTO scores (user_id, game_id, score) VALUES (?, ?, ?)", (user["id"], game_id, score))
    return jsonify({"message": "Score saved."}), 201


@app.get("/api/leaderboard")
def leaderboard():
    game_id = request.args.get("game", "all")
    if game_id != "all" and game_id not in ALLOWED_GAMES:
        return jsonify({"error": "Unknown game."}), 400
    with get_db() as db:
        if game_id == "all":
            rows = db.execute("""
                SELECT u.username, s.game_id, MAX(s.score) AS score
                FROM scores s JOIN users u ON u.id = s.user_id
                GROUP BY u.id, s.game_id
                ORDER BY score DESC LIMIT 25
            """).fetchall()
        else:
            rows = db.execute("""
                SELECT u.username, s.game_id, MAX(s.score) AS score
                FROM scores s JOIN users u ON u.id = s.user_id
                WHERE s.game_id = ?
                GROUP BY u.id, s.game_id
                ORDER BY score DESC LIMIT 25
            """, (game_id,)).fetchall()
    return jsonify([dict(row) for row in rows])


@app.get("/health")
def health():
    return jsonify({"status": "ok", "app": "ARCADE X"})


init_db()

if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG", "1") == "1")
