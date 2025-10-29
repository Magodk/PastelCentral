// Objeto para armazenar o carrinho: { nome_item: [ {preco: X, sabores: [...] } ] }
let carrinho = {};

// Dados do Cliente (Preenchidos no Modal de Entrada)
let dadosCliente = {
    nome: '',
    whatsapp: ''
}; 

// Dados de Transação
let detalhesTransacao = {
    rua: '',
    numero: '',
    referencia: '',
    pagamento: '',
    trocoPara: 0
};

// Variáveis de Controle
// 'isAdmin' e 'database' são globais, definidas no index.html
let itemPersonalizavelAtual = null; 
let maxSaboresPermitidos = 0; 
let saboresSelecionados = [];
let complementosSelecionados = []; 
let produtoAtualParaComplemento = null; 

// LISTAS GLOBAIS (Carregadas do Firebase)
let listaSaboresDisponiveis = []; 
let listaComplementosDisponiveis = []; 
let cardapioCompleto = {}; 

// Elementos DOM (Acessados globalmente)
const btnGerenciamento = document.getElementById('btn-gerenciamento');
const contadorCarrinho = document.getElementById('contador-carrinho');
const formLoginCliente = document.getElementById('form-login-cliente');


// --- FIREBASE: CARREGAMENTO INICIAL DE DADOS ---
/**
 * Carrega a lista de categorias, produtos, sabores e complementos do Firebase.
 */
function carregarDadosFirebase() {
    // 1. Carregar Cardápio (Categorias e Produtos)
    database.ref('cardapio').on('value', (snapshot) => {
        cardapioCompleto = snapshot.val() || {};
        renderizarCardapio();
        renderizarSelectCategoriasGerenciamento();
        renderizarListaProdutosGerenciamento();
        renderizarListaCategoriasGerenciamento();
    });

    // 2. Carregar Sabores
    database.ref('sabores').on('value', (snapshot) => {
        // Mapeia o objeto de volta para um array de nomes
        listaSaboresDisponiveis = snapshot.val() ? Object.keys(snapshot.val()).map(key => snapshot.val()[key].nome) : [];
        renderizarListaSaboresGerenciamento(); 
    });
    
    // 3. Carregar Complementos
    database.ref('complementos').on('value', (snapshot) => {
        listaComplementosDisponiveis = [];
        snapshot.forEach((childSnapshot) => {
            listaComplementosDisponiveis.push({
                key: childSnapshot.key, 
                nome: childSnapshot.val().nome,
                preco: childSnapshot.val().preco
            });
        });
        renderizarListaComplementosGerenciamento();
    });
}


// --- AUTENTICAÇÃO E CADASTRO COM FIREBASE (Nome e WhatsApp) ---

/**
 * Função para tratar o login/cadastro do cliente.
 */
function handleLoginCliente(event) {
    event.preventDefault();
    const nome = document.getElementById('acesso-rapido-nome').value.trim();
    // Limpa o WhatsApp, removendo caracteres não numéricos
    const whatsapp = document.getElementById('acesso-rapido-whatsapp').value.trim().replace(/\D/g, ''); 

    if (!nome || !whatsapp) {
        alert("Preencha seu Nome e WhatsApp para continuar.");
        return;
    }

    const whatsappKey = whatsapp; 

    // 1. Tenta buscar o usuário no Firebase Realtime Database
    database.ref('clientes/' + whatsappKey).once('value')
        .then((snapshot) => {
            if (snapshot.exists()) {
                // Usuário encontrado (Login)
                const userData = snapshot.val();
                dadosCliente.nome = userData.nome;
                dadosCliente.whatsapp = whatsappKey; 
                isAdmin = !!userData.isAdmin; 
                abrirSessao();
            } else {
                // Usuário não encontrado (Cadastro)
                const novoCliente = {
                    nome: nome,
                    whatsapp: whatsappKey,
                    isAdmin: false 
                };

                // Salva o novo cliente
                database.ref('clientes/' + whatsappKey).set(novoCliente)
                    .then(() => {
                        dadosCliente.nome = nome;
                        dadosCliente.whatsapp = whatsappKey;
                        isAdmin = false;
                        abrirSessao();
                        alert(`Cadastro concluído e acesso liberado, ${nome}!`);
                    })
                    .catch((error) => {
                        console.error("Erro ao cadastrar cliente:", error);
                        alert("Erro ao cadastrar. Tente novamente.");
                    });
            }
        })
        .catch((error) => {
            console.error("Erro ao acessar o banco de dados:", error);
            alert("Erro de conexão. Tente novamente.");
        });
}

