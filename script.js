// ====================================================================
// --- CONFIGURAÇÃO E VARIÁVEIS DE CONTROLE ---
// ====================================================================

// Variáveis Firebase
let firebaseApp;
let db;

// Variáveis de Dados
let carrinho = {};
let dadosCliente = { nome: '', whatsapp: '', email: '' }; 
let detalhesTransacao = {
    tipoEntrega: '', localidadeNome: '', taxaEntrega: 0, 
    rua: '', numero: '', referencia: '', pagamento: '', trocoPara: 0
};

// Variáveis de Controle
let acessoGerenciamentoLiberado = false;
let itemPersonalizavelAtual = null; 
let maxSaboresPermitidos = 0; 
let saboresSelecionados = [];
let complementosSelecionados = []; 
const MAX_COMPLEMENTOS_PERMITIDOS = 5; 

// Credencial Fixa (Para acesso Admin Local)
const NOME_ADMIN = "zeze"; 
const EMAIL_ADMIN = "acesso@telaprincipal.com"; 
const CLIENTE = "telaprincipal"; 

// Variáveis Globais de Cache (Dados do Firebase)
let produtosCardapio = [];
let listaSaboresDisponiveis = [];
let listaComplementosDisponiveis = []; 
let listaLocalidadesDisponiveis = []; 


// ====================================================================
// --- FUNÇÕES DE PERSISTÊNCIA E FIREBASE ---
// ====================================================================

// Função de Inicialização do Firebase (Chamada em DOMContentLoaded)
function initializeFirebase() {
    // CORREÇÃO: Lê as chaves do HTML para configurar o Firebase
    const firebaseConfig = {
        apiKey: document.getElementById('firebase-api-key').value,
        projectId: document.getElementById('firebase-project-id').value,
        appId: document.getElementById('firebase-app-id').value,
        authDomain: `${document.getElementById('firebase-project-id').value}.firebaseapp.com`,
    };

    // Verifica se as chaves foram preenchidas (chave padrão indica que precisa ser configurada)
    if (firebaseConfig.apiKey === 'COLE_SUA_API_KEY_AQUI' || firebaseConfig.projectId === 'pc-db-1813a') {
        console.error("ERRO: Configure as chaves do Firebase no index.html antes de iniciar.");
        alert("ERRO: Configure as chaves do Firebase no index.html.");
        return; 
    }

    try {
        firebaseApp = firebase.initializeApp(firebaseConfig);
        db = firebaseApp.firestore();
        console.log("Firebase Inicializado com Sucesso.");
    } catch (error) {
        console.error("Erro ao inicializar Firebase:", error);
    }
}

// --------------------------------------------------
// FUNÇÕES DE LEITURA (Carrega dados do Firestore)
// --------------------------------------------------

async function fetchCollectionData(collectionName, defaultData) {
    if (!db) return defaultData;

    try {
        const snapshot = await db.collection(collectionName).get();
        if (snapshot.empty) {
            // Se a coleção estiver vazia, preenche com dados padrão (se houver)
            if (defaultData && defaultData.length > 0) {
                for (const item of defaultData) {
                    await db.collection(collectionName).add(item);
                }
                // Recarrega após preencher
                const newSnapshot = await db.collection(collectionName).get();
                return newSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }
            return [];
        }
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error(`Erro ao carregar dados de ${collectionName}. Verifique as regras de segurança do Firestore.`, error);
        return []; // Retorna vazio em caso de erro de conexão/regra
    }
}

async function carregarDadosDoFirebase() {
    // Dados padrão para popular o Firestore na primeira vez
    const defaultProdutos = [
        { nome: "Pastel Gourmet (Escolha 5 Sabores)", preco: "30.00", categoria: "pastel", personalizavel: "sim", maxSabores: "5", descricao: "Selecione 5 sabores exclusivos para o seu pastel perfeito!" },
        { nome: "Pastel de Carne com Queijo", preco: "8.50", categoria: "pastel", personalizavel: "nao", descricao: "Deliciosa carne moída temperada com queijo derretido." },
        { nome: "Coca-Cola Lata 350ml", preco: "6.00", categoria: "bebidas", personalizavel: "nao", descricao: "Aquele clássico que refresca a qualquer hora." },
    ];
    const defaultSabores = ["Carne", "Frango", "4 Queijos", "Chocolate", "Goiabada"];
    const defaultComplementos = ["Catupiry", "Cheddar", "Bacon"]; 
    const defaultLocalidades = [{ nome: "Centro (Exemplo)", taxa: 5.00 }, { nome: "Área Rural (Exemplo)", taxa: 15.00 }];

    // Carrega/inicializa os dados no Firebase
    produtosCardapio = await fetchCollectionData('produtos', defaultProdutos);
    listaSaboresDisponiveis = (await fetchCollectionData('sabores', defaultSabores.map(s => ({ nome: s })))).map(s => s.nome).sort();
    listaComplementosDisponiveis = (await fetchCollectionData('complementos', defaultComplementos.map(c => ({ nome: c })))).map(c => c.nome).sort();
    listaLocalidadesDisponiveis = (await fetchCollectionData('localidades', defaultLocalidades)).sort((a, b) => a.nome.localeCompare(b.nome));
}

// --------------------------------------------------
// FUNÇÕES VAZIAS (Removidas/Substituídas no Firebase)
// --------------------------------------------------

function salvarProdutosLocais() { /* Não é mais necessário, a escrita é direta no Firebase */ }
function salvarSaboresLocais() { /* Não é mais necessário */ }
function salvarComplementosLocais() { /* Não é mais necessário */ }
function salvarLocalidadesLocais() { /* Não é mais necessário */ }


// ====================================================================
// --- FUNÇÕES DE RENDERIZAÇÃO E CRUD (ADMIN) ---
// ====================================================================

// --- 1. PRODUTOS (ADICIONAR/REMOVER) ---

async function carregarCardapioDaAPI() {
    if (!db) {
        // Se o Firebase não estiver pronto, usa um array vazio e renderiza
        produtosCardapio = []; 
        renderizarCardapio();
        return;
    }
    
    // Recarrega todos os dados
    await carregarDadosDoFirebase();
    
    renderizarCardapio();
    if (acessoGerenciamentoLiberado) {
        renderizarListaGerenciamento();
    }
}

