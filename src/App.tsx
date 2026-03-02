import './App.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react';

import Header from './components/Header'
import Hero from './components/Hero'
import Main from './components/Main'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ProtectedRoute from './components/ProtectedRoute'
import Links from './pages/Links'

function App() {
  return (
    <>
      <Analytics debug={false} />
      <BrowserRouter>
        <Header />
        <Routes>
          <Route path="/" element={<><Hero /><Main /></>} />
          <Route path="/links" element={<ProtectedRoute><Links /></ProtectedRoute>} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
