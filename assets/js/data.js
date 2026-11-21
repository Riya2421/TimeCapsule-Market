/* Seed data. Mirrors the database tables in the project report.
   When the backend is built, this file becomes the SQL seed script. */
window.TC = window.TC || {};

TC.CONFIG = {
  GIFT_WRAP: 49,   // per stage
  STAGE_FEE: 29,   // scheduling and delivery handling, per stage
  MAX_STAGES: 5,
};

TC.SEED = {};

/* table: occasions */
TC.SEED.occasions = [
  { id: 1, slug: "new-home", name: "New home", tagline: "Make four walls feel like home", emoji: "🏡", color: "#0f9d8a", ink: "#ffffff" },
  { id: 2, slug: "first-salary", name: "First salary", tagline: "Celebrate the first payslip", emoji: "💸", color: "#ffb627", ink: "#101a3b" },
  { id: 3, slug: "farewell", name: "Farewell", tagline: "A goodbye worth keeping", emoji: "👋", color: "#7b3fa0", ink: "#ffffff" },
  { id: 4, slug: "long-distance", name: "Long-distance friendship", tagline: "Close, even when far apart", emoji: "📮", color: "#2e86e6", ink: "#ffffff" },
  { id: 5, slug: "anniversary", name: "Wedding anniversary", tagline: "Another year, another chapter", emoji: "💍", color: "#e8548a", ink: "#ffffff" },
  { id: 6, slug: "baby", name: "Baby arrival", tagline: "Welcome the little one", emoji: "🍼", color: "#43a878", ink: "#ffffff" },
  { id: 7, slug: "retirement", name: "Retirement", tagline: "Time, finally their own", emoji: "🌅", color: "#4f5fc4", ink: "#ffffff" },
  { id: 8, slug: "festival", name: "Festivals", tagline: "Diwali, Raksha Bandhan, Eid, Christmas", emoji: "🪔", color: "#e63946", ink: "#ffffff" },
];

/* table: vendors */
TC.SEED.vendors = [
  { id: 1, shop_name: "Chai & Co.", contact_email: "hello@chaiandco.in", city: "Jaipur" },
  { id: 2, shop_name: "Bloom Studio", contact_email: "team@bloomstudio.in", city: "Pune" },
  { id: 3, shop_name: "Paper Trail", contact_email: "orders@papertrail.in", city: "Delhi" },
  { id: 4, shop_name: "Dhaga Handloom", contact_email: "care@dhaga.in", city: "Varanasi" },
  { id: 5, shop_name: "Little Nest", contact_email: "hi@littlenest.in", city: "Bengaluru" },
  { id: 6, shop_name: "Spice Route", contact_email: "sales@spiceroute.in", city: "Kochi" },
  { id: 7, shop_name: "Gadget Lane", contact_email: "support@gadgetlane.in", city: "Noida" },
];

