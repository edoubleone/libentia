<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// Load .env file
function loadEnv(string $path): void {
    if (!file_exists($path)) return;
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#')) continue;
        [$key, $value] = array_map('trim', explode('=', $line, 2));
        if (!empty($key)) $_ENV[$key] = $value;
    }
}

loadEnv(__DIR__ . '/.env');

$apiKey     = $_ENV['GHL_ACCESS_TOKEN'] ?? '';
$locationId = $_ENV['GHL_LOCATION_ID'] ?? '';
$baseUrl    = $_ENV['GHL_BASE_URL'] ?? 'https://services.leadconnectorhq.com';

if (empty($apiKey) || empty($locationId)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server configuration error']);
    exit;
}

// Sanitize inputs
$fullName = trim(strip_tags($_POST['name'] ?? ''));
$email    = filter_var(trim($_POST['email'] ?? ''), FILTER_SANITIZE_EMAIL);
$phone    = trim(preg_replace('/[^0-9+\-\s()]/', '', $_POST['phone'] ?? ''));
$subject  = trim(strip_tags($_POST['subject'] ?? ''));
$message  = trim(strip_tags($_POST['message'] ?? ''));

// Validate required fields
if (empty($fullName) || empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Name and a valid email are required']);
    exit;
}

// Split full name into first/last
$nameParts = explode(' ', $fullName, 2);
$firstName = $nameParts[0];
$lastName  = $nameParts[1] ?? '';

// Build contact payload
$contactPayload = [
    'locationId' => $locationId,
    'firstName'  => $firstName,
    'lastName'   => $lastName,
    'email'      => $email,
    'source'     => 'Website Contact Form',
];

if (!empty($phone)) {
    $contactPayload['phone'] = $phone;
}

$headers = [
    'Authorization: Bearer ' . $apiKey,
    'Version: 2021-07-28',
    'Content-Type: application/json',
    'Accept: application/json',
];

// Create or upsert contact in GHL
$ch = curl_init($baseUrl . '/contacts/upsert');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($contactPayload),
    CURLOPT_HTTPHEADER     => $headers,
    CURLOPT_TIMEOUT        => 15,
]);

$response   = curl_exec($ch);
$statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError  = curl_error($ch);
curl_close($ch);

if ($curlError) {
    http_response_code(502);
    echo json_encode(['success' => false, 'message' => 'Could not reach GHL API']);
    exit;
}

$ghlResponse = json_decode($response, true);

if ($statusCode < 200 || $statusCode >= 300) {
    http_response_code(502);
    echo json_encode(['success' => false, 'message' => 'GHL API error: ' . ($ghlResponse['message'] ?? 'Unknown error')]);
    exit;
}

$contactId = $ghlResponse['contact']['id'] ?? null;

// Add note if message or subject provided
if ($contactId && (!empty($message) || !empty($subject))) {
    $noteBody = '';
    if (!empty($subject)) $noteBody .= "Subject: {$subject}\n\n";
    if (!empty($message)) $noteBody .= $message;

    $notePayload = [
        'userId' => '',
        'body'   => trim($noteBody),
    ];

    $chNote = curl_init($baseUrl . '/contacts/' . $contactId . '/notes');
    curl_setopt_array($chNote, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($notePayload),
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => 15,
    ]);
    curl_exec($chNote);
    curl_close($chNote);
}

echo json_encode(['success' => true, 'message' => 'Thank you! We will be in touch soon.']);
