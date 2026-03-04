# Campaign: The Fractured Lands

All dialogue content for the campaign, organized by context.

---

# Campaign Intro

## campaign_intro
- trigger: LEVEL_START
- pauseGame: true
- skippable: true
- showOnce: true

> **narrator** [slow]: Long ago, Four Wardens sealed a great corruption beneath these lands...
> **narrator**: For generations, the seals held. The kingdom prospered. The darkness was forgotten.
> **narrator**: But seals weaken. Memories fade. And the Fracture has begun to spread.
> **elder**: I am the last of my order. The other Wardens... they fell protecting the seals.
> **elder**: You must take up the mantle. Become a Warden. Push back the corruption.
> **elder**: I will guide you. Together, we will reclaim what was lost. Are you ready?

---

# Level Dialogues

Dialogues triggered during gameplay, organized by level.

---

## Level: grasslands_1_green_valley

### green_valley_bow_tutorial
- trigger: LEVEL_START
- pauseGame: false
- skippable: true
- showOnce: true

> **elder** [highlight:bow_circle]: Enemies approach! Drag to aim, then release to fire. The further you pull, the more powerful your shot. Use the high ground to your advantage!
> **elder** [highlight:troop_deploy]: Purchase troops from the menus above to march forth! They'll engage enemies along the path. Gold flows to you over time - spend it wisely on more warriors when the cooldown resets.

### green_valley_victory
- trigger: LEVEL_VICTORY
- pauseGame: false
- skippable: true
- showOnce: true

> **elder**: Victory! You've proven yourself capable. The corruption recedes... for now.

---

## Level: grasslands_2_farmland_road

### farmland_road_intro
- trigger: LEVEL_START
- pauseGame: true
- skippable: true
- showOnce: true

> **elder** [highlight:tower_shop]: The enemy has fortified this road with towers. You can do the same — build yours wisely.
> **elder** [fast] [highlight:tower_shop]: Select a tower from the menu above and place it on a highlighted position along the battlefield.
> **elder** [fast] [highlight:tower_shop]: Enemy towers can be destroyed. Take them down to weaken their defenses.
> **elder** [highlight:tower_shop]: See those Blood Shards? They spawn enemy troops. Destroy them quickly to stop the flow and win faster.

### farmland_road_tower
- trigger: FIRST_TOWER_PLACED
- pauseGame: true
- skippable: true
- showOnce: true

> **elder**: Excellent! Towers attack automatically and can be destroyed by enemies. Place them wisely - they're expensive but worth it!

---

## Level: grasslands_verdant_gauntlet

### verdant_gauntlet_intro
- trigger: LEVEL_START
- pauseGame: true
- skippable: true
- showOnce: true

> **elder** [fast]: I need your eyes on the horizon. Use those arrows to pick off the Flying Eyes before they swarm the perimeter. Leave the armored Sprouts and Skeletons to the towers.
> **elder**: Your bow is the only thing fast enough to clear the sky!

---

## Level: grasslands_3_crossroad_keep

### crossroad_keep_intro
- trigger: LEVEL_START
- pauseGame: true
- skippable: false
- showOnce: true

> **narrator**: The keep's stones bear Dwarven runes, now defaced with corruption.
> **dwarf_warrior**: Three hundred years my clan held these walls. THREE HUNDRED.
> **dwarf_warrior**: The corruption took it in a night. We've been fighting back ever since.
> **elder**: We're here to help you reclaim it.
> **dwarf_warrior**: Help? HA! You'll WATCH us reclaim it!
> **dwarf_warrior**: Ironhold! CHARGE!
> **narrator**: The Dwarves surge forward. This battle is personal.

### crossroad_keep_victory
- trigger: LEVEL_VICTORY
- pauseGame: false
- skippable: false
- showOnce: true

> **narrator**: The keep falls silent. Dwarven banners rise once more.
> **dwarf_warrior**: The halls are ours again. My ancestors can rest.
> **dwarf_warrior**: Many fell today. Good warriors. But their sacrifice bought us victory.
> **elder**: Their courage will be remembered.
> **dwarf_warrior**: You fought well, Warden. The Ironhold Clan remembers its debts.
> **dwarf_warrior**: Call upon us, and Dwarven steel answers.
> **narrator**: The Dwarven Warriors join your alliance. Their siege expertise is unmatched.

---

## Level: grasslands_5_corrupted_grove

### corrupted_grove_intro
- trigger: LEVEL_START
- pauseGame: true
- skippable: true
- showOnce: true

> **narrator**: From the reclaimed keep, a twisted shape looms in the nearby forest.
> **centaur**: You there! From the keep! You see it too - the Old Guardian has fallen to madness.
> **centaur**: For a thousand years it protected this grove. Now the corruption twists its mind.
> **elder**: We mean to save it, not destroy it.
> **centaur**: Save it? We've lost many trying. But your eyes hold no fear.
> **centaur**: Our axes are yours, Warden. One last charge for our fallen protector.

