// Variáveis Globais de Controle e Firebase (Definidas no index.html)
let carrinho = {};
let dadosCliente = { nome: '', whatsapp: '', email: '' }; 
let detalhesTransacao = { rua: '', numero: '', referencia: '', pagamento: '', trocoPara: 0 };

let acessoGerenciamentoLiberado = false;
let itemPersonalizavelAtual = null; 
let maxSaboresPermitidos = 0; 
let saboresSelecionados = [];
let complementosSelecionados = []; 
let itemPersonalizadoFinal = {}; 
let produtosCardapioCache = []; // Cache local para os produtos carregados

// Credenciais de Controle
const NOME_ADMIN = "zeze"; 
const ADMIN_UID_PRINCIPAL = "oWClbuRYhgg3T2G0D6TahYlIB242"; // UID fornecido

// LISTAS GLOBAIS DE OPÇÕES (Agora populadas pelo Firestore)
let listaSaboresDisponiveis = []; // Será carregada do Firestore

const listaComplementosDisponiveis = [ // Itens fixos por simplicidade
    { nome: "Extra Queijo", preco: 2.00 },
    { nome: "Borda Recheada (Catupiry)", preco: 5.00 },
    { nome: "Pimenta Extra", preco: 0.00 },
    { nome: "Molho Especial (Sache)", preco: 1.50 }
];


// ------------------------------------------------------------------
// AUTENTICAÇÃO COM FIREBASE (MANTIDA)
// ------------------------------------------------------------------

/**
 * Tenta fazer login com as credenciais fornecidas usando o Firebase Auth.
 */
