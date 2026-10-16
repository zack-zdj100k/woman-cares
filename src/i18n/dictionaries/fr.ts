import type { CategorySlug } from "@/config/categories";

type CategoryCopy = { name: string; short: string; caption: string };

const fr = {
  meta: {
    title: "Woman Cares | Beauté et soins pour les femmes en Algérie",
    description:
      "Trouvez une coiffeuse, une esthéticienne, une masseuse ou une prothésiste ongulaire près de chez vous en Algérie. Découvrez leur travail, comparez et demandez un rendez-vous.",
  },
  brand: {
    name: "Woman Cares",
    signature: "Lady, we care about your beauty.",
    signatureTranslated: "Madame, nous prenons soin de votre beauté.",
  },
  nav: {
    care: "Les soins",
    about: "Notre histoire",
    forPros: "Pour les pros",
    signIn: "Connexion",
    join: "Rejoindre Woman Cares",
    menu: "Menu",
    close: "Fermer",
    language: "Langue",
    allCategories: "Toutes les catégories",
    skip: "Aller au contenu",
    search: "Rechercher",
    dial: {
      hint: "Faites tourner pour choisir",
      open: "Ouvrir",
      home: "Accueil",
      homeShort: "Le film, les six univers et les professionnelles du moment.",
      aboutShort: "Pourquoi Woman Cares existe et comment nous travaillons.",
      prosShort: "Votre vitrine, vos demandes et votre agenda au même endroit.",
      contact: "Contact",
      contactShort: "Une question, un souci ou une suggestion : écrivez-nous.",
      accountShort: "Vos rendez-vous, vos favoris et vos réglages.",
    },
  },
  categories: {
    coiffeuses: {
      name: "Coiffure",
      short: "Coupe, couleur, soins du cheveu et coiffures de mariée.",
      caption: "Coupe, couleur, brushing ou chignon de mariée : trouvez la main qui comprend vos cheveux.",
    },
    esthetique: {
      name: "Esthétique",
      short: "Soins du visage, épilation et rituels de peau.",
      caption: "Soins du visage et rituels de peau, pratiqués par des esthéticiennes près de chez vous.",
    },
    nails: {
      name: "Ongles",
      short: "Manucure, pédicure, extensions et nail art.",
      caption: "Manucure, pédicure, extensions et nail art : choisissez un style, puis la bonne artiste.",
    },
    massage: {
      name: "Massage",
      short: "Massages relaxants et soins du corps.",
      caption: "Un moment pour vous : massages relaxants et soins du corps, à votre rythme.",
    },
    "extensions-de-cils": {
      name: "Extensions de cils",
      short: "Pose cil à cil, volume, rehaussement et entretien.",
      caption: "Cil à cil ou volume, avec les conseils d’entretien de votre technicienne.",
    },
    botox: {
      name: "Botox",
      short: "Soins esthétiques du visage, réservés aux profils vérifiés.",
      caption: "Uniquement des praticiennes dont les qualifications ont été vérifiées par notre équipe.",
    },
  } satisfies Record<CategorySlug, CategoryCopy>,
  hero: {
    eyebrow: "Beauté et bien-être en Algérie",
    titleLines: ["Votre beauté.", "Votre soin.", "Votre choix."],
    subtitle:
      "Découvrez les professionnelles près de chez vous, regardez leur travail et demandez votre rendez-vous au même endroit.",
    primary: "Trouver mon soin",
    secondary: "Vous êtes professionnelle ?",
    pause: "Mettre la vidéo en pause",
    play: "Lire la vidéo",
    chapters: "Univers de soin",
    showChapter: "Voir l’univers",
    explore: "Explorer",
  },
  search: {
    title: "Trouver mon soin",
    intro: "Choisissez un soin et un lieu. Vous pourrez affiner ensuite.",
    category: "Soin",
    chooseCategory: "Choisir un soin",
    wilaya: "Wilaya",
    anyWilaya: "Toutes les wilayas",
    commune: "Commune",
    communePlaceholder: "Ex. Hydra, Bir Mourad Raïs",
    keyword: "Prestation (facultatif)",
    keywordPlaceholder: "Ex. balayage, pose gel",
    date: "Date souhaitée (facultatif)",
    nearby: "Autour de moi",
    nearbyHelp:
      "Nous utilisons votre position uniquement pour trier les professionnelles par distance. Elle n’est pas enregistrée.",
    nearbyLocating: "Localisation en cours…",
    nearbyOn: "Position utilisée pour cette recherche",
    nearbyDenied: "Position refusée. Choisissez une wilaya à la place.",
    nearbyUnavailable: "Position indisponible sur cet appareil. Choisissez une wilaya.",
    submit: "Voir les professionnelles",
    close: "Fermer la recherche",
    categoryRequired: "Choisissez un soin pour continuer.",
  },
  showcase: {
    title: "Six univers, une seule adresse",
    body: "Chaque catégorie a ses propres profils, ses filtres et ses prestations.",
    cta: "Découvrir",
    verifiedOnly: "Profils vérifiés uniquement",
  },
  featured: {
    title: "Professionnelles à découvrir",
    emptyTitle: "Les premiers profils arrivent",
    emptyBody:
      "Nous vérifions actuellement les premières professionnelles. Revenez bientôt, ou rejoignez-nous si vous êtes vous-même professionnelle.",
    from: "À partir de",
    viewProfile: "Voir le profil",
    book: "Réserver",
    verified: "Vérifiée",
    browse: "Voir les six univers",
    proLink: "Vous êtes professionnelle ? Rejoignez-nous",
  },
  how: {
    title: "Comment ça marche",
    steps: [
      {
        title: "Explorez",
        body: "Parcourez les catégories, filtrez par wilaya, par commune ou autour de vous.",
      },
      {
        title: "Comparez",
        body: "Photos du travail, prestations, prix de départ, horaires et avis vérifiés.",
      },
      {
        title: "Demandez",
        body: "Choisissez un créneau libre, ajoutez un mot si vous le souhaitez, et envoyez votre demande.",
      },
      {
        title: "Recevez la réponse",
        body: "La professionnelle accepte ou refuse votre demande. Vous êtes prévenue par e-mail.",
      },
    ],
  },
  benefits: {
    clientsTitle: "Pour vous",
    clients: [
      "Tous les soins au même endroit, sans chercher compte par compte.",
      "Le vrai travail de chaque professionnelle, en photos et en vidéos.",
      "Des créneaux réellement disponibles, calculés selon son agenda.",
      "Vos photos d’inspiration restent privées, visibles uniquement par la professionnelle choisie.",
    ],
    prosTitle: "Pour les professionnelles",
    pros: [
      "Un profil soigné pour chaque catégorie, depuis un seul compte.",
      "Demandes, agenda et capacité gérés dans un tableau de bord unique.",
      "Le nombre de visites de vos profils et vos demandes, semaine après semaine.",
      "Un essai gratuit, puis un abonnement mensuel clair.",
    ],
    prosCta: "Rejoindre Woman Cares",
  },
  manifesto: {
    body: "Woman Cares est née d’une idée simple : une femme ne devrait pas avoir à fouiller dix comptes Instagram pour trouver la bonne coiffeuse, la bonne esthéticienne ou un moment de calme.",
    about: "Notre histoire",
  },
  home: {
    intro: {
      title: "Six univers de soin, une seule adresse",
      services: "Nos soins",
      profiles: (n: number) => (n === 1 ? "1 profil" : `${n} profils`),
      search: "Coiffure, ongles, massage…",
      location: "Partout en Algérie",
      write: "Écrivez-nous",
      join: "Rejoindre",
      book: "Réserver",
      all: "Tout explorer",
    },
    why: {
      title: "Pourquoi Woman Cares ?",
      items: [
        { title: "Tout au même endroit", body: "Six univers de soin, chacun avec ses filtres et ses profils. Une recherche remplace dix onglets." },
        { title: "Voir avant de choisir", body: "Réalisations, prestations, durées, prix de départ et horaires, visibles d’un coup d’œil." },
        { title: "Près de chez vous", body: "Par wilaya, par commune ou autour de vous. Votre position n’est jamais enregistrée." },
        { title: "Profils relus", body: "Chaque profil est relu par notre équipe avant publication. Pour le botox, des justificatifs sont exigés." },
      ],
    },
    bento: {
      title: "Choisissez votre univers",
      tabs: { all: "Tous", beauty: "Beauté", wellness: "Bien-être" },
      proTitle: "Vous êtes professionnelle ?",
      proBody: "Présentez votre travail et recevez vos demandes au même endroit.",
      open: "Découvrir",
    },
    spotlight: {
      eyebrow: "Soin à la une",
      specialties: "Spécialités",
      more: "Voir les professionnelles",
    },
  },
  faq: {
    title: "Questions fréquentes",
    items: [
      {
        q: "Faut-il un compte pour voir les professionnelles ?",
        a: "Non. Vous pouvez parcourir les profils librement. Un compte est demandé uniquement pour envoyer une demande de rendez-vous.",
      },
      {
        q: "Le rendez-vous est-il confirmé dès l’envoi ?",
        a: "Non. Votre demande est transmise à la professionnelle, qui l’accepte ou la refuse. Vous recevez sa réponse par e-mail et dans votre espace.",
      },
      {
        q: "Comment se passe le paiement ?",
        a: "Vous réglez la prestation directement auprès de la professionnelle. Le prix affiché est un prix de départ : le prix final peut dépendre de la prestation demandée.",
      },
      {
        q: "Ma position est-elle enregistrée ?",
        a: "Non. La recherche autour de vous n’est lancée que si vous l’autorisez, et la position sert uniquement à trier les résultats.",
      },
      {
        q: "Comment les professionnelles sont-elles vérifiées ?",
        a: "Chaque profil est relu par notre équipe avant publication. Pour les soins réglementés comme le botox, des justificatifs de qualification sont exigés.",
      },
      {
        q: "Je suis professionnelle, combien coûte l’inscription ?",
        a: "L’inscription commence par une période gratuite. Ensuite, un abonnement mensuel s’applique selon les catégories que vous proposez. Les tarifs sont affichés avant toute activation.",
      },
    ],
  },
  proCta: {
    title: "Votre talent mérite d’être vu.",
    body: "Publiez votre travail, recevez des demandes et organisez votre agenda depuis un seul tableau de bord.",
    cta: "Rejoindre Woman Cares",
  },
  footer: {
    tagline: "La plateforme beauté et bien-être pensée pour les femmes en Algérie.",
    explore: "Explorer",
    company: "Woman Cares",
    legal: "Informations",
    contact: "Contact",
    privacy: "Confidentialité",
    terms: "Conditions d’utilisation",
    rights: "Tous droits réservés.",
    services: "Soins",
    write: "Écrivez-nous",
    coverage: "Partout en Algérie, 58 wilayas",
    languages: "Langues",
  },
  common: {
    comingSoon: "Bientôt disponible",
    backHome: "Retour à l’accueil",
    notFoundTitle: "Page introuvable",
    notFoundBody: "Cette page n’existe pas ou a été déplacée.",
  },
};

export type Dictionary = typeof fr;
export default fr;