### corrupted_grove_victory
- trigger: LEVEL_VICTORY
- pauseGame: false
- skippable: true
- showOnce: true

> **narrator**: The Old Guardian falls still. Corruption seeps from its wounds into the earth.
> **old_guardian** [slow]: ...the forest... I remember now...
> **centaur**: Rest, ancient one. The grove will heal.
> **centaur**: You did what we could not. The Centaurs ride with you now, Warden.
> **narrator**: The Centaurs join your alliance. Their speed and axes are unmatched.

---

## Level: grasslands_fort_dundun

### fort_dundun_intro
- trigger: LEVEL_START
- pauseGame: true
- skippable: true
- showOnce: true

> **narrator**: Fort Dundun looms ahead - the last stronghold before the Rootbound Hollow.
> **dwarf_warrior**: That fort has walls three feet thick. Our axes won't breach it fast enough.
> **engineer**: Ahem! Did someone say "breach"?
> **narrator**: A gnome emerges from behind a wagon, goggles gleaming.
> **engineer**: The Dwarves commissioned these beauties. Bomber Balloons! Rain fire from above!
> **engineer**: They're slow, fragile, and absolutely devastating. Don't let the enemy shoot them down!
> **dwarf_warrior**: Gnome contraptions... but we're out of options. Launch them!

### fort_dundun_victory
- trigger: LEVEL_VICTORY
- pauseGame: false
- skippable: true
- showOnce: true

> **engineer**: HA! Did you see those walls crumble? MAGNIFICENT!
> **dwarf_warrior**: The gnome's toys proved useful. I'll admit that much.
> **engineer**: "Toys"?! These are precision instruments of-
> **dwarf_warrior**: The fort is ours. That's what matters.
> **narrator**: The Bomber Balloons join your arsenal. Aerial siege support is now available.

---

## Level: grasslands_the_woods

### the_woods_intro
- trigger: LEVEL_START
- pauseGame: true
- skippable: true
- showOnce: true

> **centaur**: This path leads through the old woods. Stay close. The trees here... they watch.
> **dwarf_warrior**: Trees don't scare Dwarves. We carved our halls from living stone.
> **centaur**: My people have walked these woods for centuries. Even we fear what stirs at night.
> **dwarf_warrior**: It's just dark. I've seen darker. Much darker. Underground darker.
> **centaur**: Then why is your axe already drawn?
> **dwarf_warrior**: ...habit.

### the_woods_cthulu_appears
- trigger: WAVE_8
- pauseGame: false
- skippable: true
- showOnce: true

> **narrator**: The air grows thick. Something ancient stirs in the depths...
> **dwarf_warrior**: BY MY BEARD! WHAT IS THAT?!
> **centaur**: By the old roots... I've never seen such a creature.
> **elder**: Hold the line! Don't let it reach the camp!

### the_woods_victory
- trigger: LEVEL_VICTORY
- pauseGame: false
- skippable: true
- showOnce: true

> **centaur**: The creature has fled. For now.
> **dwarf_warrior**: See? Nothing a Dwarf can't handle.
> **centaur**: Your beard is still trembling.
> **dwarf_warrior**: ...wind.
> **elder**: Fort Dundun lies ahead. We'll need siege support to breach those walls.

---

## Level: grasslands_rootbound_hollow

### rootbound_hollow_intro
- trigger: LEVEL_START
- pauseGame: true
- skippable: false
- showOnce: true

> **elder**: The Rootbound One... it was once the guardian of these lands. The corruption has twisted its mind. We must free it, not destroy it!
> **rootbound_colossus** [slow]: WHO... DISTURBS... THE OLD... ROAD...
> **rootbound_colossus** [slow]: PAIN... ONLY PAIN... LEAVE THIS PLACE...
> **elder**: Hold your ground! Strike the corruption, not the spirit! We can save it!

### rootbound_hollow_phase2
- trigger: BOSS_PHASE_2
- pauseGame: false
- skippable: true
- showOnce: true

> **rootbound_colossus** [slow]: THE BURNING... IT SPREADS... CANNOT... STOP...
> **elder**: It's weakening! The corruption is losing its hold! Keep fighting!

### rootbound_hollow_victory
- trigger: LEVEL_VICTORY
- pauseGame: false
- skippable: false
- showOnce: true

