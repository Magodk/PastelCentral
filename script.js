// Objeto para armazenar o carrinho: { nome_item: [ {preco: X, sabores: [...] } ] }
let carrinho = {};

// Dados do Cliente (Preenchidos no Modal de Entrada)
let dadosCliente = {
    nome: '',
    whatsapp: '',
    email: '' 
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
let acessoGerenciamentoLiberado = false;
let itemPersonalizavelAtual = null; 
let itemComComplementoAtual = null; // NOVO: Para o item que está recebendo complementos
let maxSaboresPermitidos = 0; 
let saboresSelecionados = [];
let complementosSelecionados = []; // NOVO: Para armazenar complementos temporariamente

// Credencial Fixa (Apenas NOME_ADMIN permanece para acionar o formulário)
const NOME_ADMIN = "zeze"; 
// REMOVIDAS as credenciais fixas de email e senha. O login será feito via Firebase.


// LISTA GLOBAL DE SABORES (Temporária)
let listaSaboresDisponiveis = [
    "Carne", "Frango", "Camarão", "Charque", "4 Queijos", "Pizza", "Palmito", "Calabresa",
    "Chocolate", "Doce de Leite", "Goiabada", "Banana com Canela"
];

// NOVO: LISTA GLOBAL DE COMPLEMENTOS (Temporária: Nome e Preço)
let listaComplementosDisponiveis = [
    { nome: "Cheddar Cremoso", preco: 2.50 },
    { nome: "Bacon em Cubos", preco: 3.00 },
    { nome: "Ovo Cozido", preco: 1.50 },
    { nome: "Doce de Leite Extra", preco: 2.00 },
];


// ------------------------------------------------------------------
// CONFIGURAÇÃO E AUTENTICAÇÃO FIREBASE
// ------------------------------------------------------------------

// **ATENÇÃO:** SUBSTITUA ESTE OBJETO COM SUAS CHAVES REAIS DO FIREBASE
const firebaseConfig = {
    apiKey: "YOUR_API_KEY", 
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Inicializa o Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app(); 
}
// FIM CONFIGURAÇÃO FIREBASE


// Função de login atualizada para usar Firebase Auth
async function verificarLoginAdmin(email, senha) {
    try {
        // Tenta logar no Firebase com email e senha
        await firebase.auth().signInWithEmailAndPassword(email, senha);
        console.log("Login Admin Firebase: SUCESSO!");
        return true;
    } catch (error) {
        console.error("Login Admin Firebase: Erro de autenticação.", error.message);
        // Em um sistema real, você pode querer exibir 'error.message'
        return false;
    }
}


// Função auxiliar para finalizar a autenticação (Comum a Cliente e Admin)
function finalizarAutenticacao() {
    const modalEntrada = document.getElementById('modal-entrada');
    modalEntrada.classList.add('hidden');
    document.body.classList.remove('no-scroll'); 
    alternarAbas('cardapio');
}


// ------------------------------------------------------------------
// LÓGICA DO CARDÁPIO, CARRINHO E FINALIZAÇÃO
// ------------------------------------------------------------------

// Máscara de Telefone (DDD + 9 dígitos)
const phoneMask = (value) => {
    if (!value) return "";
    value = value.replace(/\D/g, ''); 
    value = value.replace(/(\d{2})(\d)/, "($1) $2");
    value = value.replace(/(\d{5})(\d{4})$/, "$1-$2");
    return value;
}

async function carregarCardapioDaAPI() {
    document.querySelectorAll('.categoria-section').forEach(section => {
        // Limpa apenas os cards de item, mantendo o título da seção
        const itens = section.querySelectorAll('.item-card');
        itens.forEach(item => item.remove());
    });

    const produtosIniciais = [
         { nome: "Pastel Gourmet (Escolha 5 Sabores)", preco: "30.00", categoria: "pastel", personalizavel: "sim", maxSabores: "5", descricao: "Selecione 5 sabores exclusivos para o seu pastel perfeito!", },
         { nome: "Pastel de Carne com Queijo", preco: "8.50", categoria: "pastel", personalizavel: "nao", descricao: "Deliciosa carne moída temperada com queijo derretido.", temComplementos: "sim"}, // ADICIONADO temComplementos
         { nome: "Mini Coxinha de Frango (12 un.)", preco: "15.00", categoria: "coxinha", personalizavel: "nao", descricao: "Porção com 12 mini coxinhas crocantes de frango.", },
         { nome: "Pastel de Chocolate c/ Morango", preco: "12.00", categoria: "doces", personalizavel: "nao", descricao: "Chocolate cremoso e morangos frescos, uma combinação perfeita.", temComplementos: "sim"}, // ADICIONADO temComplementos
         { nome: "Coca-Cola Lata 350ml", preco: "6.00", categoria: "bebidas", personalizavel: "nao", descricao: "Aquele clássico que refresca a qualquer hora.", },
    ];

    produtosIniciais.forEach(produto => {
        const categoriaSection = document.getElementById(`categoria-${produto.categoria}`);
        if (categoriaSection) {
            const isPersonalizavel = produto.personalizavel === 'sim';
            const temComplementos = produto.temComplementos === 'sim'; // NOVO
            const maxSabores = produto.maxSabores || 0;
            
            const novoItemCard = criarItemCardHTML(
                produto.nome, 
                produto.descricao, 
                produto.preco, 
                produto.categoria, 
                isPersonalizavel, 
                temComplementos, // NOVO
                maxSabores, 
                produto.id 
            );
            categoriaSection.appendChild(novoItemCard);
            atualizarQuantidadeDisplay(produto.nome); 
        }
    });
}

function criarItemCardHTML(nome, descricao, preco, categoria, isPersonalizavel, temComplementos = false, maxSabores = 0, id = null) {
    const precoFormatado = parseFloat(preco).toFixed(2).replace('.', ',');
    const personalizavelData = isPersonalizavel ? 'sim' : 'nao';
    const complementosData = temComplementos ? 'sim' : 'nao'; // NOVO

    const card = document.createElement('div');
    card.classList.add('item-card');
    if (isPersonalizavel) card.classList.add('personalizavel-item');
    
    card.dataset.nome = nome;
    card.dataset.preco = parseFloat(preco).toFixed(2); 
    card.dataset.categoria = categoria; 
    card.dataset.personalizavel = personalizavelData; 
    card.dataset.complementos = complementosData; // NOVO: Adiciona atributo de complemento
    if (isPersonalizavel) { card.dataset.maxSabores = maxSabores; }
    if (id) { card.dataset.id = id; }

    let botoesHTML = '';
    
    // Se for personalizável (como o Pastel Gourmet), abre o modal de sabores
    if (isPersonalizavel) {
        botoesHTML = `
            <button class="remover" data-item="${nome}" disabled>-</button>
            <span class="quantidade" id="qty-${nome}">0</span>
            <button class="adicionar-personalizado" data-item="${nome}">+</button>
        `;
    } 
    // Se tiver complementos, abre o modal de complementos
    else if (temComplementos) {
         botoesHTML = `
            <button class="remover" data-item="${nome}">-</button>
            <span class="quantidade" id="qty-${nome}">0</span>
            <button class="adicionar-complemento" data-item="${nome}">+</button>
        `;
    }
    // Caso padrão: item simples
    else {
         botoesHTML = `
            <button class="remover" data-item="${nome}">-</button>
            <span class="quantidade" id="qty-${nome}">0</span>
            <button class="adicionar" data-item="${nome}">+</button>
        `;
    }

    card.innerHTML = `
        <h3>${nome}</h3>
        <p class="descricao">${descricao}</p>
        <p class="preco">R$ ${precoFormatado}</p>
        <div class="quantidade-controle">
            ${botoesHTML}
        </div>
    `;

    return card;
}

async function adicionarProdutoAoCardapio(event) {
    event.preventDefault();

    const form = document.getElementById('adicionar-produto-form');
    const categoria = document.getElementById('categoria-produto').value;
    const nome = document.getElementById('nome-produto').value.trim();
    const isPersonalizavel = document.getElementById('is-personalizavel').checked; 
    const maxSabores = document.getElementById('max-sabores').value; 
    const descricao = document.getElementById('descricao-produto').value.trim();
    const preco = document.getElementById('preco-produto').value;

    if (!categoria || !nome || !descricao || isNaN(parseFloat(preco)) || parseFloat(preco) <= 0) {
        alert('Por favor, preencha todos os campos obrigatórios corretamente.');
        return;
    }
    
    if (isPersonalizavel && (parseInt(maxSabores) < 1 || isNaN(parseInt(maxSabores)))) {
        alert('Se o produto for personalizável, o máximo de sabores a escolher deve ser 1 ou mais.');
        return;
    }
    
    const nomeExistente = Array.from(document.querySelectorAll('.item-card')).some(item => 
        item.dataset.nome.toLowerCase() === nome.toLowerCase()
    );
    if (nomeExistente) {
        alert(`O produto "${nome}" já existe no cardápio. Por favor, use um nome diferente.`);
        return;
    }
    
    // Se for da categoria "complementos", ele automaticamente tem complemento (para si mesmo)
    const temComplementos = categoria !== 'complementos';

    const categoriaSection = document.getElementById(`categoria-${categoria}`);
    if (categoriaSection) {
        const novoItemCard = criarItemCardHTML(nome, descricao, preco, categoria, isPersonalizavel, temComplementos, maxSabores); 
        categoriaSection.appendChild(novoItemCard);
        atualizarQuantidadeDisplay(nome); 
    }

    form.reset();
    document.getElementById('max-sabores-group').style.display = 'none'; 
    alert(`Produto "${nome}" adicionado com sucesso (localmente)!`);
    alternarAbas('cardapio');
}

async function removerProdutoDoCardapio(itemNome) {
    const itemCard = document.querySelector(`.menu-container .item-card[data-nome="${itemNome}"]`);
    if (!itemCard) return;

    itemCard.remove();
    
    if (carrinho[itemNome]) {
        delete carrinho[itemNome];
        atualizarTotalItensBotao();
        renderizarCarrinhoModal();
    }

    alert(`Produto "${itemNome}" removido (temporariamente).`);
    renderizarListaGerenciamento();
}

function renderizarListaGerenciamento() {
    const listaContainer = document.getElementById('lista-produtos-gerenciar');
    listaContainer.innerHTML = ''; 

    const itensCardapio = document.querySelectorAll('.menu-container .item-card');
    
    if (itensCardapio.length === 0) {
        listaContainer.innerHTML = '<p class="aviso-gerenciamento">Nenhum produto cadastrado no cardápio.</p>';
        return;
    }

    itensCardapio.forEach(item => {
        const nome = item.dataset.nome;
        const preco = item.dataset.preco;
        const categoria = item.dataset.categoria;
        const isPersonalizavel = item.dataset.personalizavel === 'sim'; 
        const maxSabores = item.dataset.maxSabores || 0;
        
        const categoriaLabel = categoria.charAt(0).toUpperCase() + categoria.slice(1);
        let detalhes = '';
        if (isPersonalizavel) {
             detalhes = ` - (${maxSabores} SABORES)`;
        } else if (categoria === 'complementos') {
            // NOVO: Exibe preço do complemento
             detalhes = ` - ADICIONAL`;
             if (parseFloat(preco) > 0) {
                 detalhes += ` (+R$ ${parseFloat(preco).toFixed(2).replace('.', ',')})`;
             }
        }
        

        const div = document.createElement('div');
        div.classList.add('item-gerenciar');
        div.dataset.nome = nome;

        div.innerHTML = `
            <span>[${categoriaLabel}] ${nome}${detalhes} (R$ ${parseFloat(preco).toFixed(2).replace('.', ',')})</span>
            <button class="item-gerenciar-remover-btn" data-item="${nome}">Remover</button>
        `;
        listaContainer.appendChild(div);
    });
}

function adicionarSabor(event) {
    event.preventDefault();
    const input = document.getElementById('novo-sabor-input');
    let novoSabor = input.value.trim();

    if (novoSabor) {
        novoSabor = novoSabor.charAt(0).toUpperCase() + novoSabor.slice(1).toLowerCase();

        if (!listaSaboresDisponiveis.includes(novoSabor)) {
            listaSaboresDisponiveis.push(novoSabor);
            listaSaboresDisponiveis.sort(); 
            renderizarListaSaboresGerenciamento();
            input.value = '';
            alert(`Sabor "${novoSabor}" adicionado temporariamente.`);
        } else {
            alert(`O sabor "${novoSabor}" já existe na lista.`);
        }
    }
}

function removerSabor(sabor) {
    const index = listaSaboresDisponiveis.indexOf(sabor);
    if (index > -1) {
        listaSaboresDisponiveis.splice(index, 1);
        renderizarListaSaboresGerenciamento();
        alert(`Sabor "${sabor}" removido temporariamente.`);
    }
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


// Funções de Carrinho e Checkout (Mantidas)
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

function gerenciarCarrinho(itemNome, acao, itemDetalhado = null) {
    if (!carrinho[itemNome]) {
        carrinho[itemNome] = [];
    }

    const itemElement = document.querySelector(`[data-nome="${itemNome}"]`);
    if (!itemElement) { return; }
    
    const isPersonalizavel = itemElement.dataset.personalizavel === 'sim';
    const temComplementos = itemElement.dataset.complementos === 'sim';
    let itemPreco = parseFloat(itemElement.dataset.preco);

    if (acao === 'adicionar') {
        if (isPersonalizavel && itemDetalhado && itemDetalhado.sabores) {
            // Item Personalizado (Sabores)
            carrinho[itemNome].push({ preco: itemPreco, sabores: itemDetalhado.sabores });
        } else if (temComplementos && itemDetalhado && itemDetalhado.complementos) {
            // Item com Complementos
            
            // Calcula o custo total dos complementos
            const custoComplementos = itemDetalhado.complementos.reduce((total, comp) => total + comp.preco, 0);
            
            // Novo preço = Preço base do item + custo dos complementos
            const precoTotal = itemPreco + custoComplementos;
            
            carrinho[itemNome].push({ 
                preco: precoTotal, 
                complementos: itemDetalhado.complementos 
            });
            
        } else { 
            // Item Simples
            carrinho[itemNome].push({ preco: itemPreco });
        }
    } else if (acao === 'remover' && carrinho[itemNome].length > 0) {
        carrinho[itemNome].pop();
    }
    

    if (carrinho[itemNome] && carrinho[itemNome].length === 0) {
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

function calcularTotal() {
    let total = 0;
    for (const itemNome in carrinho) {
        total += carrinho[itemNome].reduce((sum, item) => sum + item.preco, 0);
    }
    return total;
}

function atualizarTotalItensBotao() {
    let totalItens = Object.values(carrinho).reduce((sum, current) => sum + current.length, 0);
    document.getElementById('total-itens').textContent = totalItens;

    const finalizarPedidoBtnForm = document.getElementById('finalizar-pedido-btn-form');
    if (finalizarPedidoBtnForm) { 
        finalizarPedidoBtnForm.disabled = totalItens === 0; 
    }
    
    const verCarrinhoBtn = document.getElementById('ver-carrinho-btn');
    if (totalItens > 0) {
        verCarrinhoBtn.classList.add('has-items');
    } else {
        verCarrinhoBtn.classList.remove('has-items');
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
            
            // O subtotal é a soma dos preços de todos os itens do tipo (já que o preço inclui complementos)
            const subtotal = itensDoTipo.reduce((sum, item) => sum + item.preco, 0);
            
            let detalhesHTML = '';

            itensDoTipo.forEach((item, index) => {
                const precoUnitario = item.preco;
                let linhaDetalhe = `(R$ ${precoUnitario.toFixed(2).replace('.', ',')})`;

                if (item.sabores && item.sabores.length > 0) {
                    linhaDetalhe += ` *#${index + 1}:* Sabores: ${item.sabores.join(', ')}`;
                }
                
                if (item.complementos && item.complementos.length > 0) {
                    const compDetalhe = item.complementos.map(c => 
                        `${c.nome} (+R$ ${c.preco.toFixed(2).replace('.', ',')})`
                    ).join('; ');
                    linhaDetalhe += ` *#${index + 1}:* Comp: ${compDetalhe}`;
                }
                
                detalhesHTML += `<p class="sabores-detalhe">${linhaDetalhe}</p>`;
            });

            const li = document.createElement('li');
            li.innerHTML = `
                <span>${quantidade}x ${itemNome}</span>
                <span>
                    R$ ${subtotal.toFixed(2).replace('.', ',')}
                    <button class="item-remover" data-item="${itemNome}">Remover</button>
                </span>
                ${detalhesHTML}
            `;
            listaCarrinho.appendChild(li);
        });
    }

    valorTotalSpan.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
    
    const selectPagamento = document.getElementById('select-pagamento');
    const inputValorPago = document.getElementById('input-valor-pago');
    if (selectPagamento && inputValorPago && selectPagamento.value === 'dinheiro') {
        calcularTrocoSimulado();
    }
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

function validarFormularioPedido() {
    const rua = document.getElementById('input-rua').value.trim();
    const numero = document.getElementById('input-numero').value.trim();
    const pagamento = document.getElementById('select-pagamento').value;
    const valorPago = parseFloat(document.getElementById('input-valor-pago').value) || 0;
    const total = calcularTotal();

    if (!rua || !numero) {
        alert("Por favor, preencha a Rua e o Número para entrega.");
        return false;
    }
    if (!pagamento) {
        alert("Por favor, selecione a forma de pagamento.");
        return false;
    }

    if (pagamento === 'dinheiro' && valorPago < total) {
        alert("O valor fornecido para troco deve ser igual ou superior ao Total do Pedido.");
        return false;
    }
    
    detalhesTransacao.rua = rua;
    detalhesTransacao.numero = numero;
    detalhesTransacao.referencia = document.getElementById('input-referencia').value.trim();
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
    const { rua, numero, referencia, pagamento, trocoPara } = detalhesTransacao;
    
    let mensagem = `*--- 📝 NOVO PEDIDO - PASTEL CENTRAL ---*\n\n`;
    mensagem += `*CLIENTE:* ${dadosCliente.nome}\n`;
    mensagem += `*CONTATO:* ${dadosCliente.whatsapp}\n`;
    // Inclui o email no resumo do pedido
    if (dadosCliente.email && dadosCliente.email !== 'N/A - Gerenciamento') {
        mensagem += `*EMAIL:* ${dadosCliente.email}\n`;
    }
    mensagem += `*TOTAL DO PEDIDO:* R$ ${total.toFixed(2).replace('.', ',')}\n\n`;
    
    mensagem += `*DETALHES DA ENTREGA:*\n`;
    mensagem += `  - *Endereço:* ${rua}, Nº ${numero}\n`;
    mensagem += `  - *Referência:* ${referencia || 'Nenhuma'}\n\n`;
    
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
        
        mensagem += `  > *${quantidade}x ${itemNome}* (Total: R$ ${itensDoTipo.reduce((s,i) => s + i.preco, 0).toFixed(2).replace('.', ',')})\n`;

        itensDoTipo.forEach((item, index) => {
            let detalhe = `    - Item #${index + 1} (R$ ${item.preco.toFixed(2).replace('.', ',')}):`;
            
            if (item.sabores && item.sabores.length > 0) {
                detalhe += ` Sabores: ${item.sabores.join(', ')}`;
            }
            
            if (item.complementos && item.complementos.length > 0) {
                const compDetalhe = item.complementos.map(c => 
                    `${c.nome} (+R$ ${c.preco.toFixed(2).replace('.', ',')})`
                ).join(', ');
                detalhe += ` Complementos: ${compDetalhe}`;
            }
            mensagem += detalhe + '\n';
        });
    });

    mensagem += `\n*--- Aguardando Confirmação da Loja ---*`;

    const numeroWhatsappLoja = '558199893952'; 
    const linkWhatsapp = `https://wa.me/${numeroWhatsappLoja}?text=${encodeURIComponent(mensagem)}`;

    window.open(linkWhatsapp, '_blank');

    carrinho = {};
    document.getElementById('modal-carrinho').style.display = 'none';
    carregarCardapioDaAPI().then(() => { 
        atualizarTotalItensBotao();
    });
}


// ------------------------------------------------------------------
// LÓGICA DE SABORES (ITENS PERSONALIZÁVEIS)
// ------------------------------------------------------------------
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
    
    const itemElement = document.querySelector(`[data-nome="${itemPersonalizavelAtual}"]`);
    
    const itemDetalhado = {
        sabores: [...saboresSelecionados] 
    };
    
    // O preço é lido e corrigido dentro da função gerenciarCarrinho
    gerenciarCarrinho(itemPersonalizavelAtual, 'adicionar', itemDetalhado);
    
    document.getElementById('modal-sabores').style.display = 'none';
}


