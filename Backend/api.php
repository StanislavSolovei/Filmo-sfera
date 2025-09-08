<?php
header('Content-Type: application/json');
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
    echo json_encode([
        'success' => false,
        'message' => 'Błąd połączenia z bazą danych',
    ]);
    exit;
}

$scriptName = $_SERVER['SCRIPT_NAME'];
$requestUri = $_SERVER['REQUEST_URI'];
$path = substr($requestUri, strlen($scriptName));

switch ($path) {
    case '/api/login':
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true);
            $login = $input['login'];
            $password = $input['password'];

            $stmt = $pdo->prepare('SELECT * FROM users WHERE login = :login LIMIT 1');
            $stmt->execute(['login' => $login]);
            $user = $stmt->fetch();

            if ($user && password_verify($password, $user['password'])) {
                $token = generateToken($login);
                $_SESSION['user_id'] = $user['id'];
                $_SESSION['token'] = $token;
                
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'token' => $token,
                    'user' => [
                        'id' => $user['id'],
                        'login' => $user['login'],
                        'email' => $user['email']
                    ]
                ]);
            } else {
                http_response_code(401);
                echo json_encode([
                    'success' => false,
                    'message' => 'Nieprawidłowy login lub hasło',
                ]);
            }
        }
        break;
    
    case '/api/register':
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true);
            
            $login = $input['login'];
            $email = $input['email'];
            $password = password_hash($input['password'], PASSWORD_DEFAULT);
            
            try {
                $stmt = $pdo->prepare('INSERT INTO users (login, email, password) VALUES (?, ?, ?)');
                $stmt->execute([$login, $email, $password]);
                
                http_response_code(201);
                echo json_encode([
                    'success' => true,
                    'message' => 'Użytkownik zarejestrowany pomyślnie'
                ]);
            } catch (PDOException $e) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Rejestracja nieudana: ' . $e->getMessage()
                ]);
            }
        }
        break;
    
    case '/api/movies':
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $stmt = $pdo->query('SELECT * FROM movies ORDER BY created_at DESC');
            $movies = $stmt->fetchAll();
            
            echo json_encode([
                'success' => true,
                'movies' => $movies
            ]);
        }
        break;
    
    case '/api/movie':
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true);
            
            $title = $input['title'];
            $description = $input['description'];
            $release_year = $input['release_year'];
            $director = $input['director'];
            $image_path = $input['image_path'];
            
            try {
                $stmt = $pdo->prepare('INSERT INTO movies (title, description, release_year, director, image_path) VALUES (?, ?, ?, ?, ?)');
                $stmt->execute([$title, $description, $release_year, $director, $image_path]);
                
                http_response_code(201);
                echo json_encode([
                    'success' => true,
                    'message' => 'Film dodany pomyślnie'
                ]);
            } catch (PDOException $e) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Nie udało się dodać filmu: ' . $e->getMessage()
                ]);
            }
        }
        break;
    
    case '/api/upload':
        if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (isset($data['image']) && isset($data['name'])) {
                $imageData = base64_decode($data['image']);
                $fileName = time() . '_' . $data['name'];
                $filePath = "../Resources/Images/" . $fileName;
                
                if (file_put_contents($filePath, $imageData)) {
                    echo json_encode([
                        'success' => true,
                        'message' => 'Plik przesłany pomyślnie',
                        'filePath' => $fileName
                    ]);
                } else {
                    echo json_encode([
                        'success' => false,
                        'message' => 'Przesyłanie pliku nieudane'
                    ]);
                }
            }
        }
        break;
    
    case '/api/user':
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if (isset($_SESSION['user_id'])) {
                $stmt = $pdo->prepare('SELECT id, login, email, created_at FROM users WHERE id = ?');
                $stmt->execute([$_SESSION['user_id']]);
                $user = $stmt->fetch();
                
                echo json_encode([
                    'success' => true,
                    'user' => $user
                ]);
            } else {
                http_response_code(401);
                echo json_encode([
                    'success' => false,
                    'message' => 'Nieautoryzowany dostęp'
                ]);
            }
        }
        break;

    default:
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Endpoint nie istnieje'
        ]);
        break;
}

function generateToken($login) {
    return base64_encode($login . '|' . bin2hex(random_bytes(16)));
}
?>