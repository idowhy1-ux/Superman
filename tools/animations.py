"""Animation definitions (resource pack).

Player poses are played from scripts with ``Entity.playAnimation`` so the
add-on never has to override the vanilla player files.
"""
from __future__ import annotations

from typing import Dict

E = "math.min(query.anim_time * 2.5, 1.0)"          # ease-in 0 -> 1 over 0.4s
P = "math.clamp(query.target_x_rotation, -85, 85)"   # look pitch
A = f"math.clamp(90 + {P}, 12, 172)"                  # body tilt while flying
CY = 14                                              # rotate the body about its middle
SUIT_STOP = "!query.is_item_name_any('slot.armor.chest', 0, 'superhuman:hero_suit')"


def v(x, y, z):
    return [x, y, z]


def fly_root(bank_scale: float = 0.15, jitter: str = "0") -> Dict:
    return {
        "rotation": [
            f"({E}) * {A}",
            0,
            f"({E}) * math.clamp(-query.yaw_speed * {bank_scale}, -30, 30) + {jitter}",
        ],
        "position": [
            0,
            f"({E}) * ({CY} - math.cos({A}) * {CY})",
            f"({E}) * (math.sin({A}) * {CY})",
        ],
    }


def fly_head() -> Dict:
    return {
        "rotation": [
            f"math.max({P} - ({E}) * {A}, -72)",
            f"query.target_y_rotation * (1 - ({E}) * 0.7)",
            0,
        ]
    }


def legs_flutter(base_r: float, base_l: float, amp: float, speed: int) -> Dict:
    return {
        "rightLeg": {"rotation": [f"({E}) * ({base_r} + math.sin(query.anim_time * {speed}) * {amp})", 0, f"({E}) * 2"]},
        "leftLeg": {"rotation": [f"({E}) * ({base_l} - math.sin(query.anim_time * {speed}) * {amp})", 0, f"({E}) * -2"]},
    }


