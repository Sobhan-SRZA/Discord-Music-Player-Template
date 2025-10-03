/**
 * Discord Music Bot (Commented)
 * ------------------------------
 * This file is a thoroughly commented version of a Discord music bot
 * using @persian-caesar/discord-player and a Lavalink node.
 *
 * Purpose:
 *  - Provide a clear, educational reference for how the bot is organized.
 *  - Explain how controls, state, and interaction collectors work.
 *  - Show safe patterns (intent checks, cleanup, single listener registration).
 *
 * Quick start:
 *  1. Create a Discord application and bot via the Developer Portal.
 *     - Enable the "Server Members Intent" (if you need it) and "Message Content" if you require message content.
 *  2. Invite the bot to your server with the proper permissions (Send Messages, Manage Messages, Connect, Speak, Create Instant Invite).
 *  3. Run a Lavalink node (or use a public node) and configure the node info below.
 *  4. Set environment variables in a .env file:
 *       token=YOUR_DISCORD_BOT_TOKEN
 *       prefix=! (or whatever you choose)
 *
 * Notes & best practices:
 *  - Use a dedicated bot token (never use user tokens).
 *  - Prefer explicit setters over toggles where possible to avoid race conditions.
 *  - When editing messages with components, always check for message existence and catch errors.
 *  - Use short-lived collectors and cleanup handlers to avoid memory leaks.
 *
 * License: BSD 3-Clause (kept from original file)
 */

// Core discord.js imports. We destructure what we need to keep the file concise.
const {
    Client,
    GatewayIntentBits,
    Partials,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    ComponentType,
    MessageFlags,
} = require("discord.js");

// Music player abstractions (third-party library used by the original project)
const {
    MusicPlayer,
    MusicPlayerEvent,
    LavalinkManager
} = require("@persian-caesar/discord-player");
require("dotenv").config(); // load .env values into process.env

// -----------------------------------------------------------------------------
// Client configuration (intents & partials)
// -----------------------------------------------------------------------------
// Intents tell Discord what events your bot will receive. Keep these minimal but
// include those you need. `GuildVoiceStates` is required for voice state tracking.
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent
    ],
    // Partials allow the bot to receive partial data for certain structures when
    // full payload isn't available (useful if you're caching selectively).
    partials: [
        Partials.Channel,
        Partials.GuildMember,
        Partials.Message,
        Partials.Reaction,
        Partials.User
    ]
});

// -----------------------------------------------------------------------------
// Lavalink manager configuration
// -----------------------------------------------------------------------------
// Lavalink is the audio backend. The manager bridges the bot and Lavalink nodes.
// The `send` function describes how to send payloads to the proper shard.
const manager = new LavalinkManager(client, {
    send(id, payload) {
        const guild = client.guilds.cache.get(id);
        if (guild) guild.shard.send(payload);
    },

    // Replace this with your Lavalink node config (host, port, password, secure)
    nodes: require("./freeLavalinkNodes.json") || [
        {
            host: "lava-all.ajieblogs.eu.org",
            port: 80,
            password: "https://dsc.gg/ajidevserver",
            secure: false
        }
    ]
});

// -----------------------------------------------------------------------------
// Environment and small helpers
// -----------------------------------------------------------------------------
const token = process.env.token || "bot token here";
const prefix = process.env.prefix || "bot prefix here";

// client.playerStates keeps a per-guild state object so multiple guilds can
// use the bot concurrently without interfering with each other.
// Structure: Map<guildId, { player: MusicPlayer, controlMessage: Message|null, collector: Collector|null }>
client.playerStates = new Map();

// -----------------------------------------------------------------------------
// UI construction helper: buildControlRows
// -----------------------------------------------------------------------------
/**
 * Build the action rows (buttons) that control playback.
 * We create the rows dynamically so UI reflects the player's state (e.g. loop emoji).
 *
 * @param {MusicPlayer} player
 * @returns {import("discord.js").ActionRowBuilder<ButtonBuilder>[]} rows
 */
