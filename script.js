const STORAGE_SELECTIONS = "recipe-planner-selections-v3";
const STORAGE_CHECKED = "recipe-planner-checked-v3";
const STORAGE_PEOPLE = "recipe-planner-people-v1";

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
    ["Oils, sauces & condiments", ["olive oil", "sesame oil", "vegetable oil", "sunflower oil", "rapeseed oil", "peanut butter", "curry paste", "soy sauce", "fish sauce", "oyster sauce", "black bean sauce", "worcestershire sauce", "chicken stock", "chicken broth", "beef stock", "beef broth", "vegetable stock", "vegetable broth"]],
    ["Tins & jars", ["baked bean", "tinned", "canned", "kalamata olive", "black olive", "green olive", "coconut milk", "tomato puree", "passata"]],
    ["Bakery", ["pitta", "tortilla", "wrap", "sourdough", "bagel", "baguette", "flatbread", "bread"]],
    ["Fruit & veg", ["fresh mint", "fresh coriander", "fresh basil", "fresh thyme", "fresh parsley", "fresh dill", "fresh rosemary", "thai basil"]],
    ["Fruit & veg", ["baby gem", "baby spinach", "baby corn", "cherry tomato", "spring onion", "red onion", "red pepper", "green bean", "chestnut mushroom", "romaine lettuce", "garlic clove", "garlic bulb", "celery stick", "new potato", "red chilli", "green chilli", "chilli pepper"]],
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

function groupBySection(items) {
    const groups = {};
    for (const item of items) {
        const s = classifyIngredient(item.name);
        if (!groups[s]) groups[s] = [];
        groups[s].push(item);
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
    peopleCount: 2,
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
    try {
        const p = localStorage.getItem(STORAGE_PEOPLE);
        const parsed = parseInt(p, 10);
        if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 12) state.peopleCount = parsed;
    } catch (e) {}
}

function savePeople() {
    localStorage.setItem(STORAGE_PEOPLE, String(state.peopleCount));
}

