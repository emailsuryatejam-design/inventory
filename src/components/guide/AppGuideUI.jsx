import { useLocation } from 'react-router-dom'
import { useUser } from '../../context/AppContext'
import AssistantButton from './AssistantButton'
import AssistantPanel from './AssistantPanel'
import GuideOverlay from './GuideOverlay'
import ReportForm from './ReportForm'

/**
 * Renders the guide UI only on authenticated /app routes.
 * Hidden on public pages: landing, login, register, pricing, etc.
 */
export default function AppGuideUI() {
  const user = useUser()
  const { pathname } = useLocation()

  // Only show on authenticated /app routes
  if (!user || !pathname.startsWith('/app')) return null

  return (
    <>
      <AssistantButton />
      <AssistantPanel />
      <GuideOverlay />
      <ReportForm />
    </>
  )
}
