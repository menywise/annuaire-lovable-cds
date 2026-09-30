import * as React from 'react'

import {
  CdsButton,
  CdsEmailLayout,
  CdsNote,
  CdsParagraph,
} from './cds-layout'

interface RecoveryEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <CdsEmailLayout
    preview={`Réinitialisez votre mot de passe ${siteName}`}
    title="Réinitialisation de votre mot de passe"
    siteName={siteName}
    siteUrl={siteUrl}
  >
    <CdsParagraph>
      Vous avez demandé à réinitialiser le mot de passe de votre compte{' '}
      <strong>{siteName}</strong>. Cliquez sur le bouton ci-dessous pour en
      choisir un nouveau.
    </CdsParagraph>
    <CdsButton href={confirmationUrl}>Choisir un nouveau mot de passe</CdsButton>
    <CdsNote>
      Si vous n'avez pas fait cette demande, aucune action n'est nécessaire :
      votre mot de passe actuel reste inchangé.
    </CdsNote>
  </CdsEmailLayout>
)

export default RecoveryEmail
