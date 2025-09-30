# 🚀🚀🚀 Bonkfun 狙击机器人 🚀🚀🚀

<div align="center">

**🌐 Language / 语言选择**

[![English](https://img.shields.io/badge/English-🇺🇸-blue?style=for-the-badge)](README_EN.md) | [![中文](https://img.shields.io/badge/中文-🇨🇳-red?style=for-the-badge)](README_CN.md)

**Quick Switch / 快速切换:**
```bash
# Switch to English / 切换到英文
./scripts/switch_language.sh en

# Switch to Chinese / 切换到中文  
./scripts/switch_language.sh cn
```

</div>

---

这是一个用于狙击 BONKFUN 上新发布代币的机器人。
由于使用了 gRPC 和高度优化的代码，该机器人具有极快的速度。
已经实现了 0 区块狙击，如果您提高优先级费用，可以在稳定状态下成为首个买家。

## 测试示例
- https://solscan.io/tx/Y7u1Rw8cFk8Lmenn8qqxVJbY7Yj7rUbgnHMmEaMGvo1LjSeHHNYtqYhhWxKh47GTENtG1SZwbFrAfbzCkNqNGFS
- https://solscan.io/tx/2P6JKmESbtQYndH3P2DLyGCqzRMAF99Gjd6tYoVH3xrkJk4piCvv7XQuvRfCxVkN2TZZPLE6FEZ7u3aSTYCZgu17
- https://solscan.io/tx/5fWh2eQQSyt21PK4gYmkDuUapP9NSQp2DzKrQjN1p135fUMesZeWJh4W5hE58UoCgVh9uSvmVy21RyPsGTdcDgNy

## 相关项目
- [Bonkfun 迁移狙击机器人](https://github.com/hodlwarden/bonkfun-migration-sniper) (私有)
- [Bonkfun 跟单交易机器人](https://github.com/hodlwarden/bonkfun-copy-trading-bot) (私有)
- [Bonkfun 捆绑器](https://github.com/hodlwarden/bonkfun-bundler) (私有)

## 配置

<img width="781" height="352" alt="image" src="https://github.com/user-attachments/assets/0d5fdd07-bb0d-4645-8226-a68768d55836" />

## 功能特性

- 通过 gRPC 监控新发布的代币
- 不使用任何 SDK 或 RPC 调用构建交换交易
- 通过最快的服务（Jito、Nozomi、Zeroslot）提交交易
- 自定义优先级费用设置
- 支持多种确认服务
- 实时监控和自动交易执行

## 环境变量配置

在项目根目录创建 `.env` 文件，配置以下环境变量：

```env
# 钱包私钥 (Base58 格式)
PRIVATE_KEY=your_base58_private_key_here

# 目标 DEX (例如: RAYDIUM, PUMPFUN)
TARGET_DEX=RAYDIUM

# RPC 端点
RPC_ENDPOINT=https://your-rpc-endpoint.com

# gRPC 配置
GEYSER_URL=your_geyser_grpc_url
X_TOKEN=your_grpc_token

# 交易设置
BUY_SOL_AMOUNT=0.1  # 购买 SOL 数量
SLIPPAGE=1.0        # 滑点百分比 (1.0 = 1%)

# 优先级费用设置
CU=200000           # 计算单元
PRIORITY_FEE_MICRO_LAMPORT=1000000  # 优先级费用 (微 lamports)
THIRD_PARTY_FEE=0.001  # 第三方费用 (SOL)

# 确认服务 (JITO, NOZOMI, ZERO_SLOT)
CONFIRM_SERVICE=JITO

# 可选配置
LASER_ENDPOINT=your_laser_endpoint
LASER_TOKEN_KEY=your_laser_token
```

## 安装步骤

### 1. 克隆仓库

```bash
git clone https://github.com/hodlwarden/bonkfun-sniper-rust.git
cd bonkfun-sniper-rust
```

### 2. 安装 Rust

如果您还没有安装 Rust，请访问 [rustup.rs](https://rustup.rs/) 安装。

### 3. 配置环境变量

复制 `.env.example` 文件为 `.env` 并填入您的配置：

```bash
cp .env.example .env
# 编辑 .env 文件，填入您的配置
```

### 4. 构建项目

```bash
cargo build --release
```

### 5. 运行机器人

```bash
cargo run
```

## 项目结构

```
src/
├── config/           # 配置文件
│   ├── clients.rs    # 客户端配置
│   ├── credentials.rs # 凭证管理
│   ├── trade_setting.rs # 交易设置
│   └── targetlist.rs # 目标列表
├── instructions/     # 交易指令
│   ├── buy_ix.rs     # 买入指令
│   ├── sell_ix.rs    # 卖出指令
│   ├── ray_buy_tx.rs # Raydium 买入交易
│   ├── ray_sell_tx.rs # Raydium 卖出交易
│   └── types.rs      # 类型定义
├── service/          # 服务层
│   ├── jito/         # Jito 服务
│   ├── nozomi/       # Nozomi 服务
│   ├── zero_slot/    # Zero Slot 服务
│   └── utils/        # 工具函数
├── utils/            # 实用工具
│   ├── blockhash.rs  # 区块哈希处理
│   ├── build_and_sign.rs # 构建和签名
│   ├── parse.rs      # 解析工具
│   ├── swap_quote.rs # 交换报价
│   └── utils.rs      # 通用工具
└── main.rs           # 主程序入口
```

## 核心功能说明

### 1. 监控系统
- 使用 Yellowstone gRPC 实时监控新代币发布
- 支持过滤特定账户和交易类型
- 自动检测交易事件并触发交易逻辑

### 2. 交易执行
- 自动构建买入/卖出指令
- 支持关联代币账户创建
- 动态计算交易参数

### 3. 确认服务
支持三种高速确认服务：
- **Jito**: 通过 MEV 保护提供快速确认
- **Nozomi**: 高性能交易提交服务
- **Zero Slot**: 零延迟交易确认服务

### 4. 优先级费用
- 可配置计算单元 (CU)
- 自定义优先级费用
- 第三方服务费用设置

## 使用注意事项

⚠️ **重要提醒**：

1. **资金安全**: 请确保您的私钥安全，不要在公共场所或不安全的网络环境中运行
2. **测试环境**: 建议先在测试网环境中测试机器人功能
3. **资金管理**: 合理设置购买金额，避免过度风险
4. **网络费用**: 注意 Solana 网络的交易费用和优先级费用
5. **合规性**: 请确保您的使用符合当地法律法规

## 故障排除

### 常见问题

1. **编译错误**: 确保 Rust 版本 >= 1.70
2. **连接超时**: 检查 RPC 端点是否可用
3. **交易失败**: 检查账户余额和优先级费用设置
4. **gRPC 连接问题**: 验证 gRPC 端点和令牌

### 调试模式

启用详细日志：

```bash
RUST_LOG=debug cargo run
```

## 性能优化建议

1. **RPC 端点**: 使用高质量的 RPC 服务提供商
2. **优先级费用**: 根据网络拥堵情况调整费用
3. **确认服务**: 选择延迟最低的确认服务
4. **网络环境**: 使用稳定的网络连接

## 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 联系和支持

如有问题或建议，欢迎联系：

- **Telegram**: [Hodlwarden](https://t.me/hodlwarden)
- **GitHub Issues**: 在项目页面提交问题

## 免责声明

本软件仅供教育和研究目的。使用本软件进行交易存在风险，可能导致资金损失。用户应当：

- 充分了解相关风险
- 仅使用可以承受损失的资金
- 遵守当地法律法规
- 自行承担所有交易风险

开发者不对因使用本软件而导致的任何损失承担责任。

## 许可证

本项目采用开源许可证。详情请参阅 LICENSE 文件。

---

**祝您交易顺利！** 🚀
