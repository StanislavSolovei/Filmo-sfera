class FilmOSfera {
    static API_BASE = '/Filmo-sfera/backend/api.php';

    static async request(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.API_BASE}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Request error:', error);
            throw error;
        }
    }

    static async login(login, password) {
        return this.request('/api/login', {
            method: 'POST',
            body: JSON.stringify({ login, password })
        });
    }

    static async register(login, email, password) {
        return this.request('/api/register', {
            method: 'POST',
            body: JSON.stringify({ login, email, password })
        });
    }

    static async getMovies() {
        return this.request('/api/movies');
    }

    static async addMovie(movieData) {
        return this.request('/api/movie', {
            method: 'POST',
            body: JSON.stringify(movieData)
        });
    }

    static async uploadImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64Image = e.target.result.split(',')[1];
                try {
                    const response = await this.request('/api/upload', {
                        method: 'PUT',
                        body: JSON.stringify({
                            image: base64Image,
                            name: file.name
                        })
                    });
                    resolve(response);
                } catch (error) {
                    reject(error);
                }
            };
            reader.readAsDataURL(file);
        });
    }

    static async getUserProfile() {
        return this.request('/api/user');
    }

    static isLoggedIn() {
        return localStorage.getItem('authToken') !== null;
    }

    static logout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        window.location.href = '../index.html';
    }

    static getCurrentUser() {
        const userData = localStorage.getItem('userData');
        return userData ? JSON.parse(userData) : null;
    }
}

// Inicjalizacja strony
document.addEventListener('DOMContentLoaded', function() {
    // Sprawdzenie autoryzacji
    const protectedPages = ['Dodawanie-nowego-filmu.html', 'profil-uzytkownika.html'];
    const currentPage = window.location.pathname.split('/').pop();
    
    if (protectedPages.includes(currentPage) && !FilmOSfera.isLoggedIn()) {
        window.location.href = 'panel-logowania.html';
        return;
    }

    // Ładowanie danych strony
    loadPageData();
});

async function loadPageData() {
    const currentPage = window.location.pathname.split('/').pop();
    
    switch (currentPage) {
        case 'filmy.html':
            await loadMovies();
            break;
        case 'profil-uzytkownika.html':
            await loadUserProfile();
            break;
        case 'film.html':
            loadMovieDetails();
            break;
    }
}

async function loadMovies() {
    try {
        const response = await FilmOSfera.getMovies();
        if (response.success) {
            displayMovies(response.movies);
        }
    } catch (error) {
        console.error('Błąd ładowania filmów:', error);
        showError('movies-container', 'Nie udało się załadować filmów');
    }
}

function displayMovies(movies) {
    const container = document.getElementById('movies-container');
    if (!container) return;

    container.innerHTML = movies.map(movie => `
        <div class="movie-card">
            <img src="../Resources/Images/${movie.image_path || 'placeholder.jpg'}" alt="${movie.title}">
            <div class="movie-info">
                <h3>${movie.title}</h3>
                <p><strong>Reżyser:</strong> ${movie.director}</p>
                <p><strong>Rok:</strong> ${movie.release_year}</p>
                <p>${movie.description?.substring(0, 100)}...</p>
                <a href="film.html?id=${movie.id}" class="btn">Zobacz więcej</a>
            </div>
        </div>
    `).join('');
}

async function loadUserProfile() {
    try {
        const response = await FilmOSfera.getUserProfile();
        if (response.success) {
            displayUserProfile(response.user);
        }
    } catch (error) {
        console.error('Błąd ładowania profilu:', error);
        showError('profile-container', 'Nie udało się załadować profilu');
    }
}

function displayUserProfile(user) {
    const container = document.getElementById('profile-container');
    if (!container) return;

    container.innerHTML = `
        <div class="profile-sidebar">
            <h2>Profil użytkownika</h2>
            <p><strong>Login:</strong> ${user.login}</p>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Data rejestracji:</strong> ${new Date(user.created_at).toLocaleDateString()}</p>
        </div>
        <div class="profile-content">
            <h2>Twoja aktywność</h2>
            <p>Tu będą Twoje recenzje i ulubione filmy.</p>
        </div>
    `;
}

function loadMovieDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const movieId = urlParams.get('id');
    
    if (movieId) {
        // Tutaj można dodać pobieranie szczegółów filmu
        const container = document.getElementById('movie-details');
        if (container) {
            container.innerHTML = `<h2>Szczegóły filmu ID: ${movieId}</h2>`;
        }
    }
}

function showError(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<div class="error">${message}</div>`;
    }
}

function showSuccess(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<div class="success">${message}</div>`;
    }
}

// Obsługa formularzy
function setupFormHandlers() {
    // Logowanie
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Rejestracja
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }

    // Dodawanie filmu
    const addMovieForm = document.getElementById('add-movie-form');
    if (addMovieForm) {
        addMovieForm.addEventListener('submit', handleAddMovie);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const login = formData.get('login');
    const password = formData.get('password');

    try {
        const response = await FilmOSfera.login(login, password);
        if (response.success) {
            localStorage.setItem('authToken', response.token);
            localStorage.setItem('userData', JSON.stringify(response.user));
            window.location.href = 'filmy.html';
        } else {
            showError('login-error', response.message);
        }
    } catch (error) {
        showError('login-error', 'Błąd podczas logowania');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const login = formData.get('login');
    const email = formData.get('email');
    const password = formData.get('password');
    const confirmPassword = formData.get('confirm-password');

    if (password !== confirmPassword) {
        showError('register-error', 'Hasła nie są identyczne');
        return;
    }

    try {
        const response = await FilmOSfera.register(login, email, password);
        if (response.success) {
            showSuccess('register-success', 'Rejestracja udana! Możesz się teraz zalogować.');
            e.target.reset();
        } else {
            showError('register-error', response.message);
        }
    } catch (error) {
        showError('register-error', 'Błąd podczas rejestracji');
    }
}

async function handleAddMovie(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const imageFile = formData.get('image');

    try {
        let imagePath = '';
        if (imageFile && imageFile.size > 0) {
            const uploadResponse = await FilmOSfera.uploadImage(imageFile);
            if (uploadResponse.success) {
                imagePath = uploadResponse.filePath;
            }
        }

        const movieData = {
            title: formData.get('title'),
            description: formData.get('description'),
            release_year: parseInt(formData.get('release_year')),
            director: formData.get('director'),
            image_path: imagePath
        };

        const response = await FilmOSfera.addMovie(movieData);
        if (response.success) {
            showSuccess('add-movie-success', 'Film dodany pomyślnie!');
            e.target.reset();
        } else {
            showError('add-movie-error', response.message);
        }
    } catch (error) {
        showError('add-movie-error', 'Błąd podczas dodawania filmu');
    }
}

// Inicjalizacja handlerów formularzy
document.addEventListener('DOMContentLoaded', setupFormHandlers);