def player_animations() -> Dict:
    anims: Dict[str, Dict] = {}

    hover_arms = {
        "rightArm": {"rotation": ["-6 + math.sin(query.anim_time * 90) * 3", 0, "10 + math.sin(query.anim_time * 120) * 2"]},
        "leftArm": {"rotation": ["-6 - math.sin(query.anim_time * 90) * 3", 0, "-10 - math.sin(query.anim_time * 120) * 2"]},
    }
    carry_arms_upright = {
        "rightArm": {"rotation": [-58, 0, -14]},
        "leftArm": {"rotation": [-58, 0, 14]},
    }
    hover_common = {
        "root": {"position": [0, "math.sin(query.anim_time * 120) * 0.8", 0]},
        "body": {"rotation": [0, 0, 0]},
        "head": {"relative_to": {"rotation": "entity"}, "rotation": ["query.target_x_rotation", "query.target_y_rotation", 0]},
        "rightLeg": {"rotation": ["8 + math.sin(query.anim_time * 100) * 5", 0, 3]},
        "leftLeg": {"rotation": ["-2 - math.sin(query.anim_time * 100) * 5", 0, -3]},
    }
    anims["animation.superhuman.player.hover"] = {
        "loop": True, "override_previous_animation": True, "bones": {**hover_common, **hover_arms}}
    anims["animation.superhuman.player.hover_carry"] = {
        "loop": True, "override_previous_animation": True, "bones": {**hover_common, **carry_arms_upright}}

    fly_bones = {
        "root": fly_root(),
        "head": fly_head(),
        "body": {"rotation": [0, 0, 0]},
        "rightArm": {"rotation": [f"({E}) * -175", 0, f"({E}) * 8"]},
        "leftArm": {"rotation": [f"({E}) * -12", 0, f"({E}) * -7"]},
        **legs_flutter(4, 9, 3, 520),
    }
    anims["animation.superhuman.player.fly"] = {"loop": True, "override_previous_animation": True, "bones": fly_bones}

    fast_bones = {
        "root": fly_root(0.22, "math.sin(query.anim_time * 1500) * 1.2"),
        "head": fly_head(),
        "body": {"rotation": [0, 0, 0]},
        "rightArm": {"rotation": [f"({E}) * -178", 0, f"({E}) * 7"]},
        "leftArm": {"rotation": [f"({E}) * -178", 0, f"({E}) * -7"]},
        **legs_flutter(1, 3, 1.5, 1300),
    }
    anims["animation.superhuman.player.fly_fast"] = {"loop": True, "override_previous_animation": True, "bones": fast_bones}

    carry_bones = dict(fly_bones)
    carry_bones["rightArm"] = {"rotation": [f"({E}) * -95", 0, f"({E}) * -12"]}
    carry_bones["leftArm"] = {"rotation": [f"({E}) * -95", 0, f"({E}) * 12"]}
    anims["animation.superhuman.player.fly_carry"] = {"loop": True, "override_previous_animation": True, "bones": carry_bones}

    anims["animation.superhuman.player.takeoff"] = {
        "animation_length": 0.5,
        "override_previous_animation": True,
        "bones": {
            "root": {"position": {"0.0": v(0, 0, 0), "0.12": v(0, -3, 0), "0.5": v(0, 0, 0)}},
            "body": {"rotation": {"0.0": v(0, 0, 0), "0.12": v(18, 0, 0), "0.3": v(-8, 0, 0), "0.5": v(0, 0, 0)}},
            "head": {"rotation": {"0.0": v(0, 0, 0), "0.3": v(-25, 0, 0), "0.5": v(-15, 0, 0)}},
            "rightArm": {"rotation": {"0.0": v(0, 0, 0), "0.12": v(30, 0, 10), "0.3": v(-175, 0, 8), "0.5": v(-175, 0, 8)}},
            "leftArm": {"rotation": {"0.0": v(0, 0, 0), "0.12": v(30, 0, -10), "0.3": v(-10, 0, -10), "0.5": v(-10, 0, -10)}},
            "rightLeg": {"rotation": {"0.0": v(0, 0, 0), "0.12": v(-30, 0, 0), "0.3": v(10, 0, 0), "0.5": v(5, 0, 2)}},
            "leftLeg": {"rotation": {"0.0": v(0, 0, 0), "0.12": v(-30, 0, 0), "0.3": v(15, 0, 0), "0.5": v(8, 0, -2)}},
        },
    }

    anims["animation.superhuman.player.land"] = {
        "animation_length": 1.3,
        "override_previous_animation": True,
        "bones": {
            "root": {"position": {"0.0": v(0, -5, 0), "0.75": v(0, -5, 0), "1.3": v(0, 0, 0)}},
            "body": {"rotation": {"0.0": v(32, 0, 0), "0.75": v(28, 0, 0), "1.3": v(0, 0, 0)}},
            "head": {"rotation": {"0.0": v(-25, 0, 0), "0.75": v(-32, 0, 0), "1.3": v(0, 0, 0)}},
            "rightArm": {"rotation": {"0.0": v(-25, 0, 18), "0.75": v(-25, 0, 18), "1.3": v(0, 0, 0)}},
            "leftArm": {"rotation": {"0.0": v(35, 0, -50), "0.75": v(35, 0, -45), "1.3": v(0, 0, 0)}},
            "rightLeg": {"rotation": {"0.0": v(-75, 0, 8), "0.75": v(-72, 0, 8), "1.3": v(0, 0, 0)}},
            "leftLeg": {"rotation": {"0.0": v(55, 0, -5), "0.75": v(52, 0, -5), "1.3": v(0, 0, 0)}},
        },
    }

    anims["animation.superhuman.player.heat_vision"] = {
        "loop": True,
        "bones": {
            "body": {"rotation": [0, 0, "math.sin(query.anim_time * 1800) * 0.8"]},
            "head": {"rotation": [-4, 0, 0]},
            "rightArm": {"rotation": [12, 0, 12]},
            "leftArm": {"rotation": [12, 0, -12]},
        },
    }
    anims["animation.superhuman.player.freeze_breath"] = {
        "loop": True,
        "bones": {
            "body": {"rotation": ["8 + math.sin(query.anim_time * 300)", 0, 0]},
            "head": {"rotation": [-12, 0, 0]},
            "rightArm": {"rotation": [25, 0, 14]},
            "leftArm": {"rotation": [25, 0, -14]},
        },
    }
    anims["animation.superhuman.player.punch"] = {
        "animation_length": 0.4,
        "bones": {
            "rightArm": {"rotation": {"0.0": v(0, 0, 0), "0.08": v(-95, 15, 0), "0.4": v(0, 0, 0)}},
            "body": {"rotation": {"0.0": v(0, 0, 0), "0.08": v(0, -22, 0), "0.4": v(0, 0, 0)}},
        },
    }
    anims["animation.superhuman.player.level_up"] = {
        "animation_length": 2.6,
        "override_previous_animation": True,
        "bones": {
            "root": {"position": {"0.0": v(0, 0, 0), "0.4": v(0, -2, 0), "0.7": v(0, 6, 0), "2.0": v(0, 6, 0), "2.6": v(0, 0, 0)}},
            "body": {"rotation": {"0.0": v(0, 0, 0), "0.4": v(20, 0, 0), "0.7": v(-12, 0, 0), "2.0": v(-12, 0, 0), "2.6": v(0, 0, 0)}},
            "head": {"rotation": {"0.0": v(0, 0, 0), "0.4": v(30, 0, 0), "0.7": v(-35, 0, 0), "2.0": v(-30, 0, 0), "2.6": v(0, 0, 0)}},
            "rightArm": {"rotation": {"0.0": v(0, 0, 0), "0.4": v(-60, 0, -50), "0.7": v(-150, 0, 45), "2.0": v(-150, 0, 45), "2.6": v(0, 0, 0)}},
            "leftArm": {"rotation": {"0.0": v(0, 0, 0), "0.4": v(-60, 0, 50), "0.7": v(-150, 0, -45), "2.0": v(-150, 0, -45), "2.6": v(0, 0, 0)}},
            "rightLeg": {"rotation": {"0.0": v(0, 0, 0), "0.4": v(-20, 0, 0), "0.7": v(0, 0, 8), "2.0": v(0, 0, 8), "2.6": v(0, 0, 0)}},
            "leftLeg": {"rotation": {"0.0": v(0, 0, 0), "0.4": v(-20, 0, 0), "0.7": v(0, 0, -8), "2.0": v(0, 0, -8), "2.6": v(0, 0, 0)}},
        },
    }
    anims["animation.superhuman.player.suit_up"] = {
        "animation_length": 1.8,
        "override_previous_animation": True,
        "bones": {
            "body": {"rotation": {"0.0": v(0, 0, 0), "0.3": v(10, 0, 0), "0.55": v(-14, 0, 0), "0.9": v(-6, 0, 0), "1.5": v(-6, 0, 0), "1.8": v(0, 0, 0)}},
            "head": {"rotation": {"0.0": v(0, 0, 0), "0.3": v(20, 0, 0), "0.55": v(-20, 0, 0), "0.9": v(-8, 0, 0), "1.8": v(0, 0, 0)}},
            "rightArm": {"rotation": {"0.0": v(0, 0, 0), "0.3": v(-75, 0, -35), "0.55": v(-50, 0, 55), "0.9": v(-12, 0, 30), "1.5": v(-12, 0, 30), "1.8": v(0, 0, 0)}},
            "leftArm": {"rotation": {"0.0": v(0, 0, 0), "0.3": v(-75, 0, 35), "0.55": v(-50, 0, -55), "0.9": v(-12, 0, -30), "1.5": v(-12, 0, -30), "1.8": v(0, 0, 0)}},
            "rightLeg": {"rotation": {"0.0": v(0, 0, 0), "0.9": v(0, 0, 6), "1.5": v(0, 0, 6), "1.8": v(0, 0, 0)}},
            "leftLeg": {"rotation": {"0.0": v(0, 0, 0), "0.9": v(0, 0, -6), "1.5": v(0, 0, -6), "1.8": v(0, 0, 0)}},
        },
    }
    anims["animation.superhuman.player.weakened"] = {
        "loop": True,
        "bones": {
            "body": {"rotation": ["20 + math.sin(query.anim_time * 90) * 3", 0, "math.sin(query.anim_time * 60) * 4"]},
            "head": {"rotation": [18, 0, 0]},
            "rightArm": {"rotation": [-45, 0, -28]},
            "leftArm": {"rotation": [8, 0, -4]},
        },
    }
    anims["animation.superhuman.player.solar_flare"] = {
        "animation_length": 2.2,
        "override_previous_animation": True,
        "bones": {
            "root": {"position": {"0.0": v(0, 0, 0), "1.0": v(0, 4, 0), "1.15": v(0, 8, 0), "1.8": v(0, 8, 0), "2.2": v(0, 0, 0)}},
            "body": {"rotation": {"0.0": v(0, 0, 0), "1.0": v(28, 0, 0), "1.15": v(-22, 0, 0), "1.8": v(-18, 0, 0), "2.2": v(0, 0, 0)}},
            "head": {"rotation": {"0.0": v(0, 0, 0), "1.0": v(35, 0, 0), "1.15": v(-35, 0, 0), "1.8": v(-30, 0, 0), "2.2": v(0, 0, 0)}},
            "rightArm": {"rotation": {"0.0": v(0, 0, 0), "1.0": v(-55, 0, -45), "1.15": v(-120, 0, 75), "1.8": v(-120, 0, 70), "2.2": v(0, 0, 0)}},
            "leftArm": {"rotation": {"0.0": v(0, 0, 0), "1.0": v(-55, 0, 45), "1.15": v(-120, 0, -75), "1.8": v(-120, 0, -70), "2.2": v(0, 0, 0)}},
            "rightLeg": {"rotation": {"0.0": v(0, 0, 0), "1.0": v(-35, 0, 0), "1.15": v(0, 0, 15), "1.8": v(0, 0, 15), "2.2": v(0, 0, 0)}},
            "leftLeg": {"rotation": {"0.0": v(0, 0, 0), "1.0": v(-35, 0, 0), "1.15": v(0, 0, -15), "1.8": v(0, 0, -15), "2.2": v(0, 0, 0)}},
        },
    }
    # ----- iron (nano suit) poses ------------------------------------------
    jitter = "math.sin(query.anim_time * 900) * 0.6"
    anims["animation.superhuman.player.iron_hover"] = {
        "loop": True, "override_previous_animation": True,
        "bones": {
            "root": {"position": [0, f"math.sin(query.anim_time * 140) * 0.5 + {jitter} * 0.3", 0]},
            "body": {"rotation": [0, 0, 0]},
            "head": {"relative_to": {"rotation": "entity"}, "rotation": ["query.target_x_rotation", "query.target_y_rotation", 0]},
            "rightArm": {"rotation": [f"6 + {jitter}", 0, "24 + math.sin(query.anim_time * 160) * 2"]},
            "leftArm": {"rotation": [f"6 - {jitter}", 0, "-24 - math.sin(query.anim_time * 160) * 2"]},
            "rightLeg": {"rotation": [3, 0, 1.5]},
            "leftLeg": {"rotation": [3, 0, -1.5]},
        },
    }
    anims["animation.superhuman.player.iron_fly"] = {
        "loop": True, "override_previous_animation": True,
        "bones": {
            "root": fly_root(0.15, "math.sin(query.anim_time * 1100) * 0.5"),
            "head": fly_head(),
            "body": {"rotation": [0, 0, 0]},
            "rightArm": {"rotation": [f"({E}) * 10", 0, f"({E}) * 14"]},
            "leftArm": {"rotation": [f"({E}) * 10", 0, f"({E}) * -14"]},
            "rightLeg": {"rotation": [f"({E}) * 2", 0, 1]},
            "leftLeg": {"rotation": [f"({E}) * 2", 0, -1]},
        },
    }
    anims["animation.superhuman.player.iron_fly_fast"] = {
        "loop": True, "override_previous_animation": True,
        "bones": {
            "root": fly_root(0.22, "math.sin(query.anim_time * 1500) * 1.0"),
            "head": fly_head(),
            "body": {"rotation": [0, 0, 0]},
            "rightArm": {"rotation": [f"({E}) * 4", 0, f"({E}) * 5"]},
            "leftArm": {"rotation": [f"({E}) * 4", 0, f"({E}) * -5"]},
            "rightLeg": {"rotation": [0, 0, 0.5]},
            "leftLeg": {"rotation": [0, 0, -0.5]},
        },
    }
    anims["animation.superhuman.player.nano_assemble"] = {
        "animation_length": 1.6,
        "override_previous_animation": True,
        "bones": {
            "body": {"rotation": {"0.0": v(0, 0, 0), "0.25": v(-8, 0, 0), "1.2": v(-8, 0, 0), "1.6": v(0, 0, 0)}},
            "head": {"rotation": {"0.0": v(0, 0, 0), "0.25": v(-20, 0, 0), "1.2": v(-15, 0, 0), "1.6": v(0, 0, 0)}},
            "rightArm": {"rotation": {"0.0": v(0, 0, 10), "0.25": v(-10, 0, 80), "1.2": v(-10, 0, 78), "1.6": v(0, 0, 0)}},
            "leftArm": {"rotation": {"0.0": v(0, 0, -10), "0.25": v(-10, 0, -80), "1.2": v(-10, 0, -78), "1.6": v(0, 0, 0)}},
            "rightLeg": {"rotation": {"0.0": v(0, 0, 0), "0.25": v(0, 0, 8), "1.2": v(0, 0, 8), "1.6": v(0, 0, 0)}},
            "leftLeg": {"rotation": {"0.0": v(0, 0, 0), "0.25": v(0, 0, -8), "1.2": v(0, 0, -8), "1.6": v(0, 0, 0)}},
        },
    }
    anims["animation.superhuman.player.repulsor"] = {
        "animation_length": 0.4,
        "bones": {
            "rightArm": {"rotation": {"0.0": v(-88, -8, 0), "0.07": v(-98, -8, 0), "0.4": v(0, 0, 0)}},
            "body": {"rotation": {"0.0": v(0, -10, 0), "0.4": v(0, 0, 0)}},
        },
    }
    anims["animation.superhuman.player.unibeam"] = {
        "loop": True,
        "bones": {
            "body": {"rotation": ["-14 + math.sin(query.anim_time * 1600) * 0.8", 0, 0]},
            "head": {"rotation": [-6, 0, 0]},
            "rightArm": {"rotation": [32, 0, 36]},
            "leftArm": {"rotation": [32, 0, -36]},
        },
    }
    anims["animation.superhuman.player.missiles"] = {
        "animation_length": 0.6,
        "bones": {
            "body": {"rotation": {"0.0": v(0, 0, 0), "0.15": v(-6, 0, 0), "0.6": v(0, 0, 0)}},
            "rightArm": {"rotation": {"0.0": v(0, 0, 0), "0.15": v(-20, 0, 40), "0.6": v(0, 0, 0)}},
            "leftArm": {"rotation": {"0.0": v(0, 0, 0), "0.15": v(-20, 0, -40), "0.6": v(0, 0, 0)}},
        },
    }
    anims["animation.superhuman.player.shield"] = {
        "animation_length": 0.8,
        "bones": {
            "leftArm": {"rotation": {"0.0": v(0, 0, 0), "0.15": v(-85, 30, 0), "0.6": v(-85, 30, 0), "0.8": v(0, 0, 0)}},
        },
    }
    anims["animation.superhuman.player.blade"] = {
        "animation_length": 0.5,
        "bones": {
            "rightArm": {"rotation": {"0.0": v(0, 0, 0), "0.1": v(-150, 20, 0), "0.3": v(-30, -30, 0), "0.5": v(0, 0, 0)}},
            "body": {"rotation": {"0.0": v(0, 0, 0), "0.3": v(0, -20, 0), "0.5": v(0, 0, 0)}},
        },
    }
    anims["animation.superhuman.player.clap"] = {
        "animation_length": 0.5,
        "bones": {
            "rightArm": {"rotation": {"0.0": v(0, 0, 0), "0.12": v(-90, 0, 40), "0.22": v(-90, 0, -5), "0.5": v(0, 0, 0)}},
            "leftArm": {"rotation": {"0.0": v(0, 0, 0), "0.12": v(-90, 0, -40), "0.22": v(-90, 0, 5), "0.5": v(0, 0, 0)}},
            "body": {"rotation": {"0.0": v(0, 0, 0), "0.22": v(6, 0, 0), "0.5": v(0, 0, 0)}},
        },
    }
    anims["animation.superhuman.player.none"] = {
        "animation_length": 0.05,
        "bones": {"root": {"position": [0, 0, 0]}},
    }
    return {"format_version": "1.10.0", "animations": anims}


