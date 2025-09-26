class FilmOSfera {
    constructor() {
        this.apiBase = 'http://localhost/filmosfera/Backend/api.php';
        this.token = localStorage.getItem('token');
        this.currentUser = JSON.parse(localStorage.getItem('currentUser'));
        this.allMovies = [];
        this.init();
    }

    init() {
        console.log('Inicjalizacja FilmOSfera...');
        console.log('Token:', this.token ? this.token.substring(0, 20) + '...' : 'brak');
        console.log('Użytkownik:', this.currentUser);
        
        this.checkAuth();
        this.setupEventListeners();
        this.loadPageContent();
        this.testConnection();
    }

    setupEventListeners() {
        // Nawigacja
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-page]')) {
                e.preventDefault();
                this.navigateTo(e.target.getAttribute('data-page'));
            }
            
            if (e.target.matches('#logoutBtn')) {
                e.preventDefault();
                this.logout();
            }
        });

        // Formularze
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }

        const addMovieForm = document.getElementById('addMovieForm');
        if (addMovieForm) {
            addMovieForm.addEventListener('submit', (e) => this.handleAddMovie(e));
        }

        // Filtry
        const searchFilter = document.getElementById('searchFilter');
        if (searchFilter) {
            searchFilter.addEventListener('input', (e) => this.filterMovies());
        }

        const genreFilter = document.getElementById('genreFilter');
        if (genreFilter) {
            genreFilter.addEventListener('change', (e) => this.filterMovies());
        }
    }

    loadPageContent() {
        const path = window.location.pathname.split('/').pop();
        console.log('Ładowanie strony:', path);
        
        switch(path) {
            case 'filmy.html':
                this.loadMovies();
                break;
            case 'profil-uzytkownika.html':
                this.loadUserProfile();
                break;
            case 'film.html':
                this.loadMovieDetails();
                break;
            case 'index.html':
            case '':
                this.loadFeaturedMovies();
                break;
        }
    }

    async testConnection() {
        console.log('Testowanie połączenia z API...');
        try {
            const response = await fetch(`${this.apiBase}/api/movies`);
            const result = await response.json();
            console.log('Test połączenia:', result.success ? 'SUKCES' : 'BŁĄD', result);
        } catch (error) {
            console.error('Błąd testu połączenia:', error);
        }
    }

    async makeRequest(endpoint, options = {}) {
        const config = {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        if (this.token) {
            config.headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            console.log(`🔄 Wysyłanie ${config.method} żądania do: ${endpoint}`);
            if (config.body) {
                console.log('Dane żądania:', JSON.parse(config.body));
            }

            const response = await fetch(`${this.apiBase}${endpoint}`, config);
            const data = await response.json();
            
            console.log(`✅ Odpowiedź ${response.status} z: ${endpoint}`, data);
            
            if (response.status === 401) {
                console.error('❌ Błąd autoryzacji 401');
                this.handleAuthError();
            }
            
            return data;
            
        } catch (error) {
            console.error('❌ Błąd żądania:', error);
            return { success: false, message: 'Błąd połączenia z serwerem' };
        }
    }

    handleAuthError() {
        this.showAlert('Sesja wygasła. Zaloguj się ponownie.', 'error');
        this.logout();
        setTimeout(() => this.navigateTo('panel-logowania.html'), 2000);
    }

    async handleLogin(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            login: formData.get('login'),
            password: formData.get('password')
        };

        console.log('Próba logowania:', data.login);

        const result = await this.makeRequest('/api/login', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        if (result.success) {
            this.token = result.token;
            this.currentUser = result.user;
            localStorage.setItem('token', this.token);
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            
            console.log('✅ Logowanie udane! Token:', this.token.substring(0, 20) + '...');
            this.showAlert('Logowanie udane!', 'success');
            
            setTimeout(() => this.navigateTo('../index.html'), 1000);
        } else {
            console.error('❌ Błąd logowania:', result.message);
            this.showAlert(result.message, 'error');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            login: formData.get('login').trim(),
            email: formData.get('email').trim(),
            password: formData.get('password')
        };

        console.log('Próba rejestracji:', data.login);

        // Walidacja po stronie klienta
        if (data.login.length < 3) {
            this.showAlert('Login musi mieć co najmniej 3 znaki', 'error');
            return;
        }

        if (data.password.length < 6) {
            this.showAlert('Hasło musi mieć co najmniej 6 znaków', 'error');
            return;
        }

        if (!this.validateEmail(data.email)) {
            this.showAlert('Nieprawidłowy format email', 'error');
            return;
        }

        const result = await this.makeRequest('/api/register', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        if (result.success) {
            console.log('✅ Rejestracja udana!');
            this.showAlert('Rejestracja udana! Możesz się zalogować.', 'success');
            e.target.reset();
            setTimeout(() => this.navigateTo('panel-logowania.html'), 2000);
        } else {
            console.error('❌ Błąd rejestracji:', result.message);
            this.showAlert(result.message, 'error');
        }
    }

    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    async handleAddMovie(e) {
        e.preventDefault();
        
        console.log('🔄 Próba dodania filmu...');
        console.log('Status zalogowania:', this.token ? 'ZALOGOWANY' : 'NIEZALOGOWANY');

        const formData = new FormData(e.target);
        const data = {
            title: formData.get('title'),
            description: formData.get('description'),
            director: formData.get('director'),
            release_year: parseInt(formData.get('release_year')),
            genre: formData.get('genre')
        };

        console.log('Dane filmu:', data);

        const result = await this.makeRequest('/api/movies/add', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        if (result.success) {
            console.log('✅ Film dodany pomyślnie! ID:', result.movie_id);
            this.showAlert('Film dodany pomyślnie!', 'success');
            e.target.reset();
            setTimeout(() => this.navigateTo('filmy.html'), 1500);
        } else {
            console.error('❌ Błąd dodawania filmu:', result.message);
            this.showAlert(result.message || 'Błąd podczas dodawania filmu', 'error');
        }
    }

    async loadMovies() {
        console.log('🔄 Ładowanie filmów...');
        const result = await this.makeRequest('/api/movies');
        if (result.success) {
            this.allMovies = result.movies;
            this.displayMovies(this.allMovies, 'moviesContainer');
            console.log(`✅ Załadowano ${result.movies.length} filmów`);
        } else {
            console.error('❌ Błąd ładowania filmów:', result.message);
        }
    }

    async loadFeaturedMovies() {
        const result = await this.makeRequest('/api/movies');
        if (result.success && result.movies.length > 0) {
            const featuredMovies = result.movies.slice(0, 3);
            this.displayMovies(featuredMovies, 'featuredMovies');
        }
    }

    async loadUserProfile() {
        console.log('🔄 Ładowanie profilu użytkownika...');
        
        if (!this.token) {
            console.log('❌ Brak autoryzacji - przekierowanie do logowania');
            this.navigateTo('panel-logowania.html');
            return;
        }

        const result = await this.makeRequest('/api/user/movies');
        if (result.success) {
            this.displayMovies(result.movies, 'userMoviesContainer');
            
            const movieCount = document.getElementById('movieCount');
            if (movieCount) {
                movieCount.textContent = result.movies.length;
            }
            
            console.log(`✅ Załadowano ${result.movies.length} filmów użytkownika`);
        }

        const userLogin = document.getElementById('userLogin');
        const userLoginDisplay = document.getElementById('userLoginDisplay');
        if (userLogin && this.currentUser) {
            userLogin.textContent = this.currentUser.login;
        }
        if (userLoginDisplay && this.currentUser) {
            userLoginDisplay.textContent = this.currentUser.login;
        }
    }

    async loadMovieDetails() {
        const urlParams = new URLSearchParams(window.location.search);
        const movieId = urlParams.get('id');
        
        if (movieId) {
            const result = await this.makeRequest('/api/movies');
            if (result.success) {
                const movie = result.movies.find(m => m.id == movieId);
                if (movie) {
                    this.displayMovieDetails(movie);
                }
            }
        } else {
            const result = await this.makeRequest('/api/movies');
            if (result.success && result.movies.length > 0) {
                this.displayMovieDetails(result.movies[0]);
            }
        }
    }

    displayMovieDetails(movie) {
        const title = document.getElementById('movieTitle');
        const director = document.getElementById('movieDirector');
        const year = document.getElementById('movieYear');
        const genre = document.getElementById('movieGenre');
        const author = document.getElementById('movieAuthor');
        const date = document.getElementById('movieDate');
        const description = document.getElementById('movieDescription');

        if (title) title.textContent = movie.title;
        if (director) director.textContent = movie.director;
        if (year) year.textContent = movie.release_year;
        if (genre) genre.textContent = movie.genre;
        if (author) author.textContent = movie.author || 'Nieznany';
        if (date) date.textContent = new Date(movie.created_at).toLocaleDateString('pl-PL');
        if (description) description.textContent = movie.description;
    }

    displayMovies(movies, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (movies.length === 0) {
            container.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; padding: 2rem;">Brak filmów do wyświetlenia.</p>';
            return;
        }

        container.innerHTML = movies.map(movie => `
            <div class="movie-card" onclick="app.viewMovie(${movie.id})" style="cursor: pointer;">
                <h3 class="movie-title">${this.escapeHtml(movie.title)}</h3>
                <p class="movie-info">Reżyser: ${this.escapeHtml(movie.director)}</p>
                <p class="movie-info">Rok: ${movie.release_year}</p>
                <p class="movie-info">Gatunek: ${this.escapeHtml(movie.genre)}</p>
                <p>${this.escapeHtml(movie.description.substring(0, 100))}...</p>
                <small>Dodane przez: ${this.escapeHtml(movie.author || 'Nieznany')}</small>
            </div>
        `).join('');
    }

    filterMovies() {
        const searchTerm = document.getElementById('searchFilter')?.value.toLowerCase() || '';
        const genreFilter = document.getElementById('genreFilter')?.value || '';

        const filteredMovies = this.allMovies.filter(movie => {
            const matchesSearch = movie.title.toLowerCase().includes(searchTerm) || 
                                movie.director.toLowerCase().includes(searchTerm);
            const matchesGenre = !genreFilter || movie.genre === genreFilter;
            
            return matchesSearch && matchesGenre;
        });

        this.displayMovies(filteredMovies, 'moviesContainer');
    }

    viewMovie(movieId) {
        window.location.href = `film.html?id=${movieId}`;
    }

    checkAuth() {
        const protectedPages = ['dodawanie-nowego-filmu.html', 'profil-uzytkownika.html'];
        const currentPage = window.location.pathname.split('/').pop();
        
        if (protectedPages.includes(currentPage) && !this.token) {
            console.log('❌ Brak autoryzacji - przekierowanie do logowania');
            this.navigateTo('panel-logowania.html');
            return;
        }

        this.updateNavigation();
    }

    updateNavigation() {
        const authLinks = document.getElementById('authLinks');
        const userLinks = document.getElementById('userLinks');
        
        if (this.token) {
            if (authLinks) authLinks.classList.add('hidden');
            if (userLinks) userLinks.classList.remove('hidden');
            console.log('✅ Nawigacja: tryb użytkownika');
        } else {
            if (authLinks) authLinks.classList.remove('hidden');
            if (userLinks) userLinks.classList.add('hidden');
            console.log('✅ Nawigacja: tryb gościa');
        }
    }

    navigateTo(page) {
        if (page.startsWith('http')) {
            window.location.href = page;
        } else {
            window.location.href = `Pages/${page}`;
        }
    }

    showAlert(message, type) {
        // Usuń istniejące alerty
        const existingAlerts = document.querySelectorAll('.alert');
        existingAlerts.forEach(alert => alert.remove());

        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type === 'success' ? 'success' : 'error'}`;
        alertDiv.textContent = message;
        alertDiv.style.position = 'fixed';
        alertDiv.style.top = '20px';
        alertDiv.style.left = '50%';
        alertDiv.style.transform = 'translateX(-50%)';
        alertDiv.style.zIndex = '1000';
        alertDiv.style.padding = '1rem 2rem';
        alertDiv.style.borderRadius = '5px';
        alertDiv.style.fontWeight = 'bold';
        
        document.body.appendChild(alertDiv);
        
        setTimeout(() => alertDiv.remove(), 3000);
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    logout() {
        console.log('🔄 Wylogowywanie...');
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        this.token = null;
        this.currentUser = null;
        
        // Wyczyść sesję po stronie serwera
        fetch(`${this.apiBase}/api/logout`, { method: 'POST' });
        
        this.showAlert('Wylogowano pomyślnie!', 'success');
        setTimeout(() => this.navigateTo('../index.html'), 1000);
    }
}

// Inicjalizacja aplikacji
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Inicjalizacja FilmOSfera...');
    window.app = new FilmOSfera();
});