// ------------------------------------------------------------------
// LÓGICA DE COMPLEMENTOS (ITENS COM ADICIONAIS)
// ------------------------------------------------------------------
function openComplementosModal(itemNome) {
    const modal = document.getElementById('modal-complementos');
    const titulo = document.getElementById('complementos-modal-titulo');
    const opcoesContainer = document.getElementById('complementos-opcoes');
    const totalSpan = document.getElementById('complementos-total');
    
    itemComComplementoAtual = itemNome;
    complementosSelecionados = [];

    opcoesContainer.innerHTML = '';
    
    const complementosDisponiveis = Array.from(document.querySelectorAll('.item-card[data-categoria="complementos"]'));
    
    if (complementosDisponiveis.length === 0) {
        opcoesContainer.innerHTML = '<p class="aviso-gerenciamento">Nenhum complemento disponível no momento.</p>';
    } else {
         complementosDisponiveis.forEach(complementoElement => {
            const nome = complementoElement.dataset.nome;
            const preco = parseFloat(complementoElement.dataset.preco);
            const precoFormatado = preco.toFixed(2).replace('.', ',');
            
            const div = document.createElement('div');
            div.classList.add('sabor-item'); 
            div.dataset.nome = nome;
            div.dataset.preco = preco;
            div.innerHTML = `${nome} (+R$ ${precoFormatado})`;
            opcoesContainer.appendChild(div);
        });
    }
    
    titulo.textContent = `Complementos para "${itemNome}"`;
    totalSpan.textContent = `Custo Adicional: R$ 0,00`;

    document.querySelectorAll('#complementos-opcoes .sabor-item').forEach(s => s.classList.remove('selected'));

    modal.style.display = 'block';
}

