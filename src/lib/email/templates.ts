import type { Locale } from "@/i18n/config";

export type EmailTemplate =
  | "verify-email"
  | "reset-password"
  | "password-changed"
  | "account-exists"
  | "profile-published"
  | "profile-changes"
  | "profile-suspended"
  | "account-update"
  | "category-decision"
  | "booking-request"
  | "booking-received"
  | "booking-decision"
  | "booking-cancelled"
  | "booking-reschedule"
  | "booking-reschedule-reply"
  | "staff-alert"
  | "billing-invoice"
  | "billing-grace"
  | "billing-expired"
  | "billing-paid"
  | "billing-refused"
  | "billing-trial-ending";
export type TemplateData = {
  name: string;
  url?: string;
  /** Category name in the recipient's language. */
  category?: string;
  /** Staff message. */
  note?: string | null;
  /** For account-update / category-decision. */
  outcome?: "approved" | "rejected" | "suspended" | "reinstated";
  /** Bookings: service name, reference, date and time (already in the recipient's language), client first name. */
  service?: string;
  reference?: string;
  when?: string;
  client?: string;
  /** staff-alert: what happened. */
  kind?: "provider" | "contact" | "payment";
  /** booking-cancelled: who cancelled. */
  by?: "client" | "provider";
  /** Billing: amount already formatted. */
  amount?: string;
};

type Copy = { subject: string; heading: string; body: string[]; button?: string; footnote: string };

