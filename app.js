const storageKey = "reminder-me-transactions";
const tableName = "reminder_transactions";

const form = document.getElementById("transaction-form");
const personInput = document.getElementById("person");
const amountInput = document.getElementById("amount");
const typeInput = document.getElementById("type");
const dueDateInput = document.getElementById("dueDate");
const notesInput = document.getElementById("notes");
const notificationsList = document.getElementById("notifications");
const openTransactionsList = document.getElementById("open-transactions");
const historyList = document.getElementById("history");
const template = document.getElementById("transaction-template");

const todayDate = () => new Date().toISOString().slice(0, 10);
dueDateInput.min = todayDate();

const supabaseUrl = window.APP_CONFIG?.supabaseUrl || "";
const supabaseAnonKey = window.APP_CONFIG?.supabaseAnonKey || "";
const canUseSupabase = Boolean(supabaseUrl && supabaseAnonKey && window.supabase?.createClient);
const supabaseClient = canUseSupabase ? window.supabase.createClient(supabaseUrl, supabaseAnonKey) : null;

let transactions = [];

init();

async function init() {
  transactions = await loadTransactions();
  render();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const transaction = {
    id: crypto.randomUUID(),
    person: personInput.value.trim(),
    amount: Number(amountInput.value),
    type: typeInput.value,
    dueDate: dueDateInput.value,
    notes: notesInput.value.trim(),
    status: "open",
    createdAt: new Date().toISOString(),
    closedAt: null,
  };

  if (canUseSupabase) {
    const { error } = await supabaseClient.from(tableName).insert(toDbRow(transaction));
    if (error) {
      console.error("Failed to save transaction in Supabase", error);
      alert("Could not save transaction. Please try again.");
      return;
    }
  } else {
    transactions.unshift(transaction);
    persist();
  }

  if (canUseSupabase) {
    transactions = await loadTransactions();
  }

  form.reset();
  dueDateInput.min = todayDate();
  render();
});

async function loadTransactions() {
  if (!canUseSupabase) {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  const { data, error } = await supabaseClient
    .from(tableName)
    .select("id, person, amount, type, due_date, notes, status, created_at, closed_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load transactions from Supabase", error);
    return [];
  }

  return data.map(fromDbRow);
}

function persist() {
  localStorage.setItem(storageKey, JSON.stringify(transactions));
}

function daysUntil(dateString) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = parseLocalDate(dateString);
  target.setHours(0, 0, 0, 0);
  return Math.floor((target - now) / (1000 * 60 * 60 * 24));
}

function parseLocalDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);

  if (!year || !month || !day) {
    return new Date(dateString);
  }

  return new Date(year, month - 1, day);
}

function toDbRow(transaction) {
  return {
    id: transaction.id,
    person: transaction.person,
    amount: transaction.amount,
    type: transaction.type,
    due_date: transaction.dueDate,
    notes: transaction.notes || null,
    status: transaction.status,
    created_at: transaction.createdAt,
    closed_at: transaction.closedAt,
  };
}

function fromDbRow(row) {
  return {
    id: row.id,
    person: row.person,
    amount: Number(row.amount),
    type: row.type,
    dueDate: row.due_date,
    notes: row.notes || "",
    status: row.status,
    createdAt: row.created_at,
    closedAt: row.closed_at,
  };
}

