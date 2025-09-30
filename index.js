/**
 * @license
  BSD 3-Clause License

  Copyright (c) 2025, the respective contributors, as shown by Persian Caesar and Sobhan.SRZA (mr.sinre) file.

  All rights reserved.

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

  * Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

  * Neither the name of the copyright holder nor the names of its
  contributors may be used to endorse or promote products derived from
  this software without specific prior written permission.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
  DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
  FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
  DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
  SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
  CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
  OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
  OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
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
const {
    MusicPlayer,
    MusicPlayerEvent,
    LavalinkManager,
} = require("@persian-caesar/discord-player");
require("dotenv").config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
    ],
    partials: [
        Partials.Channel,
        Partials.GuildMember,
        Partials.Message,
        Partials.Reaction,
        Partials.User,
    ],
});

const manager = new LavalinkManager(client, {
    send(id, payload) {
        const guild = client.guilds.cache.get(id);
        if (guild) guild.shard.send(payload);
    },
    nodes: [
        {
            host: "lava-all.ajieblogs.eu.org",
            port: 80,
            password: "https://dsc.gg/ajidevserver",
            secure: false
        }
    ]
});

const token = process.env.token || "bot token here";
const prefix = process.env.prefix || "bot prefix here";

// Store per-guild state: { player, controlMessage, collector }
client.playerStates = new Map();

/**
 * @param {MusicPlayer} player
 * @returns {import("discord.js").ActionRowBuilder<any>[]}
 */
function buildControlRows(player) {
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("vol_down")
            .setEmoji("🔉")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("previous")
            .setEmoji("⏮️")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("play_pause")
            .setEmoji("⏯️")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId("skip")
            .setEmoji("⏭️")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("vol_up")
            .setEmoji("🔊")
            .setStyle(ButtonStyle.Secondary),
    );
    const loopEmoji = player.isLoopQueue()
        ? "🔁"
        : player.isLoopTrack()
            ? "🔂"
            : "🚫";
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("shuffle")
            .setEmoji("🔀")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("stop")
            .setEmoji("⏹️")
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId("leave")
            .setEmoji("❌")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("loop_queue_track")
            .setEmoji(loopEmoji)
            .setStyle(ButtonStyle.Secondary),
    );
    return [row1, row2];
}

client.on("messageCreate", async (message) => {
    if (message.author.bot || message.channel.type === ChannelType.DM) return;
    if (!message.content.startsWith(prefix)) return;

    const [cmd, ...args] = message.content
        .slice(prefix.length)
        .trim()
        .split(/ +/g);
    if (cmd.toLowerCase() !== "play") return;

    const query = args.join(" ");
    if (!query) return message.reply("Please provide a track or URL.");

    const voiceChannel = message.member?.voice.channel;
    if (!voiceChannel) return message.reply("Join a voice channel first.");

    const guildId = message.guild.id;
    let state = client.playerStates.get(guildId);

    if (!state) {
        const player = new MusicPlayer(
            voiceChannel,
            message.channel,
            manager,
            100,
            { autoLeaveOnEmptyQueue: false, autoLeaveOnIdleMs: 300_000 }
        );
        state = { player, controlMessage: null, collector: null };
        client.playerStates.set(guildId, state);

        const cleanup = async () => {
            state.collector?.stop();
            if (state.controlMessage)
                await state.controlMessage
                    .edit({ components: [] })
                    .catch(() => { });
            client.playerStates.delete(guildId);
        };

        player.on(MusicPlayerEvent.Stop, cleanup);
        player.on(MusicPlayerEvent.Finish, cleanup);
        player.on(MusicPlayerEvent.Disconnect, cleanup);
        player.on(MusicPlayerEvent.Error, cleanup);

        state.player = player;
    }

    const { player } = state;

    // Remove duplicate listener registration
    if (!player.listenerCount(MusicPlayerEvent.QueueAdd)) {
        player.on(MusicPlayerEvent.QueueAdd, async ({ url, queue }) => {
            await message.reply({
                content: `🎶 Added to queue: **${url}** (Queue length: ${queue.length})`,
            });
        });
    }

    const searched = await player.search(query);
    await player.play(query);

    const updateControl = async () => {
        const desc =
            `🎶 Now playing: **${searched}**` +
            `\n📃 Queue: ${player.getQueue().length} tracks | 🔊 Volume: ${player.getVolume()}%`;

        if (!state.controlMessage) {
            const control = await message.reply({
                content: desc,
                components: buildControlRows(player),
            });
            state.controlMessage = control;
            state.collector = control.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 300_000,
            });

            state.collector.on("collect", async (i) => {
                if (!i.isButton()) return;
                const id = i.customId;
                switch (id) {
                    case "play_pause":
                        if (player.isPaused()) player.resume();
                        else player.pause();
                        await i.reply({
                            content: player.isPaused()
                                ? "⏸️ Paused"
                                : "▶️ Resumed",
                            flags: MessageFlags.Ephemeral,
                        });
                        break;

                    case "skip":
                        player.skip();
                        await i.reply({
                            content: "⏭️ Skipped",
                            flags: MessageFlags.Ephemeral,
                        });
                        break;

                    case "previous":
                        player.previous();
                        await i.reply({
                            content: "⏮️ Previous",
                            flags: MessageFlags.Ephemeral,
                        });
                        break;

                    case "stop":
                        player.stop();
                        await i.reply({
                            content: "⏹️ Stopped",
                            flags: MessageFlags.Ephemeral,
                        });
                        break;

                    case "leave":
                        player.stop(false);
                        await i.reply({
                            content: "❌ Left voice channel",
                            flags: MessageFlags.Ephemeral,
                        });
                        break;

                    case "shuffle":
                        player.shuffle();
                        await i.reply({
                            content: "🔀 Shuffled",
                            flags: MessageFlags.Ephemeral,
                        });
                        break;

                    case "loop_queue_track":
                        player.toggleLoopQueue();
                        if (player.isLoopQueue()) {
                            player.toggleLoopQueue();
                            player.toggleLoopTrack();
                        }

                        await i.reply({
                            content: `${player.isLoopQueue() ? "🔁 Loop Queue" : player.isLoopTrack() ? "🔂 Loop Track" : "🚫 No loop"}`,
                            flags: MessageFlags.Ephemeral,
                        });
                        break;

                    case "vol_down":
                        player.setVolume(player.getVolume() - 10);
                        await i.reply({
                            content: `🔉 Volume: ${player.getVolume()}%`,
                            flags: MessageFlags.Ephemeral,
                        });
                        break;

                    case "vol_up":
                        player.setVolume(player.getVolume() + 10);
                        await i.reply({
                            content: `🔊 Volume: ${player.getVolume()}%`,
                            flags: MessageFlags.Ephemeral,
                        });
                        break;
                }
                await state.controlMessage.edit({
                    content: desc,
                    components: buildControlRows(player),
                });
            });

            return;
        } else {
            await state.controlMessage.edit({
                content: desc,
                components: buildControlRows(player),
            });
            return;
        }
    };

    await updateControl();
});

client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}`)
});
client.login(token).catch(console.error);

// Global error handling
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);
process.on("uncaughtExceptionMonitor", console.error);
/**
 * @copyright
 * Code by Sobhan-SRZA (mr.sinre) | https://github.com/Sobhan-SRZA
 * Developed for Persian Caesar | https://github.com/Persian-Caesar | https://dsc.gg/persian-caesar
 *
 * If you encounter any issues or need assistance with this code,
 * please make sure to credit "Persian Caesar" in your documentation or communications.
 */