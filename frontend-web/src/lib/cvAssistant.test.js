import { describe, expect, it } from 'vitest'
import { normalizeDate, normalizeYear, splitTasks, startsWithVerb, toTask, writeCvLocally } from './cvAssistant.js'

describe('toTask: written the way members write, comes out PNPE-style', () => {
  const cases = [
    ['je recevais les clients', 'Accueillir les clients'],
    ['je faisais la caisse', 'Tenir la caisse'],
    ['je rangeais le stock le soir', 'Ranger le stock le soir'],
    ['je gerais une equipe de 5 personnes', 'Gérer une équipe de 5 personnes'],
    ["j'ai géré les commandes", 'Gérer les commandes'],
    ["J'étais chargée de la saisie des factures", 'Assurer la saisie des factures'],
    ["j'étais chargé de vérifier les stocks", 'Vérifier les stocks'],
    ["j'étais responsable du magasin", 'Gérer le magasin'],
    ["je m'occupais des enfants", 'Prendre en charge les enfants'],
    ["je m'occupais de la caisse", 'Tenir la caisse'],
    ['je devais verifier les stocks chaque matin', 'Vérifier les stocks chaque matin'],
    ['je conduisais le camion de livraison', 'Conduire le camion de livraison'],
    ['on faisait l’inventaire tous les mois', 'Réaliser l’inventaire tous les mois'],
    ['je recevais les marchandises', 'Réceptionner les marchandises'],
    ["j'accueillais les visiteurs", 'Accueillir les visiteurs'],
    ["j'écrivais les rapports de quart", 'Rédiger les rapports de quart'],
    ['je faisais le ménage dans les bureaux', 'Assurer le ménage dans les bureaux'],
    ['je faisais la cuisine', 'Préparer les repas'],
    ["j'aidais à décharger les camions", 'Contribuer à décharger les camions'],
    ["j'aidais le chef cuisinier", 'Assister le chef cuisinier'],
    ['je travaillais comme caissière', 'Occuper le poste de caissière'],
    ["j'allais chercher les colis au port", 'Récupérer les colis au port'],
    ['je vendais des produits cosmetiques', 'Vendre des produits cosmetiques'],
    ['je nettoyais les chambres', 'Nettoyer les chambres'],
    ['je donnais des cours de maths', 'Dispenser des cours de maths'],
    ['nous recevions les patients', 'Accueillir les patients'],
    ['JE RECEVAIS LES CLIENTS', 'Accueillir les clients'],
    ['contrôle des vannes', 'Assurer le contrôle des vannes'],
    ['controle les vannes', 'Contrôler les vannes'],
    ['vente de produits cosmétiques', 'Assurer la vente de produits cosmétiques'],
    ['nettoyage des bureaux', 'Assurer le nettoyage des bureaux'],
    ['accueil des clients', 'Assurer l’accueil des clients'],
    ['livraison des colis', 'Assurer la livraison des colis'],
    ['caisse', 'Tenir la caisse'],
    ['rapports', 'Rédiger les rapports'],
    ['appels telephoniques', 'Répondre aux appels téléphoniques'],
    ['verifier les stocks', 'Vérifier les stocks'],
    ['Livrer les colis aux clients.', 'Livrer les colis aux clients'],
    ['- gère les stocks', 'Gérer les stocks'],
    ['je surveillais les pompes ds le depot', 'Surveiller les pompes dans le dépôt'],
    ['je participais a la mise a jour des dossiers', 'Participer à la mise à jour des dossiers'],
    ['je saisissais les donnees sur excel', 'Saisir les données sur Excel'],
    ['je harmonisais les procedures', 'Harmoniser les procédures'],
  ]
  it.each(cases)('%s → %s', (input, expected) => {
    expect(toTask(input)).toBe(expected)
  })

  it('leaves what it does not understand as typed (capital first)', () => {
    expect(toTask('stage en entreprise')).toBe('Stage en entreprise')
  })
})

describe('splitTasks', () => {
  it('splits on « , je », « et je », lines and full stops', () => {
    expect(splitTasks('je recevais les clients, je faisais la caisse et je rangeais le stock')).toEqual([
      'je recevais les clients',
      'je faisais la caisse',
      'je rangeais le stock',
    ])
    expect(splitTasks('Accueil des clients.\nGestion de la caisse; inventaire')).toEqual(['Accueil des clients', 'Gestion de la caisse', 'inventaire'])
  })
  it('splits a run-on sentence at each « je »', () => {
    expect(splitTasks('je recevais les clients je faisais la caisse')).toEqual(['je recevais les clients', 'je faisais la caisse'])
  })
  it('splits a comma list of tasks, not a list inside one task', () => {
    expect(splitTasks('controle des vannes, rapports')).toEqual(['controle des vannes', 'rapports'])
    expect(splitTasks('vérifier, trier et ranger le stock')).toEqual(['vérifier, trier et ranger le stock'])
  })
})

