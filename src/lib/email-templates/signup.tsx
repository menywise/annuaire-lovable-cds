import * as React from 'react'

import {
  CdsButton,
  CdsEmailLayout,
  CdsNote,
  CdsParagraph,
} from './cds-layout'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <CdsEmailLayout
    preview={`Confirmez votre adresse e-mail pour activer votre compte ${siteName}`}
    title="Confirmez votre adresse e-mail"
    siteName={siteName}
    siteUrl={siteUrl}
  >
    <CdsParagraph>
      Merci pour votre inscription sur <strong>{siteName}</strong>. Il ne reste
      qu'une étape pour activer votre compte ({recipient}).
    </CdsParagraph>
    <CdsButton href={confirmationUrl}>Activer mon compte</CdsButton>
    <CdsNote>
      Si vous n'êtes pas à l'origine de cette inscription, vous pouvez ignorer
      cet e-mail : le compte ne sera pas activé.
    </CdsNote>
  </CdsEmailLayout>
)

export default SignupEmail
