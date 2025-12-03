let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (err) {
  console.warn('[emailService] nodemailer module not found. Email sending is disabled until you install nodemailer.');
}

// Configuration via environment variables
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.mailtrap.io';
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || SMTP_PORT === 465;
const SMTP_USER = process.env.SMTP_USER || process.env.SMTP_USERNAME || '';
const SMTP_PASS = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@rasosehat.local';
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'http://localhost:5173';

let transporter = null;
let realSendMail = null;
if (nodemailer) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });

  // Verify transporter config at startup (best-effort) to reveal SMTP auth/connection issues early
  transporter.verify().then(() => {
    console.log('[emailService] SMTP transporter is ready. Host:', SMTP_HOST, 'port:', SMTP_PORT, 'secure:', SMTP_SECURE);
  }).catch((err) => {
    console.warn('[emailService] SMTP transporter verification failed (check SMTP settings):', err && err.message ? err.message : err);
  });

  realSendMail = async (options) => {
    try {
      const info = await transporter.sendMail(options);
      console.log('[emailService] Sent email:', info && info.messageId ? info.messageId : info);
      return info;
    } catch (err) {
      console.error('[emailService] Error sending email:', err && err.message ? err.message : err);
      throw err;
    }
  };
} else {
  // Fallback stub when nodemailer isn't installed — don't crash the server
  realSendMail = async (options) => {
    console.warn('[emailService] nodemailer not installed — skipping send. Mail options:', {
      to: options && options.to,
      subject: options && options.subject,
    });
    return Promise.resolve({ mocked: true, to: options && options.to, subject: options && options.subject });
  };
}

const sendMail = realSendMail;

// Template engine: prefer Handlebars if available, otherwise simple replacement
let Handlebars = null;
try {
  Handlebars = require('handlebars');
} catch (e) {
  Handlebars = null;
}

function safeRender(templateString, vars = {}) {
  if (Handlebars) {
    try {
      const tpl = Handlebars.compile(templateString);
      return tpl(vars);
    } catch (e) {
      console.warn('[emailService] Handlebars render failed, falling back to simple replace', e && e.message ? e.message : e);
    }
  }

  // Fallback simple replacer for {{var}} patterns
  let out = String(templateString);
  Object.keys(vars).forEach(k => {
    const v = vars[k] === undefined || vars[k] === null ? '' : String(vars[k]);
    out = out.split(`{{${k}}}`).join(v);
    out = out.split(`{{ ${k} }}`).join(v);
  });
  return out;
}

