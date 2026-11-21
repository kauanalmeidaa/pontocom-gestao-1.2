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

## Novidades (orçamento, OS e estoque)
- **Orçamento e OS no mesmo layout (PDF):** cabeçalho com a logo, dados do cliente, itens, subtotal, desconto e total embaixo. Sem o quadrado azul de valor no topo.
- **Foto do produto no orçamento:** em cada item, toque em "Foto do produto". A foto sai no PDF ao lado da descrição.
- **Observações, Condições de garantia e Condições contratuais:** escreva os textos padrão em **Ajustes → Sua marca → Textos padrão dos documentos**. Todo orçamento e OS novo já vem preenchido, e você pode editar o texto só daquele documento.
- **Material de consumo na OS:** abra a OS → aba **Material de consumo** → escolha o material e a quantidade → **Dar baixa no estoque**. A baixa fica na OS e no cliente. Dá para estornar.
- **Formas de pagamento no orçamento:** ao criar o orçamento, marque as formas aceitas (PIX, dinheiro, cartão, boleto…) e escreva as condições. Em Ajustes você escolhe quais já vêm marcadas.
- **PDF pelo Chrome sem cabeçalho e rodapé do navegador** (data, endereço do site). Se ainda aparecerem, na janela de impressão desmarque "Cabeçalhos e rodapés".
- **Estoque → Consumo e compras:** mostra o uso de cada material nos últimos 30, 60 ou 90 dias, quantos dias o estoque dura e a sugestão de compra.

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
Falta, nessa ordem: banco de dados online com login (um espaço isolado por empresa), cobrança de mensalidade, termos de uso e LGPD, e um período de teste com 3 a 5 empresas conhecidas. Toda a gravação de dados passa pelo arquivo `js/store.js` (e `js/cloud.js` no modo online).

## Estrutura
    index.html            página única
    css/style.css         visual
    assets/               logo e emblema da marca
    js/app.js             login, menu, rotas
    js/store.js           ÚNICO arquivo que grava dados
    js/domain.js          regras (baixa de estoque, garantias, lembretes, permissões)
    js/docs.js            PDF do orçamento e do recibo
    js/util.js, items.js  utilidades
    js/views/*.js         uma tela por arquivo
    manifest.webmanifest, sw.js, icon-*.png   instalação no celular

## Publicar no GitHub Pages (usar pelo celular)
1. **O `index.html` precisa estar na raiz do repositório**, ou seja, aparecer logo na primeira tela do repositório no GitHub, junto com as pastas `css`, `js` e `assets`. Suba o **conteúdo** da pasta, não o arquivo `.zip` (o GitHub não abre zip) e, se possível, não a pasta `pontocom-gestao` por fora.
2. No repositório: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` e pasta `/ (root)` → Save**.
3. Espere de 1 a 3 minutos. Na aba **Actions** deve aparecer "pages build and deployment" com ✓ verde.
4. O endereço do site é `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`. Não é o endereço do repositório (github.com/...). Maiúsculas e minúsculas contam.
5. Se o repositório for **privado**, o Pages gratuito não publica. Deixe o repositório **público** (o que fica público é só o código; os dados da empresa ficam no seu aparelho).
6. No iPhone: abra o endereço no **Safari → Compartilhar → Adicionar à Tela de Início**.

**Importante:** os dados ficam separados em cada endereço e aparelho. O que você cadastrou no computador (localhost) não aparece no celular. Para levar os dados: em **Ajustes → Fazer backup** no computador, e **Restaurar backup** no celular.

## Login e banco online (Firebase) — passo a passo
1. Acesse console.firebase.google.com com sua conta Google → **Criar projeto** (nome: pontocom-gestao; pode desligar o Google Analytics).
2. **Authentication → Vamos começar → Método de login → E-mail/senha → Ativar → Salvar.**
3. **Firestore Database → Criar banco de dados → modo de produção → local: southamerica-east1 (São Paulo) → Ativar.**
4. Ainda no Firestore, aba **Regras**: apague tudo, cole o conteúdo do arquivo `firestore.rules` e clique **Publicar**.
5. **Engrenagem → Configurações do projeto → Seus apps → ícone `</>` (Web)** → dê um apelido → Registrar app. Copie `apiKey`, `authDomain`, `projectId` e `appId`.
6. No GitHub, abra `js/config.js`, clique no lápis, cole os 4 valores entre as aspas e salve (Commit).
7. Para o botão **Continuar com Google**: **Authentication → Método de login → Google → Ativar →** escolha o e-mail de suporte do projeto → Salvar.
8. **Authentication → Configurações → Domínios autorizados → Adicionar domínio:** `www.pontocomtech.com.br` (e `pontocomtech.com.br`).
Com `js/config.js` vazio o site mostra o aviso "Login online ainda não configurado". O modo local antigo (PIN) só abre se você acrescentar `?local=1` ao endereço (útil para fazer backup dos dados antigos).

Como funciona: cada pessoa cria conta com e-mail e senha e cria a própria empresa (espaço totalmente em branco e separado) ou entra com um código de convite gerado em **Ajustes → Usuários e permissões → Novo usuário**. Para trazer os dados do modo local, faça backup lá e use **Restaurar backup** já logado na conta online.

Limite do Firestore: cada registro (por exemplo uma OS com fotos) pode ter até ~1 MB. As fotos são reduzidas automaticamente; se a OS tiver fotos demais o sistema avisa para remover algumas.
