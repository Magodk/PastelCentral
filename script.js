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
let maxSaboresPermitidos = 0; 
let saboresSelecionados = [];

// Credencial Fixa (Para acesso ao gerenciamento SEM Firebase)
const NOME_ADMIN = "zeze"; 
const EMAIL_ADMIN = "acesso@telaprincipal.com"; // NOVO EMAIL
const CLIENTE = "telaprincipal"; // 


// LISTA GLOBAL DE SABORES (Temporária)
let listaSaboresDisponiveis = [
    "Carne", "Frango", "Camarão", "Charque", "4 Queijos", "Pizza", "Palmito", "Calabresa",
    "Chocolate", "Doce de Leite", "Goiabada", "Banana com Canela"
];


// ------------------------------------------------------------------
// AUTENTICAÇÃO SIMPLIFICADA (SEM FIREBASE)
// ------------------------------------------------------------------

function verificarLoginAdminLocal(email, cliente) {
    if (email === EMAIL_ADMIN && cliente === CLIENTE) {
        console.log("Login Admin Local: SUCESSO!");
        return true;
    } else {
        console.error("Login Admin Local: Credenciais incorretas.");
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
    // Limpa os itens existentes
    document.querySelectorAll('.categoria-section').forEach(section => {
        const itens = section.querySelectorAll('.item-card');
        itens.forEach(item => item.remove());
    });

    // Dados Iniciais (Simulação de API)
    const produtosIniciais = [
         { nome: "Pastel Gourmet (Escolha 5 Sabores)", preco: "30.00", categoria: "pastel", personalizavel: "sim", maxSabores: "5", descricao: "Selecione 5 sabores exclusivos para o seu pastel perfeito!", },
         { nome: "Pastel de Carne com Queijo", preco: "8.50", categoria: "pastel", personalizavel: "nao", descricao: "Deliciosa carne moída temperada com queijo derretido.", },
         { nome: "Mini Coxinha de Frango (12 un.)", preco: "15.00", categoria: "coxinha", personalizavel: "nao", descricao: "Porção com 12 mini coxinhas crocantes de frango.", },
         { nome: "Pastel de Chocolate c/ Morango", preco: "12.00", categoria: "doces", personalizavel: "nao", descricao: "Chocolate cremoso e morangos frescos, uma combinação perfeita.", },
         { nome: "Coca-Cola Lata 350ml", preco: "6.00", categoria: "bebidas", personalizavel: "nao", descricao: "Aquele clássico que refresca a qualquer hora.", },
    ];

    produtosIniciais.forEach(produto => {
        const categoriaSection = document.getElementById(`categoria-${produto.categoria}`);
        if (categoriaSection) {
            const isPersonalizavel = produto.personalizavel === 'sim';
            const maxSabores = produto.maxSabores || 0;
            
            const novoItemCard = criarItemCardHTML(
                produto.nome, 
                produto.descricao, 
                produto.preco, 
                produto.categoria, 
                isPersonalizavel, 
                maxSabores, 
                produto.id // ID não está sendo usado neste exemplo local
            );
            categoriaSection.appendChild(novoItemCard);
            atualizarQuantidadeDisplay(produto.nome); // Garante que a quantidade mostrada é 0
        }
    });
}

function criarItemCardHTML(nome, descricao, preco, categoria, isPersonalizavel, maxSabores = 0, id = null) {
    const precoFormatado = parseFloat(preco).toFixed(2).replace('.', ',');
    const personalizavelData = isPersonalizavel ? 'sim' : 'nao';

    const card = document.createElement('div');
    card.classList.add('item-card');
    if (isPersonalizavel) card.classList.add('personalizavel-item');
    
    card.dataset.nome = nome;
    card.dataset.preco = parseFloat(preco).toFixed(2); 
    card.dataset.categoria = categoria; 
    card.dataset.personalizavel = personalizavelData; 
    if (isPersonalizavel) { card.dataset.maxSabores = maxSabores; }
    if (id) { card.dataset.id = id; }

    let botoesHTML = '';
    if (isPersonalizavel) {
        // Botão de adicionar personalizado abre o modal de sabores
        botoesHTML = `
            <button class="remover" data-item="${nome}" disabled>-</button>
            <span class="quantidade" id="qty-${nome}">0</span>
            <button class="adicionar-personalizado" data-item="${nome}">+</button>
        `;
    } else {
         // Botões de adicionar/remover padrão
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
    
    // Verifica se o nome já existe
    const nomeExistente = Array.from(document.querySelectorAll('.item-card')).some(item => 
        item.dataset.nome.toLowerCase() === nome.toLowerCase()
    );
    if (nomeExistente) {
        alert(`O produto "${nome}" já existe no cardápio. Por favor, use um nome diferente.`);
        return;
    }

    const categoriaSection = document.getElementById(`categoria-${categoria}`);
    if (categoriaSection) {
        const novoItemCard = criarItemCardHTML(nome, descricao, preco, categoria, isPersonalizavel, maxSabores); 
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
    
    // Remove do carrinho se existir
    if (carrinho[itemNome]) {
        delete carrinho[itemNome];
        atualizarTotalItensBotao();
        renderizarCarrinhoModal();
    }

    alert(`Produto "${itemNome}" removido (temporariamente).`);
    renderizarListaGerenciamento(); // Atualiza a lista de gerenciamento
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

function adicionarSabor(event) {
    event.preventDefault();
    const input = document.getElementById('novo-sabor-input');
    let novoSabor = input.value.trim();

    if (novoSabor) {
        // Formata o sabor (primeira letra maiúscula)
        novoSabor = novoSabor.charAt(0).toUpperCase() + novoSabor.slice(1).toLowerCase();

        if (!listaSaboresDisponiveis.includes(novoSabor)) {
            listaSaboresDisponiveis.push(novoSabor);
            listaSaboresDisponiveis.sort(); // Mantém em ordem alfabética
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
            // Desabilita o botão de remover se a quantidade for 0
            btnRemover.disabled = quantidadeAtual === 0;
        }
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
            // Adiciona a entrada do item personalizado
            carrinho[itemNome].push({ preco: itemPreco, sabores: itemPersonalizado.sabores });
        } else if (acao === 'remover' && carrinho[itemNome].length > 0) {
            // Remove a última entrada (útil para personalizáveis)
            carrinho[itemNome].pop();
        }
    } else { 
        if (acao === 'adicionar') {
            carrinho[itemNome].push({ preco: itemPreco });
        } else if (acao === 'remover' && carrinho[itemNome].length > 0) {
            carrinho[itemNome].pop();
        }
    }

    if (carrinho[itemNome].length === 0) {
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
        // Soma o preço de cada instância do item
        total += carrinho[itemNome].reduce((sum, item) => sum + item.preco, 0);
    }
    return total;
}

function atualizarTotalItensBotao() {
    let totalItens = Object.values(carrinho).reduce((sum, current) => sum + current.length, 0);
    const totalValor = calcularTotal().toFixed(2).replace('.', ',');
    
    document.getElementById('total-itens').textContent = totalItens;
    document.getElementById('valor-total-carrinho-botao').textContent = `R$ ${totalValor}`;

    // Habilita/Desabilita o botão de finalizar pedido no modal
    const finalizarPedidoBtnForm = document.getElementById('finalizar-pedido-btn-form');
    if (finalizarPedidoBtnForm) {
        finalizarPedidoBtnForm.disabled = totalItens === 0;
    }
    
    // Adiciona/Remove a classe de "pulse" no botão do carrinho
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
            const itemPrecoUnitario = itensDoTipo[0].preco;
            const subtotal = quantidade * itemPrecoUnitario;

            let descricaoSabores = '';
            const isPersonalizavel = itensDoTipo[0].sabores !== undefined && itensDoTipo[0].sabores.length > 0;
            
            if (isPersonalizavel) {
                // Monta a lista de sabores para cada unidade personalizada
                descricaoSabores = itensDoTipo.map((item, index) => {
                    return `*#${index + 1}:* ${item.sabores.join(', ')}`;
                }).join(' <br> ');
            }

            const li = document.createElement('li');
            li.innerHTML = `
                <span>${quantidade}x ${itemNome}</span>
                <span> 
                    R$ ${subtotal.toFixed(2).replace('.', ',')} 
                    <button class="item-remover" data-item="${itemNome}">Remover</button>
                </span>
                ${isPersonalizavel ? `<p class="sabores-detalhe">${descricaoSabores}</p>` : ''}
            `;
            listaCarrinho.appendChild(li);
        });
    }

    valorTotalSpan.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
    
    // Recalcula o troco se a opção for dinheiro
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

    // Se tudo estiver OK, armazena os detalhes da transação
    detalhesTransacao.rua = rua;
    detalhesTransacao.numero = numero;
    detalhesTransacao.referencia = document.getElementById('input-referencia').value.trim();
    detalhesTransacao.pagamento = pagamento;
    detalhesTransacao.trocoPara = pagamento === 'dinheiro' ? valorPago : 0;

    return true;
}

