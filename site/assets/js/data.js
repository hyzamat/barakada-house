// Restaurant content. Edit prices, copy and contact details here.
import { CLIPS } from './media.js';

export const INFO = {
  address: 'Your street address<br>Riyadh, Saudi Arabia',
  hours: 'Open daily &middot; 12:00 &ndash; 00:00<br>Kitchen closes 23:30',
  phone: '+966 50 000 0000',
  email: 'hello@example.com',
  // Digits only, with country code. Used for the "Send request" button on bookings.
  whatsapp: '966500000000',
  social: [
    ['Instagram', 'https://instagram.com/'],
    ['Facebook', 'https://facebook.com/'],
    ['TikTok', 'https://tiktok.com/'],
  ],
};

export const CATEGORIES = [
  ['all', 'All'],
  ['inihaw', 'Inihaw', 'Grill'],
  ['sabaw', 'Sabaw', 'Soups'],
  ['ulam', 'Ulam', 'Mains'],
  ['dagat', 'Dagat', 'Seafood'],
  ['pansit', 'Pansit & Gulay', 'Noodles & veg'],
];

// cover: clip number used on menu cards. plate: clip number used on round plates.
export const DISHES = [
  {
    id: 'crispy-pata', name: 'Crispy Beef Pata', local: 'Pritong pata ng baka', cats: ['ulam'],
    price: 89, serves: '3–5', spice: 0, tags: ['Signature', 'Best seller'], cover: 5, plate: 5,
    short: 'Twice-cooked beef shank, shatter-crisp crust.',
    desc: 'Beef shank simmered for hours with star anise, bay leaf and peppercorn, air-dried until taut, then fried until the crust blisters and crackles. Tender to the bone, served with spiced soy-vinegar sawsawan.',
    ings: ['Beef shank', 'Star anise', 'Bay leaf', 'Garlic', 'Peppercorn', 'Soy-vinegar dip'],
    pairs: ['sinigang', 'kare-kare'],
  },
  {
    id: 'kare-kare', name: 'Kare-Kare', local: 'Oxtail sa mani', cats: ['ulam'],
    price: 79, serves: '3–4', spice: 0, tags: ['Signature'], cover: 7, plate: 7,
    short: 'Oxtail in a velvet toasted-peanut sauce.',
    desc: 'Oxtail braised until it falls from the bone, folded into a sauce of toasted ground peanuts and achuete, with eggplant, sitaw and pechay. Served with sautéed bagoong on the side, the way lola insisted.',
    ings: ['Oxtail', 'Toasted peanut', 'Achuete', 'Eggplant', 'String beans', 'Pechay', 'Bagoong'],
    pairs: ['crispy-pata', 'pancit'],
  },
  {
    id: 'bulalo', name: 'Bulalo', local: 'Beef shank & marrow soup', cats: ['sabaw'],
    price: 72, serves: '3–4', spice: 0, tags: ['Best seller', 'For sharing'], cover: 11, plate: 10,
    short: 'Bone-marrow broth, simmered for hours.',
    desc: 'Thick-cut beef shank, marrow bone and all, simmered low until the broth turns gold. Finished with sweet corn, cabbage, baby bok choy and a shower of spring onions. Bring a spoon for the marrow.',
    ings: ['Beef shank', 'Marrow bone', 'Sweet corn', 'Cabbage', 'Bok choy', 'Spring onion', 'Peppercorn'],
    pairs: ['inasal', 'crispy-pata'],
  },
  {
    id: 'inasal', name: 'Chicken Inasal', local: 'Bacolod-style inihaw', cats: ['inihaw'],
    price: 38, serves: '1', spice: 1, tags: ['Charcoal-grilled'], cover: 8, plate: 8,
    short: 'Calamansi, lemongrass & achuete over charcoal.',
    desc: 'Leg quarters steeped overnight in calamansi, lemongrass, ginger and cane vinegar, grilled over uling and basted in achuete oil until the skin lacquers. Served on banana leaf with calamansi and sinamak.',
    ings: ['Chicken leg quarter', 'Calamansi', 'Lemongrass', 'Ginger', 'Achuete oil', 'Siling labuyo'],
    pairs: ['bulalo', 'chopsuey'],
  },
  {
    id: 'kaldereta', name: 'Beef Kaldereta', local: 'Tomato-braised beef stew', cats: ['ulam'],
    price: 69, serves: '2–3', spice: 1, tags: ['Cheese pull'], cover: 5, plate: 2,
    short: 'Braised beef, olives, peppers, melted cheese.',
    desc: 'Beef chuck seared hard, then braised in a rich tomato and liver sauce with bell peppers, green olives, potatoes and carrots, finished under a molten blanket of cheese.',
    ings: ['Beef chuck', 'Tomato', 'Bell pepper', 'Green olives', 'Potato', 'Carrot', 'Cheese'],
    pairs: ['pancit', 'butterfish'],
  },
  {
    id: 'sinigang', name: 'Sinigang na Beef Ribs', local: 'Tamarind sour soup', cats: ['sabaw'],
    price: 74, serves: '3–4', spice: 1, tags: ['Comfort classic'], cover: 5, plate: 5,
    short: 'Short ribs in a bright tamarind broth.',
    desc: 'Fresh sampalok pressed into the broth for that signature sour, with beef short ribs that slide off the bone, radish, okra, string beans, tomato and green chili. The soup every Filipino grew up on.',
    ings: ['Beef short ribs', 'Tamarind', 'Radish', 'Okra', 'String beans', 'Tomato', 'Green chili'],
    pairs: ['crispy-pata', 'bangus'],
  },
  {
    id: 'bangus', name: 'Inihaw na Bangus', local: 'Banana-leaf milkfish', cats: ['inihaw', 'dagat'],
    price: 52, serves: '2', spice: 1, tags: ['Charcoal-grilled'], cover: 5, plate: 1,
    short: 'Stuffed milkfish, grilled in banana leaf.',
    desc: 'Whole milkfish stuffed with tomato, onion and ginger, glazed with chili, wrapped in banana leaf and grilled over open flame. The leaf chars, the fish steams, and we unwrap it at your table.',
    ings: ['Milkfish', 'Tomato', 'Red onion', 'Ginger', 'Chili glaze', 'Banana leaf'],
    pairs: ['sinigang', 'chopsuey'],
  },
  {
    id: 'butterfish', name: 'Garlic Butter Butterfish', local: 'With ensaladang mangga', cats: ['dagat'],
    price: 64, serves: '1–2', spice: 0, tags: ["Chef's pick"], cover: 5, plate: 2,
    short: 'Seared fillet, green-mango salsa tower.',
    desc: 'A thick butterfish fillet seared and spoon-basted in garlic, thyme and brown butter, plated beside a ring-moulded tower of carabao mango, tomato, red onion and cilantro.',
    ings: ['Butterfish', 'Butter', 'Garlic', 'Thyme', 'Carabao mango', 'Tomato', 'Cilantro'],
    pairs: ['tomyum', 'pancit'],
  },
  {
    id: 'pancit', name: 'Pancit Mix', local: 'Bihon & canton', cats: ['pansit'],
    price: 45, serves: '3–4', spice: 0, tags: ['For long life', 'For sharing'], cover: 5, plate: 4,
    short: 'Two noodles, shrimp, chicken, calamansi.',
    desc: 'Rice vermicelli and egg noodles tossed together with shrimp, chicken, snow peas, cabbage and carrot in a savoury soy-oyster glaze, crowned with egg and calamansi. Long noodles, long life: every celebration needs one.',
    ings: ['Bihon', 'Canton', 'Shrimp', 'Chicken', 'Snow peas', 'Egg', 'Calamansi'],
    pairs: ['kare-kare', 'bbq-chicken'],
  },
  {
    id: 'chopsuey', name: 'Chop Suey', local: 'Wok-tossed gulay', cats: ['pansit'],
    price: 42, serves: '2–3', spice: 0, tags: ['Vegetable-forward'], cover: 4, plate: 7,
    short: 'A garden of vegetables, quail eggs, wok hei.',
    desc: 'Broccoli, cauliflower, snow peas, baby corn, carrot, cabbage, bell pepper and mushrooms, blanched for snap, then tossed over roaring flame with chicken and quail eggs and glossed in oyster sauce.',
    ings: ['Broccoli', 'Cauliflower', 'Snow peas', 'Baby corn', 'Quail eggs', 'Chicken', 'Oyster sauce'],
    pairs: ['inasal', 'bangus'],
  },
  {
    id: 'bbq-chicken', name: 'Barkada BBQ Chicken', local: 'Sweet-soy glazed inihaw', cats: ['inihaw'],
    price: 39, serves: '1', spice: 1, tags: ['Crowd favourite'], cover: 8, plate: 7,
    short: 'Sticky, smoky, sweet-soy glazed.',
    desc: 'Our house spice rub and a sweet-soy banana-ketchup marinade, grilled and turned by hand, then lacquered with glaze until it glistens. Pinoy street barbecue, dressed for dinner.',
    ings: ['Chicken', 'House spice rub', 'Soy', 'Banana ketchup', 'Garlic', 'Calamansi'],
    pairs: ['pancit', 'sinigang'],
  },
  {
    id: 'herb-chicken', name: 'Garden Herb Chicken', local: 'Inihaw sa damo', cats: ['inihaw'],
    price: 41, serves: '1', spice: 1, tags: ['New'], cover: 2, plate: 2,
    short: 'Green herbs, garlic & chili, roasted.',
    desc: 'Leg quarters rubbed in a bright paste of cilantro, mint, garlic, green chili and calamansi, roasted and rested on a board of rosemary and lemon.',
    ings: ['Chicken', 'Cilantro', 'Mint', 'Garlic', 'Green chili', 'Rosemary', 'Lemon'],
    pairs: ['chopsuey', 'bulalo'],
  },
  {
    id: 'tomyum', name: 'Creamy Seafood Tom Yum', local: 'Hot & sour with gata', cats: ['sabaw', 'dagat'],
    price: 68, serves: '2–3', spice: 3, tags: ['Spicy'], cover: 5, plate: 5,
    short: 'Prawns, mussels & squid in coconut-cream broth.',
    desc: 'A fragrant hot-and-sour broth of lemongrass, galangal and lime leaf, loaded with prawns, mussels and squid, swirled with fresh coconut cream and finished with chili and cilantro.',
    ings: ['Prawns', 'Mussels', 'Squid', 'Coconut cream', 'Lemongrass', 'Galangal', 'Chili'],
    pairs: ['butterfish', 'inasal'],
  },
].map((d) => ({ ...d, steps: CLIPS[d.id] }));