def suit_animations() -> Dict:
    in_hand = "(c.item_slot == 'main_hand' || c.item_slot == 'off_hand') ? 0.0 : 1.0"
    return {
        "format_version": "1.10.0",
        "animations": {
            # Attachables are also drawn when the item is merely held; hide the
            # suit unless it is worn.
            "animation.superhuman.suit.hide_in_hand": {
                "loop": True,
                "bones": {b: {"scale": in_hand} for b in ("body", "rightArm", "leftArm", "rightLeg", "leftLeg")},
            },
            "animation.superhuman.suit.cape": {
                "loop": True,
                "bones": {
                    "sh_cape": {
                        "rotation": [
                            "variable.sh_cape_lift + math.sin(query.anim_time * variable.sh_cape_freq) * variable.sh_cape_amp",
                            0,
                            "math.sin(query.anim_time * variable.sh_cape_freq * 0.37) * variable.sh_cape_amp * 0.25",
                        ]
                    },
                    "sh_cape2": {
                        "rotation": [
                            "variable.sh_cape_lift2 + math.sin(query.anim_time * variable.sh_cape_freq - 70) * variable.sh_cape_amp * 1.4",
                            0,
                            0,
                        ]
                    },
                },
            }
        },
    }


def nano_animations() -> Dict:
    def grow(t0, t1):
        return {"scale": {"0.0": v(0, 0, 0), f"{t0}": v(0, 0, 0), f"{t1}": v(1.07, 1.07, 1.07), f"{round(t1 + 0.1, 2)}": v(1, 1, 1)}}

    def shrink(t0, t1):
        return {"scale": {"0.0": v(1, 1, 1), f"{t0}": v(1, 1, 1), f"{t1}": v(0, 0, 0)}}

    in_hand = "(c.item_slot == 'main_hand' || c.item_slot == 'off_hand') ? 0.0 : 1.0"
    return {
        "format_version": "1.10.0",
        "animations": {
            # the suit flows out of the chest reactor: chest -> arms -> legs -> helmet
            "animation.superhuman.nano.assemble": {
                "animation_length": 1.6,
                "loop": "hold_on_last_frame",
                "bones": {
                    "body": grow(0.0, 0.35),
                    "rightArm": grow(0.3, 0.75),
                    "leftArm": grow(0.3, 0.75),
                    "rightLeg": grow(0.55, 1.0),
                    "leftLeg": grow(0.55, 1.0),
                    "head": grow(0.95, 1.4),
                },
            },
            "animation.superhuman.nano.retract": {
                "animation_length": 0.8,
                "loop": "hold_on_last_frame",
                "bones": {
                    "head": shrink(0.0, 0.25),
                    "rightArm": shrink(0.1, 0.45),
                    "leftArm": shrink(0.1, 0.45),
                    "rightLeg": shrink(0.2, 0.55),
                    "leftLeg": shrink(0.2, 0.55),
                    "body": shrink(0.4, 0.75),
                },
            },
            "animation.superhuman.nano.hide_in_hand": {
                "loop": True,
                "bones": {b: {"scale": in_hand} for b in ("body", "head", "rightArm", "leftArm", "rightLeg", "leftLeg")},
            },
            "animation.superhuman.nano.core_pulse": {
                "loop": True,
                "bones": {"body": {"scale": in_hand}},
            },
        },
    }


