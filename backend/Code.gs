/**
 * SISTEMA DE CONSOLIDAÇÃO — BACKEND (Google Apps Script)
 * ---------------------------------------------------------
 * Este script transforma uma Planilha Google em um banco de dados
 * simples para a Ficha de Consolidação e o Painel Administrativo.
 *
 * COMO CONFIGURAR (veja também INSTRUCOES.md):
 * 1. Crie uma Planilha Google nova (pode deixar em branco).
 * 2. Menu Extensões > Apps Script.
 * 3. Apague o conteúdo padrão e cole este arquivo inteiro.
 * 4. Rode a função "configurarSenha" uma vez (veja abaixo) para
 *    definir a senha de acesso do painel — ou configure direto em
 *    Configurações do projeto > Propriedades do script > ADMIN_PASSWORD.
 * 5. Publique como Web App (Implantar > Nova implantação > App da Web):
 *      - Executar como: Eu (seu e-mail)
 *      - Quem pode acessar: Qualquer pessoa
 * 6. Copie a URL gerada (termina em /exec) e cole em js/config.js
 *    nos dois arquivos (index.html e painel.html usam o mesmo config.js).
 * 7. (Opcional) Configure as notificações no Telegram logo abaixo, na seção
 *    "NOTIFICAÇÃO NO TELEGRAM" — veja o passo a passo no INSTRUCOES.md.
 */

const SHEET_NAME = 'Fichas';

// =================================================================
// NOTIFICAÇÃO NO TELEGRAM (opcional)
// -----------------------------------------------------------------
// Assim que uma ficha é enviada, o sistema pode avisar automaticamente
// no Telegram de uma ou mais pessoas — ou até num grupo (ao contrário do
// WhatsApp, o Telegram permite bot postando direto num grupo, então todo
// mundo vê o aviso na mesma conversa).
//
// Como habilitar (veja o passo a passo completo no INSTRUCOES.md):
// 1. No Telegram, converse com @BotFather e crie um bot novo (/newbot).
//    Ele te dá um "token" (algo como 123456:ABC-DEF...).
// 2. Cole esse token em TELEGRAM_BOT_TOKEN abaixo.
// 3. Cada pessoa (ou o grupo) que vai receber os avisos precisa mandar
//    QUALQUER mensagem pro bot (ou o bot precisa ser adicionado ao grupo
//    e alguém mandar uma mensagem lá).
// 4. Acesse no navegador: https://api.telegram.org/bot<TOKEN>/getUpdates
//    (troque <TOKEN> pelo token do passo 2) e procure por "chat":{"id":...
//    — esse número é o chat_id. Adicione em TELEGRAM_CHAT_IDS abaixo.
// 5. Rode a função "testarNotificacaoTelegram" uma vez para conferir se
//    chegou a mensagem de teste.
// =================================================================

// ATENÇÃO: ainda falta o TELEGRAM_BOT_TOKEN (veja a linha abaixo) — por isso
// deixei ATIVADO em "false" por enquanto. Assim que colar o token recebido do
// @BotFather, troque para "true".
const TELEGRAM_NOTIFICACOES_ATIVADO = false; // true para ligar, false para desligar

const TELEGRAM_BOT_TOKEN = ''; // COLE AQUI o token recebido do @BotFather (ex: 123456789:AAHk3jX...)

const TELEGRAM_CHAT_IDS = [
  // Adicione um chat_id para cada pessoa OU grupo que deve ser avisado.
  // Pessoas: número positivo. Grupos: número negativo (ex: -123456789).
  '-1004387820436', // grupo de envio no Telegram
];

// Ordem das colunas na planilha — não mude a ordem sem atualizar o front-end.
const COLUMNS = [
  'id',
  'timestamp',
  'nome_completo',
  'telefone',
  'idade',
  'instagram',
  'endereco',
  'numero',
  'bairro',
  'cidade',
  'ponto_referencia',
  'profissao',
  'estado_civil',
  'tem_filhos',
  'quantos_filhos',
  'decisao',
  'culto',
  'dia_uncao',
  'horario_domingo',
  'qual_culto_especial',
  'como_chegou',
  'quem_convidou',
  'participou_rede',
  'qual_rede',
  'encaminhado_rede',
  'rede_categoria',
  'preenchido_por'
];

