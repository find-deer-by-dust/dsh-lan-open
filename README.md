# dsh-lan-open

关闭 [DeepSeek Harness（DSH）](https://github.com/deepseek-ai/deepseek-harness) Web 的浏览器身份认证，无需 token、登录密码或 Tailscale 身份即可访问后台。

> **安全提示**
>
> 本插件启用后会关闭 DSH 的浏览器身份认证。任何能连接服务地址的人都可以操作后台，包括执行命令、读写文件和使用已配置的模型凭据。仅用于可信网络，勿将免认证入口暴露到公网。

## 功能

- **免登录访问**：无需通过启动链接交换 token，也不要求浏览器携带会话 cookie。
- **远程设置支持**：局域网页面可使用模型、凭据、插件等宿主设置。
- **停用恢复**：停用插件时恢复后续请求的认证检查，支持连接服务重建和重复加载；已有连接的撤销方式见下文。
- **轻量部署**：纯 JavaScript，无运行时依赖、构建步骤或安装脚本。

插件保留 DSH 的 Host/Origin 来源检查。免登录不代表接受任意来源；未受信任的 Host、Origin 或跨站请求仍可能收到 `403`。

## 访问范围

项目名中的 `lan` 表示预期的部署场景，**不代表插件会限制客户端必须来自局域网 IP**。插件对能够连接服务且通过 Host/Origin 检查的请求统一免除身份认证，不提供客户端 IP 或用户白名单。

实际可访问的设备范围由 DSH 的监听地址、防火墙、路由和端口映射决定，需要在网络层限定。

## 环境要求

| 项目 | 要求 |
| --- | --- |
| DSH | `0.2.2-rc.3` |
| Node.js | `^22.19.0` 或 `>=24.0.0` |
| Profile | `web` |

当前仅声明兼容表中的 DSH 版本。插件依赖宿主的浏览器认证接口；升级 DSH 前应先验证兼容性。接口不符时会报告错误。

## 安装

### 从源码安装

克隆仓库：

```sh
git clone https://github.com/find-deer-by-dust/dsh-lan-open.git
```

将下面的路径替换为克隆目录的绝对路径：

```sh
dsh plugin --profile web add /absolute/path/to/dsh-lan-open
```

也可以先在项目目录运行 `npm pack`，再安装生成的文件：

```sh
dsh plugin --profile web add /absolute/path/to/dsh-lan-open-0.1.0.tgz
```

### 启用插件

安装后，在 DSH 的「设置 → 插件」中启用 `dsh-lan-open`，然后重启 DSH。

手工管理 profile 时，将 `dsh-lan-open` 追加到 `~/.dsh/profiles/web/package.json` 的 `dsh.profile.bundles` 数组中，保留已有条目。

请先停用其他接管浏览器认证的插件，避免多个插件相互覆盖认证和恢复行为。

## 局域网访问

插件沿用 DSH 的监听配置。将服务绑定到主机的局域网 IP，并声明访问地址，例如：

```sh
dsh web --host 192.168.1.100 --port 3080 --trusted-host 192.168.1.100:3080 --no-open
```

将 `192.168.1.100` 替换为运行 DSH 的主机 IP。在同一局域网的设备上打开：

```text
http://192.168.1.100:3080/
```

URL 不需要 `?token=...` 参数。插件启用后，对能够连接该服务的设备统一免登录，不使用 IP 或用户白名单。

## 停用与卸载

在 DSH 插件页停用 `dsh-lan-open`，会还原认证方法，使后续 HTTP 请求和新建 WebSocket 握手恢复认证检查。

**停用不会主动关闭已有 WebSocket，也不会撤销已开始的请求。需要切断已有匿名连接时，应先停用或卸载插件，再重启 DSH。** 重启会断开存量连接，但不会自动作废之前合法签发且仍有效的登录 cookie。

卸载命令：

```sh
dsh plugin --profile web remove dsh-lan-open
```

卸载后重启 DSH。插件没有独立的设置文件或凭据记录需要清理。

## 常见问题

| 现象 | 检查项 |
| --- | --- |
| 仍然提示 `dsh web authentication required` | 确认插件已启用、profile 正确、DSH 版本兼容，并已重启服务。 |
| 返回 `403` | 检查 `--trusted-host` 与实际访问地址是否一致，以及请求的 Origin 和跨站来源信息。 |
| 其他设备无法连接 | 检查 DSH 的绑定地址、端口和主机防火墙；本插件不负责配置网络监听。 |
| 停用后已打开的页面仍能操作 | 已建立的 WebSocket 可能继续有效。需要切断已有匿名连接时，停用插件后重启 DSH。 |
| 停用并重启后仍能访问 | 检查是否有其他免认证插件同时启用，或浏览器是否仍持有有效登录 cookie。 |

## 开发

无需安装依赖即可检查语法和运行单元测试：

```sh
npm run check
npm test
```

集成测试需要已安装兼容版本的 DSH。`DSH_BIN` 应指向可由 Node.js 执行的 DSH JavaScript 入口文件：

```sh
DSH_BIN=/absolute/path/to/dsh/lib/bin.js npm run test:integration
```

PowerShell：

```powershell
$env:DSH_BIN = "C:/path/to/dsh/lib/bin.js"
npm run test:integration
```

测试使用临时 `DSH_HOME` 和随机空闲端口，验证默认认证、免认证页面访问、API WebSocket 连接及来源检查，并在结束后清理测试实例。默认绑定 `127.0.0.1`；可设置 `DSH_TEST_HOST` 为本机局域网 IP，验证局域网访问。

## 致谢与许可

认证旁路与远程页面注入逻辑参考自 [`@he0119/dsh-tailnet-admin` 的 `0.1.0` 版本](https://github.com/he0119/dsh-tailnet-admin)。本项目移除了配置界面、主机匹配规则和认证开关，改为启用插件即应用。

本项目采用 [MIT License](LICENSE)。参考实现的作者声明和完整许可证保留在 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
