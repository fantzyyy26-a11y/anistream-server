/**
 * AniStream Hub Video Player Engine (HLS + Multi-Server Iframe Embed)
 */

class AnimePlayer {
    constructor() {
        this.playerModal = document.getElementById('player-modal');
        this.videoIframe = document.getElementById('video-iframe');
        this.hlsVideo = document.getElementById('hls-video');
        this.playerLoader = document.getElementById('player-loader');
        this.serverSelect = document.getElementById('server-select');
        
        this.animeTitleEl = document.getElementById('player-anime-title');
        this.epTitleEl = document.getElementById('player-ep-title');
        this.episodesGrid = document.getElementById('player-episodes-grid');
        
        this.unreleasedNotice = document.getElementById('unreleased-notice');
        this.unreleasedStatusText = document.getElementById('unreleased-status-text');
        
        this.prevBtn = document.getElementById('prev-ep-btn');
        this.nextBtn = document.getElementById('next-ep-btn');
        this.closeBtn = document.getElementById('close-player-btn');
        
        this.hlsInstance = null;
        this.currentAnime = null;
        this.currentEpIndex = 0;
        this.servers = [];

        this.initEvents();
    }

    initEvents() {
        this.closeBtn.addEventListener('click', () => this.close());
        this.serverSelect.addEventListener('change', (e) => this.switchServer(parseInt(e.target.value)));

        this.prevBtn.addEventListener('click', () => {
            if (this.currentEpIndex > 0) {
                this.loadEpisode(this.currentEpIndex - 1);
            }
        });

        this.nextBtn.addEventListener('click', () => {
            if (this.currentAnime && this.currentAnime.episodes && this.currentEpIndex < this.currentAnime.episodes.length - 1) {
                this.loadEpisode(this.currentEpIndex + 1);
            }
        });
    }

    open(animeData, episodeIndex = 0) {
        if (window.AniApp && !window.AniApp.currentUser) {
            window.AniApp.openAuthModal('Silakan Masuk / Daftar akun terlebih dahulu untuk menonton anime!');
            return;
        }
        this.currentAnime = animeData;
        this.playerModal.classList.remove('hidden');
        this.animeTitleEl.textContent = animeData.title;

        // Check if anime is unreleased / RELEASING / future season
        const isUpcoming = animeData.year >= 2026 || (animeData.status === 'RELEASING' && animeData.title.includes('Season 3'));
        if (this.unreleasedNotice) {
            if (isUpcoming) {
                this.unreleasedNotice.classList.remove('hidden');
                if (this.unreleasedStatusText) {
                    this.unreleasedStatusText.textContent = `${animeData.title} (Belum Tayang)`;
                }
            } else {
                this.unreleasedNotice.classList.add('hidden');
            }
        }
        
        this.renderEpisodesGrid();
        this.loadEpisode(episodeIndex);
    }

    async loadEpisode(index) {
        this.currentEpIndex = index;
        const episode = this.currentAnime.episodes[index];
        if (!episode) return;

        this.epTitleEl.textContent = `Episode ${episode.episode_number}`;
        this.showLoader(true);

        // Update nav buttons disabled state
        this.prevBtn.disabled = index === 0;
        this.nextBtn.disabled = index >= this.currentAnime.episodes.length - 1;

        // Highlight active episode button
        this.updateActiveEpBtn(index);

        // Save to Watch History
        if (window.AniApp && window.AniApp.addToHistory) {
            window.AniApp.addToHistory(this.currentAnime, episode.episode_number);
        }

        try {
            const animeId = this.currentAnime.id;
            const malId = this.currentAnime.mal_id || this.currentAnime.id;
            const animeTitle = this.currentAnime.title || '';
            const otakuUrl = this.currentAnime.otaku_url || '';
            const slug = episode.slug;
            const epNum = episode.episode_number;
            
            const res = await fetch(`/api/stream/${animeId}/${epNum}?slug=${encodeURIComponent(slug)}&mal=${malId}&title=${encodeURIComponent(animeTitle)}&otaku_url=${encodeURIComponent(otakuUrl)}`);
            const json = await res.json();
            
            if (json.status === 'success' && json.data && json.data.servers) {
                this.servers = json.data.servers;
                this.populateServerOptions();
                this.switchServer(0);
            } else {
                this.showFallbackServer(epNum);
            }
        } catch (err) {
            console.error("Error loading stream servers:", err);
            this.showFallbackServer(episode.episode_number);
        }
    }

