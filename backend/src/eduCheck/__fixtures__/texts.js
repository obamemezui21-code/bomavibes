// Test texts for EDU-CHECK (engine.test.js). Written for the tests: the
// "generated" one imitates the usual style of a language model, the others
// imitate students. They check how the module behaves, not how well it
// detects anything: a handful of texts proves nothing statistically.

const natural = `Le téléphone portable à l'école, je pense que c'est un vrai sujet. Chez nous au lycée, la règle a changé l'an dernier et franchement tout le monde n'était pas d'accord.

Au début j'étais contre. On l'utilise pour tout : réviser avec des applis, appeler les parents quand le bus ne passe pas, prendre en photo le tableau quand le prof efface trop vite. Ma cousine à Port-Gentil m'a dit que chez eux c'est interdit depuis deux ans et qu'ils se débrouillent très bien. Bon.

Mais il faut être honnête. En classe, beaucoup regardent leurs messages sous la table. Moi aussi ça m'est arrivé, surtout en maths quand je comprenais rien. Le prof de physique a fait un test : une semaine sans téléphone, une semaine avec. Les notes du petit contrôle étaient meilleures la semaine sans, pas énormément, mais quand même.

Alors je dirais qu'il faut des règles mais pas une interdiction totale. Par exemple le garder dans le sac pendant le cours, et pouvoir le sortir à la récré ou pour un exercice précis. Est-ce que ça marcherait ? Je ne sais pas trop, ça dépend des élèves et des profs.

Pour finir, je crois que le problème c'est pas l'objet, c'est comment on s'en sert. Si on apprend à l'utiliser bien, ça peut aider. Sinon ça distrait, c'est sûr, et là il vaut mieux le ranger.`

const generated = `Dans un monde en constante évolution, la question de l'utilisation du téléphone portable à l'école constitue un enjeu majeur pour l'ensemble de la communauté éducative. Il est important de noter que cet outil joue un rôle crucial dans la vie quotidienne des élèves. Il convient de souligner que son usage soulève de nombreuses interrogations.

Tout d'abord, le téléphone portable représente un véritable levier pour l'apprentissage. Il permet aux élèves d'accéder rapidement à une multitude de ressources éducatives. Il favorise également le développement de compétences numériques essentielles. Il offre ainsi de nouvelles perspectives pédagogiques aux enseignants.

De plus, il est essentiel de souligner que le téléphone peut renforcer le lien entre l'école et les familles. Il permet une communication rapide et efficace en cas de besoin. Il contribue ainsi à la sécurité et au bien-être des élèves. Il joue un rôle clé dans l'organisation de la vie scolaire.

Par ailleurs, il convient de noter que le téléphone portable présente également certains risques. Il peut constituer une source de distraction importante pendant les cours. Il peut également favoriser des comportements inappropriés comme le cyberharcèlement. Il est donc nécessaire d'encadrer son usage de manière significative.

Enfin, il est crucial de trouver un équilibre entre les avantages et les inconvénients de cet outil. Il s'agit de mettre en place des règles claires et adaptées. Il s'agit également de sensibiliser les élèves à un usage responsable. Il s'agit enfin d'impliquer l'ensemble des acteurs de la communauté éducative.

En conclusion, le téléphone portable à l'école constitue un enjeu majeur qui ouvre la voie à de nouvelles pratiques pédagogiques. Il est important de noter qu'une approche équilibrée permet de mieux comprendre ses effets. En somme, il joue un rôle crucial dans l'éducation de demain.`

// The natural text, smoothed by a corrector: same ideas, cleaner form.
const corrected = `Le téléphone portable à l'école est, à mon avis, un vrai sujet. Dans notre lycée, la règle a changé l'an dernier, et tout le monde n'était pas d'accord.

Au début, j'étais contre. Nous l'utilisons pour tout : réviser avec des applications, appeler nos parents quand le bus ne passe pas, photographier le tableau quand le professeur efface trop vite. Ma cousine, à Port-Gentil, m'a expliqué que son établissement l'interdit depuis deux ans et que les élèves s'en sortent très bien.

Il faut pourtant être honnête. En classe, beaucoup d'élèves regardent leurs messages sous la table. Cela m'est arrivé aussi, surtout en mathématiques, quand je ne comprenais pas. Notre professeur de physique a fait un test : une semaine sans téléphone, puis une semaine avec. Les résultats du contrôle ont été meilleurs la semaine sans, de peu, mais nettement.

Je pense donc qu'il faut des règles plutôt qu'une interdiction totale. Par exemple, le garder dans le sac pendant le cours et pouvoir le sortir à la récréation ou pour un exercice précis. Cela fonctionnerait-il ? Je ne sais pas, car cela dépend des élèves et des enseignants.

Pour conclure, le problème n'est pas l'objet, mais la façon de s'en servir. Bien utilisé, il peut aider ; mal utilisé, il distrait, et il vaut alors mieux le ranger.`

