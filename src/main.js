import {
  PRODUCTS,
  calculateItemSubtotal,
  calculateTransactionTotal,
  completeTransaction,
  createInitialPosState,
  navigateToStep,
  reducePosState,
  resetTransaction,
  selectPaymentMethod,
  validateCashPayment,
} from "../dist/domain/pos.js";

const currency = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

let state = createInitialPosState();
let cardProcessing = false;
let cardProcessingTimeout = null;

const CARD_PROCESSING_DELAY_MS = 800;

const productGrid = document.querySelector("#product-grid");
const orderContent = document.querySelector("#order-content");
const orderTotal = document.querySelector("#order-total");
const itemCount = document.querySelector("#item-count");
const feedback = document.querySelector("#feedback");
const reviewButton = document.querySelector("#review-order");
const orderStep = document.querySelector("#order-step");
const reviewStep = document.querySelector("#review-step");
const paymentStep = document.querySelector("#payment-step");
const processingStep = document.querySelector("#processing-step");
const cardPaymentReady = document.querySelector("#card-payment-ready");
const cardProcessingState = document.querySelector("#card-processing-state");
const cashPaymentStep = document.querySelector("#cash-payment-step");
const qrPaymentStep = document.querySelector("#qr-payment-step");
const successStep = document.querySelector("#success-step");
const receiptStep = document.querySelector("#receipt-step");
const reviewItems = document.querySelector("#review-items");
const receiptItems = document.querySelector("#receipt-items");
const reviewTotal = document.querySelector("#review-total");
const paymentTotal = document.querySelector("#payment-total");
const qrTotal = document.querySelector("#qr-total");
const qrCodeContainer = document.querySelector("#qr-code");
const cardTotal = document.querySelector("#card-total");
const cashTotal = document.querySelector("#cash-total");
const cashAmount = document.querySelector("#cash-amount");
const cashChange = document.querySelector("#cash-change");
const cashFeedback = document.querySelector("#cash-feedback");
const quickAmounts = document.querySelector("#quick-amounts");
const progressSteps = [...document.querySelectorAll("[data-step]")];

function formatMoney(amount) {
  return currency.format(amount);
}

function announce(message, kind = "info") {
  feedback.textContent = message;
  feedback.dataset.kind = kind;
}

function makeProductCard(product) {
  const button = document.createElement("button");
  button.className = "product-card";
  button.type = "button";
  button.dataset.productId = product.id;
  button.setAttribute("aria-label", `Add ${product.name}, ${formatMoney(product.price)}`);

  const details = document.createElement("span");
  details.className = "product-details";

  const name = document.createElement("span");
  name.className = "product-name";
  name.textContent = product.name;

  const price = document.createElement("span");
  price.className = "product-price";
  price.textContent = formatMoney(product.price);

  const action = document.createElement("span");
  action.className = "product-action";
  action.innerHTML = '<span aria-hidden="true">+</span> Add item';

  details.append(name, price);
  button.append(details, action);
  return button;
}

function renderProducts() {
  const fragment = document.createDocumentFragment();
  for (const product of PRODUCTS) {
    fragment.append(makeProductCard(product));
  }
  productGrid.replaceChildren(fragment);
}

function makeQuantityButton(action, productName, productId) {
  const button = document.createElement("button");
  button.className = "quantity-button";
  button.type = "button";
  button.dataset.action = action;
  button.dataset.productId = productId;
  button.textContent = action === "increase" ? "+" : "−";
  const label = action === "increase" ? "Increase" : "Decrease";
  button.setAttribute("aria-label", `${label} ${productName} quantity`);
  return button;
}

