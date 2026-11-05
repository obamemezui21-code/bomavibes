import { useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { claimReferral } from '../firebase/referrals.js'
import { clearReferral, pendingReferral } from '../lib/referral.js'

// Once a visitor who came through an invitation has an account, tells the
// server who invited them. Any answer from the server settles it; a network
// failure leaves the code for the next visit.
function ReferralClaim() {
  const { user } = useAuth()
  const sent = useRef(false)

  useEffect(() => {
    const code = pendingReferral()
    if (!user?.id || !code || sent.current) return
    sent.current = true
    claimReferral(code)
      .then(clearReferral)
      .catch((err) => {
        if (err.status && err.status < 500) clearReferral()
      })
  }, [user?.id])

  return null
}

export default ReferralClaim
