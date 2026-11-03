'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { USE_MOCK, decideOAuth, fetchOAuthClient } from '@/lib/api';
import { rememberPostLogin } from '@/lib/post-login';
import { useSession } from '@/lib/session';
import { AuthShell } from '@/components/ui/AuthShell';
import { buttonClass } from '@/components/ui/Button';

/**
 * Consent screen for AI assistants (claude.ai, ChatGPT, ...) that connect to
 * the Licits MCP server through OAuth. The assistant sends the user's browser
 * here; they sign in if needed, see who is asking, and allow or deny. The
 * backend checks the app and its redirect address again before answering.
 */
function Consent() {
  const t = useTranslations('oauthConsent');
  const router = useRouter();
  const session = useSession();
  const params = useSearchParams();
  const [appName, setAppName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const clientId = params.get('client_id') ?? '';
  const redirectUri = params.get('redirect_uri') ?? '';
  const decision = {
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: params.get('response_type') ?? 'code',
    code_challenge: params.get('code_challenge') ?? '',
    code_challenge_method: params.get('code_challenge_method') ?? '',
    state: params.get('state') ?? '',
  };

  useEffect(() => {
    if (session.status === 'out') {
      rememberPostLogin(window.location.pathname + window.location.search);
      router.replace('/auth/login');
    }
  }, [session.status, router]);

  useEffect(() => {
    if (session.status !== 'in' || USE_MOCK) return;
    if (!clientId || !redirectUri) {
      setError(t('invalid'));
      return;
    }
    fetchOAuthClient(clientId, redirectUri)
      .then((c) => setAppName(c.name))
      .catch(() => setError(t('invalid')));
  }, [session.status, clientId, redirectUri, t]);

  const answer = async (approve: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const { redirect_to } = await decideOAuth({ ...decision, approve });
      window.location.assign(redirect_to);
    } catch {
      setBusy(false);
      setError(t('failed'));
    }
  };

  if (session.status !== 'in') {
    return (
      <AuthShell title={t('title')}>
        <p className="text-[15px] text-muted">{t('loading')}</p>
      </AuthShell>
    );
  }

  if (USE_MOCK) {
    return (
      <AuthShell title={t('title')}>
        <p className="text-[15px] text-muted">{t('demo')}</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={appName ? t('heading', { app: appName }) : t('title')} subtitle={t('signedInAs', { email: session.user.email })}>
      {error && <p role="alert" className="text-[14px] text-error">{error}</p>}
      {appName && (
        <>
          <ul className="flex flex-col gap-2 text-[15px] leading-[23px] text-ink">
            <li>{t('can1')}</li>
            <li>{t('can2')}</li>
            <li>{t('can3')}</li>
          </ul>
          <p className="text-[14px] leading-[21px] text-muted">{t('cannot')}</p>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void answer(true)}
              className={buttonClass({ variant: 'primary' })}
            >
              {t('allow')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void answer(false)}
              className={buttonClass({ variant: 'secondary' })}
            >
              {t('deny')}
            </button>
          </div>
          <p className="text-[13px] leading-[19px] text-muted">{t('revokeHint')}</p>
        </>
      )}
    </AuthShell>
  );
}

export default function AuthorizePage() {
  return (
    <Suspense fallback={null}>
      <Consent />
    </Suspense>
  );
}
