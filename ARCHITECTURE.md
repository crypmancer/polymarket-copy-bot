# Codebase Architecture

## Overview
This codebase has been restructured with a clean, modular architecture following best practices for TypeScript/Solana development.

## Directory Structure

```
src/
├── constants/          # All constants and configuration values
│   └── index.ts
├── types/              # TypeScript types and interfaces
│   ├── pumpfun.ts
│   └── wallet.ts
├── services/           # Business logic services (singleton pattern)
│   ├── PumpfunService.ts    # Pump.fun program interactions
│   ├── MetadataService.ts  # Token metadata creation/upload
│   ├── BundleService.ts    # Bundle transaction creation
│   ├── BloxRouteService.ts # BloxRoute bundle submission
│   └── WalletService.ts    # Wallet creation and SOL distribution
├── utils/              # Utility functions (organized by concern)
│   ├── fileUtils.ts        # File I/O operations
│   ├── asyncUtils.ts       # Async utilities (sleep, retry, etc.)
│   └── mathUtils.ts        # Mathematical calculations
├── idl/                # Anchor IDL files
├── createPool.ts       # Main entry point for bundle pool buy
└── legacyUtils.ts      # Legacy exports for backward compatibility
```

## Key Design Principles

### 1. **Separation of Concerns**
- Services handle business logic
- Utils handle utility functions
- Constants centralize configuration
- Types ensure type safety

### 2. **Service Pattern**
All services are static classes following the singleton pattern:
- `PumpfunService` - Handles all Pump.fun program interactions
- `MetadataService` - Handles metadata creation and IPFS upload
- `BundleService` - Orchestrates bundle transaction creation
- `BloxRouteService` - Handles bundle submission via BloxRoute
- `WalletService` - Handles wallet operations

### 3. **Error Handling**
- Consistent error handling with try-catch
- Proper error propagation
- Retry logic for network operations

### 4. **Type Safety**
- Strong TypeScript typing throughout
- Interfaces for all data structures
- Proper return types

### 5. **Performance Optimizations**
- Parallel async operations using `Promise.all`
- Optimized transaction creation
- Efficient file I/O

## Usage Examples

### Creating a Bundle Pool Buy
```typescript
import { bundlePoolBuy } from "./src/createPool";

await bundlePoolBuy();
```

### Using Services Directly
```typescript
import { PumpfunService } from "./src/services/PumpfunService";
import { MetadataService } from "./src/services/MetadataService";

// Initialize service
PumpfunService.initialize();

// Create metadata
const metadata = await MetadataService.createTokenMetadata({
  name: "Token",
  symbol: "TKN",
  description: "Description"
});

// Create buy instruction
const buyIx = await PumpfunService.createBuyInstruction(
  10000000,
  10000000000000,
  mint,
  user
);
```

### Using Utilities
```typescript
import { FileUtils } from "./src/utils/fileUtils";
import { AsyncUtils } from "./src/utils/asyncUtils";

// Read wallet
const wallet = FileUtils.readCreatorWallet();

// Sleep
await AsyncUtils.sleep(1000);

// Retry with exponential backoff
const result = await AsyncUtils.retry(
  () => someAsyncOperation(),
  3,  // max retries
  1000 // initial delay
);
```

## Migration Notes

### Backward Compatibility
- Old imports still work via `legacyUtils.ts`
- Services maintain the same functionality
- File formats remain compatible

### Breaking Changes
- Some internal functions moved to services
- Constants extracted to separate file
- Improved error messages

## Constants Reference

All constants are centralized in `src/constants/index.ts`:
- `PUMP_FEE_RECEIVER` - Pump.fun fee receiver address
- `COMPUTE_UNIT_PRICE` - Default compute unit price
- `COMPUTE_UNIT_LIMIT` - Default compute unit limit
- `DEFAULT_TOKEN_AMOUNT` - Default token amount for buys
- `DEFAULT_SOL_AMOUNT` - Default SOL amount for buys
- `WALLET_PATHS` - File paths for wallet storage

## Best Practices

1. **Always use services** for business logic
2. **Use constants** instead of magic numbers
3. **Handle errors** properly with try-catch
4. **Use async utilities** for delays and retries
5. **Type everything** - no `any` types

## Testing

Services are designed to be easily testable:
- Static methods for easy mocking
- Clear separation of concerns
- Minimal dependencies

## Future Improvements

- Add unit tests for services
- Add integration tests
- Add logging service
- Add configuration service
- Add validation utilities