async function adicionarProdutoAoCardapio(event) {
    event.preventDefault();
    
    if (!db || !acessoGerenciamentoLiberado) {
        alert("Acesso negado ou Firebase não conectado.");
        return;
    }

    const nome = document.getElementById('nome-produto').value.trim();
    const preco = parseFloat(document.getElementById('preco-produto').value).toFixed(2);
    const categoria = document.getElementById('categoria-produto').value;
    const descricao = document.getElementById('descricao-produto').value.trim();
    const isPersonalizavel = document.getElementById('is-personalizavel').checked ? 'sim' : 'nao';
    const maxSabores = document.getElementById('max-sabores').value;

    if (produtosCardapio.some(p => p.nome.toLowerCase() === nome.toLowerCase())) {
        alert("Já existe um produto com este nome.");
        return;
    }

    const novoProduto = {
        nome: nome,
        preco: preco,
        categoria: categoria,
        descricao: descricao,
        personalizavel: isPersonalizavel,
        maxSabores: isPersonalizavel === 'sim' ? maxSabores : '0',
    };

    try {
        await db.collection("produtos").add(novoProduto);
        alert(`Produto "${nome}" adicionado com sucesso ao cardápio!`);
        document.getElementById('adicionar-produto-form').reset();
        await carregarCardapioDaAPI(); // Recarrega e renderiza
    } catch (error) {
        console.error("Erro ao adicionar produto:", error);
        alert("Erro ao adicionar produto. Verifique as regras de segurança do Firebase (deve ser 'allow read, write: if true').");
    }
}

async function removerProdutoDoCardapio(nomeProduto) {
    if (!db || !acessoGerenciamentoLiberado) return;

    try {
        const produto = produtosCardapio.find(p => p.nome === nomeProduto);
        if (produto && produto.id) {
            await db.collection("produtos").doc(produto.id).delete();
            await carregarCardapioDaAPI(); 
            alert(`Produto "${nomeProduto}" removido com sucesso.`);
        } else {
            alert("Produto não encontrado no banco de dados.");
        }
    } catch (error) {
        console.error("Erro ao remover produto:", error);
        alert("Erro ao remover produto. Verifique as regras de segurança do Firebase.");
    }
}

// --- 2. SABORES (ADICIONAR/REMOVER) ---

async function adicionarSabor(event) {
    event.preventDefault();
    if (!db || !acessoGerenciamentoLiberado) return;

    const saborNome = document.getElementById('novo-sabor-input').value.trim();
    if (listaSaboresDisponiveis.some(s => s.toLowerCase() === saborNome.toLowerCase())) {
        alert("Este sabor já existe.");
        return;
    }

    try {
        await db.collection("sabores").add({ nome: saborNome });
        alert(`Sabor "${saborNome}" adicionado com sucesso!`);
        document.getElementById('adicionar-sabor-form').reset();
        await carregarCardapioDaAPI(); 
        renderizarListaSaboresGerenciamento(); 
    } catch (error) {
        console.error("Erro ao adicionar sabor:", error);
        alert("Erro ao adicionar sabor. Verifique as regras de segurança do Firebase.");
    }
}

async function removerSabor(saborNome) {
    if (!db || !acessoGerenciamentoLiberado) return;

    try {
        // Busca o documento pelo campo 'nome' para obter o ID
        const snapshot = await db.collection("sabores").where("nome", "==", saborNome).get();
        if (!snapshot.empty) {
            await db.collection("sabores").doc(snapshot.docs[0].id).delete();
            await carregarCardapioDaAPI(); 
            renderizarListaSaboresGerenciamento(); 
            alert(`Sabor "${saborNome}" removido com sucesso.`);
        }
    } catch (error) {
        console.error("Erro ao remover sabor:", error);
        alert("Erro ao remover sabor. Verifique as regras de segurança do Firebase.");
    }
}

// --- 3. COMPLEMENTOS (ADICIONAR/REMOVER) ---

async function adicionarComplemento(event) {
    event.preventDefault();
    if (!db || !acessoGerenciamentoLiberado) return;

    const complementoNome = document.getElementById('novo-complemento-input').value.trim();
    if (listaComplementosDisponiveis.some(c => c.toLowerCase() === complementoNome.toLowerCase())) {
        alert("Este complemento já existe.");
        return;
    }

    try {
        await db.collection("complementos").add({ nome: complementoNome });
        alert(`Complemento "${complementoNome}" adicionado com sucesso!`);
        document.getElementById('adicionar-complemento-form').reset();
        await carregarCardapioDaAPI(); 
        renderizarListaComplementosGerenciamento(); 
    } catch (error) {
        console.error("Erro ao adicionar complemento:", error);
        alert("Erro ao adicionar complemento. Verifique as regras de segurança do Firebase.");
    }
}

async function removerComplemento(complementoNome) {
    if (!db || !acessoGerenciamentoLiberado) return;

    try {
        const snapshot = await db.collection("complementos").where("nome", "==", complementoNome).get();
        if (!snapshot.empty) {
            await db.collection("complementos").doc(snapshot.docs[0].id).delete();
            await carregarCardapioDaAPI(); 
            renderizarListaComplementosGerenciamento(); 
            alert(`Complemento "${complementoNome}" removido com sucesso.`);
        }
    } catch (error) {
        console.error("Erro ao remover complemento:", error);
        alert("Erro ao remover complemento. Verifique as regras de segurança do Firebase.");
    }
}

// --- 4. LOCALIDADES (ADICIONAR/REMOVER) ---

async function adicionarLocalidade(event) {
    event.preventDefault();
    if (!db || !acessoGerenciamentoLiberado) return;

    const localidadeNome = document.getElementById('novo-localidade-input').value.trim();
    const taxa = parseFloat(document.getElementById('taxa-localidade-input').value);

    if (listaLocalidadesDisponiveis.some(l => l.nome.toLowerCase() === localidadeNome.toLowerCase())) {
        alert("Esta localidade já existe.");
        return;
    }

    const novaLocalidade = {
        nome: localidadeNome,
        taxa: taxa,
    };

    try {
        await db.collection("localidades").add(novaLocalidade);
        alert(`Localidade "${localidadeNome}" (R$ ${taxa.toFixed(2).replace('.', ',')}) adicionada com sucesso!`);
        document.getElementById('adicionar-localidade-form').reset();
        await carregarCardapioDaAPI(); 
        renderizarListaLocalidadesGerenciamento(); 
    } catch (error) {
        console.error("Erro ao adicionar localidade:", error);
        alert("Erro ao adicionar localidade. Verifique as regras de segurança do Firebase.");
    }
}

async function removerLocalidade(localidadeId) {
    if (!db || !acessoGerenciamentoLiberado) return;

    try {
        await db.collection("localidades").doc(localidadeId).delete();
        await carregarCardapioDaAPI(); 
        renderizarListaLocalidadesGerenciamento(); 
        alert("Localidade removida com sucesso.");
    } catch (error) {
        console.error("Erro ao remover localidade:", error);
        alert("Erro ao remover localidade. Verifique as regras de segurança do Firebase.");
    }
}

// ====================================================================
// --- FUNÇÕES DE RENDERIZAÇÃO E CARDÁPIO (MANTIDAS) ---
// ====================================================================

