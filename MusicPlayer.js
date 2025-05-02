const {
    joinVoiceChannel,
    AudioPlayerStatus,
    createAudioPlayer,
    createAudioResource,
    entersState,
    VoiceConnectionStatus
} = require("@discordjs/voice");
const YouTubeService = require("./YouTubeService");
const ytdl_core_discord = require("ytdl-core-discord");
const youtubedl = require("youtube-dl-exec");
const ytdl_core = require("ytdl-core");
const ytdl = require("@distube/ytdl-core");

module.exports = class MusicPlayer {

    /**
     * 
     * @param {import("discord.js").VoiceBasedChannel} channel 
     * @param {import("discord.js").TextChannel} metadataChannel 
     * @param {string} [youtubeApiKey="AIzaSyB6UmpHiTCnn2v6848oxr_5vMEcdJWwkNo"] 
     * @param {number} [initialVolume=0.5] 
     */
    constructor(
        channel,
        metadataChannel,
        youtubeApiKey = "AIzaSyB6UmpHiTCnn2v6848oxr_5vMEcdJWwkNo",
        initialVolume = 0.5
    ) {
        this.channel = channel;
        this.metadata = metadataChannel;
        this.player = createAudioPlayer();
        this.volume = initialVolume;
        this.yt = new YouTubeService(youtubeApiKey);

        this.connection = null;
        this.queue = [];
        this.history = [];
        this.loopQueue = false;
        this.loopTrack = false;
        this.playing = false;
        this.playCollector = null;

        this.player.on(AudioPlayerStatus.Idle, () => this.#onIdle());
        this.player.on("error", err => {
            console.error("Player error:", err);
            this.playCollector.stop();
            this.metadata.send(`❌ error while playing: ${err.message}`);
        });

    }

    async #ensureConnection() {
        if (!this.connection) {
            this.connection = joinVoiceChannel({
                channelId: this.channel.id,
                guildId: this.channel.guildId,
                adapterCreator: this.channel.guild.voiceAdapterCreator
            });
            try {
                await entersState(
                    this.connection,
                    VoiceConnectionStatus.Ready,
                    20_000
                );
                this.connection.subscribe(this.player);
            } catch {
                this.connection.destroy();
                this.connection = null;
                throw new Error("❌ failed to connect voice channel.");
            }
        }
    }

    /**
     * 
     * @param {string} query 
     * @returns {Promise<string>}
     */
    async search(query) {
        if (/^https?:\/\//.test(query)) return query;

        return await this.yt.searchFirstVideoURL(query);
    }

    /**
     * 
     * @param {string} url 
     * @returns {Promise<import("stream").PassThrough>}
     */
    async createStreamFromYtdl(url) {
        const options = { filter: "audioonly", highWaterMark: 1 << 25 };
        try {
            return await ytdl(url, options);
        } catch {
            try {
                return await ytdl_core(url, options);
            } catch {
                return await ytdl_core_discord(url, options);
            }
        }
    }

    /**
    * 
    * @param {string} url 
    * @returns {Promise<import("stream").PassThrough>}
    */
    async createStreamFromYtDlExec(url) {
        const ytdlProcess = await youtubedl(url);

        return ytdlProcess;
    }

    /**
     * 
     * @param {string} url 
     * @returns {Promise<void>}
     */
    async #playUrl(url) {
        this.playing = true;
        this.history.push(url);
        let stream = await this.createStreamFromYtdl(url);
        if (!stream)
            stream = await this.createStreamFromYtDlExec(url);

        const resource = createAudioResource(stream, { inlineVolume: true });
        resource.volume?.setVolume(this.volume);
        this.player.play(resource);
        this.player.resource = resource;
        const playMessage = await this.metadata.send(`▶️ playing: ${url}`);
        const controls = new Map([
            ["⏭️", async () => this.skip()],
            ["⏮️", async () => this.previous()],
            ["🔀", async () => { this.shuffle(); await this.metadata.send("🔀 queue is shuffled"); }],
            ["🔁", async () => { this.toggleLoopQueue(); await this.metadata.send(this.isLoopQueue() ? "🔁 queue repeat is on." : "▶️ queue repeat is off."); }],
            ["🔂", async () => { this.toggleLoopTrack(); await this.metadata.send(this.isLoopTrack() ? "🔂 track repeat is on." : "▶️ track repeat is off."); }],
            ["⏸️", async () => this.pause()],
            ["▶️", async () => this.resume()],
            ["🔉", async () => this.setVolume(this.getVolume() - 10)],
            ["🔊", async () => this.setVolume(this.getVolume() + 10)],
            ["⏹️", async () => { this.stop(); collector.stop(); }],
            ["❌", async () => { this.stop(true); collector.stop(); }]
        ]);

        for (const emoji of controls.keys())
            await playMessage.react(emoji);

        const filter = (r, u) =>
            controls.has(r.emoji.name);

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
        this.playCollector = collector;
        return
    }

    /**
     * 
     * @param {string} input 
     * @returns {Promise<void>}
     */
    async play(input) {
        await this.#ensureConnection();
        const url = await this.search(input);

        if (this.playing) {
            this.queue.push(url);
            await this.metadata.send(`➕ music is added to queue: ${url} (queue size: ${this.queue.length})`);
            return undefined;
        }

        else
            return await this.#playUrl(url);

    }

    /**
     * @returns {void}
     */
    pause() {
        this.player.pause();
        this.metadata.send("⏸️ player is paused.");
    }

    /**
     * @returns {void}
     */
    resume() {
        this.player.unpause();
        this.metadata.send("▶️ player is resume.");
    }

    /**
     * @param {number} percent 
     * @returns {void}
     */
    setVolume(percent) {
        percent /= 100;
        if (percent < 0 || percent > 2)
            this.volume = 2;

        else
            this.volume = percent;

        const resource = this.player.state?.resource;
        try {
            resource.volume?.setVolume(this.volume);
        } catch { }

        this.metadata.send(`🔊 player volume changed to \`${Math.round(this.volume * 100)}٪\``);
    }

    /**
     * @returns {Promise<void>}
     */
    async #onIdle() {
        this.playCollector.stop();
        if (this.loopTrack) {
            return this.#playUrl(this.history[this.history.length - 1]);
        }

        if (this.queue.length) {
            const next = this.queue.shift();
            if (this.loopQueue) this.queue.push(next);
            await this.#playUrl(next);
            return;
        }

        this.playing = false;
        await this.metadata.send("⏹️ music is finished and queue is empity.");
        return undefined;
    }

    /**
     * @returns {void}
     */
    skip() {
        this.playCollector.stop();
        this.player.stop();
    }

    /**
    * @returns {void}
    */
    previous() {
        if (this.history.length < 2) {
            this.metadata.send("❌ last track was not found.");
            return;
        }

        this.playCollector.stop();
        this.queue.unshift(this.history.pop());
        const prev = this.history.pop();
        this.#playUrl(prev);
    }

    /**
     * @returns {void}
     */
    shuffle() {
        for (let i = this.queue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
        }
    }

    /**
     * @returns {void}
     */
    toggleLoopQueue() {
        this.loopQueue = !this.loopQueue;
    }
    /**
     * @returns {void}
     */
    isLoopQueue() {
        return this.loopQueue;
    }

    /**
     * @returns {void}
     */
    toggleLoopTrack() {
        this.loopTrack = !this.loopTrack;
    }
    /**
     * @returns {void}
     */
    isLoopTrack() {
        return this.loopTrack;
    }

    /**
     * @param {boolean} [noLeave=true] 
     * @returns {void}
     */
    stop(noLeave = true) {
        this.player.stop();
        this.playing = false;
        this.queue = [];
        this.history = [];
        if (!noLeave && this.connection) {
            this.connection.destroy();
            this.connection = null;
        }
    }

    /**
     * @returns {string[]}
     */
    getQueue() {
        return [...this.queue];
    }

    /**
     * @returns {number}
     */
    getVolume() {
        const resource = this.player.state?.resource;
        if (resource && resource.volume && resource.volume.volume)
            return Math.round(
                resource.volume.volume * 100
            );

        return Math.round(
            this.volume * 100
        );
    }
}
/**
 * @copyright
 * Code by Sobhan-SRZA (mr.sinre) | https://github.com/Sobhan-SRZA
 * Developed for Persian Caesar | https://github.com/Persian-Caesar | https://dsc.gg/persian-caesar
 *
 * If you encounter any issues or need assistance with this code,
 * please make sure to credit "Persian Caesar" in your documentation or communications.
 */