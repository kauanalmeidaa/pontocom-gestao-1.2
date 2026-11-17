# PontoCom Gestão – versão de teste local

Sistema de gestão para empresa de segurança eletrônica: clientes, ordens de serviço (com fotos e assinatura), orçamentos com kits, estoque, financeiro, agenda, contratos de manutenção, garantias, lembretes por WhatsApp e relatórios.

## Como rodar no VS Code

**Não dê dois cliques no `index.html`.** O sistema usa módulos JavaScript, que o navegador só carrega por um endereço `http://`. Escolha uma das opções:

### Opção A – Live Server (mais fácil)
1. Abra a pasta `pontocom-gestao` no VS Code (Arquivo → Abrir Pasta).
2. Instale a extensão **Live Server** (autor: Ritwick Dey).
3. Clique com o botão direito em `index.html` → **Open with Live Server**.
4. O navegador abre em `http://127.0.0.1:5500`.

### Opção B – Terminal (se tiver Python ou Node)
No terminal do VS Code (Ctrl + `), dentro da pasta:

    python -m http.server 8000

(ou `npx serve`). Depois abra `http://localhost:8000`.

## Novidades desta versão
- **Recibo de pagamento:** ao dar baixa em uma cobrança (Financeiro ou botão "Receber pagamento" dentro da OS concluída), o sistema oferece o recibo. Ele sai em PDF com número sequencial, valor por extenso e carimbo PAGO, e também dá para enviar por WhatsApp. Depois de pago, o recibo pode ser emitido de novo a qualquer momento (mesmo número) pela OS ou pelo lançamento.
- **Novo layout do orçamento (PDF):** cabeçalho escuro com a sua logo e cor da marca, valor total em destaque, tabela de itens, garantias e validade em destaque e área de assinatura. O mesmo estilo vale para o recibo.
- **Permissões por usuário:** em **Ajustes → Usuários e permissões**, ao criar ou editar um usuário você marca quais módulos ele acessa. Escolher a função preenche um modelo (que você pode alterar).
- **Acesso limitado (técnico):** com essa opção marcada, o usuário vê só as OS **em aberto atribuídas a ele** e a **agenda da semana atual**, sem navegar para outras semanas, sem criar OS e sem ver financeiro. Para uma OS aparecer para ele, escolha o nome dele em "Técnico responsável" na OS. Quando ele conclui a OS, ela sai da lista dele.

## Primeiros passos
1. Na primeira vez, o sistema pede o nome da empresa, o seu nome e um **PIN** (4 a 8 números). Você vira o **dono**.
2. Vá em **Ajustes → Testes → Carregar dados de exemplo** para ver todas as telas preenchidas. Para começar do zero depois, use **Apagar todos os dados**.
3. Em **Ajustes**, coloque sua logo, cor da marca, WhatsApp, CNPJ e o texto de garantia.
4. Em **Clientes**, importe a lista do seu sistema atual (exporte como CSV).

## Testar no iPhone
O celular precisa acessar o computador pela mesma rede Wi-Fi. Rode com `python -m http.server 8000`, descubra o IP do computador (ex.: 192.168.0.15) e abra `http://192.168.0.15:8000` no Safari. Funciona para testar o visual. Para **instalar na tela inicial** e ter modo offline, o endereço precisa ser `https://` (ex.: Netlify, Cloudflare Pages ou GitHub Pages, todos grátis).

## O que cada tela faz
- **Início:** números do mês, gráfico de entradas e saídas, agenda de hoje e alertas.
- **Agenda:** visitas da semana (OS com data e horário e visitas de contrato).
- **Ordens de serviço:** etapas por tipo de serviço, materiais, fotos do antes e do depois, assinatura do cliente, PDF e WhatsApp. Ao **concluir**: baixa o estoque, lança a cobrança no financeiro e registra o equipamento nas garantias.
- **Orçamentos:** itens do estoque ou avulsos, kits prontos, desconto, PDF, WhatsApp e botão "Virar OS".
- **Estoque:** entrada, ajuste, mínimo com alerta e histórico. Entrada de compra pode lançar a conta a pagar.
- **Financeiro:** a receber, a pagar, baixa com forma de pagamento e fluxo de caixa com previsão.
- **Contratos:** mensalidade, visita preventiva periódica, gerar OS da visita e gerar a cobrança do mês.
- **Garantias:** equipamentos instalados com prazo de garantia do equipamento e da mão de obra, e histórico de atendimentos.
- **Lembretes:** visitas de amanhã, cobranças, contratos, garantias vencendo e orçamentos parados, cada um com a mensagem de WhatsApp pronta.
- **Relatórios:** faturamento, margem, serviços e produtos mais vendidos, melhores clientes, exportação em CSV.
- **Ajustes:** marca, usuários e permissões por módulo, etapas por serviço, kits e backup.

## Limites desta versão (importante)
- **Os dados ficam só no navegador do aparelho** (IndexedDB). Cada endereço (`localhost:5500`, `localhost:8000`, o site publicado) tem o seu próprio banco, separado. **Faça backup** em Ajustes toda semana.
- O **PIN e as permissões só organizam o uso neste aparelho. Não são segurança de verdade** (um técnico com acesso ao navegador conseguiria abrir os dados por fora do sistema): quem abre o navegador do aparelho consegue acessar os dados. Segurança real e vários aparelhos juntos exigem o login online (próxima fase).
- Os lembretes abrem o WhatsApp com a mensagem pronta, mas **você** toca em enviar. Envio automático exige um serviço de WhatsApp comercial.
- Fotos e assinaturas ficam dentro do navegador e pesam no backup. Evite centenas de fotos por vez.
- Não tem emissão de nota fiscal nem cobrança por PIX/boleto automática.

## Para virar produto e revender
Falta, nessa ordem: banco de dados online com login (um espaço isolado por empresa), cobrança de mensalidade, termos de uso e LGPD, e um período de teste com 3 a 5 empresas conhecidas. Toda a gravação de dados passa pelo arquivo `js/store.js`, então a troca para o banco online mexe principalmente nele.

## Estrutura
    index.html            página única
    css/style.css         visual
    js/app.js             login, menu, rotas
    js/store.js           ÚNICO arquivo que grava dados
    js/domain.js          regras (baixa de estoque, garantias, lembretes, permissões)
    js/docs.js            PDF do orçamento e do recibo
    js/util.js, items.js  utilidades
    js/views/*.js         uma tela por arquivo
    manifest.webmanifest, sw.js, icon-*.png   instalação no celular