export const byId = Object.fromEntries(DISHES.map((d) => [d.id, d]));
export const clipOf = (d, n) => d.steps[Math.min(n, d.steps.length) - 1].id;

// Text-only side menu
export const CARTE = [
  ['Sa tabi', 'Rice & sides', [
    ['Garlic rice', 'Sinangag, toasted garlic', 9],
    ['Java rice', 'Achuete & butter', 10],
    ['Steamed rice', 'Per cup', 7],
    ['Ensaladang talong', 'Charred eggplant, tomato, onion', 18],
    ['Atchara', 'Pickled green papaya', 12],
    ['Bagoong alamang', 'Sautéed shrimp paste', 9],
  ]],
  ['Panghimagas', 'Sweets', [
    ['Halo-halo especial', 'Ube, leche flan, pinipig', 29],
    ['Leche flan', 'Duck egg custard, burnt sugar', 22],
    ['Turon à la mode', 'Saba, langka, vanilla ice cream', 24],
    ['Buko pandan', 'Young coconut, pandan jelly', 21],
    ['Ube cheesecake', 'Purple yam, graham crust', 27],
  ]],
  ['Inumin', 'Drinks', [
    ['Calamansi juice', 'Fresh-pressed, honey', 14],
    ["Sago't gulaman", 'Brown sugar, pearls, jelly', 13],
    ['Fresh buko', 'Served in the shell', 18],
    ['Mango shake', 'Carabao mango', 19],
    ['Kapeng barako', 'Batangas liberica', 15],
    ['Salabat', 'Ginger tea, muscovado', 12],
  ]],
];