function makeOrderRow(item) {
  const row = document.createElement("article");
  row.className = "order-row";

  const top = document.createElement("div");
  top.className = "order-row-top";

  const details = document.createElement("div");
  details.className = "order-item-details";

  const name = document.createElement("h3");
  name.textContent = item.product.name;

  const unitPrice = document.createElement("p");
  unitPrice.textContent = `${formatMoney(item.product.price)} each`;

  const subtotal = document.createElement("strong");
  subtotal.className = "item-subtotal";
  subtotal.textContent = formatMoney(calculateItemSubtotal(item));

  details.append(name, unitPrice);
  top.append(details, subtotal);

  const controls = document.createElement("div");
  controls.className = "order-row-controls";

  const quantity = document.createElement("div");
  quantity.className = "quantity-control";
  quantity.append(
    makeQuantityButton("decrease", item.product.name, item.product.id),
  );

  const quantityValue = document.createElement("span");
  quantityValue.className = "quantity-value";
  quantityValue.textContent = String(item.quantity);
  quantityValue.setAttribute("aria-label", `Quantity ${item.quantity}`);
  quantity.append(
    quantityValue,
    makeQuantityButton("increase", item.product.name, item.product.id),
  );

  const remove = document.createElement("button");
  remove.className = "remove-button";
  remove.type = "button";
  remove.dataset.action = "remove";
  remove.dataset.productId = item.product.id;
  remove.textContent = "Remove";
  remove.setAttribute("aria-label", `Remove ${item.product.name}`);

  controls.append(quantity, remove);
  row.append(top, controls);
  return row;
}

function renderOrder() {
  const fragment = document.createDocumentFragment();
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);

  if (state.cart.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-order";
    empty.textContent = "Your order is empty";
    fragment.append(empty);
  } else {
    for (const item of state.cart) {
      fragment.append(makeOrderRow(item));
    }
  }

  orderContent.replaceChildren(fragment);
  itemCount.textContent = `${count} ${count === 1 ? "item" : "items"}`;
  orderTotal.textContent = formatMoney(calculateTransactionTotal(state.cart));
  reviewButton.disabled = state.cart.length === 0;
}

function renderReview() {
  const fragment = document.createDocumentFragment();
  for (const item of state.cart) {
    const row = document.createElement("tr");
    const values = [
      item.product.name,
      String(item.quantity),
      formatMoney(item.product.price),
      formatMoney(calculateItemSubtotal(item)),
    ];
    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    fragment.append(row);
  }
  reviewItems.replaceChildren(fragment);
  reviewTotal.textContent = formatMoney(calculateTransactionTotal(state.cart));
}

function setCashFeedback(message, kind = "info") {
  cashFeedback.textContent = message;
  cashFeedback.dataset.kind = kind;
}

function renderCashEstimate() {
  const result = validateCashPayment(
    calculateTransactionTotal(state.cart),
    cashAmount.value,
  );
  cashChange.textContent = result.valid ? formatMoney(result.change) : "—";
}

function renderCashPayment() {
  const total = calculateTransactionTotal(state.cart);
  cashTotal.textContent = formatMoney(total);
  const roundedHundred = Math.ceil(total / 100) * 100;
  const roundedFiveHundred = Math.ceil(total / 500) * 500;
  const amounts = [...new Set([total, roundedHundred, roundedFiveHundred])];
  const fragment = document.createDocumentFragment();

  for (const amount of amounts) {
    const button = document.createElement("button");
    button.className = "quick-amount-button";
    button.type = "button";
    button.dataset.quickAmount = String(amount);
    button.textContent = amount === total
      ? `Exact ${formatMoney(amount)}`
      : formatMoney(amount);
    fragment.append(button);
  }

  quickAmounts.replaceChildren(fragment);
  renderCashEstimate();
}

function renderCardPayment() {
  cardTotal.textContent = formatMoney(calculateTransactionTotal(state.cart));
  cardPaymentReady.hidden = cardProcessing;
  cardProcessingState.hidden = !cardProcessing;
  document.querySelector("#process-card-payment").disabled = cardProcessing;
  processingStep.setAttribute(
    "aria-labelledby",
    cardProcessing ? "card-processing-title" : "processing-title",
  );
}

