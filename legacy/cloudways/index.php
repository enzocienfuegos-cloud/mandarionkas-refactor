<?php

$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$publicRoot = __DIR__;

// 1) Si piden un archivo real dentro de public_html, servirlo directamente,
//    pero nunca servir archivos PHP como estáticos.
if (is_string($requestPath) && $requestPath !== '/') {
    $candidate = realpath($publicRoot . $requestPath);
    if (
        $candidate !== false &&
        str_starts_with($candidate, $publicRoot) &&
        is_file($candidate) &&
        strtolower(pathinfo($candidate, PATHINFO_EXTENSION)) !== 'php'
    ) {
        $ext = strtolower(pathinfo($candidate, PATHINFO_EXTENSION));
        $mimeMap = [
            'js' => 'application/javascript',
            'css' => 'text/css',
            'html' => 'text/html; charset=UTF-8',
            'json' => 'application/json',
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'gif' => 'image/gif',
            'svg' => 'image/svg+xml',
            'webp' => 'image/webp',
            'woff' => 'font/woff',
            'woff2' => 'font/woff2',
            'ttf' => 'font/ttf',
            'otf' => 'font/otf',
            'map' => 'application/json',
        ];

        if (isset($mimeMap[$ext])) {
            header('Content-Type: ' . $mimeMap[$ext]);
        }

        if (in_array($ext, ['js', 'css', 'woff', 'woff2', 'ttf', 'otf', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'], true)) {
            header('Cache-Control: public, max-age=31536000');
        }

        readfile($candidate);
        exit;
    }
}

// 2) Si no viene __proxy, servir frontend
$proxyPath = $_GET['__proxy'] ?? null;

if ($proxyPath === null) {
    $distIndex = __DIR__ . '/dist/index.html';
    if (file_exists($distIndex)) {
        header('Content-Type: text/html; charset=UTF-8');
        readfile($distIndex);
        exit;
    }

    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode([
        'ok' => false,
        'message' => 'Frontend dist not found',
    ]);
    exit;
}

// 3) Proxy al backend Node
$backendBase = 'http://127.0.0.1:8787';

if (!is_string($proxyPath) || $proxyPath === '') {
    $proxyPath = '/';
}
if ($proxyPath[0] !== '/') {
    $proxyPath = '/' . $proxyPath;
}

$query = $_GET;
unset($query['__proxy']);

$targetUrl = rtrim($backendBase, '/') . $proxyPath;
if (!empty($query)) {
    $targetUrl .= '?' . http_build_query($query);
}

$ch = curl_init($targetUrl);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$body = file_get_contents('php://input');
$forwardedContentType = null;

if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
    $incomingContentType = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0] ?? ''));
    if ($incomingContentType === 'application/x-www-form-urlencoded') {
        parse_str($body, $parsedFormBody);
        if (is_array($parsedFormBody) && isset($parsedFormBody['__smx_body'])) {
            $body = (string) $parsedFormBody['__smx_body'];
            $candidateContentType = $parsedFormBody['__smx_content_type'] ?? 'application/json';
            $forwardedContentType = is_string($candidateContentType) && $candidateContentType !== ''
                ? $candidateContentType
                : 'application/json';
        }
    }
}

$headers = [];
if (function_exists('getallheaders')) {
    foreach (getallheaders() as $name => $value) {
        $lower = strtolower($name);
        if ($lower === 'host' || $lower === 'content-length') {
            continue;
        }
        if ($forwardedContentType !== null && $lower === 'content-type') {
            continue;
        }
        $headers[] = $name . ': ' . $value;
    }
}

$headers[] = 'X-Forwarded-For: ' . ($_SERVER['REMOTE_ADDR'] ?? '');
$headers[] = 'X-Forwarded-Proto: https';
if ($forwardedContentType !== null) {
    $headers[] = 'Content-Type: ' . $forwardedContentType;
}

curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HEADER => true,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_HTTPHEADER => $headers,
]);

if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}

$response = curl_exec($ch);

if ($response === false) {
    http_response_code(502);
    header('Content-Type: application/json');
    echo json_encode([
        'ok' => false,
        'error' => 'Proxy request failed',
        'details' => curl_error($ch),
    ]);
    curl_close($ch);
    exit;
}

$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);

$rawHeaders = substr($response, 0, $headerSize);
$responseBody = substr($response, $headerSize);

curl_close($ch);

http_response_code($status);

$headerLines = explode("\r\n", trim($rawHeaders));
foreach ($headerLines as $line) {
    if ($line === '' || stripos($line, 'HTTP/') === 0) {
        continue;
    }
    if (stripos($line, 'Transfer-Encoding:') === 0) {
        continue;
    }
    if (stripos($line, 'Connection:') === 0) {
        continue;
    }
    header($line, false);
}

echo $responseBody;
