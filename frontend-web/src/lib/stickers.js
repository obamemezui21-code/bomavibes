// Static registry of bundled chat stickers. Referenced in Firestore
// messages by stable `id`, never by the built asset URL — Vite content-
// hashes asset filenames on every build, so a URL saved today would 404
// after the next deploy. Each client resolves `id` -> current asset via
// this map instead, so old messages keep working across deploys.
//
// To add a sticker: drop a transparent PNG in assets/stickers/, import it
// below, and add one entry to STICKERS.

import emoji3d1 from '../assets/stickers/emoji3d-1.png'
import emoji3d2 from '../assets/stickers/emoji3d-2.png'
import emoji3d3 from '../assets/stickers/emoji3d-3.png'
import laugh1 from '../assets/stickers/laugh-1.png'
import laugh2 from '../assets/stickers/laugh-2.png'
import laugh3 from '../assets/stickers/laugh-3.png'
import senior1 from '../assets/stickers/senior-1.png'
import senior2 from '../assets/stickers/senior-2.png'
import senior3 from '../assets/stickers/senior-3.png'
import senior4 from '../assets/stickers/senior-4.png'
import senior5 from '../assets/stickers/senior-5.png'
import senior6 from '../assets/stickers/senior-6.png'
import senior7 from '../assets/stickers/senior-7.png'
import senior8 from '../assets/stickers/senior-8.png'
import senior9 from '../assets/stickers/senior-9.png'
import senior10 from '../assets/stickers/senior-10.png'
import senior11 from '../assets/stickers/senior-11.png'
import senior12 from '../assets/stickers/senior-12.png'
import senior13 from '../assets/stickers/senior-13.png'
import senior14 from '../assets/stickers/senior-14.png'
import senior15 from '../assets/stickers/senior-15.png'
import senior16 from '../assets/stickers/senior-16.png'
import biceps1 from '../assets/stickers/biceps-1.png'
import biceps2 from '../assets/stickers/biceps-2.png'
import biceps3 from '../assets/stickers/biceps-3.png'
import biceps4 from '../assets/stickers/biceps-4.png'
import biceps5 from '../assets/stickers/biceps-5.png'
import biceps6 from '../assets/stickers/biceps-6.png'
import rapper from '../assets/stickers/rapper.png'
import surprisedGirl from '../assets/stickers/surprised-girl.png'

export const STICKERS = [
  { id: 'emoji3d-1', src: emoji3d1 },
  { id: 'emoji3d-2', src: emoji3d2 },
  { id: 'emoji3d-3', src: emoji3d3 },
  { id: 'laugh-1', src: laugh1 },
  { id: 'laugh-2', src: laugh2 },
  { id: 'laugh-3', src: laugh3 },
  { id: 'senior-1', src: senior1 },
  { id: 'senior-2', src: senior2 },
  { id: 'senior-3', src: senior3 },
  { id: 'senior-4', src: senior4 },
  { id: 'senior-5', src: senior5 },
  { id: 'senior-6', src: senior6 },
  { id: 'senior-7', src: senior7 },
  { id: 'senior-8', src: senior8 },
  { id: 'senior-9', src: senior9 },
  { id: 'senior-10', src: senior10 },
  { id: 'senior-11', src: senior11 },
  { id: 'senior-12', src: senior12 },
  { id: 'senior-13', src: senior13 },
  { id: 'senior-14', src: senior14 },
  { id: 'senior-15', src: senior15 },
  { id: 'senior-16', src: senior16 },
  { id: 'biceps-1', src: biceps1 },
  { id: 'biceps-2', src: biceps2 },
  { id: 'biceps-3', src: biceps3 },
  { id: 'biceps-4', src: biceps4 },
  { id: 'biceps-5', src: biceps5 },
  { id: 'biceps-6', src: biceps6 },
  { id: 'rapper', src: rapper },
  { id: 'surprised-girl', src: surprisedGirl },
]

const BY_ID = Object.fromEntries(STICKERS.map((s) => [s.id, s.src]))

export function stickerSrc(id) {
  return BY_ID[id] || null
}
