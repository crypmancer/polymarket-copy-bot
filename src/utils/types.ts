export interface TradePayload {
    asset: string;
    conditionId: string;
    eventSlug: string;
    outcome: string;
    outcomeIndex: number;
    price: number;
    proxyWallet?: string;
    wallet?: string;
    user?: string;
    address?: string;
    userAddress?: string;
    pseudonym: string;
    side: string;
    size: number;
    slug: string;
    timestamp: number;
    title: string;
    transactionHash: string;
}
