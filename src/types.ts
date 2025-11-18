import { LiquidityPoolKeysV4 } from "@raydium-io/raydium-sdk"
import { Keypair, PublicKey } from "@solana/web3.js"
import { web3 } from "@project-serum/anchor"
import { RawMint } from "@solana/spl-token"


export interface UserToken {
  name: string
  symbol: string
  description: string
  image: string
  showName: boolean
  createdOn: string
  twitter: string
  telegram: string
  website: string
}


interface Extension {
  website?: string
  twitter?: string
  telegram?: string
}

export interface Metadata {
  name: string
  symbol: string
  description: string
  image: string
  extensions?: Extension
  tags?: string[]
  creator?: Creator
}

export interface Creator {
  name: string
  site: string
}

export interface PoolInfo {
  mint: null | PublicKey
  poolId: null | PublicKey
  mainKp: null | string
  poolKeys: null | LiquidityPoolKeysV4
  removed: null | boolean
}

export interface PoolInfoStr {
  mint: null | string
  poolId: null | string
  mainKp: null | string
  poolKeys: null | any
  removed: null | boolean
}

export type BaseRayInput = {
    rpcEndpointUrl: string
}
export type Result<T, E = any | undefined> = {
    Ok?: T,
    Err?: E
}
export type MPLTokenInfo = {
    address: web3.PublicKey
    mintInfo: RawMint,
    metadata: any
}