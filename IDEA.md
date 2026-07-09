# Projeto Nyx: Plataforma de Gestão de Dados (PoC)

**Visão Geral:**
Uma plataforma *Dual-Stack* de missão crítica projetada para o ecossistema de engenharia aeroespacial. O sistema fornece edição colaborativa em tempo real (CRDTs) e fluxos de trabalho de documentação assistidos por Inteligência Artificial (RAG).

**Decisões Arquiteturais (Dual-Stack):**
1. **Via Expressa (Tempo Real):** `Node.js`, `Hocuspocus` e `Y.js` operam o tráfego pesado de WebSockets, garantindo sincronização de documentos com latência zero entre múltiplos engenheiros.
2. **Via de Processamento (Negócios & IA):** `FastAPI` (Python) e `LangChain` formam o backend central, responsáveis por persistência de dados (MySQL), indexação vetorial (OpenSearch) e busca semântica.
3. **Segurança Centralizada:** Todo o controle de acesso é gerido via ABAC (Attribute-Based Access Control) utilizando `Cerbos`. O FastAPI atua como *gatekeeper*, e o Hocuspocus intercepta tentativas de conexão WebSocket cruzando permissões com o backend antes de liberar o tráfego de dados.

**Objetivo de Engenharia:**
Provar que é possível escalar colaboração descentralizada em tempo real sem estrangular a API principal, mantendo rigorosos padrões de segurança de missão crítica.
