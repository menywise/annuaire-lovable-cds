import * as React from 'react'

import {
  CdsButton,
  CdsEmailLayout,
  CdsNote,
  CdsParagraph,
} from './cds-layout'

interface MagicLinkEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <CdsEmailLayout
    preview={`Votre lien de connexion à ${siteName}`}
    title="Votre lien de connexion"
    siteName={siteName}
    siteUrl={siteUrl}
  >
    <CdsParagraph>
      Cliquez sur le bouton ci-dessous pour vous connecter à{' '}
      <strong>{siteName}</strong>. Ce lien est personnel et à usage unique.
    </CdsParagraph>
    <CdsButton href={confirmationUrl}>Me connecter</CdsButton>
    <CdsNote>
      Si vous n'avez pas demandé ce lien, vous pouvez ignorer cet e-mail en
      toute sécurité.
    </CdsNote>
  </CdsEmailLayout>
)

export default MagicLinkEmail