function calcularTotalComplementos() {
    return complementosSelecionados.reduce((sum, c) => sum + c.preco, 0);
}

function handleComplementoClick(event) {
    const compElement = event.target.closest('.sabor-item');
    if (!compElement) return;

    const nome = compElement.dataset.nome;
    const preco = parseFloat(compElement.dataset.preco);

    // Encontra o índice no array de selecionados
    const index = complementosSelecionados.findIndex(c => c.nome === nome);
    
    if (index > -1) {
        // Desmarca (remove)
        complementosSelecionados.splice(index, 1);
        compElement.classList.remove('selected');
    } else {
        // Marca (adiciona)
        complementosSelecionados.push({ nome, preco });
        compElement.classList.add('selected');
    }

    document.getElementById('complementos-total').textContent = 
        `Custo Adicional: R$ ${calcularTotalComplementos().toFixed(2).replace('.', ',')}`;
}

function confirmarComplementos() {
    const itemDetalhado = {
        complementos: [...complementosSelecionados] 
    };
    
    // Passa os detalhes dos complementos para a função que adiciona ao carrinho
    gerenciarCarrinho(itemComComplementoAtual, 'adicionar', itemDetalhado);
    
    document.getElementById('modal-complementos').style.display = 'none';
}


// Lógica de Alternância de Abas
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
        
        cardapio.style.display = 'none';
        gerenciamento.style.display = 'block';
        btnCardapio.classList.remove('active');
        btnGerenciamento.classList.add('active');
    }
}