const APPROVED_HTML = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Toko Disetujui</title>
  <style>
    body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; background:#f6faf6; margin:0; padding:0;}
    .container { max-width:640px; margin:28px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 6px 30px rgba(2,6,23,0.08);} 
    .header { background:linear-gradient(90deg,#10b981,#059669); color:#fff; padding:28px; text-align:center; }
    .logo { font-weight:800; font-size:20px; letter-spacing:0.4px; }
    .main { padding:28px; color:#0f172a; }
    .h1 { font-size:20px; margin:0 0 8px; font-weight:700; }
    .lead { color:#334155; margin:0 0 18px; }
    .card { background:#f0fdf4; border-radius:8px; padding:14px; border:1px solid #dcfce7; margin-bottom:18px; color:#065f46; }
    .btn { display:inline-block; background:#10b981; color:#fff; padding:12px 18px; border-radius:8px; text-decoration:none; font-weight:600; box-shadow:0 6px 18px rgba(16,185,129,.12); }
    .muted { color:#64748b; font-size:13px; margin-top:18px; }
    .footer { padding:18px; text-align:center; color:#94a3b8; font-size:13px; background:#fafafa; }
    .note { background:#fffbe6; border:1px solid #fff3cd; padding:10px; border-radius:6px; color:#92400e; margin-top:8px; font-size:13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">RasoSehat</div>
    </div>

    <div class="main">
      <p class="h1">Selamat, toko Anda disetujui 🎉</p>
      <p class="lead">Hai {{owner_name}}, pengajuan toko <strong>{{restaurant_name}}</strong> telah disetujui oleh tim admin.</p>

      <div class="card">
        <strong>Apa selanjutnya</strong>
        <p style="margin:8px 0 0">Untuk menyelesaikan pendaftaran penjual dan mulai mengelola toko, klik tombol berikut.</p>
      </div>

      <p style="text-align:center; margin:18px 0;">
        <a href="{{action_link}}" class="btn" target="_blank" rel="noopener">Lanjutkan pendaftaran penjual</a>
      </p>

      {{#if note}}
      <div class="note">
        <strong>Catatan dari admin:</strong>
        <div style="margin-top:6px">{{note}}</div>
      </div>
      {{/if}}

      <p class="muted">Jika Anda memiliki pertanyaan, balas email ini atau hubungi <a href="mailto:{{support_email}}">{{support_email}}</a>.</p>
    </div>

    <div class="footer">
      RasoSehat • Panduan & dukungan untuk penjual • <a href="{{frontend_origin}}" style="color:inherit; text-decoration:underline;">Kunjungi situs</a>
    </div>
  </div>
</body>
</html>`;

const REJECTED_HTML = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Pengajuan Ditolak</title>
  <style>
    body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial; background:#fff7f7; margin:0; padding:0;}
    .container { max-width:640px; margin:28px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 6px 30px rgba(2,6,23,0.06);} 
    .header { background:linear-gradient(90deg,#ef4444,#dc2626); color:#fff; padding:28px; text-align:center; }
    .logo { font-weight:800; font-size:20px; }
    .main { padding:28px; color:#0f172a; }
    .h1 { font-size:20px; margin:0 0 8px; font-weight:700; }
    .lead { color:#334155; margin:0 0 18px; }
    .card { background:#fff1f2; border-radius:8px; padding:14px; border:1px solid #fee2e2; margin-bottom:18px; color:#9f1239; }
    .btn { display:inline-block; background:#ef4444; color:#fff; padding:12px 18px; border-radius:8px; text-decoration:none; font-weight:600; }
    .muted { color:#64748b; font-size:13px; margin-top:18px; }
    .note { background:#fff7ed; border:1px solid #ffedd5; padding:10px; border-radius:6px; color:#92400e; margin-top:8px; font-size:13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">RasoSehat</div>
    </div>

    <div class="main">
      <p class="h1">Pengajuan Toko Ditolak</p>
      <p class="lead">Hai {{owner_name}}, pengajuan toko <strong>{{restaurant_name}}</strong> belum dapat disetujui.</p>

      <div class="card">
        <strong>Alasan / langkah perbaikan</strong>
        <p style="margin:8px 0 0">Berikut catatan dari admin mengenai kendala pada pengajuan. Silakan periksa dan kirim ulang dokumen yang diminta.</p>
      </div>

      <div class="note">
        <strong>Catatan dari admin:</strong>
        <div style="margin-top:6px">{{note}}</div>
      </div>

      <p style="margin-top:18px">Setelah memperbaiki, Anda dapat mengajukan ulang di halaman berikut:</p>

      <p style="text-align:center; margin:18px 0;">
        <a href="{{action_link}}" class="btn" target="_blank" rel="noopener">Perbaiki & Ajukan Ulang</a>
      </p>

      <p class="muted">Jika perlu bantuan, hubungi <a href="mailto:{{support_email}}">{{support_email}}</a>.</p>
    </div>

    <div class="footer" style="padding:18px; text-align:center; color:#94a3b8; font-size:13px; background:#fffaf0;">
      RasoSehat • Dukungan untuk pendaftar toko • <a href="{{frontend_origin}}" style="color:inherit; text-decoration:underline;">Kunjungi situs</a>
    </div>
  </div>
</body>
</html>`;

const APPROVED_TEXT = `Toko Anda Disetujui — {{restaurant_name}}\n\nHai {{owner_name}},\n\nPengajuan toko "{{restaurant_name}}" telah disetujui oleh admin.\n\nCatatan admin:\n{{note}}\n\nLanjutkan pendaftaran penjual: {{action_link}}\n\nButuh bantuan? Hubungi: {{support_email}}`;

const REJECTED_TEXT = `Pengajuan Toko Ditolak — {{restaurant_name}}\n\nHai {{owner_name}},\n\nPengajuan toko "{{restaurant_name}}" ditolak oleh admin.\n\nCatatan:\n{{note}}\n\nPerbaiki dokumen dan ajukan ulang: {{action_link}}\n\nButuh bantuan? Hubungi: {{support_email}}`;

/**
 * Send verification result email to restaurant owner
 * @param {object} restaurant - restaurant row (should contain at least id and nama_restoran)
 * @param {string} ownerEmail - recipient email
 * @param {string} status - 'disetujui' | 'ditolak' (DB value)
 * @param {string} note - admin note
 */
async function sendStoreVerificationEmail(restaurant, ownerEmail, status, note) {
  if (!ownerEmail) {
    console.warn('[emailService] No owner email provided, skipping email');
    return null;
  }

  const normalizedStatus = String(status || '').toLowerCase();
  const ownerName = (restaurant && (restaurant.owner_name || restaurant.owner || restaurant.ownerName)) || '';
  const restaurantName = (restaurant && (restaurant.nama_restoran || restaurant.name)) || '';
  const actionLink = `${FRONTEND_URL.replace(/\/$/, '')}/register-store?restaurantId=${encodeURIComponent(restaurant.id)}`;
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@rasosehat.local';

  let subject = '';
  let html = '';
  let text = '';

  if (normalizedStatus === 'disetujui' || normalizedStatus === 'approved' || normalizedStatus === 'approve') {
    subject = `Toko Anda Disetujui — ${restaurantName || 'Toko Anda'}`;
    html = safeRender(APPROVED_HTML, { owner_name: ownerName, restaurant_name: restaurantName, note: note || '', action_link: actionLink, support_email: supportEmail, frontend_origin: FRONTEND_URL });
    text = safeRender(APPROVED_TEXT, { owner_name: ownerName, restaurant_name: restaurantName, note: note || '', action_link: actionLink, support_email: supportEmail });
  } else {
    subject = `Pengajuan Toko Ditolak — ${restaurantName || 'Pengajuan Toko'}`;
    html = safeRender(REJECTED_HTML, { owner_name: ownerName, restaurant_name: restaurantName, note: note || '', action_link: actionLink, support_email: supportEmail, frontend_origin: FRONTEND_URL });
    text = safeRender(REJECTED_TEXT, { owner_name: ownerName, restaurant_name: restaurantName, note: note || '', action_link: actionLink, support_email: supportEmail });
  }

  const mailOptions = {
    from: EMAIL_FROM,
    to: ownerEmail,
    subject,
    html,
    text,
  };

  return sendMail(mailOptions);
}

/**
 * Convenience wrapper: send email by recipient address (email first)
 * signature: sendStoreVerificationEmailTo(email, status, note, restaurantId)
 * This makes it easy for callers that only have an email address.
 */
async function sendStoreVerificationEmailTo(email, status, note, restaurantId = null) {
  const restaurant = { id: restaurantId, nama_restoran: '' };
  return sendStoreVerificationEmail(restaurant, email, status, note);
}

module.exports = {
  sendStoreVerificationEmail,
  sendStoreVerificationEmailTo,
};
