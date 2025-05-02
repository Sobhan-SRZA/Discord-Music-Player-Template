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
const MusicPlayer = require("./MusicPlayer")
const discordjs = require("discord.js");
const client = new discordjs.Client({
    intents: [
        "MessageContent",
        "Guilds",
        "GuildMessages",
        "GuildMessageReactions",
        "GuildMembers",
        "GuildVoiceStates"
    ],
    partials: [
        discordjs.Partials.Channel,
        discordjs.Partials.GuildMember,
        discordjs.Partials.Message,
        discordjs.Partials.Reaction,
        discordjs.Partials.User
    ]
});
const token = "bot token here";
const prefix = "bot prefix here";

// add player map to client
client.players = new Map(); // Map<string, MusicPlayer>

// play comamnd
client.on("messageCreate", async (message) => {
    // Filter dm channels
    if (message.channel.type === discordjs.ChannelType.DM) return;

    // Filter webhooks
    if (!message || message?.webhookId) return;

    // Filter the bots
    if (message.author?.bot) return;

    // Command Prefix & args
    const
        stringPrefix = prefix,
        prefixRegex = new RegExp(
            `^(<@!?${client.user.id}>|${stringPrefix.toString().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\s*`
        );

    // Send prefix to channel
    if (!prefixRegex.test(message.content.toLowerCase()))
        return;

    const [bot_prefix] = message.content.toLowerCase().match(prefixRegex);
    if (message.content.toLowerCase().indexOf(bot_prefix) !== 0)
        return;

    const args = message.content.slice(prefix.length).trim().split(/ +/g);
    const commandName = args.shift().toLowerCase();
    if (!commandName) {
        if (bot_prefix.startsWith("<@")) {
            return await message.reply({
                content: `bot prefix is: \`${stringPrefix}\`\``,
            });
        }
        return;
    };

    // Command Handler
    switch (commandName) {
        case "help":
            await message.reply(`\`${prefix}play\``);
            break;

        case "play":
            const players = client.players;
            if (!message.member?.voice.channel)
                return await message.reply("please join to a voice channel");

            const query = args && args.join(" ");
            if (!query) return await message.reply("please write a music name or youtube link.");

            try {
                let player = players.get(message.guild.id);
                if (!player) {
                    player = new MusicPlayer(
                        message.member.voice.channel,
                        message.channel
                    );
                    players.set(message.guild.id, player);
                }

                const playMessage = await player.play(query);
                if (!playMessage) return;

                const controls = new Map([
                    ["⏭️", async () => player.skip()],
                    ["⏮️", async () => player.previous()],
                    ["🔀", async () => { player.shuffle(); await message.channel.send("🔀 queue is shuffled"); }],
                    ["🔁", async () => { player.toggleLoopQueue(); await message.channel.send(player.isLoopQueue() ? "🔁 queue repeat is on." : "▶️ queue repeat is off."); }],
                    ["🔂", async () => { player.toggleLoopTrack(); await message.channel.send(player.isLoopTrack() ? "🔂 track repeat is on." : "▶️ track repeat is off."); }],
                    ["⏸️", async () => player.pause()],
                    ["▶️", async () => player.resume()],
                    ["🔉", async () => player.setVolume(player.getVolume() - 0.1)],
                    ["🔊", async () => player.setVolume(player.getVolume() + 0.1)],
                    ["⏹️", async () => { player.stop(); collector.stop(); }],
                    ["❌", async () => { player.stop(true); collector.stop(); }]
                ]);

                for (const emoji of controls.keys())
                    await playMessage.react(emoji);

                const filter = (r, u) =>
                    controls.has(r.emoji.name) && u.id === message.author.id;

                const collector = playMessage.createReactionCollector({ filter, time: 5 * 60_000 });

                collector.on("collect", async (reaction, user) => {
                    try {
                        await reaction.users.remove(user.id);
                        const action = controls.get(reaction.emoji.name);
                        if (action)
                            await action();

                    } catch (err) {
                        console.error(err);
                    }
                });

                collector.on("end", () => {
                    playMessage.reactions.removeAll().catch(() => null);
                });

            } catch (e) {
                console.error(e);
                await message.reply(`❌ error: ${e.message}`);
            }

            break;

        default:
            await message.reply("wrong command")
            break;
    }
})

// login to discord
client.login(token);

// anti crash
process.on("unhandledRejection", (e) => console.error(e));
process.on("rejectionHandled", (e) => console.error(e));
process.on("uncaughtException", (e) => console.error(e));
process.on("uncaughtExceptionMonitor", (e) => console.error(e));
/**
 * @copyright
 * Code by Sobhan-SRZA (mr.sinre) | https://github.com/Sobhan-SRZA
 * Developed for Persian Caesar | https://github.com/Persian-Caesar | https://dsc.gg/persian-caesar
 *
 * If you encounter any issues or need assistance with this code,
 * please make sure to credit "Persian Caesar" in your documentation or communications.
 */