/**
 * Função que abre a interface principal e fecha o modal de entrada
 */
function abrirSessao() {
    document.getElementById('modal-entrada').style.display = 'none';
    
    // Atualiza a exibição da aba de Gerenciamento
    if (isAdmin) {
        btnGerenciamento.style.display = 'block';
    } else {
        btnGerenciamento.style.display = 'none';
        alternarAbas('cardapio'); 
    }
}

// --- RENDERIZAÇÃO E LÓGICA DO CARDÁPIO (ADAPTADA AO FIREBASE) ---

/**
 * Renderiza o cardápio com base nos dados do Firebase.
 */
function renderizarCardapio() {
    const cardapioDiv = document.getElementById('aba-cardapio');
    cardapioDiv.innerHTML = '';

    for (const categoriaKey in cardapioCompleto) {
        const categoria = cardapioCompleto[categoriaKey];
        
        const categoriaElement = document.createElement('div');
        categoriaElement.className = 'categoria-cardapio';
        categoriaElement.innerHTML = `<h2 class="categoria-titulo">${categoria.nome}</h2>`;

        for (const produtoKey in categoria.produtos) {
            const produto = categoria.produtos[produtoKey];
            const itemCard = document.createElement('div');
            itemCard.className = 'item-card';
            itemCard.innerHTML = `
                <div class="item-info">
                    <h3>${produto.nome}</h3>
                    ${produto.descricao ? `<p class="item-descricao">${produto.descricao}</p>` : ''}
                    <p class="item-preco">R$ ${produto.preco.toFixed(2).replace('.', ',')}</p>
                </div>
                <div class="item-acao">
                    <button class="btn-adicionar" 
                        data-categoria-key="${categoriaKey}"
                        data-produto-key="${produtoKey}"
                        data-nome="${produto.nome}"
                        data-preco="${produto.preco}"
                        data-max-sabores="${produto.maxSabores || 0}"
                        >
                        ${produto.maxSabores > 0 ? 'Personalizar' : '+ Adicionar'}
                    </button>
                </div>
            `;
            categoriaElement.appendChild(itemCard);
        }

        cardapioDiv.appendChild(categoriaElement);
    }
}

// --- CARRINHO E CHECKOUT ---

/**
 * Adiciona um item ao carrinho.
 */
function adicionarItemAoCarrinho(produto, sabores = [], complementos = []) {
    const itemKey = produto.nome; 

    // 1. Calcular o preço total do item (Base + Complementos)
    let precoTotal = produto.preco;
    const listaComplementosNomes = complementos.map(c => {
        precoTotal += c.preco;
        return c.nome;
    });
    
    // 2. Montar a descrição única do item no carrinho
    let descricaoSabores = sabores.length > 0 ? ` Sabores: (${sabores.join(', ')})` : '';
    let descricaoComplementos = listaComplementosNomes.length > 0 ? ` + Adicionais: (${listaComplementosNomes.join(', ')})` : '';
    const itemDescricao = `${itemKey}${descricaoSabores}${descricaoComplementos}`;
    
    // 3. Estrutura do item
    const itemCarrinho = {
        nome: itemKey,
        descricaoUnica: itemDescricao,
        precoUnitario: precoTotal,
        sabores: sabores,
        complementos: complementos
    };

    // 4. Adicionar ao carrinho (cada personalização/adição é um novo item)
    if (!carrinho[itemDescricao]) {
        carrinho[itemDescricao] = [];
    }
    carrinho[itemDescricao].push(itemCarrinho);

    renderizarCarrinho();
}

/**
 * Renderiza a lista de itens no carrinho.
 */