/* table: products (+ product_tags as the tags array) */
TC.SEED.products = [
  { id: 1, vendor_id: 1, name: "Ceramic tea mug set", price: 699, stock: 40, emoji: "🍵", tint: "#d9f1ec", tags: ["tea", "cozy", "home", "kitchen"], blurb: "Two hand-glazed mugs that hold a proper cup of chai." },
  { id: 2, vendor_id: 2, name: "Scented candle trio", price: 499, stock: 60, emoji: "🕯️", tint: "#ffeccc", tags: ["cozy", "home", "wellness", "decor"], blurb: "Sandalwood, jasmine and rain. Soy wax, 20 hours each." },
  { id: 3, vendor_id: 3, name: "Bookmark and journal", price: 349, stock: 80, emoji: "📓", tint: "#e6ebfd", tags: ["books", "stationery", "minimal"], blurb: "A5 dotted journal with a brass bookmark." },
  { id: 4, vendor_id: 5, name: "Walnut wall clock", price: 2499, stock: 12, emoji: "🕰️", tint: "#f0e6da", tags: ["home", "decor", "minimal"], blurb: "Silent sweep movement in a solid walnut frame." },
  { id: 5, vendor_id: 2, name: "Money plant in clay pot", price: 299, stock: 90, emoji: "🪴", tint: "#dcf3e4", tags: ["plants", "home", "decor"], blurb: "Easy to keep, hard to kill. Comes with a saucer." },
  { id: 6, vendor_id: 1, name: "Filter coffee starter kit", price: 899, stock: 35, emoji: "☕", tint: "#efe3d6", tags: ["coffee", "kitchen", "home"], blurb: "Brass tumbler set and 250 g of South Indian blend." },
  { id: 7, vendor_id: 1, name: "Masala chai gift tin", price: 549, stock: 55, emoji: "🫖", tint: "#fde7e9", tags: ["tea", "snacks", "festive", "sweet"], blurb: "Hand-blended masala chai with a steel strainer." },
  { id: 8, vendor_id: 4, name: "Handloom throw blanket", price: 1799, stock: 18, emoji: "🧣", tint: "#e8e0f3", tags: ["cozy", "handmade", "home"], blurb: "Woven cotton throw in indigo and white." },
  { id: 9, vendor_id: 5, name: "Fairy light string", price: 399, stock: 100, emoji: "✨", tint: "#fff1cf", tags: ["decor", "cozy", "home"], blurb: "Ten metres of warm white lights, plug-in." },
  { id: 10, vendor_id: 3, name: "Bamboo desk organiser", price: 749, stock: 30, emoji: "🗂️", tint: "#e3efdb", tags: ["stationery", "minimal", "tech"], blurb: "Pen cups, a phone slot and a drawer for cables." },
  { id: 11, vendor_id: 7, name: "Wireless earbuds", price: 1999, stock: 25, emoji: "🎧", tint: "#dfe6fb", tags: ["tech", "music"], blurb: "24 hours of battery with the case." },
  { id: 12, vendor_id: 7, name: "Mini Bluetooth speaker", price: 1499, stock: 28, emoji: "🔊", tint: "#e6ebfd", tags: ["tech", "music", "fun"], blurb: "Pocket size, loud enough for a hostel corridor." },
  { id: 13, vendor_id: 3, name: "Photo prints, polaroid style", price: 599, stock: 70, emoji: "📸", tint: "#fde7e9", tags: ["photo", "memories", "handmade"], blurb: "Twelve prints from your photos, with white borders." },
  { id: 14, vendor_id: 3, name: "Custom photo frame", price: 699, stock: 45, emoji: "🖼️", tint: "#ffe3ed", tags: ["photo", "memories", "decor", "romantic"], blurb: "Teak frame, engraved with a line of your choice." },
  { id: 15, vendor_id: 3, name: "Handbound travel journal", price: 449, stock: 50, emoji: "📔", tint: "#fff1cf", tags: ["travel", "books", "stationery", "handmade"], blurb: "Recycled paper, stitched spine, pocket for tickets." },
  { id: 16, vendor_id: 3, name: "Luggage tag set", price: 299, stock: 85, emoji: "🏷️", tint: "#dfe6fb", tags: ["travel", "minimal"], blurb: "Three leather tags with a name card slot." },
  { id: 17, vendor_id: 7, name: "Yoga mat", price: 999, stock: 33, emoji: "🧘", tint: "#e3efdb", tags: ["fitness", "wellness"], blurb: "6 mm, non-slip, with a carry strap." },
  { id: 18, vendor_id: 7, name: "Resistance band set", price: 499, stock: 60, emoji: "💪", tint: "#fde7e9", tags: ["fitness"], blurb: "Five levels of resistance and a pouch." },
  { id: 19, vendor_id: 1, name: "Herbal tea sampler", price: 499, stock: 65, emoji: "🌿", tint: "#dcf3e4", tags: ["tea", "wellness", "cozy"], blurb: "Tulsi, chamomile, mint and hibiscus." },
  { id: 20, vendor_id: 5, name: "Ludo royale board game", price: 899, stock: 22, emoji: "🎲", tint: "#fff1cf", tags: ["fun", "gaming"], blurb: "Wooden board, four tokens, one fight guaranteed." },
  { id: 21, vendor_id: 7, name: "XL gaming mouse pad", price: 599, stock: 48, emoji: "🖱️", tint: "#e6ebfd", tags: ["gaming", "tech"], blurb: "Stitched edges and a non-slip base." },
  { id: 22, vendor_id: 6, name: "Dry fruit hamper", price: 1299, stock: 26, emoji: "🥜", tint: "#f0e6da", tags: ["sweet", "snacks", "festive", "classic"], blurb: "Almonds, cashews, pistachios and anjeer." },
  { id: 23, vendor_id: 6, name: "Assorted mithai box", price: 899, stock: 30, emoji: "🍬", tint: "#ffe3ed", tags: ["sweet", "festive", "classic"], blurb: "Eight kinds of sweets, made the day it ships." },
  { id: 24, vendor_id: 4, name: "Hand-painted diya set", price: 449, stock: 75, emoji: "🪔", tint: "#ffeccc", tags: ["festive", "handmade", "decor"], blurb: "Twelve clay diyas, painted by hand." },
  { id: 25, vendor_id: 4, name: "Banarasi silk stole", price: 1599, stock: 14, emoji: "🧶", tint: "#e8e0f3", tags: ["handmade", "classic", "festive"], blurb: "Woven in Varanasi with a zari border." },
  { id: 26, vendor_id: 5, name: "Baby swaddle set", price: 899, stock: 38, emoji: "🍼", tint: "#dcf3e4", tags: ["kids", "cozy"], blurb: "Three organic cotton muslin swaddles." },
  { id: 27, vendor_id: 5, name: "Soft elephant toy", price: 549, stock: 44, emoji: "🐘", tint: "#e6ebfd", tags: ["kids", "fun"], blurb: "Machine washable, stitched eyes." },
  { id: 28, vendor_id: 5, name: "Baby keepsake box", price: 1199, stock: 20, emoji: "📦", tint: "#fff1cf", tags: ["kids", "memories", "handmade"], blurb: "A wooden box for the first curl, first shoe, first card." },
  { id: 29, vendor_id: 1, name: "Couple mugs set", price: 799, stock: 36, emoji: "🥂", tint: "#ffe3ed", tags: ["romantic", "home", "tea"], blurb: "His and hers, with a little heart on the handle." },
  { id: 30, vendor_id: 3, name: "Anniversary scrapbook", price: 699, stock: 27, emoji: "📖", tint: "#fde7e9", tags: ["romantic", "memories", "photo", "handmade"], blurb: "Blank pages, photo corners and a ribbon." },
  { id: 31, vendor_id: 2, name: "Soap and bath set", price: 799, stock: 42, emoji: "🧼", tint: "#dfe6fb", tags: ["skincare", "wellness", "cozy"], blurb: "Four handmade soaps and a bath salt jar." },
  { id: 32, vendor_id: 2, name: "Face care kit", price: 1099, stock: 31, emoji: "🧴", tint: "#fde7e9", tags: ["skincare", "wellness"], blurb: "Cleanser, serum and moisturiser in travel sizes." },
  { id: 33, vendor_id: 3, name: "Regional recipes cookbook", price: 599, stock: 40, emoji: "📚", tint: "#fff1cf", tags: ["books", "kitchen"], blurb: "120 recipes from nine states." },
  { id: 34, vendor_id: 5, name: "Cast-iron skillet", price: 1399, stock: 16, emoji: "🍳", tint: "#e3e6ee", tags: ["kitchen", "home"], blurb: "Pre-seasoned. Gets better every year." },
  { id: 35, vendor_id: 3, name: "Watercolour set", price: 899, stock: 29, emoji: "🎨", tint: "#e8e0f3", tags: ["art", "hobby", "wellness"], blurb: "24 pans, two brushes and a pad." },
  { id: 36, vendor_id: 2, name: "Windowsill garden kit", price: 1099, stock: 24, emoji: "🌱", tint: "#dcf3e4", tags: ["plants", "hobby", "wellness"], blurb: "Tulsi, mint and coriander seeds with pots." },
  { id: 37, vendor_id: 5, name: "Reading lamp", price: 1299, stock: 21, emoji: "💡", tint: "#fff1cf", tags: ["books", "home", "cozy", "minimal"], blurb: "Warm light, three brightness levels, USB powered." },
  { id: 38, vendor_id: 3, name: "Letter-writing kit", price: 499, stock: 60, emoji: "✉️", tint: "#e6ebfd", tags: ["stationery", "memories", "handmade", "romantic"], blurb: "Paper, envelopes, wax seal and a postage stamp set." },
  { id: 39, vendor_id: 4, name: "Friendship bracelet set", price: 299, stock: 95, emoji: "📿", tint: "#ffe3ed", tags: ["handmade", "fun", "memories"], blurb: "Four woven bracelets, two to keep and two to send." },
  { id: 40, vendor_id: 7, name: "Ukulele starter", price: 2799, stock: 9, emoji: "🎸", tint: "#ffeccc", tags: ["music", "fun", "hobby"], blurb: "Soprano ukulele with a bag and a tuner." },
];

