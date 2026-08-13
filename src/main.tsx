import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import './styles/haigoo-design-system.css'
import './styles/home-editorial.css'
import './styles/editorial-product.css'
import './styles/taste-refresh.css'
import './styles/palette-cohesion.css'
// import './services/init-scheduler'

console.log('--- VERSION CHECK: 2026-01-08 12:40 Fix-Filter-Optimization-Final ---');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
