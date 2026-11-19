class_name AttackInfo
extends RefCounted
## Dados de um golpe — viaja do Hitbox para o Hurtbox.

var damage := 0.0
var knockback := 0.0
var poise_damage := 0.0
var hitstun := 0.0
var hitstop := 0.0
var is_critical := false
var source: Node


static func create(p_damage: float, p_source: Node, p_knockback := 0.0,
		p_poise := 0.0, p_hitstun := 0.0, p_hitstop := 0.08,
		p_critical := false) -> AttackInfo:
	var info := AttackInfo.new()
	info.damage = p_damage
	info.source = p_source
	info.knockback = p_knockback
	info.poise_damage = p_poise
	info.hitstun = p_hitstun
	info.hitstop = p_hitstop
	info.is_critical = p_critical
	return info
