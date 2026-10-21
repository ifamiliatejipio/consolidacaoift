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
 *    definir as senhas de acesso do painel (Gestor e Administrador) — ou
 *    configure direto em Configurações do projeto > Propriedades do script
 *    > GESTOR_PASSWORD e ADMINISTRADOR_PASSWORD.
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
// 2. Guarde esse token em Configurações do projeto > Propriedades do script,
//    com o nome TELEGRAM_BOT_TOKEN (recomendado: assim ele não se perde quando
//    o código for colado de novo). Também funciona colar em TELEGRAM_BOT_TOKEN abaixo.
// 3. Cada pessoa (ou o grupo) que vai receber os avisos precisa mandar
//    QUALQUER mensagem pro bot (ou o bot precisa ser adicionado ao grupo
//    e alguém mandar uma mensagem lá).
// 4. Acesse no navegador: https://api.telegram.org/bot<TOKEN>/getUpdates
//    (troque <TOKEN> pelo token do passo 2) e procure por "chat":{"id":...
//    — esse número é o chat_id. Adicione em TELEGRAM_CHAT_IDS abaixo.
// 5. Rode a função "testarNotificacaoTelegram" uma vez para conferir se
//    chegou a mensagem de teste.
// =================================================================

// Só envia se houver token (na propriedade do script ou na linha abaixo).
const TELEGRAM_NOTIFICACOES_ATIVADO = true; // true para ligar, false para desligar

// Deixe vazio para usar a propriedade do script TELEGRAM_BOT_TOKEN (recomendado).
const TELEGRAM_BOT_TOKEN = '';

const TELEGRAM_CHAT_IDS = [
  // Adicione um chat_id para cada pessoa OU grupo que deve ser avisado.
  // Pessoas: número positivo. Grupos: número negativo (ex: -123456789).
  '-1004387820436', // grupo de envio no Telegram
];

// =================================================================
// HORÁRIO DAS FICHAS
// -----------------------------------------------------------------
// A ficha só aceita envios durante os cultos (no fuso horário do projeto —
// confira em Configurações do projeto > Fuso horário). Fora disso, a página
// mostra que as fichas estão fechadas. Para cultos especiais em outros dias/
// horários, o Administrador libera as fichas pelo painel.
// =================================================================
const BLOQUEIO_HORARIO_ATIVADO = true; // false = ficha aberta o tempo todo

const HORAS_POR_CULTO = 4; // quanto tempo a ficha fica aberta a partir do início do culto

// Dias: 1 = segunda, 2 = terça, 3 = quarta, 4 = quinta, 5 = sexta, 6 = sábado, 7 = domingo
const HORARIOS_CULTOS = [
  { nome: 'Noite da Unção', dias: [2, 3, 4], inicio: '19:30' },
  { nome: 'Domingo 10h', dias: [7], inicio: '10:00' },
  { nome: 'Domingo 15h', dias: [7], inicio: '15:00' },
  { nome: 'Domingo 17h', dias: [7], inicio: '17:00' },
  { nome: 'Domingo 19h', dias: [7], inicio: '19:00' },
];

// Texto mostrado na ficha quando ela está fechada (atualize se mudar os horários acima).
const TEXTO_HORARIOS_FICHA = 'Terça, quarta e quinta: 19h30 às 23h30 · Domingo: 10h às 14h e 15h às 23h';

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

// Perfis de acesso ao painel:
// - Gestor: pode fazer tudo (ver fichas, encaminhar à rede, gerar PDFs),
//   MENOS excluir fichas.
// - Administrador: pode fazer tudo, inclusive excluir fichas.
const PERFIL_GESTOR = 'gestor';
const PERFIL_ADMINISTRADOR = 'administrador';

// Texto provisório da senha do Administrador — enquanto ele não for trocado,
// configurarSenha NÃO grava a senha do Administrador (para ninguém conseguir
// entrar com uma senha conhecida).
const SENHA_ADMIN_PROVISORIA = 'TROQUE_AQUI_A_SENHA_DO_ADMINISTRADOR';

/**
 * Rode esta função manualmente (Executar > configurarSenha) para definir
 * as senhas do painel. Troque os textos abaixo pelas senhas desejadas.
 * As duas senhas precisam ser DIFERENTES.
 */
