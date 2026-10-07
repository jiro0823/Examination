import assert from "node:assert/strict";
import test from "node:test";
import {
  PRODUCTS,
  addProduct,
  calculateItemSubtotal,
  calculateTransactionTotal,
  completeTransaction,
  createInitialPosState,
  decreaseQuantity,
  increaseQuantity,
  navigateToStep,
  reducePosState,
  removeProduct,
  resetTransaction,
  selectPaymentMethod,
  validateCashPayment,
} from "../src/domain/pos.ts";

const product = (id) => PRODUCTS.find((item) => item.id === id);
const add = (state, id, quantity = 1) => {
  let nextState = addProduct(state, product(id));
  for (let count = 1; count < quantity; count += 1) {
    nextState = increaseQuantity(nextState, id);
  }
  return nextState;
};

function referenceCart() {
  let state = createInitialPosState();
  state = add(state, "coffee", 2);
  state = add(state, "sandwich");
  state = add(state, "soft-drink");
  return state;
}

function cashCart() {
  let state = createInitialPosState();
  state = add(state, "coffee", 2);
  state = add(state, "sandwich");
  return state;
}

function readyToPayFrom(cart, method) {
  let state = navigateToStep(cart, "review");
  state = navigateToStep(state, "payment");
  state = selectPaymentMethod(state, method);
  return navigateToStep(state, "processing");
}

function readyToPay(method) {
  return readyToPayFrom(referenceCart(), method);
}

test("reference products have the required names and prices", () => {
  assert.deepEqual(
    PRODUCTS.map(({ name, price }) => [name, price]),
    [
      ["Coffee", 45],
      ["Sandwich", 50],
      ["Soft Drink", 35],
      ["Cookies", 25],
      ["Bottled Water", 20],
      ["Chocolate", 25],
    ],
  );
});

test("calculates item subtotals and the reference transaction total", () => {
  const state = referenceCart();
  assert.equal(calculateItemSubtotal(state.cart[0]), 90);
  assert.equal(calculateTransactionTotal(state.cart), 175);
});

test("increasing and decreasing Coffee quantity updates the total", () => {
  let state = referenceCart();
  state = increaseQuantity(state, "coffee");
  assert.equal(calculateTransactionTotal(state.cart), 220);

  state = decreaseQuantity(state, "coffee");
  assert.equal(calculateTransactionTotal(state.cart), 175);
});

test("decreasing quantity at one cannot create a zero or negative cart item", () => {
  const state = add(createInitialPosState(), "coffee");
  const nextState = decreaseQuantity(state, "coffee");

  assert.equal(nextState.cart[0].quantity, 1);
  assert.equal(calculateTransactionTotal(nextState.cart), 45);
});

test("removing Soft Drink updates the reference total to 140", () => {
  const nextState = removeProduct(referenceCart(), "soft-drink");
  assert.equal(calculateTransactionTotal(nextState.cart), 140);
});

test("step navigation preserves the cart when returning to order", () => {
  let state = navigateToStep(referenceCart(), "review");
  state = navigateToStep(state, "payment");
  state = selectPaymentMethod(state, "cash");
  state = navigateToStep(state, "order");

  assert.equal(state.step, "order");
  assert.equal(calculateTransactionTotal(state.cart), 175);
  assert.equal(state.paymentMethod, "cash");
});

test("review back navigation preserves Coffee x2, Sandwich x1, and the total", () => {
  let state = createInitialPosState();
  state = add(state, "coffee", 2);
  state = add(state, "sandwich");
  const reviewed = navigateToStep(state, "review");
  const returned = navigateToStep(reviewed, "order");

  assert.equal(reviewed.step, "review");
  assert.equal(calculateTransactionTotal(reviewed.cart), 140);
  assert.equal(returned.step, "order");
  assert.deepEqual(
    returned.cart.map(({ product, quantity }) => [product.name, quantity]),
    [["Coffee", 2], ["Sandwich", 1]],
  );
  assert.equal(calculateTransactionTotal(returned.cart), 140);
});

test("review can continue to the payment step without changing cart state", () => {
  const reviewed = navigateToStep(add(referenceCart(), "coffee"), "review");
  const payment = navigateToStep(reviewed, "payment");

  assert.equal(payment.step, "payment");
  assert.equal(payment.cart, reviewed.cart);
  assert.equal(calculateTransactionTotal(payment.cart), 220);
});

