# Ativar contas de alunos pelo personal

Projeto Supabase: `jzvzlcdaywqjhserndyf`.

## Banco de dados e função

A base já usa `student-access.sql`. Para o fluxo de senha pessoal:

1. Execute `student-password-setup.sql` para registrar se o aluno ainda precisa escolher a senha no primeiro acesso.
2. Publique `functions/hpe-accounts/index.ts` com `verify_jwt = false`. O login do aluno começa sem sessão; a função valida manualmente a sessão em todas as ações administrativas.
3. Depois que o app atualizado estiver publicado na Vercel, execute `student-access-code-6digit.sql`. Ele troca os códigos antigos de 16 caracteres por códigos numéricos únicos de 6 dígitos e preserva as senhas atuais.
4. Confirme que `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` estão disponíveis. Nunca coloque a service role key no app.
5. As origens permitidas são o Site HPE e `https://forcabruta.vercel.app`.

## Acesso do aluno

- Em **Meus alunos → Cadastrar aluno**, o personal informa o nome e, se quiser, o WhatsApp.
- O servidor cria a conta sem e-mail do aluno e gera um código de 6 dígitos e uma senha temporária.
- A tela de acesso oferece copiar os dados e abrir uma mensagem pronta no WhatsApp. O personal confere o contato e envia a mensagem.
- No primeiro login, o aluno precisa criar a própria senha. A senha pessoal não é compartilhada com o personal.
- Se o aluno esquecer a senha, o personal gera uma nova senha temporária. O aluno escolhe outra senha pessoal no próximo acesso.

Os códigos dos alunos já existentes mudam quando `student-access-code-6digit.sql` é executado; as senhas deles continuam iguais. O personal deve entregar o novo código a cada aluno. O login do personal continua usando e-mail.
