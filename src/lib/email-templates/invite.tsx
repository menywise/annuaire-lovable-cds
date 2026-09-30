import * as React from 'react'

import {
  CdsButton,
  CdsEmailLayout,
  CdsNote,
  CdsParagraph,
} from './cds-layout'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <CdsEmailLayout
    preview={`Vous êtes invité à rejoindre ${siteName}`}
    title="Vous êtes invité à nous rejoindre"
    siteName={siteName}
    siteUrl={siteUrl}
  >
    <CdsParagraph>
      Une invitation vous attend sur <strong>{siteName}</strong>. Cliquez sur le
      bouton ci-dessous pour créer votre compte et découvrir l'espace qui vous
      est réservé.
    </CdsParagraph>
    <CdsButton href={confirmationUrl}>Accepter l'invitation</CdsButton>
    <CdsNote>
      Si vous ne connaissez pas {siteName}, vous pouvez simplement ignorer cet
      e-mail.
    </CdsNote>
  </CdsEmailLayout>
)

export default InviteEmail
