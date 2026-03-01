import './App.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react';

import Header from './components/Header'
import Hero from './components/Hero'
import Main from './components/Main'
import Login from './pages/Login'
import Signup from './pages/Signup'

function App() {
  return (
    <>
      <Analytics />
      <BrowserRouter>
        <Header />
        <Routes>
          <Route path="/" element={<><Hero /><Main /></>} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
