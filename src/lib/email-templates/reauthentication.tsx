import * as React from 'react'

import { Text } from '@react-email/components'

import {
  CdsEmailLayout,
  CdsNote,
  CdsParagraph,
} from './cds-layout'

interface ReauthenticationEmailProps {
  siteName?: string
  siteUrl?: string
  token: string
}

export const ReauthenticationEmail = ({
  siteName = 'CDS Framework',
  siteUrl = 'https://manuelrohaut.fr',
  token,
}: ReauthenticationEmailProps) => (
  <CdsEmailLayout
    preview={`Votre code de vérification ${siteName}`}
    title="Votre code de vérification"
    siteName={siteName}
    siteUrl={siteUrl}
  >
    <CdsParagraph>
      Pour confirmer cette action sensible sur <strong>{siteName}</strong>,
      saisissez le code ci-dessous :
    </CdsParagraph>
    <Text style={code}>{token}</Text>
    <CdsNote>
      Ce code est valable quelques minutes. Si vous n'avez pas demandé cette
      vérification, ignorez cet e-mail.
    </CdsNote>
  </CdsEmailLayout>
)

export default ReauthenticationEmail

const code = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e5e7eb',
  borderRadius: '6px',
  color: '#1e293b',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '28px',
  fontWeight: 700 as const,
  letterSpacing: '0.15em',
  margin: '0 0 8px',
  padding: '14px 20px',
  textAlign: 'center' as const,
}
