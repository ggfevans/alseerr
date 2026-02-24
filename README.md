# Alseerr

**Alfred workflow for [Seerr](https://docs.seerr.dev/)** - search and request movies & TV shows from your homelab, right from Alfred.

> **Al**(fred) + **Seerr** = "All Seer" - see all your media.

## Features

- **Search** movies and TV shows via Seerr's unified API (minimum 3 characters)
- **Request** media directly from Alfred (sends to Sonarr/Radarr via Seerr)
- **Status at a glance** - see what's available, requested, or downloading
- **Poster thumbnails** cached locally for fast display
- **Keyboard shortcuts:**
  - `Enter` - Open item in Seerr web UI
  - `⌥ Enter` - Request the item
  - `⌘C` - Copy the Seerr URL
  - `⌘L` - Full details in Large Type

## Requirements

- [Alfred 5](https://www.alfredapp.com/) with Powerpack
- A running [Seerr](https://docs.seerr.dev/) instance
- Seerr API key (Settings → General → API Key)

## Setup

1. Download the latest `.alfredworkflow` from [Releases](https://github.com/ggfevans/alseerr/releases)
2. Double-click to install in Alfred
3. Configure workflow variables:
   - `seerr_url` - Your Seerr instance URL (e.g., `https://seerr.example.com`)
   - `seerr_api_key` - Your Seerr API key
4. Type `alseerr` in Alfred followed by a movie or show name

## Usage

```
alseerr breaking bad     → Search for "Breaking Bad"
alseerr the matrix       → Search for "The Matrix"
```

Results show poster art, year, media type (Movie/TV), and current status.

## Development

Written in JXA (JavaScript for Automation). See [CLAUDE.md](CLAUDE.md) for development conventions.

```bash
# Sync repo changes to Alfred
just transfer-changes-TO-local

# Sync Alfred changes back to repo
just transfer-changes-FROM-local

# Run tests
npm test
```

## License

[MIT](LICENSE)
