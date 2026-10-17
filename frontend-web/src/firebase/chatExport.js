import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from './config.js'

// Every message of a conversation, oldest first — the chat itself only
// keeps the latest pages loaded, the export needs them all.
export async function fetchAllMessages(matchId) {
  const snap = await getDocs(query(collection(db, 'matches', matchId, 'messages'), orderBy('createdAt', 'asc')))
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      senderId: data.senderId,
      type: data.type || 'text',
      text: data.text || '',
      about: data.about || null,
      fileUrl: data.fileUrl || null,
      fileName: data.fileName || null,
      audioUrl: data.audioUrl || null,
      stickerUrl: data.stickerUrl || null,
      location: data.location || null,
      venue: data.venue || null,
      call: data.call || null,
      challenge: data.challenge || null,
      edited: !!data.editedAt,
      date: data.createdAt?.toDate?.() ?? new Date(),
    }
  })
}
