<?php
// Relais d'adresse IP fixe pour GuTouch / TouchPay.
// À déposer sur un hébergement à IP fixe (Hostinger, VPS…). Vercel envoie ici ses appels vers GuTouch,
// et GuTouch voit l'IP de CET hébergement. Remplace RELAY_SECRET par une longue phrase secrète aléatoire
// (la même que la variable GT_RELAY_SECRET sur Vercel). Ne mets jamais ce secret dans GitHub.
const RELAY_SECRET = 'CHANGE_MOI_PAR_UNE_LONGUE_PHRASE_SECRETE';
const ALLOWED_HOST = 'apidist.gutouch.net';

header('Content-Type: application/json; charset=utf-8');
if (RELAY_SECRET === 'CHANGE_MOI_PAR_UNE_LONGUE_PHRASE_SECRETE' || !hash_equals(RELAY_SECRET, $_SERVER['HTTP_X_RELAY_SECRET'] ?? '')) {
  http_response_code(403); echo '{"error":"forbidden"}'; exit;
}
$in = json_decode(file_get_contents('php://input'), true) ?: [];
$url = (string)($in['url'] ?? '');
$p = parse_url($url);
if (($p['scheme'] ?? '') !== 'https' || ($p['host'] ?? '') !== ALLOWED_HOST) { http_response_code(400); echo '{"error":"host refused"}'; exit; }
$method = strtoupper((string)($in['method'] ?? 'GET'));
if (!in_array($method, ['GET', 'POST', 'PUT'], true)) { http_response_code(400); echo '{"error":"method refused"}'; exit; }

$headers = [];
foreach ((array)($in['headers'] ?? []) as $k => $v) {
  if (in_array(strtolower($k), ['host', 'content-length', 'connection'], true)) continue;
  $headers[] = $k . ': ' . $v;
}
$wwwAuth = null;
$ch = curl_init($url);
curl_setopt_array($ch, [
  CURLOPT_CUSTOMREQUEST => $method,
  CURLOPT_HTTPHEADER => $headers,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
  CURLOPT_CONNECTTIMEOUT => 10,
  CURLOPT_TIMEOUT => 25,
  CURLOPT_HEADERFUNCTION => function ($c, $line) use (&$wwwAuth) {
    if (stripos($line, 'www-authenticate:') === 0) $wwwAuth = trim(substr($line, 17));
    return strlen($line);
  },
]);
if (isset($in['body']) && $in['body'] !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, (string)$in['body']);
$body = curl_exec($ch);
if ($body === false) { http_response_code(502); echo json_encode(['error' => 'curl: ' . curl_error($ch)]); exit; }
echo json_encode(['status' => curl_getinfo($ch, CURLINFO_RESPONSE_CODE), 'wwwAuthenticate' => $wwwAuth, 'body' => $body]);
