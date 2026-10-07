export interface Product {
  readonly id: string;
  readonly name: string;
  readonly price: number;
}

export interface CartItem {
  readonly product: Product;
  readonly quantity: number;
}

export type PaymentMethod = "cash" | "qr" | "card";

export type PosStep =
  | "order"
  | "review"
  | "payment"
  | "processing"
  | "success"
  | "receipt";

export interface Transaction {
  readonly id: string;
  readonly items: readonly CartItem[];
  readonly total: number;
  readonly paymentMethod: PaymentMethod;
  readonly amountPaid: number;
  readonly change: number;
  readonly completedAt: string;
}

export interface PosState {
  readonly step: PosStep;
  readonly cart: readonly CartItem[];
  readonly paymentMethod: PaymentMethod | null;
  readonly transaction: Transaction | null;
}

export const PRODUCTS: readonly Product[] = Object.freeze([
  Object.freeze({ id: "coffee", name: "Coffee", price: 45 }),
  Object.freeze({ id: "sandwich", name: "Sandwich", price: 50 }),
  Object.freeze({ id: "soft-drink", name: "Soft Drink", price: 35 }),
  Object.freeze({ id: "cookies", name: "Cookies", price: 25 }),
  Object.freeze({ id: "bottled-water", name: "Bottled Water", price: 20 }),
  Object.freeze({ id: "chocolate", name: "Chocolate", price: 25 }),
]);

export type PosAction =
  | { readonly type: "navigate"; readonly step: PosStep }
  | { readonly type: "add_product"; readonly product: Product }
  | { readonly type: "increase_quantity"; readonly productId: string }
  | { readonly type: "decrease_quantity"; readonly productId: string }
  | { readonly type: "remove_product"; readonly productId: string }
  | { readonly type: "select_payment_method"; readonly method: PaymentMethod }
  | { readonly type: "reset" };

export function createInitialPosState(): PosState {
  return { step: "order", cart: [], paymentMethod: null, transaction: null };
}

function canEditOrder(state: PosState): boolean {
  return (
    state.transaction === null &&
    (state.step === "order" || state.step === "review")
  );
}

export function navigateToStep(state: PosState, step: PosStep): PosState {
  if (state.transaction !== null) {
    return step === "receipt" && state.step === "success"
      ? { ...state, step }
      : state;
  }

  if (step === "order" && (state.step === "review" || state.step === "payment")) {
    return { ...state, step };
  }
  if (step === "review" && state.step === "payment" && state.cart.length > 0) {
    return { ...state, step };
  }
  if (step === "review" && state.step === "order" && state.cart.length > 0) {
    return { ...state, step };
  }
  if (step === "payment" && state.step === "review" && state.cart.length > 0) {
    return { ...state, step };
  }
  if (
    step === "processing" &&
    state.step === "payment" &&
    state.paymentMethod !== null
  ) {
    return { ...state, step };
  }
  if (step === "payment" && state.step === "processing") {
    return { ...state, step };
  }

  return state;
}

function isValidProduct(product: Product): boolean {
  return (
    product.id.trim().length > 0 &&
    product.name.trim().length > 0 &&
    Number.isFinite(product.price) &&
    product.price >= 0
  );
}

export function addProduct(state: PosState, product: Product): PosState {
  if (!canEditOrder(state) || !isValidProduct(product)) {
    return state;
  }

  const existingItem = state.cart.find(
    (item) => item.product.id === product.id,
  );

  if (existingItem) {
    return increaseQuantity(state, product.id);
  }

  return {
    ...state,
    cart: [...state.cart, { product, quantity: 1 }],
  };
}

export function increaseQuantity(
  state: PosState,
  productId: string,
): PosState {
  if (!canEditOrder(state)) {
    return state;
  }

  const item = state.cart.find((cartItem) => cartItem.product.id === productId);
  if (!item || !Number.isSafeInteger(item.quantity + 1)) {
    return state;
  }

  return {
    ...state,
    cart: state.cart.map((cartItem) =>
      cartItem.product.id === productId
        ? { ...cartItem, quantity: cartItem.quantity + 1 }
        : cartItem,
    ),
  };
}

export function decreaseQuantity(
  state: PosState,
  productId: string,
): PosState {
  if (!canEditOrder(state)) {
    return state;
  }

  const item = state.cart.find((cartItem) => cartItem.product.id === productId);
  if (!item || item.quantity <= 1) {
    return state;
  }

  return {
    ...state,
    cart: state.cart.map((cartItem) =>
      cartItem.product.id === productId
        ? { ...cartItem, quantity: cartItem.quantity - 1 }
        : cartItem,
    ),
  };
}

export function removeProduct(state: PosState, productId: string): PosState {
  if (!canEditOrder(state)) {
    return state;
  }

  const cart = state.cart.filter((item) => item.product.id !== productId);
  return cart.length === state.cart.length ? state : { ...state, cart };
}