function renderizarCardapio() {
    const categorias = ['pastel', 'coxinha', 'doces', 'bebidas'];
    categorias.forEach(cat => {
        const container = document.getElementById(`categoria-${cat}`);
        // Mantém o título, limpa o restante
        const titulo = container.querySelector('.categoria-titulo');
        container.innerHTML = '';
        container.appendChild(titulo);
        
        const lista = document.createElement('div');
        lista.classList.add('lista-produtos');
        container.appendChild(lista);
        
        const produtosFiltrados = produtosCardapio.filter(p => p.categoria === cat);

        if (produtosFiltrados.length === 0) {
            lista.innerHTML = '<p class="aviso-vazio">Nenhum produto cadastrado nesta categoria.</p>';
        }

        produtosFiltrados.forEach(produto => {
            const nome = produto.nome;
            const preco = parseFloat(produto.preco);
            const isPersonalizavel = produto.personalizavel === 'sim';
            
            // Verifica se o item já está no carrinho (apenas o tipo)
            const quantidadeAtual = carrinho[nome] ? carrinho[nome].length : 0;
            const tipoBotao = isPersonalizavel ? 'adicionar-personalizado' : 'adicionar';
            
            const itemHTML = `
                <div class="item-card" data-nome="${nome}" data-preco="${preco.toFixed(2)}" data-personalizavel="${produto.personalizavel}" data-max-sabores="${produto.maxSabores || 0}">
                    <div class="item-info">
                        <h3>${nome}</h3>
                        <p class="descricao">${produto.descricao}</p>
                        <p class="preco">R$ ${preco.toFixed(2).replace('.', ',')}</p>
                    </div>
                    <div class="quantidade-controle">
                        <button class="remover" data-item="${nome}" ${quantidadeAtual === 0 ? 'disabled' : ''}>-</button>
                        <span class="quantidade" id="qty-${nome}">${quantidadeAtual}</span>
                        <button class="${tipoBotao}" data-item="${nome}">+</button>
                    </div>
                </div>
            `;
            lista.innerHTML += itemHTML;
        });
    });
}


function renderizarListaGerenciamento() {
    const listaContainer = document.getElementById('lista-produtos-gerenciar');
    listaContainer.innerHTML = ''; 

    if (produtosCardapio.length === 0) {
        listaContainer.innerHTML = '<p class="aviso-gerenciamento">Nenhum produto cadastrado no cardápio.</p>';
        return;
    }

    produtosCardapio.forEach(produto => { 
        const nome = produto.nome;
        const preco = produto.preco;
        const categoria = produto.categoria;
        const isPersonalizavel = produto.personalizavel === 'sim'; 
        const maxSabores = produto.maxSabores || 0;
        
        const categoriaLabel = categoria.charAt(0).toUpperCase() + categoria.slice(1);
        const personalizavelLabel = isPersonalizavel ? ` - (${maxSabores} SABORES)` : '';

        const div = document.createElement('div');
        div.classList.add('item-gerenciar');
        div.dataset.nome = nome;

        div.innerHTML = `
            <span>[${categoriaLabel}] ${nome}${personalizavelLabel} (R$ ${parseFloat(preco).toFixed(2).replace('.', ',')})</span>
            <button class="item-gerenciar-remover-btn" data-item="${nome}">Remover</button>
        `;
        listaContainer.appendChild(div);
    });
}

function renderizarListaSaboresGerenciamento() {
    const listaContainer = document.getElementById('lista-sabores-atuais');
    listaContainer.innerHTML = '';
    
    if (listaSaboresDisponiveis.length === 0) {
        listaContainer.innerHTML = '<p class="aviso-gerenciamento">Nenhum sabor cadastrado. Adicione um acima.</p>';
        return;
    }

    listaSaboresDisponiveis.forEach(sabor => {
        const div = document.createElement('div');
        div.classList.add('sabor-item');
        div.dataset.sabor = sabor;
        
        div.innerHTML = `
            <span>${sabor}</span>
            <button class="remover-sabor-btn" data-sabor="${sabor}">X</button>
        `;
        listaContainer.appendChild(div);
    });
}

function renderizarListaComplementosGerenciamento() {
    const listaContainer = document.getElementById('lista-complementos-atuais');
    listaContainer.innerHTML = '';
    
    if (listaComplementosDisponiveis.length === 0) {
        listaContainer.innerHTML = '<p class="aviso-gerenciamento">Nenhum complemento cadastrado. Adicione um acima.</p>';
        return;
    }

    listaComplementosDisponiveis.forEach(complemento => {
        const div = document.createElement('div');
        div.classList.add('sabor-item'); 
        div.dataset.complemento = complemento;
        
        div.innerHTML = `
            <span>${complemento}</span>
            <button class="remover-complemento-btn" data-complemento="${complemento}">X</button>
        `;
        listaContainer.appendChild(div);
    });
}

function renderizarListaLocalidadesGerenciamento() {
    const listaContainer = document.getElementById('lista-localidades-atuais');
    listaContainer.innerHTML = '';
    
    if (listaLocalidadesDisponiveis.length === 0) {
        listaContainer.innerHTML = '<p class="aviso-gerenciamento">Nenhuma localidade cadastrada. Adicione uma acima.</p>';
        return;
    }

    listaLocalidadesDisponiveis.forEach(localidade => {
        const div = document.createElement('div');
        div.classList.add('item-gerenciar'); 
        div.dataset.id = localidade.id;
        
        div.innerHTML = `
            <span>${localidade.nome} (Taxa: R$ ${localidade.taxa.toFixed(2).replace('.', ',')})</span>
            <button class="remover-localidade-btn" data-id="${localidade.id}">Remover</button>
        `;
        listaContainer.appendChild(div);
    });
}

// ====================================================================
// --- FUNÇÕES DE MANIPULAÇÃO DE CARRINHO E CHECKOUT (MANTIDAS) ---
// ====================================================================

function calcularTotal() {
    let total = 0;
    for (const itemNome in carrinho) {
        total += carrinho[itemNome].reduce((sum, item) => sum + item.preco, 0);
    }
    total += detalhesTransacao.taxaEntrega;
    return total;
}

function calcularTrocoSimulado() {
    const total = calcularTotal();
    const valorPagoInput = document.getElementById('input-valor-pago');
    const avisoTroco = document.getElementById('aviso-troco');
    
    const valorPago = parseFloat(valorPagoInput.value) || 0;
    
    if (valorPago > total) {
        const troco = valorPago - total;
        avisoTroco.textContent = `Troco estimado: R$ ${troco.toFixed(2).replace('.', ',')}`;
        avisoTroco.style.color = 'var(--cor-sucesso)';
    } else if (valorPago === total && total > 0) {
         avisoTroco.textContent = 'Pagamento exato. Sem necessidade de troco.';
         avisoTroco.style.color = 'var(--cor-sucesso)';
    } else {
        avisoTroco.textContent = 'Informe o valor que será entregue para calcular o troco.';
        avisoTroco.style.color = 'var(--cor-info)';
    }
}