function configurarSenha() {
  const senhaGestor = 'Consolidacao@#2021';
  const senhaAdministrador = SENHA_ADMIN_PROVISORIA; // TROQUE pela senha do Administrador

  const props = PropertiesService.getScriptProperties();
  props.setProperty('GESTOR_PASSWORD', senhaGestor);

  if (senhaAdministrador && senhaAdministrador !== SENHA_ADMIN_PROVISORIA) {
    if (senhaAdministrador === senhaGestor) {
      throw new Error('A senha do Administrador precisa ser diferente da senha do Gestor.');
    }
    props.setProperty('ADMINISTRADOR_PASSWORD', senhaAdministrador);
  } else {
    console.warn('Senha do Administrador não configurada: troque o texto em configurarSenha e rode de novo.');
  }
}

// ---------------------------------------------------------------
// Rotas HTTP
// ---------------------------------------------------------------

function doGet(e) {
  const action = e.parameter.action;

  if (action === 'list') {
    const perfil = perfilDaSenha_(e.parameter.senha || '');
    if (!perfil) {
      return jsonOutput_({ status: 'error', message: 'Senha incorreta.' });
    }
    const data = lerFichas_();
    return jsonOutput_({ status: 'ok', perfil: perfil, data: data, fichas: statusFichas_() });
  }

  // Público: a ficha consulta se está aberta antes de mostrar o formulário.
  if (action === 'status') {
    return jsonOutput_({ status: 'ok', fichas: statusFichas_() });
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
    if (!perfilDaSenha_(body.senha || '')) {
      return jsonOutput_({ status: 'error', message: 'Senha incorreta.' });
    }
    return atualizarRede_(body);
  }

  if (action === 'delete') {
    const perfil = perfilDaSenha_(body.senha || '');
    if (!perfil) {
      return jsonOutput_({ status: 'error', message: 'Senha incorreta.' });
    }
    if (perfil !== PERFIL_ADMINISTRADOR) {
      return jsonOutput_({ status: 'error', message: 'Apenas o Administrador pode excluir fichas.' });
    }
    return excluirFicha_(body);
  }

  // Liberar / encerrar a liberação das fichas fora do horário (culto especial).
  if (action === 'liberar_fichas' || action === 'encerrar_liberacao') {
    const perfil = perfilDaSenha_(body.senha || '');
    if (!perfil) {
      return jsonOutput_({ status: 'error', message: 'Senha incorreta.' });
    }
    if (perfil !== PERFIL_ADMINISTRADOR) {
      return jsonOutput_({ status: 'error', message: 'Apenas o Administrador pode liberar as fichas.' });
    }
    const props = PropertiesService.getScriptProperties();
    if (action === 'liberar_fichas') {
      const horas = Math.min(Math.max(Number(body.horas) || HORAS_POR_CULTO, 1), 12);
      props.setProperty('FICHAS_LIBERADAS_ATE', String(Date.now() + horas * 3600 * 1000));
    } else {
      props.deleteProperty('FICHAS_LIBERADAS_ATE');
    }
    return jsonOutput_({ status: 'ok', fichas: statusFichas_() });
  }

  return jsonOutput_({ status: 'error', message: 'Ação inválida.' });
}

// ---------------------------------------------------------------
// Lógica
// ---------------------------------------------------------------

/**
 * Diz se a ficha está aberta agora: por estar no horário de algum culto
 * (HORARIOS_CULTOS) ou por uma liberação manual do Administrador.
 */
function statusFichas_() {
  const agora = new Date();
  const liberadoAteMs = Number(PropertiesService.getScriptProperties().getProperty('FICHAS_LIBERADAS_ATE')) || 0;
  const liberado = liberadoAteMs > agora.getTime();
  const base = {
    horarios: TEXTO_HORARIOS_FICHA,
    liberadoAte: liberado ? new Date(liberadoAteMs).toISOString() : null
  };

  if (!BLOQUEIO_HORARIO_ATIVADO) return Object.assign(base, { aberto: true, motivo: 'sem_bloqueio' });
  if (liberado) return Object.assign(base, { aberto: true, motivo: 'liberacao' });

  const culto = cultoEmAndamento_(agora);
  if (culto) return Object.assign(base, { aberto: true, motivo: 'culto', culto: culto.nome });
  return Object.assign(base, { aberto: false, motivo: 'fechado' });
}