function renderizarCarrinho() {
    const listaCarrinho = document.getElementById('lista-carrinho');
    listaCarrinho.innerHTML = '';
    let subtotal = 0;
    let totalItens = 0;

    for (const itemDescricao in carrinho) {
        const grupo = carrinho[itemDescricao];
        if (grupo.length === 0) continue;

        const itemBase = grupo[0]; 
        const quantidade = grupo.length;
        const precoTotalItem = itemBase.precoUnitario * quantidade;
        subtotal += precoTotalItem;
        totalItens += quantidade;

        const li = document.createElement('li');
        li.innerHTML = `
            <span>${quantidade}x ${itemBase.descricaoUnica}</span>
            <span class="preco-item">
                R$ ${precoTotalItem.toFixed(2).replace('.', ',')}
                <div class="quantidade-controle">
                    <button class="adicionar-personalizado" data-key="${itemDescricao}" data-acao="remover">-</button>
                    <span class="quantidade">${quantidade}</span>
                    <button class="adicionar-personalizado" data-key="${itemDescricao}" data-acao="adicionar">+</button>
                </div>
            </span>
        `;
        listaCarrinho.appendChild(li);
    }

    // Atualizar rodapé e contador
    document.getElementById('carrinho-subtotal').textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
    document.getElementById('carrinho-total').textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`; 
    contadorCarrinho.textContent = totalItens;

    // Desabilitar botão de checkout se o carrinho estiver vazio
    const finalizarBtn = document.getElementById('finalizar-pedido-btn-form');
    finalizarBtn.disabled = totalItens === 0;

    if (totalItens === 0) {
        listaCarrinho.innerHTML = '<li class="carrinho-vazio">Seu carrinho está vazio.</li>';
    }
}

/**
 * Função para remover um único item (ou um grupo se count for zero) do carrinho.
 */
function removerItemDoCarrinho(itemDescricao, count = 1) {
    if (carrinho[itemDescricao]) {
        if (carrinho[itemDescricao].length <= count || count === 0) {
            delete carrinho[itemDescricao];
        } else {
            carrinho[itemDescricao].splice(0, count);
        }
    }
    renderizarCarrinho();
}


// --- LÓGICA DE SABORES E COMPLEMENTOS ---

/**
 * Abre o modal de sabores.
 */
function abrirModalSabores(produto, categoriaKey, produtoKey) {
    itemPersonalizavelAtual = { ...produto, categoriaKey, produtoKey };
    maxSaboresPermitidos = produto.maxSabores;
    saboresSelecionados = []; // Limpar seleções anteriores
    
    const modal = document.getElementById('modal-sabores');
    const titulo = document.getElementById('sabores-modal-titulo');
    const info = document.getElementById('sabores-modal-info');
    const opcoesDiv = document.getElementById('sabores-opcoes');
    const contador = document.getElementById('sabores-contador');

    titulo.textContent = `Escolha seus Sabores para ${produto.nome}`;
    info.textContent = `Selecione até ${maxSaboresPermitidos} sabor(es).`;
    contador.textContent = `Sabores escolhidos: 0 de ${maxSaboresPermitidos}`;
    document.getElementById('finalizar-sabores-btn').disabled = true;

    opcoesDiv.innerHTML = '';
    
    listaSaboresDisponiveis.forEach(saborNome => {
        const saborBtn = document.createElement('button');
        saborBtn.className = 'sabor-opcao';
        saborBtn.textContent = saborNome;
        saborBtn.dataset.sabor = saborNome;
        
        saborBtn.addEventListener('click', (e) => {
            const sabor = e.target.dataset.sabor;
            e.target.classList.toggle('selecionado');
            gerenciarSelecaoSabor(sabor);
        });
        opcoesDiv.appendChild(saborBtn);
    });

    modal.style.display = 'block';
}

/**
 * Gerencia a seleção de sabores e atualiza o contador.
 */
function gerenciarSelecaoSabor(sabor) {
    const index = saboresSelecionados.indexOf(sabor);
    if (index > -1) {
        saboresSelecionados.splice(index, 1);
    } else {
        if (saboresSelecionados.length < maxSaboresPermitidos) {
            saboresSelecionados.push(sabor);
        } else {
            // Se tentar adicionar mais, desfaz a seleção visual no botão
            const btn = document.querySelector(`.sabor-opcao[data-sabor="${sabor}"]`);
            if (btn) btn.classList.remove('selecionado');
            alert(`Você só pode selecionar até ${maxSaboresPermitidos} sabor(es).`);
            return;
        }
    }
    
    document.getElementById('sabores-contador').textContent = `Sabores escolhidos: ${saboresSelecionados.length} de ${maxSaboresPermitidos}`;
    
    const finalizarBtn = document.getElementById('finalizar-sabores-btn');
    finalizarBtn.disabled = saboresSelecionados.length === 0 || saboresSelecionados.length > maxSaboresPermitidos;
}


// Botão de finalizar sabores (AGORA ABRE COMPLEMENTOS)
document.getElementById('finalizar-sabores-btn').addEventListener('click', () => {
    if (saboresSelecionados.length > 0 && saboresSelecionados.length <= maxSaboresPermitidos) {
        document.getElementById('modal-sabores').style.display = 'none';
        // Redireciona para o modal de complementos
        abrirModalComplementos(itemPersonalizavelAtual); 
    } else {
        alert(`Selecione entre 1 e ${maxSaboresPermitidos} sabor(es).`);
    }
});


/**
 * Abre o modal de complementos e renderiza as opções.
 */
function abrirModalComplementos(produto) {
    produtoAtualParaComplemento = produto; 
    complementosSelecionados = []; // Reinicia a seleção

    const modal = document.getElementById('modal-complementos');
    const titulo = document.getElementById('complementos-modal-titulo');
    const info = document.getElementById('complementos-modal-info');
    const opcoesDiv = document.getElementById('complementos-opcoes');

    titulo.textContent = `Complementos para ${produto.nome}`;
    info.textContent = `Preço Base: R$ ${produto.preco.toFixed(2).replace('.', ',')}. Escolha os adicionais.`;

    opcoesDiv.innerHTML = '';
    
    if (listaComplementosDisponiveis.length === 0) {
        opcoesDiv.innerHTML = '<p style="text-align: center; color: #666;">Nenhum complemento disponível no momento.</p>';
    } else {
        listaComplementosDisponiveis.forEach(comp => {
            const item = document.createElement('div');
            item.className = 'complemento-item-opcao';
            item.dataset.key = comp.key; 
            item.dataset.nome = comp.nome;
            item.dataset.preco = comp.preco;
            
            item.innerHTML = `
                <div class="complemento-info">
                    <h4>${comp.nome}</h4>
                    <p>Adicional</p>
                </div>
                <span class="complemento-preco">R$ ${comp.preco.toFixed(2).replace('.', ',')}</span>
            `;

            item.addEventListener('click', (e) => {
                item.classList.toggle('selecionado');
                gerenciarSelecaoComplemento(item.dataset.nome, parseFloat(item.dataset.preco), item.dataset.key);
            });
            opcoesDiv.appendChild(item);
        });
    }

    modal.style.display = 'block';
}

/**
 * Adiciona/remove um complemento da lista de seleção.
 */
function gerenciarSelecaoComplemento(nome, preco, key) {
    const index = complementosSelecionados.findIndex(c => c.key === key); 
    if (index > -1) {
        complementosSelecionados.splice(index, 1);
    } else {
        complementosSelecionados.push({ nome, preco, key });
    }
}

// Botão para adicionar o item (com sabores e complementos) ao carrinho
document.getElementById('finalizar-complementos-btn').addEventListener('click', () => {
    document.getElementById('modal-complementos').style.display = 'none';
    
    if (produtoAtualParaComplemento) {
        // Adiciona ao carrinho com sabores E complementos selecionados
        adicionarItemAoCarrinho(produtoAtualParaComplemento, saboresSelecionados, complementosSelecionados);
        
        // Limpar variáveis de controle
        saboresSelecionados = [];
        complementosSelecionados = [];
        produtoAtualParaComplemento = null;
    }
});


// --- LÓGICA DE GERENCIAMENTO (FIREBASE) ---

const formAdicionarCategoria = document.getElementById('form-adicionar-categoria');
const formAdicionarSabor = document.getElementById('form-adicionar-sabor');
const formAdicionarProduto = document.getElementById('form-adicionar-produto');
const formAdicionarComplemento = document.getElementById('form-adicionar-complemento');

// CATEGORIAS
function criarChave(nome) {
    return nome.toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s/g, '_');
}

function adicionarCategoria(event) {
    event.preventDefault();
    const nome = document.getElementById('input-nome-categoria').value.trim();
    if (!nome) return;

    const categoriaKey = criarChave(nome);
    database.ref('cardapio/' + categoriaKey).set({ nome: nome })
        .then(() => formAdicionarCategoria.reset())
        .catch(e => alert("Erro ao adicionar categoria: " + e.message));
}

function removerCategoria(categoriaKey) {
    database.ref('cardapio/' + categoriaKey).remove()
        .then(() => alert(`Categoria removida!`))
        .catch(e => alert("Erro ao remover categoria: " + e.message));
}

function renderizarListaCategoriasGerenciamento() {
    const lista = document.getElementById('lista-categorias-atuais');
    lista.innerHTML = '';
    const categorias = Object.keys(cardapioCompleto);
    if (categorias.length === 0) {
        lista.innerHTML = '<li class="nenhum-item">Nenhuma categoria cadastrada.</li>';
        return;
    }
    categorias.forEach(key => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${cardapioCompleto[key].nome}</span>
            <button class="item-gerenciar-remover-btn" data-key="${key}" title="Remover">&times;</button>
        `;
        lista.appendChild(li);
    });
}

