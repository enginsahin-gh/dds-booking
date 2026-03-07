import { logError } from './lib/logger';
import type { Env } from './api';
import { getSupabase } from './lib/supabase';
import { sendSubscriptionEmail } from './routes/subscription';

/**
 * Scheduled handler: runs daily at 06:00 UTC.
 * 1. Pauses salons whose trial period has expired
 * 2. Pauses salons with past_due payments older than 7 days
 */
export async function handleTrialPause(env: Env): Promise<void> {
  await handleExpiredTrials(env);
  await handlePastDueCheck(env);
}

/**
 * Check salons with past_due status for >7 days.
 * Pauses them and cancels their Mollie subscription.
 */
async function handlePastDueCheck(env: Env): Promise<void> {
  const supabase = getSupabase(env);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: pastDueSalons, error } = await supabase
    .from('salons')
    .select('id, name, mollie_customer_id, mollie_subscription_id')
    .eq('subscription_status', 'past_due')
    .lt('subscription_past_due_at', sevenDaysAgo);

  if (error) {
    logError(undefined, 'Past due check query error');
    return;
  }

  if (!pastDueSalons || pastDueSalons.length === 0) {
    console.log('Past due check: no salons to pause');
    return;
  }

  const mollieKey = env.MOLLIE_API_KEY;

  for (const salon of pastDueSalons) {
    try {
      // Cancel Mollie subscription if exists
      if (salon.mollie_customer_id && salon.mollie_subscription_id) {
        try {
          await fetch(
            `https://api.mollie.com/v2/customers/${salon.mollie_customer_id}/subscriptions/${salon.mollie_subscription_id}`,
            {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${mollieKey}` },
            }
          );
        } catch (err) {
          logError(undefined, 'Failed to cancel Mollie subscription');
        }
      }

      // Pause the salon
      await supabase
        .from('salons')
        .update({ subscription_status: 'paused' })
        .eq('id', salon.id);

      // Send paused notification email
      await sendSubscriptionEmail(env, salon.id, 'paused');
    } catch (err) {
      logError(undefined, 'Past due pause error');
    }
  }

  console.log(`Past due check: paused ${pastDueSalons.length} salon(s)`);
}

/**
 * Original trial expiration handler.
 * Pauses salons whose trial period has expired and sends notification email.
 */
async function handleExpiredTrials(env: Env): Promise<void> {
  const supabase = getSupabase(env);
  const now = new Date().toISOString();

  // Find all salons with expired trials
  const { data: expiredSalons, error } = await supabase
    .from('salons')
    .select('id, name, email, owner_id, brand_color, brand_color_text, brand_gradient_enabled, brand_gradient_from, brand_gradient_to, brand_gradient_direction, logo_url, email_footer_text')
    .eq('subscription_status', 'trial')
    .lt('trial_ends_at', now);

  if (error) {
    logError(undefined, 'Trial pause query error');
    return;
  }

  if (!expiredSalons || expiredSalons.length === 0) {
    console.log('Trial pause: no expired trials found');
    return;
  }

  const salonIds = expiredSalons.map(s => s.id);

  // Batch update all expired salons to paused
  const { error: updateError } = await supabase
    .from('salons')
    .update({ subscription_status: 'paused' })
    .in('id', salonIds);

  if (updateError) {
    logError(undefined, 'Trial pause update error');
    return;
  }

  console.log(`Trial pause: paused ${expiredSalons.length} salon(s)`);

  // Send notification emails
  const resendKey = env.RESEND_API_KEY;
  if (!resendKey) {
    logError(undefined, 'Trial pause: RESEND_API_KEY not configured');
    return;
  }

  const frontendUrl = env.FRONTEND_URL || 'https://mijn.bellure.nl';

  for (const salon of expiredSalons) {
    try {
      const brandColor = salon.brand_color || '#8B5CF6';
      const brandColorText = salon.brand_color_text || '#FFFFFF';
      const gradientEnabled = salon.brand_gradient_enabled || false;
      const gradientFrom = salon.brand_gradient_from || brandColor;
      const gradientTo = salon.brand_gradient_to || '#6366F1';
      const gradientDir = salon.brand_gradient_direction || '135deg';

      const headerBg = gradientEnabled
        ? `background-color:${brandColor};background:linear-gradient(${gradientDir},${gradientFrom},${gradientTo});`
        : `background:${brandColor};`;

      const logoHtml = salon.logo_url
        ? `<img src="${esc(salon.logo_url)}" alt="${esc(salon.name)}" style="max-height:48px;max-width:180px;display:block;margin:0 auto;" />`
        : `<span style="font-size:20px;font-weight:700;color:${brandColorText};letter-spacing:-0.5px;">${esc(salon.name)}</span>`;

      const footerLine = salon.email_footer_text
        ? `<p style="color:#94A3B8;font-size:13px;margin:8px 0 0;font-style:italic;">${esc(salon.email_footer_text)}</p>`
        : '';

      const ctaUrl = `${frontendUrl}/admin/instellingen`;
      const btnBg = gradientEnabled
        ? `background-color:${brandColor};background:linear-gradient(${gradientDir},${gradientFrom},${gradientTo});`
        : `background:${brandColor};`;

      const content = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1E293B;">
          <h2 style="color:${brandColor};font-size:22px;margin:0 0 16px;">Je proefperiode is verlopen</h2>
          <p style="font-size:15px;color:#475569;line-height:1.6;">
            Hoi,
          </p>
          <p style="font-size:15px;color:#475569;line-height:1.6;">
            De gratis proefperiode van 30 dagen voor <strong>${esc(salon.name)}</strong> op Bellure is verlopen.
            Je account is nu gepauzeerd, wat betekent dat klanten tijdelijk geen nieuwe afspraken kunnen boeken.
          </p>
          <p style="font-size:15px;color:#475569;line-height:1.6;">
            Al je gegevens, instellingen en bestaande afspraken blijven bewaard. 
            Activeer je abonnement om direct weer online te zijn.
          </p>
          <div style="margin:28px 0;text-align:center;">
            <a href="${ctaUrl}" style="display:inline-block;padding:14px 28px;${btnBg}color:${brandColorText};border-radius:8px;text-decoration:none;font-size:16px;font-weight:600;">
              Abonnement activeren
            </a>
          </div>
          <p style="font-size:13px;color:#94A3B8;text-align:center;">
            Vragen? Antwoord op deze email of neem contact op via hello@bellure.nl
          </p>
        </div>`;

      const html = `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<!--[if mso]><style>td{font-family:Arial,sans-serif!important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:#F7F7F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F7F5;padding:24px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr><td style="${headerBg}padding:20px 24px;text-align:center;">${logoHtml}</td></tr>
        <tr><td style="padding:28px 24px 20px;">${content}</td></tr>
        <tr><td style="padding:16px 24px 20px;text-align:center;border-top:1px solid #F1F1EF;">
          ${footerLine}
          <p style="color:#CBD5E1;font-size:11px;margin:8px 0 0;">Powered by <a href="https://bellure.nl" style="color:#CBD5E1;text-decoration:underline;">Bellure</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: 'Bellure <noreply@bellure.nl>',
          to: [salon.email],
          reply_to: ['hello@bellure.nl'],
          subject: 'Je Bellure proefperiode is verlopen',
          html,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        logError(undefined, 'Trial pause email failed');
      }
    } catch (err) {
      logError(undefined, 'Trial pause email error');
    }
  }

  console.log(`Trial pause: sent ${expiredSalons.length} expiration email(s)`);
}

function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
