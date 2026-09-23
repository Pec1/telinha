# Telinha

Compartilhamento de tela em 1080p direto no navegador. O host cria uma sala só com um apelido, manda o link `/s/CÓDIGO` e os convidados entram sem cadastro. Mídia e chat passam 100% pelo LiveKit (SFU); o backend só emite tokens e aplica permissões.

## Arquitetura

```
apps/web         React + Vite + Tailwind + livekit-client / @livekit/components-react
apps/server      Node + Hono + livekit-server-sdk (API, webhook e, em produção, o build do web)
packages/shared  Schemas Zod e tipos de request/response usados pelos dois apps
```

- **Sem banco de dados.** O estado de cada sala vive no LiveKit (metadata `{ hostIdentity, createdAt }` e permissões dos participantes) e, no server, em memória: quem tem permissão de tela e quem foi removido. Se o server reiniciar, esse estado é reconstruído a partir do LiveKit.
- **Identidade:** `identity = "u_" + nanoid(10)`; o apelido vai no `name`. O backend devolve um `sessionKey = HMAC-SHA256(SESSION_SECRET, código:identity)`, guardado no `sessionStorage`, que autentica as chamadas seguintes (`Authorization: Bearer`).
- **Tokens LiveKit** duram 10 min. Quem está conectado tem o token renovado pelo próprio LiveKit; quem recarrega a página chama `/rejoin` e volta com a mesma identity e as mesmas permissões.
- **Processo único:** o estado em memória assume uma instância do server.
- **Sucessão de host:** quando o host sai, o server espera `HOST_GRACE_SECONDS` (um reload não conta como saída). Se ele não voltar, o participante conectado há mais tempo vira host (metadata da sala + grants de host). O aviso de saída vem do webhook do LiveKit (`participant_left`) e, como reserva, dos próprios clientes (`/host-check`) quando percebem que o host sumiu.

### API

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/api/rooms` | Cria sala `{nickname}` → `201 {code, token, url, identity, name, sessionKey}` |
| GET | `/api/rooms/:code` | `{exists, participants, full}` |
| POST | `/api/rooms/:code/join` | Entra `{nickname}` → `{token, url, identity, name, sessionKey}` |
| POST | `/api/rooms/:code/rejoin` | Volta `{identity, name}` + sessionKey → `{token, url}` (403 se foi removido) |
| POST | `/api/rooms/:code/permissions` | Host concede/revoga tela `{identity, targetIdentity, canShare}` → 204 (409 `SCREEN_LIMIT`) |
| POST | `/api/rooms/:code/kick` | Host remove alguém `{identity, targetIdentity}` → 204 |
| POST | `/api/rooms/:code/host-check` | Participante avisa que o host sumiu `{identity}` → 204 (reserva do webhook) |
| POST | `/api/livekit/webhook` | Eventos do LiveKit (`participant_left`, `room_finished`), assinatura validada |
| GET | `/health` | `{ok: true}` |

Erros sempre no formato `{ "error": { "code": "...", "message": "..." } }`.

**Rate limit por IP** (em memória; o IP vem do primeiro item do `X-Forwarded-For`, que o Render preenche com o cliente real): criar sala 5 a cada 10 min; join, rejoin, GET da sala e host-check 30/min; ações de host 60/min. Acima disso: `429 RATE_LIMITED` com `Retry-After`.

### Modos de transmissão

| Modo | Resolução | FPS | Bitrate máx. | contentHint | degradationPreference |
| --- | --- | --- | --- | --- | --- |
| Nítido (padrão) | até 1920×1080 | 30 | 6 Mbps | `detail` | `balanced` |
| Fluido | até 1920×1080 | 60 | 10 Mbps | `motion` | `maintain-framerate` |
| Ultra | nativa da tela | 60 | 15 Mbps | `motion` | `balanced` |

Com duas ou mais telas no ar aparece uma faixa de miniaturas e cada espectador escolhe a tela em destaque. Só a tela em destaque recebe vídeo (as outras ficam pausadas pelo adaptiveStream) e só o áudio dela toca.

H.264 quando o navegador suporta publicar (mais chance de encoder por hardware), senão VP8; simulcast desligado. Como a tela é publicada em uma única camada, quem assiste recebe sempre a resolução cheia, independente do tamanho da janela. O modo Ultra exige upload alto e a UI avisa isso.

## Rodando no Codespaces

1. Em **Settings → Secrets and variables → Codespaces** (do repositório ou da sua conta), crie os secrets:
   - `LIVEKIT_URL` (ex: `wss://seu-projeto.livekit.cloud`)
   - `LIVEKIT_API_KEY` e `LIVEKIT_API_SECRET` (LiveKit Cloud → Settings → API Keys)
   - `SESSION_SECRET` (string longa e aleatória, ex: `openssl rand -base64 32`)