// ------------------------------------------------------------------
// EVENT LISTENERS (Ouvintes de Eventos) - CORRIGIDO
// ------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    
    // Formulários e Inputs
    const formAcessoRapido = document.getElementById('form-acesso-rapido'); 
    const formLoginAdmin = document.getElementById('form-login-admin'); 
    const inputAcessoRapidoNome = document.getElementById('acesso-rapido-nome');
    const inputAcessoRapidoWhatsapp = document.getElementById('acesso-rapido-whatsapp');
    const inputAdminEmail = document.getElementById('admin-email');
    const inputTelaCliente = document.getElementById('Tela-cliente');
    
    // Elementos de Controle
    const btnGerenciamento = document.getElementById('tab-gerenciamento'); 
    const btnCardapio = document.getElementById('tab-cardapio'); 
    const separatorAuth = document.querySelector('.separator-auth');

    // Modais e Componentes
    const modalCarrinho = document.getElementById('modal-carrinho');
    const modalSabores = document.getElementById('modal-sabores');
    const modalComplementos = document.getElementById('modal-complementos'); // NOVO
    const btnVerCarrinho = document.getElementById('ver-carrinho-btn');
    const spanFecharCarrinho = document.querySelector('#modal-carrinho .fechar-modal');
    const finalizarPedidoBtnForm = document.getElementById('finalizar-pedido-btn-form');
    const selectPagamento = document.getElementById('select-pagamento');
    const trocoGroup = document.getElementById('troco-group');
    const inputValorPago = document.getElementById('input-valor-pago');
    const closeSabores = document.querySelector('.fechar-sabores');
    const closeComplementos = document.querySelector('.fechar-complementos'); // NOVO
    const saboresOpcoes = document.getElementById('sabores-opcoes');
    const complementosOpcoes = document.getElementById('complementos-opcoes'); // NOVO
    const btnConfirmarSabores = document.getElementById('confirmar-sabores-btn');
    const btnConfirmarComplementos = document.getElementById('confirmar-complementos-btn'); // NOVO
    const formAdicionarProduto = document.getElementById('adicionar-produto-form');
    const formAdicionarSabor = document.getElementById('adicionar-sabor-form');


    // Inicializa bloqueando o scroll
    document.body.classList.add('no-scroll'); 

    // --- 1. Lógica de Input e Detecção do Admin ---
    inputAcessoRapidoWhatsapp.addEventListener('input', (e) => {
        e.target.value = phoneMask(e.target.value);
    });
    

    inputAcessoRapidoNome.addEventListener('input', (e) => {
        const nomeDigitado = e.target.value.trim().toLowerCase();
        
        if (nomeDigitado === NOME_ADMIN) {
            formAcessoRapido.style.display = 'none';
            if (separatorAuth) separatorAuth.style.display = 'none';
            formLoginAdmin.style.display = 'block';
            
            inputAdminEmail.focus(); 
            inputTelaCliente.value = ''; 
        } else if (formLoginAdmin.style.display === 'block') {
            formLoginAdmin.style.display = 'none';
            formAcessoRapido.style.display = 'block';
            if (separatorAuth) separatorAuth.style.display = 'none';
        }
    });

    // --- 2. SUBMISSÃO DO FORMULÁRIO (ACESSO RÁPIDO CLIENTE) ---
    formAcessoRapido.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const numeroLimpo = inputAcessoRapidoWhatsapp.value.replace(/\D/g, '');
        const nomeCliente = inputAcessoRapidoNome.value.trim();
        const emailCliente = document.getElementById('acesso-rapido-email').value.trim();
        
        if (numeroLimpo.length !== 11) {
            alert('Por favor, insira um WhatsApp válido (DDD + 9 dígitos).');
            return;
        }

        // Coleta de Dados do Cliente
        dadosCliente.nome = nomeCliente;
        dadosCliente.whatsapp = inputAcessoRapidoWhatsapp.value;
        dadosCliente.email = emailCliente;

        finalizarAutenticacao();
    });
    
    // --- 3. SUBMISSÃO DO FORMULÁRIO (LOGIN ADMIN) ---
    formLoginAdmin.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = inputAdminEmail.value;
        const senha = inputTelaCliente.value; 
        
        const sucessoLogin = await verificarLoginAdmin(email, senha); 

        if (sucessoLogin) {
            acessoGerenciamentoLiberado = true;
            
            btnGerenciamento.style.display = 'block'; 
            btnCardapio.style.flexGrow = 0.5;
            btnGerenciamento.style.flexGrow = 0.5;
            
            dadosCliente.nome = "ADMINISTRADOR (Zeze)";
            dadosCliente.whatsapp = "N/A - Gerenciamento";
            dadosCliente.email = email;
            alert(`Bem-vindo(a), Administrador! Acesso de gerenciamento liberado via Firebase.`);
            
            finalizarAutenticacao();
        } else {
             alert('Erro de login Admin. Verifique seu Email e Senha (Firebase Auth).');
        } 
    });


    // --- 4. Demais Listeners (Carrinho, Sabores, Complementos, Gerenciamento) ---
    
    document.querySelector('.menu-container').addEventListener('click', (e) => {
        const target = e.target;
        const itemNome = target.dataset.item;

        if (itemNome) {
            const itemElement = document.querySelector(`.item-card[data-nome="${itemNome}"]`);
            
            if (target.classList.contains('adicionar-personalizado')) {
                const maxSabores = itemElement ? itemElement.dataset.maxSabores : 5;
                openSaboresModal(itemNome, maxSabores);
            } 
            else if (target.classList.contains('adicionar-complemento')) { // NOVO
                openComplementosModal(itemNome);
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
    btnVerCarrinho.onclick = function() { renderizarCarrinhoModal(); modalCarrinho.style.display = 'block'; }
    spanFecharCarrinho.onclick = function() { modalCarrinho.style.display = 'none'; }
    window.onclick = function(event) { 
        if (event.target == modalCarrinho && modalSabores.style.display === 'none' && modalComplementos.style.display === 'none') { 
            modalCarrinho.style.display = 'none'; 
        } 
    }
    
    document.getElementById('lista-carrinho').addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('item-remover')) {
            const itemNome = target.dataset.item;
            removerItemDoCarrinho(itemNome);
        }
    });

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


    // Lógica do Modal de Seleção de Sabores
    closeSabores.onclick = () => { modalSabores.style.display = 'none'; };
    saboresOpcoes.addEventListener('click', handleSaborClick);
    btnConfirmarSabores.addEventListener('click', confirmarSabores);

    // Lógica do Modal de Seleção de Complementos (NOVO)
    closeComplementos.onclick = () => { modalComplementos.style.display = 'none'; };
    complementosOpcoes.addEventListener('click', handleComplementoClick);
    btnConfirmarComplementos.addEventListener('click', confirmarComplementos);

    // Gerenciamento
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