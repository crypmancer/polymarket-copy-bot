# Jito Shredstream Decoder

A tool for decoding Jito's shredstream data from Solana validators.
You can listen onchain event faster than grpc.
It can be used efficiently for trading bots like sniper, copy trading bot.

### Usage Product
[Pumpfun Sniper](https://github.com/hodlwarden/jito-shredstream-pumpfun-sniper)

## Overview

This repository contains a decoder for Jito's shredstream, which allows you to process and analyze the data stream from Jito-enabled Solana validators. The shredstream contains valuable information about blocks, transactions, and other blockchain data.

## Features

- Decodes Jito shredstream data into human-readable format
- Supports processing of Solana validator data
- Provides insights into Jito's MEV (Maximal Extractable Value) strategies
- Can be integrated with monitoring tools for validator performance analysis

## Installation

1. Clone the repository:

```bash
git clone https://github.com/hodlwarden/jito-shredstream-decoder.git
cd jito-shredstream-decoder
```
2. Install dependencies (ensure you have Rust installed):

```bash
cargo build --release
```
3. Usage

```bash
./target/release/jito-shredstream-decoder [OPTIONS]
```
4. Available options:

--input: Specify input source (file or stream)

--output: Set output format (JSON, text, etc.)

--verbose: Enable verbose logging

## Configuration
Create a config.toml file to customize decoder behavior:

### toml
[network]
entrypoint = "mainnet.jito.wtf:1234"  # Jito entrypoint

[output]
format = "json"  # Output format
path = "./output"  # Output directory

## Contributing && Contact

Contributions are welcome! Please open an issue or pull request for any improvements.
Feel free to reach out me for any suggestions and questions, you're always welcome.
<br>
Telegram - [Hodlwarden](https://t.me/hodlwarden)