2. Abra o Codespace. O devcontainer instala Node LTS, habilita o corepack e roda `pnpm install`.
3. Rode `pnpm dev`. Sobem o web (porta 5173) e o server (porta 8787); o Vite encaminha `/api` para o server.
4. Abra a porta **5173 (Web)** pela aba **Ports**.

> Use o LiveKit Cloud: o Codespaces não encaminha UDP, então um LiveKit local em Docker não entregaria mídia ao navegador.

**Webhook no Codespaces (opcional):** o LiveKit Cloud só alcança o Codespace se a porta for pública. Sem o webhook tudo funciona, e a sucessão de host usa o aviso dos clientes. Para testar o webhook, deixe a porta 5173 pública e cadastre `https://<codespace>-5173.app.github.dev/api/livekit/webhook` no LiveKit Cloud.

**Testar com outra pessoa ou outro navegador:** na aba **Ports**, clique com o botão direito na porta 5173 → **Port Visibility → Public**. Qualquer pessoa com o link `https://<codespace>-5173.app.github.dev/s/CÓDIGO` consegue entrar. Volte para **Private** quando terminar.

### Scripts

| Comando | O que faz |
| --- | --- |
| `pnpm dev` | web + server em modo desenvolvimento |
| `pnpm build` | build de shared, web e server |
| `pnpm start` | server em produção (serve também o frontend) na porta `PORT` |
| `pnpm typecheck` / `pnpm lint` / `pnpm test` | verificações |

## Deploy no Render

O `render.yaml` (Blueprint) define um único web service Node no plano free: o server Hono serve a API em `/api/*` e o build do frontend nas demais rotas (mesma origem, sem CORS).

1. No Render, **New → Blueprint** e selecione este repositório.
2. O Render lê o `render.yaml` e pede os valores das variáveis marcadas com `sync: false`: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` e `SESSION_SECRET`. Depois elas ficam em **Dashboard → telinha → Environment**.
3. Aplique o Blueprint. O build roda `corepack enable && pnpm install --frozen-lockfile && pnpm build`, o start roda `pnpm start` e o health check é `/health`.
4. No LiveKit Cloud, em **Settings → Webhooks**, cadastre `https://<app>.onrender.com/api/livekit/webhook` usando a mesma API key configurada no Render.

O plano free hiberna após 15 min sem requisições. Como a mídia não passa pelo server, enquanto alguém está numa sala o frontend chama `/health` a cada 5 min para mantê-lo acordado.

## Variáveis de ambiente

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `LIVEKIT_URL` | — | URL do projeto no LiveKit Cloud (`wss://...`) |
| `LIVEKIT_API_KEY` | — | API key do LiveKit |
| `LIVEKIT_API_SECRET` | — | API secret do LiveKit |
| `SESSION_SECRET` | — | Segredo do HMAC do sessionKey (mín. 16 caracteres) |
| `PORT` | `8787` | Porta HTTP do server |
| `MAX_PARTICIPANTS` | `25` | Participantes por sala |
| `MAX_SHARERS` | `4` | Pessoas com permissão de tela por sala, contando o host |
| `EMPTY_TIMEOUT_SECONDS` | `300` | Sala vazia fecha depois desse tempo |
| `HOST_GRACE_SECONDS` | `20` | Carência antes de promover um novo host quando o host sai |
| `RATE_LIMIT` | `on` | `off` desliga o rate limit (só para testes automatizados) |

Veja `.env.example`. Nunca faça commit de `.env`.