function renderQRCode(total) {
  const payload = JSON.stringify({
    merchant: "Campus Store",
    mode: "SIMULATION",
    currency: "PHP",
    amount: total.toFixed(2),
  });

  qrCodeContainer.replaceChildren();
  qrCodeContainer.setAttribute(
    "aria-label",
    `Generated demo QR code for ${formatMoney(total)}. It does not transfer funds.`,
  );
  new window.QRCode(qrCodeContainer, {
    text: payload,
    width: 208,
    height: 208,
    colorDark: "#102a43",
    colorLight: "#ffffff",
    correctLevel: window.QRCode.CorrectLevel.M,
  });
}

function getPaymentMethodLabel(method) {
  if (method === "qr") return "QR Payment";
  if (method === "card") return "Credit / Debit Card";
  return "Cash";
}

function renderSuccess() {
  const transaction = state.transaction;
  if (!transaction) {
    document.querySelector("#success-reference").textContent = "";
    document.querySelector("#success-method").textContent = "";
    document.querySelector("#success-message").textContent = "Your payment has been received.";
    document.querySelector("#success-total").textContent = "";
    document.querySelector("#success-paid").textContent = "";
    document.querySelector("#success-change").textContent = "";
    return;
  }
  const paymentMethod = getPaymentMethodLabel(transaction.paymentMethod);
  document.querySelector("#success-reference").textContent = transaction.id;
  document.querySelector("#success-method").textContent = paymentMethod;
  document.querySelector("#success-message").textContent = `${paymentMethod} has been confirmed.`;
  document.querySelector("#success-total").textContent = formatMoney(transaction.total);
  document.querySelector("#success-paid").textContent = formatMoney(transaction.amountPaid);
  document.querySelector("#success-change").textContent = formatMoney(transaction.change);
}

function renderReceipt() {
  const transaction = state.transaction;
  if (!transaction) {
    document.querySelector("#receipt-reference").textContent = "";
    document.querySelector("#receipt-date").textContent = "";
    receiptItems.replaceChildren();
    document.querySelector("#receipt-total").textContent = "";
    document.querySelector("#receipt-method").textContent = "";
    document.querySelector("#receipt-paid").textContent = "";
    document.querySelector("#receipt-change").textContent = "";
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const item of transaction.items) {
    const row = document.createElement("tr");
    const values = [
      item.product.name,
      String(item.quantity),
      formatMoney(item.product.price),
      formatMoney(calculateItemSubtotal(item)),
    ];
    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    fragment.append(row);
  }

  document.querySelector("#receipt-reference").textContent = transaction.id;
  document.querySelector("#receipt-date").textContent = new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(transaction.completedAt));
  receiptItems.replaceChildren(fragment);
  document.querySelector("#receipt-total").textContent = formatMoney(transaction.total);
  document.querySelector("#receipt-method").textContent = getPaymentMethodLabel(transaction.paymentMethod);
  document.querySelector("#receipt-paid").textContent = formatMoney(transaction.amountPaid);
  document.querySelector("#receipt-change").textContent = formatMoney(transaction.change);
}

function renderProgress() {
  const activeStep = state.step === "processing" || state.step === "success"
    ? "payment"
    : state.step;
  const activeIndex = progressSteps.findIndex((step) => step.dataset.step === activeStep);
  for (const [index, step] of progressSteps.entries()) {
    const isCurrent = step.dataset.step === activeStep;
    const isComplete = index < activeIndex;
    step.classList.toggle("is-current", isCurrent);
    step.classList.toggle("is-complete", isComplete);
    step.querySelector(".step-number").textContent = isComplete ? "✓" : String(index + 1);
    if (isCurrent) {
      step.setAttribute("aria-current", "step");
      step.removeAttribute("aria-disabled");
    } else {
      step.removeAttribute("aria-current");
      step.setAttribute("aria-disabled", "true");
    }
  }
}

