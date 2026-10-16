# HPE Força Bruta

Aplicativo web de musculação para personal trainers e alunos. Código sincronizado com a versão 37 do projeto publicado.

## Recursos

- Login por perfil conectado ao Supabase.
- Planos de treino, demonstrações, registro de séries e descanso.
- Miniaturas animadas na seleção do personal e na lista do aluno, com ampliação.
- 15 movimentos de peito e pernas em vídeo contínuo; suporte a GIFs personalizados.
- Biblioteca com 46 modelos de fichas anonimizadas.
- Acompanhamento de evolução e comunicação entre personal e aluno.
- Layout responsivo e instalação pela tela inicial do celular.

## Executar localmente

O aplicativo usa HTML, CSS e JavaScript sem etapa de compilação.

```sh
python3 -m http.server 8000 --directory dist
```

Abra http://localhost:8000. O acesso real depende de contas e permissões configuradas no Supabase. A recuperação de senha aponta para o endereço publicado; ajuste os redirecionamentos ao trocar de domínio.

## Supabase

Os scripts de configuração estão em `supabase-auth-setup.sql` e `supabase/`. Consulte os arquivos antes de executá-los; não execute migrações em produção sem revisar o estado atual do banco. Os scripts não transferem dados do projeto existente nem criam automaticamente as contas dos usuários.

A chave pública usada no navegador está em `dist/supabase-auth.js`. Ela não substitui a proteção por políticas RLS. A chave de serviço deve permanecer exclusivamente nos secrets da Edge Function; nunca a coloque no frontend.

A documentação em `supabase/ATIVAR-CADASTROS.md` foi preservada como referência histórica; suas observações sobre dados somente locais antecedem a implementação de `cloud-sync.js` e `student-sharing.js`.

## Verificações

```sh
node check-library.cjs
node check-sharing.cjs
node check-sync.cjs
```

Os testes locais não substituem validação de login, sincronização e telas com contas reais em celulares Android e iPhone.

## Aplicativo publicado

https://forja-treino-academia.younggoby6.chatgpt.site
