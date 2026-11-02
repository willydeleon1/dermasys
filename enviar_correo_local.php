<?php
header('Content-Type: application/json; charset=utf-8');

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!$data) {
    echo json_encode(['ok' => false, 'error' => 'Datos JSON inválidos']);
    exit;
}

$destinatario = trim($data['destinatario'] ?? '');
$asunto       = trim($data['asunto'] ?? 'Informe Dermo-Estético | DermaSys - Dra. Doris Romero');
$html         = $data['html'] ?? '';
$smtpEmail    = trim($data['smtpEmail'] ?? '') ?: 'dermasys.draromero@gmail.com';
$smtpPass     = preg_replace('/\s+/', '', $data['smtpPass'] ?? '') ?: 'paqoheuvfvsxpsjs';

if (empty($smtpEmail) || empty($smtpPass)) {
    echo json_encode([
        'ok' => false,
        'error' => 'Configure primero el Correo Gmail y la Contraseña de Aplicación (16 letras) en el botón Nube / Correo.'
    ]);
    exit;
}

if (empty($destinatario)) {
    echo json_encode(['ok' => false, 'error' => 'El destinatario de correo está vacío.']);
    exit;
}

$phpmailer_dir = dirname(__DIR__) . '/PLAMDI2.0/PHPMailer/src';
if (!file_exists($phpmailer_dir . '/PHPMailer.php')) {
    echo json_encode(['ok' => false, 'error' => 'PHPMailer local no encontrado. En Vercel usará automáticamente /api/enviar-correo.']);
    exit;
}

require_once $phpmailer_dir . '/Exception.php';
require_once $phpmailer_dir . '/PHPMailer.php';
require_once $phpmailer_dir . '/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

try {
    $mail = new PHPMailer(true);
    $mail->isSMTP();
    $mail->Host       = 'smtp.gmail.com';
    $mail->SMTPAuth   = true;
    $mail->Username   = $smtpEmail;
    $mail->Password   = $smtpPass;
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $mail->Port       = 465;
    $mail->CharSet    = 'UTF-8';

    $mail->setFrom($smtpEmail, 'DermaSys | Dra. Doris Romero');
    $mail->addAddress($destinatario);
    $mail->isHTML(true);
    $mail->Subject = $asunto;
    $mail->Body    = $html;

    $mail->send();
    echo json_encode(['ok' => true, 'message' => 'Correo enviado exitosamente a ' . $destinatario]);
} catch (Exception $e) {
    echo json_encode(['ok' => false, 'error' => 'Error SMTP: ' . $mail->ErrorInfo]);
}
