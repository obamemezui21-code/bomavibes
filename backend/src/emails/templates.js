const LOGO_URL = "https://bomavibes.tech/bomavibes-logo.jpeg";

function wrapper(title, bodyHtml) {
    return `
    <div style="background:#FAF6EF;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 40px -20px rgba(31,61,43,0.25);">
        <div style="background:linear-gradient(135deg,#0e2a1e,#163d29,#1f3d2b);padding:28px 32px;text-align:center;">
          <img src="${LOGO_URL}" alt="BomaVibes" width="56" height="56" style="border-radius:999px;border:2px solid #C9962B;object-fit:cover;" />
          <p style="color:#F5EFE3;font-size:20px;font-weight:700;margin:12px 0 0;">
            Boma<span style="color:#E8C468;">Vibes</span>
          </p>
        </div>
        <div style="padding:32px;">
          <h1 style="color:#2B1D14;font-size:20px;margin:0 0 12px;">${title}</h1>
          ${bodyHtml}
        </div>
      </div>
      <p style="text-align:center;color:#6b5d4f;font-size:12px;margin-top:16px;">
        BomaVibes — la rencontre gabonaise
      </p>
    </div>`;
}

function button(link, label) {
    return `
    <div style="text-align:center;margin:28px 0 8px;">
      <a href="${link}" style="display:inline-block;background:linear-gradient(90deg,#C9962B,#E8C468);color:#2B1D14;font-weight:600;font-size:14px;padding:12px 28px;border-radius:12px;text-decoration:none;">
        ${label}
      </a>
    </div>
    <p style="color:#6b5d4f;font-size:12px;word-break:break-all;margin-top:16px;">
      Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur :<br />
      <a href="${link}" style="color:#9c7220;">${link}</a>
    </p>`;
}

function passwordResetEmail(link) {
    return {
        subject: "Réinitialise ton mot de passe BomaVibes",
        html: wrapper(
            "Réinitialise ton mot de passe",
            `<p style="color:#6b5d4f;font-size:14px;line-height:1.6;">
              Tu as demandé à réinitialiser ton mot de passe. Clique sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien expire dans 1 heure.
            </p>
            ${button(link, "Réinitialiser mon mot de passe")}
            <p style="color:#6b5d4f;font-size:12px;margin-top:20px;">
              Si tu n'es pas à l'origine de cette demande, ignore simplement cet email.
            </p>`,
        ),
    };
}

function verificationEmail(link, firstName) {
    return {
        subject: "Confirme ton adresse email BomaVibes",
        html: wrapper(
            `Bienvenue${firstName ? `, ${firstName}` : ""} !`,
            `<p style="color:#6b5d4f;font-size:14px;line-height:1.6;">
              Plus qu'une étape avant de rejoindre la communauté : confirme ton adresse email en cliquant sur le bouton ci-dessous.
            </p>
            ${button(link, "Confirmer mon email")}`,
        ),
    };
}

function featureAnnouncementEmail({ title, description, ctaLabel, ctaLink }) {
    return {
        subject: `Nouveau sur BomaVibes : ${title}`,
        html: wrapper(
            title,
            `<p style="color:#6b5d4f;font-size:14px;line-height:1.6;">
              ${description}
            </p>
            ${ctaLink ? button(ctaLink, ctaLabel || 'Découvrir') : ''}`,
        ),
    };
}

module.exports = { passwordResetEmail, verificationEmail, featureAnnouncementEmail };
