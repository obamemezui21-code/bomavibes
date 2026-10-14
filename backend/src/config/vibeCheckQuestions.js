// VIBE CHECK — the "ceci ou cela" questions (see vibeCheckController.js).
// Each day everyone answers the same QUESTIONS_PER_DAY of them, walked in
// order through the list; answers are kept per question id, so a question
// coming back later simply refreshes the answer.
//
//   id:      never change or reuse one (stored answers point to it)
//   weight:  2 for what really matters in a couple, counted double in the vibe %
//   a / b:   the two choices, emoji first
const QUESTIONS = [
    { id: "date1", text: "Premier rendez-vous ?", a: "🍢 Maquis & brochettes", b: "🍷 Restaurant chic" },
    { id: "kids1", text: "Fonder une famille ?", a: "👶 Dans les 2-3 ans", b: "⏳ Pas pressé·e", weight: 2 },
    { id: "weekend", text: "Ton week-end idéal ?", a: "🏖️ Pointe-Denis", b: "🎶 Soirée à Louis" },
    { id: "talk", text: "Pour se parler ?", a: "🎙️ Des vocaux", b: "✍️ Des messages écrits" },
    { id: "fight", text: "Pendant une dispute ?", a: "🗣️ On en parle tout de suite", b: "🧊 On laisse refroidir", weight: 2 },
    { id: "money", text: "L’argent dans le couple ?", a: "🤝 Tout en commun", b: "💼 Chacun son compte", weight: 2 },
    { id: "faith", text: "La foi dans le couple ?", a: "🙏 Essentielle", b: "🕊️ Pas indispensable", weight: 2 },
    { id: "dowry", text: "La dot, pour toi ?", a: "💍 Incontournable", b: "🤷 À discuter", weight: 2 },

    { id: "live", text: "Construire ta vie ?", a: "🇬🇦 Au Gabon, toujours", b: "✈️ Partout dans le monde", weight: 2 },
    { id: "morning", text: "Plutôt ?", a: "🌅 Lève-tôt", b: "🌙 Couche-tard" },
    { id: "food", text: "Ce soir on mange ?", a: "🍲 Un nyembwe maison", b: "🍔 Un fast-food" },
    { id: "party", text: "En soirée ?", a: "💃 Je danse toute la nuit", b: "🛋️ Je profite tranquille" },
    { id: "social", text: "Les réseaux sociaux ?", a: "📸 Je poste tout", b: "🙈 Je reste discret·e" },
    { id: "couplepub", text: "Ton couple sur les réseaux ?", a: "💑 On s’affiche", b: "🤫 On reste discrets" },
    { id: "outings", text: "Les sorties ?", a: "👯 En groupe", b: "👫 En tête-à-tête" },
    { id: "holiday", text: "En vacances ?", a: "🌴 Plage et repos", b: "🧭 Aventure et découverte" },

    { id: "sport", text: "Le sport ?", a: "🏃 Tous les jours", b: "😴 Quand j’ai le temps" },
    { id: "inlaws", text: "La belle-famille ?", a: "🏠 Très présente", b: "🚪 Chacun chez soi", weight: 2 },
    { id: "chores", text: "Les tâches à la maison ?", a: "⚖️ Moitié-moitié", b: "🧩 Chacun ses points forts", weight: 2 },
    { id: "music", text: "En voiture, on écoute ?", a: "🇬🇦 De l’afro et du 241", b: "🌍 Un peu de tout" },
    { id: "gift", text: "Un cadeau ?", a: "🎁 Une surprise", b: "💬 Ce dont j’ai vraiment besoin" },
    { id: "pets", text: "Un animal à la maison ?", a: "🐶 Avec plaisir", b: "🚫 Pas pour moi" },
    { id: "jealous", text: "Un peu de jalousie ?", a: "🔥 Ça montre qu’on tient à l’autre", b: "🧊 Pas du tout pour moi", weight: 2 },
    { id: "love", text: "L’amour, chez toi ?", a: "⚡ Coup de foudre", b: "🌱 Ça se construit" },

    { id: "marriage", text: "Le mariage ?", a: "💒 Un vrai objectif", b: "🤍 Pas obligatoire", weight: 2 },
    { id: "sunday", text: "Le dimanche ?", a: "👨‍👩‍👧 Repas en famille", b: "🛋️ Repos à deux" },
    { id: "movie", text: "Ce soir, un film ?", a: "😂 Une comédie", b: "😱 Un thriller" },
    { id: "phone", text: "Ton téléphone ?", a: "📱 Toujours à la main", b: "🔕 Je le laisse de côté" },
    { id: "friends", text: "Les amis de l’autre ?", a: "🤗 Deviennent mes amis", b: "👋 Chacun ses amis" },
    { id: "afterwork", text: "Après le travail ?", a: "🍻 On sort", b: "🏠 On rentre" },
    { id: "plans", text: "Les projets ?", a: "📅 Tout planifier", b: "🎲 Au feeling" },
    { id: "ambition", text: "En ce moment, la priorité ?", a: "🚀 La carrière", b: "❤️ La famille", weight: 2 },

    { id: "business", text: "Ton rêve pro ?", a: "💡 Mon propre business", b: "🏢 Un bon poste stable" },
    { id: "nicknames", text: "Les petits noms ?", a: "🥰 Bébé, chéri·e…", b: "🙂 Mon prénom suffit" },
    { id: "bill", text: "L’addition au restaurant ?", a: "🙋 C’est celui qui invite", b: "➗ On partage" },
    { id: "style", text: "Ton style ?", a: "👔 Toujours sapé·e", b: "👕 Simple et confort" },
    { id: "cook", text: "À la maison ?", a: "👩‍🍳 Je cuisine", b: "🛵 Je commande" },
    { id: "travel", text: "Voyager ?", a: "✈️ Le plus souvent possible", b: "🏡 J’aime être chez moi" },
    { id: "language", text: "Ta langue au quotidien ?", a: "🗣️ Ma langue maternelle aussi", b: "🇫🇷 Surtout le français" },
    { id: "parties", text: "Les fêtes ?", a: "🎉 Grande fête, tout le quartier", b: "🕯️ Petit comité" },

    { id: "football", text: "Les Panthères jouent ce soir ?", a: "⚽ Je suis devant l’écran !", b: "🤷 Pas mon truc" },
    { id: "past", text: "Le passé amoureux ?", a: "📖 On se dit tout", b: "🔒 Le passé reste au passé", weight: 2 },
    { id: "kids2", text: "Une famille…", a: "👨‍👩‍👧‍👦 Nombreuse", b: "👨‍👩‍👧 Deux enfants ou moins", weight: 2 },
    { id: "mood", text: "Ton caractère ?", a: "😄 Toujours la joie", b: "🧘 Calme et posé·e" },
    { id: "distance", text: "Une relation à distance ?", a: "💌 Ça peut marcher", b: "📍 Il faut être proches", weight: 2 },
    { id: "commit", text: "Avant de s’engager ?", a: "🗓️ Prendre son temps", b: "💨 Si c’est la bonne personne, on fonce" },
    { id: "read", text: "Pour te détendre ?", a: "📚 Un bon livre", b: "🎧 Podcasts et vidéos" },
    { id: "goodnight", text: "Le message de bonne nuit ?", a: "🌙 Obligatoire", b: "😅 Pas besoin" },
];

const QUESTIONS_PER_DAY = 8;

module.exports = { QUESTIONS, QUESTIONS_PER_DAY };