function atualizarTotalItensBotao() {
    let totalItens = Object.values(carrinho).reduce((sum, current) => current.length, 0);
    document.getElementById('total-itens').textContent = totalItens;

    const finalizarPedidoBtnForm = document.getElementById('finalizar-pedido-btn-form');
    // Verifica se a entrega foi selecionada e se há itens
    const entregaSelecionada = detalhesTransacao.tipoEntrega !== ''; 

    if (finalizarPedidoBtnForm) { 
        finalizarPedidoBtnForm.disabled = totalItens === 0 || !entregaSelecionada; 
    }
    
    const verCarrinhoBtn = document.getElementById('ver-carrinho-btn');
    if (totalItens > 0) {
        verCarrinhoBtn.classList.add('has-items');
    } else {
        verCarrinhoBtn.classList.remove('has-items');
    }
}

function atualizarQuantidadeDisplay(itemNome) { 
    const qtySpan = document.getElementById(`qty-${itemNome}`);
    if (qtySpan) {
        const quantidadeAtual = carrinho[itemNome] ? carrinho[itemNome].length : 0;
        qtySpan.textContent = quantidadeAtual;
        
        const btnRemover = document.querySelector(`.quantidade-controle button[data-item="${itemNome}"].remover`);
        if (btnRemover) {
            btnRemover.disabled = quantidadeAtual === 0;
        }
    }
}

function renderizarCarrinhoModal() {
    const listaCarrinho = document.getElementById('lista-carrinho');
    const valorTotalSpan = document.getElementById('valor-total');
    let total = calcularTotal();

    listaCarrinho.innerHTML = '';
    const itensNoCarrinho = Object.keys(carrinho).length;

    if (itensNoCarrinho === 0) {
        listaCarrinho.innerHTML = '<li class="carrinho-vazio">Seu carrinho está vazio.</li>';
    } else {
        const nomesItensOrdenados = Object.keys(carrinho).sort();

        nomesItensOrdenados.forEach(itemNome => {
            const itensDoTipo = carrinho[itemNome];
            const quantidade = itensDoTipo.length;
            const itemPrecoUnitario = itensDoTipo[0].preco;
            const subtotal = quantidade * itemPrecoUnitario;
            
            let descricaoDetalhes = '';
            
            const isPersonalizavel = itensDoTipo[0].sabores !== undefined && itensDoTipo[0].sabores.length > 0;
            const hasComplementos = itensDoTipo[0].complementos !== undefined && itensDoTipo[0].complementos.length > 0;


            if (isPersonalizavel || hasComplementos) {
                descricaoDetalhes = itensDoTipo.map((item, index) => {
                    let linha = `*#${index + 1}:*`;
                    if (item.sabores && item.sabores.length > 0) {
                        linha += ` Sabores: ${item.sabores.join(', ')}`;
                    }
                    if (item.complementos && item.complementos.length > 0) {
                        linha += ` | Complementos: ${item.complementos.join(', ')}`;
                    }
                    return linha;
                }).join(' <br> ');
            }

            const li = document.createElement('li');
            li.innerHTML = `
                <span>${quantidade}x ${itemNome}</span>
                <span>
                    R$ ${subtotal.toFixed(2).replace('.', ',')}
                    <button class="item-remover" data-item="${itemNome}">Remover</button>
                </span>
                ${(isPersonalizavel || hasComplementos) ? `<p class="sabores-detalhe">${descricaoDetalhes}</p>` : ''}
            `;
            listaCarrinho.appendChild(li);
        });
        
        // Adiciona a linha da taxa de entrega
        if (detalhesTransacao.taxaEntrega > 0) {
            const liTaxa = document.createElement('li');
            liTaxa.classList.add('item-taxa');
            liTaxa.innerHTML = `
                <span style="font-weight: 600; color: var(--cor-destaque);">Taxa de Entrega:</span>
                <span style="font-weight: 600;">R$ ${detalhesTransacao.taxaEntrega.toFixed(2).replace('.', ',')}</span>
            `;
            listaCarrinho.appendChild(liTaxa);
        }
    }
    
    // Atualiza o total
    valorTotalSpan.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
    
    const selectPagamento = document.getElementById('select-pagamento');
    const inputValorPago = document.getElementById('input-valor-pago');
    if (selectPagamento && inputValorPago && selectPagamento.value === 'dinheiro') {
        calcularTrocoSimulado();
    }
}

function gerenciarCarrinho(itemNome, acao, itemPersonalizado = null) {
    if (!carrinho[itemNome]) {
        carrinho[itemNome] = [];
    }

    const itemElement = document.querySelector(`[data-nome="${itemNome}"]`);
    if (!itemElement) { return; }
    
    const isPersonalizavel = itemElement.dataset.personalizavel === 'sim';
    const itemPreco = parseFloat(itemElement.dataset.preco);

    if (isPersonalizavel) {
        if (acao === 'adicionar' && itemPersonalizado) {
            carrinho[itemNome].push({ 
                preco: itemPreco, 
                sabores: itemPersonalizado.sabores, 
                complementos: itemPersonalizado.complementos || [] 
            });
        } else if (acao === 'remover' && carrinho[itemNome].length > 0) {
            carrinho[itemNome].pop();
        }
    } else { 
        if (acao === 'adicionar') {
            carrinho[itemNome].push({ preco: itemPreco });
        } else if (acao === 'remover' && carrinho[itemNome].length > 0) {
            carrinho[itemNome].pop();
        }
    }

    if (carrinho[itemNome] && carrinho[itemNome].length === 0) { // Adicionado verificação extra de null/undefined
        delete carrinho[itemNome];
    }

    atualizarQuantidadeDisplay(itemNome); 
    atualizarTotalItensBotao(); 
    renderizarCarrinhoModal(); 
}

function removerItemDoCarrinho(itemNome) {
    if (carrinho[itemNome]) {
        delete carrinho[itemNome];
        atualizarQuantidadeDisplay(itemNome); 
        atualizarTotalItensBotao();
        renderizarCarrinhoModal();
    }
}

// ====================================================================
// --- FUNÇÕES DE UTILIDADE E AUXILIARES (MANTIDAS) ---
// ====================================================================

const phoneMask = (value) => {
    if (!value) return "";
    value = value.replace(/\D/g, ''); 
    value = value.replace(/(\d{2})(\d)/, "($1) $2");
    value = value.replace(/(\d{5})(\d{4})$/, "$1-$2");
    return value;
}

