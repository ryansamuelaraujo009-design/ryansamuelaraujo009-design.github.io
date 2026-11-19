class_name HealthComponent
extends Node
## Componente de vida compartilhado por jogador e inimigos.

signal health_changed(current: float, max_value: float)
signal damaged(amount: float, attacker: Node)
signal died

@export var max_health := 100.0

var current_health := 0.0
var is_dead := false


func _ready() -> void:
	current_health = max_health
	health_changed.emit(current_health, max_health)


func take_damage(amount: float, attacker: Node = null) -> void:
	if is_dead or amount <= 0.0:
		return
	current_health = maxf(current_health - amount, 0.0)
	damaged.emit(amount, attacker)
	health_changed.emit(current_health, max_health)
	if current_health <= 0.0:
		is_dead = true
		died.emit()


func heal(amount: float) -> void:
	if is_dead:
		return
	current_health = minf(current_health + amount, max_health)
	health_changed.emit(current_health, max_health)


func revive(full := true) -> void:
	is_dead = false
	current_health = max_health if full else maxf(current_health, 1.0)
	health_changed.emit(current_health, max_health)