// PRODUTOS
function adicionarProduto(event) {
    event.preventDefault();
    const categoriaKey = document.getElementById('select-categoria-produto').value;
    const nome = document.getElementById('input-nome-produto').value.trim();
    const preco = parseFloat(document.getElementById('input-preco-produto').value);
    const maxSabores = parseInt(document.getElementById('input-max-sabores').value);
    const descricao = document.getElementById('input-descricao-produto').value.trim();

    if (!categoriaKey || !nome || isNaN(preco) || preco <= 0) {
        alert("Preencha todos os campos obrigatórios com valores válidos.");
        return;
    }

    const produtoKey = criarChave(nome);
    database.ref(`cardapio/${categoriaKey}/produtos/${produtoKey}`).set({
        nome: nome,
        descricao: descricao,
        preco: preco,
        maxSabores: maxSabores || 0
    })
    .then(() => formAdicionarProduto.reset())
    .catch(e => alert("Erro ao adicionar produto: " + e.message));
}

function removerProdutoDoCardapio(categoriaKey, produtoKey) {
    database.ref(`cardapio/${categoriaKey}/produtos/${produtoKey}`).remove()
        .then(() => alert(`Produto removido!`))
        .catch(e => alert("Erro ao remover produto: " + e.message));
}

function renderizarSelectCategoriasGerenciamento() {
    const select = document.getElementById('select-categoria-produto');
    select.innerHTML = '<option value="">Selecione a Categoria</option>';
    for (const key in cardapioCompleto) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = cardapioCompleto[key].nome;
        select.appendChild(option);
    }
}

