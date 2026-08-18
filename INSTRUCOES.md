# Sistema de Consolidação — Guia de Instalação

Este sistema tem 3 partes:

1. **`index.html`** — a ficha pública, para preencher com os dados do novo convertido (com a logo da igreja).
2. **`painel.html`** — o painel administrativo, onde a pessoa responsável pela consolidação vê todas as fichas e preenche o campo "encaminhado à rede".
3. **Google Sheets + Apps Script** (pasta `backend/`) — o "banco de dados". Todas as fichas são salvas automaticamente numa planilha Google.

Não é necessário saber programar. Siga os passos abaixo, na ordem.

---

## Parte 1 — Criar o backend no Google Sheets (5 minutos)

1. Acesse [sheets.google.com](https://sheets.google.com) e crie uma planilha nova (pode chamar de "Consolidação — Dados").
2. No menu, vá em **Extensões → Apps Script**.
3. Vai abrir um editor de código com um arquivo `Code.gs` vazio (ou com um `function myFunction(){}`). **Apague tudo** o que estiver lá.
4. Abra o arquivo `backend/Code.gs` (que está junto com este guia), copie todo o conteúdo e cole no editor do Apps Script.
5. Salve (ícone de disquete ou `Ctrl+S`).
6. Defina a senha do painel administrativo:
   - Ainda no editor do Apps Script, encontre a função `configurarSenha`.
   - Troque o texto `'MinhaSenhaForte123'` pela senha que a pessoa da consolidação vai usar para entrar no painel.
   - No topo do editor, escolha a função `configurarSenha` na lista suspensa (ao lado do botão "Depurar") e clique em **Executar** (▶).
   - Na primeira vez, o Google vai pedir permissão — clique em **Revisar permissões**, escolha sua conta, clique em **Avançado** e depois em **Acessar [nome do projeto] (não seguro)**. Isso é normal para scripts pessoais/de uso interno.
   - Você só precisa fazer isso uma vez. Se quiser trocar a senha depois, é só repetir esse passo com a nova senha.

7. Agora publique como Web App:
   - Clique em **Implantar → Nova implantação**.
   - Clique no ícone de engrenagem ao lado de "Selecionar tipo" e escolha **App da Web**.
   - Em "Executar como", deixe **Eu (seu e-mail)**.
   - Em "Quem pode acessar", escolha **Qualquer pessoa**.
   - Clique em **Implantar**.
   - Autorize novamente se for pedido (mesmo processo do passo anterior).
   - Copie a **URL do app da Web** — ela termina em `/exec`. Guarde essa URL, você vai usar no próximo passo.

> ⚠️ Sempre que você editar o código `Code.gs` depois de já ter implantado, é preciso ir em **Implantar → Gerenciar implantações → ícone de lápis → Nova versão → Implantar** para as mudanças valerem no site.

---

## Parte 2 — Configurar as páginas do site

1. Abra o arquivo `js/config.js`.
2. Troque:
   ```js
   const API_URL = "COLE_AQUI_A_URL_DO_SEU_APPS_SCRIPT";
   ```
   pela URL que você copiou no passo anterior, por exemplo:
   ```js
   const API_URL = "https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxx/exec";
   ```
3. Salve o arquivo. Essa mesma URL é usada tanto pela ficha (`index.html`) quanto pelo painel (`painel.html`).

---

## Parte 3 — Publicar o site (deixar online com um link)

Qualquer opção abaixo funciona bem e é gratuita. A mais simples para quem não mexe com programação é o **Netlify Drop**:

### Opção A — Netlify Drop (mais simples, arrastar e soltar)
1. Acesse [app.netlify.com/drop](https://app.netlify.com/drop).
2. Arraste a pasta inteira do sistema (a pasta que contém `index.html`, `painel.html`, `assets/`, `css/`, `js/`) para a área indicada.
3. Em poucos segundos você recebe um link público, por exemplo `https://algum-nome.netlify.app`.
4. A ficha fica em `https://algum-nome.netlify.app/index.html` e o painel em `https://algum-nome.netlify.app/painel.html`.
5. Depois você pode criar uma conta gratuita no Netlify para trocar o nome do link e atualizar o site quando quiser.

### Opção B — GitHub Pages
1. Crie um repositório no GitHub e envie todos os arquivos desta pasta.
2. Vá em **Settings → Pages**, escolha a branch principal e salve.
3. O GitHub te dá um link do tipo `https://seu-usuario.github.io/nome-do-repositorio/`.

### Opção C — Qualquer hospedagem estática que a igreja já use
Como o site é só HTML/CSS/JS puro, ele funciona em qualquer hospedagem (Hostinger, cPanel, etc.). Basta enviar os arquivos por FTP ou pelo gerenciador de arquivos do painel de hospedagem.

> Importante: os arquivos precisam ser acessados via `http://` ou `https://` (um servidor de verdade), não abrindo o `index.html` direto no computador com duplo clique — alguns navegadores bloqueiam o envio de dados nesse caso.

---

## Como fica o uso no dia a dia

- **Na entrada/recepção da igreja**: alguém preenche a ficha em `index.html` (pelo celular ou tablet) com os dados do novo convertido. O campo "encaminhado à rede" **não aparece** nessa ficha — como combinado, essa decisão é feita depois.
- **A pessoa responsável pela consolidação** acessa `painel.html`, digita a senha, e vê todas as fichas cadastradas, com busca, filtros e estatísticas rápidas.
- Ao clicar em qualquer ficha, ela vê todos os detalhes e pode preencher/editar o campo **"Encaminhado(a) à rede"** quando decidir para qual rede aquela pessoa vai.
- Dentro da ficha aberta, o botão **"⬇ Exportar PDF"** gera um PDF formatado daquela ficha (com a logo e todos os dados, incluindo a rede) — abre a janela de impressão do navegador, e é só escolher **"Salvar como PDF"** como destino. Não depende de internet nem de nenhum serviço externo, funciona em qualquer computador ou celular.
- Os dados também ficam salvos na planilha Google (aba "Fichas"), então dá pra abrir a planilha a qualquer momento como backup ou para fazer relatórios.

---

## A data do cadastro aparece na planilha?

Sim. A planilha "Fichas" tem uma coluna **`timestamp`** logo depois do `id`, com a data e hora exatas em que cada ficha foi enviada (formatada como `dd/mm/aaaa hh:mm:ss`, já pronta para ordenar/filtrar direto no Google Sheets). Essa mesma informação também aparece formatada no painel, tanto na tabela ("Data") quanto no detalhe de cada ficha ("Data de cadastro") e no PDF exportado.

> Se você já tinha criado a planilha e colado uma versão anterior do `Code.gs` antes desta atualização, é só colar o `Code.gs` novo por cima — a próxima ficha enviada já vai gravar a data corretamente formatada. Fichas antigas que já estavam na planilha não são reformatadas automaticamente (mas se quiser, é só selecionar a coluna B inteira na planilha e aplicar Formatar → Número → Data e hora).

---

## Sobre o campo "Qual culto você participou?"

Esse campo aparece na ficha com 3 opções principais: **Noite da Unção**, **Domingo** e **Culto especial**. Dependendo da escolha, aparece um sub-campo:

- **Noite da Unção** → escolher o dia: Terça, Quarta ou Quinta.
- **Domingo** → escolher o horário: 10h, 15h, 17h ou 19h.
- **Culto especial** → uma caixa de texto livre para escrever qual foi o culto.

Essa informação aparece no painel na coluna "Culto" da tabela, no detalhe de cada ficha e no PDF exportado.

> Se você já tinha configurado a planilha antes desta atualização, é só colar o `Code.gs` novo por cima — o sistema adiciona sozinho as colunas novas (`culto`, `dia_uncao`, `horario_domingo`, `qual_culto_especial`) no final do cabeçalho na próxima vez que a planilha for acessada, sem apagar nada do que já estava cadastrado.

---

## Filtro por mês e relatório em PDF

No painel, a barra de filtros agora tem um seletor **"Todos os meses"**, populado automaticamente com os meses em que existem fichas cadastradas (mais recente primeiro).

Ao lado, o botão **"📄 Gerar relatório PDF"** abre a janela de impressão do navegador (mesma técnica da exportação de ficha individual — sem depender de nenhum serviço externo) com uma tabela de todas as fichas que estão sendo exibidas naquele momento:

- Se você deixar tudo em "Todos" (mês, decisão, rede) e a busca vazia, o relatório sai **completo**, com todas as fichas.
- Se aplicar qualquer filtro antes de clicar — por exemplo, escolher "Agosto de 2026" no mês, ou digitar um nome na busca — o relatório sai **filtrado**, mostrando só o que apareceu na tabela.

O relatório mostra no topo um resumo de quais filtros estavam ativos (ou "Nenhum filtro aplicado" se saiu completo), a data de geração e o total de fichas.

---

## Categoria da rede (Eles / Elas / Topo)

No campo **"Encaminhado(a) à rede"** de cada ficha, agora tem um seletor ao lado do nome da rede com as opções **Eles**, **Elas** e **Topo**. É opcional — dá pra preencher só o nome da rede, só a categoria, os dois, ou nenhum.

Essa informação aparece:
- Na tabela do painel, junto com a tag de status (ex: "Encaminhado (Elas)").
- No PDF individual da ficha (ex: "Rede Mulheres de Fé — Elas").
- No relatório em PDF, na coluna "Rede".

> Se você já tinha configurado a planilha antes desta atualização, é só colar o `Code.gs` novo por cima — não precisa mexer na planilha manualmente. A partir de agora o sistema confere sozinho, toda vez que é acessado, se alguma coluna nova do código (como `rede_categoria`) ainda não existe na planilha, e já adiciona ela automaticamente no final do cabeçalho, sem apagar nem bagunçar nenhum dado que já estava lá.

---

## Notificação automática no Telegram (opcional)

O sistema pode avisar no Telegram assim que uma ficha é enviada, usando a **API oficial de bots do Telegram** — gratuita, estável, e sem os problemas de confiabilidade dos serviços não-oficiais de WhatsApp (não funciona nem foi projetada para WhatsApp Business, pois é outro aplicativo).

**Bônus:** diferente do WhatsApp, o Telegram permite que um bot poste mensagens direto num **grupo**. Então, se quiser, dá sim pra ter um grupo (ex: "Equipe de Consolidação") onde todo mundo vê o aviso na mesma conversa — é só adicionar o bot nesse grupo.

### Passo a passo

1. No Telegram, procure o contato **@BotFather** (o bot oficial que cria outros bots) e inicie uma conversa.
2. Mande o comando `/newbot` e siga as instruções: escolha um nome de exibição e um "username" (precisa terminar em `bot`, ex: `consolidacao_igreja_bot`).
3. O BotFather te devolve um **token**, algo como `123456789:AAHk3jX...`. Guarde ele.
4. Agora, para cada pessoa (ou grupo) que vai receber os avisos:
   - **Pessoa individual**: ela procura o username do seu bot no Telegram e manda qualquer mensagem pra ele (ex: "oi").
   - **Grupo**: crie ou abra o grupo, adicione o bot como membro, e alguém manda qualquer mensagem no grupo.
5. Com o token em mãos, acesse esse link no navegador (trocando `<TOKEN>` pelo token do passo 3):
   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```
   Vai aparecer um texto com `"chat":{"id":...`. Esse número é o **chat_id** — de pessoas é positivo, de grupos é negativo (ex: `-1001234567890`). Repita esse acesso depois de cada nova pessoa/grupo interagir com o bot, pra pegar o chat_id de cada um.
6. Abra o arquivo `backend/Code.gs` (o mesmo que você colou no Apps Script) e encontre a seção **"NOTIFICAÇÃO NO TELEGRAM"**, perto do topo. Cole o token:
   ```js
   const TELEGRAM_BOT_TOKEN = '123456789:AAHk3jX...';
   ```
7. Adicione os chat_ids encontrados no passo 5:
   ```js
   const TELEGRAM_CHAT_IDS = [
     '987654321',
     '-1001234567890',
   ];
   ```
8. Troque para ativar as notificações:
   ```js
   const TELEGRAM_NOTIFICACOES_ATIVADO = true;
   ```
9. Salve, e no menu suspenso ao lado de "Depurar" escolha a função **`testarNotificacaoTelegram`** e clique em **Executar** (▶). Na primeira vez o Google vai pedir uma nova permissão ("Conectar-se a um serviço externo") — autorize normalmente. Confira se a mensagem de teste chegou em cada pessoa/grupo cadastrado.
10. Publique uma nova versão do Web App (**Implantar → Gerenciar implantações → ícone de lápis → Nova versão → Implantar**) para as mudanças valerem de verdade no site.

Pronto — a partir daí, toda ficha nova enviada avisa automaticamente todo mundo da lista, com a mensagem:
```
FICHA DE [NOME DA PESSOA] FOI PREENCHIDA COM SUCESSO!
```
Se uma ficha for cadastrada e, por qualquer motivo, o envio do Telegram falhar (ex: internet instável), a ficha continua sendo salva normalmente na planilha — só a notificação que não chega.

> A API de bots do Telegram é oficial e gratuita (mantida pelo próprio Telegram), então é bem mais estável do que os "gambiarras" não-oficiais que existem para WhatsApp — não deve dar os mesmos problemas de instabilidade ou incompatibilidade com contas Business que você teve antes. A única troca é que quem for receber o aviso precisa ter o Telegram instalado (é gratuito e funciona em qualquer celular).

---

## Trocar a logo depois

Basta substituir o arquivo `assets/logo.png` por outra imagem com o mesmo nome (de preferência PNG com fundo transparente).

---

## Dúvidas comuns

**A ficha diz "Sistema ainda não configurado"** → falta colar a URL do Apps Script em `js/config.js` (Parte 2).

**O painel diz "Senha incorreta" mesmo com a senha certa** → confira se você rodou a função `configurarSenha` no Apps Script (Parte 1, passo 6) e se implantou uma nova versão depois de qualquer alteração no código.

**Quero trocar a senha do painel** → edite a senha na função `configurarSenha` no Apps Script, rode a função de novo (▶ Executar) e não precisa reimplantar, pois isso não altera as rotas do site.