SWING = "variable.sh_swing"


def humanoid_animations() -> Dict:
    t = "query.anim_time"
    return {
        "format_version": "1.10.0",
        "animations": {
            "animation.superhuman.humanoid.look_at": {
                "loop": True,
                "bones": {"head": {"rotation": ["query.target_x_rotation", "query.target_y_rotation", 0]}},
            },
            "animation.superhuman.humanoid.walk": {
                "loop": True,
                "bones": {
                    "rightArm": {"rotation": [f"-{SWING} * 0.8", 0, 0]},
                    "leftArm": {"rotation": [f"{SWING} * 0.8", 0, 0]},
                    "rightLeg": {"rotation": [f"{SWING} * 1.2", 0, 0]},
                    "leftLeg": {"rotation": [f"-{SWING} * 1.2", 0, 0]},
                },
            },
            "animation.superhuman.humanoid.idle": {
                "loop": True,
                "bones": {
                    "rightArm": {"rotation": [0, 0, "math.cos(query.life_time * 103.2) * 2.8 + 2.8"]},
                    "leftArm": {"rotation": [0, 0, "-(math.cos(query.life_time * 103.2) * 2.8 + 2.8)"]},
                },
            },
            "animation.superhuman.humanoid.attack": {
                "loop": True,
                "bones": {
                    "rightArm": {"rotation": ["-math.sin(variable.attack_time * 180) * 110", "-math.sin(variable.attack_time * 180) * 15", 0]},
                    "leftArm": {"rotation": ["-math.sin(variable.attack_time * 180) * 30", 0, 0]},
                    "body": {"rotation": [0, "math.sin(variable.attack_time * 180) * 12", 0]},
                },
            },
            "animation.superhuman.humanoid.cast": {
                "loop": True,
                "bones": {
                    "rightArm": {"rotation": ["-80 + math.clamp(query.target_x_rotation, -40, 40) + math.sin(query.life_time * 400) * 4", -10, 0]},
                    "leftArm": {"rotation": ["-80 + math.clamp(query.target_x_rotation, -40, 40) - math.sin(query.life_time * 400) * 4", 10, 0]},
                },
            },
            "animation.superhuman.humanoid.panic": {
                "loop": True,
                "bones": {
                    "head": {"rotation": [-15, 0, 0]},
                    "rightArm": {"rotation": [f"-165 + math.sin({t} * 900) * 25", 0, f"18 + math.cos({t} * 900) * 8"]},
                    "leftArm": {"rotation": [f"-165 + math.cos({t} * 900) * 25", 0, f"-18 - math.sin({t} * 900) * 8"]},
                },
            },
            "animation.superhuman.humanoid.carried": {
                "loop": True,
                "bones": {
                    "body": {"rotation": [-10, 0, 0]},
                    "rightLeg": {"rotation": [f"-45 + math.sin({t} * 240) * 10", 0, 5]},
                    "leftLeg": {"rotation": [f"-45 - math.sin({t} * 240) * 10", 0, -5]},
                    "rightArm": {"rotation": [-150, 0, 10]},
                    "leftArm": {"rotation": [-150, 0, -10]},
                },
            },
            "animation.superhuman.humanoid.cheer": {
                "loop": True,
                "bones": {
                    "root": {"position": [0, f"math.abs(math.sin({t} * 400)) * 2.5", 0]},
                    "rightArm": {"rotation": [f"-160 + math.sin({t} * 600) * 20", 0, 20]},
                    "leftArm": {"rotation": [f"-160 - math.sin({t} * 600) * 20", 0, -20]},
                },
            },
            "animation.superhuman.villain.taunt": {
                "animation_length": 1.2,
                "bones": {
                    "head": {"rotation": {"0.0": v(0, 0, 0), "0.3": v(-25, 0, 0), "0.9": v(-25, 0, 0), "1.2": v(0, 0, 0)}},
                    "rightArm": {"rotation": {"0.0": v(0, 0, 0), "0.3": v(-150, 0, 30), "0.9": v(-150, 0, 30), "1.2": v(0, 0, 0)}},
                    "leftArm": {"rotation": {"0.0": v(0, 0, 0), "0.3": v(-150, 0, -30), "0.9": v(-150, 0, -30), "1.2": v(0, 0, 0)}},
                },
            },
            "animation.superhuman.villain.blast": {
                "animation_length": 0.8,
                "bones": {
                    "body": {"rotation": {"0.0": v(0, 0, 0), "0.25": v(-12, 0, 0), "0.45": v(15, 0, 0), "0.8": v(0, 0, 0)}},
                    "rightArm": {"rotation": {"0.0": v(0, 0, 0), "0.25": v(-170, 0, 20), "0.45": v(-80, 0, 0), "0.8": v(0, 0, 0)}},
                    "leftArm": {"rotation": {"0.0": v(0, 0, 0), "0.25": v(-170, 0, -20), "0.45": v(-80, 0, 0), "0.8": v(0, 0, 0)}},
                },
            },
        },
    }