function notificationFor(transaction) {
  if (transaction.status !== "open") return null;

  const days = daysUntil(transaction.dueDate);
  const action = transaction.type === "i-owe" ? "Pay" : "Collect";
  const amount = formatCurrency(transaction.amount);

  if (days < 0) {
    return {
      level: "overdue",
      text: `Overdue: ${action} ${amount} ${transaction.type === "i-owe" ? "to" : "from"} ${transaction.person}. (${Math.abs(days)} day(s) late)`,
    };
  }

  if (days === 0) {
    return {
      level: "today",
      text: `Due today: ${action} ${amount} ${transaction.type === "i-owe" ? "to" : "from"} ${transaction.person}.`,
    };
  }

  if (days <= 3) {
    return {
      level: "soon",
      text: `Upcoming in ${days} day(s): ${action} ${amount} ${transaction.type === "i-owe" ? "to" : "from"} ${transaction.person}.`,
    };
  }

  return null;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function clearNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function render() {
  clearNode(notificationsList);
  clearNode(openTransactionsList);
  clearNode(historyList);

  const notifications = transactions
    .map(notificationFor)
    .filter(Boolean)
    .sort((a, b) => {
      const weight = { overdue: 0, today: 1, soon: 2 };
      return weight[a.level] - weight[b.level];
    });

  if (notifications.length === 0) {
    notificationsList.appendChild(emptyItem("No urgent reminders right now."));
  } else {
    notifications.forEach((item) => notificationsList.appendChild(notificationItem(item)));
  }

  const openTransactions = transactions.filter((item) => item.status === "open");
  const closedTransactions = transactions.filter((item) => item.status === "closed");

  if (openTransactions.length === 0) {
    openTransactionsList.appendChild(emptyItem("No open transactions."));
  } else {
    openTransactions.forEach((transaction) => {
      openTransactionsList.appendChild(transactionRow(transaction, true));
    });
  }

  if (transactions.length === 0) {
    historyList.appendChild(emptyItem("No history yet."));
  } else {
    [...openTransactions, ...closedTransactions].forEach((transaction) => {
      historyList.appendChild(transactionRow(transaction, false));
    });
  }
}

function emptyItem(message) {
  const li = document.createElement("li");
  li.className = "empty";
  li.textContent = message;
  return li;
}

function notificationItem(notification) {
  const li = document.createElement("li");
  li.className = "item";

  const text = document.createElement("strong");
  text.textContent = notification.text;

  const badge = document.createElement("span");
  badge.className = `badge ${notification.level}`;
  badge.textContent = notification.level;

  li.appendChild(text);
  li.appendChild(badge);
  return li;
}

function transactionRow(transaction, withActions) {
  const fragment = template.content.cloneNode(true);
  const li = fragment.querySelector("li");
  const title = fragment.querySelector(".title");
  const meta = fragment.querySelector(".meta");
  const actions = fragment.querySelector(".actions");

  const direction = transaction.type === "i-owe" ? "Need to pay" : "Need to collect";
  title.textContent = `${direction} ${formatCurrency(transaction.amount)} ${transaction.type === "i-owe" ? "to" : "from"} ${transaction.person}`;

  const details = [`Due: ${transaction.dueDate}`, `Status: ${transaction.status}`];

  if (transaction.notes) {
    details.push(`Notes: ${transaction.notes}`);
  }

  if (transaction.closedAt) {
    details.push(`Closed: ${transaction.closedAt.slice(0, 10)}`);
  }

  meta.textContent = details.join(" | ");

  if (withActions) {
    const markDone = document.createElement("button");
    markDone.className = "success";
    markDone.textContent = "Mark settled";
    markDone.addEventListener("click", () => settle(transaction.id));

    const remove = document.createElement("button");
    remove.className = "danger";
    remove.textContent = "Delete";
    remove.addEventListener("click", () => removeTransaction(transaction.id));

    actions.appendChild(markDone);
    actions.appendChild(remove);
  }

  return li;
}

async function settle(id) {
  if (canUseSupabase) {
    const closedAt = new Date().toISOString();
    const { error } = await supabaseClient
      .from(tableName)
      .update({ status: "closed", closed_at: closedAt })
      .eq("id", id);

    if (error) {
      console.error("Failed to settle transaction in Supabase", error);
      alert("Could not mark as settled. Please try again.");
      return;
    }

    transactions = await loadTransactions();
  } else {
    transactions = transactions.map((item) =>
      item.id === id
        ? {
            ...item,
            status: "closed",
            closedAt: new Date().toISOString(),
          }
        : item,
    );

    persist();
  }

  render();
}

async function removeTransaction(id) {
  if (canUseSupabase) {
    const { error } = await supabaseClient.from(tableName).delete().eq("id", id);
    if (error) {
      console.error("Failed to delete transaction in Supabase", error);
      alert("Could not delete transaction. Please try again.");
      return;
    }

    transactions = await loadTransactions();
  } else {
    transactions = transactions.filter((item) => item.id !== id);
    persist();
  }

  render();
}
