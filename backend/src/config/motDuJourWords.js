// LE MOT DU JOUR — the words to find, one per day (see motDuJourController.js).
// Server only: never import this from the app, or the answers ship with it.
//
//   word:  as displayed once found (accents allowed); 5 to 8 letters once
//          accents and hyphens are dropped (shared/mot-du-jour/engine.mjs)
//   hint:  the category shown from the start
//   fact:  the anecdote revealed at the end of the game
//
// Adding a word is safe: a day's word is fixed the first time someone opens
// the game that day (motDuJourDays/{day}), so editing the list never changes
// a word already in play.
const WORDS = [
    { word: "Okoumé", hint: "Nature", fact: "L’okoumé est l’arbre emblème du Gabon. Son bois léger sert surtout à fabriquer du contreplaqué, et le pays en est le premier producteur au monde." },
    { word: "Mbolo", hint: "Langue fang", fact: "« Mbolo » veut dire bonjour en fang. C’est aussi le nom d’un centre commercial bien connu de Libreville." },
    { word: "Akiba", hint: "Langue fang", fact: "« Akiba » veut dire merci en fang. Akiba d’avoir joué !" },
    { word: "Songo", hint: "Jeu", fact: "Le songo est un jeu de semailles fang, cousin de l’awalé, qui se joue sur deux rangées de sept cases. Un vrai jeu de stratégie !" },
    { word: "Ogooué", hint: "Géographie", fact: "L’Ogooué est le plus long fleuve du Gabon : il traverse presque tout le pays avant de rejoindre l’océan Atlantique près de Port-Gentil." },
    { word: "Gabon", hint: "Pays", fact: "Le nom Gabon viendrait du portugais « gabão », un manteau à capuche : les navigateurs trouvaient que l’estuaire du Komo en avait la forme." },
    { word: "Nyanga", hint: "Géographie", fact: "La Nyanga est la province la plus au sud du Gabon. Son chef-lieu est Tchibanga." },
    { word: "Ngounié", hint: "Géographie", fact: "La Ngounié est à la fois une rivière et une province du Gabon, dont le chef-lieu est Mouila." },
    { word: "Mouila", hint: "Ville", fact: "Mouila est le chef-lieu de la Ngounié, connue pour le lac Bleu tout proche." },
    { word: "Masuku", hint: "Ville", fact: "Masuku est l’ancien nom de Franceville, chef-lieu du Haut-Ogooué. On l’entend encore souvent aujourd’hui." },
    { word: "Makokou", hint: "Ville", fact: "Makokou est le chef-lieu de l’Ogooué-Ivindo, porte d’entrée de l’une des forêts les plus sauvages du pays." },
    { word: "Owendo", hint: "Ville", fact: "Owendo, au sud de Libreville, abrite le grand port du Gabon et le terminus du Transgabonais." },
    { word: "Mayumba", hint: "Ville", fact: "Mayumba, sur la côte sud, est célèbre pour ses plages où viennent pondre les tortues marines." },
    { word: "Ivindo", hint: "Nature", fact: "L’Ivindo est une rivière du nord-est du Gabon. Son parc national abrite les spectaculaires chutes de Kongou." },
    { word: "Loango", hint: "Nature", fact: "Au parc national de Loango, on peut voir des éléphants, des buffles et même des hippopotames se promener sur la plage." },
    { word: "Pongara", hint: "Nature", fact: "Le parc national de Pongara, juste en face de Libreville, accueille chaque année les tortues luth qui viennent pondre." },
    { word: "Akanda", hint: "Nature", fact: "Le parc national d’Akanda, au nord de Libreville, protège de grandes mangroves où se nourrissent des milliers d’oiseaux." },
    { word: "Forêt", hint: "Nature", fact: "La forêt couvre près de 85 % du Gabon, ce qui en fait l’un des pays les plus boisés de la planète." },
    { word: "Équateur", hint: "Géographie", fact: "L’équateur traverse le Gabon : on peut passer d’un hémisphère à l’autre sans quitter le pays." },
    { word: "Lagune", hint: "Nature", fact: "La lagune Fernan-Vaz, au sud de Port-Gentil, est entourée de forêts, de villages et de missions historiques." },
    { word: "Gorille", hint: "Faune", fact: "Les forêts du Gabon abritent de nombreux gorilles des plaines de l’Ouest, une espèce protégée." },
    { word: "Éléphant", hint: "Faune", fact: "Le Gabon abrite une grande partie des éléphants de forêt d’Afrique, plus petits que ceux de la savane." },
    { word: "Mandrill", hint: "Faune", fact: "Le mandrill, avec son museau rouge et bleu, vit en très grands groupes, notamment dans le parc de la Lopé." },
    { word: "Tortue", hint: "Faune", fact: "Les plages du Gabon sont l’un des plus grands sites de ponte au monde pour la tortue luth." },
    { word: "Baleine", hint: "Faune", fact: "Chaque année, entre juillet et septembre environ, les baleines à bosse passent au large des côtes gabonaises." },
    { word: "Manioc", hint: "Cuisine", fact: "Le manioc est partout dans la cuisine gabonaise : en bâton, en feuilles ou en farine." },
    { word: "Nyembwe", hint: "Cuisine", fact: "Le nyembwe est une sauce à base de noix de palme. Le poulet nyembwe est considéré comme le plat national du Gabon." },
    { word: "Odika", hint: "Cuisine", fact: "L’odika, parfois appelé « chocolat indigène », est une pâte de graines de mangue sauvage qui donne leur goût à de nombreuses sauces." },
    { word: "Atanga", hint: "Cuisine", fact: "L’atanga, ou safou, est un fruit violet qu’on mange cuit, souvent avec du bâton de manioc. La saison de l’atanga est une fête !" },
    { word: "Piment", hint: "Cuisine", fact: "Au Gabon, pas de bon repas sans un peu de piment à côté… à doser selon son courage !" },
    { word: "Bwiti", hint: "Culture", fact: "Le Bwiti est une tradition spirituelle et initiatique du Gabon, rythmée par des chants, des danses et la harpe ngombi." },
    { word: "Ngombi", hint: "Musique", fact: "Le ngombi est une harpe traditionnelle du Gabon, jouée notamment lors des cérémonies du Bwiti." },
    { word: "Masque", hint: "Art", fact: "Les masques blancs punu, au visage paisible, sont parmi les œuvres d’art du Gabon les plus célèbres au monde." },
    { word: "Pirogue", hint: "Transport", fact: "Sur l’Ogooué et les lagunes, la pirogue reste un moyen de transport essentiel pour de nombreux villages." },
    { word: "Clando", hint: "Expression", fact: "Le « clando », c’est le taxi clandestin qui dessert les coins où les taxis officiels ne vont pas." },
    { word: "Kongossa", hint: "Expression", fact: "Le « kongossa », ce sont les ragots, les commérages. Sur BomaVibes, on préfère les vraies rencontres 😉" },
    { word: "Mapane", hint: "Expression", fact: "Les « mapanes », ce sont les quartiers populaires, souvent construits de façon informelle, de Libreville et d’ailleurs." },
    { word: "Makaya", hint: "Expression", fact: "« Makaya », c’est le Gabonais ordinaire, monsieur tout-le-monde. On est tous un peu makaya !" },
    { word: "Amour", hint: "BomaVibes", fact: "Bienvenue sur BomaVibes, l’endroit pour trouver l’amour… ou au moins une belle vibe 💜" },
    { word: "Crush", hint: "BomaVibes", fact: "Ton crush est peut-être déjà sur BomaVibes. Va faire un tour dans Découvrir !" },
    { word: "Bisou", hint: "BomaVibes", fact: "Un premier rendez-vous en vue ? Les Coins Chics de BomaVibes regorgent d’idées de lieux à Libreville." },
]

module.exports = { WORDS }