function render() {
  renderOrder();
  renderReview();
  paymentTotal.textContent = formatMoney(calculateTransactionTotal(state.cart));
  const total = calculateTransactionTotal(state.cart);
  qrTotal.textContent = formatMoney(total);
  if (state.step === "processing" && state.paymentMethod === "qr") {
    renderQRCode(total);
  } else {
    qrCodeContainer.replaceChildren();
  }
  for (const option of document.querySelectorAll("[data-payment-method]")) {
    option.setAttribute("aria-pressed", String(option.dataset.paymentMethod === state.paymentMethod));
  }
  renderCashPayment();
  renderCardPayment();
  renderSuccess();
  renderReceipt();
  renderProgress();
  orderStep.hidden = state.step !== "order";
  reviewStep.hidden = state.step !== "review";
  paymentStep.hidden = state.step !== "payment";
  processingStep.hidden = state.step !== "processing" || state.paymentMethod !== "card";
  cashPaymentStep.hidden = state.step !== "processing" || state.paymentMethod !== "cash";
  qrPaymentStep.hidden = state.step !== "processing" || state.paymentMethod !== "qr";
  successStep.hidden = state.step !== "success";
  receiptStep.hidden = state.step !== "receipt";
}

function changeState(action) {
  state = reducePosState(state, action);
  render();
}

productGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-product-id]");
  if (!button) return;

  const selectedProduct = PRODUCTS.find(
    (product) => product.id === button.dataset.productId,
  );
  if (!selectedProduct) return;

  changeState({ type: "add_product", product: selectedProduct });
  announce(`Product added — ${selectedProduct.name}`, "success");
});

orderContent.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action][data-product-id]");
  if (!button) return;

  const { action, productId } = button.dataset;
  const item = state.cart.find((cartItem) => cartItem.product.id === productId);
  if (!item) return;

  if (action === "increase") {
    changeState({ type: "increase_quantity", productId });
    announce(`${item.product.name} quantity increased.`, "success");
  } else if (action === "decrease") {
    changeState({ type: "decrease_quantity", productId });
    if (item.quantity === 1) {
      announce(`${item.product.name} removed from your order.`);
    } else {
      announce(`${item.product.name} quantity decreased.`, "success");
    }
  } else if (action === "remove") {
    changeState({ type: "remove_product", productId });
    announce(`${item.product.name} removed from your order.`);
  }
});

reviewButton.addEventListener("click", () => {
  if (state.cart.length === 0) {
    announce("Add an item before reviewing your order.", "error");
    return;
  }
  state = navigateToStep(state, "review");
  render();
  document.querySelector("#review-title").focus();
});

document.querySelector("#back-to-items").addEventListener("click", () => {
  state = navigateToStep(state, "order");
  render();
  document.querySelector("#catalog-title").focus();
});

document.querySelector("#continue-to-payment").addEventListener("click", () => {
  state = navigateToStep(state, "payment");
  render();
  document.querySelector("#payment-title").focus();
});

document.querySelector("#back-to-review").addEventListener("click", () => {
  state = navigateToStep(state, "review");
  render();
  document.querySelector("#review-title").focus();
});

document.querySelector("#back-to-payment").addEventListener("click", () => {
  state = navigateToStep(state, "payment");
  render();
  document.querySelector("#payment-title").focus();
});

document.querySelector(".payment-options").addEventListener("click", (event) => {
  const button = event.target.closest("[data-payment-method]");
  if (!button) return;

  if (button.dataset.paymentMethod === "cash") setCashFeedback("");
  if (button.dataset.paymentMethod === "qr") {
    document.querySelector("#qr-feedback").textContent = "";
  }
  if (button.dataset.paymentMethod === "card") {
    cardProcessing = false;
    document.querySelector("#card-feedback").textContent = "";
  }
  state = selectPaymentMethod(state, button.dataset.paymentMethod);
  state = navigateToStep(state, "processing");
  render();
  const nextTitle = state.paymentMethod === "cash"
    ? "#cash-payment-title"
    : state.paymentMethod === "qr"
      ? "#qr-payment-title"
      : "#processing-title";
  document.querySelector(nextTitle).focus();
});

