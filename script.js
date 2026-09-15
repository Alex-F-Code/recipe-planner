const STORAGE_SELECTIONS = "recipe-planner-selections-v3";
const STORAGE_CHECKED = "recipe-planner-checked-v3";

const MEAL_TYPES = ["breakfast", "lunch", "dinner"];
const MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

const SECTION_ORDER = [
    "Fruit & veg",
    "Meat & fish",
    "Dairy & eggs",
    "Bakery",
    "Frozen",
    "Tins & jars",
    "Pasta, rice & grains",
    "Herbs, spices & baking",
    "Oils, sauces & condiments",
    "Other"
];

const SECTION_RULES = [
    ["Frozen", ["frozen"]],
    ["Herbs, spices & baking", ["stock cube", "gravy granule", "chocolate powder", "spice mix", "chia seed", "baking powder", "curry powder"]],
    ["Oils, sauces & condiments", ["olive oil", "sesame oil", "vegetable oil", "sunflower oil", "rapeseed oil", "peanut butter", "curry paste", "soy sauce", "fish sauce", "black bean sauce", "worcestershire sauce"]],
    ["Tins & jars", ["baked bean", "tinned", "canned", "kalamata olive", "black olive", "green olive", "coconut milk", "tomato puree"]],
    ["Bakery", ["pitta", "tortilla", "wrap", "sourdough", "bagel", "baguette", "flatbread", "bread"]],
    ["Fruit & veg", ["fresh mint", "fresh coriander", "fresh basil", "fresh thyme", "fresh parsley", "fresh dill", "fresh rosemary", "thai basil"]],
    ["Fruit & veg", ["baby gem", "baby spinach", "baby corn", "cherry tomato", "spring onion", "red onion", "red pepper", "green bean", "chestnut mushroom", "romaine lettuce", "garlic clove", "garlic bulb", "celery stick", "new potato"]],
    ["Meat & fish", ["mince", "chicken", "beef", "lamb", "pork", "sausage", "bacon", "steak", "fish", "tuna", "salmon", "cod", "prawn", "kofta", "turkey", "duck", "ham"]],
    ["Pasta, rice & grains", ["pasta", "spaghetti", "noodle", "rice", "oats", "granola", "quinoa", "couscous", "cereal", "flour", "walnut", "almond", "cashew", "pecan"]],
    ["Dairy & eggs", ["yoghurt", "yogurt", "milk", "butter", "cheese", "feta", "parmesan", "halloumi", "mozzarella", "cheddar", "cream", "egg"]],
    ["Herbs, spices & baking", ["oregano", "cumin", "coriander", "turmeric", "paprika", "cinnamon", "garam masala", "chilli", "salt", "black pepper", "sugar", "vanilla", "yeast", "cocoa", "seed"]],
    ["Oils, sauces & condiments", ["oil", "vinegar", "sauce", "dressing", "hummus", "jam", "honey", "mustard", "stock", "gravy", "mayonnaise", "ketchup", "syrup"]],
    ["Tins & jars", ["olive", "chickpea", "cannellini", "kidney bean", "butter bean"]],
    ["Fruit & veg", ["onion", "shallot", "garlic", "carrot", "potato", "parsnip", "celery", "leek", "cabbage", "broccoli", "cauliflower", "spinach", "kale", "lettuce", "tomato", "cucumber", "pepper", "courgette", "aubergine", "mushroom", "corn", "pea", "bean", "lemon", "lime", "orange", "apple", "banana", "berry", "grape", "avocado", "ginger", "mint", "basil", "thyme", "rosemary", "parsley", "dill", "chive", "romaine", "gem", "mangetout", "asparagus"]]
];

function classifyIngredient(name) {
    const lower = String(name || "").toLowerCase();
    for (const [section, tokens] of SECTION_RULES) {
        for (const t of tokens) {
            if (lower.includes(t)) return section;
        }
    }
    return "Other";
}

function groupBySection(names) {
    const groups = {};
    for (const n of names) {
        const s = classifyIngredient(n);
        if (!groups[s]) groups[s] = [];
        groups[s].push(n);
    }
    return groups;
}

const state = {
    view: "loading",
    recipes: [],
    activeMealType: null,
    selectDeck: [],
    selectIndex: 0,
    selections: {},
    checkedItems: new Set(),
    animating: false
};

