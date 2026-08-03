import { useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import SplashScreen from './components/SplashScreen.jsx'
import Landing from './pages/Landing.jsx'
import Events from './pages/Events.jsx'
import PrivacyPolicy from './pages/PrivacyPolicy.jsx'
import Terms from './pages/Terms.jsx'
import LegalNotice from './pages/LegalNotice.jsx'
import Safety from './pages/Safety.jsx'
import Pricing from './pages/Pricing.jsx'
import Welcome from './pages/Welcome.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import VerifyEmail from './pages/VerifyEmail.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import AuthAction from './pages/AuthAction.jsx'
import Discover from './pages/Discover.jsx'
import Matches from './pages/Matches.jsx'
import Chat from './pages/Chat.jsx'
import Profile from './pages/Profile.jsx'
import Settings from './pages/Settings.jsx'
import Onboarding from './pages/Onboarding.jsx'
import AppLayout from './layouts/AppLayout.jsx'
import RequireAuth from './components/RequireAuth.jsx'

function App() {
  const [showSplash, setShowSplash] = useState(true)

  return (
    <>
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/evenements" element={<Events />} />
        <Route path="/confidentialite" element={<PrivacyPolicy />} />
        <Route path="/conditions" element={<Terms />} />
        <Route path="/mentions-legales" element={<LegalNotice />} />
        <Route path="/securite" element={<Safety />} />
        <Route path="/premium" element={<Pricing />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/action" element={<AuthAction />} />
        <Route
          path="/verify-email"
          element={
            <RequireAuth requireVerified={false}>
              <VerifyEmail />
            </RequireAuth>
          }
        />
        <Route
          path="/onboarding"
          element={
            <RequireAuth>
              <Onboarding />
            </RequireAuth>
          }
        />

        <Route
          element={
            <RequireAuth requireOnboarded>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/discover" element={<Discover />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/chat/:conversationId" element={<Chat />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </>
  )
}

export default App