def rampager_animations() -> Dict:
    spd = "math.min(query.modified_move_speed * 2.0, 1.0)"
    return {
        "format_version": "1.10.0",
        "animations": {
            "animation.superhuman.rampager.walk": {
                "loop": True,
                "bones": {
                    "rightLeg": {"rotation": [f"{SWING} * 0.9", 0, 0]},
                    "leftLeg": {"rotation": [f"-{SWING} * 0.9", 0, 0]},
                    "rightArm": {"rotation": [f"-{SWING} * 0.6", 0, 0]},
                    "leftArm": {"rotation": [f"{SWING} * 0.6", 0, 0]},
                    "body": {
                        "position": [0, f"math.abs(math.cos(query.modified_distance_moved * 25)) * 1.5 * {spd}", 0],
                        "rotation": [0, 0, f"math.cos(query.modified_distance_moved * 25) * 2 * {spd}"],
                    },
                },
            },
            "animation.superhuman.rampager.look_at": {
                "loop": True,
                "bones": {"head": {"rotation": ["math.clamp(query.target_x_rotation, -30, 30)", "math.clamp(query.target_y_rotation, -45, 45)", 0]}},
            },
            "animation.superhuman.rampager.idle": {
                "loop": True,
                "bones": {
                    "body": {"rotation": ["math.sin(query.life_time * 60) * 1.5", 0, 0]},
                    "rightArm": {"rotation": [0, 0, "3 + math.sin(query.life_time * 50) * 2"]},
                    "leftArm": {"rotation": [0, 0, "-3 - math.sin(query.life_time * 50) * 2"]},
                },
            },
            "animation.superhuman.rampager.attack": {
                "loop": True,
                "bones": {
                    "rightArm": {"rotation": ["-math.sin(variable.attack_time * 180) * 120", 0, 0]},
                    "leftArm": {"rotation": ["-math.sin(variable.attack_time * 180) * 120", 0, 0]},
                    "body": {"rotation": ["math.sin(variable.attack_time * 180) * 15", 0, 0]},
                },
            },
            "animation.superhuman.rampager.ground_pound": {
                "animation_length": 1.4,
                "bones": {
                    "root": {"position": {"0.0": v(0, 0, 0), "0.75": v(0, -2, 0), "1.4": v(0, 0, 0)}},
                    "body": {"rotation": {"0.0": v(0, 0, 0), "0.5": v(-15, 0, 0), "0.75": v(30, 0, 0), "1.1": v(25, 0, 0), "1.4": v(0, 0, 0)}},
                    "rightArm": {"rotation": {"0.0": v(0, 0, 0), "0.5": v(-170, 0, 10), "0.75": v(-40, 0, 15), "1.1": v(-40, 0, 15), "1.4": v(0, 0, 0)}},
                    "leftArm": {"rotation": {"0.0": v(0, 0, 0), "0.5": v(-170, 0, -10), "0.75": v(-40, 0, -15), "1.1": v(-40, 0, -15), "1.4": v(0, 0, 0)}},
                },
            },
            "animation.superhuman.rampager.roar": {
                "animation_length": 1.6,
                "bones": {
                    "head": {"rotation": {"0.0": v(0, 0, 0), "0.3": v(-35, 0, 0), "1.2": v(-35, 0, 0), "1.6": v(0, 0, 0)}},
                    "body": {"rotation": {"0.0": v(0, 0, 0), "0.3": v(-10, 0, 0), "1.2": v(-10, 0, 0), "1.6": v(0, 0, 0)}},
                    "rightArm": {"rotation": {"0.0": v(0, 0, 0), "0.3": v(-30, 0, 40), "1.2": v(-30, 0, 40), "1.6": v(0, 0, 0)}},
                    "leftArm": {"rotation": {"0.0": v(0, 0, 0), "0.3": v(-30, 0, -40), "1.2": v(-30, 0, -40), "1.6": v(0, 0, 0)}},
                },
            },
        },
    }