/* table: collections (+ collection_items as productIds) */
TC.SEED.collections = [
  { id: 1, occasion_id: 1, title: "First night in the new place", blurb: "Light, plants and something warm for the first evening.", productIds: [2, 5, 9, 1, 8] },
  { id: 2, occasion_id: 1, title: "Kitchen warm-up", blurb: "Everything to cook the first meal.", productIds: [34, 33, 7, 1] },
  { id: 3, occasion_id: 1, title: "Small space starter", blurb: "Three small things that change a room.", productIds: [2, 9, 5] },
  { id: 4, occasion_id: 2, title: "Treat yourself right", blurb: "For the person who just got paid.", productIds: [11, 10, 3, 19] },
  { id: 5, occasion_id: 2, title: "Thank you, Amma and Papa", blurb: "The first gift from the first salary.", productIds: [22, 25, 23] },
  { id: 6, occasion_id: 3, title: "Remember us", blurb: "Small things to carry from the old team.", productIds: [38, 13, 3, 39] },
  { id: 7, occasion_id: 3, title: "Next chapter kit", blurb: "For a new city and a new desk.", productIds: [15, 16, 3, 10] },
  { id: 8, occasion_id: 4, title: "Same chai, different city", blurb: "Drink the same thing, call at the same time.", productIds: [1, 7, 38, 13] },
  { id: 9, occasion_id: 4, title: "Open when you miss me", blurb: "Things to open on the hard days.", productIds: [38, 13, 39, 14] },
  { id: 10, occasion_id: 5, title: "Years together", blurb: "For the ones who stayed.", productIds: [30, 14, 29, 2] },
  { id: 11, occasion_id: 6, title: "Welcome home, little one", blurb: "Soft things for the first weeks.", productIds: [26, 27, 28] },
  { id: 12, occasion_id: 7, title: "Time of your own", blurb: "Hobbies they never had time for.", productIds: [35, 36, 37, 19] },
  { id: 13, occasion_id: 8, title: "The Diwali box", blurb: "Lights, sweets and a little luxury.", productIds: [24, 23, 22, 9] },
];