function cultoEmAndamento_(data) {
  const fuso = Session.getScriptTimeZone();
  const diaHoje = Number(Utilities.formatDate(data, fuso, 'u')); // 1 = segunda ... 7 = domingo
  const diaOntem = diaHoje === 1 ? 7 : diaHoje - 1;
  const minutosAgora = Number(Utilities.formatDate(data, fuso, 'H')) * 60 + Number(Utilities.formatDate(data, fuso, 'm'));
  const duracao = HORAS_POR_CULTO * 60;

  for (let i = 0; i < HORARIOS_CULTOS.length; i++) {
    const c = HORARIOS_CULTOS[i];
    const partes = c.inicio.split(':');
    const inicio = Number(partes[0]) * 60 + Number(partes[1] || 0);
    const fim = inicio + duracao;
    if (c.dias.indexOf(diaHoje) !== -1 && minutosAgora >= inicio && minutosAgora < fim) return c;
    // Culto que começou ontem e passa da meia-noite.
    if (fim > 1440 && c.dias.indexOf(diaOntem) !== -1 && minutosAgora < fim - 1440) return c;
  }
  return null;
}

function criarFicha_(body) {
  const statusFichas = statusFichas_();
  if (!statusFichas.aberto) {
    return jsonOutput_({
      status: 'error',
      code: 'fichas_fechadas',
      message: 'As fichas estão fechadas fora do horário dos cultos.',
      fichas: statusFichas
    });
  }

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

  // A trava garante que duas fichas enviadas ao mesmo tempo não recebam o
  // mesmo número do dia.
  const lock = LockService.getScriptLock();
  let numeroDoDia = null;
  lock.waitLock(20000);
  try {
    sheet.appendRow(row);
    SpreadsheetApp.flush();
    numeroDoDia = contarFichasDoDia_(sheet, timestamp);
  } finally {
    lock.releaseLock();
  }

  // Não deixa uma falha no Telegram impedir o cadastro da ficha.
  try {
    enviarNotificacoesTelegram_(body, numeroDoDia, timestamp);
  } catch (err) {
    console.error('Falha ao enviar notificações no Telegram: ' + err);
  }

  return jsonOutput_({ status: 'ok', id: id });
}

/**
 * Conta quantas fichas foram cadastradas no mesmo dia de "data" (no fuso
 * horário do projeto), incluindo a que acabou de ser gravada. Assim a
 * numeração recomeça do 1 a cada dia.
 */
function contarFichasDoDia_(sheet, data) {
  const fuso = Session.getScriptTimeZone();
  const diaAlvo = Utilities.formatDate(data, fuso, 'yyyy-MM-dd');
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const tsCol = header.indexOf('timestamp');
  if (tsCol === -1 || sheet.getLastRow() < 2) return null;

  const valores = sheet.getRange(2, tsCol + 1, sheet.getLastRow() - 1, 1).getValues();
  let total = 0;
  valores.forEach(function (linha) {
    const v = linha[0];
    const d = v instanceof Date ? v : (v ? new Date(v) : null);
    if (d && !isNaN(d.getTime()) && Utilities.formatDate(d, fuso, 'yyyy-MM-dd') === diaAlvo) total++;
  });
  return total;
}

/**
 * Monta a mensagem do Telegram (formatada em HTML), por exemplo:
 *
 *   ✝️ NOVA FICHA DE CONSOLIDAÇÃO
 *   🔢 Ficha nº 3 do dia · 19/10/2026 às 19:42
 *
 *   👤 Nome: Maria da Silva
 *   🎂 Idade: 23 anos
 *   📱 Telefone: (11) 99999-9999
 *   📍 Bairro: Centro
 *   🤝 Convidado(a) por: João Souza   (só aparece se foi convidado)
 *
 *   ✅ Ficha preenchida com sucesso!
 */