// The generated text, heavily reworded by hand.
const reworded = `Le portable en classe, voilà un débat qui revient sans cesse. Certains y voient une aide, d'autres une catastrophe.

Côté positif, on a tout dans la poche : des cours en vidéo, des dictionnaires, des exercices. Un élève qui bloque peut chercher tout de suite au lieu d'attendre le prochain cours. Et les parents ? Ils sont rassurés de pouvoir joindre leur enfant, surtout quand les trajets sont longs.

Seulement voilà, la tentation est permanente. Une notification, et la concentration s'envole. Les enseignants le constatent tous les jours, et certains établissements ont fini par tout interdire. Le harcèlement en ligne, lui, ne s'arrête pas aux portes du lycée.

Faut-il interdire ou encadrer ? Je penche pour la seconde option : des moments précis où il est permis, le reste du temps rangé. Encore faut-il que tout le monde joue le jeu, adultes compris.

Bref, l'outil n'est ni bon ni mauvais. Tout dépend de ce qu'on en fait, et c'est peut-être ça qu'il faudrait apprendre en premier.`

const short = `Le téléphone à l'école peut aider à réviser mais il distrait beaucoup les élèves. Il faudrait des règles claires. Je pense qu'on peut le garder dans le sac pendant les cours et le sortir seulement à la pause.`

const academic = `Introduction

La régulation de l'usage du téléphone portable en milieu scolaire constitue un objet de recherche récent en sciences de l'éducation. Plusieurs travaux ont examiné ses effets sur l'attention (Dupont, 2019) et sur les résultats scolaires (Martin et Leroy, 2021). Nous proposons d'analyser ces résultats à la lumière du contexte gabonais, où l'équipement des lycéens progresse rapidement.

Dans un premier temps, nous examinerons les effets cognitifs documentés. Les études expérimentales montrent une baisse moyenne de 6 % des performances en mémorisation lorsque le téléphone est visible sur la table, même éteint (Dupont, 2019). Ce résultat est toutefois discuté, car les échantillons restent limités et majoritairement européens.

Dans un second temps, nous analyserons les politiques d'établissement. Les interdictions totales réduisent les distractions, mais elles privent les enseignants d'un outil pédagogique utile, notamment pour la recherche documentaire (Martin et Leroy, 2021). Les règlements intermédiaires, qui autorisent l'usage à des moments définis, semblent offrir un compromis acceptable selon les enquêtes menées auprès des équipes.

Enfin, nous discuterons des limites de ces travaux. Les mesures portent souvent sur des périodes courtes, et peu d'études concernent l'Afrique centrale. Comme le souligne Ndong, « les politiques importées sans adaptation locale produisent des effets contrastés selon les établissements » (Ndong, 2020, p. 45).

Conclusion

Les résultats disponibles plaident pour une régulation encadrée plutôt que pour une interdiction totale. Des recherches menées dans les lycées gabonais permettraient de préciser ces conclusions.

Bibliographie

Dupont, J. (2019). Attention et objets connectés en classe. Revue française de pédagogie, 12(3), 45-60.
Martin, A. et Leroy, P. (2021). Politiques scolaires et usages numériques. Paris : Éditions Universitaires.
Ndong, M. (2020). L'école gabonaise face au numérique. Libreville : Presses de l'Université Omar Bongo.`

const withErrors = `aujourd hui le téléphone portable est partout,et les élèves l'utilisent tout le temps . Malgrés les règles beaucoup l'utilisent en classe et sa pose un problème.

Parmis les avantages il y a le fait de pouvoir apeller ses parents. Quelque soit la situation c'est utile. Mais au jour d'aujourd'hui les jeunes passent trop de temps dessus et sa les empêchent de se concentrer en cour.

Les professeurs se plaignent beaucoup. Il faut que on peut trouver une solution. Si j'aurais le choix je laisserais le téléphone mais avec des règles. Il faut dévelloper le sens des responsabilités chez les élèves!!

la plupart des élèves est d'accord pour des règles mais pas pour une interdiction totale . Les parents aussi pense ça. Donc il faut trouver un compromis entre tout le monde le le plus vite possible.`

const fakeReferences = `Les effets du téléphone sur la concentration des élèves ont été largement étudiés. Selon une étude célèbre, « les élèves exposés à leur téléphone perdent jusqu'à quarante pour cent de leur capacité d'attention en classe ». Cette idée est reprise par Kouassi (2018) et par de nombreux chercheurs.

D'autres travaux montrent au contraire que le téléphone peut améliorer les résultats (Bernard, 2022). Le rapport officiel du ministère va dans le même sens (Moussavou, 2017).

Il est donc difficile de conclure, et chaque établissement doit adapter sa politique à ses élèves, à ses moyens et à son projet pédagogique. Les enseignants interrogés demandent surtout des règles claires et partagées par tous.

Bibliographie

Bernard, L. (2021). Le smartphone, meilleur ami de l'élève connecté du vingt-et-unième siècle numérique. Journal imaginaire des sciences éducatives, 4(2), 1-20. https://doi.org/10.9999/fausse.reference.2021
Moussavou, P. Rapport sur le numérique.
https://exemple-blog-education.com/telephone-ecole`

module.exports = { natural, generated, corrected, reworded, short, academic, withErrors, fakeReferences };
