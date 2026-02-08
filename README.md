# Discord Music Player Template 🎵

A clean, well-commented, and easy-to-understand **Discord music bot template** using **discord.js v14** and **@persian-caesar/discord-player** (a Lavalink-based music player library).

**Important Note**: This template currently only supports **YouTube** sources (no Spotify, SoundCloud, etc. out-of-the-box).

## Features ✨

- **Button-based control panel** (play/pause, skip, previous, volume, loop, shuffle, stop, leave)
- **Persistent control message** that updates with every track change
- **Auto cleanup** of resources when queue ends or bot disconnects
- **Multiple Lavalink nodes** support (with fallback list included)
- **Simple prefix command** system (`!play <query or URL>`)
- **Queue & playlist support** (adds all tracks when a playlist URL is provided)
- **Loop modes** (off, track, queue)
- **Volume control** (0–200%)
- **Shuffle** queue
- **Error handling** & **resource cleanup** to prevent memory leaks
- **Ready for GitHub** with proper documentation & structure

## Demo Video 🎬

https://github.com/user-attachments/assets/1bfde47e-545f-4973-b2be-2ac633a951ef

## Project Structure 📂

```
discord-music-player-template/
├── .gitignore
├── example.env
├── freeLavalinkNodes.json
├── index.js              # Main bot logic + control panel
├── LICENSE
├── package.json
└── README.md
```

| File                     | Description                                                        |
| ------------------------ | ------------------------------------------------------------------ |
| `.gitignore`             | Standard ignores (node_modules, .env, etc.)                        |
| `example.env`            | Template for environment variables                                 |
| `freeLavalinkNodes.json` | List of **free public Lavalink nodes** (you can add your own)      |
| `index.js`               | The **entire bot logic** (client, player, commands, control panel) |
| `package.json`           | Dependencies & metadata                                            |
| `LICENSE`                | BSD 3-Clause License                                               |

## Installation & Setup 🚀

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/discord-music-player-template.git
   cd discord-music-player-template
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file from `example.env`:
   ```env
   token=YOUR_DISCORD_BOT_TOKEN_HERE
   prefix=!
   ```

4. (Optional) Replace or add your own Lavalink nodes in `freeLavalinkNodes.json`

5. Run the bot:
   ```bash
   node index.js
   ```

## Commands 📜

| Command         | Description                                    | Example                                                                       |
| --------------- | ---------------------------------------------- | ----------------------------------------------------------------------------- |
| `!play <query>` | Search & play a track or playlist from YouTube | `!play never gonna give you up` <br> `!play https://youtube.com/playlist?...` |

**Note**: This template only has the `play` command. You can easily add more commands (e.g., `!skip`, `!queue`, `!volume`, etc.).

## Control Panel Buttons 🕹️

| Button | Emoji | Action              | Notes                          |
| ------ | ----- | ------------------- | ------------------------------ |
| 🔉      |       | Volume down (-10%)  |                                |
| ⏮️      |       | Play previous track |                                |
| ⏯️      |       | Pause / Resume      | Toggles play/pause             |
| ⏭️      |       | Skip current track  |                                |
| 🔊      |       | Volume up (+10%)    |                                |
| 🔀      |       | Shuffle queue       |                                |
| ⏹️      |       | Stop & clear queue  | Disconnects from voice channel |
| ❌      |       | Leave voice channel | Stops player without clearing  |
| 🔁/🔂/🚫  |       | Cycle loop mode     | Off → Queue → Track → Off      |

## Important Classes & Objects 🔧

| Object / Class             | Description                                                                            | Location               |
| -------------------------- | -------------------------------------------------------------------------------------- | ---------------------- |
| `client.playerStates`      | `Map<guildId, { player: MusicPlayer, controlMessage: Message, collector: Collector }>` | `index.js`             |
| `manager`                  | `LavalinkManager` instance (connects to Lavalink nodes)                                | `index.js`             |
| `MusicPlayer`              | Instance per guild (from `@persian-caesar/discord-player`)                             | Per guild              |
| `buildControlRows(player)` | Returns two rows of buttons reflecting current player state                            | `index.js`             |
| `updateControl(metadata)`  | Creates or updates the control message + attaches fresh collector                      | Inside `messageCreate` |

## Key Events Listened To (MusicPlayer)

| Event                         | Description                         |
| ----------------------------- | ----------------------------------- |
| `MusicPlayerEvent.Start`      | Track starts → update control panel |
| `MusicPlayerEvent.QueueAdd`   | Track(s) added → send reply         |
| `MusicPlayerEvent.Stop`       | Stopped → cleanup                   |
| `MusicPlayerEvent.Finish`     | Queue finished → cleanup            |
| `MusicPlayerEvent.Disconnect` | Disconnected → cleanup              |
| `MusicPlayerEvent.Error`      | Error occurred → cleanup            |

## Dependencies 📦

| Package                          | Version  | Purpose                     |
| -------------------------------- | -------- | --------------------------- |
| `@persian-caesar/discord-player` | ^1.2.1   | Lavalink-based music player |
| `discord.js`                     | ^14.22.1 | Discord API wrapper         |
| `dotenv`                         | ^16.5.0  | Load environment variables  |

## Links 🔗

- **Library**: [@persian-caesar/discord-player](https://www.npmjs.com/package/@persian-caesar/discord-player)
- **Library GitHub**: https://github.com/Persian-Caesar/discord-player
- **Demo Video**: https://github.com/user-attachments/assets/1bfde47e-545f-4973-b2be-2ac633a951ef
- **Author**: Sobhan-SRZA (mr.sinre) & Persian Caesar

## License 📄

[BSD 3-Clause License](LICENSE)

---

Made with ❤️ by [Sobhan-SRZA](https://github.com/Sobhan-SRZA) & [Persian-Caesar](https://github.com/Persian-Caesar)  
Happy coding & jamming! 🎧