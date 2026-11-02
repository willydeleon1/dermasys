const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
    try {
        const sbUrl = 'https://ealsvecltwycvfayonhp.supabase.co';
        const sbKey = 'sb_publishable_XLC6TFPKo8EhgezBICt9cA_BZjJXCg4';
        const smtpUser = process.env.SMTP_EMAIL || 'dermasys.draromero@gmail.com';
        const smtpPass = (process.env.SMTP_PASS || 'paqoheuvfvsxpsjs').replace(/\s+/g, '');

        const hoy = new Date();
        const fHoy = hoy.toISOString().split('T')[0];
        const fLimite = new Date(hoy.getTime() + 2 * 86400000).toISOString().split('T')[0];

        // Consultar citas en los próximos 2 días no canceladas
        const citasRes = await fetch(
            `${sbUrl}/rest/v1/citas?fecha_cita=gte.${fHoy}&fecha_cita=lte.${fLimite}&recordatorio_enviado=is.false&select=*`,
            { headers: { apikey: sbKey } }
        );
        const citas = await citasRes.json();

        if (!Array.isArray(citas) || citas.length === 0) {
            return res.status(200).json({ ok: true, enviados: 0, message: 'No hay citas pendientes de recordatorio en las próximas 48h.' });
        }

        const pacRes = await fetch(`${sbUrl}/rest/v1/pacientes?select=*`, { headers: { apikey: sbKey } });
        const pacientes = await pacRes.json();

        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: { user: smtpUser, pass: smtpPass }
        });

        let enviados = 0;
        for (const c of citas) {
            if (c.estado === 'Cancelada' || c.estado === 'Completada') continue;
            const p = (pacientes || []).find(x => Number(x.id) === Number(c.paciente_id));
            if (!p || !p.correo) continue;

            const partes = String(c.fecha_cita).split('-');
            const fechaFmt = partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : c.fecha_cita;

            await transporter.sendMail({
                from: `"DermaSys | Dra. Doris Romero" <${smtpUser}>`,
                to: p.correo,
                subject: `Recordatorio de Cita (${fechaFmt}) | Dra. Doris Romero - DermaSys`,
                html: `
                    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #ddd6fe;border-radius:12px;overflow:hidden;">
                        <div style="background:#1e1b4b;color:#ffffff;padding:20px 24px;text-align:center;">
                            <h2 style="margin:0;font-family:Georgia,serif;letter-spacing:1px;">DRA. DORIS ROMERO</h2>
                            <div style="color:#c4b5fd;font-size:12px;margin-top:4px;">Medicina Estética y Dermatología &bull; M.P.P.S: 131642 | C.M: 13750</div>
                        </div>
                        <div style="padding:24px;color:#1e293b;">
                            <h3 style="color:#6d28d9;margin-top:0;">Recordatorio Automático de Cita Médica</h3>
                            <p>Estimado(a) <strong>${p.nombre_apellido}</strong>,</p>
                            <p>Le recordamos cordialmente los detalles de su próxima cita programada:</p>
                            <div style="background:#f5f3ff;border-left:4px solid #6d28d9;padding:14px;border-radius:6px;margin:16px 0;">
                                <div><strong>Fecha:</strong> ${fechaFmt}</div>
                                ${c.hora_cita ? `<div><strong>Hora:</strong> ${c.hora_cita}</div>` : ''}
                                <div><strong>Tipo de Consulta:</strong> ${c.tipo || 'Consulta Dermo-Estética'}</div>
                                ${c.notas ? `<div><strong>Indicaciones:</strong> ${c.notas}</div>` : ''}
                            </div>
                            <p style="font-size:12px;color:#64748b;">Mensaje enviado automáticamente por <strong>DermaSys</strong>.</p>
                        </div>
                    </div>
                `
            });

            await fetch(`${sbUrl}/rest/v1/citas?id=eq.${c.id}`, {
                method: 'PATCH',
                headers: { apikey: sbKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ recordatorio_enviado: true })
            });
            enviados++;
        }

        return res.status(200).json({ ok: true, enviados });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
    }
};
