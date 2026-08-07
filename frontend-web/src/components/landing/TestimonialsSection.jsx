import { motion } from 'framer-motion'
import { Quote } from 'lucide-react'
import amaraPhoto from '../../assets/faces/amara.jpg'
import kwamePhoto from '../../assets/faces/kwame.jpg'
import zolaPhoto from '../../assets/faces/zola.jpg'

// Placeholder testimonials, structured to be swapped for real ones as soon
// as they're available — just replace this array, nothing else to touch.
const TESTIMONIALS = [
  {
    photo: amaraPhoto,
    name: 'Amara',
    detail: '27 ans, Libreville',
    quote: "Le profil détaillé m'a permis de trouver quelqu'un qui partage vraiment mes centres d'intérêt, pas juste une photo qui plaît.",
  },
  {
    photo: kwamePhoto,
    name: 'Kwame',
    detail: '31 ans, Douala',
    quote: "Enfin une appli qui comprend nos réalités. La messagerie vocale change tout pour vraiment sentir une connexion avant de se rencontrer.",
  },
  {
    photo: zolaPhoto,
    name: 'Zola',
    detail: '25 ans, Dakar',
    quote: "Je me suis sentie en sécurité dès le début : signalement, blocage, profils vérifiés. C'est ce qui manquait ailleurs.",
  },
]

function TestimonialsSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-10">
      <div className="text-center">
        <h2 className="font-display text-4xl font-bold text-[#2B1D14] sm:text-5xl">Ce qu'on en dit</h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-[#6b5d4f]">
          Des rencontres authentiques, racontées par la communauté.
        </p>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {TESTIMONIALS.map((t, i) => (
          <motion.div
            key={t.name}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-30px' }}
            transition={{ duration: 0.45, delay: i * 0.08, ease: 'easeOut' }}
            className="rounded-3xl border border-violet-600/8 bg-white p-7 shadow-sm"
          >
            <Quote size={24} strokeWidth={2} className="text-pink-500/40" />
            <p className="mt-3 text-sm leading-relaxed text-[#2B1D14]">{t.quote}</p>
            <div className="mt-5 flex items-center gap-3">
              <img src={t.photo} alt="" className="h-10 w-10 rounded-full object-cover" />
              <div>
                <p className="text-sm font-semibold text-[#2B1D14]">{t.name}</p>
                <p className="text-xs text-ink-soft/60">{t.detail}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

export default TestimonialsSection