describe('dates', () => {
  it('normalizes what members type', () => {
    expect(normalizeDate('03/2021')).toBe('Mars 2021')
    expect(normalizeDate('mars 2021')).toBe('Mars 2021')
    expect(normalizeDate('Fevrier 2019')).toBe('Février 2019')
    expect(normalizeDate('aout 2020')).toBe('Août 2020')
    expect(normalizeDate('12-2018')).toBe('Décembre 2018')
    expect(normalizeDate('2017')).toBe('2017')
    expect(normalizeDate('en cours')).toBe("Aujourd'hui")
    expect(normalizeDate('')).toBe('')
    expect(normalizeDate('je sais plus')).toBe('je sais plus')
    expect(normalizeYear('2019-2021')).toBe('2019 – 2021')
    expect(normalizeYear('2021')).toBe('2021')
  })
})

describe('writeCvLocally', () => {
  const form = {
    identite: { nom: 'NDONG Awa', telephones: '+241 77 12 34 56', email: '', numeroPnpe: '', permis: '', ville: '', quartier: '' },
    posteRecherche: 'caissiere',
    offre: '',
    experiences: [
      { poste: 'stagiaire', entreprise: 'total gabon', ville: 'port-gentil', debut: '01/2019', fin: '12/2020', enCours: false, description: 'je surveillais les pompes' },
      { poste: 'caissiere', entreprise: 'Mbolo', ville: 'libreville', debut: 'mars 2021', fin: '', enCours: true, description: 'je recevais les clients, je faisais la caisse, je rangeais le stock le soir' },
      { poste: '', entreprise: '', ville: '', debut: '', fin: '', enCours: false, description: '' },
    ],
    formations: [
      { intitule: 'bac d', etablissement: 'lycee leon mba', annee: '2015' },
      { intitule: 'bts comptabilite', etablissement: 'uob', annee: '2018' },
      { intitule: 'formation hse niveau 1', etablissement: 'cfmp libreville', annee: '' },
    ],
    competences: 'excel, word, gestion de stock et accueil des clients',
    langues: [{ langue: 'francais', niveau: 'maternel' }, { langue: 'fang', niveau: 'courant' }, { langue: '', niveau: 'bon' }],
    texteLibre: '',
  }
  const cv = writeCvLocally(form)

  it('puts experience newest first, with clean names and dates', () => {
    expect(cv.experiences.map((e) => e.entreprise)).toEqual(['Mbolo', 'Total Gabon'])
    expect(cv.experiences[0]).toMatchObject({ debut: 'Mars 2021', fin: "Aujourd'hui", lieu: 'Libreville', poste: 'Caissière' })
    expect(cv.experiences[1]).toMatchObject({ debut: 'Janvier 2019', fin: 'Décembre 2020', lieu: 'Port-Gentil', poste: 'Stagiaire' })
  })

  it('turns descriptions into action-verb tasks', () => {
    expect(cv.experiences[0].taches).toEqual(['Accueillir les clients', 'Tenir la caisse', 'Ranger le stock le soir'])
    expect(cv.experiences[1].taches).toEqual(['Surveiller les pompes'])
  })

  it('separates diplomas from certificates, newest first', () => {
    expect(cv.formations).toEqual([
      { annee: '2018', intitule: 'BTS comptabilité', etablissement: 'Université Omar Bongo (UOB)' },
      { annee: '2015', intitule: 'Bac D', etablissement: 'Lycée Leon Mba' },
    ])
    expect(cv.certifications).toEqual([{ annee: '', intitule: 'Formation HSE niveau 1', etablissement: 'CFMP Libreville' }])
  })

  it('sorts skills and merges Word + Excel into Pack Office', () => {
    expect(cv.competencesTechniques).toEqual(['Pack Office (Excel, Word)'])
    expect(cv.savoirFaire).toEqual(['Gestion de stock', 'Accueil des clients'])
  })

  it('cleans languages', () => {
    expect(cv.langues).toEqual([
      { langue: 'Français', niveau: 'maternel' },
      { langue: 'Fang', niveau: 'courant' },
    ])
  })

  it('gives advice, never more than 5', () => {
    expect(cv.conseils.length).toBeGreaterThan(0)
    expect(cv.conseils.length).toBeLessThanOrEqual(5)
    expect(cv.conseils.some((c) => c.includes('Formation HSE niveau 1'))).toBe(true)
    expect(cv.conseils.some((c) => c.includes('Précisez le poste'))).toBe(true)
  })

  it('never invents: every task comes from the member’s words', () => {
    for (const e of cv.experiences) for (const t of e.taches) expect(startsWithVerb(t)).toBe(true)
    expect(JSON.stringify(cv)).not.toMatch(/\d+ ?%/)
  })

  it('copes with an almost empty form', () => {
    const empty = writeCvLocally({ identite: {}, posteRecherche: '', experiences: [], formations: [], competences: '', langues: [] })
    expect(empty.experiences).toEqual([])
    expect(empty.conseils.length).toBeGreaterThan(0)
  })
})
