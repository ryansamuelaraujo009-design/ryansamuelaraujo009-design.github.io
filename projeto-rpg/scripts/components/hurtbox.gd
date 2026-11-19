class_name Hurtbox
extends Area2D
## Área que recebe golpes. Invulnerável durante i-frames da esquiva.

signal hurted(attack: AttackInfo, hurtbox: Hurtbox)

var invulnerable := false
var health: HealthComponent


func _ready() -> void:
	# Procura o HealthComponent mais próximo na hierarquia do ator.
	var node := get_parent()
	while node != null:
		var h := node.get_node_or_null(^"Health") as HealthComponent
		if h != null:
			health = h
			break
		node = node.get_parent()


func take_hit(attack: AttackInfo) -> bool:
	if invulnerable or health == null or health.is_dead:
		return false
	health.take_damage(attack.damage, attack.source)
	hurted.emit(attack, self)
	return true