> **narrator** [slow]: The corruption shatters. Magic surges through the hollow...
> **narrator**: The twisted bark falls away, revealing something unexpected beneath.
> **warden_grasslands** [slow]: I... I can see again. The darkness... it is gone.
> **elder**: By the old oaths... You are the Warden of the Grasslands!
> **warden_grasslands**: I was. Before the Fracture consumed me. I tried to hold the seal alone, but the corruption... it twisted my form, my mind.
> **warden_grasslands**: For so long I guarded this road, not knowing friend from foe. The pain made me blind to purpose.
> **elder**: You've been fighting the corruption for centuries. We thought you had fallen.
> **warden_grasslands**: I never stopped fighting. But I had lost myself. You have given me back my soul.
> **warden_grasslands**: The grasslands will heal now. I will see to it. And when you face what lies ahead, call upon me.
> **narrator**: The Warden of the Grasslands joins your cause. The first road is clear.
> **narrator**: But smoke rises from the Volcanic Reaches. The corruption runs deeper still...

---

# Level Previews

Short atmospheric previews shown on level select popup before starting a level.

---

## preview_the_woods
- level: grasslands_the_woods

> **centaur**: The old woods lie ahead. My people know the paths... but even we fear what stirs in the darkness.

---

## preview_rootbound_hollow
- level: grasslands_rootbound_hollow

> **elder**: The guardian awaits. This is not a battle of destruction, but of liberation.

---

## preview_ember_pass
- level: volcanic_1_ember_pass

> **elder**: The mountains burn with ancient fire. The kingdom mined too deep for power.

---

## preview_molten_core
- level: volcanic_5_molten_core

> **elder**: Someone sealed the Veil with fire once. We approach his domain.

---

## preview_fire_wizard
- level: volcanic_6_fire_wizard_sanctum

> **elder**: The Archmage awaits. He tried to burn corruption away - and became bound to it.

---

## preview_frost_gate
- level: frozen_1_frost_gate

> **elder**: They tried to freeze the problem instead of solving it. The ice holds... for now.

---

## preview_pale_sentinel
- level: frozen_6_pale_sentinel_throne

> **elder**: It still stands. That was the plan. But nothing can hold forever.

---

## preview_twilight_border
- level: shadow_1_twilight_border

> **elder**: This is where the corruption originated. The truth lies ahead.

---

## preview_dark_warden
- level: shadow_6_dark_warden_sanctum

> **elder**: The Dark Warden awaits. He is not the enemy - he is its keeper, twisted by centuries of containment.

---

# Progression Dialogues

Dialogues shown when unlocking levels and regions.

---

## Level Unlocks

Templates for level unlock messages. Use {nextLevel} and {gems} placeholders.

### unlock_after_level_0
> **elder**: You've proven yourself capable. {nextLevel} lies ahead - the enemy has towers there.{gems}

### unlock_after_level_1
> **elder**: Well fought! The road to {nextLevel} is open. The enemy base must fall.{gems}

### unlock_after_level_2
> **elder**: {nextLevel} awaits. This will be a battle for control.{gems}

### unlock_after_level_3
> **elder**: We've defended for now. But darkness gathers in ahead.{gems}

### unlock_after_level_4
> **elder**: The grove is cleansed. Only {nextLevel} remains - and what dwells within.{gems}

### unlock_after_level_7
> **elder**: The Grasslands are safe... for now. But smoke rises from the Volcanic Reaches.
> **elder**: The corruption runs deeper than we feared. Ancient fires stir beneath the mountains.
> **narrator** [slow]: The journey continues... in the Volcanic Expansion.
> **narrator**: Thank you for playing Arrowfall!

### unlock_default
> **elder**: {nextLevel} is now accessible.{gems}

---

## Region Unlocks

### unlock_volcanic
> **elder**: The Grasslands are cleansed, but the corruption's source lies deeper. The Volcanic Reaches await - where the kingdom mined too deep for power. You've earned {gems} gems to strengthen your army.

### unlock_frozen
> **elder**: The fire holds, but only here. Ahead lies the Frozen Tundra - where they tried to freeze the problem instead of solving it. You've earned {gems} gems.

### unlock_shadow
> **elder**: Nothing can hold forever. The Shadowlands beckon - where the corruption originated. This is where truth and consequence await. You've earned {gems} gems for this final journey.

---

# Shop Reminders

Dialogues encouraging players to visit the collection/shop.

---

## shop_reminder_region
> **elder**: Darker forces stir ahead. Visit the Collection to unlock new troops and towers - a stronger army makes all the difference.

---

## shop_after_level_0
- after: grasslands_1_green_valley

> **elder**: The road ahead is fortified with enemy towers. You've earned the right to build Archer Towers in battle.

---

## shop_after_level_1
- after: grasslands_2_farmland_road

> **elder**: The next battle requires offense, not just defense.
> **elder**: Visit the Encyclopedia to unlock additional troops. Reinforcements could turn the tide.

---

## shop_after_level_2
- after: grasslands_3_crossroad_keep

> **elder**: Your victories bring riches. Spend them wisely in the Encyclopedia - a diverse army is a strong army.

---

## shop_after_level_3
- after: grasslands_verdant_gauntlet

> **elder**: Darker forces await. You'll need every advantage.