// Campos obrigatórios ao criar uma nova ficha (validação também existe no front-end).
// Praticamente todos os campos do formulário são obrigatórios agora — os únicos
// que ficam de fora daqui são os condicionais, que só existem dependendo de outra
// resposta (esses são checados separadamente em validarCondicionais_).
const REQUIRED_FIELDS = [
  'nome_completo', 'telefone', 'idade', 'instagram', 'profissao',
  'endereco', 'numero', 'bairro', 'cidade', 'ponto_referencia',
  'estado_civil', 'tem_filhos', 'decisao', 'culto', 'como_chegou', 'participou_rede',
  'preenchido_por'
];

// Campos que só são obrigatórios dependendo da resposta de outro campo
// (mesma regra usada na validação do formulário em js/form.js).
function validarCondicionais_(body) {
  if (body.tem_filhos === 'Sim' && (!body.quantos_filhos || String(body.quantos_filhos).trim() === '')) {
    return 'quantos_filhos';
  }
  if (body.como_chegou === 'Foi convidado por alguém' && (!body.quem_convidou || String(body.quem_convidou).trim() === '')) {
    return 'quem_convidou';
  }
  if (body.participou_rede === 'Sim' && (!body.qual_rede || String(body.qual_rede).trim() === '')) {
    return 'qual_rede';
  }
  if (body.culto === 'Noite da Unção' && (!body.dia_uncao || String(body.dia_uncao).trim() === '')) {
    return 'dia_uncao';
  }
  if (body.culto === 'Domingo' && (!body.horario_domingo || String(body.horario_domingo).trim() === '')) {
    return 'horario_domingo';
  }
  if (body.culto === 'Culto especial' && (!body.qual_culto_especial || String(body.qual_culto_especial).trim() === '')) {
    return 'qual_culto_especial';
  }
  return null;
}

/**
 * Rode esta função UMA VEZ manualmente (Executar > configurarSenha)
 * para definir a senha do painel administrativo. Troque 'MinhaSenhaForte123'
 * pela senha que a pessoa responsável pela consolidação vai usar.
 */
function configurarSenha() {
  PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD', 'Consolidacao@#2021');
}

// ---------------------------------------------------------------
// Rotas HTTP
// ---------------------------------------------------------------

function doGet(e) {
  const action = e.parameter.action;

  if (action === 'list') {
    const senha = e.parameter.senha || '';
    if (!checarSenha_(senha)) {
      return jsonOutput_({ status: 'error', message: 'Senha incorreta.' });
    }
    const data = lerFichas_();
    return jsonOutput_({ status: 'ok', data: data });
  }

  return jsonOutput_({ status: 'error', message: 'Ação inválida.' });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOutput_({ status: 'error', message: 'Corpo da requisição inválido.' });
  }

  const action = body.action;

  if (action === 'create') {
    return criarFicha_(body);
  }

  if (action === 'update_rede') {
    if (!checarSenha_(body.senha || '')) {
      return jsonOutput_({ status: 'error', message: 'Senha incorreta.' });
    }
    return atualizarRede_(body);
  }

  return jsonOutput_({ status: 'error', message: 'Ação inválida.' });
}

// ---------------------------------------------------------------
// Lógica
// ---------------------------------------------------------------

function criarFicha_(body) {
  for (let i = 0; i < REQUIRED_FIELDS.length; i++) {
    const campo = REQUIRED_FIELDS[i];
    if (!body[campo] || String(body[campo]).trim() === '') {
      return jsonOutput_({ status: 'error', message: 'Campo obrigatório ausente: ' + campo });
    }
  }

  const campoCondicionalFaltando = validarCondicionais_(body);
  if (campoCondicionalFaltando) {
    return jsonOutput_({ status: 'error', message: 'Campo obrigatório ausente: ' + campoCondicionalFaltando });
  }

  const sheet = getSheet_();
  const id = Utilities.getUuid();
  // Grava como objeto Date de verdade (não texto), assim a coluna na planilha
  // fica com data/hora nativa: dá pra ordenar, filtrar e formatar direto no Sheets.
  const timestamp = new Date();

  // Monta a linha na ORDEM FÍSICA real do cabeçalho da planilha (não na ordem
  // de COLUMNS aqui no código) — assim, se colunas novas tiverem sido
  // adicionadas no final por adicionarColunasFaltantes_ (planilhas antigas
  // sendo atualizadas), os valores continuam caindo na coluna certa.
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = header.map(col => {
    if (col === 'id') return id;
    if (col === 'timestamp') return timestamp;
    if (col === 'encaminhado_rede' || col === 'rede_categoria') return ''; // preenchido depois pela consolidação
    return body[col] !== undefined ? body[col] : '';
  });

  sheet.appendRow(row);

  // Não deixa uma falha no Telegram impedir o cadastro da ficha.
  try {
    enviarNotificacoesTelegram_(body);
  } catch (err) {
    console.error('Falha ao enviar notificações no Telegram: ' + err);
  }

  return jsonOutput_({ status: 'ok', id: id });
}

