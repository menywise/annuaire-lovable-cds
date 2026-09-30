import * as React from 'react'

import {
  CdsButton,
  CdsEmailLayout,
  CdsNote,
  CdsParagraph,
} from './cds-layout'

interface EmailChangeEmailProps {
  siteName: string
  siteUrl: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  siteUrl,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <CdsEmailLayout
    preview={`Confirmez votre nouvelle adresse e-mail sur ${siteName}`}
    title="Confirmez votre nouvelle adresse e-mail"
    siteName={siteName}
    siteUrl={siteUrl}
  >
    <CdsParagraph>
      Vous avez demandé à remplacer l'adresse e-mail de votre compte{' '}
      <strong>{siteName}</strong>
      {oldEmail ? ` (actuellement ${oldEmail})` : ''} par{' '}
      <strong>{newEmail}</strong>.
    </CdsParagraph>
    <CdsButton href={confirmationUrl}>Confirmer ce changement</CdsButton>
    <CdsNote>
      Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail :
      votre adresse actuelle restera en place.
    </CdsNote>
  </CdsEmailLayout>
)

export default EmailChangeEmail
