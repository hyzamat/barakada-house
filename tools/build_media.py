"""Encode dish clips into web-ready media for the Barkada House site.

Outputs (under site/media):
  v/<id>-l.mp4   1280x720 landscape (desktop)
  v/<id>-p.mp4   540x960 centre-crop portrait (phones)
  p/<id>-l.webp  960x540 poster
  p/<id>-p.webp  540x960 poster
  p/<id>-s.webp  360x360 square (plates / thumbs)
and writes site/assets/js/media.js with the clip manifest.
"""
import glob, json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SRC = ROOT
OUT = os.path.join(ROOT, "site/media")
JS = os.path.join(ROOT, "site/assets/js/media.js")
FF = "ffmpeg"

# dish id -> folder, ordered steps (file prefix, caption, poster second)
DISHES = {
    "crispy-pata": ("Crispy pata", [
        ("Beef_shank_on_rotating_board", "The whole knuckle, aromatics at the ready", 6),
        ("Beef_shank_simmering_in_pot", "Simmered low with star anise, bay & peppercorn", 6),
        ("Beef_shank_drying_on_rack", "Salted, then air-dried until taut", 6),
        ("Beef_shank_frying_in_oil", "Plunged into roaring-hot oil", 7),
        ("Crispy_beef_shank_on_plate", "Blistered, golden, shatter-crisp", 7),
        ("Fork_cracking_crispy_beef_crust", "Listen for the crack", 7),
    ]),
    "kare-kare": ("Kare kare", [
        ("Cleaver_chopping_raw_oxtail", "Oxtail, cleaved through the joint", 6),
        ("Seasoning_raw_oxtail_in_bowl_0a278cd2_1080p.mp4", "Seasoned with garlic & cracked pepper", 6),
        ("Oxtail_drops_into_boiling_water", "Into the pot until fall-apart tender", 6),
        ("Knife_slicing_eggplant_on_board", "Eggplant, sitaw & pechay, cut to order", 6),
        ("Garlic_and_onions_sizzling", "Garlic, onion & achuete bloom in oil", 7),
        ("Peanut_sauce_pouring_into_pot", "Toasted peanut sauce, poured thick", 5),
        ("Wooden_spoon_stirring_peanut_stew", "Stirred until velvet", 7),
    ]),
    "bulalo": ("BULALO", [
        ("Vegetables_arranged_on_cutting", "Corn, cabbage, bok choy & peppercorn", 6),
        ("Knife_splits_cabbage_on_board", "Cabbage, halved by hand", 6),
        ("Knife_slicing_baby_bok_choy", "Baby bok choy, split clean", 6),
        ("Seasoning_beef_shank_on_board", "Beef shank, sea salt & black pepper", 7),
        ("Knife_slicing_beef_shank", "Cut thick, straight through the marrow", 6),
        ("Beef_shanks_dropped_into_broth", "Into the stockpot", 3),
        ("Simmering_Filipino_bulalo_broth", "Simmered for hours, never boiled", 7),
        ("Steam_rising_from_beef_broth", "Patience, rising as steam", 6),
        ("Beef_broth_pouring_into_bowl", "Golden broth, poured over", 4),
        ("Spring_onions_falling_on_bulalo", "A rain of spring onions", 7),
        ("Steaming_bowl_of_Filipino_bulalo", "Marrow, ready for the spoon", 7),
        ("Filipino_bulalo_on_dining_table", "Set down for the barkada", 3),
    ]),
    "inasal": ("Chicken inasal", [
        ("Chicken_inasal_ingredients_floating", "Lemongrass, ginger, calamansi, siling labuyo", 6),
        ("Inasal_marinade_swirling_in_bowl", "The Bacolod marinade", 6),
        ("Chicken_leg_quarters_in_marinade", "Leg quarters, steeped overnight", 6),
        ("Charcoal_embers_glowing_in_grill", "Uling — real charcoal, white-hot", 3),
        ("Chicken_grilling_over_hot_coals", "Over the coals", 7),
        ("Basting_chicken_on_grill_grate", "Basted in achuete oil", 7),
        ("Grilled_chicken_leg_with_glaze", "Charred stripes, lacquered skin", 3),
        ("Grilled_chicken_on_banana_leaf", "On banana leaf, with calamansi", 6),
    ]),
    "kaldereta": ("Caldareta beef", [
        ("Ingredients_sliding_into_marinat", "Beef, peppers, olives & potatoes", 7),
        ("Beef_cubes_searing_in_pot", "Seared hard for colour", 7),
        ("Tomato_sauce_drop_splashing_bowl", "Rich tomato base", 2),
        ("Dutch_oven_simmering_caldereta", "Braised until spoon-tender", 7),
        ("Spoon_lifting_beef_and_cheese", "Finished with a melt of cheese", 7),
    ]),
    "sinigang": ("Sinigang   ribs", [
        ("Tamarind_pulp_melting_into_broth", "Fresh sampalok, pressed for its sour", 7),
        ("Simmering_tamarind_beef_soup", "Short ribs, tomato & onion simmer", 7),
        ("Tongs_lifting_beef_short_rib", "Ribs that slide off the bone", 3),
        ("Broth_droplet_falls_into_soup", "Gabi leaf, broth, a final taste", 6),
        ("Beef_sinigang_bowl_on_table", "Sour, savoury, soul-warming", 7),
    ]),
    "bangus": ("Fish", [
        ("Stuffing_and_glazing_milkfish", "Milkfish, stuffed and glazed", 7),
        ("Banana_leaf_wrapping_stuffed_mil", "Folded into banana leaf", 3),
        ("Banana_leaf_milkfish_grilling", "Grilled over open flame", 6),
        ("Banana_leaf_unfolding_on_grill", "The leaf chars, the fish steams", 7),
        ("Banana_leaf_bundle_peels_open", "Unwrapped at the table", 6),
    ]),
    "butterfish": ("Fish", [
        ("Mango_flipping_on_marble_countertop", "Carabao mango, hedgehog-cut", 6),
        ("Mango_salad_tower_lifting_mold", "Ensaladang mangga, ring-moulded", 7),
        ("Butter_melting_in_pan", "Butter, garlic & thyme", 7),
        ("Butterfish_searing_in_garlic_butter", "Seared and spoon-basted", 7),
        ("Spatula_plating_butterfish_fillet", "Plated beside the mango", 7),
        ("Butterfish_with_mango_salad", "Bright, buttery, finished", 6),
    ]),
    "pancit": ("Pancit nix", [
        ("Noodles_softening_in_water_bowl_9c58786a_1080p.mp4", "Bihon & canton, softened", 6),
        ("Sauce_spreading_over_noodle_dish", "Tossed with shrimp, chicken & snow peas", 7),
        ("Chopsticks_lifting_pancit_noodles", "Long noodles for long life", 3),
        ("Plating_pancit_with_egg", "Crowned with egg & calamansi", 7),
        ("Pancit_mix_on_white_platter", "A platter made for passing", 7),
    ]),
    "chopsuey": ("Chopsoy", [
        ("Chop_suey_ingredients_on_countertop", "Eleven vegetables, one wok", 6),
        ("Vegetables_boiling_in_pot", "Blanched to keep the snap", 6),
        ("Chicken_and_vegetables_cooking", "Chicken, garlic & onion hit the wok", 6),
        ("Wok_tossing_vegetables_and_chicken", "Wok hei — breath of the wok", 3),
        ("Vegetables_and_chicken_tossed_in", "Tossed high", 6),
        ("Sauce_coating_stir-fried_vegetables", "Glossed in oyster sauce", 3),
        ("Filipino_chicken_chop_suey_wok", "Straight from the wok", 7),
    ]),
    "bbq-chicken": ("Chicken bbq", [
        ("BBQ_spices_exploding_from_bowl", "Our house spice blend", 7),
        ("Chicken_plunging_into_BBQ_marinade", "Dropped into the sweet-soy marinade", 2),
        ("Chicken_cooking_with_BBQ_sauce", "Coated, every inch", 7),
        ("BBQ_chicken_leg_floating_cooking", "Glaze, wrapped and set", 7),
        ("Chicken_grilling_on_hot_surface", "Onto the grill", 7),
        ("Chicken_grilling_in_bright_kitchen", "Smoke and sizzle", 7),
        ("Tongs_turning_chicken_on_grill", "Turned once, marked perfectly", 3),
        ("Glazed_chicken_drumstick_sizzling", "Sticky, smoky, glistening", 6),
    ]),
    "herb-chicken": ("Chicken bbq", [
        ("Spreading_green_herb_marinade", "Garden herbs, garlic & green chili", 7),
        ("Chicken_leg_resting_on_board", "Roasted, rested, rosemary-strewn", 3),
    ]),
    "tomyum": ("Tomyum", [
        ("Coconut_splits_on_marble_countertop", "Fresh coconut, cracked open", 7),
        ("Tom_yum_soup_boiling", "Prawns, mussels & squid at a rolling boil", 7),
        ("Cream_pouring_into_tom_yum", "Gata swirled in", 4),
        ("Bubble_popping_on_tom_yum", "Hot, sour, aromatic", 6),
        ("Tom_yum_seafood_soup_bowl", "Chili, cilantro, a glossy finish", 7),
        ("Tom_yum_soup_on_table", "Served with rice and iced tea", 7),
    ]),
}


