import { lazy, Suspense, useState } from 'react'
import { Outlet, Route, Routes } from 'react-router-dom'
import SplashScreen from './components/SplashScreen.jsx'
import AppLayout from './layouts/AppLayout.jsx'
import RequireAuth from './components/RequireAuth.jsx'
import { FeedProvider } from './context/FeedContext.jsx'

// Every page used to be imported eagerly, so a single visitor downloaded
// Landing's marketing sections, Chat, Settings, every legal page etc. in one
// ~1.6MB bundle regardless of which page they actually opened. Lazy-loading
// per route lets Vite split each page into its own chunk, fetched only when
// that route is actually visited.
const Landing = lazy(() => import('./pages/Landing.jsx'))
const Events = lazy(() => import('./pages/Events.jsx'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy.jsx'))
const Terms = lazy(() => import('./pages/Terms.jsx'))
const LegalNotice = lazy(() => import('./pages/LegalNotice.jsx'))
const Safety = lazy(() => import('./pages/Safety.jsx'))
const Pricing = lazy(() => import('./pages/Pricing.jsx'))
const Welcome = lazy(() => import('./pages/Welcome.jsx'))
const Login = lazy(() => import('./pages/Login.jsx'))
const Signup = lazy(() => import('./pages/Signup.jsx'))
const VerifyEmail = lazy(() => import('./pages/VerifyEmail.jsx'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'))
const AuthAction = lazy(() => import('./pages/AuthAction.jsx'))
const Discover = lazy(() => import('./pages/Discover.jsx'))
const Feed = lazy(() => import('./pages/Feed.jsx'))
const PostDetail = lazy(() => import('./pages/PostDetail.jsx'))
const Matches = lazy(() => import('./pages/Matches.jsx'))
const LikesYou = lazy(() => import('./pages/LikesYou.jsx'))
const Announcements = lazy(() => import('./pages/Announcements.jsx'))
const Chat = lazy(() => import('./pages/Chat.jsx'))
const Profile = lazy(() => import('./pages/Profile.jsx'))
const Settings = lazy(() => import('./pages/Settings.jsx'))
const Support = lazy(() => import('./pages/Support.jsx'))
const Onboarding = lazy(() => import('./pages/Onboarding.jsx'))

function RouteLoader() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-surface">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-400/30 border-t-violet-500" />
    </div>
  )
}

function App() {
  const [showSplash, setShowSplash] = useState(true)

  return (
    <>
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/evenements" element={<Events />} />
          <Route path="/confidentialite" element={<PrivacyPolicy />} />
          <Route path="/conditions" element={<Terms />} />
          <Route path="/mentions-legales" element={<LegalNotice />} />
          <Route path="/securite" element={<Safety />} />
          <Route path="/tarifs" element={<Pricing />} />
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
            <Route
              element={
                <FeedProvider>
                  <Outlet />
                </FeedProvider>
              }
            >
              <Route path="/feed" element={<Feed />} />
              <Route path="/feed/:postId" element={<PostDetail />} />
            </Route>
            <Route path="/matches" element={<Matches />} />
            <Route path="/likes" element={<LikesYou />} />
            <Route path="/annonces" element={<Announcements />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/chat/:conversationId" element={<Chat />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/soutenir" element={<Support />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  )
}

export default App