function montarMensagemTelegram_(dados, numeroDoDia, data) {
  const fuso = Session.getScriptTimeZone();
  const quando = Utilities.formatDate(data, fuso, "dd/MM/yyyy 'às' HH:mm");
  const linhas = [];

  linhas.push('✝️ <b>NOVA FICHA DE CONSOLIDAÇÃO</b>');
  linhas.push(numeroDoDia
    ? '🔢 <b>Ficha nº ' + numeroDoDia + ' do dia</b> · ' + quando
    : '📅 ' + quando);
  linhas.push('');
  linhas.push('👤 <b>Nome:</b> ' + htmlTelegram_(dados.nome_completo || '–'));
  if (dados.idade) linhas.push('🎂 <b>Idade:</b> ' + htmlTelegram_(dados.idade) + ' anos');
  if (dados.telefone) linhas.push('📱 <b>Telefone:</b> ' + htmlTelegram_(dados.telefone));
  if (dados.bairro) linhas.push('📍 <b>Bairro:</b> ' + htmlTelegram_(dados.bairro));
  if (dados.quem_convidou && String(dados.quem_convidou).trim()) {
    linhas.push('🤝 <b>Convidado(a) por:</b> ' + htmlTelegram_(dados.quem_convidou));
  }
  linhas.push('');
  linhas.push('✅ <i>Ficha preenchida com sucesso!</i>');
  return linhas.join('\n');
}

// Escapa os caracteres especiais do modo HTML do Telegram.
function htmlTelegram_(valor) {
  return String(valor).trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function tokenTelegram_() {
  return TELEGRAM_BOT_TOKEN || PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN') || '';
}

/**
 * Envia a notificação de uma nova ficha para cada chat_id cadastrado em
 * TELEGRAM_CHAT_IDS (pessoa ou grupo), via Telegram Bot API. Cada envio é
 * independente — se um chat falhar, os outros ainda recebem a mensagem
 * normalmente.
 */
function enviarNotificacoesTelegram_(dados, numeroDoDia, data) {
  if (!TELEGRAM_NOTIFICACOES_ATIVADO) return;
  const token = tokenTelegram_();
  if (!token) return;
  if (!TELEGRAM_CHAT_IDS || TELEGRAM_CHAT_IDS.length === 0) return;

  const texto = montarMensagemTelegram_(dados, numeroDoDia, data || new Date());
  const url = 'https://api.telegram.org/bot' + token + '/sendMessage';

  TELEGRAM_CHAT_IDS.forEach(function (chatId) {
    try {
      UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/x-www-form-urlencoded',
        payload: { chat_id: String(chatId), text: texto, parse_mode: 'HTML' },
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
    nome_completo: 'Fulano de Tal (teste)',
    idade: '25',
    telefone: '(99) 99999-9999',
    bairro: 'Centro',
    quem_convidou: 'Ciclano (teste)'
  }, 1, new Date());
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

function excluirFicha_(body) {
  if (!body.id) {
    return jsonOutput_({ status: 'error', message: 'ID da ficha não informado.' });
  }

  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  const header = values[0];
  const idCol = header.indexOf('id');

  for (let r = 1; r < values.length; r++) {
    if (values[r][idCol] === body.id) {
      sheet.deleteRow(r + 1);
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

/**
 * Retorna o perfil ('administrador' ou 'gestor') correspondente à senha, ou
 * null se a senha não confere. Senha ainda não configurada = bloqueia acesso.
 */
function perfilDaSenha_(senha) {
  if (!senha) return null;
  const props = PropertiesService.getScriptProperties();
  const senhaAdministrador = props.getProperty('ADMINISTRADOR_PASSWORD');
  // ADMIN_PASSWORD era o nome da senha única na versão anterior: ela continua
  // valendo como senha do Gestor até configurarSenha ser rodada de novo.
  const senhaGestor = props.getProperty('GESTOR_PASSWORD') || props.getProperty('ADMIN_PASSWORD');

  if (senhaAdministrador && senha === senhaAdministrador) return PERFIL_ADMINISTRADOR;
  if (senhaGestor && senha === senhaGestor) return PERFIL_GESTOR;
  return null;
}

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
