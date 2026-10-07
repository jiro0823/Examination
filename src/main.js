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
let selectedCategory = "all";
let feedbackTimeout = null;

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
const payNowButton = document.querySelector("#pay-now");
const cashKeypad = document.querySelector(".cash-keypad");
const progressSteps = [...document.querySelectorAll("[data-step]")];
const categoryFilters = document.querySelector("#category-filters");

const PRODUCT_CATEGORIES = {
  coffee: "drinks",
  sandwich: "food",
  "soft-drink": "drinks",
  cookies: "snacks",
  "bottled-water": "drinks",
  chocolate: "snacks",
};

const PRODUCT_ICONS = {
  coffee: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 17h24v13a9 9 0 0 1-9 9h-6a9 9 0 0 1-9-9V17Z"/><path d="M34 20h3a5 5 0 0 1 0 10h-4M15 11c0-2 2-2 2-4m8 4c0-2 2-2 2-4M8 42h31"/></svg>',
  sandwich: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 21a16 16 0 0 1 32 0H8Zm0 4h32l-5 12H13L8 25Z"/><path d="M13 29h22M16 34h16"/></svg>',
  "soft-drink": '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M17 15h16l-2 27H19l-2-27Zm2-5h12v5H19zM26 10l4-6m-12 17h12"/><path d="M25 25v6"/></svg>',
  cookies: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M38 25a15 15 0 1 1-15-15c0 5 4 9 9 9 2 0 4-.5 6-2v8Z"/><circle cx="17" cy="22" r="1.5"/><circle cx="27" cy="31" r="1.5"/><circle cx="19" cy="34" r="1.5"/></svg>',
  "bottled-water": '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M19 7h10v6l4 5v23H15V18l4-5V7Zm0 6h10m-12 8h14m-14 4h14"/><path d="M22 31h4"/></svg>',
  chocolate: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 15 34 8l7 25-24 7-7-25Z"/><path d="m10 15 24 0m-16 4 4 14m4-18 4 14m-9-9 19-5"/></svg>',
};

function formatMoney(amount) {
  return currency.format(amount);
}

function announce(message, kind = "info") {
  feedback.textContent = message;
  feedback.dataset.kind = kind;
  feedback.classList.add("is-visible");
  window.clearTimeout(feedbackTimeout);
  feedbackTimeout = window.setTimeout(() => feedback.classList.remove("is-visible"), 2400);
}

function makeProductCard(product) {
  const button = document.createElement("button");
  button.className = "product-card";
  button.type = "button";
  button.dataset.productId = product.id;
  button.setAttribute("aria-label", `Add ${product.name}, ${formatMoney(product.price)}`);

  const visual = document.createElement("span");
  visual.className = `product-visual product-visual-${product.id}`;
  visual.innerHTML = PRODUCT_ICONS[product.id] ?? "";

  const badge = document.createElement("span");
  badge.className = "product-quantity-badge";
  badge.setAttribute("aria-hidden", "true");

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
  action.innerHTML = '<span aria-hidden="true">+</span> Tap to add';

  details.append(name, price);
  button.append(visual, badge, details, action);
  return button;
}

function renderProducts() {
  const fragment = document.createDocumentFragment();
  for (const product of PRODUCTS.filter((item) => selectedCategory === "all" || PRODUCT_CATEGORIES[item.id] === selectedCategory)) {
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
  remove.setAttribute("aria-label", `Remove ${item.product.name}`);
  remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16m-10 4v7m4-7v7M6 7l1 14h10l1-14M9 7V4h6v3"/></svg>';

  controls.append(quantity, remove);
  row.append(top, controls);
  return row;
}

function renderOrder() {
  const fragment = document.createDocumentFragment();
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);

  if (state.cart.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-order";
    empty.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 17h32l-3 25H11L8 17Zm9 0a7 7 0 0 1 14 0"/><path d="M18 27v7m12-7v7"/></svg><strong>Your order is empty</strong><span>Tap a product to start your order.</span>';
    fragment.append(empty);
  } else {
    for (const item of state.cart) {
      fragment.append(makeOrderRow(item));
    }
  }

  orderContent.replaceChildren(fragment);
  for (const card of productGrid.querySelectorAll(".product-card")) {
    const item = state.cart.find((cartItem) => cartItem.product.id === card.dataset.productId);
    const badge = card.querySelector(".product-quantity-badge");
    card.classList.toggle("is-selected", Boolean(item));
    badge.textContent = item ? String(item.quantity) : "";
    badge.hidden = !item;
    card.setAttribute("aria-label", item
      ? `Add ${card.querySelector(".product-name").textContent}, ${formatMoney(item.product.price)}. ${item.quantity} in your order.`
      : `Add ${card.querySelector(".product-name").textContent}, ${formatMoney(PRODUCTS.find((product) => product.id === card.dataset.productId).price)}`);
  }
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
  const total = calculateTransactionTotal(state.cart);
  const result = validateCashPayment(total, cashAmount.value);
  cashChange.textContent = result.valid ? formatMoney(result.change) : "—";
  payNowButton.disabled = total <= 0 || !result.valid;

  if (result.valid) {
    setCashFeedback(result.change === 0
      ? "Exact payment. No change due."
      : `Payment ready. Change ${formatMoney(result.change)}.`, "success");
  } else if (result.reason === "insufficient_funds") {
    setCashFeedback(`Amount remaining: ${formatMoney(result.shortfall)}.`, "error");
  } else {
    setCashFeedback(cashAmount.value.trim()
      ? "Enter a valid amount paid."
      : "Enter the amount received to see payment status.");
  }
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

categoryFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  selectedCategory = button.dataset.category;
  for (const filter of categoryFilters.querySelectorAll("[data-category]")) {
    const selected = filter === button;
    filter.classList.toggle("is-selected", selected);
    filter.setAttribute("aria-pressed", String(selected));
  }
  renderProducts();
  renderOrder();
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
  renderCashEstimate();
});

cashAmount.addEventListener("input", () => {
  const originalValue = cashAmount.value;
  let cleanedValue = originalValue.replace(/[^\d.]/g, "");
  const decimalPosition = cleanedValue.indexOf(".");
  if (decimalPosition !== -1) {
    cleanedValue = `${cleanedValue.slice(0, decimalPosition)}.${cleanedValue.slice(decimalPosition + 1).replace(/\./g, "").slice(0, 2)}`;
  }
  if (cleanedValue.length > 15) cleanedValue = cleanedValue.slice(0, 15);
  if (cashAmount.value !== cleanedValue) cashAmount.value = cleanedValue;
  renderCashEstimate();
});

cashAmount.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    if (!payNowButton.disabled) payNowButton.click();
  }
});

cashKeypad.addEventListener("click", (event) => {
  const button = event.target.closest("[data-keypad]");
  if (!button) return;

  if (button.dataset.keypad === "clear") {
    cashAmount.value = "";
  } else if (button.dataset.keypad === "backspace") {
    cashAmount.value = cashAmount.value.slice(0, -1);
  } else if (cashAmount.value.length < 15) {
    cashAmount.value += button.dataset.keypad;
  }

  renderCashEstimate();
  cashAmount.focus();
  cashAmount.setSelectionRange(cashAmount.value.length, cashAmount.value.length);
});

document.querySelector("#change-cash-method").addEventListener("click", () => {
  state = navigateToStep(state, "payment");
  render();
  document.querySelector("#payment-title").focus();
});

payNowButton.addEventListener("click", () => {
  if (payNowButton.disabled || state.step !== "processing" || state.paymentMethod !== "cash") return;
  payNowButton.disabled = true;
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