function verificarLoginAdminLocal(email, cliente) {
    if (email === EMAIL_ADMIN && cliente === CLIENTE) {
        console.log("Login Admin Local: SUCESSO!");
        return true;
    } else {
        console.error("Login Admin Local: Credenciais incorretas.");
        return false;
    }
}

function finalizarAutenticacao() {
    const modalEntrada = document.getElementById('modal-entrada');
    modalEntrada.classList.add('hidden');
    document.body.classList.remove('no-scroll'); 
    alternarAbas('cardapio');
}

function alternarAbas(abaAtivaId) {
    const cardapio = document.querySelector('.menu-container');
    const gerenciamento = document.getElementById('gerenciamento');
    const btnCardapio = document.getElementById('tab-cardapio');
    const btnGerenciamento = document.getElementById('tab-gerenciamento');

    if (abaAtivaId === 'cardapio') {
        cardapio.style.display = 'block';
        gerenciamento.style.display = 'none';
        btnCardapio.classList.add('active');
        btnGerenciamento.classList.remove('active');
    } else if (abaAtivaId === 'gerenciamento') {
        renderizarListaGerenciamento(); 
        renderizarListaSaboresGerenciamento(); 
        renderizarListaComplementosGerenciamento(); 
        renderizarListaLocalidadesGerenciamento(); 
        
        cardapio.style.display = 'none';
        gerenciamento.style.display = 'block';
        btnCardapio.classList.remove('active');
        btnGerenciamento.classList.add('active');
    }
}

// ====================================================================
// --- FUNÇÕES DE PERSONALIZAÇÃO E CHECKOUT (MANTIDAS) ---
// ====================================================================

function openSaboresModal(itemNome, maxSabores) {
    const modal = document.getElementById('modal-sabores');
    const titulo = document.getElementById('sabores-modal-titulo');
    const info = document.getElementById('sabores-modal-info');
    const contador = document.getElementById('sabores-contador');
    const btnConfirmar = document.getElementById('confirmar-sabores-btn');
    const opcoesContainer = document.getElementById('sabores-opcoes');
    
    itemPersonalizavelAtual = itemNome;
    maxSaboresPermitidos = parseInt(maxSabores, 10);
    saboresSelecionados = [];
    complementosSelecionados = []; 
    
    opcoesContainer.innerHTML = '';
    listaSaboresDisponiveis.sort().forEach(sabor => {
        const div = document.createElement('div');
        div.classList.add('sabor-item');
        div.dataset.sabor = sabor;
        div.textContent = sabor;
        opcoesContainer.appendChild(div);
    });
    
    titulo.textContent = `Escolha seus Sabores para "${itemNome}"`;
    info.textContent = `Selecione exatamente ${maxSabores} sabores.`;
    contador.textContent = `Sabores escolhidos: 0 de ${maxSabores}`;
    btnConfirmar.disabled = true;
    
    document.querySelectorAll('#sabores-opcoes .sabor-item').forEach(s => s.classList.remove('selected'));

    modal.style.display = 'block';
}

function handleSaborClick(event) {
    const saborElement = event.target.closest('.sabor-item');
    if (!saborElement) return;

    const sabor = saborElement.dataset.sabor;
    if (!sabor) return;

    const index = saboresSelecionados.indexOf(sabor);
    
    if (index > -1) {
        saboresSelecionados.splice(index, 1);
        saborElement.classList.remove('selected');
    } else if (saboresSelecionados.length < maxSaboresPermitidos) {
        saboresSelecionados.push(sabor);
        saborElement.classList.add('selected');
    } else {
        alert(`Você já escolheu o máximo de ${maxSaboresPermitidos} sabores. Desmarque um para escolher outro.`);
    }

    document.getElementById('sabores-contador').textContent = 
        `Sabores escolhidos: ${saboresSelecionados.length} de ${maxSaboresPermitidos}`;
        
    const btnConfirmar = document.getElementById('confirmar-sabores-btn');
    btnConfirmar.disabled = saboresSelecionados.length !== maxSaboresPermitidos;
}

function confirmarSabores() {
    if (saboresSelecionados.length !== maxSaboresPermitidos) {
        alert(`Por favor, selecione exatamente ${maxSaboresPermitidos} sabores.`);
        return;
    }
    
    document.getElementById('modal-sabores').style.display = 'none';
    openComplementosModal();
}

function openComplementosModal() {
    const modal = document.getElementById('modal-complementos');
    const opcoesContainer = document.getElementById('complementos-opcoes');
    const contador = document.getElementById('complementos-count');
    const info = document.getElementById('complementos-modal-info');
    
    opcoesContainer.innerHTML = '';

    info.textContent = `Selecione no máximo ${MAX_COMPLEMENTOS_PERMITIDOS} complementos.`;

    listaComplementosDisponiveis.sort().forEach(complemento => {
        const div = document.createElement('div');
        div.classList.add('sabor-item'); 
        div.dataset.complemento = complemento;
        div.textContent = complemento;
        opcoesContainer.appendChild(div);
    });
    
    contador.textContent = complementosSelecionados.length;
    
    document.querySelectorAll('#complementos-opcoes .sabor-item').forEach(s => s.classList.remove('selected'));

    modal.style.display = 'block';
}

function handleComplementoClick(event) {
    const compElement = event.target.closest('.sabor-item');
    if (!compElement) return;

    const complemento = compElement.dataset.complemento;
    if (!complemento) return;

    const index = complementosSelecionados.indexOf(complemento);
    
    if (index > -1) {
        complementosSelecionados.splice(index, 1);
        compElement.classList.remove('selected');
    } else if (complementosSelecionados.length < MAX_COMPLEMENTOS_PERMITIDOS) {
        complementosSelecionados.push(complemento);
        compElement.classList.add('selected');
    } else {
        alert(`Você pode escolher no máximo ${MAX_COMPLEMENTOS_PERMITIDOS} complementos.`);
    }

    document.getElementById('complementos-count').textContent = complementosSelecionados.length;
}


function confirmarComplementos() {
    const itemElement = document.querySelector(`[data-nome="${itemPersonalizavelAtual}"]`);
    const itemPreco = parseFloat(itemElement.dataset.preco);
    
    const itemPersonalizado = {
        preco: itemPreco, 
        sabores: [...saboresSelecionados],
        complementos: [...complementosSelecionados] 
    };
    
    gerenciarCarrinho(itemPersonalizavelAtual, 'adicionar', itemPersonalizado);
    
    document.getElementById('modal-complementos').style.display = 'none';
}


