# Financcely

Controle financeiro pessoal. PWA leve, sem frameworks, que funciona direto no celular.

[Acessar o app](https://seu-usuario.github.io/financcely) · [Landing page](https://seu-usuario.github.io/financcely/landing.html)

---

## Funcionalidades

- **Contas e cartões** — múltiplas contas bancárias e cartões de crédito com controle de fatura e parcelamentos
- **Transações** — registro de receitas, despesas e transferências com categorias personalizadas
- **Gráficos e relatórios** — receitas × despesas mês a mês e gastos por categoria
- **Metas financeiras** — objetivos com barra de progresso visual
- **Orçamento mensal** — limite de gasto por categoria com indicador em tempo real
- **Contas a pagar e a receber** — controle de vencimentos e valores esperados
- **Sincronização na nuvem** — dados acessíveis de qualquer dispositivo
- **Offline** — service worker com estratégia network-first para funcionar sem conexão

---

## Tecnologias

- HTML, CSS e JavaScript puro — sem frameworks
- PWA com Web App Manifest — instalável como app nativo
- Service Worker para cache offline
- Chart.js 4 para os gráficos
- Font Awesome 6 e Google Fonts (DM Sans + DM Mono)

---

## Estrutura

```
financcely/
├── index.html      # Landing page (entrada do GitHub Pages)
├── app.html        # Aplicação principal
├── manifest.json   # Configuração PWA
├── sw.js           # Service Worker
└── README.md
```

---

## Como rodar localmente

O Service Worker exige servidor HTTP — não funciona via `file://`.

```bash
git clone https://github.com/seu-usuario/financcely.git
cd financcely
npx serve .
```

Acesse `http://localhost:3000`.

Para instalar como PWA no celular: abra no Chrome, menu → "Adicionar à tela inicial".

---

## Licença

MIT
