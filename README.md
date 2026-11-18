# ARCADE X

A Flask-powered browser arcade with accounts, score submissions, a global leaderboard, and four playable games.

## Features
- Player registration, sign-in and sign-out
- Passwords stored as Werkzeug password hashes (never plain text)
- SQLite database for player profiles and game scores
- Global leaderboard with per-game filtering
- Snake, Memory Match, two-player Tic-Tac-Toe and Alpine Rush
- Alpine Rush: perspective-style mountain runs, steer around trees and rocks, hit ramps, slide rails, pass gates, perform spins/flips, build trick combos and select unlockable ski setups
- Favorites and theme preference saved in the browser
- Responsive layout for desktop and mobile

## Requirements
- Python 3.10+
- pip

## Run locally

### Windows PowerShell
```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

### macOS / Linux
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open http://127.0.0.1:5000.

The SQLite database is created automatically at `instance/arcade_x.sqlite3`.

## Important before publishing
Set a strong random `SECRET_KEY` environment variable. Set `COOKIE_SECURE=1` when serving over HTTPS. Set `FLASK_DEBUG=0` in production. Use a production WSGI server (Waitress on Windows, Gunicorn on Linux) and persistent storage for the `instance` folder. Add rate limiting, email verification and a password reset flow before opening registration to the public. Scores are validated server-side for basic type/range checks, but because game clients run in the browser, competitive leaderboards need stronger anti-cheat validation before treating scores as authoritative.