async function loginAdminComFirebase(email, senha) {
    if (typeof firebase === 'undefined' || !firebase.auth) {
        alert("Erro: O Firebase SDK não foi carregado corretamente. Verifique o index.html.");
        return false;
    }
    
    try {
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, senha);
        const user = userCredential.user;
        
        if (user.uid === ADMIN_UID_PRINCIPAL) {
            console.log("Login Admin Firebase: SUCESSO!", user.uid);
            return true;
        } else {
            await firebase.auth().signOut(); 
            alert("Acesso negado: Este usuário não é o administrador principal.");
            return false;
        }
    } catch (error) {
        alert("Erro de login Admin: Credenciais inválidas ou conta não existe.");
        console.error("Login Admin Firebase: Erro de autenticação:", error.code, error.message);
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
// INTEGRAÇÃO COM FIREBASE FIRESTORE (NOVAS FUNÇÕES)
// ------------------------------------------------------------------

/**
 * Carrega a lista de produtos da coleção 'produtos' no Firestore.
 */
async function carregarCardapio() {
    // Limpa a visualização e o cache
    document.querySelectorAll('.categoria-section').forEach(section => {
        const itens = section.querySelectorAll('.item-card');
        itens.forEach(item => item.remove());
    });
    produtosCardapioCache = [];
    
    try {
        const produtosRef = db.collection('produtos');
        const snapshot = await produtosRef.get();
        
        if (snapshot.empty) {
            console.log("Nenhum produto encontrado no Firestore.");
            // Adiciona um aviso se a lista estiver vazia (apenas para o cliente ver)
             document.getElementById('categoria-pastel').innerHTML += '<p class="aviso-gerenciamento">Nenhum item cadastrado no cardápio.</p>';
            return;
        }
        
        snapshot.forEach(doc => {
            const produto = { id: doc.id, ...doc.data() };
            produtosCardapioCache.push(produto);
            
            // Renderiza o item no cardápio
            const categoriaSection = document.getElementById(`categoria-${produto.categoria}`);
            if (categoriaSection) {
                const novoItemCard = criarItemCardHTML(
                    produto.nome, 
                    produto.descricao, 
                    produto.preco, 
                    produto.categoria, 
                    produto.personalizavel === 'sim', 
                    produto.maxSabores, 
                    produto.id 
                );
                categoriaSection.appendChild(novoItemCard);
                atualizarQuantidadeDisplay(produto.nome); 
            }
        });
    } catch (error) {
        console.error("Erro ao carregar o cardápio do Firestore:", error);
        alert("Erro ao carregar o cardápio. Verifique a conexão com o Firebase.");
    }
}

/**
 * Carrega a lista de sabores do documento 'sabores' no Firestore.
 */
async function carregarSabores() {
    try {
        const doc = await db.collection('configuracoes').doc('sabores').get();
        
        if (doc.exists && doc.data().lista) {
            listaSaboresDisponiveis = doc.data().lista.sort();
            console.log("Sabores carregados:", listaSaboresDisponiveis.length);
        } else {
             // Cria o documento inicial se não existir
            await db.collection('configuracoes').doc('sabores').set({ lista: listaSaboresDisponiveis });
            console.log("Documento de sabores inicializado no Firestore.");
        }
        
    } catch (error) {
        console.error("Erro ao carregar os sabores do Firestore:", error);
    }
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
        botoesHTML = `
            <button class="remover" data-item="${nome}" disabled>-</button>
            <span class="quantidade" id="qty-${nome}">0</span>
            <button class="adicionar-personalizado" data-item="${nome}">+</button>
        `;
    } else {
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

/**
 * Adiciona um produto ao Firestore e recarrega o cardápio.
 */
async function adicionarProdutoAoCardapio(event) {
    event.preventDefault();

    const form = document.getElementById('adicionar-produto-form');
    const categoria = document.getElementById('categoria-produto').value;
    const nome = document.getElementById('nome-produto').value.trim();
    const isPersonalizavel = document.getElementById('is-personalizavel').checked; 
    const maxSabores = isPersonalizavel ? parseInt(document.getElementById('max-sabores').value) : 0; 
    const descricao = document.getElementById('descricao-produto').value.trim();
    const preco = parseFloat(document.getElementById('preco-produto').value);

    if (!categoria || !nome || !descricao || isNaN(preco) || preco <= 0) {
        alert('Por favor, preencha todos os campos obrigatórios corretamente.');
        return;
    }
    
    if (isPersonalizavel && (maxSabores < 1 || isNaN(maxSabores))) {
        alert('Se o produto for personalizável, o máximo de sabores a escolher deve ser 1 ou mais.');
        return;
    }
    
    const nomeExistente = produtosCardapioCache.some(item => 
        item.nome.toLowerCase() === nome.toLowerCase()
    );
    if (nomeExistente) {
        alert(`O produto "${nome}" já existe no cardápio.`);
        return;
    }

    try {
        const novoProduto = {
            nome: nome,
            descricao: descricao,
            preco: preco.toFixed(2), 
            categoria: categoria,
            personalizavel: isPersonalizavel ? 'sim' : 'nao',
            maxSabores: maxSabores,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp() 
        };
        
        await db.collection('produtos').add(novoProduto);
        
        form.reset();
        document.getElementById('max-sabores-group').style.display = 'none'; 
        alert(`Produto "${nome}" adicionado com sucesso e salvo no banco de dados!`);
        
        // Recarrega o cardápio e a lista de gerenciamento
        await carregarCardapio();
        alternarAbas('cardapio');

    } catch (error) {
        console.error("Erro ao adicionar produto:", error);
        alert("Falha ao salvar o produto. Tente novamente.");
    }
}

/**
 * Remove um produto do Firestore e do cardápio.
 */
async function removerProdutoDoCardapio(itemNome) {
    const produto = produtosCardapioCache.find(p => p.nome === itemNome);
    if (!produto || !produto.id) return;

    try {
        await db.collection('produtos').doc(produto.id).delete();

        // Limpa o carrinho para este item
        if (carrinho[itemNome]) { delete carrinho[itemNome]; }

        alert(`Produto "${itemNome}" removido permanentemente.`);
        
        // Recarrega o cardápio e a lista de gerenciamento
        await carregarCardapio();
        atualizarTotalItensBotao();
        renderizarCarrinhoModal();
        renderizarListaGerenciamento();

    } catch (error) {
        console.error("Erro ao remover produto:", error);
        alert("Falha ao remover o produto. Tente novamente.");
    }
}

function renderizarListaGerenciamento() {
    const listaContainer = document.getElementById('lista-produtos-gerenciar');
    listaContainer.innerHTML = ''; 

    if (produtosCardapioCache.length === 0) {
        listaContainer.innerHTML = '<p class="aviso-gerenciamento">Nenhum produto cadastrado no cardápio.</p>';
        return;
    }

    produtosCardapioCache.forEach(produto => {
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

/**
 * Adiciona um sabor e salva a lista atualizada no Firestore.
 */
async function adicionarSabor(event) {
    event.preventDefault();
    const input = document.getElementById('novo-sabor-input');
    let novoSabor = input.value.trim();

    if (novoSabor) {
        novoSabor = novoSabor.charAt(0).toUpperCase() + novoSabor.slice(1).toLowerCase();

        if (!listaSaboresDisponiveis.includes(novoSabor)) {
            listaSaboresDisponiveis.push(novoSabor);
            listaSaboresDisponiveis.sort(); 
            
            try {
                // Salva a lista completa e atualizada no Firestore
                await db.collection('configuracoes').doc('sabores').update({ lista: listaSaboresDisponiveis });
                
                renderizarListaSaboresGerenciamento();
                input.value = '';
                alert(`Sabor "${novoSabor}" adicionado e salvo permanentemente!`);

            } catch (error) {
                console.error("Erro ao adicionar sabor:", error);
                alert("Falha ao salvar o sabor no banco de dados.");
                // Se falhar, reverte localmente (opcional, mas bom)
                listaSaboresDisponiveis.splice(listaSaboresDisponiveis.indexOf(novoSabor), 1);
            }
        } else {
            alert(`O sabor "${novoSabor}" já existe na lista.`);
        }
    }
}

/**
 * Remove um sabor e salva a lista atualizada no Firestore.
 */
async function removerSabor(sabor) {
    const index = listaSaboresDisponiveis.indexOf(sabor);
    if (index > -1) {
        listaSaboresDisponiveis.splice(index, 1);
        
        try {
            // Salva a lista completa e atualizada no Firestore
            await db.collection('configuracoes').doc('sabores').update({ lista: listaSaboresDisponiveis });
            
            renderizarListaSaboresGerenciamento();
            alert(`Sabor "${sabor}" removido permanentemente.`);
        } catch (error) {
            console.error("Erro ao remover sabor:", error);
            alert("Falha ao remover o sabor do banco de dados.");
            // Reverte localmente
            listaSaboresDisponiveis.push(sabor);
            listaSaboresDisponiveis.sort();
        }
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
            carrinho[itemNome].push(itemPersonalizado);
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
            
            const subtotal = itensDoTipo.reduce((sum, item) => sum + item.preco, 0);
            
            let detalhesItem = ''; 
            const isPersonalizavelItem = itensDoTipo.every(item => item.sabores !== undefined);

            if (isPersonalizavelItem || itensDoTipo.some(item => item.complementos !== undefined)) {
                detalhesItem = itensDoTipo.map((item, index) => {
                    const sabores = item.sabores ? item.sabores.join(', ') : '';
                    const complementos = item.complementos && item.complementos.length > 0 ? ` | Extras: ${item.complementos.join(', ')}` : '';
                    
                    if (sabores || complementos) {
                        return `*#${index + 1}:* ${sabores}${complementos}`;
                    }
                    return '';
                }).filter(line => line).join(' <br> ');
            }

            const li = document.createElement('li');
            li.innerHTML = `
                <span>${quantidade}x ${itemNome}</span>
                <span>
                    R$ ${subtotal.toFixed(2).replace('.', ',')}
                    <button class="item-remover" data-item="${itemNome}">Remover</button>
                </span>
                ${detalhesItem ? `<p class="sabores-detalhe">${detalhesItem}</p>` : ''}
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

    if (pagamento === 'dinheiro' && total > 0 && valorPago < total) {
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
    
    if (dadosCliente.email && dadosCliente.email !== 'N/A - Cliente') {
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
        
        mensagem += `  > *${quantidade}x ${itemNome}* \n`;

        const isPersonalizavel = itensDoTipo[0].sabores !== undefined || itensDoTipo[0].complementos !== undefined;
        
        if (isPersonalizavel) {
             itensDoTipo.forEach((item, index) => {
                const sabores = item.sabores && item.sabores.length > 0 ? `Sabores: ${item.sabores.join(', ')}` : '';
                const complementos = item.complementos && item.complementos.length > 0 ? ` | Extras: ${item.complementos.join(', ')}` : '';
                
                if (sabores || complementos) {
                    mensagem += `    - Item #${index + 1}: ${sabores}${complementos}\n`;
                }
            });
        }
    });

    mensagem += `\n*--- Aguardando Confirmação da Loja ---*`;

    const numeroWhatsappLoja = '558199893952'; 
    const linkWhatsapp = `https://wa.me/${numeroWhatsappLoja}?text=${encodeURIComponent(mensagem)}`;

    window.open(linkWhatsapp, '_blank');

    // Resetar o carrinho e a interface
    carrinho = {};
    document.getElementById('modal-carrinho').style.display = 'none';
    carregarCardapio().then(() => { 
        atualizarTotalItensBotao();
    });
}