function buildControlRows(player = null) {
    const diactived = player ? false : true;

    // Row 1: volume, previous, play/pause, skip, volume up
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("vol_down")
            .setEmoji("🔉")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(diactived),

        new ButtonBuilder()
            .setCustomId("previous")
            .setEmoji("⏮️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(diactived),

        new ButtonBuilder()
            .setCustomId("play_pause")
            .setEmoji("⏯️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(diactived),

        new ButtonBuilder()
            .setCustomId("skip")
            .setEmoji("⏭️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(diactived),

        new ButtonBuilder()
            .setCustomId("vol_up")
            .setEmoji("🔊")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(diactived)
    );

    // Determine loop emoji based on current loop mode. This provides visual feedback.
    const loopEmoji = diactived
        ? "🚫"
        : player.isLoopQueue()
            ? "🔁"
            : player.isLoopTrack()
                ? "🔂"
                : "🚫";

    // Row 2: shuffle, stop, leave, loop mode
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("shuffle")
            .setEmoji("🔀")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(diactived),

        new ButtonBuilder()
            .setCustomId("stop")
            .setEmoji("⏹️")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(diactived),

        new ButtonBuilder()
            .setCustomId("leave")
            .setEmoji("❌")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(diactived),

        new ButtonBuilder()
            .setCustomId("loop_queue_track")
            .setEmoji(loopEmoji)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(diactived)
    );

    return [row1, row2];
}

// -----------------------------------------------------------------------------
// Message handling: simple play command.
// -----------------------------------------------------------------------------
client.on("messageCreate", async (message) => {
    // Ignore bots and DMs; we only want guild messages here.
    if (message.author.bot || message.channel.type === ChannelType.DM)
        return;

    // Basic prefix + command parsing
    if (!message.content.startsWith(prefix))
        return;

    const [cmd, ...args] = message.content
        .slice(prefix.length)
        .trim()
        .split(/ +/g);

    if (cmd.toLowerCase() !== "play")
        return;

    const query = args.join(" ");
    if (!query)
        return await message.reply("Please provide a track or URL.");

    // Ensure the user who invoked the command is in a voice channel
    const voiceChannel = message.member?.voice.channel;
    if (!voiceChannel)
        return await message.reply("Join a voice channel first.");

    const guildId = message.guild.id;
    let state = client.playerStates.get(guildId);

    // Create a new player state if it doesn't exist for this guild
    if (!state) {
        const player = new MusicPlayer(
            voiceChannel,
            message.channel,
            manager,
            {
                autoLeaveOnEmptyQueue: false,
                autoLeaveOnIdleMs: 300_000,
                initialVolume: 100
            }
        );
        state = { player, controlMessage: null, collector: null };
        client.playerStates.set(guildId, state);

        // cleanup function: stops collector and clears components to avoid stale UI
        const cleanup = async () => {
            state.collector?.stop();
            if (state.controlMessage)
                await state.controlMessage
                    .edit({ components: [] })
                    .catch(() => { }); // ignore errors on edit (message might be deleted)

            client.playerStates.delete(guildId);
        };

        // Bind cleanup to the player's lifecycle events so we free resources.
        player.on(MusicPlayerEvent.Stop, cleanup);
        player.on(MusicPlayerEvent.Finish, cleanup);
        player.on(MusicPlayerEvent.Disconnect, cleanup);
        player.on(MusicPlayerEvent.Error, cleanup);

        state.player = player;
    }

    const { player } = state;

    // Register queue-add listener only once to avoid duplicate messages
    if (!player.listenerCount(MusicPlayerEvent.QueueAdd)) {
        player.on(MusicPlayerEvent.QueueAdd, async ({ metadata, queue }) => {
            await message.reply({
                content: `🎶 Added to queue: [**${metadata.title}**](${metadata.url}) (Queue length: ${queue.length})`
            });
        });
    }

    // Search & play the requested query. The player's search method returns results.
    const searched = (await player.search(query))[0];
    await player.play(searched.url);

    // -------------------------------------------------------------------------
    // Control UI updater — creates or updates the `controlMessage` with buttons.
    // -------------------------------------------------------------------------
    /**
     * 
     * @param {import("@persian-caesar/discord-player").TrackMetadata} metadata 
     * @param {import("@persian-caesar/discord-player").TrackMetadata[]} queue 
     * @returns {Promise<void>}
     */
    const updateControl = async (metadata) => {
        // Get the queue so we can display its length
        const desc = async () => {
            const live_queue = await player.getQueue();
            return `${player.isPlaying()
                ? "🎶 Now playing"
                : "🎶 Played"
                }: **${metadata.title}**` +
                `\n📃 Queue: ${live_queue.length} tracks | 🔊 Volume: ${player.getVolume()}%`;
        };

        // If no control message exists yet, send one and attach a collector
        if (!state.controlMessage) {
            const control = await message.reply({
                content: await desc(),
                components: buildControlRows(player)
            });

            state.controlMessage = control;

            // Collector listens only to button interactions for the lifetime of the track
            const collector = control.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: metadata.duration * 1000
            });

            // Button collector: central switch handler for all button actions
            collector.on("collect", async (i) => {
                if (!i.isButton())
                    return;

                const id = i.customId;
                switch (id) {
                    case "play_pause":
                        if (player.isPaused())
                            player.resume();

                        else
                            player.pause();

                        await i.reply({
                            content:
                                player.isPaused()
                                    ? "⏸️ Paused"
                                    : "▶️ Resumed",

                            flags: MessageFlags.Ephemeral
                        });

                        break;

                    case "skip":
                        player.skip();
                        await i.reply({
                            content: "⏭️ Skipped",
                            flags: MessageFlags.Ephemeral
                        });

                        break;

                    case "previous":
                        player.previous();
                        await i.reply({
                            content: "⏮️ Previous",
                            flags: MessageFlags.Ephemeral
                        });

                        break;

                    case "stop":
                        player.stop();

                        await i.reply({
                            content: "⏹️ Stopped",
                            flags: MessageFlags.Ephemeral
                        });

                        break;

                    case "leave":
                        // stop(false) may indicate 'stop but do not leave immediately' depending on API
                        player.stop(false);
                        await i.reply({
                            content: "❌ Left voice channel",
                            flags: MessageFlags.Ephemeral
                        });

                        break;

                    case "shuffle":
                        player.shuffle();
                        await i.reply({
                            content: "🔀 Shuffled",
                            flags: MessageFlags.Ephemeral
                        });

                        break;

                    case "loop_queue_track":
                        // Robust loop cycling logic:
                        // none -> queue
                        // queue -> track
                        // track -> none
                        // We read both states first to avoid toggling twice accidentally.
                        const wasQueue = player.isLoopQueue();
                        const wasTrack = player.isLoopTrack();

                        if (!wasQueue && !wasTrack) {
                            // enable queue loop
                            player.toggleLoopQueue();
                        }

                        else if (wasQueue) {
                            // switch queue -> track
                            player.toggleLoopQueue();      // disable queue loop
                            if (!player.isLoopTrack()) {   // enable track loop if not already
                                player.toggleLoopTrack();
                            }
                        }

                        else if (wasTrack) {
                            // switch track -> none
                            player.toggleLoopTrack();
                        }

                        await i.reply({
                            content:
                                player.isLoopQueue()
                                    ? "🔁 Loop Queue"
                                    : player.isLoopTrack()
                                        ? "🔂 Loop Track"
                                        : "🚫 No loop",

                            flags: MessageFlags.Ephemeral
                        });

                        break;

                    case "vol_down":
                        // clamp or validate in real code if you want min/max bounds
                        player.setVolume(player.getVolume() - 10);
                        await i.reply({
                            content: `🔉 Volume: ${player.getVolume()}%`,
                            flags: MessageFlags.Ephemeral
                        });

                        break;

                    case "vol_up":
                        // clamp volume between 0–200 (example upper bound)
                        player.setVolume(player.getVolume() + 10);
                        await i.reply({
                            content: `🔊 Volume: ${player.getVolume()}%`,
                            flags: MessageFlags.Ephemeral
                        });

                        break;
                }

                // After acting on the button, refresh the control message UI so it reflects the new state.
                await state.controlMessage.edit({
                    content: await desc(),
                    components: buildControlRows(player)
                });
            });

            // Stop the buttons
            collector.on("end", async () => {
                await state.controlMessage.edit({
                    content: (await desc()) + "\n❌ Stopped by finishing the track.",
                    components: buildControlRows()
                });
            })

            return;
        }

        // If control message already exists, just edit it to update status and buttons
        else {
            await state.controlMessage.edit({
                content: await desc(),
                components: buildControlRows(player)
            });

            return;
        }
    };

    // Initial call to create/update the control message
    player.on(MusicPlayerEvent.Start, async ({ metadata }) => await updateControl(metadata));
});

// -----------------------------------------------------------------------------
// Ready event & login
// -----------------------------------------------------------------------------
client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}`)
});

client.login(token).catch(console.error);

// Global error handling — log uncaught exceptions so the process doesn't fail silently
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);
process.on("uncaughtExceptionMonitor", console.error);

/**
 * Credits & copyright
 * ------------------
 * Code by Sobhan-SRZA (mr.sinre) | https://github.com/Sobhan-SRZA
 * Developed for Persian Caesar | https://github.com/Persian-Caesar | https://dsc.gg/persian-caesar
 */