document.querySelector("#back-from-qr").addEventListener("click", () => {
  state = navigateToStep(state, "payment");
  render();
  document.querySelector("#payment-title").focus();
});

document.querySelector("#confirm-qr-payment").addEventListener("click", (event) => {
  if (state.step !== "processing" || state.paymentMethod !== "qr") return;

  const button = event.currentTarget;
  button.disabled = true;
  const result = completeTransaction(state);
  if (!result.success) {
    button.disabled = false;
    document.querySelector("#qr-feedback").textContent =
      "QR payment could not be confirmed. Please go back and try again.";
    return;
  }

  state = result.state;
  render();
  document.querySelector("#success-title").focus();
});

document.querySelector("#process-card-payment").addEventListener("click", (event) => {
  if (state.step !== "processing" || state.paymentMethod !== "card" || cardProcessing) {
    return;
  }

  const button = event.currentTarget;
  button.disabled = true;
  cardProcessing = true;
  document.querySelector("#card-feedback").textContent = "";
  renderCardPayment();
  document.querySelector("#card-processing-title").focus();

  cardProcessingTimeout = window.setTimeout(() => {
    cardProcessingTimeout = null;
    if (!cardProcessing || state.step !== "processing" || state.paymentMethod !== "card") {
      return;
    }

    const result = completeTransaction(state);
    if (!result.success) {
      cardProcessing = false;
      document.querySelector("#card-feedback").textContent =
        "Card payment could not be completed. Please try again.";
      renderCardPayment();
      document.querySelector("#processing-title").focus();
      return;
    }

    cardProcessing = false;
    state = result.state;
    render();
    document.querySelector("#success-title").focus();
  }, CARD_PROCESSING_DELAY_MS);
});

document.querySelector("#view-receipt").addEventListener("click", () => {
  state = navigateToStep(state, "receipt");
  render();
  document.querySelector("#receipt-title").focus();
});

document.querySelector("#new-transaction").addEventListener("click", () => {
  if (cardProcessingTimeout !== null) {
    window.clearTimeout(cardProcessingTimeout);
    cardProcessingTimeout = null;
  }
  cardProcessing = false;
  state = resetTransaction();
  cashAmount.value = "";
  setCashFeedback("");
  document.querySelector("#qr-feedback").textContent = "";
  document.querySelector("#card-feedback").textContent = "";
  document.querySelector("#confirm-qr-payment").disabled = false;
  announce("Your order is empty.");
  render();
  document.querySelector("#catalog-title").focus();
});

quickAmounts.addEventListener("click", (event) => {
  const button = event.target.closest("[data-quick-amount]");
  if (!button) return;
  cashAmount.value = button.dataset.quickAmount;
  setCashFeedback("");
  renderCashEstimate();
});

cashAmount.addEventListener("input", () => {
  setCashFeedback("");
  renderCashEstimate();
});

document.querySelector("#change-cash-method").addEventListener("click", () => {
  state = navigateToStep(state, "payment");
  render();
  document.querySelector("#payment-title").focus();
});

document.querySelector("#pay-now").addEventListener("click", () => {
  const result = completeTransaction(state, cashAmount.value);
  if (!result.success) {
    if (result.reason === "insufficient_funds") {
      setCashFeedback(
        `Insufficient payment.\nPlease enter at least ${formatMoney(calculateTransactionTotal(state.cart))}.\nYou are short by ${formatMoney(result.shortfall)}.`,
        "error",
      );
    } else if (result.reason === "invalid_amount") {
      setCashFeedback("Enter a valid amount paid. Blank, malformed, or negative amounts are not accepted.", "error");
    } else {
      setCashFeedback("Cash payment could not be completed. Please try again.", "error");
    }
    cashAmount.focus();
    return;
  }

  state = result.state;
  render();
  document.querySelector("#success-title").focus();
});

renderProducts();
render();