/**
 * Envia a notificação de uma nova ficha para cada chat_id cadastrado em
 * TELEGRAM_CHAT_IDS (pessoa ou grupo), via Telegram Bot API. Cada envio é
 * independente — se um chat falhar, os outros ainda recebem a mensagem
 * normalmente.
 */
function enviarNotificacoesTelegram_(dados) {
  if (!TELEGRAM_NOTIFICACOES_ATIVADO) return;
  if (!TELEGRAM_BOT_TOKEN) return;
  if (!TELEGRAM_CHAT_IDS || TELEGRAM_CHAT_IDS.length === 0) return;

  const texto = 'FICHA DE ' + (dados.nome_completo || '–').toUpperCase() + ' FOI PREENCHIDA COM SUCESSO!';
  const url = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage';

  TELEGRAM_CHAT_IDS.forEach(function (chatId) {
    try {
      UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/x-www-form-urlencoded',
        payload: { chat_id: String(chatId), text: texto },
        muteHttpExceptions: true
      });
    } catch (err) {
      console.error('Erro ao notificar Telegram chat_id ' + chatId + ': ' + err);
    }
  });
}

/**
 * Rode esta função manualmente (Executar > testarNotificacaoTelegram) para
 * conferir se a configuração do Telegram está funcionando, sem precisar
 * enviar uma ficha de verdade.
 */
function testarNotificacaoTelegram() {
  enviarNotificacoesTelegram_({
    nome_completo: 'Fulano de Tal (teste)'
  });
}

function atualizarRede_(body) {
  if (!body.id) {
    return jsonOutput_({ status: 'error', message: 'ID da ficha não informado.' });
  }

  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  const header = values[0];
  const idCol = header.indexOf('id');
  const redeCol = header.indexOf('encaminhado_rede');
  const categoriaCol = header.indexOf('rede_categoria');

  for (let r = 1; r < values.length; r++) {
    if (values[r][idCol] === body.id) {
      sheet.getRange(r + 1, redeCol + 1).setValue(body.encaminhado_rede || '');
      if (categoriaCol !== -1) {
        sheet.getRange(r + 1, categoriaCol + 1).setValue(body.rede_categoria || '');
      }
      return jsonOutput_({ status: 'ok' });
    }
  }

  return jsonOutput_({ status: 'error', message: 'Ficha não encontrada.' });
}

function lerFichas_() {
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const header = values[0];
  const rows = values.slice(1);

  return rows
    .filter(row => row.some(cell => cell !== '')) // ignora linhas totalmente vazias
    .map(row => {
      const obj = {};
      header.forEach((col, i) => {
        let val = row[i];
        if (val instanceof Date) val = val.toISOString();
        obj[col] = val;
      });
      return obj;
    });
}

// ---------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLUMNS);
    sheet.setFrozenRows(1);
    // Coluna "timestamp" (2ª coluna) formatada como data/hora em pt-BR.
    const timestampCol = COLUMNS.indexOf('timestamp') + 1;
    sheet.getRange(2, timestampCol, sheet.getMaxRows() - 1, 1).setNumberFormat('dd/mm/yyyy hh:mm:ss');
  } else {
    adicionarColunasFaltantes_(sheet);
  }
  return sheet;
}

/**
 * Auto-atualização: se o Code.gs foi atualizado e ganhou colunas novas em
 * COLUMNS (ex: "culto", "rede_categoria") mas a planilha já existia de antes
 * e ainda não tem essas colunas no cabeçalho, elas são adicionadas
 * automaticamente no final, sem apagar nada do que já estava lá.
 */
function adicionarColunasFaltantes_(sheet) {
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const faltando = COLUMNS.filter(col => header.indexOf(col) === -1);
  if (faltando.length === 0) return;
  sheet.getRange(1, header.length + 1, 1, faltando.length).setValues([faltando]);
}

function checarSenha_(senha) {
  const senhaCorreta = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!senhaCorreta) return false; // senha ainda não configurada = bloqueia acesso
  return senha === senhaCorreta;
}

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
