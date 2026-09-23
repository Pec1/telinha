import { expect, test, type Browser, type Page } from '@playwright/test';

const hasLiveKit = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'SESSION_SECRET'].every(
  (k) => !!process.env[k],
);
test.skip(!hasLiveKit, 'E2E precisa das credenciais do LiveKit Cloud no ambiente.');

/** Cada participante em um contexto separado (sessionStorage isolado). */
async function newParticipant(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  return context.newPage();
}

/** Espera o <video> de uma tela receber frames e devolve a resolução. */
async function receivedVideoSize(page: Page, caption: string) {
  const figure = page.locator('figure', { has: page.locator('figcaption', { hasText: caption }) });
  const video = figure.locator('video');
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.videoWidth)).toBeGreaterThan(0);
  return video.evaluate((v: HTMLVideoElement) => ({ width: v.videoWidth, height: v.videoHeight }));
}

test('host cria sala, concede tela, convidado transmite, chat entrega e host revoga', async ({ browser }) => {
  // --- Host cria a sala ---
  const host = await newParticipant(browser);
  await host.goto('/');
  await host.getByLabel('Seu apelido').fill('Ana');
  await host.getByRole('button', { name: 'Criar sala' }).click();
  await expect(host).toHaveURL(/\/s\/[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
  const code = new URL(host.url()).pathname.split('/').pop()!;
  await expect(host.getByText('Você é o host')).toBeVisible();

  // --- Convidado entra pelo link ---
  const guest = await newParticipant(browser);
  await guest.goto(`/s/${code}`);
  await guest.getByLabel('Seu apelido').fill('Bia');
  await guest.getByRole('button', { name: 'Entrar' }).click();
  await expect(host.getByText('2 pessoas na sala')).toBeVisible();

  // Sem permissão, o convidado não tem o botão de compartilhar.
  await expect(guest.getByText('Ninguém está transmitindo agora')).toBeVisible();
  await expect(guest.getByRole('button', { name: 'Compartilhar tela' })).toHaveCount(0);

  // --- Host concede permissão ---
  const permission = host.getByRole('switch', { name: 'Pode compartilhar: Bia' });
  await expect(permission).toHaveAttribute('aria-checked', 'false');
  await permission.click();
  await expect(permission).toHaveAttribute('aria-checked', 'true');
  await expect(guest.getByText('agora você pode compartilhar a tela')).toBeVisible();

  // --- Convidado compartilha; host recebe a tela ---
  await guest.getByRole('button', { name: 'Compartilhar tela' }).click();
  await expect(guest.getByRole('button', { name: 'Parar' })).toBeVisible();
  await expect(host.getByText('Transmitindo', { exact: true })).toBeVisible();
  const size = await receivedVideoSize(host, 'Tela de Bia');
  expect(size.width).toBeGreaterThanOrEqual(1280);

  // --- Chat entrega mensagem ---
  await host.getByRole('button', { name: /Abrir chat/ }).click();
  const message = `Olá, Bia! ${Date.now()}`;
  await host.getByLabel('Mensagem').fill(message);
  await host.getByLabel('Mensagem').press('Enter');
  await expect(guest.getByRole('button', { name: /Abrir chat \(1 não lidas\)/ })).toBeVisible();
  await guest.getByRole('button', { name: /Abrir chat/ }).click();
  await expect(guest.getByRole('log').getByText(message)).toBeVisible();

  // --- Host revoga: a transmissão do convidado termina ---
  await host.getByRole('tab', { name: /Participantes/ }).click();
  await permission.click();
  await expect(permission).toHaveAttribute('aria-checked', 'false');
  await expect(guest.getByText('removeu sua permissão de compartilhar')).toBeVisible();
  await expect(guest.getByRole('button', { name: 'Parar' })).toHaveCount(0);
  await expect(guest.getByRole('button', { name: 'Compartilhar tela' })).toHaveCount(0);
  await expect(host.getByText('Ninguém está transmitindo agora')).toBeVisible();
  await expect(host.getByText('Transmitindo', { exact: true })).toHaveCount(0);
});
