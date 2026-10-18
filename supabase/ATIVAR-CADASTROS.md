# Ativar contas de alunos pelo personal

Projeto Supabase: `jzvzlcdaywqjhserndyf`.

## Alteração necessária no Supabase

1. Se ainda não estiver instalado, execute `accounts.sql` primeiro. Depois, no SQL Editor, execute `student-access.sql`. A migração adiciona códigos únicos de 16 caracteres, atribui códigos aos alunos existentes, mantém as senhas atuais e desativa o antigo autocadastro público.
2. Em Edge Functions, atualize `hpe-accounts` com `functions/hpe-accounts/index.ts`. Defina `verify_jwt = false` conforme `config.toml`, pois o login do aluno começa sem sessão. A função valida manualmente a sessão em todas as ações administrativas.
3. Confirme que as variáveis padrão `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` estão disponíveis. Nunca coloque a service role key no app.
4. As origens permitidas são o Site HPE e `https://forcabruta.vercel.app`.

## Uso

- O personal entra em **Meus alunos → Cadastrar aluno**, informa nome e dados opcionais. O servidor cria a conta sem e-mail do aluno e gera o código e uma senha temporária.
- Entregue os dados exibidos após o cadastro ao aluno. Ele entra com o código de 16 caracteres e a senha.
- Em **Meus alunos**, o personal consulta o código e usa **Redefinir senha** para gerar outra senha temporária. O código não muda.
- O acesso do personal continua usando e-mail. O aluno não pode criar sua própria conta nem solicitar redefinição por e-mail.

A função não mostra e-mails internos de alunos na lista e só permite ao personal redefinir a senha de alunos vinculados a ele. O administrador pode continuar criando contas de personal.
