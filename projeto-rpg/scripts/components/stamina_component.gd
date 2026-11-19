class_name StaminaComponent
extends Node
## Fôlego do jogador: esquiva, corrida e golpes pesados (Seção 7.2).

signal stamina_changed(current: float, max_value: float)

@export var max_stamina := 100.0
@export var regen_per_second := 28.0
@export var regen_delay := 0.45

var current_stamina := 0.0
var _delay_left := 0.0


func _ready() -> void:
	current_stamina = max_stamina
	stamina_changed.emit(current_stamina, max_stamina)


func _process(delta: float) -> void:
	if _delay_left > 0.0:
		_delay_left -= delta
		return
	if current_stamina < max_stamina:
		current_stamina = minf(current_stamina + regen_per_second * delta, max_stamina)
		stamina_changed.emit(current_stamina, max_stamina)


func spend(amount: float, apply_delay := true) -> bool:
	if amount <= 0.0:
		return true
	if current_stamina < amount:
		return false
	current_stamina -= amount
	if apply_delay:
		_delay_left = regen_delay
	stamina_changed.emit(current_stamina, max_stamina)
	return true


func drain_over_time(amount_per_second: float, delta: float) -> bool:
	## Gasto contínuo (corrida): sem delay de regeneração.
	if current_stamina <= 0.0:
		return false
	current_stamina = maxf(current_stamina - amount_per_second * delta, 0.0)
	stamina_changed.emit(current_stamina, max_stamina)
	return true
