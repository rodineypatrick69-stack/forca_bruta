# HPE Força Bruta

Aplicativo web de musculação para personal trainers e alunos. Esta fonte está sincronizada com a versão 69 do app.

## Recursos

- Treino personalizado e acompanhamento individual da consultoria online.
- Questionário inicial, check-ins, evolução semanal e mensal, e relatórios em PDF.
- Carteira do personal com pendências, treinos da semana, peso mais recente e mensagens novas.
- Fotos privadas com consentimento e acesso restrito à consultoria responsável.
- Rascunho automático dos exercícios de treino neste dispositivo.
- Layout responsivo e instalação pela tela inicial do celular.

## Executar localmente

O aplicativo usa HTML, CSS e JavaScript sem etapa de compilação.

```sh
python3 -m http.server 8000 --directory dist
```

Abra http://localhost:8000. O login, o armazenamento e as permissões reais dependem do Supabase.

## Deploy

- Site principal: https://forja-treino-academia.rodineypatrick69.chatgpt.site
- Vercel serve a pasta `dist`, conforme `vercel.json`.
- A biblioteca de mídia de exercícios é servida pelo Site principal.

## Supabase

A função `hpe-accounts` faz o cadastro e o gerenciamento seguro de contas. A chave de serviço fica somente nos secrets da Edge Function; nunca a coloque no frontend. As tabelas e fotos da consultoria usam RLS e o bucket privado `hpe-consultation-media`.
