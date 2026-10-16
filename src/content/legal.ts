import type { Locale } from "@/i18n/config";

/**
 * Provisional legal texts, shown with a visible "draft" notice until an Admin publishes
 * a reviewed version (LegalDocumentVersion). They must be validated by a lawyer before launch,
 * and the publisher's legal identity completed.
 */
export type LegalDoc = { title: string; sections: { heading: string; body: string[] }[] };
export const legalDocs = ["privacy", "terms"] as const;
export type LegalDocKey = (typeof legalDocs)[number];

export const legalDrafts: Record<LegalDocKey, Record<Locale, LegalDoc>> = {
  privacy: {
    fr: {
      title: "Politique de confidentialité",
      sections: [
        {
          heading: "Qui traite vos données",
          body: [
            "La plateforme Woman Cares est éditée par son exploitant en Algérie (identité légale et adresse complètes à compléter avant le lancement). Pour toute question : la page Contact.",
            "Nous appliquons la loi n° 18-07 du 10 juin 2018 relative à la protection des personnes physiques dans le traitement des données à caractère personnel.",
          ],
        },
        {
          heading: "Les données que nous collectons",
          body: [
            "Clientes : nom, adresse e-mail, téléphone, mot de passe (stocké sous forme chiffrée irréversible), préférences de langue et de wilaya, demandes de rendez-vous, avis, favoris, et les photos d’inspiration que vous choisissez de joindre.",
            "Professionnelles : identité et coordonnées, informations d’établissement, localisation et réglages de visibilité, prestations et tarifs, photos et vidéos publiées, justificatifs de qualification pour les catégories réglementées, informations d’abonnement et de paiement à Woman Cares.",
            "Visites : pour mesurer la fréquentation des profils, nous enregistrons un identifiant anonyme recalculé chaque jour. Votre adresse IP n’est pas conservée.",
            "Position : la recherche « Autour de moi » utilise votre position uniquement si vous l’autorisez, arrondie à environ 1 km, et ne l’enregistre pas.",
          ],
        },
        {
          heading: "Pourquoi nous les utilisons",
          body: [
            "Fournir le service : comptes, recherche, rendez-vous, notifications, avis, abonnements des professionnelles.",
            "Sécurité : prévention de la fraude et des abus, vérification des profils.",
            "Amélioration : statistiques agrégées de fréquentation.",
            "Nous ne vendons pas vos données et n’envoyons pas de messages promotionnels sans votre accord.",
          ],
        },
        {
          heading: "Qui y a accès",
          body: [
            "Les photos d’inspiration et les détails d’un rendez-vous ne sont visibles que par vous, la professionnelle concernée et, si nécessaire, l’équipe de modération.",
            "L’adresse exacte d’une professionnelle n’est jamais publiée ; elle est partagée selon ses réglages après l’acceptation d’un rendez-vous.",
            "Nos prestataires techniques (hébergement, envoi d’e-mails) traitent les données pour notre compte, sous contrat.",
          ],
        },
        {
          heading: "Durée de conservation",
          body: [
            "Les données de compte sont conservées tant que le compte est actif, puis supprimées ou anonymisées, sauf obligations légales de conservation (notamment comptables pour la facturation).",
            "L’historique des rendez-vous et des paiements est conservé pour la durée exigée par la loi.",
          ],
        },
        {
          heading: "Vos droits",
          body: [
            "Vous pouvez demander l’accès, la rectification ou la suppression de vos données, et vous opposer à certains traitements, depuis votre espace ou via la page Contact.",
            "Vous pouvez également saisir l’Autorité nationale de protection des données à caractère personnel (ANPDP).",
          ],
        },
      ],
    },
    ar: {
      title: "سياسة الخصوصية",
      sections: [
        {
          heading: "من يعالج بياناتك",
          body: [
            "تُستغل منصة Woman Cares من طرف مشغلها في الجزائر (تُستكمل الهوية القانونية والعنوان قبل الإطلاق). لأي سؤال: صفحة الاتصال.",
            "نطبق القانون رقم 18-07 المؤرخ في 10 يونيو 2018 المتعلق بحماية الأشخاص الطبيعيين في مجال معالجة المعطيات ذات الطابع الشخصي.",
          ],
        },
        {
          heading: "البيانات التي نجمعها",
          body: [
            "الزبونات: الاسم، البريد الإلكتروني، الهاتف، كلمة المرور (مخزنة بشكل مشفر غير قابل للاسترجاع)، تفضيلات اللغة والولاية، طلبات المواعيد، التقييمات، المفضلة، وصور الإلهام التي تختارين إرفاقها.",
            "المحترفات: الهوية ومعلومات الاتصال، معلومات المؤسسة، الموقع وإعدادات الظهور، الخدمات والأسعار، الصور والفيديوهات المنشورة، وثائق المؤهلات للفئات المنظمة، ومعلومات الاشتراك والدفع لـ Woman Cares.",
            "الزيارات: لقياس زيارات الملفات نسجل معرفًا مجهولًا يُعاد حسابه كل يوم. لا يتم الاحتفاظ بعنوان IP الخاص بك.",
            "الموقع: يستعمل البحث «بالقرب مني» موقعك فقط إذا سمحت بذلك، مقربًا إلى حوالي 1 كم، ولا يتم حفظه.",
          ],
        },
        {
          heading: "لماذا نستعملها",
          body: [
            "تقديم الخدمة: الحسابات، البحث، المواعيد، الإشعارات، التقييمات، اشتراكات المحترفات.",
            "الأمان: منع الاحتيال وسوء الاستخدام، والتحقق من الملفات.",
            "التحسين: إحصائيات زيارات مجمعة.",
            "لا نبيع بياناتك ولا نرسل رسائل ترويجية دون موافقتك.",
          ],
        },
        {
          heading: "من يمكنه الاطلاع عليها",
          body: [
            "صور الإلهام وتفاصيل الموعد لا يراها إلا أنت والمحترفة المعنية، وفريق الإشراف عند الحاجة.",
            "لا يُنشر العنوان الدقيق للمحترفة أبدًا؛ تتم مشاركته حسب إعداداتها بعد قبول الموعد.",
            "يعالج مقدمو خدماتنا التقنيون (الاستضافة، إرسال البريد) البيانات لحسابنا بموجب عقد.",
          ],
        },
        {
          heading: "مدة الاحتفاظ",
          body: [
            "تُحفظ بيانات الحساب ما دام الحساب نشطًا، ثم تُحذف أو تُجهّل، باستثناء التزامات الحفظ القانونية (لا سيما المحاسبية للفوترة).",
            "يُحتفظ بسجل المواعيد والمدفوعات للمدة التي يفرضها القانون.",
          ],
        },
        {
          heading: "حقوقك",
          body: [
            "يمكنك طلب الاطلاع على بياناتك أو تصحيحها أو حذفها، والاعتراض على بعض المعالجات، من حسابك أو عبر صفحة الاتصال.",
            "يمكنك أيضًا اللجوء إلى السلطة الوطنية لحماية المعطيات ذات الطابع الشخصي.",
          ],
        },
      ],
    },
  },
  terms: {
    fr: {
      title: "Conditions d’utilisation",
      sections: [
        {
          heading: "Le service",
          body: [
            "Woman Cares met en relation des clientes et des professionnelles de la beauté et du bien-être en Algérie. Woman Cares n’est pas partie au contrat de prestation conclu entre la cliente et la professionnelle.",
          ],
        },
        {
          heading: "Comptes",
          body: [
            "Vous devez fournir des informations exactes et garder votre mot de passe confidentiel. Un compte est nécessaire pour envoyer une demande de rendez-vous.",
            "Nous pouvons suspendre un compte en cas d’usage frauduleux, abusif ou contraire à ces conditions.",
          ],
        },
        {
          heading: "Rendez-vous et paiements",
          body: [
            "Une demande de rendez-vous n’est confirmée qu’après acceptation par la professionnelle. Les prix affichés sont des prix de départ ; le prix final peut dépendre de la prestation.",
            "Sauf mention contraire, la prestation est réglée directement à la professionnelle. Les conditions d’annulation de chaque profil s’appliquent.",
          ],
        },
        {
          heading: "Avis",
          body: [
            "Seules les clientes ayant terminé un rendez-vous peuvent laisser un avis, une seule fois par rendez-vous. Les avis doivent être honnêtes et respectueux ; nous pouvons masquer un avis signalé et contraire à ces règles.",
          ],
        },
        {
          heading: "Professionnelles",
          body: [
            "Les professionnelles sont responsables de l’exactitude de leurs informations, de leurs qualifications, du respect des règles d’hygiène et de la réglementation applicable à leurs prestations.",
            "Les catégories réglementées (dont le botox) exigent des justificatifs vérifiés avant publication. Les informations d’hygiène et de produits sont déclaratives.",
            "Après la période gratuite, la publication des profils est soumise à l’abonnement en vigueur, dont le montant est affiché avant activation. En cas d’impayé après le délai de grâce, les profils sont masqués sans suppression des données.",
          ],
        },
        {
          heading: "Contenus",
          body: [
            "Vous conservez vos droits sur les photos et textes publiés et accordez à Woman Cares le droit de les afficher sur la plateforme. Il est interdit de publier des contenus dont vous ne détenez pas les droits ou montrant une personne sans son accord.",
          ],
        },
        {
          heading: "Responsabilité",
          body: [
            "Woman Cares s’efforce d’assurer l’exactitude des informations et la disponibilité du service, sans garantie de résultat sur les prestations, qui relèvent des professionnelles.",
          ],
        },
        {
          heading: "Droit applicable",
          body: ["Ces conditions sont régies par le droit algérien."],
        },
      ],
    },
    ar: {
      title: "شروط الاستخدام",
      sections: [
        {
          heading: "الخدمة",
          body: [
            "تربط Woman Cares بين الزبونات ومحترفات الجمال والعافية في الجزائر. وليست Woman Cares طرفًا في عقد الخدمة المبرم بين الزبونة والمحترفة.",
          ],
        },
        {
          heading: "الحسابات",
          body: [
            "يجب تقديم معلومات صحيحة والحفاظ على سرية كلمة المرور. الحساب ضروري لإرسال طلب موعد.",
            "يمكننا تعليق أي حساب في حال الاستعمال الاحتيالي أو المسيء أو المخالف لهذه الشروط.",
          ],
        },
        {
          heading: "المواعيد والمدفوعات",
          body: [
            "لا يُؤكد طلب الموعد إلا بعد قبول المحترفة. الأسعار المعروضة ابتدائية؛ وقد يختلف السعر النهائي حسب الخدمة.",
            "ما لم يُذكر خلاف ذلك، تُدفع الخدمة مباشرة للمحترفة. وتطبق شروط الإلغاء الخاصة بكل ملف.",
          ],
        },
        {
          heading: "التقييمات",
          body: [
            "لا يمكن التقييم إلا للزبونات اللواتي أتممن موعدًا، ومرة واحدة لكل موعد. يجب أن تكون التقييمات صادقة ومحترمة؛ ويمكننا إخفاء تقييم مُبلغ عنه ومخالف لهذه القواعد.",
          ],
        },
        {
          heading: "المحترفات",
          body: [
            "المحترفات مسؤولات عن صحة معلوماتهن ومؤهلاتهن واحترام قواعد النظافة والتنظيم المطبق على خدماتهن.",
            "تتطلب الفئات المنظمة (ومنها البوتوكس) وثائق موثقة قبل النشر. ومعلومات النظافة والمنتجات تصريحية.",
            "بعد الفترة المجانية، يخضع نشر الملفات للاشتراك الساري الذي يُعرض مبلغه قبل التفعيل. وفي حال عدم الدفع بعد مهلة السماح، تُخفى الملفات دون حذف البيانات.",
          ],
        },
        {
          heading: "المحتوى",
          body: [
            "تحتفظين بحقوقك على الصور والنصوص المنشورة وتمنحين Woman Cares حق عرضها على المنصة. ويُمنع نشر محتوى لا تملكين حقوقه أو يظهر شخصًا دون موافقته.",
          ],
        },
        {
          heading: "المسؤولية",
          body: [
            "تسعى Woman Cares إلى ضمان دقة المعلومات وتوفر الخدمة، دون ضمان نتيجة الخدمات التي تبقى من مسؤولية المحترفات.",
          ],
        },
        {
          heading: "القانون المطبق",
          body: ["تخضع هذه الشروط للقانون الجزائري."],
        },
      ],
    },
  },
};