// ------------------------------------------------------------------
// LÓGICA DE MODAIS (SABORES E COMPLEMENTOS - MANTIDA)
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
    itemPersonalizadoFinal = {}; 

    opcoesContainer.innerHTML = '';
    
    if(listaSaboresDisponiveis.length === 0) {
         opcoesContainer.innerHTML = '<p class="aviso-gerenciamento" style="flex-basis: 100%;">Nenhum sabor cadastrado. Avise o Administrador.</p>';
         btnConfirmar.disabled = true;
    } else {
        listaSaboresDisponiveis.forEach(sabor => {
            const div = document.createElement('div');
            div.classList.add('sabor-item');
            div.dataset.sabor = sabor;
            div.textContent = sabor;
            opcoesContainer.appendChild(div);
        });
    }
    
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
    const itemPreco = parseFloat(itemElement.dataset.preco);
    
    itemPersonalizadoFinal = {
        nome: itemPersonalizavelAtual,
        preco: itemPreco, 
        sabores: [...saboresSelecionados],
        complementos: []
    };
    
    document.getElementById('modal-sabores').style.display = 'none';
    openComplementosModal(itemPersonalizavelAtual);
}


function atualizarPrecoExtraComplementos() {
    let totalExtra = complementosSelecionados.reduce((sum, comp) => sum + comp.preco, 0);
    document.getElementById('complementos-preco-extra').textContent = 
        `Total de Complementos: R$ ${totalExtra.toFixed(2).replace('.', ',')}`;
}