function renderizarListaProdutosGerenciamento() {
    const lista = document.getElementById('lista-produtos-gerenciar');
    lista.innerHTML = '';
    let totalProdutos = 0;

    for (const categoriaKey in cardapioCompleto) {
        const categoria = cardapioCompleto[categoriaKey];
        for (const produtoKey in categoria.produtos) {
            const produto = categoria.produtos[produtoKey];
            totalProdutos++;
            const li = document.createElement('li');
            li.innerHTML = `
                <span>[${categoria.nome}] ${produto.nome} (R$ ${produto.preco.toFixed(2).replace(',', ',')})</span>
                <button class="item-gerenciar-remover-btn" data-categoria-key="${categoriaKey}" data-produto-key="${produtoKey}" title="Remover">&times;</button>
            `;
            lista.appendChild(li);
        }
    }
    if (totalProdutos === 0) {
        lista.innerHTML = '<li class="nenhum-item">Nenhum produto cadastrado.</li>';
    }
}

// SABORES
function adicionarSabor(event) {
    event.preventDefault();
    const nome = document.getElementById('input-nome-sabor').value.trim();
    if (!nome) return;

    const saborKey = criarChave(nome);
    database.ref('sabores/' + saborKey).set({ nome: nome })
        .then(() => formAdicionarSabor.reset())
        .catch(e => alert("Erro ao adicionar sabor: " + e.message));
}