export function selectPaymentMethod(
  state: PosState,
  method: PaymentMethod,
): PosState {
  if (
    state.step !== "payment" ||
    state.transaction !== null ||
    state.paymentMethod === method
  ) {
    return state;
  }

  return { ...state, paymentMethod: method };
}

export function resetTransaction(): PosState {
  return createInitialPosState();
}

export function reducePosState(state: PosState, action: PosAction): PosState {
  switch (action.type) {
    case "navigate":
      return navigateToStep(state, action.step);
    case "add_product":
      return addProduct(state, action.product);
    case "increase_quantity":
      return increaseQuantity(state, action.productId);
    case "decrease_quantity":
      return decreaseQuantity(state, action.productId);
    case "remove_product":
      return removeProduct(state, action.productId);
    case "select_payment_method":
      return selectPaymentMethod(state, action.method);
    case "reset":
      return resetTransaction();
  }
}

function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function calculateItemSubtotal(item: CartItem): number {
  return roundMoney(item.product.price * item.quantity);
}

export function calculateTransactionTotal(
  cart: readonly CartItem[],
): number {
  return roundMoney(
    cart.reduce((total, item) => total + calculateItemSubtotal(item), 0),
  );
}

export type CashPaymentResult =
  | { readonly valid: true; readonly amountPaid: number; readonly change: number }
  | {
      readonly valid: false;
      readonly reason: "insufficient_funds";
      readonly amountPaid: number;
      readonly shortfall: number;
    }
  | {
      readonly valid: false;
      readonly reason: "invalid_amount";
    };

function parseCashAmount(input: unknown): number | null {
  let amount: number;

  if (typeof input === "number") {
    amount = input;
  } else if (typeof input === "string") {
    const value = input.trim();
    if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(value)) {
      return null;
    }
    amount = Number(value);
  } else {
    return null;
  }

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  const roundedAmount = roundMoney(amount);
  return Number.isFinite(roundedAmount) ? roundedAmount : null;
}

export function validateCashPayment(
  total: number,
  amountPaidInput: unknown,
): CashPaymentResult {
  const amountPaid = parseCashAmount(amountPaidInput);

  if (!Number.isFinite(total) || total < 0 || amountPaid === null) {
    return { valid: false, reason: "invalid_amount" };
  }

  if (amountPaid < roundMoney(total)) {
    return {
      valid: false,
      reason: "insufficient_funds",
      amountPaid,
      shortfall: roundMoney(total - amountPaid),
    };
  }

  return {
    valid: true,
    amountPaid,
    change: roundMoney(amountPaid - total),
  };
}

export type TransactionFailureReason =
  | "empty_cart"
  | "payment_method_required"
  | "payment_not_processing"
  | "transaction_already_completed"
  | "invalid_amount"
  | "insufficient_funds";

export type CompleteTransactionResult =
  | {
      readonly success: true;
      readonly state: PosState;
      readonly transaction: Transaction;
    }
  | {
      readonly success: false;
      readonly reason: "insufficient_funds";
      readonly amountPaid: number;
      readonly shortfall: number;
    }
  | {
      readonly success: false;
      readonly reason: Exclude<TransactionFailureReason, "insufficient_funds">;
    };

export interface CompleteTransactionOptions {
  readonly now?: Date;
  readonly idFactory?: () => string;
}

function generateTransactionId(): string {
  return `POS-${globalThis.crypto.randomUUID()}`;
}

export function completeTransaction(
  state: PosState,
  amountPaidInput?: unknown,
  options: CompleteTransactionOptions = {},
): CompleteTransactionResult {
  if (state.transaction !== null) {
    return { success: false, reason: "transaction_already_completed" };
  }
  if (state.cart.length === 0) {
    return { success: false, reason: "empty_cart" };
  }
  if (state.paymentMethod === null) {
    return { success: false, reason: "payment_method_required" };
  }
  if (state.step !== "processing") {
    return { success: false, reason: "payment_not_processing" };
  }

  const total = calculateTransactionTotal(state.cart);
  let amountPaid: number;
  let change: number;

  if (state.paymentMethod === "cash") {
    const cashResult = validateCashPayment(total, amountPaidInput);
    if (!cashResult.valid) {
      if (cashResult.reason === "insufficient_funds") {
        return {
          success: false,
          reason: cashResult.reason,
          amountPaid: cashResult.amountPaid,
          shortfall: cashResult.shortfall,
        };
      }
      return { success: false, reason: cashResult.reason };
    }
    amountPaid = cashResult.amountPaid;
    change = cashResult.change;
  } else {
    amountPaid = total;
    change = 0;
  }

  const now = options.now ?? new Date();
  const transaction: Transaction = {
    id: (options.idFactory ?? generateTransactionId)(),
    items: state.cart.map((item) => ({
      product: { ...item.product },
      quantity: item.quantity,
    })),
    total,
    paymentMethod: state.paymentMethod,
    amountPaid,
    change,
    completedAt: now.toISOString(),
  };
  const completedState: PosState = { ...state, step: "success", transaction };

  return { success: true, state: completedState, transaction };
}
