# UserAgent-Switcher
一款高度可配置的浏览器扩展，用于伪造浏览器 User-Agent 字符串。

UserAgent-Switcher 会同时修改浏览器请求头中的 User-Agent，以及 JavaScript 中相关的 `navigator` 属性（例如 `navigator.userAgent`、`navigator.appVersion`、`navigator.platform`）。同时支持现代浏览器识别机制，如 Client Hints 请求头与 `navigator.userAgentData` 对象，确保在所有检测方式下伪装效果一致、完整。

## 核心功能
* **全方位伪装**：同时修改 HTTP 请求头与 JavaScript `navigator` 对象。
* **精细化控制**：
    * 可针对指定域名单独设置 User-Agent
    * 可为不同浏览器标签页设置不同的 User-Agent
    * 支持 Firefox 容器特性，每个容器使用独立 User-Agent（Manifest V3 暂未支持）
* **随机化**：可从用户自定义列表中随机选择 User-Agent。
* **便捷导入导出**：可通过简单的导入导出功能管理你的 User-Agent 列表。

## 演示与评测
扩展效果演示：

[![User-Agent Switcher and Manager - 浏览器扩展评测](https://img.youtube.com/vi/-aVFxvF3N_E/0.jpg)](http://www.youtube.com/watch?v=-aVFxvF3N_E)

*（视频："User-Agent Switcher and Manager - 浏览器扩展评测"）*

## 安装 - 官方发布版
你可以从对应浏览器的官方扩展商店安装最新稳定版本：
* **Chrome：** [User-Agent Switcher and Manager](https://chrome.google.com/webstore/detail/user-agent-switcher-and-m/bhchdcejhohfmigjafbampogmaanbfkg)
* **Firefox：** [User-Agent String Switcher](https://addons.mozilla.org/firefox/addon/user-agent-string-switcher/)
* **Edge：** [User-Agent Switcher and Manager](https://microsoftedge.microsoft.com/addons/detail/useragent-switcher-and-m/cnjkedgepfdpdbnepgmajmmjdjkjnifa)
* **Opera：** [User-Agent Switcher](https://addons.opera.com/extensions/details/user-agent-switcher-8/)

## 使用说明
关于扩展的详细使用方法、配置选项与功能说明，请访问：
[UserAgent-Switcher 使用指南](https://webextension.org/listing/useragent-switcher.html)

## 手动安装（从源码安装）
如果你已克隆或下载了本仓库的源码文件，可以手动在浏览器中安装扩展。适用于开发调试、测试最新（可能不稳定）代码，或偏好直接从源码安装扩展的场景。

### Chromium 内核浏览器（Google Chrome、Microsoft Edge、Opera）
这类浏览器的安装方式为加载「解压缩扩展」：
1.  **获取源码**：确保本地已存有扩展源码文件（目录根目录下需包含 `manifest.json`）。如果你克隆了本仓库，源码通常位于主目录或 `src/` 目录下；如果项目包含构建流程（例如 `npm run build`），请先执行构建生成可分发文件，通常输出在 `dist/` 或 `build/` 文件夹。
2.  **打开浏览器扩展页面**：
    * **Chrome：** 地址栏输入 `chrome://extensions`
    * **Edge：** 地址栏输入 `edge://extensions`
    * **Opera：** 地址栏输入 `opera://extensions`
3.  **开启开发者模式**：
    * 找到「开发者模式」开关（通常位于扩展页面右上角或左下角），将其打开。
4.  **加载解压缩的扩展**：
    * 开启开发者模式后，会出现「加载解压缩的扩展」按钮，点击该按钮。
    * 在弹出的文件对话框中，选择包含扩展源码的目录（即 `manifest.json` 直接所在的文件夹），点击「选择文件夹」或「打开」。

此时 UserAgent-Switcher 扩展即加载完成并生效。如果你修改了源码，通常需要回到扩展页面，点击扩展对应的「刷新」按钮以应用更改。

### Mozilla Firefox
#### 方法 1：加载临时附加组件（开发/测试用）
该方法可直接从源码加载扩展，重启 Firefox 或手动移除前会一直保留。
1.  **获取源码**：确保本地已存有扩展源码文件（目录根目录下需包含 `manifest.json`）。
2.  **打开 Firefox 浏览器**。
3.  **进入调试工具**：地址栏输入 `about:debugging` 并回车。
4.  **选择「此 Firefox」**：左侧边栏点击「此 Firefox」。
5.  **加载附加组件**：点击「加载临时附加组件…」按钮。
6.  **选择清单文件**：定位到源码目录，选中 `manifest.json` 文件（或扩展根目录下的任意文件），点击「打开」。

此时 UserAgent-Switcher 扩展即加载完成。修改源码后，可在 `about:debugging` 页面点击扩展旁的「刷新」按钮重新加载。

#### 方法 2：打包为 .xpi 文件安装（更持久的本地安装）
1.  **准备文件**：
    * 确保所有必要文件齐全，`manifest.json` 位于根目录。
    * 如果仓库包含构建流程，请先执行构建。
2.  **创建 ZIP 压缩包**：
    * 进入最终扩展文件所在目录。
    * 选中该目录内的所有文件和子文件夹（`manifest.json` 必须在压缩包的根层级）。
    * 将选中项压缩为 ZIP 压缩包（例如 `user_agent_switcher.zip`）。
3.  **重命名为 .xpi**：将文件扩展名从 `.zip` 改为 `.xpi`（例如 `user_agent_switcher.xpi`）。
4.  **安装到 Firefox**：
    * 打开 Firefox，进入附加组件管理器（`about:addons` 或按 `Ctrl+Shift+A` / `Cmd+Shift+A`）。
    * 点击扩展面板上的齿轮图标（⚙️）。
    * 选择「从文件安装附加组件…」。
    * 找到并选中你的 `.xpi` 文件，点击「打开」，确认安装。

### 手动安装（源码）重要说明
* **扩展 ID 一致性**：为保证开发测试稳定（尤其当扩展使用存储功能或需要固定 ID 调用 API 时）：
    * **Chromium 内核浏览器**：可在 `manifest.json` 中添加 `"key"` 字段，值为 Base64 编码的公钥。加载解压缩扩展时如果存在 `key` 字段，Chrome/Edge/Opera 会生成一致的扩展 ID；没有该字段时，扩展目录路径变化可能导致 ID 改变。
    * **Firefox**：确保 `manifest.json` 中通过 `browser_specific_settings.gecko.id` 字段定义了唯一的附加组件 ID（例如 `"id": "user-agent-switcher@shturl.cc/HzDx4"`）。
* **持久性**：加载解压缩扩展（Chromium）或临时附加组件（Firefox）通常仅在当前会话生效，或手动刷新/移除前有效；Firefox `.xpi` 方式可实现更持久的安装。
* **分发打包**：如果你打算更广泛地分发扩展，而非仅本地加载：
    * **Chromium 内核浏览器**：扩展打包为 `.crx` 文件，通常通过对应应用商店（Chrome 网上应用店、Microsoft Edge 附加组件、Opera 扩展商店）分发。
    * **Firefox**：扩展打包为已签名的 `.xpi` 文件，通常通过 [addons.mozilla.org (AMO)](https://addons.mozilla.org/developers/) 分发。
    * 签名是官方分发的关键步骤，用于保障安全与完整性。标准浏览器版本通常会限制或警告用户安装来自官方商店外的未签名扩展。

### 构建可加载的扩展包
本项目包含一个零依赖的 Node.js 脚本，用于生成可直接被浏览器加载的解压缩扩展目录。
生成的目录可直接通过浏览器开发者模式下的「加载解压缩的扩展」选项加载。

### 使用方法
```bash
node build-extension.js
```

### 输出目标（位于 `dist/` 目录下）

表格

| 目标目录 | 适用浏览器 | 说明 |
| --- | --- | --- |
| `chromium-v3` | Microsoft Edge、Google Chrome、Brave 及所有 Chromium 内核浏览器 | Manifest V3 版本，已移除 `background.scripts` 以符合 Chromium 规范 |
| `firefox-v3` | Firefox | Manifest V3 版本，保留完整的 background 脚本支持 |
| `firefox-v2` | 旧版 Firefox | Manifest V2 版本，适用于更早期的 Firefox 版本 |

> 
> 对于绝大多数现代用户（Edge / Chrome）：加载 `dist/chromium-v3` 目录即可。
> 
> 
> 该脚本可独立运行。仅当你需要重新生成 UA 预设数据库时，才需要运行 `node/build.js`。

---

## 贡献

欢迎贡献代码！如果你有改进想法、新功能建议，或发现了 Bug，可以：

1. 在仓库中提交 Issue，讨论相关改动或报告问题。
2. Fork 本仓库，提交包含你改动的 Pull Request。

请确保所有贡献符合项目的代码风格与目标。

## 许可协议

本项目基于 **Mozilla Public License 2.0 (MPL-2.0)** 许可发布。
你可以在仓库的 `LICENSE` 文件中找到许可协议副本，或访问 [https://www.mozilla.org/en-US/MPL/2.0/](https://www.mozilla.org/en-US/MPL/2.0/) 查看。