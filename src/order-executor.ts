/**
 * Order execution module that handles placing and managing orders
 */
import { PolymarketClient } from './polymarket-client';

export interface Order {
  orderId: string;
  marketId: string;
  outcome: string;
  side: string;
  price: number;
  size: number;
  status: string;
}

export class OrderExecutor {
  private pmClient: PolymarketClient;
  private activeOrders: Map<string, Order> = new Map(); // order_id -> order_data

  constructor(polymarketClient: PolymarketClient) {
    this.pmClient = polymarketClient;
  }

  async placeOrder(
    marketId: string,
    outcome: string,
    side: string,
    price: number,
    size: number
  ): Promise<Order | null> {
    try {
      console.log(
        `Placing order: ${side} ${size.toFixed(4)} ${outcome} @ ${price.toFixed(4)} ` +
        `in market ${marketId}`
      );

      const orderResult = await this.pmClient.placeOrder(
        marketId,
        outcome,
        side,
        price,
        size
      );

      if (orderResult) {
        const orderId = orderResult.id || orderResult.orderId;
        if (orderId) {
          const order: Order = {
            orderId,
            marketId,
            outcome,
            side,
            price,
            size,
            status: 'pending'
          };
          this.activeOrders.set(orderId, order);
          console.log(`Order placed successfully: ${orderId}`);
          return order;
        }
      } else {
        console.error('Failed to place order - no result from API');
        return null;
      }
    } catch (error) {
      console.error('Error placing order:', error);
      return null;
    }

    return null;
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      if (!this.activeOrders.has(orderId)) {
        console.warn(`Order ${orderId} not found in active orders`);
        return false;
      }

      const success = await this.pmClient.cancelOrder(orderId);

      if (success) {
        const order = this.activeOrders.get(orderId);
        if (order) {
          order.status = 'cancelled';
        }
        console.log(`Order cancelled: ${orderId}`);
        return true;
      } else {
        console.error(`Failed to cancel order: ${orderId}`);
        return false;
      }
    } catch (error) {
      console.error('Error cancelling order:', error);
      return false;
    }
  }

  getActiveOrders(): Map<string, Order> {
    return new Map(this.activeOrders);
  }

  getMarketOrders(marketId: string): Order[] {
    return Array.from(this.activeOrders.values()).filter(
      order => order.marketId === marketId
    );
  }
}

