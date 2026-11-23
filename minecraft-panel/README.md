# ⛏ McPanel — painel local de servidores Minecraft

Painel web **100% local** para criar e gerenciar servidores Minecraft **reais** na sua máquina:
baixa o jar, prepara o Java, instala **plugins**, **mods** e **modpacks**, liga/desliga,
mostra o **console ao vivo** e faz **backups** — tudo pela interface.

Feito com **HTML/CSS/JS puro + Node.js sem nenhuma dependência** (zero `npm install`).

---

## ▶ Como rodar

```bash
node server/index.js
```

Depois abra **http://127.0.0.1:3789** no navegador.

- **Não precisa instalar Java**: na primeira criação/start, o painel baixa sozinho um JRE oficial
  (Eclipse Temurin/Adoptium) para a versão certa — Java 21 para MC 1.17–1.21.x, Java 25 para MC 26.x.
  Fica em `~/MCServers/runtime/`, sem pedir admin.
- **Não precisa de `npm install`**: usa só módulos nativos do Node (`http`, `child_process`, `crypto`…)
  e o `tar`/`bsdtar` que já vem no Windows 10/11 para extrair `.zip`/`.tar.gz`.
- Requisitos: **Node.js 18+** e Windows 10/11 (também funciona em Linux/macOS com `tar`).

### Onde ficam os arquivos

| O quê | Onde |
|---|---|
| Servidores (mundos, plugins, mods, backups) | `~/MCServers/servers/<id>/` |
| JREs baixados | `~/MCServers/runtime/` |
| Estado do painel | `~/MCServers/state.json` |
| Site | `minecraft-panel/` (esta pasta) |

> Os dados ficam **fora do OneDrive de propósito**: sincronização de nuvem quebra arquivos de
> mundo e travam o servidor. Para mudar a pasta, defina a variável `MCPANEL_DATA`.
> Também dá para mudar porta/host com `MCPANEL_PORT` / `MCPANEL_HOST`.

---

## ✅ O que já funciona

- **Criar servidor**: escolhe software, versão, RAM, porta, MOTD, modo de jogo, máx. de jogadores,
  aceita o **EULA** e opção de start automático.
- **Softwares** (APIs verificadas em nov/2026):
  - ⚡ **Paper** — plugins (o mais usado)
  - 🥒 **Purpur** — fork do Paper com mais opções
  - 🍦 **Vanilla** — oficial da Mojang
  - 🧵 **Fabric** — mods (instala via instalador oficial)
  - 🔥 **Arclight** — mods (Forge/NeoForge/Fabric) **+** plugins Paper juntos
- **Start/stop/restart/reinstalar/trocar versão** com barra de progresso e log por job.
- **Console ao vivo** (SSE) + envio de comandos.
- **Jogadores**: quem está online (via **RCON**), kick/ban/op/whitelist — tudo pelo painel.
- **Plugins e Mods**: busca no **Modrinth**, instala com 1 clique, ativar/desativar (`.disabled`),
  excluir, e upload de `.jar` local.
- **Modpacks** `.mrpack` do Modrinth em servidores Fabric/Arclight (troca o build do loader se preciso).
- **Modo aberto (cracked) + premium**: `online-mode=false` e, em servidores com plugins, o painel
  instala **AuthMe** automaticamente para proteger o login por senha.
- **server.properties** pelo formulário e editor bruto de texto.
- **Arquivos**: navegar, editar, criar, excluir, upload.
- **Backups**: criar/restaurar/excluir/baixar `.tar.gz` (servidor precisa estar parado).
- **Servidor sobrevive ao fechar o painel**: ao reabrir, aparece como *processo órfão* com botão
  para encerrar (parada limpa via RCON, salvando o mundo).

---

## 🔒 Segurança / avisos importantes

1. **O painel não tem senha** e fica só em `127.0.0.1` (local). Não exponha a porta na internet.
2. **EULA**: rodar servidor Minecraft exige aceitar o
   [EULA da Mojang](https://www.minecraft.net/eula). A criação só segue após você marcar a aceitação.
3. **Pirataria/ToS**: o modo aberto (cracked) permite entrar com clientes não autenticados —
   isso **pode violar os Termos de Serviço da Mojang** se usado publicamente. Uso local/família e
   responsabilidade são seus. O painel não distribui nenhum jogo/cliente.
4. **Firewall**: para outros entrarem, permita `java.exe` na porta escolhida (padrão **25565**)
   nas regras de entrada do Firewall do Windows.
5. **RAM**: máquina com pouca RAM? Deixe os servidores em **1024 MB** (padrão) e só aumente se
   tiver memória livre — dois servidores de 2 GB em uma máquina de 3,5 GB travam tudo.

---

## 🧰 Estrutura

```
minecraft-panel/
├── index.html        # shell do SPA
├── css/panel.css     # tema escuro
├── js/app.js         # rotas por hash, telas, SSE, polling de jobs
├── package.json      # "type": "module" (ESM) — sem dependências
└── server/
    ├── index.js      # servidor HTTP: API + arquivos estáticos
    └── lib/
        ├── config.js     # caminhos, portas, limites
        ├── util.js       # HTTP, caminhos seguros, cache, fetch
        ├── store.js      # estado (state.json) + jobs
        ├── download.js   # download com progresso + sha256
        ├── extract.js    # tar (zip/tar.gz) do sistema
        ├── java.js       # detecção + download automático de JRE
        ├── console.js    # buffer de console + SSE
        ├── rcon.js       # cliente RCON mínimo (sem deps)
        ├── software.js   # Paper/Purpur/Vanilla/Fabric/Arclight
        ├── modrinth.js   # busca/instalação de plugins, mods, modpacks
        ├── instance.js   # ciclo de vida, players, arquivos, pacotes
        └── backups.js    # backups .tar.gz
```

## 🔌 API resumida

`GET /api/status` · `GET /api/software` · `GET|POST /api/instances`
· `POST /api/instances/:id/{start,stop,restart,reinstall,version,command,kill}`
· `GET /api/instances/:id/{console,players,properties,list,file,packages,backups}`
· `GET /api/instances/:id/console/stream` (**SSE**)
· `GET /api/search?kind=plugin|mod|modpack&q=&mc=`
· `GET /api/projects/:id/versions` · `POST /api/instances/:id/{install,modpack}`
· `GET /api/jobs/:id` (progresso das operações longas)
