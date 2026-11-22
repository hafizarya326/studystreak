import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ToastProvider } from './context/ToastContext'
import { AuthProvider } from './context/AuthContext'
import { SettingsProvider } from './context/SettingsContext'
import { DataProvider } from './context/DataContext'
import { TimerProvider } from './context/TimerContext'
import { AudioProvider } from './context/AudioContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <AuthProvider>
        <SettingsProvider>
          <DataProvider>
            <TimerProvider>
              <AudioProvider>
                <App />
              </AudioProvider>
            </TimerProvider>
          </DataProvider>
        </SettingsProvider>
      </AuthProvider>
    </ToastProvider>
  </StrictMode>,
)
