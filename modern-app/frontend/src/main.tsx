import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import { installAuthFetch } from './app/session'
import './styles/system.css'

installAuthFetch()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