function gerarMensagemWhatsApp() {
    // 1. DADOS DO CLIENTE
    let mensagem = `*PEDIDO NOVO - PASTEL CENTRAL*\n\n`;
    mensagem += `*Cliente:* ${dadosCliente.nome}\n`;
    mensagem += `*WhatsApp:* ${dadosCliente.whatsapp}\n`;
    if (dadosCliente.email) {
        mensagem += `*Email:* ${dadosCliente.email}\n`;
    }
    mensagem += `\n------------------------\n`;

    // 2. ITENS DO PEDIDO
    mensagem += `*ITENS:*\n`;
    let totalItens = 0;
    
    const nomesItensOrdenados = Object.keys(carrinho).sort();

    nomesItensOrdenados.forEach(itemNome => {
        const itensDoTipo = carrinho[itemNome];
        const quantidadeTotal = itensDoTipo.length;
        const subtotal = (quantidadeTotal * itensDoTipo[0].preco).toFixed(2).replace('.', ',');
        totalItens += quantidadeTotal;

        mensagem += `- *${quantidadeTotal}x* ${itemNome} (R$ ${subtotal})\n`;
        
        // Adiciona detalhes de sabores
        if (itensDoTipo[0].sabores && itensDoTipo[0].sabores.length > 0) {
            itensDoTipo.forEach((item, index) => {
                mensagem += `  -> #Item ${index + 1}: ${item.sabores.join(', ')}\n`;
            });
        }
    });
    
    mensagem += `\n*TOTAL DE ITENS:* ${totalItens}\n`;
    mensagem += `*TOTAL DO PEDIDO:* R$ ${calcularTotal().toFixed(2).replace('.', ',')}\n`;
    mensagem += `\n------------------------\n`;

    // 3. DETALHES DA ENTREGA E PAGAMENTO
    mensagem += `*ENTREGA:* \n`;
    mensagem += `Rua/Av: ${detalhesTransacao.rua}, Nº ${detalhesTransacao.numero}\n`;
    if (detalhesTransacao.referencia) {
        mensagem += `Referência: ${detalhesTransacao.referencia}\n`;
    }
    
    mensagem += `\n*PAGAMENTO:*\n`;
    mensagem += `Forma: ${detalhesTransacao.pagamento.toUpperCase()}\n`;
    
    if (detalhesTransacao.pagamento === 'dinheiro') {
        const troco = (detalhesTransacao.trocoPara - calcularTotal()).toFixed(2).replace('.', ',');
        mensagem += `Valor para Troco: R$ ${detalhesTransacao.trocoPara.toFixed(2).replace('.', ',')}\n`;
        mensagem += `Troco a ser dado: R$ ${troco}\n`;
    }

    return encodeURIComponent(mensagem);
}

