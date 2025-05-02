const { google } = require("googleapis");

module.exports = class YouTubeService {

    /**
     * 
     * @param {string} apiKey 
     */
    constructor(apiKey) {
        this.youtube = google.youtube({
            version: "v3",
            auth: apiKey
        });
    }

    /**
     * 
     * @param {string} query 
     * @returns {Promise<string>}
     */
    async searchFirstVideoURL(query) {
        const res = await this.youtube.search.list({
            part: ["snippet"],
            q: query,
            maxResults: 1,
            type: ["video"]
        });
        const item = res.data.items?.[0];
        if (!item || !item.id?.videoId)
            throw new Error("Video was not found");

        return `https://www.youtube.com/watch?v=${item.id.videoId}`;
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