function adjustPeople(delta) {
    const next = Math.max(1, Math.min(12, state.peopleCount + delta));
    if (next === state.peopleCount) return;
    state.peopleCount = next;
    savePeople();
    render();
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
function goBrowse(mealType) {
    state.activeMealType = mealType;
    state.view = "browse";
    render();
}

function render() {
    const app = document.getElementById("app");
    let viewHtml = "";
    let wireFn = null;
    if (state.view === "home") { viewHtml = homeHtml(); wireFn = wireHome; }
    else if (state.view === "select") { viewHtml = selectHtml(); wireFn = wireSelect; }
    else if (state.view === "browse") { viewHtml = browseHtml(); wireFn = wireBrowse; }
    else if (state.view === "summary") { viewHtml = summaryHtml(); wireFn = wireSummary; }
    else if (state.view === "shopping") { viewHtml = shoppingHtml(); wireFn = wireShopping; }
    app.innerHTML = peopleBannerHtml() + viewHtml;
    wirePeopleBanner();
    if (wireFn) wireFn();
}

/* ---------- People banner (persistent across pages) ---------- */

function peopleBannerHtml() {
    const n = state.peopleCount;
    return `
        <div class="people-banner">
            <span class="people-banner-label">Cooking for</span>
            <div class="people-stepper">
                <button type="button" class="people-stepper-btn" data-action="people-dec" aria-label="Fewer people">&minus;</button>
                <span class="people-stepper-value">${n}</span>
                <button type="button" class="people-stepper-btn" data-action="people-inc" aria-label="More people">&#43;</button>
            </div>
            <span class="people-banner-label">${n === 1 ? "person" : "people"}</span>
        </div>
    `;
}

function wirePeopleBanner() {
    document.querySelectorAll('[data-action="people-inc"]').forEach(el => {
        el.addEventListener("click", (e) => { e.stopPropagation(); adjustPeople(+1); });
    });
    document.querySelectorAll('[data-action="people-dec"]').forEach(el => {
        el.addEventListener("click", (e) => { e.stopPropagation(); adjustPeople(-1); });
    });
}

/* ---------- Shared page header ---------- */

function pageHeaderHtml(centerHtml = "", rightHtml = "") {
    return `
        <div class="page-header">
            <button type="button" class="page-header-home-btn" data-action="home" aria-label="Home">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 3l9 8h-3v10h-4v-6h-4v6h-4v-10h-3z"/>
                </svg>
                <span>Home</span>
            </button>
            <div class="page-header-center">${centerHtml}</div>
            <div class="page-header-right">${rightHtml}</div>
        </div>
    `;
}

/* ---------- Home view ---------- */

function homeHtml() {
    const totalPlanned = Object.values(state.selections).reduce((a, b) => a + b, 0);

    const cards = MEAL_TYPES.map(m => {
        const count = state.recipes.filter(r => r.mealType === m).length;
        const picked = countPickedForMeal(m);
        return `
            <div class="meal-type-card" data-action="swipe" data-meal="${m}" role="button" tabindex="0">
                <div class="meal-type-icon">${MEAL_LABELS[m].charAt(0)}</div>
                <div class="meal-type-name">${MEAL_LABELS[m]}</div>
                <div class="meal-type-meta">${count} recipe${count === 1 ? "" : "s"}</div>
                ${picked > 0 ? `<div class="meal-type-picked">${picked} in plan</div>` : ""}
                <button type="button" class="meal-type-browse-link" data-action="browse-meal" data-meal="${m}">Browse all &rarr;</button>
            </div>
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
    document.querySelectorAll("[data-action]").forEach(el => {
        const a = el.dataset.action;
        const meal = el.dataset.meal;
        if (a === "view-plan") el.addEventListener("click", goSummary);
        else if (a === "shopping") el.addEventListener("click", goShopping);
        else if (a === "clear-plan") el.addEventListener("click", clearPlan);
        else if (a === "swipe") el.addEventListener("click", () => goSelect(meal));
        else if (a === "browse-meal") el.addEventListener("click", (e) => {
            e.stopPropagation();
            goBrowse(meal);
        });
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

    const centerHtml = `
        <div class="select-meal-label">${MEAL_LABELS[mealType]}</div>
        <div class="select-running-total ${picked === 0 ? "zero" : ""}">${picked} added</div>
    `;
    const rightHtml = `
        <button type="button" class="btn btn-primary" data-action="summary" style="padding:9px 18px;font-size:14px">Done</button>
    `;
    const topbar = pageHeaderHtml(centerHtml, rightHtml);

    if (deck.length === 0) {
        return `
            ${topbar}
            <div class="select">
                <div class="select-empty">
                    <h2>No ${MEAL_LABELS[mealType].toLowerCase()} recipes yet</h2>
                    <p>Add some to your recipes file.</p>
                </div>
            </div>
        `;
    }

    if (state.selectIndex >= deck.length) {
        return `
            ${topbar}
            <div class="select">
                <div class="select-empty">
                    <h2>That's all the ${MEAL_LABELS[mealType].toLowerCase()} recipes</h2>
                    <p>You added <strong>${picked}</strong> this session.</p>
                    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
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
        ${topbar}
        <div class="select">
            <div class="card-stage">
                <div class="swipe-card">
                    <div class="swipe-tint swipe-tint-add"></div>
                    <div class="swipe-tint swipe-tint-skip"></div>
                    <div class="swipe-indicator swipe-indicator-add">&#10003;</div>
                    <div class="swipe-indicator swipe-indicator-skip">&times;</div>
                    ${heroHtml(r)}
                    <div class="swipe-body">
                        <h2 class="swipe-name">${escapeHtml(r.name)}</h2>
                        <div class="swipe-tags">
                            ${yoursHtml}
                            <span class="tag cuisine">${escapeHtml(r.cuisine)}</span>
                            ${vibesHtml}
                        </div>
                        <div class="swipe-meta">${totalMins} min &middot; for ${state.peopleCount} ${state.peopleCount === 1 ? "person" : "people"}${currentCount > 0 ? ` &middot; already in plan &times;${currentCount}` : ""}</div>
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
    attachSwipe(document.querySelector(".swipe-card"));
}

function attachSwipe(cardEl) {
    if (!cardEl) return;
    let startX = 0, startY = 0;
    let currentX = 0;
    let dragging = false;
    let horizontal = false;
    const addIndicator = cardEl.querySelector(".swipe-indicator-add");
    const skipIndicator = cardEl.querySelector(".swipe-indicator-skip");
    const addTint = cardEl.querySelector(".swipe-tint-add");
    const skipTint = cardEl.querySelector(".swipe-tint-skip");
    const THRESHOLD = 100;

    const setIndicators = (dx) => {
        const addStrength = dx > 0 ? Math.min(1, dx / THRESHOLD) : 0;
        const skipStrength = dx < 0 ? Math.min(1, Math.abs(dx) / THRESHOLD) : 0;
        if (addIndicator) addIndicator.style.opacity = String(addStrength);
        if (skipIndicator) skipIndicator.style.opacity = String(skipStrength);
        if (addTint) addTint.style.opacity = String(addStrength * 0.7);
        if (skipTint) skipTint.style.opacity = String(skipStrength * 0.7);
    };

    const getPoint = (e) => e.touches ? e.touches[0] : (e.changedTouches ? e.changedTouches[0] : e);

    const resetCard = () => {
        cardEl.style.transition = "transform 0.2s ease-out, opacity 0.2s ease-out";
        cardEl.style.transform = "";
        cardEl.style.opacity = "";
        setIndicators(0);
    };

    const onStart = (e) => {
        if (state.animating) return;
        const p = getPoint(e);
        startX = p.clientX;
        startY = p.clientY;
        currentX = 0;
        dragging = true;
        horizontal = false;
        cardEl.style.transition = "none";
    };

    const onMove = (e) => {
        if (!dragging) return;
        const p = getPoint(e);
        const dx = p.clientX - startX;
        const dy = p.clientY - startY;
        if (!horizontal) {
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
            horizontal = Math.abs(dx) > Math.abs(dy);
            if (!horizontal) { dragging = false; resetCard(); return; }
        }
        if (horizontal && e.cancelable) e.preventDefault();
        currentX = dx;
        cardEl.style.transform = `translateX(${dx}px) rotate(${dx / 25}deg)`;
        setIndicators(dx);
    };

    const onEnd = () => {
        if (!dragging) return;
        dragging = false;
        const threshold = 100;
        if (currentX > threshold) addCurrent();
        else if (currentX < -threshold) skipCurrent();
        else resetCard();
    };

    cardEl.addEventListener("touchstart", onStart, { passive: true });
    cardEl.addEventListener("touchmove", onMove, { passive: false });
    cardEl.addEventListener("touchend", onEnd);
    cardEl.addEventListener("touchcancel", onEnd);
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
    const indicator = card.querySelector(direction === "right" ? ".swipe-indicator-add" : ".swipe-indicator-skip");
    if (indicator) indicator.style.opacity = "1";
    const tint = card.querySelector(direction === "right" ? ".swipe-tint-add" : ".swipe-tint-skip");
    if (tint) tint.style.opacity = "0.7";
    void card.offsetWidth;
    card.style.transition = "transform 0.24s ease-out, opacity 0.24s ease-out";
    card.style.transform = direction === "right"
        ? "translateX(120%) rotate(10deg)"
        : "translateX(-120%) rotate(-10deg)";
    card.style.opacity = "0";
    setTimeout(() => {
        state.animating = false;
        advance();
    }, 240);
}

function advance() {
    state.selectIndex++;
    render();
}

/* ---------- Browse view ---------- */

function browseHtml() {
    const mealType = state.activeMealType;
    const recipes = state.recipes.filter(r => r.mealType === mealType);
    const picked = countPickedForMeal(mealType);

    const centerHtml = `
        <div class="select-meal-label">Browse ${MEAL_LABELS[mealType]}</div>
        <div class="select-running-total ${picked === 0 ? "zero" : ""}">${picked} added</div>
    `;
    const rightHtml = `
        <button type="button" class="btn btn-primary" data-action="summary" style="padding:9px 18px;font-size:14px">Done</button>
    `;

    if (recipes.length === 0) {
        return `
            ${pageHeaderHtml(centerHtml, rightHtml)}
            <div class="browse">
                <div class="select-empty">
                    <h2>No ${MEAL_LABELS[mealType].toLowerCase()} recipes yet</h2>
                    <p>Add some to your recipes file.</p>
                </div>
            </div>
        `;
    }

    const cardsHtml = recipes.map(r => {
        const count = state.selections[r.id] || 0;
        const selected = count > 0;
        const cuisineKey = (r.cuisine || "any").toLowerCase().replace(/[^a-z]/g, "-");
        const totalMins = (r.prepMins || 0) + (r.cookMins || 0);
        const yoursHtml = r.source === "user" ? `<span class="tag yours">Yours</span>` : "";
        const vibesHtml = (r.vibes || []).slice(0, 2).map(v => `<span class="tag">${escapeHtml(v)}</span>`).join("");
        const countBadge = count > 0
            ? `<div class="browse-card-count">&#10003;${count > 1 ? " &times;" + count : ""}</div>`
            : "";
        return `
            <button type="button" class="browse-card ${selected ? "selected" : ""}" data-action="toggle" data-id="${r.id}">
                <div class="browse-card-hero hero-${cuisineKey}">
                    ${countBadge}
                </div>
                <div class="browse-card-body">
                    <div class="browse-card-name">${escapeHtml(r.name)}</div>
                    <div class="browse-card-meta">${totalMins} min &middot; for ${state.peopleCount} ${state.peopleCount === 1 ? "person" : "people"}</div>
                    <div class="browse-card-tags">
                        ${yoursHtml}
                        <span class="tag cuisine">${escapeHtml(r.cuisine)}</span>
                        ${vibesHtml}
                    </div>
                </div>
            </button>
        `;
    }).join("");

    return `
        ${pageHeaderHtml(centerHtml, rightHtml)}
        <div class="browse">
            <p class="browse-hint">Tap a recipe to add it. Tap again to remove.</p>
            <div class="browse-grid">${cardsHtml}</div>
        </div>
    `;
}

function wireBrowse() {
    document.querySelectorAll("[data-action]").forEach(el => {
        const a = el.dataset.action;
        if (a === "home") el.addEventListener("click", goHome);
        else if (a === "summary") el.addEventListener("click", goSummary);
        else if (a === "toggle") el.addEventListener("click", () => toggleBrowseSelection(el.dataset.id));
    });
}

function toggleBrowseSelection(id) {
    const cur = state.selections[id] || 0;
    if (cur > 0) delete state.selections[id];
    else state.selections[id] = 1;
    saveSelections();
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
            ${pageHeaderHtml()}
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
        const itemsHtml = items.map(({ recipe, count }) => {
            const cuisineKey = (recipe.cuisine || "any").toLowerCase().replace(/[^a-z]/g, "-");
            const totalMins = (recipe.prepMins || 0) + (recipe.cookMins || 0);
            return `
                <div class="summary-tile" data-action="view" data-id="${recipe.id}" role="button" tabindex="0">
                    <div class="summary-tile-accent hero-${cuisineKey}"></div>
                    <div class="summary-tile-main">
                        <div class="summary-tile-name-row">
                            <h3 class="summary-tile-name">${escapeHtml(recipe.name)}</h3>
                            ${count > 1 ? `<span class="summary-tile-count-badge">&times;${count}</span>` : ""}
                        </div>
                        <div class="summary-tile-meta">${totalMins} min</div>
                    </div>
                    <div class="summary-tile-controls">
                        <div class="summary-counter">
                            <button type="button" class="summary-counter-btn" data-action="dec" data-id="${recipe.id}">&minus;</button>
                            <span class="summary-counter-value">${count}</span>
                            <button type="button" class="summary-counter-btn" data-action="inc" data-id="${recipe.id}">&#43;</button>
                        </div>
                        <button type="button" class="summary-remove" data-action="remove" data-id="${recipe.id}" aria-label="Remove">&times;</button>
                    </div>
                </div>
            `;
        }).join("");
        return `
            <div class="summary-group">
                <div class="summary-group-header">
                    <h2 class="summary-group-title">${MEAL_LABELS[m]}</h2>
                    <span class="summary-group-count">${subtotal} meal${subtotal === 1 ? "" : "s"}</span>
                </div>
                <div class="summary-tiles">${itemsHtml}</div>
            </div>
        `;
    }).join("");

    return `
        ${pageHeaderHtml()}
        <div class="summary">
            <div class="summary-header"><h1>Your plan</h1></div>
            <p class="summary-subtitle">${total} meal${total === 1 ? "" : "s"} &middot; adjust counts or remove any.</p>
            ${groups}
            <div class="summary-actions" style="justify-content:center">
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
        else if (a === "inc") el.addEventListener("click", (e) => { e.stopPropagation(); adjust(id, +1); });
        else if (a === "dec") el.addEventListener("click", (e) => { e.stopPropagation(); adjust(id, -1); });
        else if (a === "remove") el.addEventListener("click", (e) => { e.stopPropagation(); removeMeal(id); });
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
    const items = aggregateIngredients();
    if (items.length === 0) {
        return `
            ${pageHeaderHtml()}
            <div class="shopping">
                <div class="shopping-header"><h1>Shopping list</h1></div>
                <p style="color:var(--text-muted)">Pick some meals first.</p>
            </div>
        `;
    }
    const alreadyHave = items.filter(i => state.checkedItems.has(i.name)).length;
    const toBuy = items.length - alreadyHave;
    const grouped = groupBySection(items);
    const listHtml = SECTION_ORDER
        .filter(s => grouped[s] && grouped[s].length > 0)
        .map(s => {
            const itemsInSection = grouped[s].map(item => {
                const checked = state.checkedItems.has(item.name);
                const qtyText = formatAggregateQty(item.byUnit);
                return `
                    <div class="shopping-item ${checked ? "checked" : ""}" data-name="${escapeHtml(item.name)}">
                        <span class="shopping-checkbox">&#10003;</span>
                        <span class="shopping-name">${escapeHtml(item.name)}${qtyText ? ` <span class="shopping-qty">(${escapeHtml(qtyText)})</span>` : ""}</span>
                    </div>
                `;
            }).join("");
            return `
                <div class="shopping-section">
                    <div class="shopping-section-label">${escapeHtml(s)}</div>
                    ${itemsInSection}
                </div>
            `;
        }).join("");
    return `
        ${pageHeaderHtml()}
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

function aggregateIngredients() {
    const map = new Map();
    for (const [id, count] of Object.entries(state.selections)) {
        const r = state.recipes.find(x => x.id === id);
        if (!r) continue;
        for (const ing of r.ingredients || []) {
            const name = (ing.item || "").toLowerCase().trim();
            if (!name) continue;
            const unit = (ing.unit || "").trim();
            const qty = (Number(ing.qty) || 0) * count * state.peopleCount;
            if (!map.has(name)) map.set(name, { name, byUnit: {} });
            const entry = map.get(name);
            entry.byUnit[unit] = (entry.byUnit[unit] || 0) + qty;
        }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function formatAggregateQty(byUnit) {
    const parts = [];
    for (const [unit, qty] of Object.entries(byUnit)) {
        if (!qty) continue;
        const num = Number.isInteger(qty) ? qty : Number(qty.toFixed(2));
        parts.push(unit ? `${num} ${unit}` : `${num}`);
    }
    return parts.join(" + ");
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
    const items = aggregateIngredients();
    if (items.length === 0) return null;
    const lines = [];
    lines.push(`MEALS THIS WEEK (for ${state.peopleCount} ${state.peopleCount === 1 ? "person" : "people"})`);
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
    const toBuy = items.filter(i => !state.checkedItems.has(i.name));
    if (toBuy.length === 0) {
        lines.push("(nothing to buy - you have everything!)");
    } else {
        const grouped = groupBySection(toBuy);
        for (const s of SECTION_ORDER) {
            if (!grouped[s] || grouped[s].length === 0) continue;
            lines.push(s);
            for (const item of grouped[s]) {
                const qtyText = formatAggregateQty(item.byUnit);
                lines.push(qtyText ? `- ${capitalize(item.name)} (${qtyText})` : `- ${capitalize(item.name)}`);
            }
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
    const scale = state.peopleCount;
    const ingHtml = (r.ingredients || []).map(ing =>
        `<li>${formatQty((Number(ing.qty) || 0) * scale, ing.unit)} ${escapeHtml(ing.item)}</li>`
    ).join("");
    const methodHtml = (r.method || []).map(step => `<li>${escapeHtml(step)}</li>`).join("");
    wrap.innerHTML = `
        <div class="modal-backdrop" data-close></div>
        <div class="modal-content">
            <button class="modal-close" data-close type="button" aria-label="Close">&times;</button>
            <h2>${escapeHtml(r.name)}</h2>
            <div class="modal-meta">${(r.prepMins || 0)} min prep &middot; ${(r.cookMins || 0)} min cook &middot; scaled for ${scale} ${scale === 1 ? "person" : "people"}</div>
            <div class="modal-tags">
                ${yoursHtml}
                <span class="tag cuisine">${escapeHtml(r.cuisine)}</span>
                <span class="tag">${escapeHtml(r.mealType)}</span>
                ${(r.vibes || []).map(v => `<span class="tag">${escapeHtml(v)}</span>`).join("")}
            </div>
            <div class="modal-section">
                <h3>Method</h3>
                <ol>${methodHtml}</ol>
            </div>
            <div class="modal-section">
                <h3>Ingredients</h3>
                <ul>${ingHtml}</ul>
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