function enviarPedidoWhatsApp(event) {
    event.preventDefault();
    
    if (Object.keys(carrinho).length === 0) {
        alert('Seu carrinho está vazio. Adicione itens antes de finalizar.');
        return;
    }

    if (validarFormularioPedido()) {
        const mensagem = gerarMensagemWhatsApp();
        const numeroWhatsapp = '5581912345678'; // Substitua pelo número real da loja
        const url = `https://api.whatsapp.com/send?phone=${numeroWhatsapp}&text=${mensagem}`;
        
        window.open(url, '_blank');
        
        // Opcional: Limpar o carrinho e fechar o modal após o envio
        carrinho = {};
        atualizarTotalItensBotao();
        document.getElementById('modal-carrinho').classList.remove('visible');
        
        // Reseta os campos do form de checkout para a próxima vez
        document.getElementById('form-finalizar-pedido').reset();
        document.getElementById('troco-group').style.display = 'none';
        document.getElementById('aviso-troco').textContent = 'Informe o valor que será entregue para calcular o troco.';
        document.getElementById('aviso-troco').style.color = 'var(--cor-info)';
        
        alert('Seu pedido foi enviado para o WhatsApp! Aguarde a confirmação da loja.');
    }
}

// ------------------------------------------------------------------
// LÓGICA DO MODAL DE SABORES
// ------------------------------------------------------------------

