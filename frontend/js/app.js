/**
 * AniStream Hub Main Mobile App Module
 */

document.addEventListener('DOMContentLoaded', () => {
    class AniApp {
        constructor() {
            this.trendingData = [];
            this.seasonalData = [];
            this.currentDetailData = null;
            
            this.watchlist = JSON.parse(localStorage.getItem('ani_watchlist') || '[]');
            this.history = JSON.parse(localStorage.getItem('ani_history') || '[]');
            
            this.player = new window.AnimePlayer();
            
            this.initDOM();
            this.initEvents();
            this.loadInitialData();
        }

        initDOM() {
            this.heroCarousel = document.getElementById('hero-carousel');
            this.seasonalGrid = document.getElementById('seasonal-grid');
            this.trendingGrid = document.getElementById('trending-grid');
            this.searchGrid = document.getElementById('search-grid');
            this.watchlistGrid = document.getElementById('watchlist-grid');
            this.historyGrid = document.getElementById('history-grid');
            
            this.searchResultsSection = document.getElementById('search-results-section');
            this.watchlistSection = document.getElementById('watchlist-section');
            this.historySection = document.getElementById('history-section');
            
            this.searchToggleBtn = document.getElementById('search-toggle-btn');
            this.searchBarContainer = document.getElementById('search-bar-container');
            this.searchInput = document.getElementById('search-input');
            this.searchClearBtn = document.getElementById('search-clear-btn');
            
            this.detailModal = document.getElementById('detail-modal');
            this.closeDetailBtn = document.getElementById('close-detail-btn');
            this.startWatchBtn = document.getElementById('start-watch-btn');
            this.toggleWatchlistBtn = document.getElementById('toggle-watchlist-btn');
            
            this.navItems = document.querySelectorAll('.bottom-nav .nav-item');
            this.genreChips = document.querySelectorAll('.genre-chip');
            this.dayChips = document.querySelectorAll('.day-chip');
            this.otakuOngoingGrid = document.getElementById('otakudesu-ongoing-grid');
            this.aboutSection = document.getElementById('about-section');
            
            // Auth elements
            this.authBtn = document.getElementById('auth-btn');
            this.authUserLabel = document.getElementById('auth-user-label');
            this.authModal = document.getElementById('auth-modal');
            this.closeAuthBtn = document.getElementById('close-auth-btn');
            this.tabLoginBtn = document.getElementById('tab-login-btn');
            this.tabRegisterBtn = document.getElementById('tab-register-btn');
            this.loginForm = document.getElementById('login-form');
            this.registerForm = document.getElementById('register-form');
            this.otpForm = document.getElementById('otp-form');
            this.otpInput = document.getElementById('otp-input');
            this.backToRegBtn = document.getElementById('back-to-reg-btn');
            this.authAlert = document.getElementById('auth-alert');
            
            // Profile modal elements
            this.profileModal = document.getElementById('profile-modal');
            this.closeProfileBtn = document.getElementById('close-profile-btn');
            this.profileUsernameDisplay = document.getElementById('profile-username-display');
            this.profileEmailDisplay = document.getElementById('profile-email-display');
            this.profileAlert = document.getElementById('profile-alert');
            this.changePasswordForm = document.getElementById('change-password-form');
            this.profileLogoutBtn = document.getElementById('profile-logout-btn');
            
            // Forgot Password elements
            this.forgotPwdLink = document.getElementById('forgot-pwd-link');
            this.forgotForm = document.getElementById('forgot-form');
            this.resetPwdForm = document.getElementById('reset-pwd-form');
            this.backToLoginBtn1 = document.getElementById('back-to-login-btn-1');
            this.backToLoginBtn2 = document.getElementById('back-to-login-btn-2');
            
            this.currentUser = null;
            this.pendingEmail = '';
            this.pendingResetEmail = '';
            this.checkUserAuth();
        }

        initEvents() {
            // Search Toggle
            this.searchToggleBtn.addEventListener('click', () => {
                this.searchBarContainer.classList.toggle('hidden');
                if (!this.searchBarContainer.classList.contains('hidden')) {
                    this.searchInput.focus();
                }
            });

            this.searchClearBtn.addEventListener('click', () => {
                this.searchInput.value = '';
                this.searchClearBtn.classList.add('hidden');
                this.searchResultsSection.classList.add('hidden');
            });

            // Realtime Live Search & Clear
            let searchTimeout = null;
            this.searchInput.addEventListener('input', (e) => {
                const val = e.target.value.trim();
                this.searchClearBtn.classList.toggle('hidden', val.length === 0);
                
                clearTimeout(searchTimeout);
                if (val.length >= 2) {
                    searchTimeout = setTimeout(() => {
                        this.performSearch(val);
                    }, 350);
                } else if (val.length === 0) {
                    this.searchResultsSection.classList.add('hidden');
                }
            });

            this.searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    clearTimeout(searchTimeout);
                    const query = this.searchInput.value.trim();
                    if (query) {
                        this.performSearch(query);
                    }
                }
            });

            // Detail Modal Close
            this.closeDetailBtn.addEventListener('click', () => {
                this.detailModal.classList.add('hidden');
            });

            // Auth & Profile Modal Listeners
            if (this.authBtn) {
                this.authBtn.addEventListener('click', () => {
                    if (this.currentUser) {
                        this.openProfileModal();
                    } else {
                        this.openAuthModal();
                    }
                });
            }

            if (this.closeProfileBtn) {
                this.closeProfileBtn.addEventListener('click', () => this.closeProfileModal());
            }

            if (this.profileLogoutBtn) {
                this.profileLogoutBtn.addEventListener('click', () => {
                    localStorage.removeItem('anistream_token');
                    this.currentUser = null;
                    if (this.authUserLabel) this.authUserLabel.textContent = 'Masuk';
                    this.closeProfileModal();
                    this.showToast('Berhasil keluar akun.');
                });
            }

            if (this.changePasswordForm) {
                this.changePasswordForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const old_password = document.getElementById('change-old-password').value;
                    const new_password = document.getElementById('change-new-password').value;
                    const token = localStorage.getItem('anistream_token');
                    try {
                        const res = await fetch('/api/auth/change_password', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ token, old_password, new_password })
                        });
                        const json = await res.json();
                        if (res.ok && json.status === 'success') {
                            this.profileAlert.className = 'auth-alert success';
                            this.profileAlert.textContent = json.message || 'Password berhasil diperbarui!';
                            this.profileAlert.classList.remove('hidden');
                            document.getElementById('change-old-password').value = '';
                            document.getElementById('change-new-password').value = '';
                        } else {
                            this.profileAlert.className = 'auth-alert error';
                            this.profileAlert.textContent = json.detail || json.message || 'Gagal mengubah password.';
                            this.profileAlert.classList.remove('hidden');
                        }
                    } catch (err) {
                        this.profileAlert.className = 'auth-alert error';
                        this.profileAlert.textContent = 'Gagal menghubungkan ke server.';
                        this.profileAlert.classList.remove('hidden');
                    }
                });
            }

            if (this.closeAuthBtn) {
                this.closeAuthBtn.addEventListener('click', () => this.closeAuthModal());
            }

            if (this.tabLoginBtn && this.tabRegisterBtn) {
                this.tabLoginBtn.addEventListener('click', () => {
                    this.tabLoginBtn.classList.add('active');
                    this.tabRegisterBtn.classList.remove('active');
                    if (this.forgotForm) this.forgotForm.classList.add('hidden');
                    if (this.resetPwdForm) this.resetPwdForm.classList.add('hidden');
                    if (this.otpForm) this.otpForm.classList.add('hidden');
                    this.loginForm.classList.remove('hidden');
                    this.registerForm.classList.add('hidden');
                    document.getElementById('auth-title').textContent = 'Masuk ke AniStream';
                    if (this.authAlert) this.authAlert.classList.add('hidden');
                });
                this.tabRegisterBtn.addEventListener('click', () => {
                    this.tabRegisterBtn.classList.add('active');
                    this.tabLoginBtn.classList.remove('active');
                    if (this.forgotForm) this.forgotForm.classList.add('hidden');
                    if (this.resetPwdForm) this.resetPwdForm.classList.add('hidden');
                    if (this.otpForm) this.otpForm.classList.add('hidden');
                    this.registerForm.classList.remove('hidden');
                    this.loginForm.classList.add('hidden');
                    document.getElementById('auth-title').textContent = 'Daftar Akun Baru';
                    if (this.authAlert) this.authAlert.classList.add('hidden');
                });
            }

            // Forgot Password Links & Handlers
            if (this.forgotPwdLink) {
                this.forgotPwdLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (this.loginForm) this.loginForm.classList.add('hidden');
                    if (this.registerForm) this.registerForm.classList.add('hidden');
                    if (this.otpForm) this.otpForm.classList.add('hidden');
                    if (this.resetPwdForm) this.resetPwdForm.classList.add('hidden');
                    if (this.forgotForm) this.forgotForm.classList.remove('hidden');
                    document.getElementById('auth-title').textContent = 'Lupa Password Akun';
                    if (this.authAlert) this.authAlert.classList.add('hidden');
                });
            }

            const showLoginForm = () => {
                if (this.forgotForm) this.forgotForm.classList.add('hidden');
                if (this.resetPwdForm) this.resetPwdForm.classList.add('hidden');
                if (this.registerForm) this.registerForm.classList.add('hidden');
                if (this.otpForm) this.otpForm.classList.add('hidden');
                if (this.loginForm) this.loginForm.classList.remove('hidden');
                document.getElementById('auth-title').textContent = 'Masuk ke AniStream';
            };

            if (this.backToLoginBtn1) this.backToLoginBtn1.addEventListener('click', showLoginForm);
            if (this.backToLoginBtn2) this.backToLoginBtn2.addEventListener('click', showLoginForm);

            if (this.forgotForm) {
                this.forgotForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const email = document.getElementById('forgot-email').value.trim();
                    try {
                        const res = await fetch('/api/auth/request_reset_password', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email })
                        });
                        const json = await res.json();
                        if (res.ok && json.status === 'success') {
                            this.pendingResetEmail = email;
                            this.forgotForm.classList.add('hidden');
                            if (this.resetPwdForm) this.resetPwdForm.classList.remove('hidden');
                            document.getElementById('auth-title').textContent = 'Input OTP & Password Baru';
                            this.authAlert.className = 'auth-alert success';
                            this.authAlert.textContent = json.message || `Kode OTP reset password telah dikirimkan ke Inbox Gmail ${email}!`;
                            this.authAlert.classList.remove('hidden');
                        } else {
                            this.authAlert.className = 'auth-alert error';
                            this.authAlert.textContent = json.detail || json.message || 'Email tidak ditemukan.';
                            this.authAlert.classList.remove('hidden');
                        }
                    } catch (err) {
                        this.authAlert.className = 'auth-alert error';
                        this.authAlert.textContent = 'Gagal menghubungkan ke server.';
                        this.authAlert.classList.remove('hidden');
                    }
                });
            }

            if (this.resetPwdForm) {
                this.resetPwdForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const otp_code = document.getElementById('reset-otp-input').value.trim();
                    const new_password = document.getElementById('reset-new-password').value;
                    const email = this.pendingResetEmail;
                    if (!email || !otp_code || !new_password) return;
                    try {
                        const res = await fetch('/api/auth/reset_password', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email, otp_code, new_password })
                        });
                        const json = await res.json();
                        if (res.ok && json.status === 'success') {
                            showLoginForm();
                            this.authAlert.className = 'auth-alert success';
                            this.authAlert.textContent = json.message || 'Password berhasil diperbarui! Silakan login.';
                            this.authAlert.classList.remove('hidden');
                        } else {
                            this.authAlert.className = 'auth-alert error';
                            this.authAlert.textContent = json.detail || json.message || 'Gagal mereset password.';
                            this.authAlert.classList.remove('hidden');
                        }
                    } catch (err) {
                        this.authAlert.className = 'auth-alert error';
                        this.authAlert.textContent = 'Gagal menghubungkan ke server.';
                        this.authAlert.classList.remove('hidden');
                    }
                });
            }

            if (this.loginForm) {
                this.loginForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const username_or_email = document.getElementById('login-username').value;
                    const password = document.getElementById('login-password').value;
                    try {
                        const res = await fetch('/api/auth/login', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ username_or_email, password })
                        });
                        const json = await res.json();
                        if (res.ok && json.status === 'success') {
                            localStorage.setItem('anistream_token', json.token);
                            this.currentUser = json.user;
                            if (this.authUserLabel) this.authUserLabel.textContent = json.user.username;
                            this.closeAuthModal();
                            this.showToast(`Selamat datang kembali, ${json.user.username}!`);
                        } else {
                            this.authAlert.className = 'auth-alert error';
                            this.authAlert.textContent = json.detail || json.message || 'Login gagal.';
                            this.authAlert.classList.remove('hidden');
                        }
                    } catch (err) {
                        this.authAlert.className = 'auth-alert error';
                        this.authAlert.textContent = 'Gagal menghubungkan ke server.';
                        this.authAlert.classList.remove('hidden');
                    }
                });
            }

            if (this.registerForm) {
                this.registerForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const username = document.getElementById('reg-username').value;
                    const email = document.getElementById('reg-email').value;
                    const password = document.getElementById('reg-password').value;
                    try {
                        const res = await fetch('/api/auth/request_otp', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ username, email, password })
                        });
                        const json = await res.json();
                        if (res.ok && json.status === 'success') {
                            this.pendingEmail = email;
                            this.registerForm.classList.add('hidden');
                            if (this.otpForm) this.otpForm.classList.remove('hidden');
                            document.getElementById('auth-title').textContent = 'Verifikasi Kode OTP Email';
                            this.authAlert.className = 'auth-alert success';
                            this.authAlert.textContent = json.message || `Kode OTP 6-Digit telah dikirimkan ke Inbox Gmail ${email}. Silakan buka Inbox Gmail Anda!`;
                            this.authAlert.classList.remove('hidden');
                            if (this.otpInput) {
                                this.otpInput.value = '';
                                this.otpInput.focus();
                            }
                        } else {
                            this.authAlert.className = 'auth-alert error';
                            this.authAlert.textContent = json.detail || json.message || 'Permintaan OTP gagal.';
                            this.authAlert.classList.remove('hidden');
                        }
                    } catch (err) {
                        this.authAlert.className = 'auth-alert error';
                        this.authAlert.textContent = 'Gagal menghubungkan ke server.';
                        this.authAlert.classList.remove('hidden');
                    }
                });
            }

            if (this.otpForm) {
                this.otpForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const otp_code = this.otpInput ? this.otpInput.value.trim() : '';
                    if (!this.pendingEmail || !otp_code) return;
                    try {
                        const res = await fetch('/api/auth/verify_otp', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: this.pendingEmail, otp_code })
                        });
                        const json = await res.json();
                        if (res.ok && json.status === 'success') {
                            localStorage.setItem('anistream_token', json.token);
                            this.currentUser = json.user;
                            if (this.authUserLabel) this.authUserLabel.textContent = json.user.username;
                            this.closeAuthModal();
                            this.showToast(`Verifikasi Berhasil! Selamat datang, ${json.user.username}!`);
                        } else {
                            this.authAlert.className = 'auth-alert error';
                            this.authAlert.textContent = json.detail || json.message || 'Kode OTP Salah!';
                            this.authAlert.classList.remove('hidden');
                        }
                    } catch (err) {
                        this.authAlert.className = 'auth-alert error';
                        this.authAlert.textContent = 'Gagal menghubungkan ke server.';
                        this.authAlert.classList.remove('hidden');
                    }
                });
            }

            if (this.backToRegBtn) {
                this.backToRegBtn.addEventListener('click', () => {
                    if (this.otpForm) this.otpForm.classList.add('hidden');
                    if (this.registerForm) this.registerForm.classList.remove('hidden');
                    document.getElementById('auth-title').textContent = 'Daftar Akun Baru';
                    if (this.authAlert) this.authAlert.classList.add('hidden');
                });
            }

            // Start Watch Button
            this.startWatchBtn.addEventListener('click', () => {
                if (!this.currentUser) {
                    this.openAuthModal('Silakan Masuk / Daftar akun terlebih dahulu untuk menonton anime!');
                    return;
                }
                if (this.currentDetailData && this.currentDetailData.episodes && this.currentDetailData.episodes.length > 0) {
                    this.player.open(this.currentDetailData, 0);
                }
            });

            // Toggle Watchlist
            this.toggleWatchlistBtn.addEventListener('click', () => {
                if (!this.currentUser) {
                    this.openAuthModal('Silakan Masuk / Daftar akun terlebih dahulu untuk menyimpan favorit!');
                    return;
                }
                if (!this.currentDetailData) return;
                this.toggleWatchlist(this.currentDetailData);
            });

            // Navigation Tabs
            this.navItems.forEach(item => {
                item.addEventListener('click', () => {
                    this.switchTab(item.dataset.tab);
                    this.navItems.forEach(n => n.classList.remove('active'));
                    item.classList.add('active');
                });
            });

            // Genre Chips Filter
            this.genreChips.forEach(chip => {
                chip.addEventListener('click', () => {
                    this.genreChips.forEach(c => c.classList.remove('active'));
                    chip.classList.add('active');
                    this.filterByGenre(chip.dataset.genre);
                });
            });

            // Day Chips Filter (Jadwal Otakudesu Realtime)
            this.dayChips.forEach(chip => {
                chip.addEventListener('click', () => {
                    this.dayChips.forEach(c => c.classList.remove('active'));
                    chip.classList.add('active');
                    this.filterByDay(chip.dataset.day);
                });
            });
        }

        async loadInitialData() {
            try {
                const [respSeasonal, respTrending, respOtakuOngoing] = await Promise.all([
                    fetch('/api/seasonal?limit=12'),
                    fetch('/api/trending?limit=16'),
                    fetch('/api/otakudesu_ongoing')
                ]);

                const dataSeasonal = await respSeasonal.json();
                const dataTrending = await respTrending.json();
                const dataOtaku = await respOtakuOngoing.json();

                if (dataSeasonal.status === 'success') {
                    this.seasonalData = dataSeasonal.data;
                    this.renderGrid(this.seasonalGrid, this.seasonalData);
                }

                if (dataTrending.status === 'success') {
                    this.trendingData = dataTrending.data;
                    this.renderGrid(this.trendingGrid, this.trendingData);
                    this.renderHeroCarousel(this.trendingData.slice(0, 5));
                }

                if (dataOtaku.status === 'success' && dataOtaku.data) {
                    this.otakuOngoingData = dataOtaku.data;
                    this.renderOtakuOngoingGrid(this.otakuOngoingData);
                }

                // Start 60-second automatic background sync without page refresh!
                this.startRealtimeAutoSync();
            } catch (err) {
                console.error("Error fetching initial catalog data:", err);
            }
        }

        startRealtimeAutoSync() {
            // Polling Otakudesu setiap 60 detik secara otomatis tanpa refresh halaman
            setInterval(async () => {
                try {
                    const resp = await fetch('/api/otakudesu_ongoing');
                    const json = await resp.json();
                    if (json.status === 'success' && json.data) {
                        const activeDayChip = document.querySelector('.day-chip.active');
                        const activeDay = activeDayChip ? activeDayChip.dataset.day : 'all';
                        
                        const hasNewData = JSON.stringify(json.data.map(i => i.id)) !== JSON.stringify(this.otakuOngoingData ? this.otakuOngoingData.map(i => i.id) : []);
                        
                        this.otakuOngoingData = json.data;
                        
                        if (activeDay === 'all' || !activeDay) {
                            this.renderOtakuOngoingGrid(this.otakuOngoingData);
                        } else {
                            this.filterByDay(activeDay);
                        }

                        if (hasNewData) {
                            this.showToastNotification("📺 Update Realtime: Episode Anime Baru Telah Rilis!");
                        }
                    }
                } catch (err) {
                    console.error("Background Realtime AutoSync error:", err);
                }
            }, 60000);
        }

        showToastNotification(message) {
            let toast = document.getElementById('realtime-toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'realtime-toast';
                toast.style.position = 'fixed';
                toast.style.bottom = '20px';
                toast.style.right = '20px';
                toast.style.backgroundColor = '#6366f1';
                toast.style.color = '#fff';
                toast.style.padding = '12px 20px';
                toast.style.borderRadius = '10px';
                toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
                toast.style.zIndex = '9999';
                toast.style.fontWeight = 'bold';
                toast.style.fontSize = '14px';
                toast.style.transition = 'all 0.3s ease';
                document.body.appendChild(toast);
            }
            toast.textContent = message;
            toast.style.opacity = '1';
            setTimeout(() => {
                toast.style.opacity = '0';
            }, 5000);
        }

        renderOtakuOngoingGrid(items) {
            if (!this.otakuOngoingGrid) return;
            this.otakuOngoingGrid.innerHTML = '';
            if (!items || items.length === 0) {
                this.otakuOngoingGrid.innerHTML = `<div class="empty-state"><p>Tidak ada anime rilis untuk hari ini.</p></div>`;
                return;
            }

            items.forEach(item => {
                const card = document.createElement('div');
                card.className = 'anime-card';
                card.innerHTML = `
                    <div class="anime-card-badge"><i class="fa-solid fa-play"></i> ${item.latest_episode}</div>
                    <div class="badge-day">★ ${item.release_day}</div>
                    <img class="anime-card-poster" src="${item.image_url}" alt="${item.title}" loading="lazy">
                    <span class="anime-card-ep">${item.release_date || 'ONGOING'}</span>
                    <div class="anime-card-info">
                        <h3 class="anime-card-title">${item.title}</h3>
                        <span class="anime-card-sub"><i class="fa-solid fa-clock text-warning"></i> Rilis ${item.release_day}</span>
                    </div>
                `;

                card.onclick = () => {
                    const customAnimeData = {
                        id: item.id,
                        title: item.title,
                        otaku_url: item.otaku_url,
                        image_url: item.image_url,
                        episodes: Array.from({length: item.episode_number}, (_, i) => ({
                            episode_number: i + 1,
                            title: `Episode ${i + 1}`,
                            slug: `${item.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-episode-${i + 1}`
                        }))
                    };
                    this.player.open(customAnimeData, item.episode_number - 1);
                };
                this.otakuOngoingGrid.appendChild(card);
            });
        }

        filterByDay(day) {
            if (!this.otakuOngoingData) return;
            if (day === 'all') {
                this.renderOtakuOngoingGrid(this.otakuOngoingData);
            } else {
                const filtered = this.otakuOngoingData.filter(item => 
                    item.release_day && item.release_day.toLowerCase().includes(day.toLowerCase())
                );
                this.renderOtakuOngoingGrid(filtered);
            }
        }

        renderHeroCarousel(items) {
            if (!items || items.length === 0) return;
            const topItem = items[0];
            
            this.heroCarousel.innerHTML = `
                <div class="hero-slide" style="background-image: url('${topItem.banner_url || topItem.image_url}')">
                    <div class="hero-overlay"></div>
                    <div class="hero-info">
                        <span class="hero-tag">TRENDING HARI INI</span>
                        <h2 class="hero-title">${topItem.title}</h2>
                        <div class="hero-meta">
                            <span><i class="fa-solid fa-star text-warning"></i> ${topItem.score || '8.8'}</span>
                            <span>${topItem.episodes ? topItem.episodes + ' Episode' : 'Ongoing'}</span>
                            <span>${topItem.genres.slice(0,2).join(', ')}</span>
                        </div>
                    </div>
                </div>
            `;

            this.heroCarousel.querySelector('.hero-slide').onclick = () => {
                this.openDetail(topItem.id);
            };
        }

        renderGrid(container, items) {
            container.innerHTML = '';
            if (!items || items.length === 0) {
                container.innerHTML = `<div class="empty-state"><p>Tidak ada anime ditemukan.</p></div>`;
                return;
            }

            items.forEach(item => {
                const card = document.createElement('div');
                card.className = 'anime-card';
                card.innerHTML = `
                    <div class="anime-card-badge"><i class="fa-solid fa-star"></i> ${item.score || '8.0'}</div>
                    <img class="anime-card-poster" src="${item.image_url}" alt="${item.title}" loading="lazy">
                    <span class="anime-card-ep">${item.episodes ? item.episodes + ' EP' : 'ONGOING'}</span>
                    <div class="anime-card-info">
                        <h3 class="anime-card-title">${item.title}</h3>
                        <span class="anime-card-sub">${item.genres ? item.genres.slice(0, 2).join(' • ') : ''}</span>
                    </div>
                `;

                card.onclick = () => this.openDetail(item.id, item.otaku_url);
                container.appendChild(card);
            });
        }

        async performSearch(query) {
            document.getElementById('search-query-label').textContent = query;
            this.searchResultsSection.classList.remove('hidden');
            this.searchGrid.innerHTML = `<div class="anime-card-skeleton skeleton"></div><div class="anime-card-skeleton skeleton"></div>`;
            this.searchResultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=16`);
                const json = await res.json();
                if (json.status === 'success') {
                    this.renderGrid(this.searchGrid, json.data);
                }
            } catch (err) {
                console.error("Error performing search:", err);
            }
        }

        async openDetail(animeId, otakuUrl = '') {
            this.detailModal.classList.remove('hidden');
            document.getElementById('detail-title').textContent = 'Memuat detail...';
            document.getElementById('episodes-grid').innerHTML = '<div class="spinner"></div>';

            try {
                const queryParam = otakuUrl ? `?otaku_url=${encodeURIComponent(otakuUrl)}` : '';
                const res = await fetch(`/api/anime/${encodeURIComponent(animeId)}${queryParam}`);
                const json = await res.json();
                
                if (json.status === 'success' && json.data) {
                    const data = json.data;
                    this.currentDetailData = data;

                    document.getElementById('detail-banner').style.backgroundImage = `url('${data.banner_url || data.image_url}')`;
                    document.getElementById('detail-poster').src = data.image_url;
                    document.getElementById('detail-title').textContent = data.title;
                    document.getElementById('detail-japanese').textContent = data.japanese_title || data.romaji_title || '';
                    document.getElementById('detail-score').innerHTML = `<i class="fa-solid fa-star"></i> ${data.score || '8.0'}`;
                    document.getElementById('detail-ep-count').textContent = `${data.episodes_count || '?'} EP`;
                    document.getElementById('detail-status').textContent = data.status || 'RELEASED';
                    document.getElementById('detail-year').textContent = data.year || '2026';
                    document.getElementById('detail-synopsis-text').textContent = data.synopsis || 'Tidak ada deskripsi sinopsis.';

                    // Render Genre Pills
                    const genresDiv = document.getElementById('detail-genres');
                    genresDiv.innerHTML = '';
                    if (data.genres) {
                        data.genres.forEach(g => {
                            const span = document.createElement('span');
                            span.className = 'meta-pill';
                            span.textContent = g;
                            genresDiv.appendChild(span);
                        });
                    }

                    // Render Episodes Grid
                    document.getElementById('episodes-total-count').textContent = data.episodes.length;
                    const epGrid = document.getElementById('episodes-grid');
                    epGrid.innerHTML = '';
                    data.episodes.forEach((ep, idx) => {
                        const btn = document.createElement('button');
                        btn.className = 'ep-btn';
                        btn.textContent = ep.episode_number;
                        btn.onclick = () => {
                            if (!this.currentUser) {
                                this.openAuthModal('Silakan Masuk / Daftar akun terlebih dahulu untuk menonton anime!');
                                return;
                            }
                            this.player.open(data, idx);
                        };
                        epGrid.appendChild(btn);
                    });

                    this.updateWatchlistBtnUI();
                }
            } catch (err) {
                console.error("Error loading anime detail:", err);
            }
        }

        toggleWatchlist(animeData) {
            const idx = this.watchlist.findIndex(item => item.id === animeData.id);
            if (idx > -1) {
                this.watchlist.splice(idx, 1);
            } else {
                this.watchlist.unshift({
                    id: animeData.id,
                    title: animeData.title,
                    otaku_url: animeData.otaku_url || '',
                    image_url: animeData.image_url,
                    score: animeData.score || '8.8',
                    episodes: animeData.episodes_count || 1
                });
            }

            localStorage.setItem('ani_watchlist', JSON.stringify(this.watchlist));
            this.updateWatchlistBtnUI();
            this.renderWatchlist();
            this.showToastNotification(idx > -1 ? "🗑️ Dihapus dari Watchlist Favorit" : "⭐ Berhasil Ditambahkan ke Watchlist Favorit!");
        }

        updateWatchlistBtnUI() {
            if (!this.currentDetailData) return;
            const exists = this.watchlist.some(item => item.id === this.currentDetailData.id);
            if (exists) {
                this.toggleWatchlistBtn.innerHTML = `<i class="fa-solid fa-bookmark text-primary"></i> Di Favorit`;
            } else {
                this.toggleWatchlistBtn.innerHTML = `<i class="fa-regular fa-bookmark"></i> Favorit`;
            }
        }

        addToHistory(animeData, epNumber) {
            const existingIdx = this.history.findIndex(h => h.id === animeData.id);
            if (existingIdx > -1) {
                this.history.splice(existingIdx, 1);
            }
            this.history.unshift({
                id: animeData.id,
                title: animeData.title,
                otaku_url: animeData.otaku_url || '',
                image_url: animeData.image_url,
                last_episode: epNumber,
                timestamp: new Date().toLocaleDateString('id-ID')
            });

            localStorage.setItem('ani_history', JSON.stringify(this.history));
            this.renderHistory();
        }

        renderWatchlist() {
            if (!this.watchlistGrid) return;
            this.watchlistGrid.innerHTML = '';
            if (!this.watchlist || this.watchlist.length === 0) {
                this.watchlistGrid.innerHTML = `
                    <div class="empty-state">
                        <i class="fa-solid fa-heart-crack"></i>
                        <p>Belum ada anime di daftar favorit Watchlist Anda.</p>
                    </div>
                `;
                return;
            }
            this.renderGrid(this.watchlistGrid, this.watchlist);
        }

        renderHistory() {
            if (!this.historyGrid) return;
            this.historyGrid.innerHTML = '';
            if (!this.history || this.history.length === 0) {
                this.historyGrid.innerHTML = `<div class="empty-state"><i class="fa-solid fa-film"></i><p>Belum ada riwayat anime yang Anda tonton.</p></div>`;
                return;
            }

            this.history.forEach(item => {
                const card = document.createElement('div');
                card.className = 'anime-card';
                card.innerHTML = `
                    <div class="anime-card-badge">Terakhir EP ${item.last_episode}</div>
                    <img class="anime-card-poster" src="${item.image_url}" alt="${item.title}">
                    <div class="anime-card-info">
                        <h3 class="anime-card-title">${item.title}</h3>
                        <span class="anime-card-sub">${item.timestamp}</span>
                    </div>
                `;
                card.onclick = () => this.openDetail(item.id, item.otaku_url);
                this.historyGrid.appendChild(card);
            });
        }

        switchTab(tabName) {
            const homeSections = document.querySelectorAll('.hero-section, .genre-section, .ongoing-otaku-section, .anime-section:not(#watchlist-section):not(#history-section):not(#about-section):not(#search-results-section)');
            
            // Hide all tab sections
            if (this.watchlistSection) this.watchlistSection.classList.add('hidden');
            if (this.historySection) this.historySection.classList.add('hidden');
            if (this.searchResultsSection) this.searchResultsSection.classList.add('hidden');
            if (this.aboutSection) this.aboutSection.classList.add('hidden');

            if (tabName === 'watchlist') {
                homeSections.forEach(sec => sec.classList.add('hidden'));
                if (this.watchlistSection) this.watchlistSection.classList.remove('hidden');
                this.renderWatchlist();
                if (this.watchlistSection) this.watchlistSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else if (tabName === 'history') {
                homeSections.forEach(sec => sec.classList.add('hidden'));
                if (this.historySection) this.historySection.classList.remove('hidden');
                this.renderHistory();
                if (this.historySection) this.historySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else if (tabName === 'about') {
                homeSections.forEach(sec => sec.classList.add('hidden'));
                if (this.aboutSection) this.aboutSection.classList.remove('hidden');
                if (this.aboutSection) this.aboutSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else if (tabName === 'home' || tabName === 'beranda') {
                homeSections.forEach(sec => sec.classList.remove('hidden'));
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else if (tabName === 'explore') {
                homeSections.forEach(sec => sec.classList.remove('hidden'));
                if (this.searchBarContainer) this.searchBarContainer.classList.remove('hidden');
                if (this.searchInput) this.searchInput.focus();
            }
        }

        async filterByGenre(genreName) {
            if (!genreName || genreName.toLowerCase() === 'semua' || genreName.toLowerCase() === 'all') {
                if (this.otakuOngoingData) {
                    this.renderOtakuOngoingGrid(this.otakuOngoingData);
                }
                if (this.seasonalData) {
                    this.renderGrid(this.seasonalGrid, this.seasonalData);
                }
                return;
            }

            try {
                const res = await fetch(`/api/genre/${encodeURIComponent(genreName)}`);
                const json = await res.json();
                if (json.status === 'success' && json.data && json.data.length > 0) {
                    if (this.otakuOngoingGrid) {
                        this.renderGrid(this.otakuOngoingGrid, json.data);
                    }
                    if (this.seasonalGrid) {
                        this.renderGrid(this.seasonalGrid, json.data);
                    }
                } else {
                    const emptyHtml = `<div class="empty-state"><p>Tidak ada anime ditemukan untuk genre ${genreName}.</p></div>`;
                    if (this.otakuOngoingGrid) this.otakuOngoingGrid.innerHTML = emptyHtml;
                    if (this.seasonalGrid) this.seasonalGrid.innerHTML = emptyHtml;
                }
            } catch (err) {
                console.error(`Error filtering by genre ${genreName}:`, err);
                const errHtml = `<div class="empty-state"><p>Gagal mengambil data genre.</p></div>`;
                if (this.otakuOngoingGrid) this.otakuOngoingGrid.innerHTML = errHtml;
                if (this.seasonalGrid) this.seasonalGrid.innerHTML = errHtml;
            }
        }

        async checkUserAuth() {
            const token = localStorage.getItem('anistream_token');
            if (!token) {
                this.currentUser = null;
                if (this.authUserLabel) this.authUserLabel.textContent = 'Masuk';
                return;
            }

            try {
                const res = await fetch(`/api/auth/me?token=${encodeURIComponent(token)}`);
                const json = await res.json();
                if (json.status === 'success' && json.user) {
                    this.currentUser = json.user;
                    if (this.authUserLabel) this.authUserLabel.textContent = json.user.username;
                } else {
                    localStorage.removeItem('anistream_token');
                    this.currentUser = null;
                    if (this.authUserLabel) this.authUserLabel.textContent = 'Masuk';
                }
            } catch (err) {
                console.log('Auth check error:', err);
            }
        }

        openAuthModal(msg = "") {
            if (this.authModal) {
                this.authModal.classList.remove('hidden');
                if (msg && this.authAlert) {
                    this.authAlert.className = 'auth-alert error';
                    this.authAlert.textContent = msg;
                    this.authAlert.classList.remove('hidden');
                }
            }
        }

        closeAuthModal() {
            if (this.authModal) {
                this.authModal.classList.add('hidden');
                if (this.authAlert) this.authAlert.classList.add('hidden');
            }
        }

        openProfileModal() {
            if (!this.currentUser || !this.profileModal) return;
            if (this.profileUsernameDisplay) this.profileUsernameDisplay.textContent = this.currentUser.username;
            if (this.profileEmailDisplay) this.profileEmailDisplay.textContent = this.currentUser.email || 'Akun Terverifikasi';
            if (this.profileAlert) this.profileAlert.classList.add('hidden');
            const oldPwd = document.getElementById('change-old-password');
            const newPwd = document.getElementById('change-new-password');
            if (oldPwd) oldPwd.value = '';
            if (newPwd) newPwd.value = '';
            this.profileModal.classList.remove('hidden');
        }

        closeProfileModal() {
            if (this.profileModal) {
                this.profileModal.classList.add('hidden');
                if (this.profileAlert) this.profileAlert.classList.add('hidden');
            }
        }
    }

    window.AniApp = new AniApp();
});
