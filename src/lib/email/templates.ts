import type { Locale } from "@/i18n/config";

export type EmailTemplate = "verify-email" | "reset-password" | "password-changed" | "account-exists";
export type TemplateData = { name: string; url?: string };

type Copy = { subject: string; heading: string; body: string[]; button?: string; footnote: string };

const copy: Record<EmailTemplate, Record<Locale, (d: TemplateData) => Copy>> = {
  "account-exists": {
    fr: (d) => ({
      subject: "Vous avez déjà un compte Woman Cares",
      heading: `Bonjour ${d.name},`,
      body: ["Quelqu’un vient d’essayer de créer un compte avec votre adresse e-mail, qui est déjà inscrite. Si c’était vous, connectez-vous, ou réinitialisez votre mot de passe si vous l’avez oublié."],
      button: "Me connecter",
      footnote: "Si ce n’était pas vous, vous pouvez ignorer ce message : aucun changement n’a été fait.",
    }),
    ar: (d) => ({
      subject: "لديك حساب في Woman Cares مسبقًا",
      heading: `مرحبًا ${d.name}،`,
      body: ["حاول شخص للتو إنشاء حساب ببريدك الإلكتروني المسجل مسبقًا. إن كنت أنت، سجلي الدخول، أو أعيدي تعيين كلمة المرور إن نسيتها."],
      button: "تسجيل الدخول",
      footnote: "إن لم تكوني أنت، يمكنك تجاهل هذه الرسالة: لم يتم أي تغيير.",
    }),
  },
  "verify-email": {
    fr: (d) => ({
      subject: "Confirmez votre adresse e-mail",
      heading: `Bienvenue ${d.name},`,
      body: ["Merci d’avoir rejoint Woman Cares. Confirmez votre adresse e-mail pour activer toutes les fonctionnalités de votre compte."],
      button: "Confirmer mon adresse",
      footnote: "Ce lien est valable 24 heures. Si vous n’êtes pas à l’origine de cette inscription, ignorez ce message.",
    }),
    ar: (d) => ({
      subject: "أكدي بريدك الإلكتروني",
      heading: `مرحبًا ${d.name}،`,
      body: ["شكرًا لانضمامك إلى Woman Cares. أكدي بريدك الإلكتروني لتفعيل جميع ميزات حسابك."],
      button: "تأكيد بريدي الإلكتروني",
      footnote: "هذا الرابط صالح لمدة 24 ساعة. إن لم تقومي بهذا التسجيل، تجاهلي هذه الرسالة.",
    }),
  },
  "reset-password": {
    fr: (d) => ({
      subject: "Réinitialisation de votre mot de passe",
      heading: `Bonjour ${d.name},`,
      body: ["Vous avez demandé à réinitialiser le mot de passe de votre compte Woman Cares."],
      button: "Choisir un nouveau mot de passe",
      footnote: "Ce lien est valable 1 heure et ne fonctionne qu’une fois. Si vous n’avez rien demandé, ignorez ce message : votre mot de passe reste inchangé.",
    }),
    ar: (d) => ({
      subject: "إعادة تعيين كلمة المرور",
      heading: `مرحبًا ${d.name}،`,
      body: ["طلبتِ إعادة تعيين كلمة مرور حسابك في Woman Cares."],
      button: "اختيار كلمة مرور جديدة",
      footnote: "هذا الرابط صالح لمدة ساعة واحدة ويُستعمل مرة واحدة. إن لم تطلبي ذلك، تجاهلي الرسالة: تبقى كلمة مرورك كما هي.",
    }),
  },
  "password-changed": {
    fr: (d) => ({
      subject: "Votre mot de passe a été modifié",
      heading: `Bonjour ${d.name},`,
      body: [
        "Le mot de passe de votre compte Woman Cares vient d’être modifié. Toutes vos sessions ont été fermées par sécurité.",
        "Si vous n’êtes pas à l’origine de ce changement, réinitialisez votre mot de passe immédiatement et contactez-nous.",
      ],
      footnote: "Message de sécurité automatique.",
    }),
    ar: (d) => ({
      subject: "تم تغيير كلمة مرورك",
      heading: `مرحبًا ${d.name}،`,
      body: [
        "تم للتو تغيير كلمة مرور حسابك في Woman Cares. وأُغلقت كل جلساتك احتياطًا.",
        "إن لم تقومي بهذا التغيير، أعيدي تعيين كلمة المرور فورًا وتواصلي معنا.",
      ],
      footnote: "رسالة أمان تلقائية.",
    }),
  },
};

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function renderEmail(template: EmailTemplate, locale: Locale, data: TemplateData) {
  const c = copy[template][locale](data);
  const dir = locale === "ar" ? "rtl" : "ltr";
  const align = locale === "ar" ? "right" : "left";
  const button =
    c.button && data.url
      ? `<tr><td style="padding:8px 0 28px"><a href="${esc(data.url)}" style="display:inline-block;background:#a8445c;color:#fff7f8;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:999px">${esc(c.button)}</a></td></tr>
         <tr><td style="font-size:13px;color:#5b4550;padding-bottom:20px;word-break:break-all">${esc(data.url)}</td></tr>`
      : "";
  const html = `<!doctype html><html lang="${locale}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(c.subject)}</title></head>
<body style="margin:0;background:#fbf4f2;font-family:Arial,Helvetica,sans-serif;color:#25161d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;padding:36px;text-align:${align}" dir="${dir}">
<tr><td style="font-family:Georgia,serif;font-size:22px;letter-spacing:4px;padding-bottom:28px" dir="ltr">WOMAN CARES</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:26px;padding-bottom:16px">${esc(c.heading)}</td></tr>
${c.body.map((p) => `<tr><td style="font-size:16px;line-height:1.6;padding-bottom:16px">${esc(p)}</td></tr>`).join("")}
${button}
<tr><td style="font-size:13px;line-height:1.5;color:#5b4550;border-top:1px solid #eddad7;padding-top:20px">${esc(c.footnote)}</td></tr>
</table>
<p style="font-family:Georgia,serif;font-style:italic;color:#8e3249;font-size:14px" dir="ltr">Lady, we care about your beauty.</p>
</td></tr></table></body></html>`;
  const text = [c.heading, "", ...c.body, "", ...(c.button && data.url ? [`${c.button}: ${data.url}`, ""] : []), c.footnote, "", "Woman Cares"].join("\n");
  return { subject: c.subject, html, text };
}