function abrirModalSabores(itemNome, maxSabores) {
    const modal = document.getElementById('modal-sabores');
    const titulo = document.getElementById('sabores-modal-titulo');
    const info = document.getElementById('sabores-modal-info');
    
    itemPersonalizavelAtual = itemNome;
    maxSaboresPermitidos = parseInt(maxSabores);
    saboresSelecionados = [];

    titulo.textContent = `Escolha seus Sabores para ${itemNome}`;
    info.textContent = `Selecione no máximo ${maxSaboresPermitidos} sabores.`;
    
    renderizarOpcoesSabores();
    atualizarContadorSabores();

    modal.classList.add('visible');
    document.body.classList.add('no-scroll');
}

function renderizarOpcoesSabores() {
    const opcoesContainer = document.getElementById('sabores-opcoes');
    opcoesContainer.innerHTML = '';

    listaSaboresDisponiveis.forEach(sabor => {
        const div = document.createElement('div');
        div.classList.add('sabor-opcao');
        div.textContent = sabor;
        div.dataset.sabor = sabor;

        div.addEventListener('click', () => toggleSabor(sabor, div));
        opcoesContainer.appendChild(div);
    });
}

function toggleSabor(sabor, elemento) {
    const index = saboresSelecionados.indexOf(sabor);
    
    if (index > -1) {
        // Desselecionar
        saboresSelecionados.splice(index, 1);
        elemento.classList.remove('selecionado');
    } else {
        // Selecionar (se não exceder o limite)
        if (saboresSelecionados.length < maxSaboresPermitidos) {
            saboresSelecionados.push(sabor);
            elemento.classList.add('selecionado');
        } else {
            alert(`Você já selecionou o máximo de ${maxSaboresPermitidos} sabores permitidos.`);
        }
    }
    
    atualizarContadorSabores();
}

function atualizarContadorSabores() {
    const contador = document.getElementById('sabores-contador');
    const btnAdicionar = document.getElementById('adicionar-sabores-carrinho');
    const numSelecionados = saboresSelecionados.length;
    
    contador.textContent = `Sabores escolhidos: ${numSelecionados} de ${maxSaboresPermitidos}`;
    
    // O botão só é habilitado se pelo menos 1 sabor for escolhido
    if (numSelecionados > 0) {
        btnAdicionar.disabled = false;
        contador.style.color = 'var(--cor-sucesso)';
    } else {
        btnAdicionar.disabled = true;
        contador.style.color = 'var(--cor-destaque)';
    }
}

function adicionarPersonalizadoAoCarrinho() {
    const modal = document.getElementById('modal-sabores');
    
    if (saboresSelecionados.length > 0) {
        // Cria um novo item personalizado com os sabores escolhidos
        const itemPersonalizado = {
            sabores: [...saboresSelecionados] // Clonar para evitar referência
        };
        
        gerenciarCarrinho(itemPersonalizavelAtual, 'adicionar', itemPersonalizado);
        
        // Fecha o modal e limpa o estado
        itemPersonalizavelAtual = null;
        maxSaboresPermitidos = 0;
        saboresSelecionados = [];
        modal.classList.remove('visible');
        document.body.classList.remove('no-scroll');
    } else {
        alert('Por favor, selecione pelo menos um sabor.');
    }
}


// ------------------------------------------------------------------
// INICIALIZAÇÃO E LISTENERS DE EVENTOS
// ------------------------------------------------------------------