    populateServerOptions() {
        this.serverSelect.innerHTML = '';
        this.servers.forEach((srv, idx) => {
            const opt = document.createElement('option');
            const cleanName = srv.name.replace(/otakudesu\s*/gi, '').trim();
            opt.textContent = cleanName.includes(srv.quality) ? cleanName : `${cleanName} (${srv.quality})`;
            this.serverSelect.appendChild(opt);
        });
        if (this.serverSelect && this.servers.length > 0) {
            this.serverSelect.value = 0;
        }
    }

    switchServer(index) {
        const server = this.servers[index];
        if (!server) return;

        if (this.serverSelect) {
            this.serverSelect.value = index;
        }

        this.showLoader(true);

        if (server.type === 'native_mp4') {
            this.stopHLS();
            this.videoIframe.classList.add('hidden');
            this.hlsVideo.classList.remove('hidden');
            this.hlsVideo.src = server.url;
            this.hlsVideo.controls = true;
            this.hlsVideo.play().catch(e => console.log("Autoplay check:", e));
            this.showLoader(false);
        } else if (server.type === 'hls') {
            this.videoIframe.classList.add('hidden');
            this.hlsVideo.classList.remove('hidden');
            this.playHLS(server.url);
        } else {
            this.stopHLS();
            this.hlsVideo.classList.add('hidden');
            this.videoIframe.classList.remove('hidden');
            this.videoIframe.removeAttribute('srcdoc');
            this.videoIframe.src = server.url;
            
            this.videoIframe.onload = () => {
                this.showLoader(false);
            };
            setTimeout(() => this.showLoader(false), 800);
        }
    }

    playHLS(url) {
        if (Hls.isSupported()) {
            if (this.hlsInstance) this.hlsInstance.destroy();
            this.hlsInstance = new Hls();
            this.hlsInstance.loadSource(url);
            this.hlsInstance.attachMedia(this.hlsVideo);
            this.hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
                this.hlsVideo.play();
                this.showLoader(false);
            });
        } else if (this.hlsVideo.canPlayType('application/vnd.apple.mpegurl')) {
            this.hlsVideo.src = url;
            this.hlsVideo.play();
            this.showLoader(false);
        }
    }

    stopHLS() {
        if (this.hlsInstance) {
            this.hlsInstance.destroy();
            this.hlsInstance = null;
        }
        this.hlsVideo.pause();
        this.hlsVideo.src = '';
    }

    showFallbackServer(epNum) {
        const animeId = this.currentAnime ? this.currentAnime.id : '';
        const episode = this.currentAnime && this.currentAnime.episodes ? this.currentAnime.episodes.find(e => e.episode_number == epNum) : null;
        const slug = episode ? episode.slug : `episode-${epNum}`;
        this.servers = [
            {
                "name": "Server 1 (Embtaku - HD Auto)",
                "type": "iframe",
                "url": `https://embtaku.pro/streaming.php?slug=${slug}`,
                "quality": "720p / 1080p HD"
            },
            {
                "name": "Server 2 (Embtaku Alt - HD)",
                "type": "iframe",
                "url": `https://embtaku.com/streaming.php?slug=${slug}`,
                "quality": "720p / 1080p HD"
            },
            {
                "name": "Server 3 (VidSrc NL - 720p HD)",
                "type": "iframe",
                "url": `https://player.vidsrc.nl/embed/anime?anilist=${animeId}&ep=${epNum}`,
                "quality": "720p HD"
            }
        ];
        this.populateServerOptions();
        this.switchServer(0);
    }

    renderEpisodesGrid() {
        this.episodesGrid.innerHTML = '';
        if (!this.currentAnime || !this.currentAnime.episodes) return;

        this.currentAnime.episodes.forEach((ep, idx) => {
            const btn = document.createElement('button');
            btn.className = `ep-btn ${idx === this.currentEpIndex ? 'active' : ''}`;
            btn.textContent = ep.episode_number;
            btn.dataset.index = idx;
            btn.onclick = () => this.loadEpisode(idx);
            this.episodesGrid.appendChild(btn);
        });
    }

    updateActiveEpBtn(index) {
        const btns = this.episodesGrid.querySelectorAll('.ep-btn');
        btns.forEach((b, idx) => {
            if (idx === index) b.classList.add('active');
            else b.classList.remove('active');
        });
    }

    showLoader(show) {
        if (show) {
            this.playerLoader.classList.remove('hidden');
        } else {
            this.playerLoader.classList.add('hidden');
        }
    }

    close() {
        this.stopHLS();
        this.videoIframe.src = 'about:blank';
        this.playerModal.classList.add('hidden');
    }
}

window.AnimePlayer = AnimePlayer;