/* tables: quiz_questions + quiz_options. Each option carries a tag, an occasion or a budget. */
TC.SEED.quiz = [
  { id: 1, question: "Who is this for?", options: [
    { id: 11, text: "A friend", tag: "fun" },
    { id: 12, text: "My partner", tag: "romantic" },
    { id: 13, text: "A parent or elder", tag: "classic" },
    { id: 14, text: "A colleague", tag: "minimal" },
  ] },
  { id: 2, question: "How do they spend a free weekend?", options: [
    { id: 21, text: "Reading", tag: "books" },
    { id: 22, text: "Cooking", tag: "kitchen" },
    { id: 23, text: "Gaming", tag: "gaming" },
    { id: 24, text: "Out and about", tag: "travel" },
    { id: 25, text: "Working out", tag: "fitness" },
    { id: 26, text: "Resting at home", tag: "cozy" },
  ] },
  { id: 3, question: "Which sounds most like them?", options: [
    { id: 31, text: "Warm and cozy", tag: "cozy" },
    { id: 32, text: "Clean and modern", tag: "minimal" },
    { id: 33, text: "Handmade and personal", tag: "handmade" },
    { id: 34, text: "Bright and festive", tag: "festive" },
    { id: 35, text: "Into gadgets", tag: "tech" },
  ] },
  { id: 4, question: "What do they like to sip?", options: [
    { id: 41, text: "Chai or tea", tag: "tea" },
    { id: 42, text: "Coffee", tag: "coffee" },
    { id: 43, text: "Neither, they prefer herbal or water", tag: "wellness" },
  ] },
  { id: 5, question: "What is the occasion?", options: [
    { id: 51, text: "New home", occasion_id: 1 },
    { id: 52, text: "First salary", occasion_id: 2 },
    { id: 53, text: "Farewell", occasion_id: 3 },
    { id: 54, text: "Long-distance friendship", occasion_id: 4 },
    { id: 55, text: "Wedding anniversary", occasion_id: 5 },
    { id: 56, text: "Baby arrival", occasion_id: 6 },
    { id: 57, text: "Retirement", occasion_id: 7 },
    { id: 58, text: "A festival", occasion_id: 8 },
  ] },
  { id: 6, question: "What is your budget for the whole capsule?", options: [
    { id: 61, text: "Up to ₹1,500", budget: 1500 },
    { id: 62, text: "Up to ₹2,500", budget: 2500 },
    { id: 63, text: "Up to ₹4,000", budget: 4000 },
    { id: 64, text: "Up to ₹6,000", budget: 6000 },
  ] },
];

/* demo accounts (passwords are plain text only because this is a front-end mock) */
TC.SEED.users = [
  { id: 1, name: "Aarav Mehta", email: "demo@timecapsule.in", password: "demo123", role: "customer" },
  { id: 2, name: "Store Admin", email: "admin@timecapsule.in", password: "admin123", role: "admin" },
];