function removerSabor(saborKey) {
    database.ref('sabores/' + saborKey).remove()
        .then(() => alert(`Sabor removido!`))
        .catch(e => alert("Erro ao remover sabor: " + e.message));
}

function renderizarListaSaboresGerenciamento() {
    const lista = document.getElementById('lista-sabores-atuais');
    lista.innerHTML = '';
    if (listaSaboresDisponiveis.length === 0) {
        lista.innerHTML = '<li class="nenhum-item">Nenhum sabor cadastrado.</li>';
        return;
    }

    listaSaboresDisponiveis.forEach(nome => {
        const saborKey = criarChave(nome);
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${nome}</span>
            <button class="remover-sabor-btn" data-key="${saborKey}" title="Remover">&times;</button>
        `;
        lista.appendChild(li);
    });
}

// COMPLEMENTOS
function adicionarComplemento(event) {
    event.preventDefault();
    const nome = document.getElementById('input-nome-complemento').value.trim();
    const preco = parseFloat(document.getElementById('input-preco-complemento').value);

    if (!nome || isNaN(preco) || preco <= 0) {
        alert("Preencha o nome e um preço válido (maior que zero).");
        return;
    }

    const complementoKey = criarChave(nome); 

    database.ref('complementos/' + complementoKey).set({
        nome: nome,
        preco: preco
    })
    .then(() => {
        alert(`Complemento "${nome}" adicionado com sucesso.`);
        formAdicionarComplemento.reset();
    })
    .catch((error) => {
        console.error("Erro ao adicionar complemento:", error);
        alert("Erro ao adicionar complemento.");
    });
}

function removerComplemento(complementoKey) {
    database.ref('complementos/' + complementoKey).remove()
        .then(() => {
            alert(`Complemento removido com sucesso.`);
        })
        .catch((error) => {
            console.error("Erro ao remover complemento:", error);
            alert("Erro ao remover complemento.");
        });
}

function renderizarListaComplementosGerenciamento() {
    const lista = document.getElementById('lista-complementos-atuais');
    lista.innerHTML = '';
    
    if (listaComplementosDisponiveis.length === 0) {
        lista.innerHTML = '<li class="nenhum-item">Nenhum complemento cadastrado.</li>';
        return;
    }

    listaComplementosDisponiveis.forEach(comp => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${comp.nome} (R$ ${comp.preco.toFixed(2).replace('.', ',')})</span>
            <button class="remover-complemento-btn" data-key="${comp.key}" title="Remover">&times;</button>
        `;
        lista.appendChild(li);
    });
}


// --- INICIALIZAÇÃO E OUVINTES ---

