// BOMA FIGHT — each fighter's portrait and cut-out (both from the roster picture) and the stages.
import nzeang from '../../assets/game/fight/nzeang.webp'
import bikoulou from '../../assets/game/fight/bikoulou.webp'
import ondo from '../../assets/game/fight/ondo.webp'
import amissa from '../../assets/game/fight/amissa.webp'
import mebale from '../../assets/game/fight/mebale.webp'
import luku from '../../assets/game/fight/luku.webp'
import kassa from '../../assets/game/fight/kassa.webp'
import nzame from '../../assets/game/fight/nzame.webp'
import obame from '../../assets/game/fight/obame.webp'
import sally from '../../assets/game/fight/sally.webp'
import biyogo from '../../assets/game/fight/biyogo.webp'
import essono from '../../assets/game/fight/essono.webp'
import nzeangSprite from '../../assets/game/fight/sprites/nzeang.webp'
import bikoulouSprite from '../../assets/game/fight/sprites/bikoulou.webp'
import ondoSprite from '../../assets/game/fight/sprites/ondo.webp'
import amissaSprite from '../../assets/game/fight/sprites/amissa.webp'
import mebaleSprite from '../../assets/game/fight/sprites/mebale.webp'
import lukuSprite from '../../assets/game/fight/sprites/luku.webp'
import kassaSprite from '../../assets/game/fight/sprites/kassa.webp'
import nzameSprite from '../../assets/game/fight/sprites/nzame.webp'
import obameSprite from '../../assets/game/fight/sprites/obame.webp'
import sallySprite from '../../assets/game/fight/sprites/sally.webp'
import biyogoSprite from '../../assets/game/fight/sprites/biyogo.webp'
import essonoSprite from '../../assets/game/fight/sprites/essono.webp'
import corniche from '../../assets/game/fight/stage-corniche.webp'
import libreville from '../../assets/game/fight/stage-libreville.webp'

export const PORTRAITS = { nzeang, bikoulou, ondo, amissa, mebale, luku, kassa, nzame, obame, sally, biyogo, essono }

// The warriors cut out of the roster picture, as drawn in the fight (renderer.js).
export const SPRITES = {
  nzeang: nzeangSprite,
  bikoulou: bikoulouSprite,
  ondo: ondoSprite,
  amissa: amissaSprite,
  mebale: mebaleSprite,
  luku: lukuSprite,
  kassa: kassaSprite,
  nzame: nzameSprite,
  obame: obameSprite,
  sally: sallySprite,
  biyogo: biyogoSprite,
  essono: essonoSprite,
}

export const STAGES = [
  { id: 'corniche', name: 'La corniche au couchant', picture: corniche },
  { id: 'libreville', name: 'Front de mer de Libreville', picture: libreville },
]