const copy: Record<EmailTemplate, Record<Locale, (d: TemplateData) => Copy>> = {
  "profile-published": {
    fr: (d) => ({
      subject: `Votre profil ${d.category ?? ""} est publié`,
      heading: `Bonne nouvelle, ${d.name} !`,
      body: [`Votre profil ${d.category ?? ""} a été vérifié par notre équipe et il est maintenant visible sur Woman Cares.`],
      button: "Voir mon espace",
      footnote: "Vous pouvez continuer à modifier vos prestations, photos et horaires à tout moment.",
    }),
    ar: (d) => ({
      subject: `تم نشر ملف ${d.category ?? ""}`,
      heading: `أخبار سارة يا ${d.name}!`,
      body: [`تحقق فريقنا من ملف ${d.category ?? ""} وأصبح الآن ظاهرًا على Woman Cares.`],
      button: "عرض مساحتي",
      footnote: "يمكنك مواصلة تعديل خدماتك وصورك وأوقات عملك في أي وقت.",
    }),
  },
  "profile-changes": {
    fr: (d) => ({
      subject: `Votre profil ${d.category ?? ""} : modifications demandées`,
      heading: `Bonjour ${d.name},`,
      body: [`Avant de publier votre profil ${d.category ?? ""}, notre équipe vous demande quelques modifications :`, d.note ?? ""],
      button: "Modifier mon profil",
      footnote: "Une fois les changements faits, renvoyez le profil pour vérification depuis votre espace.",
    }),
    ar: (d) => ({
      subject: `ملف ${d.category ?? ""}: تعديلات مطلوبة`,
      heading: `مرحبًا ${d.name}،`,
      body: [`قبل نشر ملف ${d.category ?? ""}، يطلب منك فريقنا بعض التعديلات:`, d.note ?? ""],
      button: "تعديل ملفي",
      footnote: "بعد إجراء التعديلات، أعيدي إرسال الملف للتحقق من مساحتك.",
    }),
  },
  "profile-suspended": {
    fr: (d) => ({
      subject: `Votre profil ${d.category ?? ""} est suspendu`,
      heading: `Bonjour ${d.name},`,
      body: [`Votre profil ${d.category ?? ""} n’est plus visible sur Woman Cares pour la raison suivante :`, d.note ?? ""],
      button: "Mon espace",
      footnote: "Pour toute question, répondez via la page Contact. Vos données et votre historique sont conservés.",
    }),
    ar: (d) => ({
      subject: `تم تعليق ملف ${d.category ?? ""}`,
      heading: `مرحبًا ${d.name}،`,
      body: [`لم يعد ملف ${d.category ?? ""} ظاهرًا على Woman Cares للسبب التالي:`, d.note ?? ""],
      button: "مساحتي",
      footnote: "لأي سؤال، تواصلي معنا عبر صفحة الاتصال. تبقى بياناتك وسجلك محفوظة.",
    }),
  },
  "account-update": {
    fr: (d) => ({
      subject:
        d.outcome === "approved" || d.outcome === "reinstated"
          ? "Votre compte professionnel est actif"
          : d.outcome === "rejected"
            ? "Votre inscription professionnelle"
            : "Votre compte professionnel est suspendu",
      heading: `Bonjour ${d.name},`,
      body:
        d.outcome === "approved" || d.outcome === "reinstated"
          ? ["Votre compte professionnel est actif. Vos profils validés peuvent apparaître sur Woman Cares."]
          : [d.outcome === "rejected" ? "Votre inscription n’a pas été retenue." : "Votre compte professionnel est suspendu et vos profils ne sont plus visibles.", d.note ?? ""],
      button: "Mon espace",
      footnote: "Pour toute question, écrivez-nous depuis la page Contact.",
    }),
    ar: (d) => ({
      subject:
        d.outcome === "approved" || d.outcome === "reinstated"
          ? "حسابك المهني مفعّل"
          : d.outcome === "rejected"
            ? "تسجيلك المهني"
            : "تم تعليق حسابك المهني",
      heading: `مرحبًا ${d.name}،`,
      body:
        d.outcome === "approved" || d.outcome === "reinstated"
          ? ["حسابك المهني مفعّل. يمكن لملفاتك المقبولة أن تظهر على Woman Cares."]
          : [d.outcome === "rejected" ? "لم يتم قبول تسجيلك." : "تم تعليق حسابك المهني ولم تعد ملفاتك ظاهرة.", d.note ?? ""],
      button: "مساحتي",
      footnote: "لأي سؤال، راسلينا من صفحة الاتصال.",
    }),
  },
  "category-decision": {
    fr: (d) => ({
      subject: `Votre demande ${d.category ?? ""}`,
      heading: `Bonjour ${d.name},`,
      body:
        d.outcome === "approved"
          ? [`Votre demande pour la catégorie ${d.category ?? ""} est acceptée. Un profil brouillon vous attend dans votre espace.`]
          : [`Votre demande pour la catégorie ${d.category ?? ""} n’a pas été acceptée.`, d.note ?? ""],
      button: "Mon espace",
      footnote: "Woman Cares vérifie les qualifications pour les soins réglementés afin de protéger les clientes.",
    }),
    ar: (d) => ({
      subject: `طلبك لفئة ${d.category ?? ""}`,
      heading: `مرحبًا ${d.name}،`,
      body:
        d.outcome === "approved"
          ? [`تم قبول طلبك لفئة ${d.category ?? ""}. ينتظرك ملف مسودة في مساحتك.`]
          : [`لم يتم قبول طلبك لفئة ${d.category ?? ""}.`, d.note ?? ""],
      button: "مساحتي",
      footnote: "تتحقق Woman Cares من المؤهلات بالنسبة للعلاجات المنظمة لحماية الزبونات.",
    }),
  },

  "booking-request": {
    fr: (d) => ({
      subject: `Nouvelle demande : ${d.service ?? ""}, ${d.when ?? ""}`,
      heading: `Bonjour ${d.name},`,
      body: [`${d.client ?? "Une cliente"} demande un rendez-vous pour ${d.service ?? ""}, ${d.when ?? ""}.`, `Référence ${d.reference ?? ""}. Acceptez ou refusez la demande depuis votre espace.`],
      button: "Voir la demande",
      footnote: "La place reste réservée tant que la demande est en attente.",
    }),
    ar: (d) => ({
      subject: `طلب جديد: ${d.service ?? ""}، ${d.when ?? ""}`,
      heading: `مرحبًا ${d.name}،`,
      body: [`${d.client ?? "زبونة"} تطلب موعدًا لـ ${d.service ?? ""}، ${d.when ?? ""}.`, `المرجع ${d.reference ?? ""}. اقبلي الطلب أو ارفضيه من مساحتك.`],
      button: "عرض الطلب",
      footnote: "يبقى المكان محجوزًا ما دام الطلب قيد الانتظار.",
    }),
  },
  "booking-received": {
    fr: (d) => ({
      subject: `Demande envoyée : ${d.service ?? ""}`,
      heading: `Merci ${d.name},`,
      body: [`Votre demande pour ${d.service ?? ""}, ${d.when ?? ""}, a bien été envoyée.`, `Référence ${d.reference ?? ""}. La professionnelle va l’accepter ou vous répondre ; vous recevrez un e-mail.`],
      button: "Mes rendez-vous",
      footnote: "Le rendez-vous est confirmé seulement lorsque la professionnelle l’accepte.",
    }),
    ar: (d) => ({
      subject: `تم إرسال طلبك: ${d.service ?? ""}`,
      heading: `شكرًا ${d.name}،`,
      body: [`تم إرسال طلبك لـ ${d.service ?? ""}، ${d.when ?? ""}.`, `المرجع ${d.reference ?? ""}. ستقبل المحترفة الطلب أو ترد عليك، وستصلك رسالة.`],
      button: "مواعيدي",
      footnote: "لا يُؤكَّد الموعد إلا عندما تقبله المحترفة.",
    }),
  },
  "booking-decision": {
    fr: (d) => ({
      subject: d.outcome === "approved" ? `Rendez-vous confirmé : ${d.service ?? ""}` : `Demande non acceptée : ${d.service ?? ""}`,
      heading: `Bonjour ${d.name},`,
      body:
        d.outcome === "approved"
          ? [`Votre rendez-vous pour ${d.service ?? ""}, ${d.when ?? ""}, est confirmé.`, `Référence ${d.reference ?? ""}.`, d.note ?? ""]
          : [`Votre demande pour ${d.service ?? ""}, ${d.when ?? ""}, n’a pas pu être acceptée.`, d.note ?? "", "Vous pouvez choisir un autre créneau ou une autre professionnelle."],
      button: "Mes rendez-vous",
      footnote: "Le paiement se fait directement auprès de la professionnelle.",
    }),
    ar: (d) => ({
      subject: d.outcome === "approved" ? `تم تأكيد الموعد: ${d.service ?? ""}` : `لم يُقبل الطلب: ${d.service ?? ""}`,
      heading: `مرحبًا ${d.name}،`,
      body:
        d.outcome === "approved"
          ? [`تم تأكيد موعدك لـ ${d.service ?? ""}، ${d.when ?? ""}.`, `المرجع ${d.reference ?? ""}.`, d.note ?? ""]
          : [`تعذّر قبول طلبك لـ ${d.service ?? ""}، ${d.when ?? ""}.`, d.note ?? "", "يمكنك اختيار موعد آخر أو محترفة أخرى."],
      button: "مواعيدي",
      footnote: "يتم الدفع مباشرة لدى المحترفة.",
    }),
  },
  "booking-cancelled": {
    fr: (d) => ({
      subject: `Rendez-vous annulé : ${d.service ?? ""}`,
      heading: `Bonjour ${d.name},`,
      body:
        d.by === "provider"
          ? [`La professionnelle a annulé votre rendez-vous pour ${d.service ?? ""}, ${d.when ?? ""}.`, d.note ?? "", `Référence ${d.reference ?? ""}. Vous pouvez choisir un autre créneau.`]
          : [`${d.client ?? "La cliente"} a annulé son rendez-vous pour ${d.service ?? ""}, ${d.when ?? ""}.`, d.note ?? "", `Référence ${d.reference ?? ""}. Le créneau est de nouveau libre.`],
      button: d.by === "provider" ? "Mes rendez-vous" : "Voir mes rendez-vous",
      footnote: "Cette annulation est enregistrée dans l’historique du rendez-vous.",
    }),
    ar: (d) => ({
      subject: `تم إلغاء الموعد: ${d.service ?? ""}`,
      heading: `مرحبًا ${d.name}،`,
      body:
        d.by === "provider"
          ? [`ألغت المحترفة موعدك لـ ${d.service ?? ""}، ${d.when ?? ""}.`, d.note ?? "", `المرجع ${d.reference ?? ""}. يمكنك اختيار موعد آخر.`]
          : [`ألغت ${d.client ?? "الزبونة"} موعدها لـ ${d.service ?? ""}، ${d.when ?? ""}.`, d.note ?? "", `المرجع ${d.reference ?? ""}. أصبح الموعد متاحًا من جديد.`],
      button: "مواعيدي",
      footnote: "يُسجَّل هذا الإلغاء في سجل الموعد.",
    }),
  },
  "booking-reschedule": {
    fr: (d) => ({
      subject: `Nouvel horaire proposé : ${d.service ?? ""}`,
      heading: `Bonjour ${d.name},`,
      body: [`La professionnelle vous propose un autre horaire pour ${d.service ?? ""} : ${d.when ?? ""}.`, d.note ?? "", `Référence ${d.reference ?? ""}. Acceptez ou refusez la proposition depuis votre espace.`],
      button: "Répondre",
      footnote: "Votre horaire initial reste réservé tant que vous n’avez pas répondu.",
    }),
    ar: (d) => ({
      subject: `اقتراح موعد جديد: ${d.service ?? ""}`,
      heading: `مرحبًا ${d.name}،`,
      body: [`تقترح عليك المحترفة موعدًا آخر لـ ${d.service ?? ""}: ${d.when ?? ""}.`, d.note ?? "", `المرجع ${d.reference ?? ""}. اقبلي الاقتراح أو ارفضيه من مساحتك.`],
      button: "الرد",
      footnote: "يبقى موعدك الأول محجوزًا إلى أن تردي.",
    }),
  },
  "booking-reschedule-reply": {
    fr: (d) => ({
      subject: d.outcome === "approved" ? `Nouvel horaire accepté : ${d.service ?? ""}` : `Nouvel horaire refusé : ${d.service ?? ""}`,
      heading: `Bonjour ${d.name},`,
      body:
        d.outcome === "approved"
          ? [`${d.client ?? "La cliente"} a accepté le nouvel horaire pour ${d.service ?? ""} : ${d.when ?? ""}.`, `Référence ${d.reference ?? ""}.`]
          : [`${d.client ?? "La cliente"} n’a pas accepté le nouvel horaire pour ${d.service ?? ""}. Le rendez-vous revient à l’horaire initial : ${d.when ?? ""}.`, `Référence ${d.reference ?? ""}.`],
      button: "Voir le rendez-vous",
      footnote: "Vous pouvez gérer ce rendez-vous depuis votre espace.",
    }),
    ar: (d) => ({
      subject: d.outcome === "approved" ? `تم قبول الموعد الجديد: ${d.service ?? ""}` : `تم رفض الموعد الجديد: ${d.service ?? ""}`,
      heading: `مرحبًا ${d.name}،`,
      body:
        d.outcome === "approved"
          ? [`قبلت ${d.client ?? "الزبونة"} الموعد الجديد لـ ${d.service ?? ""}: ${d.when ?? ""}.`, `المرجع ${d.reference ?? ""}.`]
          : [`لم تقبل ${d.client ?? "الزبونة"} الموعد الجديد لـ ${d.service ?? ""}. يعود الموعد إلى وقته الأول: ${d.when ?? ""}.`, `المرجع ${d.reference ?? ""}.`],
      button: "عرض الموعد",
      footnote: "يمكنك إدارة هذا الموعد من مساحتك.",
    }),
  },

  "staff-alert": {
    fr: (d) =>
      d.kind === "provider"
        ? { subject: `Nouvelle professionnelle inscrite : ${d.client ?? ""}`, heading: `Bonjour ${d.name},`, body: [`${d.client ?? ""} vient de créer un compte professionnel (${d.note ?? ""}).`, d.category ? `Catégories : ${d.category}.` : "", "Ouvrez sa fiche pour vérifier ses informations."], button: "Voir la fiche", footnote: "Alerte envoyée aux super administratrices de Woman Cares." }
        : d.kind === "contact"
          ? { subject: `Nouveau message : ${d.reference ?? ""}`, heading: `Bonjour ${d.name},`, body: [`${d.client ?? ""} a écrit depuis le formulaire de contact.`, `Objet : ${d.reference ?? ""}`], button: "Lire le message", footnote: "Alerte envoyée aux super administratrices de Woman Cares." }
          : { subject: `Paiement déclaré : ${d.reference ?? ""}`, heading: `Bonjour ${d.name},`, body: [`${d.client ?? ""} déclare avoir réglé la facture ${d.reference ?? ""} (${d.amount ?? ""}).`, "Vérifiez la réception puis validez ou refusez le paiement."], button: "Vérifier le paiement", footnote: "Alerte envoyée aux super administratrices de Woman Cares." },
    ar: (d) =>
      d.kind === "provider"
        ? { subject: `محترفة جديدة مسجلة: ${d.client ?? ""}`, heading: `مرحبًا ${d.name}،`, body: [`أنشأت ${d.client ?? ""} حسابًا مهنيًا (${d.note ?? ""}).`, d.category ? `الفئات: ${d.category}.` : "", "افتحي ملفها للتحقق من معلوماتها."], button: "عرض الملف", footnote: "تنبيه مرسل إلى المشرفات العامات في Woman Cares." }
        : d.kind === "contact"
          ? { subject: `رسالة جديدة: ${d.reference ?? ""}`, heading: `مرحبًا ${d.name}،`, body: [`كتب(ت) ${d.client ?? ""} عبر نموذج الاتصال.`, `الموضوع: ${d.reference ?? ""}`], button: "قراءة الرسالة", footnote: "تنبيه مرسل إلى المشرفات العامات في Woman Cares." }
          : { subject: `دفع مصرَّح به: ${d.reference ?? ""}`, heading: `مرحبًا ${d.name}،`, body: [`تصرّح ${d.client ?? ""} بأنها دفعت الفاتورة ${d.reference ?? ""} (${d.amount ?? ""}).`, "تحققي من الاستلام ثم اقبلي الدفع أو ارفضيه."], button: "التحقق من الدفع", footnote: "تنبيه مرسل إلى المشرفات العامات في Woman Cares." },
  },

  "billing-invoice": {
    fr: (d) => ({
      subject: `Facture ${d.reference ?? ""} : ${d.amount ?? ""}`,
      heading: `Bonjour ${d.name},`,
      body: [`Votre facture d’abonnement ${d.reference ?? ""} est disponible : ${d.amount ?? ""}, à régler avant le ${d.when ?? ""}.`, "Après votre virement, déclarez-le depuis votre espace pour que notre équipe le vérifie."],
      button: "Voir ma facture",
      footnote: "Vos profils restent visibles pendant le délai de paiement.",
    }),
    ar: (d) => ({
      subject: `الفاتورة ${d.reference ?? ""}: ${d.amount ?? ""}`,
      heading: `مرحبًا ${d.name}،`,
      body: [`فاتورة اشتراكك ${d.reference ?? ""} متاحة: ${d.amount ?? ""}، يجب تسديدها قبل ${d.when ?? ""}.`, "بعد التحويل، صرّحي به من مساحتك ليتحقق منه فريقنا."],
      button: "عرض الفاتورة",
      footnote: "تبقى ملفاتك ظاهرة خلال مهلة الدفع.",
    }),
  },
  "billing-grace": {
    fr: (d) => ({
      subject: `Paiement en retard : ${d.reference ?? ""}`,
      heading: `Bonjour ${d.name},`,
      body: [`La facture ${d.reference ?? ""} (${d.amount ?? ""}) n’est pas encore réglée.`, `Vos profils restent visibles jusqu’au ${d.when ?? ""}. Ensuite, ils seront masqués de l’annuaire, sans perte de données.`],
      button: "Régler ma facture",
      footnote: "Une question sur votre facture ? Écrivez-nous depuis votre espace.",
    }),
    ar: (d) => ({
      subject: `دفع متأخر: ${d.reference ?? ""}`,
      heading: `مرحبًا ${d.name}،`,
      body: [`لم تُسدَّد بعد الفاتورة ${d.reference ?? ""} (${d.amount ?? ""}).`, `تبقى ملفاتك ظاهرة حتى ${d.when ?? ""}، ثم تُخفى من الدليل دون فقدان أي بيانات.`],
      button: "تسديد الفاتورة",
      footnote: "سؤال حول فاتورتك؟ راسلينا من مساحتك.",
    }),
  },
  "billing-expired": {
    fr: (d) => ({
      subject: "Vos profils sont masqués",
      heading: `Bonjour ${d.name},`,
      body: [`La facture ${d.reference ?? ""} (${d.amount ?? ""}) n’a pas été réglée dans le délai. Vos profils sont masqués de l’annuaire.`, "Votre compte, vos rendez-vous et votre historique sont conservés. Dès votre paiement vérifié, vos profils réapparaissent."],
      button: "Régler ma facture",
      footnote: "Woman Cares ne supprime jamais vos données pour un retard de paiement.",
    }),
    ar: (d) => ({
      subject: "ملفاتك مخفية",
      heading: `مرحبًا ${d.name}،`,
      body: [`لم تُسدَّد الفاتورة ${d.reference ?? ""} (${d.amount ?? ""}) في الأجل. ملفاتك مخفية من الدليل.`, "حسابك ومواعيدك وسجلك محفوظة. بمجرد التحقق من دفعك، تعود ملفاتك للظهور."],
      button: "تسديد الفاتورة",
      footnote: "لا تحذف Woman Cares بياناتك أبدًا بسبب تأخر الدفع.",
    }),
  },
  "billing-paid": {
    fr: (d) => ({
      subject: `Paiement confirmé : ${d.reference ?? ""}`,
      heading: `Merci ${d.name},`,
      body: [`Votre paiement de ${d.amount ?? ""} pour la facture ${d.reference ?? ""} est confirmé.`],
      button: "Mon abonnement",
      footnote: "Vos factures restent disponibles dans votre espace.",
    }),
    ar: (d) => ({
      subject: `تم تأكيد الدفع: ${d.reference ?? ""}`,
      heading: `شكرًا ${d.name}،`,
      body: [`تم تأكيد دفعك بقيمة ${d.amount ?? ""} للفاتورة ${d.reference ?? ""}.`],
      button: "اشتراكي",
      footnote: "تبقى فواتيرك متاحة في مساحتك.",
    }),
  },
  "billing-refused": {
    fr: (d) => ({
      subject: `Paiement non confirmé : ${d.reference ?? ""}`,
      heading: `Bonjour ${d.name},`,
      body: [`Nous n’avons pas pu confirmer votre paiement pour la facture ${d.reference ?? ""}.`, d.note ?? "", "Vous pouvez déclarer à nouveau votre virement avec la bonne référence."],
      button: "Ma facture",
      footnote: "Une question ? Écrivez-nous depuis votre espace.",
    }),
    ar: (d) => ({
      subject: `لم يتم تأكيد الدفع: ${d.reference ?? ""}`,
      heading: `مرحبًا ${d.name}،`,
      body: [`لم نتمكن من تأكيد دفعك للفاتورة ${d.reference ?? ""}.`, d.note ?? "", "يمكنك التصريح بالتحويل من جديد بالمرجع الصحيح."],
      button: "فاتورتي",
      footnote: "سؤال؟ راسلينا من مساحتك.",
    }),
  },
  "billing-trial-ending": {
    fr: (d) => ({
      subject: "Votre période d’essai se termine bientôt",
      heading: `Bonjour ${d.name},`,
      body: [`Votre période d’essai gratuite se termine le ${d.when ?? ""}. Votre première facture sera alors émise selon vos catégories publiées.`],
      button: "Mon abonnement",
      footnote: "Le montant applicable est toujours affiché dans votre espace avant facturation.",
    }),
    ar: (d) => ({
      subject: "فترتك التجريبية تنتهي قريبًا",
      heading: `مرحبًا ${d.name}،`,
      body: [`تنتهي فترتك التجريبية المجانية في ${d.when ?? ""}. ستصدر حينها فاتورتك الأولى حسب فئاتك المنشورة.`],
      button: "اشتراكي",
      footnote: "يُعرض المبلغ المطبق دائمًا في مساحتك قبل الفوترة.",
    }),
  },

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
${c.body.filter(Boolean).map((p) => `<tr><td style="font-size:16px;line-height:1.6;padding-bottom:16px;white-space:pre-line">${esc(p)}</td></tr>`).join("")}
${button}
<tr><td style="font-size:13px;line-height:1.5;color:#5b4550;border-top:1px solid #eddad7;padding-top:20px">${esc(c.footnote)}</td></tr>
</table>
<p style="font-family:Georgia,serif;font-style:italic;color:#8e3249;font-size:14px" dir="ltr">Lady, we care about your beauty.</p>
</td></tr></table></body></html>`;
  const text = [c.heading, "", ...c.body.filter(Boolean), "", ...(c.button && data.url ? [`${c.button}: ${data.url}`, ""] : []), c.footnote, "", "Woman Cares"].join("\n");
  return { subject: c.subject, html, text };
}