async function init() {
    try {
        const res = await fetch("data/recipes.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        state.recipes = data.items || [];
        loadSaved();
        state.view = "home";
        render();
    } catch (err) {
        document.getElementById("app").innerHTML = `
            <div class="center-message">
                <div class="error-panel">
                    Could not load recipes: ${escapeHtml(err.message)}.<br><br>
                    If you opened the file directly, serve the folder through a local web server
                    (e.g. Live Server in VS Code).
                </div>
            </div>
        `;
    }
}

function loadSaved() {
    try {
        const s = localStorage.getItem(STORAGE_SELECTIONS);
        if (s) {
            const parsed = JSON.parse(s);
            const valid = new Set(state.recipes.map(r => r.id));
            state.selections = {};
            for (const [id, count] of Object.entries(parsed)) {
                if (valid.has(id) && count > 0) state.selections[id] = count;
            }
        }
    } catch (e) { state.selections = {}; }
    try {
        const c = localStorage.getItem(STORAGE_CHECKED);
        if (c) state.checkedItems = new Set(JSON.parse(c));
    } catch (e) { state.checkedItems = new Set(); }
}

function saveSelections() {
    localStorage.setItem(STORAGE_SELECTIONS, JSON.stringify(state.selections));
}

function saveChecked() {
    localStorage.setItem(STORAGE_CHECKED, JSON.stringify([...state.checkedItems]));
}

/* Navigation */

function goHome() { state.view = "home"; render(); }

function goSelect(mealType) {
    state.activeMealType = mealType;
    const pool = state.recipes.filter(r => r.mealType === mealType).map(r => r.id);
    state.selectDeck = shuffle([...pool]);
    state.selectIndex = 0;
    state.animating = false;
    state.view = "select";
    render();
}

function goSummary() { state.view = "summary"; render(); }
function goShopping() { state.view = "shopping"; render(); }

function render() {
    const app = document.getElementById("app");
    if (state.view === "home") { app.innerHTML = homeHtml(); wireHome(); }
    else if (state.view === "select") { app.innerHTML = selectHtml(); wireSelect(); }
    else if (state.view === "summary") { app.innerHTML = summaryHtml(); wireSummary(); }
    else if (state.view === "shopping") { app.innerHTML = shoppingHtml(); wireShopping(); }
}

/* ---------- Home view ---------- */

function homeHtml() {
    const totalPlanned = Object.values(state.selections).reduce((a, b) => a + b, 0);

    const cards = MEAL_TYPES.map(m => {
        const count = state.recipes.filter(r => r.mealType === m).length;
        const picked = countPickedForMeal(m);
        return `
            <button type="button" class="meal-type-card" data-meal="${m}">
                <div class="meal-type-icon">${MEAL_LABELS[m].charAt(0)}</div>
                <div class="meal-type-name">${MEAL_LABELS[m]}</div>
                <div class="meal-type-meta">${count} recipe${count === 1 ? "" : "s"} to browse</div>
                ${picked > 0 ? `<div class="meal-type-picked">${picked} in plan</div>` : ""}
            </button>
        `;
    }).join("");

    const planSummary = totalPlanned > 0 ? `
        <div class="home-plan-summary">
            <p class="home-plan-count"><strong>${totalPlanned}</strong> meal${totalPlanned === 1 ? "" : "s"} in this week's plan</p>
            <div class="home-plan-actions">
                <button type="button" class="btn btn-secondary" data-action="view-plan">View plan</button>
                <button type="button" class="btn btn-primary" data-action="shopping">Generate shopping list</button>
            </div>
            <button type="button" class="btn-text" data-action="clear-plan" style="margin-top:12px">Clear plan and start fresh</button>
        </div>
    ` : "";

    return `
        <div class="home">
            <div class="home-header">
                <h1>Recipe Planner</h1>
                <p class="home-question">What are you shopping for?</p>
            </div>
            <div class="meal-type-grid">${cards}</div>
            ${planSummary}
        </div>
    `;
}

function wireHome() {
    document.querySelectorAll(".meal-type-card").forEach(el => {
        el.addEventListener("click", () => goSelect(el.dataset.meal));
    });
    document.querySelectorAll("[data-action]").forEach(el => {
        const a = el.dataset.action;
        if (a === "view-plan") el.addEventListener("click", goSummary);
        else if (a === "shopping") el.addEventListener("click", goShopping);
        else if (a === "clear-plan") el.addEventListener("click", clearPlan);
    });
}

function clearPlan() {
    const total = Object.values(state.selections).reduce((a, b) => a + b, 0);
    if (total === 0) return;
    if (!confirm(`Clear all ${total} meal${total === 1 ? "" : "s"} from your plan?`)) return;
    state.selections = {};
    state.checkedItems.clear();
    saveSelections();
    saveChecked();
    render();
}

/* ---------- Select view ---------- */

function selectHtml() {
    const mealType = state.activeMealType;
    const picked = countPickedForMeal(mealType);
    const deck = state.selectDeck;

    const topbar = `
        <div class="select-topbar">
            <button type="button" class="btn-icon" data-action="home" aria-label="Back home">&larr;</button>
            <div class="select-topbar-center">
                <div class="select-meal-label">${MEAL_LABELS[mealType]}</div>
                <div class="select-running-total ${picked === 0 ? "zero" : ""}">${picked} added</div>
            </div>
            <button type="button" class="btn btn-primary" data-action="summary" style="padding:9px 18px;font-size:14px">Done</button>
        </div>
    `;

    if (deck.length === 0) {
        return `
            <div class="select">
                ${topbar}
                <div class="select-empty">
                    <h2>No ${MEAL_LABELS[mealType].toLowerCase()} recipes yet</h2>
                    <p>Add some to your recipes file.</p>
                    <button type="button" class="btn btn-primary" data-action="home">Back home</button>
                </div>
            </div>
        `;
    }

    if (state.selectIndex >= deck.length) {
        return `
            <div class="select">
                ${topbar}
                <div class="select-empty">
                    <h2>That's all the ${MEAL_LABELS[mealType].toLowerCase()} recipes</h2>
                    <p>You added <strong>${picked}</strong> this session.</p>
                    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
                        <button type="button" class="btn btn-secondary" data-action="home">Back home</button>
                        <button type="button" class="btn btn-primary" data-action="summary">See plan</button>
                    </div>
                </div>
            </div>
        `;
    }

    const id = deck[state.selectIndex];
    const r = state.recipes.find(x => x.id === id);
    const totalMins = (r.prepMins || 0) + (r.cookMins || 0);
    const vibesHtml = (r.vibes || []).slice(0, 3).map(v => `<span class="tag">${escapeHtml(v)}</span>`).join("");
    const yoursHtml = r.source === "user" ? `<span class="tag yours">Yours</span>` : "";
    const currentCount = state.selections[id] || 0;
    const ings = (r.ingredients || []).slice(0, 6).map(i => i.item);
    const moreCount = (r.ingredients || []).length - ings.length;
    const preview = ings.join(", ") + (moreCount > 0 ? `, +${moreCount} more` : "");

    return `
        <div class="select">
            ${topbar}
            <div class="card-stage">
                <div class="swipe-card">
                    ${heroHtml(r)}
                    <div class="swipe-body">
                        <h2 class="swipe-name">${escapeHtml(r.name)}</h2>
                        <div class="swipe-tags">
                            ${yoursHtml}
                            <span class="tag cuisine">${escapeHtml(r.cuisine)}</span>
                            ${vibesHtml}
                        </div>
                        <div class="swipe-meta">${totalMins} min &middot; serves ${r.servings || 1}${currentCount > 0 ? ` &middot; already in plan &times;${currentCount}` : ""}</div>
                        <div class="swipe-ingredients-preview">
                            <strong>Ingredients:</strong> ${escapeHtml(preview)}
                        </div>
                    </div>
                </div>
            </div>
            <div class="swipe-actions">
                <button type="button" class="swipe-action skip" data-action="skip" aria-label="Skip">&times;</button>
                <button type="button" class="swipe-action add" data-action="add" aria-label="Add">&#43;</button>
            </div>
            <div class="swipe-progress">Recipe ${state.selectIndex + 1} of ${deck.length}</div>
            <div class="swipe-shortcuts-hint">
                <kbd>&larr;</kbd> skip &middot; <kbd>&rarr;</kbd> add &middot; <kbd>Esc</kbd> back
            </div>
        </div>
    `;
}

function wireSelect() {
    document.querySelectorAll("[data-action]").forEach(el => {
        const a = el.dataset.action;
        if (a === "home") el.addEventListener("click", goHome);
        else if (a === "summary") el.addEventListener("click", goSummary);
        else if (a === "add") el.addEventListener("click", addCurrent);
        else if (a === "skip") el.addEventListener("click", skipCurrent);
    });
}

function addCurrent() {
    if (state.animating) return;
    const id = state.selectDeck[state.selectIndex];
    if (!id) return;
    state.selections[id] = (state.selections[id] || 0) + 1;
    saveSelections();
    animateAndAdvance("right");
}

function skipCurrent() {
    if (state.animating) return;
    if (state.selectIndex >= state.selectDeck.length) return;
    animateAndAdvance("left");
}

function animateAndAdvance(direction) {
    const card = document.querySelector(".swipe-card");
    if (!card) { advance(); return; }
    state.animating = true;
    card.classList.add(`swipe-${direction}`);
    setTimeout(() => {
        state.animating = false;
        advance();
    }, 240);
}

function advance() {
    state.selectIndex++;
    render();
}

/* ---------- Summary view ---------- */

function summaryHtml() {
    const picked = Object.entries(state.selections)
        .map(([id, count]) => ({ recipe: state.recipes.find(r => r.id === id), count }))
        .filter(x => x.recipe);
    const total = picked.reduce((s, x) => s + x.count, 0);

    if (picked.length === 0) {
        return `
            <div class="summary">
                <div class="summary-header"><h1>Your plan</h1></div>
                <div class="summary-empty">
                    <p>No meals picked yet.</p>
                    <button type="button" class="btn btn-primary" data-action="home">Start picking</button>
                </div>
            </div>
        `;
    }

    const groups = MEAL_TYPES.map(m => {
        const items = picked.filter(x => x.recipe.mealType === m);
        if (items.length === 0) return "";
        const subtotal = items.reduce((s, x) => s + x.count, 0);
        const itemsHtml = items.map(({ recipe, count }) => `
            <div class="summary-item">
                <div class="summary-item-name" data-action="view" data-id="${recipe.id}">${escapeHtml(recipe.name)}</div>
                <div class="summary-counter">
                    <button type="button" class="summary-counter-btn" data-action="dec" data-id="${recipe.id}">&minus;</button>
                    <span class="summary-counter-value">${count}</span>
                    <button type="button" class="summary-counter-btn" data-action="inc" data-id="${recipe.id}">&#43;</button>
                </div>
                <button type="button" class="summary-remove" data-action="remove" data-id="${recipe.id}" aria-label="Remove">&times;</button>
            </div>
        `).join("");
        return `
            <div class="summary-group">
                <div class="summary-group-header">
                    <h2 class="summary-group-title">${MEAL_LABELS[m]}</h2>
                    <span class="summary-group-count">${subtotal} meal${subtotal === 1 ? "" : "s"}</span>
                </div>
                ${itemsHtml}
            </div>
        `;
    }).join("");

    return `
        <div class="summary">
            <div class="summary-header"><h1>Your plan</h1></div>
            <p class="summary-subtitle">${total} meal${total === 1 ? "" : "s"} &middot; adjust counts, remove any, or add more.</p>
            ${groups}
            <div class="summary-actions">
                <button type="button" class="btn btn-secondary" data-action="home">&#43; Add more meals</button>
                <button type="button" class="btn btn-primary btn-large" data-action="shopping">Generate shopping list &rarr;</button>
            </div>
        </div>
    `;
}

function wireSummary() {
    document.querySelectorAll("[data-action]").forEach(el => {
        const a = el.dataset.action;
        const id = el.dataset.id;
        if (a === "home") el.addEventListener("click", goHome);
        else if (a === "shopping") el.addEventListener("click", goShopping);
        else if (a === "view") el.addEventListener("click", () => openModal(id));
        else if (a === "inc") el.addEventListener("click", () => adjust(id, +1));
        else if (a === "dec") el.addEventListener("click", () => adjust(id, -1));
        else if (a === "remove") el.addEventListener("click", () => removeMeal(id));
    });
}

function adjust(id, delta) {
    const cur = state.selections[id] || 0;
    const next = Math.max(0, cur + delta);
    if (next === 0) delete state.selections[id];
    else state.selections[id] = next;
    saveSelections();
    render();
}

function removeMeal(id) {
    delete state.selections[id];
    saveSelections();
    render();
}

/* ---------- Shopping view ---------- */

function shoppingHtml() {
    const names = uniqueIngredientNames();
    if (names.length === 0) {
        return `
            <div class="shopping">
                <div class="shopping-header"><h1>Shopping list</h1></div>
                <p style="color:var(--text-muted)">Pick some meals first.</p>
                <button type="button" class="btn btn-secondary" data-action="home">Back home</button>
            </div>
        `;
    }
    const alreadyHave = names.filter(n => state.checkedItems.has(n)).length;
    const toBuy = names.length - alreadyHave;
    const grouped = groupBySection(names);
    const listHtml = SECTION_ORDER
        .filter(s => grouped[s] && grouped[s].length > 0)
        .map(s => {
            const items = grouped[s].map(n => {
                const checked = state.checkedItems.has(n);
                return `
                    <div class="shopping-item ${checked ? "checked" : ""}" data-name="${escapeHtml(n)}">
                        <span class="shopping-checkbox">&#10003;</span>
                        <span class="shopping-name">${escapeHtml(n)}</span>
                    </div>
                `;
            }).join("");
            return `
                <div class="shopping-section">
                    <div class="shopping-section-label">${escapeHtml(s)}</div>
                    ${items}
                </div>
            `;
        }).join("");
    return `
        <div class="shopping">
            <div class="shopping-header">
                <h1>Shopping list</h1>
                <p class="shopping-subtitle"><strong>${toBuy}</strong> to buy${alreadyHave > 0 ? ` &middot; ${alreadyHave} already have` : ""}</p>
                <p class="shopping-hint">Tick anything you already have &mdash; it won't be included when you send.</p>
            </div>
            <div class="shopping-items">${listHtml}</div>
            <div class="shopping-actions">
                <button type="button" class="btn btn-secondary" data-action="summary">&larr; Back to plan</button>
                <div style="display:flex;gap:10px">
                    <button type="button" class="btn btn-secondary" data-action="copy" id="copy-btn">Copy</button>
                    <button type="button" class="btn btn-primary" data-action="send">Send by email</button>
                </div>
            </div>
        </div>
    `;
}

function wireShopping() {
    document.querySelectorAll(".shopping-item").forEach(el => {
        el.addEventListener("click", () => toggleChecked(el.dataset.name));
    });
    document.querySelectorAll("[data-action]").forEach(el => {
        const a = el.dataset.action;
        if (a === "summary") el.addEventListener("click", goSummary);
        else if (a === "home") el.addEventListener("click", goHome);
        else if (a === "copy") el.addEventListener("click", copyShoppingList);
        else if (a === "send") el.addEventListener("click", sendShoppingList);
    });
}

function toggleChecked(name) {
    if (state.checkedItems.has(name)) state.checkedItems.delete(name);
    else state.checkedItems.add(name);
    saveChecked();
    render();
}

/* ---------- Shared: ingredients & email ---------- */

function uniqueIngredientNames() {
    const names = new Set();
    for (const id of Object.keys(state.selections)) {
        const r = state.recipes.find(x => x.id === id);
        if (!r) continue;
        for (const ing of r.ingredients || []) {
            const n = (ing.item || "").toLowerCase().trim();
            if (n) names.add(n);
        }
    }
    return [...names].sort();
}

function countPickedForMeal(m) {
    let t = 0;
    for (const [id, c] of Object.entries(state.selections)) {
        const r = state.recipes.find(x => x.id === id);
        if (r && r.mealType === m) t += c;
    }
    return t;
}

function buildShoppingListText() {
    const names = uniqueIngredientNames();
    if (names.length === 0) return null;
    const lines = [];
    lines.push("MEALS THIS WEEK");
    lines.push("");
    for (const m of MEAL_TYPES) {
        const picks = Object.entries(state.selections)
            .map(([id, count]) => ({ recipe: state.recipes.find(r => r.id === id), count }))
            .filter(x => x.recipe && x.recipe.mealType === m);
        if (picks.length === 0) continue;
        lines.push(MEAL_LABELS[m]);
        for (const p of picks) {
            lines.push(p.count > 1 ? `- ${p.recipe.name} x ${p.count}` : `- ${p.recipe.name}`);
        }
        lines.push("");
    }
    lines.push("SHOPPING LIST");
    lines.push("");
    const toBuy = names.filter(n => !state.checkedItems.has(n));
    if (toBuy.length === 0) {
        lines.push("(nothing to buy - you have everything!)");
    } else {
        const grouped = groupBySection(toBuy);
        for (const s of SECTION_ORDER) {
            if (!grouped[s] || grouped[s].length === 0) continue;
            lines.push(s);
            for (const n of grouped[s]) lines.push(`- ${capitalize(n)}`);
            lines.push("");
        }
    }
    return lines.join("\n");
}

async function copyShoppingList() {
    const text = buildShoppingListText();
    if (!text) return;
    const btn = document.getElementById("copy-btn");
    try {
        await navigator.clipboard.writeText(text);
        if (btn) {
            const original = btn.textContent;
            btn.textContent = "Copied!";
            setTimeout(() => { btn.textContent = original; }, 1500);
        }
    } catch (e) {
        alert("Could not copy. Try selecting text manually.");
    }
}

function sendShoppingList() {
    const text = buildShoppingListText();
    if (!text) return;
    const subject = `Shopping list - ${todayIso()}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    state.checkedItems.clear();
    saveChecked();
    render();
}

/* ---------- Modal (recipe details) ---------- */

function openModal(id) {
    const r = state.recipes.find(x => x.id === id);
    if (!r) return;
    const wrap = document.createElement("div");
    wrap.className = "modal";
    const yoursHtml = r.source === "user" ? `<span class="tag yours">Yours</span>` : "";
    const ingHtml = (r.ingredients || []).map(ing =>
        `<li>${formatQty(ing.qty, ing.unit)} ${escapeHtml(ing.item)}</li>`
    ).join("");
    const methodHtml = (r.method || []).map(step => `<li>${escapeHtml(step)}</li>`).join("");
    wrap.innerHTML = `
        <div class="modal-backdrop" data-close></div>
        <div class="modal-content">
            <button class="modal-close" data-close type="button" aria-label="Close">&times;</button>
            <h2>${escapeHtml(r.name)}</h2>
            <div class="modal-meta">${(r.prepMins || 0)} min prep &middot; ${(r.cookMins || 0)} min cook &middot; serves ${r.servings || 1}</div>
            <div class="modal-tags">
                ${yoursHtml}
                <span class="tag cuisine">${escapeHtml(r.cuisine)}</span>
                <span class="tag">${escapeHtml(r.mealType)}</span>
                ${(r.vibes || []).map(v => `<span class="tag">${escapeHtml(v)}</span>`).join("")}
            </div>
            <div class="modal-section">
                <h3>Ingredients</h3>
                <ul>${ingHtml}</ul>
            </div>
            <div class="modal-section">
                <h3>Method</h3>
                <ol>${methodHtml}</ol>
            </div>
        </div>
    `;
    document.body.appendChild(wrap);
    wrap.querySelectorAll("[data-close]").forEach(el =>
        el.addEventListener("click", () => wrap.remove())
    );
}

/* ---------- Utilities ---------- */

function heroHtml(r) {
    if (r.image) {
        return `<div class="swipe-hero" style="background-image:url('${escapeHtml(r.image)}')"></div>`;
    }
    const cuisineKey = (r.cuisine || "any").toLowerCase().replace(/[^a-z]/g, "-");
    const cuisineClass = `hero-${cuisineKey}`;
    const initial = escapeHtml((r.name || "?").charAt(0).toUpperCase());
    return `
        <div class="swipe-hero ${cuisineClass}">
            <div class="swipe-hero-overlay">${initial}</div>
        </div>
    `;
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function formatQty(qty, unit) {
    if (!qty) return unit || "";
    const num = Number.isInteger(qty) ? qty : Number(qty.toFixed(2));
    if (!unit) return `x ${num}`;
    return `${num} ${unit}`;
}

function capitalize(s) {
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ---------- Global keyboard shortcuts ---------- */

document.addEventListener("keydown", (e) => {
    const modal = document.querySelector(".modal");
    if (e.key === "Escape") {
        if (modal) { modal.remove(); return; }
        if (state.view === "shopping") goSummary();
        else if (state.view !== "home") goHome();
        return;
    }
    if (state.view === "select" && !modal && state.selectIndex < state.selectDeck.length) {
        if (e.key === "ArrowLeft") { e.preventDefault(); skipCurrent(); }
        else if (e.key === "ArrowRight") { e.preventDefault(); addCurrent(); }
    }
});

init();