function openComplementosModal(itemNome) {
    const modal = document.getElementById('modal-complementos');
    const titulo = document.getElementById('complementos-modal-titulo');
    const opcoesContainer = document.getElementById('complementos-opcoes');
    
    complementosSelecionados = [];
    titulo.textContent = `Adicionar Complementos ao "${itemNome}"`;

    opcoesContainer.innerHTML = '';
    listaComplementosDisponiveis.forEach(comp => {
        const precoFormatado = comp.preco > 0 ? ` (+R$ ${comp.preco.toFixed(2).replace('.', ',')})` : '';
        const div = document.createElement('div');
        div.classList.add('sabor-item', 'complemento-item');
        div.dataset.nome = comp.nome;
        div.dataset.preco = comp.preco.toFixed(2);
        div.innerHTML = `
            <span>${comp.nome}</span>
            <span class="preco-extra">${precoFormatado}</span>
        `;
        opcoesContainer.appendChild(div);
    });
    
    atualizarPrecoExtraComplementos();
    modal.style.display = 'block';
}

function handleComplementoClick(event) {
    const compElement = event.target.closest('.complemento-item');
    if (!compElement) return;

    const nome = compElement.dataset.nome;
    const preco = parseFloat(compElement.dataset.preco);
    
    const index = complementosSelecionados.findIndex(c => c.nome === nome);
    
    if (index > -1) {
        complementosSelecionados.splice(index, 1);
        compElement.classList.remove('selected');
    } else {
        complementosSelecionados.push({ nome, preco });
        compElement.classList.add('selected');
    }

    atualizarPrecoExtraComplementos();
}

function confirmarComplementos() {
    if (!itemPersonalizadoFinal.nome) return;

    const precoComplementos = complementosSelecionados.reduce((sum, comp) => sum + comp.preco, 0);
    const precoFinal = itemPersonalizadoFinal.preco + precoComplementos;

    itemPersonalizadoFinal.complementos = complementosSelecionados.map(c => c.nome);
    itemPersonalizadoFinal.preco = precoFinal; 
    
    gerenciarCarrinho(itemPersonalizadoFinal.nome, 'adicionar', itemPersonalizadoFinal);

    itemPersonalizadoFinal = {};
    complementosSelecionados = [];
    document.getElementById('modal-complementos').style.display = 'none';
}