test("payment method selection supports cash, QR, and card and advances to processing", () => {
  for (const method of ["cash", "qr", "card"]) {
    const reviewed = navigateToStep(referenceCart(), "review");
    const payment = navigateToStep(reviewed, "payment");
    const selected = selectPaymentMethod(payment, method);
    const processing = navigateToStep(selected, "processing");

    assert.equal(selected.paymentMethod, method);
    assert.equal(processing.step, "processing");
    assert.equal(processing.paymentMethod, method);
    assert.equal(processing.cart, payment.cart);
    assert.equal(calculateTransactionTotal(processing.cart), 175);
  }
});

test("payment back navigation returns to Review with the same cart", () => {
  const payment = navigateToStep(
    navigateToStep(referenceCart(), "review"),
    "payment",
  );
  const review = navigateToStep(payment, "review");

  assert.equal(review.step, "review");
  assert.equal(review.cart, payment.cart);
  assert.equal(calculateTransactionTotal(review.cart), 175);
});

test("add product increments an existing product and reducer routes actions", () => {
  let state = add(createInitialPosState(), "coffee");
  state = addProduct(state, product("coffee"));
  state = reducePosState(state, {
    type: "add_product",
    product: product("sandwich"),
  });

  assert.equal(state.cart.find((item) => item.product.id === "coffee").quantity, 2);
  assert.equal(calculateTransactionTotal(state.cart), 140);
});

test("cash validation rejects insufficient and malformed amounts", () => {
  assert.deepEqual(validateCashPayment(140, 100), {
    valid: false,
    reason: "insufficient_funds",
    amountPaid: 100,
    shortfall: 40,
  });
  for (const input of [
    "",
    "   ",
    "abc",
    "1,400",
    Infinity,
    1e308,
    NaN,
    -1,
    null,
  ]) {
    assert.deepEqual(validateCashPayment(140, input), {
      valid: false,
      reason: "invalid_amount",
    });
  }
});

test("cash exact payment succeeds with zero change", () => {
  assert.deepEqual(validateCashPayment(140, 140), {
    valid: true,
    amountPaid: 140,
    change: 0,
  });
});

test("cash overpayment succeeds with calculated change", () => {
  assert.deepEqual(validateCashPayment(140, 200), {
    valid: true,
    amountPaid: 200,
    change: 60,
  });
});

test("failed payment does not generate an ID or complete a transaction", () => {
  const state = readyToPay("cash");
  let idCalls = 0;
  const result = completeTransaction(state, 100, {
    idFactory: () => {
      idCalls += 1;
      return "unexpected";
    },
  });

  assert.deepEqual(result, {
    success: false,
    reason: "insufficient_funds",
    amountPaid: 100,
    shortfall: 75,
  });
  assert.equal(idCalls, 0);
});

test("cash payment of 100 for a 140 total fails without completing a transaction", () => {
  const readyState = readyToPayFrom(cashCart(), "cash");
  let idCalls = 0;
  const result = completeTransaction(readyState, 100, {
    idFactory: () => {
      idCalls += 1;
      return "should-not-be-created";
    },
  });

  assert.deepEqual(result, {
    success: false,
    reason: "insufficient_funds",
    amountPaid: 100,
    shortfall: 40,
  });
  assert.equal(idCalls, 0);
  assert.equal(readyState.step, "processing");
  assert.equal(readyState.transaction, null);
});

test("blank, malformed, negative, and non-finite cash do not complete a transaction", () => {
  const state = readyToPayFrom(cashCart(), "cash");
  for (const amount of ["", "abc", -1, Infinity, NaN]) {
    let idCalls = 0;
    const result = completeTransaction(state, amount, {
      idFactory: () => {
        idCalls += 1;
        return "should-not-be-created";
      },
    });

    assert.deepEqual(result, { success: false, reason: "invalid_amount" });
    assert.equal(idCalls, 0);
    assert.equal(state.transaction, null);
    assert.equal(state.step, "processing");
  }
});

