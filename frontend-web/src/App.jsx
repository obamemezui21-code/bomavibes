import { Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Discover from './pages/Discover.jsx'
import Matches from './pages/Matches.jsx'
import Chat from './pages/Chat.jsx'
import Profile from './pages/Profile.jsx'
import Settings from './pages/Settings.jsx'
import Onboarding from './pages/Onboarding.jsx'
import AppLayout from './layouts/AppLayout.jsx'
import RequireAuth from './components/RequireAuth.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
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
          <RequireAuth>
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
  )
}

export default App
