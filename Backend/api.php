<?php
// Włącz wyświetlanie błędów dla diagnostyki
error_reporting(E_ALL);
ini_set('display_errors', 1);

// CORS headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: http://localhost');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

session_start();

$host = 'localhost';
$db   = 'filmosfera';
$user = 'root';
$pass = '';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Błąd połączenia z bazą danych: ' . $e->getMessage()]);
    exit;
}

$scriptName = $_SERVER['SCRIPT_NAME'];
$requestUri = $_SERVER['REQUEST_URI'];
$path = substr($requestUri, strlen($scriptName));

function generateToken($login) {
    return base64_encode($login . '|' . bin2hex(random_bytes(16)));
}

function verifyToken() {
    // Sprawdź kilka możliwych miejsc gdzie może być token
    $token = null;
    
    // 1. Sprawdź nagłówek Authorization
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
        if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            $token = $matches[1];
        }
    }
    
    // 2. Sprawdź w sesji
    if (!$token && isset($_SESSION['token'])) {
        $token = $_SESSION['token'];
    }
    
    if (!$token) {
        error_log("Brak tokena autoryzacji");
        return false;
    }
    
    // Sprawdź czy token w sesji matches
    if (isset($_SESSION['token']) && $_SESSION['token'] === $token) {
        return true;
    }
    
    return false;
}

function getCurrentUserId($pdo) {
    if (!isset($_SESSION['token'])) {
        return null;
    }
    
    $token = $_SESSION['token'];
    $decoded = base64_decode($token);
    $parts = explode('|', $decoded);
    $login = $parts[0];
    
    $stmt = $pdo->prepare('SELECT id FROM users WHERE login = ?');
    $stmt->execute([$login]);
    $user = $stmt->fetch();
    
    return $user ? $user['id'] : null;
}

switch ($path) {
    case '/api/login':
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (!isset($input['login']) || !isset($input['password'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Login i hasło są wymagane']);
                break;
            }
            
            $login = $input['login'];
            $password = $input['password'];

            $stmt = $pdo->prepare('SELECT * FROM users WHERE login = :login LIMIT 1');
            $stmt->execute(['login' => $login]);
            $user = $stmt->fetch();

            if ($user && password_verify($password, $user['password'])) {
                $token = generateToken($login);
                $_SESSION['token'] = $token;
                $_SESSION['user_id'] = $user['id'];
                $_SESSION['login'] = $user['login'];

                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'token' => $token,
                    'user' => ['id' => $user['id'], 'login' => $user['login']]
                ]);
            } else {
                http_response_code(401);
                echo json_encode([
                    'success' => false,
                    'message' => 'Nieprawidłowy login lub hasło'
                ]);
            }
        }
        break;

    case '/api/register':
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (!isset($input['login']) || !isset($input['email']) || !isset($input['password'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Wszystkie pola są wymagane']);
                break;
            }
            
            $login = trim($input['login']);
            $email = trim($input['email']);
            $password = $input['password'];
            
            if (strlen($login) < 3) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Login musi mieć co najmniej 3 znaki']);
                break;
            }
            
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Nieprawidłowy format email']);
                break;
            }
            
            if (strlen($password) < 6) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Hasło musi mieć co najmniej 6 znaków']);
                break;
            }
            
            $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
            
            try {
                // Sprawdź czy użytkownik już istnieje
                $checkStmt = $pdo->prepare('SELECT id FROM users WHERE login = ? OR email = ?');
                $checkStmt->execute([$login, $email]);
                $existingUser = $checkStmt->fetch();
                
                if ($existingUser) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'Login lub email już istnieje']);
                    break;
                }
                
                $stmt = $pdo->prepare('INSERT INTO users (login, email, password) VALUES (?, ?, ?)');
                $stmt->execute([$login, $email, $hashedPassword]);
                
                http_response_code(201);
                echo json_encode(['success' => true, 'message' => 'Rejestracja udana! Możesz się zalogować.']);
            } catch (PDOException $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Błąd bazy danych: ' . $e->getMessage()]);
            }
        }
        break;

    case '/api/movies':
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $stmt = $pdo->query('SELECT m.*, u.login as author FROM movies m LEFT JOIN users u ON m.user_id = u.id ORDER BY m.created_at DESC');
            $movies = $stmt->fetchAll();
            
            echo json_encode(['success' => true, 'movies' => $movies]);
        }
        break;

    case '/api/movies/add':
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            // TYMCZASOWO WYŁĄCZ AUTORYZACJĘ DLA TESTÓW
            // if (!verifyToken()) {
            //     http_response_code(401);
            //     echo json_encode(['success' => false, 'message' => 'Brak autoryzacji. Zaloguj się ponownie.']);
            //     break;
            // }

            $input = json_decode(file_get_contents('php://input'), true);
            
            if (!isset($input['title']) || !isset($input['description']) || !isset($input['director']) || !isset($input['release_year']) || !isset($input['genre'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Wszystkie pola są wymagane']);
                break;
            }

            // Tymczasowo użyj user_id = 1 (admin)
            $userId = 1;
            // $userId = getCurrentUserId($pdo);
            
            // if (!$userId) {
            //     http_response_code(401);
            //     echo json_encode(['success' => false, 'message' => 'Nieprawidłowy użytkownik']);
            //     break;
            // }

            try {
                $stmt = $pdo->prepare('INSERT INTO movies (title, description, director, release_year, genre, user_id) VALUES (?, ?, ?, ?, ?, ?)');
                $stmt->execute([
                    $input['title'],
                    $input['description'],
                    $input['director'],
                    $input['release_year'],
                    $input['genre'],
                    $userId
                ]);

                $movieId = $pdo->lastInsertId();
                echo json_encode(['success' => true, 'message' => 'Film dodany pomyślnie!', 'movie_id' => $movieId]);
            } catch (PDOException $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Błąd bazy danych: ' . $e->getMessage()]);
            }
        }
        break;

    case '/api/user/movies':
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            // Tymczasowo wyłącz autoryzację
            // if (!verifyToken()) {
            //     http_response_code(401);
            //     echo json_encode(['success' => false, 'message' => 'Brak autoryzacji']);
            //     break;
            // }

            // Tymczasowo użyj user_id = 1
            $userId = 1;
            // $userId = getCurrentUserId($pdo);

            $stmt = $pdo->prepare('SELECT * FROM movies WHERE user_id = ? ORDER BY created_at DESC');
            $stmt->execute([$userId]);
            $movies = $stmt->fetchAll();

            echo json_encode(['success' => true, 'movies' => $movies]);
        }
        break;

    case '/api/logout':
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            session_destroy();
            $_SESSION = array();
            echo json_encode(['success' => true, 'message' => 'Wylogowano pomyślnie']);
        }
        break;

    case '/api/check-auth':
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if (verifyToken()) {
                $userId = getCurrentUserId($pdo);
                echo json_encode(['success' => true, 'authenticated' => true, 'user_id' => $userId]);
            } else {
                echo json_encode(['success' => true, 'authenticated' => false]);
            }
        }
        break;

    default:
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Endpoint nie istnieje: ' . $path]);
        break;
}

exit;