function popularLocalidadesNoCheckout() { 
    const selectLocalidade = document.getElementById('select-localidade');
    const avisoTaxa = document.getElementById('aviso-taxa');
    selectLocalidade.innerHTML = '<option value="" data-taxa="0" disabled selected>Selecione seu Bairro</option>';
    
    listaLocalidadesDisponiveis.forEach(localidade => {
        const option = document.createElement('option');
        option.value = localidade.nome;
        option.textContent = `${localidade.nome} (R$ ${localidade.taxa.toFixed(2).replace('.', ',')})`;
        option.dataset.taxa = localidade.taxa;
        if (localidade.id) {
             option.dataset.docId = localidade.id;
        }
        selectLocalidade.appendChild(option);
    });

    if (detalhesTransacao.localidadeNome && selectLocalidade.querySelector(`option[value="${detalhesTransacao.localidadeNome}"]`)) {
        selectLocalidade.value = detalhesTransacao.localidadeNome;
        avisoTaxa.textContent = `Taxa de entrega: R$ ${detalhesTransacao.taxaEntrega.toFixed(2).replace('.', ',')}`;
    } else {
        detalhesTransacao.localidadeNome = '';
        detalhesTransacao.taxaEntrega = 0;
        avisoTaxa.textContent = `Taxa de entrega: R$ 0,00. Selecione o bairro.`;
    }
}

function atualizarTaxaEntrega() { 
    const selectLocalidade = document.getElementById('select-localidade');
    const avisoTaxa = document.getElementById('aviso-taxa');
    const selectedOption = selectLocalidade.options[selectLocalidade.selectedIndex];

    if (selectedOption && selectedOption.value) {
        detalhesTransacao.localidadeNome = selectedOption.value;
        detalhesTransacao.taxaEntrega = parseFloat(selectedOption.dataset.taxa);
        avisoTaxa.textContent = `Taxa de entrega: R$ ${detalhesTransacao.taxaEntrega.toFixed(2).replace('.', ',')}`;
    } else {
        detalhesTransacao.localidadeNome = '';
        detalhesTransacao.taxaEntrega = 0;
        avisoTaxa.textContent = `Taxa de entrega: R$ 0,00. Selecione o bairro.`;
    }
    
    renderizarCarrinhoModal();
    atualizarTotalItensBotao();
}


function validarFormularioPedido() {
    const tipoEntrega = document.getElementById('select-tipo-entrega').value;
    const pagamento = document.getElementById('select-pagamento').value;
    const valorPago = parseFloat(document.getElementById('input-valor-pago').value) || 0;
    const total = calcularTotal();
    
    if (!tipoEntrega) {
        alert("Por favor, selecione o Tipo de Entrega.");
        return false;
    }
    
    const rua = document.getElementById('input-rua').value.trim();
    const numero = document.getElementById('input-numero').value.trim();
    const selectLocalidade = document.getElementById('select-localidade');
    
    if (tipoEntrega === 'delivery') {
        if (!selectLocalidade.value) {
            alert("Por favor, selecione seu Bairro/Localidade para o Delivery.");
            return false;
        }
        if (!rua || !numero) {
            alert("Por favor, preencha a Rua e o Número para o Delivery.");
            return false;
        }
        
        atualizarTaxaEntrega();
        
        detalhesTransacao.rua = rua;
        detalhesTransacao.numero = numero;
        detalhesTransacao.referencia = document.getElementById('input-referencia').value.trim();
    } else { // Retirada
        detalhesTransacao.localidadeNome = "N/A";
        detalhesTransacao.taxaEntrega = 0;
        detalhesTransacao.rua = "Retirada no Local";
        detalhesTransacao.numero = "N/A";
        detalhesTransacao.referencia = "N/A";
    }
    
    detalhesTransacao.tipoEntrega = tipoEntrega;

    if (!pagamento) {
        alert("Por favor, selecione a forma de pagamento.");
        return false;
    }

    if (pagamento === 'dinheiro' && total > 0 && valorPago < total) {
        alert("O valor fornecido para troco deve ser igual ou superior ao Total do Pedido (incluindo taxa de entrega).");
        return false;
    }
    
    detalhesTransacao.pagamento = pagamento;
    detalhesTransacao.trocoPara = pagamento === 'dinheiro' ? valorPago : 0;

    return true;
}


function enviarPedidoWhatsApp(event) {
    event.preventDefault(); 
    
    if (Object.keys(carrinho).length === 0) {
        alert("Seu carrinho está vazio!");
        return;
    }
    if (!validarFormularioPedido()) {
        return; 
    }

    const total = calcularTotal();
    const { tipoEntrega, localidadeNome, taxaEntrega, rua, numero, referencia, pagamento, trocoPara } = detalhesTransacao;
    
    let mensagem = `*--- 📝 NOVO PEDIDO - PASTEL CENTRAL ---*\n\n`;
    mensagem += `*CLIENTE:* ${dadosCliente.nome}\n`;
    mensagem += `*CONTATO:* ${dadosCliente.whatsapp}\n`;
    if (acessoGerenciamentoLiberado) { 
        mensagem += `*EMAIL:* ${dadosCliente.email}\n`;
    }
    mensagem += `*TOTAL FINAL:* R$ ${total.toFixed(2).replace('.', ',')}\n\n`;
    
    mensagem += `*TIPO DE ENTREGA:*\n`;
    mensagem += `  - *Opção:* ${tipoEntrega === 'delivery' ? 'DELIVERY' : 'RETIRADA NO LOCAL'}\n`;
    
    if (tipoEntrega === 'delivery') {
        mensagem += `  - *Localidade:* ${localidadeNome}\n`;
        mensagem += `  - *Taxa:* R$ ${taxaEntrega.toFixed(2).replace('.', ',')}\n`;
        mensagem += `*DETALHES DA ENTREGA:*\n`;
        mensagem += `  - *Endereço:* ${rua}, Nº ${numero}\n`;
        mensagem += `  - *Referência:* ${referencia || 'Nenhuma'}\n\n`;
    } else {
        mensagem += `  - *Endereço:* Será retirado na loja.\n\n`;
    }
    
    mensagem += `*PAGAMENTO:*\n`;
    mensagem += `  - *Forma:* ${pagamento.toUpperCase()}\n`;
    
    if (pagamento === 'dinheiro') {
        const troco = trocoPara - total;
        mensagem += `  - *Valor Entregue:* R$ ${trocoPara.toFixed(2).replace('.', ',')}\n`;
        mensagem += `  - *Troco Necessário:* R$ ${troco.toFixed(2).replace('.', ',')}\n`;
    } else if (pagamento === 'cartao') {
        mensagem += `  - Levar Máquina de Cartão.\n`;
    }
    
    mensagem += `\n*ITENS SOLICITADOS:*\n`;

    const nomesItensOrdenados = Object.keys(carrinho).sort();

    nomesItensOrdenados.forEach(itemNome => {
        const itensDoTipo = carrinho[itemNome];
        const quantidade = itensDoTipo.length;
        
        mensagem += `  > *${quantidade}x ${itemNome}* \n`;

        const isPersonalizavel = itensDoTipo[0].sabores !== undefined && itensDoTipo[0].sabores.length > 0;
        const hasComplementos = itensDoTipo[0].complementos !== undefined && itensDoTipo[0].complementos.length > 0;


        if (isPersonalizavel || hasComplementos) {
             itensDoTipo.forEach((item, index) => {
                let linhaDetalhe = `    - Item #${index + 1}:`;
                if (item.sabores && item.sabores.length > 0) {
                    linhaDetalhe += ` Sabores: ${item.sabores.join(', ')}`;
                }
                if (item.complementos && item.complementos.length > 0) {
                    linhaDetalhe += ` | Complementos: ${item.complementos.join(', ')}`;
                }
                mensagem += `${linhaDetalhe}\n`;
            });
        }
    });

    mensagem += `\n*--- Aguardando Confirmação da Loja ---*`;

    const numeroWhatsappLoja = '558199893952'; 
    const linkWhatsapp = `https://wa.me/${numeroWhatsappLoja}?text=${encodeURIComponent(mensagem)}`;

    window.open(linkWhatsapp, '_blank');

    // Reseta o carrinho e os detalhes da transação
    carrinho = {};
    detalhesTransacao.tipoEntrega = '';
    detalhesTransacao.localidadeNome = '';
    detalhesTransacao.taxaEntrega = 0;
    document.getElementById('modal-carrinho').style.display = 'none';
    carregarCardapioDaAPI().then(() => { 
        atualizarTotalItensBotao();
    });
}