document.addEventListener('DOMContentLoaded', () => {
    carregarDadosFirebase();
    renderizarCarrinho();
    
    // --- Ouvintes de Login/Cadastro ---
    if(formLoginCliente) {
        formLoginCliente.addEventListener('submit', handleLoginCliente);
    }

    // --- Ouvintes do Cardápio (Adicionar Produto) ---
    document.getElementById('aba-cardapio').addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('btn-adicionar')) {
            const categoriaKey = target.dataset.categoriaKey;
            const produtoKey = target.dataset.produtoKey;
            const produto = cardapioCompleto[categoriaKey].produtos[produtoKey];
            const maxSabores = parseInt(target.dataset.maxSabores);

            if (maxSabores > 0) {
                abrirModalSabores(produto, categoriaKey, produtoKey);
            } else {
                adicionarItemAoCarrinho(produto);
            }
        }
    });

    // --- Ouvintes do Gerenciamento ---

    // Categorias
    formAdicionarCategoria.addEventListener('submit', adicionarCategoria);
    document.getElementById('lista-categorias-atuais').addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('item-gerenciar-remover-btn')) {
            const key = target.dataset.key;
            if (confirm(`Tem certeza que deseja remover a categoria? Isso removerá todos os produtos dela!`)) {
                 removerCategoria(key);
            }
        }
    });

    // Produtos
    formAdicionarProduto.addEventListener('submit', adicionarProduto);
    document.getElementById('lista-produtos-gerenciar').addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('item-gerenciar-remover-btn')) {
            const categoriaKey = target.dataset.categoriaKey;
            const produtoKey = target.dataset.produtoKey;
            if (confirm(`Tem certeza que deseja remover o produto "${produtoKey}" do cardápio?`)) {
                 removerProdutoDoCardapio(categoriaKey, produtoKey);
            }
        }
    });
    
    // Sabores
    formAdicionarSabor.addEventListener('submit', adicionarSabor);
    document.getElementById('lista-sabores-atuais').addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('remover-sabor-btn')) {
            const saborKey = target.dataset.key;
            if (confirm(`Tem certeza que deseja remover o sabor?`)) {
                removerSabor(saborKey);
            }
        }
    });

    // Complementos
    formAdicionarComplemento.addEventListener('submit', adicionarComplemento);
    document.getElementById('lista-complementos-atuais').addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('remover-complemento-btn')) {
            const complementoKey = target.dataset.key;
            if (confirm(`Tem certeza que deseja remover o complemento?`)) {
                removerComplemento(complementoKey);
            }
        }
    });

    // --- Ouvintes Gerais ---

    // Ouvinte para os botões de Aba
    document.getElementById('tab-cardapio').addEventListener('click', () => alternarAbas('cardapio'));
    document.getElementById('tab-carrinho').addEventListener('click', () => alternarAbas('carrinho'));
    btnGerenciamento.addEventListener('click', () => {
        if (isAdmin) {
            alternarAbas('gerenciamento');
        } else {
            alert('Acesso negado! A aba de Gerenciamento é exclusiva para Administradores.');
        }
    });

    // Ouvinte do Carrinho (Botões + / -)
    document.getElementById('lista-carrinho').addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('adicionar-personalizado')) {
            const itemKey = target.dataset.key;
            const acao = target.dataset.acao;
            if (acao === 'adicionar') {
                const itemParaDuplicar = carrinho[itemKey][0];
                adicionarItemAoCarrinho(itemParaDuplicar, itemParaDuplicar.sabores, itemParaDuplicar.complementos);
            } else if (acao === 'remover') {
                removerItemDoCarrinho(itemKey, 1); 
            }
        }
    });
    
    // Lógica do Modal Troco e Checkout 
    const selectPagamento = document.getElementById('select-pagamento');
    const containerTroco = document.getElementById('container-troco');
    selectPagamento.addEventListener('change', (e) => {
        detalhesTransacao.pagamento = e.target.value;
        containerTroco.style.display = e.target.value === 'dinheiro' ? 'block' : 'none';
        document.getElementById('input-valor-pago').required = e.target.value === 'dinheiro';
    });

    document.getElementById('form-checkout').addEventListener('submit', finalizarPedido);

    // Fechar Modais (Complementos e Sabores)
    document.querySelectorAll('.fechar-sabores').forEach(span => {
        span.onclick = () => {
            document.getElementById('modal-sabores').style.display = 'none';
            // Limpa seleção se o usuário fechar a modal
            saboresSelecionados = [];
        }
    });
    document.querySelectorAll('.fechar-complementos').forEach(span => {
        span.onclick = () => {
            document.getElementById('modal-complementos').style.display = 'none';
            // Se fechar os complementos, o item não é adicionado, então limpa tudo
            saboresSelecionados = [];
            complementosSelecionados = [];
            produtoAtualParaComplemento = null;
        }
    });

}); // Fim do DOMContentLoaded


// --- Funções Auxiliares ---

/**
 * Função para alternar entre as abas principais.
 */