def mech_animations() -> Dict:
    spd = "math.min(query.modified_move_speed * 2.0, 1.0)"
    return {
        "format_version": "1.10.0",
        "animations": {
            "animation.superhuman.mech.walk": {
                "loop": True,
                "bones": {
                    "rightLeg": {"rotation": [f"{SWING} * 0.7", 0, 0]},
                    "leftLeg": {"rotation": [f"-{SWING} * 0.7", 0, 0]},
                    "body": {
                        "position": [0, f"math.abs(math.sin(query.modified_distance_moved * 22)) * 1.2 * {spd}", 0],
                        "rotation": [0, 0, f"math.sin(query.modified_distance_moved * 22) * 1.5 * {spd}"],
                    },
                },
            },
            "animation.superhuman.mech.look_at": {
                "loop": True,
                "bones": {"head": {"rotation": ["math.clamp(query.target_x_rotation, -20, 20)", "math.clamp(query.target_y_rotation, -60, 60)", 0]}},
            },
            "animation.superhuman.mech.aim": {
                "loop": True,
                "bones": {
                    "rightArm": {"rotation": ["-85 + math.clamp(query.target_x_rotation, -30, 30)", 0, 0]},
                    "leftArm": {"rotation": [-20, 0, -5]},
                },
            },
            "animation.superhuman.mech.laser_charge": {
                "animation_length": 2.4,
                "bones": {
                    "body": {"rotation": {"0.0": v(0, 0, 0), "0.6": v(-10, 0, 0), "2.0": v(-10, 0, 0), "2.4": v(0, 0, 0)}},
                    "head": {"rotation": {"0.0": v(0, 0, 0), "0.6": v(10, 0, 0), "0.7": v(10, 3, 0), "0.8": v(10, -3, 0), "0.9": v(10, 0, 0), "2.4": v(0, 0, 0)}},
                },
            },
            "animation.superhuman.mech.stomp": {
                "animation_length": 1.0,
                "bones": {
                    "rightLeg": {"rotation": {"0.0": v(0, 0, 0), "0.4": v(-50, 0, 0), "0.55": v(0, 0, 0), "1.0": v(0, 0, 0)}},
                    "body": {"position": {"0.0": v(0, 0, 0), "0.4": v(0, 2, 0), "0.55": v(0, -1, 0), "1.0": v(0, 0, 0)}},
                },
            },
        },
    }


