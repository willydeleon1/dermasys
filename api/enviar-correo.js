const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Método no permitido' });
    }

    try {
        const {
            destinatario,
            asunto,
            html,
            pdfBase64,
            pdfFilename,
            smtpEmail,
            smtpPass
        } = req.body || {};

        const user = (smtpEmail || process.env.SMTP_EMAIL || 'dermasys.draromero@gmail.com').trim();
        const pass = (smtpPass || process.env.SMTP_PASS || 'paqoheuvfvsxpsjs').replace(/\s+/g, '');

        if (!user || !pass) {
            return res.status(400).json({
                ok: false,
                error: 'Falta configurar el Correo Gmail y la Contraseña de Aplicación (16 letras) en el botón Nube / Correo.'
            });
        }

        if (!destinatario) {
            return res.status(400).json({ ok: false, error: 'El paciente no tiene correo electrónico indicado.' });
        }

        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: { user, pass }
        });

        const mailOptions = {
            from: `"DermaSys | Dra. Doris Romero" <${user}>`,
            to: destinatario,
            subject: asunto || 'Informe Dermo-Estético y Rutina Skincare | Dra. Doris Romero',
            html: html
        };

        if (pdfBase64) {
            const cleanBase64 = String(pdfBase64).includes('base64,')
                ? String(pdfBase64).split('base64,')[1]
                : String(pdfBase64);
            mailOptions.attachments = [
                {
                    filename: pdfFilename || 'Informe_Dra_Doris_Romero.pdf',
                    content: cleanBase64,
                    encoding: 'base64',
                    contentType: 'application/pdf'
                }
            ];
        }

        await transporter.sendMail(mailOptions);

        return res.status(200).json({ ok: true, message: 'Correo con PDF adjunto enviado exitosamente a ' + destinatario });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message || 'Error al enviar correo SMTP' });
    }
};
