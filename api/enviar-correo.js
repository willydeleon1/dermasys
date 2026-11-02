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

        await transporter.sendMail({
            from: `"DermaSys | Dra. Doris Romero" <${user}>`,
            to: destinatario,
            subject: asunto || 'Informe Dermo-Estético y Rutina Skincare | Dra. Doris Romero',
            html: html
        });

        return res.status(200).json({ ok: true, message: 'Correo enviado exitosamente a ' + destinatario });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message || 'Error al enviar correo SMTP' });
    }
};