def misc_animations() -> Dict:
    return {
        "format_version": "1.10.0",
        "animations": {
            "animation.superhuman.projectile.orient": {
                "loop": True,
                "bones": {"root": {"rotation": ["-query.target_x_rotation", "-query.target_y_rotation", 0]}},
            },
            "animation.superhuman.bolt.spin": {
                "loop": True,
                "bones": {"crystal": {"rotation": [0, 0, "query.anim_time * 720"]}},
            },
            "animation.superhuman.missile.spin": {
                "loop": True,
                "bones": {"missile": {"rotation": [0, 0, "query.anim_time * 540"]}},
            },
            "animation.superhuman.meteor.tumble": {
                "loop": True,
                "bones": {"rock": {"rotation": ["query.anim_time * 140", "query.anim_time * 95", 0]}},
            },
        },
    }


ANIMATION_FILES = {
    "superhuman_player.animation.json": player_animations,
    "superhuman_suit.animation.json": suit_animations,
    "superhuman_humanoid.animation.json": humanoid_animations,
    "superhuman_rampager.animation.json": rampager_animations,
    "superhuman_mech.animation.json": mech_animations,
    "superhuman_misc.animation.json": misc_animations,
    "superhuman_nano.animation.json": nano_animations,
}

# Pose animation identifiers used by the scripts (kept in sync with scripts/anim.js)
PLAYER_POSES = [k for k in player_animations()["animations"].keys()]
