import * as React from 'react'
import { render } from '@react-email/render'
import { createFileRoute } from '@tanstack/react-router'
import { SignupEmail } from '@/lib/email-templates/signup'
import { InviteEmail } from '@/lib/email-templates/invite'
import { MagicLinkEmail } from '@/lib/email-templates/magic-link'
import { RecoveryEmail } from '@/lib/email-templates/recovery'
import { EmailChangeEmail } from '@/lib/email-templates/email-change'
import { ReauthenticationEmail } from '@/lib/email-templates/reauthentication'

const EMAIL_TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
}

// Aperçu seulement (jamais utilisé pour un envoi réel) : nom et adresse lus dans les réglages
// du site (CDS, lot 13 a). L'adresse d'exemple garde le domaine réservé .test, que le service
// de Lovable remplace par le vrai destinataire lors d'un e-mail de test.
const SAMPLE_EMAIL = "user@example.test"

function sampleData(siteName: string, siteUrl: string): Record<string, object> {
  return {
    signup: { siteName, siteUrl, recipient: SAMPLE_EMAIL, confirmationUrl: siteUrl },
    magiclink: { siteName, siteUrl, confirmationUrl: siteUrl },
    recovery: { siteName, siteUrl, confirmationUrl: siteUrl },
    invite: { siteName, siteUrl, confirmationUrl: siteUrl },
    email_change: {
      siteName,
      siteUrl,
      oldEmail: SAMPLE_EMAIL,
      email: SAMPLE_EMAIL,
      newEmail: SAMPLE_EMAIL,
      confirmationUrl: siteUrl,
    },
    reauthentication: { siteName, siteUrl, token: '123456' },
  }
}

export const Route = createFileRoute("/lovable/email/auth/preview")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env['LOVABLE_API_KEY']

        if (!apiKey) {
          return Response.json(
            { error: 'Server configuration error' },
            { status: 500 }
          )
        }

        // Verify the caller is authorized with LOVABLE_API_KEY
        const authHeader = request.headers.get('Authorization')
        if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        let type: string
        try {
          const body = await request.json()
          type = body.type
        } catch {
          return Response.json(
            { error: 'Invalid JSON in request body' },
            { status: 400 }
          )
        }

        const EmailTemplate = EMAIL_TEMPLATES[type]

        if (!EmailTemplate) {
          return Response.json(
            { error: `Unknown email type: ${type}` },
            { status: 400 }
          )
        }

        const { loadSiteConfig } = await import('@/lib/site-config.functions')
        const site = await loadSiteConfig().catch(() => null)
        const siteUrl = site?.brand.url || new URL(request.url).origin
        const data = sampleData(site?.brand.name ?? 'Votre site', siteUrl)[type] || {}
        const html = await render(React.createElement(EmailTemplate, data))

        return new Response(html, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      },
    },
  },
})