function alternarAbas(aba) {
    const tabCardapioBtn = document.getElementById('tab-cardapio');
    const tabGerenciamentoBtn = document.getElementById('tab-gerenciamento');
    const cardapioContainer = document.querySelector('.menu-container');
    const gerenciamentoContainer = document.getElementById('gerenciamento');
    const footerCarrinho = document.getElementById('footer-carrinho');
    
    if (aba === 'cardapio') {
        tabCardapioBtn.classList.add('active');
        tabGerenciamentoBtn.classList.remove('active');
        cardapioContainer.style.display = 'block';
        gerenciamentoContainer.style.display = 'none';
        footerCarrinho.style.display = 'block';
    } else if (aba === 'gerenciamento' && acessoGerenciamentoLiberado) {
        tabCardapioBtn.classList.remove('active');
        tabGerenciamentoBtn.classList.add('active');
        cardapioContainer.style.display = 'none';
        gerenciamentoContainer.style.display = 'block';
        footerCarrinho.style.display = 'none';
        
        renderizarListaGerenciamento();
        renderizarListaSaboresGerenciamento();
    }
}

function inicializarApp() {
    // Carrega o cardápio inicial
    carregarCardapioDaAPI();
    
    // Adiciona a máscara ao campo de WhatsApp
    const whatsappInput = document.getElementById('acesso-rapido-whatsapp');
    whatsappInput.addEventListener('input', (e) => {
        e.target.value = phoneMask(e.target.value);
    });

    // === Listeners do Modal de Entrada (Login) ===
    document.getElementById('form-acesso-rapido').addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Armazena os dados do cliente
        dadosCliente.nome = document.getElementById('acesso-rapido-nome').value.trim();
        dadosCliente.whatsapp = document.getElementById('acesso-rapido-whatsapp').value.trim();
        dadosCliente.email = document.getElementById('acesso-rapido-email').value.trim();
        
        // Injeta os dados no modal do carrinho (checkout)
        document.getElementById('info-cliente-nome').textContent = dadosCliente.nome;
        document.getElementById('info-cliente-whatsapp').textContent = dadosCliente.whatsapp;

        finalizarAutenticacao();
        
        // Exibe o botão de gerenciamento APENAS no cabeçalho, mas sem acesso ainda
        document.getElementById('tab-gerenciamento').style.display = 'block';
    });
    
    document.getElementById('form-login-admin').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('admin-email').value.trim();
        const senha = document.getElementById('Tela-cliente').value.trim();
        
        if (verificarLoginAdminLocal(email, senha)) {
            acessoGerenciamentoLiberado = true;
            
            // Simula o login do cliente para preencher os dados do pedido
            dadosCliente.nome = NOME_ADMIN;
            dadosCliente.whatsapp = '(99) 99999-9999';
            dadosCliente.email = EMAIL_ADMIN;
            
            // Injeta os dados no modal do carrinho (checkout)
            document.getElementById('info-cliente-nome').textContent = dadosCliente.nome + ' (ADMIN)';
            document.getElementById('info-cliente-whatsapp').textContent = dadosCliente.whatsapp;

            finalizarAutenticacao();
            
            // Oculta o botão de Voltar para Cliente
            document.getElementById('toggle-acesso-rapido').style.display = 'none';
        } else {
            alert('Acesso negado. Verifique Email e Senha Admin.');
        }
    });
    
    // Alternância do Login (Admin/Cliente)
    const formAcessoRapido = document.getElementById('form-acesso-rapido');
    const formLoginAdmin = document.getElementById('form-login-admin');
    const toggleAdminBtn = document.getElementById('toggle-admin-login');
    const toggleClienteBtn = document.getElementById('toggle-acesso-rapido');
    const separatorAuth = document.querySelector('.separator-auth');
    
    // Mostra o botão de alternância para o Admin (pois inicialmente está no Acesso Rápido)
    toggleAdminBtn.style.display = 'block'; 
    
    toggleAdminBtn.addEventListener('click', () => {
        formAcessoRapido.style.display = 'none';
        formLoginAdmin.style.display = 'block';
        toggleAdminBtn.style.display = 'none';
        toggleClienteBtn.style.display = 'block';
        separatorAuth.style.display = 'none';
    });

    toggleClienteBtn.addEventListener('click', () => {
        formAcessoRapido.style.display = 'block';
        formLoginAdmin.style.display = 'none';
        toggleAdminBtn.style.display = 'block';
        toggleClienteBtn.style.display = 'none';
        separatorAuth.style.display = 'none';
    });

    // === Listeners do Cardápio (Adicionar/Remover Item) ===
    document.querySelector('.menu-container').addEventListener('click', (e) => {
        const target = e.target;
        const itemNome = target.dataset.item;
        
        if (!itemNome) return;

        if (target.classList.contains('adicionar')) {
            gerenciarCarrinho(itemNome, 'adicionar');
        } else if (target.classList.contains('remover')) {
            gerenciarCarrinho(itemNome, 'remover');
        } else if (target.classList.contains('adicionar-personalizado')) {
            const itemCard = target.closest('.item-card');
            const maxSabores = itemCard.dataset.maxSabores;
            abrirModalSabores(itemNome, maxSabores);
        }
    });
    
    // === Listeners do Carrinho/Checkout ===
    document.getElementById('ver-carrinho-btn').addEventListener('click', () => {
        document.getElementById('modal-carrinho').classList.add('visible');
        document.body.classList.add('no-scroll');
        renderizarCarrinhoModal();
    });
    
    document.querySelector('.fechar-carrinho').addEventListener('click', () => {
        document.getElementById('modal-carrinho').classList.remove('visible');
        document.body.classList.remove('no-scroll');
    });
    
    document.getElementById('lista-carrinho').addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('item-remover')) {
            const itemNome = target.dataset.item;
            if (confirm(`Tem certeza que deseja remover todos os itens do tipo "${itemNome}" do carrinho?`)) {
                removerItemDoCarrinho(itemNome);
            }
        }
    });

    // Lógica para mostrar/ocultar o campo de troco
    document.getElementById('select-pagamento').addEventListener('change', (e) => {
        const trocoGroup = document.getElementById('troco-group');
        if (e.target.value === 'dinheiro') {
            trocoGroup.style.display = 'block';
            calcularTrocoSimulado();
        } else {
            trocoGroup.style.display = 'none';
        }
    });
    
    // Lógica para calcular troco
    document.getElementById('input-valor-pago').addEventListener('input', calcularTrocoSimulado);

    // Finalizar pedido (Enviar para WhatsApp)
    document.getElementById('form-finalizar-pedido').addEventListener('submit', enviarPedidoWhatsApp);
    
    // === Listeners do Modal de Sabores ===
    document.querySelector('.fechar-sabores').addEventListener('click', () => {
        document.getElementById('modal-sabores').classList.remove('visible');
        document.body.classList.remove('no-scroll');
    });
    
    document.getElementById('adicionar-sabores-carrinho').addEventListener('click', adicionarPersonalizadoAoCarrinho);

    // === Listeners da Área de Gerenciamento ===
    const formAdicionarProduto = document.getElementById('adicionar-produto-form');
    formAdicionarProduto.addEventListener('submit', adicionarProdutoAoCardapio);
    
    // Lógica para mostrar o campo de máx. sabores ao marcar o checkbox
    document.getElementById('is-personalizavel').addEventListener('change', (e) => {
        const maxSaboresGroup = document.getElementById('max-sabores-group');
        maxSaboresGroup.style.display = e.target.checked ? 'block' : 'none';
    });

    // Listener para remover produto do cardápio (dentro da aba de gerenciamento)
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
    const formAdicionarSabor = document.getElementById('form-adicionar-sabor');
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
    
    const btnGerenciamento = document.getElementById('tab-gerenciamento');
    btnGerenciamento.addEventListener('click', () => {
        if (acessoGerenciamentoLiberado) {
            alternarAbas('gerenciamento');
        } else {
            alert('Acesso negado! A aba de Gerenciamento é restrita ao Administrador.');
            // Volta para a aba de cardápio caso clique por engano
            alternarAbas('cardapio'); 
        }
    });
}

// Inicia a aplicação
document.addEventListener('DOMContentLoaded', inicializarApp);