def resolve(folder, prefix):
    if prefix.endswith(".mp4"):
        p = os.path.join(SRC, folder, prefix)
        if os.path.exists(p):
            return p
    hits = sorted(h for h in glob.glob(os.path.join(SRC, folder, prefix + "*.mp4")) if "(1)" not in h)
    if not hits:
        sys.exit(f"missing: {folder}/{prefix}")
    return hits[0]


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        print("FAIL", " ".join(cmd)[:200], r.stderr[-400:])
    return r.returncode


V264 = ["-c:v", "libx264", "-preset", "slow", "-crf", "27", "-profile:v", "high",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-threads", "3",
        "-c:a", "aac", "-b:a", "64k", "-ac", "1"]


def jobs_for(cid, src, t):
    v, p = os.path.join(OUT, "v"), os.path.join(OUT, "p")
    yield [FF, "-v", "error", "-y", "-i", src, "-vf", "scale=1280:-2", *V264, f"{v}/{cid}-l.mp4"]
    yield [FF, "-v", "error", "-y", "-i", src, "-vf", "crop=ih*9/16:ih,scale=540:960", *V264, f"{v}/{cid}-p.mp4"]
    yield [FF, "-v", "error", "-y", "-ss", str(t), "-i", src, "-frames:v", "1", "-vf", "scale=960:-2",
           "-c:v", "libwebp", "-quality", "72", f"{p}/{cid}-l.webp"]
    yield [FF, "-v", "error", "-y", "-ss", str(t), "-i", src, "-frames:v", "1", "-vf", "crop=ih*9/16:ih,scale=540:960",
           "-c:v", "libwebp", "-quality", "70", f"{p}/{cid}-p.webp"]
    yield [FF, "-v", "error", "-y", "-ss", str(t), "-i", src, "-frames:v", "1", "-vf", "crop=ih:ih,scale=360:360",
           "-c:v", "libwebp", "-quality", "72", f"{p}/{cid}-s.webp"]


def main():
    for d in ("v", "p", "seq"):
        os.makedirs(os.path.join(OUT, d), exist_ok=True)
    os.makedirs(os.path.dirname(JS), exist_ok=True)

    manifest, jobs = {}, []
    for dish, (folder, steps) in DISHES.items():
        manifest[dish] = []
        for i, (prefix, caption, t) in enumerate(steps, 1):
            cid = f"{dish}-{i:02d}"
            manifest[dish].append({"id": cid, "caption": caption})
            jobs.extend(jobs_for(cid, resolve(folder, prefix), t))

    if "--manifest-only" not in sys.argv:
        with ThreadPoolExecutor(max_workers=8) as ex:
            fails = sum(ex.map(run, jobs))
        print("jobs", len(jobs), "failed", fails)

    with open(JS, "w", encoding="utf-8") as f:
        f.write("// Generated by build_media.py: clip ids and captions per dish, in cooking order.\n")
        f.write("export const CLIPS = " + json.dumps(manifest, indent=2, ensure_ascii=False) + ";\n")
    print("manifest written", sum(len(v) for v in manifest.values()), "clips")


if __name__ == "__main__":
    main()
