# WhatsApp Cloud API — Webhook mínimo (áudios)

Este repositório contém um webhook mínimo em Node/Express para receber mensagens do WhatsApp Cloud API, baixar mídia de áudio e salvar em ./downloads/ para posterior transcrição/uso.

O objetivo: preparar tudo sem expor credenciais aqui. Quando você autorizar, posso rodar o servidor de teste e ajudar a conectar no Meta App.

Arquivos criados
- server.js — webhook principal
- package.json — dependências e scripts
- .env.example — variáveis de ambiente

Pré-requisitos
- Node.js >=18
- Conta Meta Business e App com produto "WhatsApp"
- Phone Number (ou número de teste), App Secret e Access Token
- URL pública para webhook (ngrok recomendado em dev)

Instalação (local)
1. copie .env.example → .env e preencha
2. npm install
3. npm start

Desenvolvimento com ngrok
1. instalar ngrok e autenticar: ngrok authtoken <SEU_TOKEN>
2. rodar: ngrok http 3000
3. copiar a URL (https://xxxx.ngrok.io) e configurar no App Meta → Webhooks

Configurar Webhook no Meta App
1. App Dashboard → WhatsApp → Webhooks
2. Adicionar URL: https://<seu-ngrok>/webhook e token de verificação = VERIFY_TOKEN
3. Selecionar tópicos: messages, messages_status, media, message_templates

Próximos passos que eu posso executar (preciso da sua autorização quando envolver execução ou credenciais):
- instalar dependências e iniciar servidor de teste aqui (workspace)
- rodar ngrok neste ambiente (preciso do ngrok authtoken)
- automatizar chamadas Graph API para criar teste de número / tokens (preciso do Access Token)
- integrar transcrição automática (preciso da chave do serviço de STT)

Quando quiser que eu execute algo, me autorize explicitamente e me forneça as credenciais necessárias apenas no momento certo.

