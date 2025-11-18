# Pumpfun Bundler Mayhem Mode Token2022

A TypeScript-based Solana bundler for creating and trading tokens on Pump.fun with Token2022 support. This tool enables automated token creation, pool creation, and bundle transaction execution using Jito bundles and BloxRoute for optimal transaction execution.

## Features

- 🚀 **Token Creation**: Create new tokens on Pump.fun with custom metadata
- 💰 **Bundle Pool Buy**: Execute coordinated buy transactions across multiple wallets using Jito bundles
- 📦 **Bundle Transactions**: Leverage Jito block engine and BloxRoute for fast transaction execution
- 🔄 **Automated Selling**: Sell tokens from all wallets with a single command
- 💼 **Multi-Wallet Management**: Create and manage multiple wallets for coordinated trading
- 📊 **Balance Checking**: Monitor SOL and token balances across all wallets
- 🎨 **Metadata Support**: Upload token metadata to IPFS via Pinata
- 🔐 **Token2022 Support**: Full support for Token2022 standard

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- TypeScript
- Solana CLI (optional, for wallet management)
- Environment variables configured (see Configuration section)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/hodlwarden/punfun-mayhem-bundler-token2022.git
cd punfun-mayhem-bundler-token2022
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Configure environment variables (see Configuration section)

4. Run the application:
```bash
npm start
# or
yarn start
```

## Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Jito Configuration
BLOCKENGINE_URL=your_blockengine_url
JITO_KEY=your_jito_private_key_base58

# Network Configuration
CLUSTER=mainnet  # or 'devnet'
MAINNET_RPC_URL=your_mainnet_rpc_url
MAINNET_WEBSOCKET_URL=your_mainnet_websocket_url
DEVNET_RPC_URL=your_devnet_rpc_url

# Pinata IPFS Configuration
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_API_KEY=your_pinata_secret_key
```

### Settings

Edit `settings.ts` to configure:
- Token metadata (name, symbol, description, social links)
- Buy amounts per wallet
- Pool liquidity parameters
- Number of wallets for bundle operations
- LP token burn percentage

## Usage

The application provides an interactive menu with the following options:

### Main Menu Options

1. **Create Mint Address** - Generate a new token mint address
2. **Create Pool And BundleBuy** - Create a token pool and execute bundle buy transactions
3. **Sell All Tokens From All Wallets** - Sell all tokens from all configured wallets
4. **Check All Wallets Balance** - Display SOL and token balances for all wallets
5. **Exit** - Close the application

### Workflow

1. **Create Mint Address**: First, create a mint address for your token
2. **Create Pool And BundleBuy**: 
   - Creates token metadata and uploads to IPFS
   - Creates the bonding curve on Pump.fun
   - Adds liquidity to the pool
   - Executes bundle buy transactions across multiple wallets
3. **Monitor**: Use the balance checker to monitor your positions
4. **Sell**: When ready, sell all tokens from all wallets

## Project Structure

```
├── src/
│   ├── constants/          # Configuration constants
│   ├── services/           # Business logic services
│   │   ├── PumpfunService.ts    # Pump.fun program interactions
│   │   ├── MetadataService.ts   # Token metadata creation/upload
│   │   ├── BundleService.ts     # Bundle transaction creation
│   │   ├── BloxRouteService.ts  # BloxRoute bundle submission
│   │   └── WalletService.ts     # Wallet operations
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Utility functions
│   ├── idl/                # Anchor IDL files
│   └── createPool.ts       # Main pool creation logic
├── layout/                 # UI layout components
├── menu/                   # Menu system
├── wallets/                # Wallet storage (JSON files)
├── config.ts              # Configuration and connection setup
├── settings.ts             # User-configurable settings
└── index.ts               # Application entry point
```

For detailed architecture information, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Technologies

- **@solana/web3.js** - Solana blockchain interaction
- **@coral-xyz/anchor** - Anchor framework for Solana programs
- **@raydium-io/raydium-sdk** - Raydium SDK for liquidity pools
- **jito-ts** - Jito bundle transaction support
- **@metaplex-foundation/js** - Metaplex for token metadata
- **axios** - HTTP requests for BloxRoute and IPFS
- **TypeScript** - Type-safe development

## Key Features Explained

### Bundle Transactions
The application uses Jito bundles to execute multiple transactions atomically. This ensures that all buy transactions either succeed together or fail together, preventing partial fills.

### BloxRoute Integration
BloxRoute is used as an alternative bundle submission method, providing additional reliability and speed for transaction execution.

### Multi-Wallet Strategy
The tool creates and manages multiple wallets to execute coordinated buy/sell operations, maximizing the chances of successful execution during high-activity periods.

## Important Notes

⚠️ **Security Warning**: 
- Never commit your `.env` file or wallet JSON files to version control
- Keep your private keys secure
- Use test wallets on devnet before using mainnet

⚠️ **Financial Risk**:
- Trading cryptocurrencies involves significant risk
- This tool is for educational and development purposes
- Always test thoroughly on devnet before using on mainnet
- Be aware of transaction fees and slippage

⚠️ **Rate Limits**:
- Be mindful of RPC rate limits
- Consider using private RPC endpoints for production use
- Monitor your transaction success rates

## Development

### Code Structure
The codebase follows a clean architecture pattern with:
- **Services**: Business logic in singleton service classes
- **Utils**: Reusable utility functions
- **Types**: TypeScript type definitions for type safety
- **Constants**: Centralized configuration values

### Adding New Features
1. Create or extend services in `src/services/`
2. Add types in `src/types/` if needed
3. Update constants in `src/constants/` if adding configuration
4. Add menu options in `menu/menu.ts` and handlers in `index.ts`

## Troubleshooting

### Common Issues

**"Creator wallet not found"**
- Ensure wallet files exist in the `wallets/` directory
- Check that wallet JSON files are properly formatted

**"Bundle submission failed"**
- Verify Jito and BloxRoute credentials
- Check network connectivity
- Ensure sufficient SOL balance for fees

**"Metadata upload failed"**
- Verify Pinata API credentials
- Check IPFS connectivity
- Ensure metadata object is properly formatted

## Contributing && Contact

Contributions are welcome! Please open an issue or pull request for any improvements.
Feel free to reach out me for any suggestions and questions, you're always welcome.
<br>
Telegram - [Hodlwarden](https://t.me/hodlwarden)