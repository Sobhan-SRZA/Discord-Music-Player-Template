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

// export class MusicPlayer {
module.exports = class MusicPlayer {
    // private connection: VoiceConnection | null = null;
    // private player: AudioPlayer;
    // private volume: number;
    // private metadata: TextChannel;
    // private yt: YouTubeService;
    // private queue: string[] = [];
    // private history: string[] = [];
    // private loopQueue = false;
    // private loopTrack = false;
    // private playing = false;

    /**
     * 
     * @param {import("discord.js").VoiceChannel} channel 
     * @param {import("discord.js").TextChannel} metadataChannel 
     * @param {string} [youtubeApiKey="AIzaSyB6UmpHiTCnn2v6848oxr_5vMEcdJWwkNo"] 
     * @param {number} [initialVolume=0.5] 
     */
    constructor(
        // private channel: VoiceChannel,
        channel,
        // metadataChannel: TextChannel,
        metadataChannel,
        // youtubeApiKey: string = "AIzaSyB6UmpHiTCnn2v6848oxr_5vMEcdJWwkNo",
        youtubeApiKey = "AIzaSyB6UmpHiTCnn2v6848oxr_5vMEcdJWwkNo",
        initialVolume = 0.5
    ) {
        this.metadata = metadataChannel;
        this.player = createAudioPlayer();
        this.volume = initialVolume;
        this.yt = new YouTubeService(youtubeApiKey);

        // this.player.on(AudioPlayerStatus.Idle, () => this.onIdle());
        this.player.on(AudioPlayerStatus.Idle, () => this.#onIdle());
        this.player.on("error", err => {
            console.error("Player error:", err);
            this.metadata.send(`❌ error while playing: ${err.message}`);
        });

    }

    // private async ensureConnection() {
    async #ensureConnection() {
        if (!this.connection) {
            this.connection = joinVoiceChannel({
                channelId: this.channel.id,
                guildId: this.channel.guild.id,
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

    // public async search(query: string): Promise<string> {
    /**
     * 
     * @param {string} query 
     * @returns {Promise<string>}
     */
    async search(query) {
        if (/^https?:\/\//.test(query)) return query;

        return await this.yt.searchFirstVideoURL(query);
    }

    // public async createStreamFromYtdl(url: string) {
    /**
     * 
     * @param {string} url 
     * @returns {Promise<import("stream").PassThrough>}
     */
    async createStreamFromYtdl(url) {
        // const options: any = { filter: "audioonly", highWaterMark: 1 << 25 };
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

    // private async createStreamFromYtDlExec(url: string): Promise<PassThrough> {
    /**
    * 
    * @param {string} url 
    * @returns {Promise<import("stream").PassThrough>}
    */
    async createStreamFromYtDlExec(url) {
        const ytdlProcess = await youtubedl(url);

        // return ytdlProcess as unknown as PassThrough;
        return ytdlProcess;
    }

    // private async playUrl(url: string) {
    /**
     * 
     * @param {string} url 
     * @returns {void}
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
        return this.metadata.send(`▶️ playing: ${url}`);
    }

    // public async play(input: string) {
    /**
     * 
     * @param {string} input 
     * @returns {void}
     */
    async play(input) {
        // await this.ensureConnection();
        await this.#ensureConnection();
        const url = await this.search(input);

        if (this.playing) {
            this.queue.push(url);
            await this.metadata.send(`➕ music is added to queue: ${url} (queue size: ${this.queue.length})`);
            return undefined;
        }

        else
            // return await this.playUrl(url);
            return await this.#playUrl(url);

    }

    // public pause() {
    /**
     * @returns {void}
     */
    pause() {
        this.player.pause();
        this.metadata.send("⏸️ player is paused.");
    }

    // public resume() {
    /**
     * @returns {void}
     */
    resume() {
        this.player.unpause();
        this.metadata.send("▶️ player is resume.");
    }

    // public setVolume(percent: number) {
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

        // const resource = (this.player.state as AudioPlayerPlayingState).resource;
        const resource = this.player.state?.resource;
        try {
            resource.volume?.setVolume(this.volume);
        } catch { }

        this.metadata.send(`🔊 player volume changed to \`${Math.round(this.volume * 100)}٪\``);
    }

    // private async onIdle() {
    /**
     * @returns {void}
     */
    async #onIdle() {
        if (this.loopTrack) {
            return this.playUrl(this.history[this.history.length - 1]);
        }

        if (this.queue.length) {
            const next = this.queue.shift();
            if (this.loopQueue) this.queue.push(next);
            return this.playUrl(next);
        }

        this.playing = false;
        await this.metadata.send("⏹️ music is finished and queue is empity.");
        return undefined;
    }

    // public skip() {
    /**
     * @returns {void}
     */
    skip() {
        this.player.stop();
    }

    // public previous() {
    /**
    * @returns {void}
    */
    previous() {
        if (this.history.length < 2) {
            this.metadata.send("❌ last track was not found.");
            return;
        }

        this.queue.unshift(this.history.pop());
        const prev = this.history.pop();
        // this.playUrl(prev);
        this.#playUrl(prev);
    }

    // public shuffle() {
    /**
     * @returns {void}
     */
    shuffle() {
        for (let i = this.queue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
        }
    }

    // public toggleLoopQueue() {
    /**
     * @returns {void}
     */
    toggleLoopQueue() {
        this.loopQueue = !this.loopQueue;
    }
    // public isLoopQueue() {
    /**
     * @returns {void}
     */
    isLoopQueue() {
        return this.loopQueue;
    }

    // public toggleLoopTrack() {
    /**
     * @returns {void}
     */
    toggleLoopTrack() {
        this.loopTrack = !this.loopTrack;
    }
    // public isLoopTrack() {
    /**
     * @returns {void}
     */
    isLoopTrack() {
        return this.loopTrack;
    }

    // public stop(noLeave = true) {
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

    // public getQueue() {
    /**
     * @returns {string[]}
     */
    getQueue() {
        return [...this.queue];
    }

    // public getVolume() {
    /**
     * @returns {number}
     */
    getVolume() {
        // const resource = (this.player.state as AudioPlayerPlayingState).resource;
        const resource = this.player.state?.resource;
        if (resource && resource.volume && resource.volume.volume)
            return Math.round(
                Math.min(
                    Math.max(resource.volume.volume, 0), 1
                ) * 100
            );

        return Math.round(this.volume * 100);
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