test("cash payment of 200 for a 140 total completes with 60 change", () => {
  const payment = readyToPayFrom(cashCart(), "cash");
  const result = completeTransaction(payment, "200", {
    idFactory: () => "POS-cash-overpayment",
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.state.step, "success");
  assert.equal(result.transaction.total, 140);
  assert.equal(result.transaction.amountPaid, 200);
  assert.equal(result.transaction.change, 60);
});

test("exact cash payment of 140 for a 140 total completes with no change", () => {
  const payment = readyToPayFrom(cashCart(), "cash");
  const result = completeTransaction(payment, "140", {
    idFactory: () => "POS-cash-exact",
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.transaction.total, 140);
  assert.equal(result.transaction.amountPaid, 140);
  assert.equal(result.transaction.change, 0);
});

test("successful cash completion creates a transaction with an ID and snapshot", () => {
  const state = readyToPay("cash");
  let idCalls = 0;
  const result = completeTransaction(state, 200, {
    now: new Date("2026-01-02T03:04:05.000Z"),
    idFactory: () => {
      idCalls += 1;
      return "POS-test-1";
    },
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(idCalls, 1);
  assert.equal(result.transaction.id, "POS-test-1");
  assert.equal(result.transaction.total, 175);
  assert.equal(result.transaction.amountPaid, 200);
  assert.equal(result.transaction.change, 25);
  assert.equal(result.transaction.completedAt, "2026-01-02T03:04:05.000Z");
  assert.equal(result.state.transaction, result.transaction);
  assert.equal(result.state.step, "success");
  assert.equal(state.transaction, null);
});

test("successful transactions receive distinct generated reference IDs", () => {
  const first = completeTransaction(readyToPay("qr"));
  const second = completeTransaction(readyToPay("qr"));

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  if (!first.success || !second.success) return;
  assert.match(first.transaction.id, /^POS-/);
  assert.notEqual(first.transaction.id, second.transaction.id);
});

test("QR and card simulations charge the total and give no change", () => {
  for (const method of ["qr", "card"]) {
    const state = readyToPay(method);
    const result = completeTransaction(state, "invalid input", {
      idFactory: () => `POS-${method}`,
    });

    assert.equal(result.success, true);
    if (!result.success) continue;
    assert.equal(result.transaction.paymentMethod, method);
    assert.equal(result.transaction.amountPaid, 175);
    assert.equal(result.transaction.change, 0);
  }
});

test("QR confirmation records the current total once with zero change", () => {
  const state = readyToPayFrom(cashCart(), "qr");
  let idCalls = 0;
  const result = completeTransaction(state, undefined, {
    idFactory: () => {
      idCalls += 1;
      return "POS-qr-confirmed";
    },
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.transaction.total, 140);
  assert.equal(result.transaction.amountPaid, 140);
  assert.equal(result.transaction.change, 0);
  assert.equal(result.transaction.paymentMethod, "qr");
  assert.equal(result.state.step, "success");
  assert.equal(idCalls, 1);

  const duplicate = completeTransaction(result.state, undefined, {
    idFactory: () => {
      idCalls += 1;
      return "POS-duplicate";
    },
  });
  assert.deepEqual(duplicate, {
    success: false,
    reason: "transaction_already_completed",
  });
  assert.equal(idCalls, 1);
});

test("card payment completes the current total once with zero change", () => {
  const state = readyToPayFrom(cashCart(), "card");
  assert.equal(state.step, "processing");
  assert.equal(state.transaction, null);

  let idCalls = 0;
  const result = completeTransaction(state, undefined, {
    idFactory: () => {
      idCalls += 1;
      return "POS-card-confirmed";
    },
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.transaction.total, 140);
  assert.equal(result.transaction.amountPaid, 140);
  assert.equal(result.transaction.change, 0);
  assert.equal(result.transaction.paymentMethod, "card");
  assert.equal(result.state.step, "success");

  const duplicate = completeTransaction(result.state, undefined, {
    idFactory: () => {
      idCalls += 1;
      return "POS-card-duplicate";
    },
  });
  assert.deepEqual(duplicate, {
    success: false,
    reason: "transaction_already_completed",
  });
  assert.equal(idCalls, 1);
});

test("cash receipt transaction snapshot matches Coffee x2 and Sandwich x1", () => {
  const result = completeTransaction(readyToPayFrom(cashCart(), "cash"), 200, {
    now: new Date("2026-10-07T08:30:00.000Z"),
    idFactory: () => "POS-cash-receipt",
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  const transaction = result.transaction;
  assert.deepEqual(
    transaction.items.map((item) => [
      item.product.name,
      item.quantity,
      item.product.price,
      calculateItemSubtotal(item),
    ]),
    [
      ["Coffee", 2, 45, 90],
      ["Sandwich", 1, 50, 50],
    ],
  );
  assert.equal(transaction.total, 140);
  assert.equal(transaction.paymentMethod, "cash");
  assert.equal(transaction.amountPaid, 200);
  assert.equal(transaction.change, 60);
  assert.equal(transaction.completedAt, "2026-10-07T08:30:00.000Z");

  const receiptState = navigateToStep(result.state, "receipt");
  assert.equal(receiptState.transaction, transaction);
});

test("QR and card receipts use the completed transaction amount with zero change", () => {
  for (const method of ["qr", "card"]) {
    const result = completeTransaction(readyToPayFrom(cashCart(), method), undefined, {
      idFactory: () => `POS-${method}-receipt`,
    });

    assert.equal(result.success, true);
    if (!result.success) continue;
    assert.equal(result.transaction.total, 140);
    assert.equal(result.transaction.amountPaid, 140);
    assert.equal(result.transaction.change, 0);
    assert.equal(result.transaction.paymentMethod, method);
    assert.equal(
      navigateToStep(result.state, "receipt").transaction,
      result.transaction,
    );
  }
});

test("completion requires items and a selected payment method", () => {
  assert.deepEqual(completeTransaction(createInitialPosState()), {
    success: false,
    reason: "empty_cart",
  });
  assert.deepEqual(completeTransaction(referenceCart()), {
    success: false,
    reason: "payment_method_required",
  });
});

test("step transitions reject skipping required stages", () => {
  const initial = createInitialPosState();
  assert.equal(navigateToStep(initial, "review"), initial);
  const withItem = add(initial, "coffee");
  assert.equal(navigateToStep(withItem, "payment"), withItem);
  assert.equal(navigateToStep(withItem, "processing"), withItem);
});

test("receipt is available only after successful completion", () => {
  const state = readyToPay("qr");
  const result = completeTransaction(state, undefined, {
    idFactory: () => "POS-receipt-test",
  });
  assert.equal(result.success, true);
  if (!result.success) return;

  const receiptState = navigateToStep(result.state, "receipt");
  assert.equal(receiptState.step, "receipt");
  assert.equal(receiptState.transaction?.id, "POS-receipt-test");
});

test("reset clears cart, payment method, and completed transaction", () => {
  const state = readyToPay("qr");
  const completed = completeTransaction(state, undefined, {
    idFactory: () => "POS-reset-test",
  });
  assert.equal(completed.success, true);
  if (!completed.success) return;

  const reset = reducePosState(completed.state, { type: "reset" });
  assert.deepEqual(reset, createInitialPosState());
  assert.deepEqual(reset, resetTransaction());
});

test("a new transaction reset clears the receipt state and creates a distinct next reference", () => {
  const firstResult = completeTransaction(readyToPayFrom(cashCart(), "cash"), 200);
  assert.equal(firstResult.success, true);
  if (!firstResult.success) return;
  const firstReceipt = navigateToStep(firstResult.state, "receipt");
  const firstReference = firstReceipt.transaction.id;

  const reset = reducePosState(firstReceipt, { type: "reset" });
  assert.deepEqual(reset, createInitialPosState());
  assert.equal(reset.cart.length, 0);
  assert.equal(reset.paymentMethod, null);
  assert.equal(reset.transaction, null);
  assert.equal(calculateTransactionTotal(reset.cart), 0);

  const nextOrder = add(createInitialPosState(), "bottled-water");
  const secondResult = completeTransaction(readyToPayFrom(nextOrder, "qr"));
  assert.equal(secondResult.success, true);
  if (!secondResult.success) return;
  assert.notEqual(secondResult.transaction.id, firstReference);
  assert.equal(secondResult.transaction.paymentMethod, "qr");
  assert.equal(secondResult.transaction.total, 20);
  assert.deepEqual(secondResult.transaction.items.map(({ product }) => product.name), ["Bottled Water"]);
});
