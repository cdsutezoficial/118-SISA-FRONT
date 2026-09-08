import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import router from './app/router'
import { RoleProvider } from './app/core/infra/RoleContext'
import './styles/index.css'

createRoot(document.getElementById('root')!).render(
  <RoleProvider>
    <RouterProvider router={router} />
  </RoleProvider>
)