function alternarAbas(aba) {
    document.querySelectorAll('.conteudo-aba').forEach(div => div.style.display = 'none');
    document.querySelectorAll('.aba-btn').forEach(btn => btn.classList.remove('active'));

    // Ajusta o ID para o botão de Gerenciamento
    const btnId = aba === 'gerenciamento' ? 'btn-gerenciamento' : `tab-${aba}`;

    document.getElementById(`aba-${aba}`).style.display = 'block';
    const targetButton = document.getElementById(btnId);
    if (targetButton) {
        targetButton.classList.add('active');
    }
}

/**
 * Monta a mensagem final e envia para o WhatsApp.
 */
function finalizarPedido(event) {
    event.preventDefault();

    // 1. Coletar dados de endereço e pagamento
    detalhesTransacao.rua = document.getElementById('input-rua').value.trim();
    detalhesTransacao.numero = document.getElementById('input-numero').value.trim();
    detalhesTransacao.referencia = document.getElementById('input-referencia').value.trim();
    detalhesTransacao.pagamento = document.getElementById('select-pagamento').value;
    const inputTroco = document.getElementById('input-valor-pago');
    detalhesTransacao.trocoPara = detalhesTransacao.pagamento === 'dinheiro' ? parseFloat(inputTroco.value) || 0 : 0;
    
    if (Object.keys(carrinho).length === 0) {
        alert("O carrinho está vazio.");
        return;
    }
    
    // 2. Montar o texto do pedido
    let textoPedido = `*PEDIDO ONLINE - ${dadosCliente.nome}*\n\n`;
    textoPedido += `*📞 WhatsApp:* ${dadosCliente.whatsapp}\n\n`;
    textoPedido += `*--- ITENS DO PEDIDO (${contadorCarrinho.textContent}) ---*\n`;

    let subtotal = 0;
    for (const itemDescricao in carrinho) {
        const grupo = carrinho[itemDescricao];
        if (grupo.length > 0) {
            const quantidade = grupo.length;
            const precoUnitario = grupo[0].precoUnitario;
            const precoTotalItem = precoUnitario * quantidade;
            subtotal += precoTotalItem;
            
            // Item principal já contém sabores e complementos na descrição
            textoPedido += `\n*${quantidade}x ${itemDescricao}*`;
            textoPedido += `\nPreço: R$ ${precoTotalItem.toFixed(2).replace('.', ',')}`;
        }
    }

    // 3. Montar o resumo e detalhes
    textoPedido += `\n\n*--- RESUMO ---*\n`;
    textoPedido += `Subtotal: R$ ${subtotal.toFixed(2).replace('.', ',')}\n`;
    textoPedido += `*TOTAL ESTIMADO: R$ ${subtotal.toFixed(2).replace('.', ',')}*\n`;
    textoPedido += `Taxa de Entrega: a confirmar pela loja.\n\n`;

    textoPedido += `*--- ENDEREÇO DE ENTREGA ---*\n`;
    textoPedido += `*Rua/Bairro:* ${detalhesTransacao.rua}, Nº ${detalhesTransacao.numero}\n`;
    if (detalhesTransacao.referencia) {
        textoPedido += `*Referência:* ${detalhesTransacao.referencia}\n`;
    }

    textoPedido += `\n*--- PAGAMENTO ---*\n`;
    textoPedido += `*Forma:* ${detalhesTransacao.pagamento.toUpperCase()}\n`;
    
    if (detalhesTransacao.pagamento === 'dinheiro') {
        const troco = detalhesTransacao.trocoPara > subtotal ? detalhesTransacao.trocoPara - subtotal : 0;
        textoPedido += `*Valor para Troco:* R$ ${detalhesTransacao.trocoPara.toFixed(2).replace('.', ',')}\n`;
        if (troco > 0) {
             textoPedido += `(Troco aproximado de: R$ ${troco.toFixed(2).replace('.', ',')})\n`;
        }
    }
    
    // 4. Envio (SUBSTITUA ESTE NÚMERO PELO WHATSAPP DA LOJA)
    const numeroLoja = "5581999998888"; // **SUBSTITUA PELO WHATSAPP DA SUA LOJA**
    const urlWhatsApp = `https://wa.me/${numeroLoja}?text=${encodeURIComponent(textoPedido)}`;

    window.open(urlWhatsApp, '_blank');
}