// Lógica de Alternância de Abas (Mantida)
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
// EVENT LISTENERS (Ouvintes de Eventos)
// ------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    
    // ... (Inicialização dos Elementos do DOM) ...
    const modalEntrada = document.getElementById('modal-entrada');
    const formAcessoRapido = document.getElementById('form-acesso-rapido'); 
    const formLoginAdmin = document.getElementById('form-login-admin'); 
    const inputAcessoRapidoNome = document.getElementById('acesso-rapido-nome');
    const inputAcessoRapidoWhatsapp = document.getElementById('acesso-rapido-whatsapp');
    const inputAdminEmail = document.getElementById('admin-email');
    const inputTelaCliente = document.getElementById('Tela-cliente');
    const btnGerenciamento = document.getElementById('tab-gerenciamento'); 
    const btnCardapio = document.getElementById('tab-cardapio'); 
    const separatorAuth = document.querySelector('.separator-auth');
    const modal = document.getElementById('modal-carrinho');
    const modalSabores = document.getElementById('modal-sabores');
    const modalComplementos = document.getElementById('modal-complementos'); 
    const btnVerCarrinho = document.getElementById('ver-carrinho-btn');
    const spanFechar = document.querySelector('#modal-carrinho .fechar-modal');
    const finalizarPedidoBtnForm = document.getElementById('finalizar-pedido-btn-form');
    const selectPagamento = document.getElementById('select-pagamento');
    const trocoGroup = document.getElementById('troco-group');
    const inputValorPago = document.getElementById('input-valor-pago');
    const closeSabores = document.querySelector('.fechar-sabores');
    const saboresOpcoes = document.getElementById('sabores-opcoes');
    const btnConfirmarSabores = document.getElementById('confirmar-sabores-btn');
    const closeComplementos = document.querySelector('.fechar-complementos'); 
    const complementosOpcoes = document.getElementById('complementos-opcoes'); 
    const btnConfirmarComplementos = document.getElementById('confirmar-complementos-btn'); 
    const formAdicionarProduto = document.getElementById('adicionar-produto-form');
    const formAdicionarSabor = document.getElementById('adicionar-sabor-form');
    // ... (Fim da Inicialização dos Elementos do DOM) ...

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
            inputAdminEmail.value = "admin@dominio.com"; 
            inputTelaCliente.focus();
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
        
        if (numeroLimpo.length !== 11) {
            alert('Por favor, insira um WhatsApp válido (DDD + 9 dígitos).');
            return;
        }

        dadosCliente.nome = nomeCliente;
        dadosCliente.whatsapp = inputAcessoRapidoWhatsapp.value;
        dadosCliente.email = 'N/A - Cliente'; 

        finalizarAutenticacao();
    });
    
    // --- 3. SUBMISSÃO DO FORMULÁRIO (LOGIN ADMIN COM FIREBASE) ---
    formLoginAdmin.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = inputAdminEmail.value;
        const senha = inputTelaCliente.value;
        
        const sucessoLogin = await loginAdminComFirebase(email, senha);

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
        } 
    });


    // --- 4. Demais Listeners (Carrinho, Sabores, Complementos, Gerenciamento) ---
    
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
    btnVerCarrinho.onclick = function() { renderizarCarrinhoModal(); modal.style.display = 'block'; }
    spanFechar.onclick = function() { modal.style.display = 'none'; }
    window.onclick = function(event) { 
        if (event.target == modalSabores) {
            modalSabores.style.display = 'none';
        } else if (event.target == modalComplementos) {
             modalComplementos.style.display = 'none';
        } else if (event.target == modal && modalSabores.style.display === 'none' && modalComplementos.style.display === 'none') { 
            modal.style.display = 'none'; 
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

    // Lógica do Modal de Seleção de Complementos
    closeComplementos.onclick = () => { 
        modalComplementos.style.display = 'none'; 
        itemPersonalizadoFinal = {};
        complementosSelecionados = [];
    };
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

    // Inicialização do Firebase e Carregamento de Dados
    if (typeof db !== 'undefined') {
        carregarSabores().then(() => {
             carregarCardapio();
        });
    } else {
        alert("Erro fatal: Firestore não inicializado. Verifique a configuração no index.html.");
    }
});