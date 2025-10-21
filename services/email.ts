interface SendEmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
  category?: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is required to send emails.`);
  }
  return value;
}

export async function sendEmail({ to, subject, text, html, category }: SendEmailPayload) {
  const apiKey = requireEnv('SENDGRID_API_KEY');
  const fromEmail = requireEnv('SENDGRID_FROM_EMAIL');

  const payload = {
    personalizations: [
      {
        to: [{ email: to }]
      }
    ],
    from: { email: fromEmail },
    subject,
    content: [
      { type: 'text/plain', value: text },
      ...(html ? [{ type: 'text/html', value: html }] : [])
    ],
    ...(category ? { categories: [category] } : {})
  };

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'unknown error');
    throw new Error(`[email] SendGrid API error: ${response.status} ${errorBody}`);
  }
}
