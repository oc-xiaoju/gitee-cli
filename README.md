# gitee-cli

**Gitee (码云) 命令行工具** — 类似 `gh`，但面向 Gitee。

A command-line tool for Gitee (码云) — like `gh`, but for Gitee.

[![npm version](https://img.shields.io/npm/v/gitee-cli.svg)](https://www.npmjs.com/package/gitee-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 安装 / Installation

### 全局安装 (Recommended)

```bash
npm install -g gitee-cli
```

### 从源码构建 / Build from source

```bash
git clone https://github.com/shazhou-ww/gitee-cli.git
cd gitee-cli
npm install
npm run build
npm link
```

---

## 认证 / Authentication

gitee-cli 使用 Gitee Personal Access Token 认证。

1. 前往 https://gitee.com/profile/personal_access_tokens 创建 Token
2. 运行登录命令

```bash
gitee auth login
```

### 环境变量 / Environment Variable

`GITEE_TOKEN` 优先级高于配置文件：

```bash
export GITEE_TOKEN=your_token_here
```

### 命令 / Commands

```bash
gitee auth login          # 交互式登录
gitee auth logout         # 清除认证
gitee auth status         # 查看当前认证状态
```

---

## 命令列表 / Commands

### 仓库 / Repository

```bash
gitee repo list                              # 列出我的仓库
gitee repo list --owner <user>              # 列出指定用户的仓库
gitee repo list --type private              # 只列出私有仓库
gitee repo create <name>                    # 创建仓库
gitee repo create <name> --private          # 创建私有仓库
gitee repo create <name> --description "..."
gitee repo view                             # 查看当前仓库 (自动检测)
gitee repo view <owner/repo>                # 查看指定仓库
gitee repo clone <owner/repo>               # Clone 仓库
gitee repo delete <owner/repo>              # 删除仓库 (需确认)
```

### Issue

```bash
gitee issue list                            # 列出 issues (当前仓库)
gitee issue list --repo <owner/repo>        # 指定仓库
gitee issue list --state closed             # 列出已关闭的 issues
gitee issue create --title "Bug fix"        # 创建 issue
gitee issue create --title "..." --body "..." --repo <owner/repo>
gitee issue view <number>                   # 查看 issue 详情
gitee issue close <number>                  # 关闭 issue
gitee issue comment <number> --body "..."   # 评论
```

### Pull Request

```bash
gitee pr list                               # 列出 PRs (当前仓库)
gitee pr list --state merged                # 已合并的 PRs
gitee pr create --title "feat: xxx" --head feature-branch
gitee pr create --title "..." --head <branch> --base master --body "..."
gitee pr view <number>                      # 查看 PR 详情
gitee pr merge <number>                     # 合并 PR
gitee pr merge <number> --method squash     # Squash 合并
gitee pr close <number>                     # 关闭 PR
```

### Release

```bash
gitee release list                          # 列出 releases
gitee release list --repo <owner/repo>
gitee release create --tag v1.0.0 --name "v1.0.0 Release"
gitee release create --tag v1.0.0 --name "..." --body "Release notes"
```

### 组织 / Organization

```bash
gitee org list                              # 列出我加入的组织
```

### 通用 API / Raw API

```bash
gitee api GET /v5/emojis                    # 不需要认证
gitee api GET /v5/user                      # 获取当前用户
gitee api GET /v5/repos/owner/repo
gitee api POST /v5/user/repos --field name=myrepo --field private=true
gitee api GET /v5/repos/owner/repo/issues --query state=open
gitee api GET /v5/repos/owner/repo/issues --paginate   # 自动翻页
```

---

## 通用选项 / Global Options

| 选项 | 说明 |
|------|------|
| `--json` | 输出原始 JSON（方便脚本/AI 解析） |
| `--repo <owner/repo>` | 指定仓库（省略时自动检测 git remote） |
| `--page <n>` | 分页页码（默认 1） |
| `--per-page <n>` | 每页条数（默认 20，最大 100） |

---

## 自动检测仓库 / Auto-detect Repository

当你在一个 Gitee 仓库目录内运行命令时，`--repo` 参数可以省略，gitee-cli 会自动从 `git remote` 检测 `owner/repo`。

支持两种 remote 格式：
- `https://gitee.com/owner/repo.git`
- `git@gitee.com:owner/repo.git`

---

## 配置文件 / Config File

Token 存储在 `~/.config/gitee-cli/config.json`：

```json
{
  "token": "your_token",
  "username": "your_username"
}
```

---

## 技术栈 / Tech Stack

- Node.js 18+ (ESM)
- TypeScript
- commander.js
- Node 内置 `fetch` (无 axios 依赖)

---

## License

MIT