// ====================================================================
// --- EVENT LISTENERS (OUVINTES DE EVENTOS) ---
// ====================================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // CORREÇÃO CRÍTICA: Inicializa o Firebase antes de qualquer lógica que dependa dele
    initializeFirebase();

    const modalEntrada = document.getElementById('modal-entrada');
    
    // Formulários
    const formAcessoRapido = document.getElementById('form-acesso-rapido'); 
    const formLoginAdmin = document.getElementById('form-login-admin'); 

    // Inputs de Cliente
    const inputAcessoRapidoNome = document.getElementById('acesso-rapido-nome');
    const inputAcessoRapidoWhatsapp = document.getElementById('acesso-rapido-whatsapp');
    
    // Inputs de Admin
    const inputAdminEmail = document.getElementById('admin-email');
    const inputTelaCliente = document.getElementById('Tela-cliente');
    
    // Elementos de Controle
    const btnGerenciamento = document.getElementById('tab-gerenciamento'); 
    const btnCardapio = document.getElementById('tab-cardapio'); 
    const separatorAuth = document.querySelector('.separator-auth');


    // Demais Elementos de Modais
    const modal = document.getElementById('modal-carrinho');
    const modalSabores = document.getElementById('modal-sabores');
    const modalComplementos = document.getElementById('modal-complementos');
    const btnVerCarrinho = document.getElementById('ver-carrinho-btn');
    const spanFechar = document.querySelector('#modal-carrinho .fechar-modal');
    const finalizarPedidoBtnForm = document.getElementById('finalizar-pedido-btn-form');
    
    const selectTipoEntrega = document.getElementById('select-tipo-entrega'); 
    const deliveryGroup = document.getElementById('delivery-group');         
    const selectLocalidade = document.getElementById('select-localidade'); 
    const inputRua = document.getElementById('input-rua');
    const inputNumero = document.getElementById('input-numero');
    
    const selectPagamento = document.getElementById('select-pagamento');
    const trocoGroup = document.getElementById('troco-group');
    const inputValorPago = document.getElementById('input-valor-pago');
    
    const closeSabores = document.querySelector('.fechar-sabores');
    const closeComplementos = document.querySelector('.fechar-complementos'); 
    const saboresOpcoes = document.getElementById('sabores-opcoes');
    const complementosOpcoes = document.getElementById('complementos-opcoes'); 
    const btnConfirmarSabores = document.getElementById('confirmar-sabores-btn');
    const btnConfirmarComplementos = document.getElementById('confirmar-complementos-btn'); 
    const formAdicionarProduto = document.getElementById('adicionar-produto-form');
    const formAdicionarSabor = document.getElementById('adicionar-sabor-form');
    const formAdicionarComplemento = document.getElementById('adicionar-complemento-form'); 
    const formAdicionarLocalidade = document.getElementById('adicionar-localidade-form'); 
    const listaLocalidadesAtuais = document.getElementById('lista-localidades-atuais'); 

    // Inicializa bloqueando o scroll
    document.body.classList.add('no-scroll'); 

    // --- 1. Lógica de Input e Detecção do Admin (Mantida) ---
    inputAcessoRapidoWhatsapp.addEventListener('input', (e) => {
        e.target.value = phoneMask(e.target.value);
    });
    

    inputAcessoRapidoNome.addEventListener('input', (e) => {
        const nomeDigitado = e.target.value.trim().toLowerCase();
        
        if (nomeDigitado === NOME_ADMIN) {
            formAcessoRapido.style.display = 'none';
            if (separatorAuth) separatorAuth.style.display = 'none';
            formLoginAdmin.style.display = 'block';
            
            inputAdminEmail.value = EMAIL_ADMIN; 
            inputTelaCliente.focus();

        } else if (formLoginAdmin.style.display === 'block') {
            formLoginAdmin.style.display = 'none';
            formAcessoRapido.style.display = 'block';
            if (separatorAuth) separatorAuth.style.display = 'none';
        }
    });

    // --- 2. SUBMISSÃO DO FORMULÁRIO (ACESSO RÁPIDO CLIENTE - Mantida) ---
    formAcessoRapido.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const numeroLimpo = inputAcessoRapidoWhatsapp.value.replace(/\D/g, '');
        const nomeCliente = inputAcessoRapidoNome.value.trim();
        
        if (numeroLimpo.length !== 11) {
            alert('Por favor, insira um WhatsApp válido (DDD + 9 dígitos).');
            return;
        }

        dadosCliente.nome = nomeCliente;
        dadosCliente.whatsapp = inputAcessoRapidoWhatsapp.value;
        dadosCliente.email = "Não Fornecido"; 

        finalizarAutenticacao();
    });
    
    // --- 3. SUBMISSÃO DO FORMULÁRIO (LOGIN ADMIN - Mantida) ---
    formLoginAdmin.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = inputAdminEmail.value;
        const cliente = inputTelaCliente.value;
        
        const sucessoLogin = verificarLoginAdminLocal(email, cliente); 

        if (sucessoLogin) {
            acessoGerenciamentoLiberado = true;
            
            btnGerenciamento.style.display = 'block'; 
            btnCardapio.style.flexGrow = 0.5;
            btnGerenciamento.style.flexGrow = 0.5;
            
            dadosCliente.nome = "ADMINISTRADOR (Zeze)";
            dadosCliente.whatsapp = "N/A - Gerenciamento";
            dadosCliente.email = email;
            alert(`Bem-vindo(a), Administrador! Acesso de gerenciamento liberado.`);
            
            finalizarAutenticacao();
        } else {
             alert('Erro de login Admin. Email ou Senha incorretos.');
        } 
    });


    // --- 4. Demais Listeners (Carrinho, Entrega, Gerenciamento) ---
    
    document.querySelector('.menu-container').addEventListener('click', (e) => {
        const target = e.target;
        const itemNome = target.dataset.item;

        if (itemNome) {
            if (target.classList.contains('adicionar-personalizado')) {
                const itemElement = document.querySelector(`.item-card[data-nome="${itemNome}"]`);
                const maxSabores = itemElement ? itemElement.dataset.maxSabores : 5;
                openSaboresModal(itemNome, maxSabores);
            } 
            else if (target.classList.contains('adicionar')) {
                gerenciarCarrinho(itemNome, 'adicionar');
            } 
            else if (target.classList.contains('remover')) {
                gerenciarCarrinho(itemNome, 'remover');
            }
        }
    });

    // Lógica do Modal do Carrinho
    btnVerCarrinho.onclick = function() { 
        popularLocalidadesNoCheckout();
        renderizarCarrinhoModal(); 
        modal.style.display = 'block'; 
    }
    spanFechar.onclick = function() { modal.style.display = 'none'; }
    
    document.getElementById('lista-carrinho').addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('item-remover')) {
            const itemNome = target.dataset.item;
            removerItemDoCarrinho(itemNome);
        }
    });
    
    // LÓGICA DE ENTREGA (ATUALIZADA)
    selectTipoEntrega.addEventListener('change', (e) => {
        const tipo = e.target.value;
        
        // Limpa e oculta os campos de entrega
        detalhesTransacao.taxaEntrega = 0;
        detalhesTransacao.localidadeNome = '';
        
        inputRua.removeAttribute('required');
        inputNumero.removeAttribute('required');
        selectLocalidade.removeAttribute('required');
        selectLocalidade.value = ""; 

        if (tipo === 'delivery') {
            
            deliveryGroup.style.display = 'block';
            
            selectLocalidade.setAttribute('required', 'required');
            inputRua.setAttribute('required', 'required');
            inputNumero.setAttribute('required', 'required');
            
        } else { // Retirada
            deliveryGroup.style.display = 'none';
        }
        
        detalhesTransacao.tipoEntrega = tipo;
        
        renderizarCarrinhoModal();
        atualizarTotalItensBotao();
    });
    
    // NOVO: Atualiza taxa quando o bairro é selecionado
    selectLocalidade.addEventListener('change', atualizarTaxaEntrega);


    // Lógica de Pagamento e Troco
    selectPagamento.addEventListener('change', (e) => {
        if (e.target.value === 'dinheiro') {
            trocoGroup.style.display = 'block';
            inputValorPago.setAttribute('required', 'required');
            calcularTrocoSimulado(); 
        } else {
            trocoGroup.style.display = 'none';
            inputValorPago.removeAttribute('required');
        }
    });

    inputValorPago.addEventListener('input', calcularTrocoSimulado);
    finalizarPedidoBtnForm.addEventListener('click', enviarPedidoWhatsApp);


    // Lógica do Modal de Seleção de Sabores/Complementos
    closeSabores.onclick = () => { modalSabores.style.display = 'none'; };
    saboresOpcoes.addEventListener('click', handleSaborClick);
    btnConfirmarSabores.addEventListener('click', confirmarSabores); 

    closeComplementos.onclick = () => { 
        modalComplementos.style.display = 'none'; 
    };
    complementosOpcoes.addEventListener('click', handleComplementoClick);
    btnConfirmarComplementos.addEventListener('click', confirmarComplementos); 

    // Lógica de Fechamento de Modais
    window.onclick = function(event) { 
        if (event.target == modal && modalSabores.style.display === 'none' && modalComplementos.style.display === 'none') { 
            modal.style.display = 'none'; 
        } 
        if (event.target == modalSabores) { 
            modalSabores.style.display = 'none'; 
        } 
        if (event.target == modalComplementos) { 
            modalComplementos.style.display = 'none'; 
        } 
    }
    

    // Gerenciamento de Produtos
    formAdicionarProduto.addEventListener('submit', adicionarProdutoAoCardapio);
    
    document.getElementById('is-personalizavel').addEventListener('change', (e) => {
        document.getElementById('max-sabores-group').style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('lista-produtos-gerenciar').addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('item-gerenciar-remover-btn')) {
            const itemNome = target.dataset.item;
            if (confirm(`Tem certeza que deseja remover o produto "${itemNome}" do cardápio?`)) {
                 removerProdutoDoCardapio(itemNome);
            }
        }
    });
    
    // Gerenciamento de Sabores
    formAdicionarSabor.addEventListener('submit', adicionarSabor);

    document.getElementById('lista-sabores-atuais').addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('remover-sabor-btn')) {
            const sabor = target.dataset.sabor;
            if (confirm(`Tem certeza que deseja remover o sabor "${sabor}" da lista de opções?`)) {
                removerSabor(sabor);
            }
        }
    });
    
    // Gerenciamento de Complementos
    formAdicionarComplemento.addEventListener('submit', adicionarComplemento); 

    document.getElementById('lista-complementos-atuais').addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('remover-complemento-btn')) {
            const complemento = target.dataset.complemento;
            if (confirm(`Tem certeza que deseja remover o complemento "${complemento}" da lista de opções?`)) {
                removerComplemento(complemento);
            }
        }
    });
    
    // Gerenciamento de Localidades
    formAdicionarLocalidade.addEventListener('submit', adicionarLocalidade);
    
    listaLocalidadesAtuais.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('remover-localidade-btn')) {
            const localidadeId = target.dataset.id;
            const localidadeNomeElement = target.closest('.item-gerenciar').querySelector('span');
            const localidadeNome = localidadeNomeElement.textContent.replace(/\s*\(Taxa: R\$ [\d,.]+\)/, '');

            if (confirm(`Tem certeza que deseja remover a localidade "${localidadeNome}"?`)) {
                removerLocalidade(localidadeId);
            }
        }
    });

    // Ouvinte para os botões de Aba
    document.getElementById('tab-cardapio').addEventListener('click', () => alternarAbas('cardapio'));
    
    btnGerenciamento.addEventListener('click', () => {
        if (acessoGerenciamentoLiberado) {
            alternarAbas('gerenciamento');
        } else {
            alert('Acesso negado! A aba de Gerenciamento é restrita ao administrador.');
        }
    });

    // Inicialização
    carregarCardapioDaAPI().then(() => {
        atualizarTotalItensBotao();
    });
});